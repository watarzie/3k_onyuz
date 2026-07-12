import { DatePipe, NgClass } from '@angular/common';
import { Component, computed, effect, HostListener, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { BildirimService } from '../../core/services/bildirim.service';
import { OnayService } from '../../core/services/onay.service';
import { PermissionService } from '../../core/services/permission.service';
import { TranslationService } from '../../core/services/translation.service';
import { BildirimDto, BildirimTipi } from '../../shared/models';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { ToggleService } from './toggle.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [TranslatePipe, RouterLink, NgClass, DatePipe],
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

  private approvalUpdateSubscription?: Subscription;

  get canSeeApprovalQueue(): boolean {
    return this.permissions.hasAccess('islem-onay-merkezi');
  }

  constructor() {
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
  }

  ngOnDestroy(): void {
    this.approvalUpdateSubscription?.unsubscribe();
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
    this.auth.logout();
  }

  @HostListener('window:scroll')
  onScroll(): void {
    this.isSticky.set(window.scrollY >= 50);
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
