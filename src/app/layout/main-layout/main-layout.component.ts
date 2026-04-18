import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NgClass } from '@angular/common';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { HeaderComponent } from '../header/header.component';
import { ToggleService } from '../header/toggle.service';
import { PermissionService } from '../../core/services/permission.service';
import { ToastComponent } from '../../shared/components/toast/toast.component';
import { SessionTimeoutService } from '../../core/services/session-timeout.service';
import { SessionTimeoutModalComponent } from '../../shared/components/session-timeout-modal/session-timeout-modal.component';
import { ConfirmModalComponent } from '../../shared/components/confirm-modal/confirm-modal.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, HeaderComponent, NgClass, ToastComponent, SessionTimeoutModalComponent, ConfirmModalComponent],
  template: `
    <app-sidebar />
    <div class="main-content" [ngClass]="{'sidebar-toggled': toggleService.isSidebarToggled()}">
      <app-header />
      <div class="content-wrapper">
        <router-outlet />
      </div>
    </div>
    <app-toast />
    <app-session-timeout-modal />
    <app-confirm-modal />
  `,
  styles: [`
    .main-content {
      margin-left: 260px;
      min-height: 100vh;
      background: #F6F7F9;
      transition: .3s ease;
    }
    .content-wrapper { padding: 25px; }
    @media (max-width: 991.98px) {
      .main-content { margin-left: 0; }
    }
  `],
})
export class MainLayoutComponent implements OnInit {
  toggleService = inject(ToggleService);
  private permissionService = inject(PermissionService);
  private sessionTimeout = inject(SessionTimeoutService);

  ngOnInit(): void {
    if (!this.permissionService.loaded()) {
      this.permissionService.loadPermissions();
    }
    // Session timeout izlemeyi başlat
    this.sessionTimeout.initialize();
  }
}
