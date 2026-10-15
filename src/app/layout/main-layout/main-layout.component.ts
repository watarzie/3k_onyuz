import { Component, computed, DestroyRef, ElementRef, inject, OnInit, signal, viewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NgClass } from '@angular/common';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { HeaderComponent } from '../header/header.component';
import { ToggleService } from '../../core/services/toggle.service';
import { PermissionService } from '../../core/services/permission.service';
import { ToastComponent } from '../../shared/components/toast/toast.component';
import { SessionTimeoutService } from '../../core/services/session-timeout.service';
import { ConfirmModalComponent } from '../../shared/components/confirm-modal/confirm-modal.component';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

/** Kenar menünün mobil kırılımı (sidebar SCSS ile aynı): bu genişlikte "toggled" = menü açık. */
const MOBIL_SORGUSU = '(max-width: 1199.98px)';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, HeaderComponent, NgClass, ToastComponent, ConfirmModalComponent, TranslatePipe],
  template: `
    <a class="visually-hidden-focusable icerige-gec" href="#ana-icerik" (click)="icerigeGec($event)"
      [attr.inert]="mobilMenuAcik() ? '' : null">{{ 'LAYOUT.ICERIGE_GEC' | translate }}</a>
    <app-sidebar />
    <div class="main-content" [ngClass]="{'sidebar-toggled': toggleService.isSidebarToggled()}"
      [attr.inert]="mobilMenuAcik() ? '' : null">
      <app-header />
      <main #anaIcerik id="ana-icerik" class="content-wrapper" tabindex="-1">
        <router-outlet />
      </main>
    </div>
    <app-toast />
    <app-confirm-modal />
  `,
  styles: [`
    /* Kenar menü genişlikleri tek yerde: sidebar bu değişkenleri miras alır, içerik boşluğu aynı değerden gelir. */
    :host {
      --kenar-genislik: 260px;
      --kenar-dar-genislik: 80px;
    }
    /* İçeriğe geç: yalnız klavye odağında görünür (visually-hidden-focusable); menünün ve başlığın üstünde. */
    .icerige-gec:focus {
      position: fixed;
      top: 12px;
      left: 12px;
      z-index: 1100;
      padding: 10px 16px;
      border-radius: 10px;
      background: var(--brandColor);
      color: var(--whiteColor);
      font-family: var(--fontFamily);
      font-size: 14px;
      font-weight: 600;
      line-height: 1.2;
      text-decoration: none;
      outline: 2px solid var(--brandColor);
      outline-offset: 2px;
      box-shadow: none;
    }
    /* Global a:hover moru sızmasın. */
    .icerige-gec:hover {
      color: var(--whiteColor);
    }
    .main-content {
      margin-left: var(--kenar-genislik);
      min-height: 100dvh;
      background: #F6F7F9;
      transition: margin-left .25s ease;
      min-width: 0;
      overflow-x: hidden;
    }
    .content-wrapper {
      padding: clamp(14px, 2vw, 25px);
      max-width: 100%;
      min-width: 0;
      overflow-x: hidden;
    }
    /* tabindex=-1 yalnız programatik odak (içeriğe geç) için; içerik çerçeve çizmesin. */
    main.content-wrapper:focus {
      outline: none;
    }
    /* Masaüstünde hamburger menüyü 80px ikon moduna alır; içerik dar menü kadar sola yaklaşır. */
    @media (min-width: 1200px) {
      .main-content.sidebar-toggled { margin-left: var(--kenar-dar-genislik); }
    }
    @media (max-width: 1199.98px) {
      .main-content { margin-left: 0; }
    }
    @media (max-width: 575.98px) {
      .content-wrapper { padding: 12px; }
    }
    @media (prefers-reduced-motion: reduce) {
      .main-content { transition: none; }
    }
  `],
})
export class MainLayoutComponent implements OnInit {
  toggleService = inject(ToggleService);
  private permissionService = inject(PermissionService);
  private sessionTimeout = inject(SessionTimeoutService);

  private readonly anaIcerik = viewChild.required<ElementRef<HTMLElement>>('anaIcerik');

  /** Mobil kırılım sorgusu; matchMedia olmayan ortamda (SSR) null = mobil (sidebar ile aynı kabul). */
  private readonly mobilSorgusu: MediaQueryList | null =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(MOBIL_SORGUSU)
      : null;

  private readonly mobilGorunum = signal(this.mobilSorgusu?.matches ?? true);

  /**
   * Mobil açılır menü açık mı. Açıkken başlık ve içerik inert: odak ve ekran okuyucu karartmanın arkasına
   * kaçmasın. Masaüstünde "toggled" daraltma demek; orada asla inert yapılmaz.
   */
  readonly mobilMenuAcik = computed(() => this.mobilGorunum() && this.toggleService.isSidebarToggled());

  constructor() {
    const sorgu = this.mobilSorgusu;
    if (sorgu) {
      const kirilimDegisti = (olay: MediaQueryListEvent) => this.mobilGorunum.set(olay.matches);
      sorgu.addEventListener('change', kirilimDegisti);
      inject(DestroyRef).onDestroy(() => sorgu.removeEventListener('change', kirilimDegisti));
    }
  }

  ngOnInit(): void {
    if (!this.permissionService.loaded()) {
      this.permissionService.loadPermissions();
    }
    // JWT geçerlilik süresini izlemeyi başlat
    this.sessionTimeout.initialize();
  }

  /** İçeriğe geç: odak <main>'e taşınır, kenar menü ve başlık atlanır. */
  icerigeGec(olay: Event): void {
    // <base href="/"> yüzünden düz "#ana-icerik" bağlantısı /#ana-icerik adresine tam sayfa gider; engellenir.
    olay.preventDefault();
    this.anaIcerik().nativeElement.focus();
  }
}
