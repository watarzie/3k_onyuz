import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NgClass } from '@angular/common';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { HeaderComponent } from '../header/header.component';
import { ToggleService } from '../header/toggle.service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, HeaderComponent, NgClass],
  template: `
    <app-sidebar />
    <div class="main-content" [ngClass]="{'sidebar-toggled': toggleService.isSidebarToggled()}">
      <app-header />
      <div class="content-wrapper">
        <router-outlet />
      </div>
    </div>
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
export class MainLayoutComponent {
  toggleService = inject(ToggleService);
}
