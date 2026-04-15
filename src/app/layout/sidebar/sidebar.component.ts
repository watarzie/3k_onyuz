import { Component, inject, signal, computed } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NgClass } from '@angular/common';
import { ToggleService } from '../header/toggle.service';
import { TranslationService } from '../../core/services/translation.service';
import { AuthService } from '../../core/auth/auth.service';

interface MenuItemDef {
  labelKey: string;
  icon: string;
  route?: string;
  children?: { labelKey: string; route: string }[];
}

interface MenuItem {
  label: string;
  icon: string;
  route?: string;
  children?: { label: string; route: string }[];
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
  auth = inject(AuthService);

  openIndex = signal(-1);

  /** Menü tanımları — sadece key'ler tutulur */
  private menuDefs: MenuItemDef[] = [
    { labelKey: 'MENU.DASHBOARD', icon: 'ri-dashboard-line', route: '/dashboard' },
    {
      labelKey: 'MENU.PROJELER', icon: 'ri-folder-line',
      children: [
        { labelKey: 'MENU.AKTIF_PROJELER', route: '/projeler' },
        { labelKey: 'MENU.SEVK_EDILEN', route: '/projeler/sevk-edilen' },
      ],
    },
    { labelKey: 'MENU.SANDIK_YONETIMI', icon: 'ri-archive-line', route: '/sandik-yonetimi' },
    { labelKey: 'MENU.EKSIK_LISTESI', icon: 'ri-error-warning-line', route: '/eksik-listesi' },
    { labelKey: 'MENU.DEPO_DURUMU', icon: 'ri-building-2-line', route: '/depo-durumu' },
    { labelKey: 'MENU.FB_TRANSFER', icon: 'ri-arrow-left-right-line', route: '/fb-transfer' },
    { labelKey: 'MENU.STOK_MODULU', icon: 'ri-stack-line', route: '/stok' },
    { labelKey: 'MENU.SAHA_MALZEMESI', icon: 'ri-tools-line', route: '/saha-malzeme' },
    { labelKey: 'MENU.HAREKET_GECMISI', icon: 'ri-history-line', route: '/hareket-gecmisi' },
    { labelKey: 'MENU.KULLANICI_YETKI', icon: 'ri-user-settings-line', route: '/kullanicilar' },
  ];

  /** Dil değiştiğinde otomatik güncellenir (computed + signal) */
  menu = computed<MenuItem[]>(() => {
    // currentLang signal'ına bağımlılık → dil değişince yeniden hesaplanır
    this.ts.currentLang();
    return this.menuDefs.map(def => ({
      label: this.ts.translate(def.labelKey),
      icon: def.icon,
      route: def.route,
      children: def.children?.map(child => ({
        label: this.ts.translate(child.labelKey),
        route: child.route,
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
