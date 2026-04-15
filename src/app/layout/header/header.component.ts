import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { Component, inject, signal, HostListener } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgClass } from '@angular/common';
import { ToggleService } from './toggle.service';
import { AuthService } from '../../core/auth/auth.service';
import { TranslationService } from '../../core/services/translation.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [TranslatePipe, RouterLink, NgClass],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent {
  toggleService = inject(ToggleService);
  auth = inject(AuthService);
  ts = inject(TranslationService);

  isSticky = signal(false);
  isProfileOpen = signal(false);
  isLangOpen = signal(false);

  toggle() { this.toggleService.toggle(); }

  toggleProfile() { this.isProfileOpen.update(v => !v); }

  toggleLang() { this.isLangOpen.update(v => !v); }

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
    if (!target.closest('.profile-menu')) {
      this.isProfileOpen.set(false);
    }
    if (!target.closest('.lang-menu')) {
      this.isLangOpen.set(false);
    }
  }
}
