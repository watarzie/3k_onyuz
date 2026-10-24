import { DatePipe, NgClass } from '@angular/common';
import { Component, computed, DestroyRef, effect, HostListener, inject, NgZone, OnDestroy, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { BildirimService } from '../../core/services/bildirim.service';
import { OnayService } from '../../core/services/onay.service';
import { PermissionService } from '../../core/services/permission.service';
import { TranslationService } from '../../core/services/translation.service';
import { BildirimDto, BildirimTipi } from '../../shared/models';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { ToggleService } from '../../core/services/toggle.service';
import { YETKI } from '../../core/constants/yetki-kodlari';
import { GenelAramaComponent } from '../genel-arama/genel-arama.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [TranslatePipe, RouterLink, NgClass, DatePipe, GenelAramaComponent],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent implements OnInit, OnDestroy {
  toggleService = inject(ToggleService);
  auth = inject(AuthService);
  ts = inject(TranslationService);
  permissions = inject(PermissionService);
  onayService = inject(OnayService);
  bildirimService = inject(BildirimService);
  private router = inject(Router);

  isSticky = signal(false);
  isProfileOpen = signal(false);
  isLangOpen = signal(false);
  isNotificationOpen = signal(false);
  bekleyenIslemSayisi = signal(0);
  markingAllRead = signal(false);

  notificationBadgeCount = computed(() =>
    this.bildirimService.toplamOkunmamis() + (this.canSeeApprovalQueue ? this.bekleyenIslemSayisi() : 0)
  );

  /** Kenar menünün masaüstü kırılımı (sidebar ile aynı); hamburgerin anlamı genişliğe göre değişir. */
  private readonly masaustuSorgusu: MediaQueryList | null =
    typeof window.matchMedia === 'function' ? window.matchMedia('(min-width: 1200px)') : null;
  private readonly masaustu = signal(this.masaustuSorgusu?.matches ?? false);

  /** Hamburger aria-expanded: masaüstünde "toggled" = daraltılmış, mobilde "toggled" = açık. */
  readonly menuGenis = computed(() =>
    this.masaustu() ? !this.toggleService.isSidebarToggled() : this.toggleService.isSidebarToggled()
  );

  /** Hamburgerin yapacağı işi söyleyen etiket anahtarı. */
  readonly menuDugmesiEtiketi = computed(() => {
    const toggled = this.toggleService.isSidebarToggled();
    if (this.masaustu()) return toggled ? 'SIDEBAR.MENU_GENISLET' : 'SIDEBAR.MENU_DARALT';
    return toggled ? 'SIDEBAR.MENUYU_KAPAT' : 'SIDEBAR.MENU_AC';
  });

  private approvalUpdateSubscription?: Subscription;
  private permissionUpdateSubscription?: Subscription;

  get canSeeApprovalQueue(): boolean {
    return this.permissions.hasAccess(YETKI.ONAY.MERKEZI);
  }

  constructor() {
    // Kaydırma Angular zone'u dışında dinlenir: her kaydırma olayı bütün sayfada değişiklik denetimi başlatmaz.
    // Yalnız eşik geçilince sinyal değişir ve başlık yeniden çizilir.
    const kaydirildi = () => {
      const yapiskan = window.scrollY >= 50;
      if (yapiskan !== this.isSticky()) this.isSticky.set(yapiskan);
    };
    inject(NgZone).runOutsideAngular(() => window.addEventListener('scroll', kaydirildi, { passive: true }));
    inject(DestroyRef).onDestroy(() => window.removeEventListener('scroll', kaydirildi));

    const masaustuSorgusu = this.masaustuSorgusu;
    if (masaustuSorgusu) {
      const kirilimDegisti = (olay: MediaQueryListEvent) => this.masaustu.set(olay.matches);
      masaustuSorgusu.addEventListener('change', kirilimDegisti);
      inject(DestroyRef).onDestroy(() => masaustuSorgusu.removeEventListener('change', kirilimDegisti));
    }

    effect(() => {
      if (this.canSeeApprovalQueue) {
        this.fetchApprovalCount();
      } else {
        this.bekleyenIslemSayisi.set(0);
      }
    });
  }

  ngOnInit(): void {
    this.bildirimService.connectToStream();
    this.approvalUpdateSubscription = this.bildirimService.onayGuncellendi$.subscribe(() => {
      if (this.canSeeApprovalQueue) this.fetchApprovalCount();
    });
    this.permissionUpdateSubscription = this.bildirimService.yetkiGuncellendi$.subscribe(() => {
      void this.permissions.refreshPermissions();
    });
  }

  ngOnDestroy(): void {
    this.approvalUpdateSubscription?.unsubscribe();
    this.permissionUpdateSubscription?.unsubscribe();
    this.bildirimService.disconnectStream();
  }

  fetchApprovalCount(): void {
    if (!this.canSeeApprovalQueue) return;

    this.onayService.getBekleyenSayisi().subscribe(res => {
      if (res.isSuccess) this.bekleyenIslemSayisi.set(res.value ?? 0);
    });
  }

  toggle(): void {
    this.toggleService.toggle();
  }

  toggleProfile(): void {
    this.isProfileOpen.update(value => !value);
  }

  toggleLang(): void {
    this.isLangOpen.update(value => !value);
  }

  toggleNotification(): void {
    this.isNotificationOpen.update(value => !value);
    if (this.isNotificationOpen()) this.bildirimService.loadUnread();
  }

  openNotification(bildirim: BildirimDto): void {
    this.isNotificationOpen.set(false);
    void this.router.navigate(['/bildirimler', bildirim.id]);
  }

  openNotificationCenter(): void {
    this.isNotificationOpen.set(false);
  }

  markAllAsRead(): void {
    if (this.markingAllRead() || this.bildirimService.toplamOkunmamis() === 0) return;

    this.markingAllRead.set(true);
    this.bildirimService.markAllAsRead().subscribe(() => this.markingAllRead.set(false));
  }

  getBildirimIcon(tipId: BildirimTipi): string {
    return tipId === BildirimTipi.CekiRevizyonuYuklendi
      ? 'ri-file-edit-line'
      : 'ri-file-excel-2-line';
  }

  getBildirimClass(tipId: BildirimTipi): string {
    return tipId === BildirimTipi.CekiRevizyonuYuklendi ? 'revision' : 'upload';
  }

  switchLang(lang: string): void {
    this.ts.switchLanguage(lang);
    this.isLangOpen.set(false);
  }

  logout(): void {
    this.auth.cikisYap();
  }

  @HostListener('document:click', ['$event'])
  onDocClick(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.profile-menu') && this.isProfileOpen()) this.isProfileOpen.set(false);
    if (!target.closest('.lang-menu') && this.isLangOpen()) this.isLangOpen.set(false);
    if (!target.closest('.notification-wrapper') && this.isNotificationOpen()) {
      this.isNotificationOpen.set(false);
    }
  }
}
