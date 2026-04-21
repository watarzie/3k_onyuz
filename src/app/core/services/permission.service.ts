import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API } from '../constants/api-endpoints';
import { MenuTreeDto } from '../../shared/models';
import { YetkiTipi } from '../constants/enums';

/**
 * Yetki Servisi — Backend-driven RBAC.
 *
 * GÜVENLİK PRENSİBİ:
 * - Menü ağacı TAMAMEN backend'den gelir (zaten filtrelenmiş).
 * - Backend yetkisiz (N) menüleri hiç göndermez.
 * - Frontend sadece render eder, filtreleme YAPMAZ.
 * - Route Guard bu servisteki yetkili route listesini kontrol eder.
 */
@Injectable({ providedIn: 'root' })
export class PermissionService {
  private http = inject(HttpClient);

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

  /**
   * Route Guard'lar tarafından yetki sisteminin yüklendiğinden emin olmak için çağrılır.
   */
  ensurePermissionsLoaded(): Promise<boolean> {
    if (this.loaded()) {
      return Promise.resolve(true);
    }
    
    if (!this.loadPromise) {
      this.loadPromise = new Promise<boolean>((resolve) => {
        this.http.get<MenuTreeDto[]>(API.MENU.KULLANICI_MENU).subscribe({
          next: (menuAgaci) => {
            this._menuAgaci.set(menuAgaci);
            const map = new Map<string, number>();
            const routes = new Set<string>();
            this.flattenTree(menuAgaci, map, routes);
            this._yetkiMap.set(map);
            this._allowedRoutes.set(routes);
            this.loaded.set(true);
            resolve(true);
          },
          error: () => {
            this.loaded.set(true);
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
  loadPermissions(): void {
    this.ensurePermissionsLoaded();
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
    this._menuAgaci.set([]);
    this._yetkiMap.set(new Map());
    this._allowedRoutes.set(new Set());
    this.loaded.set(false);
  }

  // ===== Private Helpers =====

  private flattenTree(nodes: MenuTreeDto[], map: Map<string, number>, routes: Set<string>): void {
    for (const node of nodes) {
      if (node.kod) {
        map.set(node.kod, node.yetkiTipiId);
      }
      if (node.route) {
        routes.add(node.route);
      }
      if (node.children?.length) {
        this.flattenTree(node.children, map, routes);
      }
    }
  }
}
