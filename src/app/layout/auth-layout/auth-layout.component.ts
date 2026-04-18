import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastComponent } from '../../shared/components/toast/toast.component';

@Component({
  selector: 'app-auth-layout',
  standalone: true,
  imports: [RouterOutlet, ToastComponent],
  template: `
    <div class="auth-wrapper">
      <router-outlet />
    </div>
    <app-toast />
  `,
  styles: [`
    .auth-wrapper {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #0a1929 0%, #1a2f4a 50%, #0a1929 100%);
    }
  `],
})
export class AuthLayoutComponent {}
