import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastComponent } from '../../shared/components/toast/toast.component';

/**
 * Giriş sayfalarının zemini: derin lacivert üstünde yavaşça dolaşan marka yeşili ve camgöbeği aurora ışıkları,
 * kenarlara doğru sönen ince ızgara. Hareket azaltma tercihinde ışıklar sabit kalır.
 */
@Component({
  selector: 'app-auth-layout',
  standalone: true,
  imports: [RouterOutlet, ToastComponent],
  template: `
    <div class="auth-wrapper">
      <div class="auth-aurora" aria-hidden="true">
        <span class="aurora aurora--green"></span>
        <span class="aurora aurora--cyan"></span>
        <span class="aurora aurora--violet"></span>
      </div>
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
        radial-gradient(ellipse 80% 60% at 50% 120%, rgba(34, 199, 45, .14), transparent 60%),
        linear-gradient(180deg, #040a14 0%, #050c18 55%, #03080f 100%);
    }

    .auth-aurora {
      position: absolute;
      inset: 0;
      pointer-events: none;
      filter: blur(90px);
      opacity: .7;
    }
    .aurora {
      position: absolute;
      border-radius: 50%;
      will-change: transform;
    }
    .aurora--green {
      width: 46vw;
      height: 46vw;
      left: -8vw;
      top: 18vh;
      background: radial-gradient(circle, rgba(52, 228, 63, .34), transparent 65%);
      animation: aurora-a 22s ease-in-out infinite alternate;
    }
    .aurora--cyan {
      width: 38vw;
      height: 38vw;
      right: -6vw;
      top: -10vh;
      background: radial-gradient(circle, rgba(34, 211, 238, .26), transparent 65%);
      animation: aurora-b 26s ease-in-out infinite alternate;
    }
    .aurora--violet {
      width: 30vw;
      height: 30vw;
      right: 18vw;
      bottom: -14vh;
      background: radial-gradient(circle, rgba(124, 108, 255, .18), transparent 65%);
      animation: aurora-c 30s ease-in-out infinite alternate;
    }
    @keyframes aurora-a { to { transform: translate(14vw, -8vh) scale(1.12); } }
    @keyframes aurora-b { to { transform: translate(-10vw, 14vh) scale(.92); } }
    @keyframes aurora-c { to { transform: translate(-16vw, -10vh) scale(1.15); } }

    .auth-wrapper::after {
      content: "";
      position: absolute;
      inset: 0;
      pointer-events: none;
      background-image:
        linear-gradient(rgba(255,255,255,.022) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,.018) 1px, transparent 1px);
      background-size: 48px 48px;
      -webkit-mask-image: radial-gradient(ellipse 70% 60% at 50% 45%, black 30%, transparent 85%);
      mask-image: radial-gradient(ellipse 70% 60% at 50% 45%, black 30%, transparent 85%);
    }

    .auth-wrapper > router-outlet + *,
    .auth-wrapper > :not(.auth-aurora) {
      position: relative;
      z-index: 1;
    }

    @media (prefers-reduced-motion: reduce) {
      .aurora { animation: none; }
    }
  `],
})
export class AuthLayoutComponent {}
