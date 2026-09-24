import { Injectable, inject, signal, computed, DestroyRef, NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API } from '../constants/api-endpoints';
import { MenuTreeDto } from '../../shared/models';
import { YetkiTipi } from '../constants/enums';
import { normalizeMenuTree } from './menu-permission-tree';

/**
 * Yetki Servisi — Backend-driven RBAC.
 *
 * GÜVENLİK PRENSİBİ:
 * - Menü ağacı backend'den gelir; hiyerarşi istemcide de sınırlandırılır.
 * - N üst düğüm ve altı gösterilmez; R üst düğüm altındaki W işlemleri etkin sayılmaz.
 * - Route Guard bu servisteki yetkili route listesini kontrol eder.
 */
@Injectable({ providedIn: 'root' })
export class PermissionService {
  private http = inject(HttpClient);
  private destroyRef = inject(DestroyRef);
  private zone = inject(NgZone);
  private channel: BroadcastChannel | null = null;
  private readonly focusRefreshAgeMs = 5 * 60 * 1000;
  private lastSuccessfulLoadAt = 0;
  private lastRefreshAttemptAt = 0;
  private refreshPromise: Promise<boolean> | null = null;
  private refreshQueued = false;

  constructor() {
    if (typeof window === 'undefined') return;
    const refreshOnFocus = () => {
      const lastCheck = Math.max(this.lastSuccessfulLoadAt, this.lastRefreshAttemptAt);
      if (this.loaded() && Date.now() - lastCheck >= this.focusRefreshAgeMs) {
        this.zone.run(() => void this.refreshPermissions());
      }
    };
    const refreshOnChange = () => {
      if (this.loaded() || this.loadPromise) {
        this.zone.run(() => void this.refreshPermissions());
      }
    };
    window.addEventListener('focus', refreshOnFocus);
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel('3k-permission-changes');
      this.channel.onmessage = refreshOnChange;
    }
    this.destroyRef.onDestroy(() => {
      window.removeEventListener('focus', refreshOnFocus);
      this.channel?.close();
    });
  }

  notifyPermissionsChanged(): void {
    this.channel?.postMessage({ changed: true });
    void this.refreshPermissions();
  }

  /** Backend'den gelen yetkili menü ağacı */
  private _menuAgaci = signal<MenuTreeDto[]>([]);

  /** Flat yetki map: menuKod → YetkiTipiId (1=N, 2=R, 3=W) */
  private _yetkiMap = signal<Map<string, number>>(new Map());

  /** Yetkili route'lar (route guard için) */
  private _allowedRoutes = signal<Set<string>>(new Set());

  /** Yetki bilgisi yüklenmiş mi? */
  loaded = signal(false);

  /** Dış erişim için menü ağacı (sidebar kullanır) */
  menuAgaci = computed(() => this._menuAgaci());

  /** Yetkili route listesi (route guard kullanır) */
  allowedRoutes = computed(() => this._allowedRoutes());

  private loadPromise: Promise<boolean> | null = null;
  private loadVersion = 0;

  /**
   * Route Guard'lar tarafından yetki sisteminin yüklendiğinden emin olmak için çağrılır.
   */
  ensurePermissionsLoaded(): Promise<boolean> {
    if (this.loaded()) {
      return Promise.resolve(true);
    }
    
    if (!this.loadPromise) {
      const requestVersion = this.loadVersion;
      this.loadPromise = new Promise<boolean>((resolve) => {
        this.http.get<MenuTreeDto[]>(API.MENU.KULLANICI_MENU).subscribe({
          next: (menuAgaci) => {
            if (requestVersion !== this.loadVersion) {
              resolve(false);
              return;
            }
            this.applyMenu(menuAgaci);
            resolve(true);
          },
          error: () => {
            if (requestVersion !== this.loadVersion) {
              resolve(false);
              return;
            }
            this._menuAgaci.set([]);
            this._yetkiMap.set(new Map());
            this._allowedRoutes.set(new Set());
            this.loaded.set(false);
            this.loadPromise = null;
            resolve(false);
          },
        });
      });
    }
    
    return this.loadPromise;
  }

  /**
   * Login sonrası çağrılır.
   * Backend'den sadece yetkili menüleri çeker.
   */
  loadPermissions(): Promise<boolean> {
    return this.ensurePermissionsLoaded();
  }

  reloadPermissions(): Promise<boolean> {
    this.clear();
    return this.ensurePermissionsLoaded();
  }

  /** Canlı olay veya kullanıcı etkileşiminde güncelle; arada menüyü/yetkileri boşaltma. */
  refreshPermissions(): Promise<boolean> {
    if (!this.loaded()) {
      const initialLoadPending = this.loadPromise !== null;
      const requestVersion = this.loadVersion;
      const initialLoad = this.ensurePermissionsLoaded();
      return initialLoadPending
        ? initialLoad.then(success => {
            if (requestVersion !== this.loadVersion) return false;
            return success ? this.refreshPermissions() : this.ensurePermissionsLoaded();
          })
        : initialLoad;
    }
    if (this.refreshPromise) {
      this.refreshQueued = true;
      return this.refreshPromise;
    }

    const requestVersion = this.loadVersion;
    const request = async (): Promise<boolean> => {
      let success = false;
      do {
        this.refreshQueued = false;
        this.lastRefreshAttemptAt = Date.now();
        success = await new Promise<boolean>((resolve) => {
          this.http.get<MenuTreeDto[]>(API.MENU.KULLANICI_MENU).subscribe({
            next: (menuAgaci) => {
              if (requestVersion !== this.loadVersion) return resolve(false);
              // İstek sürerken gelen yetki olayı eski snapshot'ı geçersiz kılar.
              if (!this.refreshQueued) this.applyMenu(menuAgaci);
              resolve(true);
            },
            error: () => resolve(false),
          });
        });
      } while (this.refreshQueued && requestVersion === this.loadVersion && this.loaded());
      return success && requestVersion === this.loadVersion;
    };
    const pending = request().finally(() => {
      if (this.refreshPromise === pending) this.refreshPromise = null;
    });
    this.refreshPromise = pending;
    return pending;
  }

  /** Menüye erişim var mı? (W veya R) */
  hasAccess(menuKod: string): boolean {
    const yetki = this._yetkiMap().get(menuKod);
    return yetki === YetkiTipi.W || yetki === YetkiTipi.R;
  }

  /** Menüye yazma yetkisi var mı? */
  canWrite(menuKod: string): boolean {
    return this._yetkiMap().get(menuKod) === YetkiTipi.W;
  }

  /** Menüye sadece okuma yetkisi var mı? */
  isReadOnly(menuKod: string): boolean {
    return this._yetkiMap().get(menuKod) === YetkiTipi.R;
  }

  /** Route'a erişim var mı? (Route Guard kullanır) */
  isRouteAllowed(route: string): boolean {
    // Normalize: /projeler → /projeler
    const normalized = route.startsWith('/') ? route : `/${route}`;
    return this._allowedRoutes().has(normalized);
  }

  /** Oturumu temizle */
  clear(): void {
    this.loadVersion++;
    this.lastSuccessfulLoadAt = 0;
    this.lastRefreshAttemptAt = 0;
    this.refreshQueued = false;
    this.refreshPromise = null;
    this._menuAgaci.set([]);
    this._yetkiMap.set(new Map());
    this._allowedRoutes.set(new Set());
    this.loaded.set(false);
    this.loadPromise = null;
  }

  // ===== Private Helpers =====

  private applyMenu(menuAgaci: MenuTreeDto[]): void {
    const effectiveMenu = normalizeMenuTree(menuAgaci, true);
    const map = new Map<string, number>();
    const routes = new Set<string>();
    this.flattenTree(effectiveMenu, map, routes);
    this._menuAgaci.set(effectiveMenu);
    const previous = this._yetkiMap();
    if (previous.size !== map.size || [...map].some(([code, permission]) => previous.get(code) !== permission)) {
      this._yetkiMap.set(map);
    }
    this._allowedRoutes.set(routes);
    this.loaded.set(true);
    this.lastSuccessfulLoadAt = Date.now();
  }

  private flattenTree(nodes: MenuTreeDto[], map: Map<string, number>, routes: Set<string>): void {
    for (const node of nodes) {
      if (node.kod) {
        map.set(node.kod, node.yetkiTipiId);
      }
      if (node.route && node.yetkiTipiId >= YetkiTipi.R) {
        routes.add(node.route);
      }
      if (node.children?.length) {
        this.flattenTree(node.children, map, routes);
      }
    }
  }
}
