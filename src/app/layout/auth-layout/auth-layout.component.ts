import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastComponent } from '../../shared/components/toast/toast.component';

/**
 * Giriş ve çıkış sayfalarının zemini: açık, sakin bir yüzey; sağ üstte çok hafif marka yeşili, sol altta
 * çok hafif gri ışık ve kenarlara doğru sönen soluk nokta ızgarası. Hareket yoktur; dikkat karttadır.
 */
@Component({
  selector: 'app-auth-layout',
  standalone: true,
  imports: [RouterOutlet, ToastComponent],
  template: `
    <div class="auth-wrapper">
      <div class="auth-zemin" aria-hidden="true"></div>
      <!-- Yönlendirilen bileşenin host'una kapsüllü stil uygulanamadığı için katman bu sarmalayıcıda verilir. -->
      <div class="auth-icerik">
        <router-outlet />
      </div>
    </div>
    <app-toast />
  `,
  styles: [`
    :host {
      display: block;
    }

    .auth-wrapper {
      position: relative;
      min-height: 100vh;
      min-height: 100dvh;
      isolation: isolate;
      background:
        radial-gradient(ellipse 55% 45% at 100% 0%, color-mix(in srgb, var(--brandColor) 9%, transparent), transparent 70%),
        radial-gradient(ellipse 50% 40% at 0% 100%, color-mix(in srgb, var(--brandInk) 5%, transparent), transparent 70%),
        var(--brandSurface);
    }

    /* Nokta ızgarası ortada belirgin, kenarlara doğru söner; içerikle yarışmaması için çok soluk. */
    .auth-zemin {
      position: absolute;
      inset: 0;
      pointer-events: none;
      background-image: radial-gradient(color-mix(in srgb, var(--brandInk) 9%, transparent) 1px, transparent 1px);
      background-size: 22px 22px;
      -webkit-mask-image: radial-gradient(ellipse 65% 55% at 50% 45%, black 15%, transparent 80%);
      mask-image: radial-gradient(ellipse 65% 55% at 50% 45%, black 15%, transparent 80%);
    }

    .auth-icerik {
      position: relative;
      z-index: 1;
      min-height: 100vh;
      min-height: 100dvh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  `],
})
export class AuthLayoutComponent {}
