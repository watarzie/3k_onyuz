import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NgClass } from '@angular/common';
import { ToggleService } from '../header/toggle.service';
import { I18nService } from '../../shared/i18n/i18n.service';
import { AuthService } from '../../core/auth/auth.service';

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
  i18n = inject(I18nService);
  auth = inject(AuthService);

  openIndex = signal(-1);

  menu: MenuItem[] = [];

  constructor() {
    const t = this.i18n.t();
    this.menu = [
      { label: t.MENU.DASHBOARD, icon: 'ri-dashboard-line', route: '/dashboard' },
      {
        label: t.MENU.PROJELER, icon: 'ri-folder-line',
        children: [
          { label: t.MENU.AKTIF_PROJELER, route: '/projeler' },
          { label: t.MENU.SEVK_EDILEN, route: '/projeler/sevk-edilen' },
        ],
      },
      { label: t.MENU.SANDIK_YONETIMI, icon: 'ri-archive-line', route: '/sandik-yonetimi' },
      { label: t.MENU.EKSIK_LISTESI, icon: 'ri-error-warning-line', route: '/eksik-listesi' },
      { label: t.MENU.DEPO_DURUMU, icon: 'ri-building-2-line', route: '/depo-durumu' },
      { label: t.MENU.FB_TRANSFER, icon: 'ri-arrow-left-right-line', route: '/fb-transfer' },
      { label: t.MENU.STOK_MODULU, icon: 'ri-stack-line', route: '/stok' },
      { label: t.MENU.SAHA_MALZEMESI, icon: 'ri-tools-line', route: '/saha-malzeme' },
      { label: t.MENU.HAREKET_GECMISI, icon: 'ri-history-line', route: '/hareket-gecmisi' },
      { label: t.MENU.KULLANICI_YETKI, icon: 'ri-user-settings-line', route: '/kullanicilar' },
    ];
  }

  toggleSection(i: number) {
    this.openIndex.update((v) => (v === i ? -1 : i));
  }

  closeSidebar() {
    if (this.toggleService.isSidebarToggled()) {
      this.toggleService.toggle();
    }
  }
}
