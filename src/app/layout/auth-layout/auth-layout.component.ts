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
      position: relative;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      background:
        linear-gradient(180deg, rgba(2, 10, 18, .94), rgba(2, 12, 22, .98)),
        radial-gradient(ellipse at 50% 76%, rgba(34, 199, 45, .18), transparent 52%),
        #020912;
    }

    .auth-wrapper::before {
      content: "";
      position: absolute;
      inset: auto -12vw -16vh -12vw;
      height: 34vh;
      pointer-events: none;
      background:
        linear-gradient(172deg, transparent 42%, rgba(38, 223, 56, .34) 49%, rgba(38, 223, 56, .1) 51%, transparent 58%),
        linear-gradient(168deg, transparent 48%, rgba(38, 223, 56, .16) 50%, transparent 55%);
      filter: blur(.2px);
      opacity: .78;
    }

    .auth-wrapper::after {
      content: "";
      position: absolute;
      inset: 0;
      pointer-events: none;
      background-image:
        linear-gradient(rgba(255,255,255,.018) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,.014) 1px, transparent 1px);
      background-size: 44px 44px;
      -webkit-mask-image: linear-gradient(to bottom, transparent, black 18%, black 78%, transparent);
      mask-image: linear-gradient(to bottom, transparent, black 18%, black 78%, transparent);
    }

    .auth-wrapper > * {
      position: relative;
      z-index: 1;
    }
  `],
})
export class AuthLayoutComponent {}
