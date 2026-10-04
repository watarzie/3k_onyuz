import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { ToastComponent } from '../../shared/components/toast/toast.component';

/**
 * Giriş ve çıkış sayfalarının zemini: tanıtım sayfasıyla aynı sıcak kâğıt beyazı, yavaşça dolaşan adaçayı ve ahşap
 * tonunda iki yumuşak ışık, kenarlara doğru sönen ince ızgara ve sol üstte tanıtım sayfasına dönen marka.
 * Hareket azaltma tercihinde ışıklar sabit kalır.
 */
@Component({
  selector: 'app-auth-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, ToastComponent],
  template: `
    <div class="auth-wrapper">
      <div class="auth-aurora" aria-hidden="true">
        <span class="aurora aurora--yesil"></span>
        <span class="aurora aurora--ahsap"></span>
      </div>
      <a class="auth-marka" routerLink="/" aria-label="3K Ahşap Ambalaj tanıtım sayfası">
        <img src="/images/3k-emblem.svg" alt="" />
        <span><b>3K</b><small>Ahşap Ambalaj</small></span>
      </a>
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
      isolation: isolate;
      background:
        radial-gradient(ellipse 80% 55% at 50% 115%, rgba(217, 169, 111, .16), transparent 60%),
        #fbfaf6;
    }

    .auth-aurora {
      position: absolute;
      z-index: -1;
      inset: 0;
      pointer-events: none;
      filter: blur(90px);
    }
    .aurora {
      position: absolute;
      border-radius: 50%;
      will-change: transform;
    }
    .aurora--yesil {
      width: 44vw;
      height: 44vw;
      left: -10vw;
      top: 8vh;
      background: radial-gradient(circle, rgba(127, 169, 143, .28), transparent 65%);
      animation: aurora-a 24s ease-in-out infinite alternate;
    }
    .aurora--ahsap {
      width: 40vw;
      height: 40vw;
      right: -8vw;
      top: -12vh;
      background: radial-gradient(circle, rgba(217, 169, 111, .3), transparent 65%);
      animation: aurora-b 28s ease-in-out infinite alternate;
    }
    @keyframes aurora-a { to { transform: translate(12vw, -6vh) scale(1.1); } }
    @keyframes aurora-b { to { transform: translate(-10vw, 14vh) scale(.92); } }

    .auth-wrapper::after {
      content: "";
      position: absolute;
      z-index: -1;
      inset: 0;
      pointer-events: none;
      background-image:
        linear-gradient(rgba(20, 28, 23, .05) 1px, transparent 1px),
        linear-gradient(90deg, rgba(20, 28, 23, .05) 1px, transparent 1px);
      background-size: 56px 56px;
      -webkit-mask-image: radial-gradient(ellipse 70% 60% at 50% 45%, black 25%, transparent 80%);
      mask-image: radial-gradient(ellipse 70% 60% at 50% 45%, black 25%, transparent 80%);
    }

    .auth-marka {
      position: absolute;
      z-index: 2;
      top: 22px;
      left: 26px;
      display: inline-flex;
      align-items: center;
      gap: 10px;
      color: #141c17;
      text-decoration: none;
    }
    .auth-marka img {
      width: 36px;
      height: 36px;
      border-radius: 11px;
      box-shadow: 0 8px 18px -10px rgba(26, 60, 45, .75);
      transition: transform .5s cubic-bezier(.2, .7, .2, 1);
    }
    .auth-marka:hover img { transform: rotate(-6deg) scale(1.04); }
    .auth-marka span { display: grid; line-height: 1; }
    .auth-marka b {
      font-family: 'Fraunces', Georgia, serif;
      font-size: 20px;
      font-weight: 600;
    }
    .auth-marka small {
      margin-top: 3px;
      color: #69736d;
      font-size: 9.5px;
      font-weight: 600;
      letter-spacing: .2em;
      text-transform: uppercase;
    }

    @media (max-width: 640px) {
      .auth-marka { top: 14px; left: 16px; }
    }

    @media (prefers-reduced-motion: reduce) {
      .aurora { animation: none; }
    }
  `],
})
export class AuthLayoutComponent {}
