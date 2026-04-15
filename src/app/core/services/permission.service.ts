import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API } from '../constants/api-endpoints';
import { MenuTreeDto, YetkiTipi } from '../../shared/models';
import { SessionManager } from '../managers/session.manager';

@Injectable({ providedIn: 'root' })
export class PermissionService {
  private http = inject(HttpClient);
  private session = inject(SessionManager);

  /** Kullanıcının yetki ağacı (login sonrası set edilir) */
  private _menuAgaci = signal<MenuTreeDto[]>([]);

  /** Flat yetki map: menuKod → YetkiTipi */
  private _yetkiMap = signal<Map<string, YetkiTipi>>(new Map());

  /** Yetki bilgisi yüklenmiş mi? */
  loaded = signal(false);

  /** Dış erişim için menü ağacı */
  menuAgaci = computed(() => this._menuAgaci());

  /**
   * Login sonrası çağrılır — kullanıcının rolüne ait yetkileri çeker.
   */
  loadPermissions(): void {
    const rolId = this.session.getRolId();
    if (!rolId) return;

    this.http.get<any>(API.ROL.DETAY(rolId)).subscribe({
      next: (res) => {
        const data = res.data ?? res;
        const menuAgaci: MenuTreeDto[] = data.menuAgaci ?? [];
        this._menuAgaci.set(menuAgaci);

        // Flat map oluştur (recursive)
        const map = new Map<string, YetkiTipi>();
        this.flattenTree(menuAgaci, map);
        this._yetkiMap.set(map);
        this.loaded.set(true);
      },
      error: () => {
        this.loaded.set(true); // hata olsa da devam et
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

  /**
   * Sidebar için filtrelenmiş menü ağacı.
   * Yetkisiz (N) menüler gizlenir.
   */
  getFilteredMenu(): MenuTreeDto[] {
    return this.filterTree(this._menuAgaci());
  }

  /** Oturumu temizle */
  clear(): void {
    this._menuAgaci.set([]);
    this._yetkiMap.set(new Map());
    this.loaded.set(false);
  }

  // ===== Private Helpers =====

  private flattenTree(nodes: MenuTreeDto[], map: Map<string, YetkiTipi>): void {
    for (const node of nodes) {
      if (node.kod) {
        map.set(node.kod, node.yetkiTipi);
      }
      if (node.children?.length) {
        this.flattenTree(node.children, map);
      }
    }
  }

  private filterTree(nodes: MenuTreeDto[]): MenuTreeDto[] {
    return nodes
      .filter(n => n.yetkiTipi === 'W' || n.yetkiTipi === 'R')
      .map(n => ({
        ...n,
        children: n.children ? this.filterTree(n.children) : [],
      }));
  }
}
