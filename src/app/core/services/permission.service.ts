import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API } from '../constants/api-endpoints';
import { MenuTreeDto, YetkiTipi } from '../../shared/models';

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

  /** Flat yetki map: menuKod → YetkiTipi (sadece W ve R olanlar gelir) */
  private _yetkiMap = signal<Map<string, YetkiTipi>>(new Map());

  /** Yetkili route'lar (route guard için) */
  private _allowedRoutes = signal<Set<string>>(new Set());

  /** Yetki bilgisi yüklenmiş mi? */
  loaded = signal(false);

  /** Dış erişim için menü ağacı (sidebar kullanır) */
  menuAgaci = computed(() => this._menuAgaci());

  /** Yetkili route listesi (route guard kullanır) */
  allowedRoutes = computed(() => this._allowedRoutes());

  /**
   * Login sonrası çağrılır.
   * Backend'den sadece yetkili menüleri çeker.
   */
  loadPermissions(): void {
    this.http.get<MenuTreeDto[]>(API.MENU.KULLANICI_MENU).subscribe({
      next: (menuAgaci) => {
        this._menuAgaci.set(menuAgaci);

        // Flat map oluştur
        const map = new Map<string, YetkiTipi>();
        const routes = new Set<string>();
        this.flattenTree(menuAgaci, map, routes);
        this._yetkiMap.set(map);
        this._allowedRoutes.set(routes);
        this.loaded.set(true);
      },
      error: () => {
        this.loaded.set(true);
      },
    });
  }

  /** Menüye erişim var mı? (W veya R) */
  hasAccess(menuKod: string): boolean {
    const yetki = this._yetkiMap().get(menuKod);
    return yetki === 'W' || yetki === 'R';
  }

  /** Menüye yazma yetkisi var mı? */
  canWrite(menuKod: string): boolean {
    return this._yetkiMap().get(menuKod) === 'W';
  }

  /** Menüye sadece okuma yetkisi var mı? */
  isReadOnly(menuKod: string): boolean {
    return this._yetkiMap().get(menuKod) === 'R';
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

  private flattenTree(nodes: MenuTreeDto[], map: Map<string, YetkiTipi>, routes: Set<string>): void {
    for (const node of nodes) {
      if (node.kod) {
        map.set(node.kod, node.yetkiTipi as YetkiTipi);
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
