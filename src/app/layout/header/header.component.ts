import { Component, inject, signal, HostListener } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgClass } from '@angular/common';
import { ToggleService } from './toggle.service';
import { AuthService } from '../../core/auth/auth.service';
import { I18nService } from '../../shared/i18n/i18n.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, NgClass],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent {
  toggleService = inject(ToggleService);
  auth = inject(AuthService);
  i18n = inject(I18nService);

  isSticky = signal(false);
  isProfileOpen = signal(false);

  toggle() { this.toggleService.toggle(); }

  toggleProfile() { this.isProfileOpen.update(v => !v); }

  logout() { this.auth.logout(); }

  @HostListener('window:scroll')
  onScroll() {
    this.isSticky.set(window.scrollY >= 50);
  }

  @HostListener('document:click', ['$event'])
  onDocClick(e: Event) {
    if (!(e.target as HTMLElement).closest('.profile-menu')) {
      this.isProfileOpen.set(false);
    }
  }
}
