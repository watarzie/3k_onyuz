import { Component, inject, signal, computed, OnInit, effect } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NgClass } from '@angular/common';
import { ToggleService } from '../header/toggle.service';
import { TranslationService } from '../../core/services/translation.service';
import { PermissionService } from '../../core/services/permission.service';

interface MenuItem {
  label: string;
  icon: string;
  route?: string | null;
  yetkiTipi: string;
  children?: MenuItem[];
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, NgClass],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  toggleService = inject(ToggleService);
  ts = inject(TranslationService);
  permissionService = inject(PermissionService);

  openIndex = signal(-1);

  /**
   * Menü ağacı — TAMAMEN backend'den gelir.
   * Backend yetkisiz menüleri zaten filtrelemiş olarak gönderir.
   * Frontend sadece translate edip render eder.
   */
  menu = computed<MenuItem[]>(() => {
    // Signal bağımlılıkları: dil + menü ağacı
    this.ts.currentLang();
    const menuAgaci = this.permissionService.menuAgaci();

    return menuAgaci
      .filter(node => node.route || (node.children && node.children.some(c => c.route)))
      .map(node => ({
        label: this.ts.translate(node.labelKey),
        icon: node.icon || '',
        route: node.route,
        yetkiTipi: node.yetkiTipi,
        // Route=null olanları sidebar'da GİZLE (grid-modulu, 3k-modulu gibi)
        children: node.children
          ?.filter(child => !!child.route)
          .map(child => ({
            label: this.ts.translate(child.labelKey),
            icon: child.icon || '',
            route: child.route,
            yetkiTipi: child.yetkiTipi,
          })),
      }));
  });

  toggleSection(i: number) {
    this.openIndex.update((v) => (v === i ? -1 : i));
  }

  closeSidebar() {
    if (this.toggleService.isSidebarToggled()) {
      this.toggleService.toggle();
    }
  }
}
