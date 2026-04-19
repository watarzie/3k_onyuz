import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { Component, effect, inject, signal, HostListener, OnInit, OnDestroy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgClass } from '@angular/common';
import { ToggleService } from './toggle.service';
import { AuthService } from '../../core/auth/auth.service';
import { TranslationService } from '../../core/services/translation.service';
import { PermissionService } from '../../core/services/permission.service';
import { OnayService } from '../../core/services/onay.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [TranslatePipe, RouterLink, NgClass],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent implements OnInit, OnDestroy {
  toggleService = inject(ToggleService);
  auth = inject(AuthService);
  ts = inject(TranslationService);
  permissions = inject(PermissionService);
  onayService = inject(OnayService);

  isSticky = signal(false);
  isProfileOpen = signal(false);
  isLangOpen = signal(false);
  isNotificationOpen = signal(false);

  // Bildirim zili için
  bekleyenIslemSayisi = signal<number>(0);
  get canSeeApprovalQueue() {
    return this.permissions.hasAccess('islem-onay-merkezi');
  }

  constructor() {
    // Reaktif Etki (Effect): Yetkiler backend'den yüklendiğinde veya değiştiğinde tetiklenir
    effect(() => {
      if (this.canSeeApprovalQueue) {
        this.fetchApprovalCount();
        this.onayService.connectToApprovalStream();
      } else {
        this.onayService.disconnectStream();
      }
    });
  }

  ngOnInit() {
    // Anlık işlemler için olay dinleyicisi (SSE'den de tetikleniyor)
    this.onayService.onayIstendi$.subscribe(() => {
      this.fetchApprovalCount();
    });
  }

  ngOnDestroy() {
    this.onayService.disconnectStream();
  }

  fetchApprovalCount() {
    if (!this.canSeeApprovalQueue) return;
    
    this.onayService.getBekleyenSayisi().subscribe(res => {
      if (res.isSuccess) {
        this.bekleyenIslemSayisi.set(res.value || 0);
      }
    });
  }

  toggle() { this.toggleService.toggle(); }

  toggleProfile() { this.isProfileOpen.update(v => !v); }

  toggleLang() { this.isLangOpen.update(v => !v); }

  toggleNotification() { this.isNotificationOpen.update(v => !v); }

  switchLang(lang: string) {
    this.ts.switchLanguage(lang);
    this.isLangOpen.set(false);
  }

  logout() { this.auth.logout(); }

  @HostListener('window:scroll')
  onScroll() {
    this.isSticky.set(window.scrollY >= 50);
  }

  @HostListener('document:click', ['$event'])
  onDocClick(e: Event) {
    const target = e.target as HTMLElement;
    if (!target.closest('.profile-menu') && this.isProfileOpen()) {
      this.isProfileOpen.set(false);
    }
    if (!target.closest('.lang-menu') && this.isLangOpen()) {
      this.isLangOpen.set(false);
    }
    
    // Check if click was inside the notification container, if not close it.
    // However, the button AND the dropdown are inside .profile-menu in our new HTML.
    // So we need to distinct them or just check the notification part.
    // Actually, in the HTML I put it inside a div with class "profile-menu".
    // It's safer to just check .notification-dropdown or give the wrapper a class.
    // Let's add a class 'notification-wrapper' to it. Let's just check the button.
    const isNotificationClick = target.closest('[title="Bildirimler"]') || target.closest('.notification-dropdown');
    if (!isNotificationClick && this.isNotificationOpen()) {
      this.isNotificationOpen.set(false);
    }
  }
}
