import { Injectable, inject, signal, NgZone, DestroyRef } from '@angular/core';
import { Router } from '@angular/router';
import { fromEvent, merge, Subscription, timer } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { SessionManager } from '../managers/session.manager';
import { PermissionService } from '../services/permission.service';

/**
 * Session Timeout Service — Kullanıcı hareketsizliğini ve
 * token süresini izler, modal ile uyarı verir.
 *
 * KULLANIM: MainLayoutComponent'te inject + initialize edilir.
 *
 * Süreler:
 *   - IDLE_TIMEOUT_MS: Kullanıcı hareketsiz kalırsa uyarı verilir (15dk)
 *   - WARNING_SECONDS: Modal geri sayımı (60 saniye)
 *   - CHECK_INTERVAL_MS: Kontrol aralığı (10 saniye)
 */
@Injectable({ providedIn: 'root' })
export class SessionTimeoutService {
  private session = inject(SessionManager);
  private permissions = inject(PermissionService);
  private router = inject(Router);
  private ngZone = inject(NgZone);
  private destroyRef = inject(DestroyRef);

  // ===== Config =====
  private readonly IDLE_TIMEOUT_MS = 15 * 60 * 1000;   // 15 dakika boşta kalma
  private readonly CHECK_INTERVAL_MS = 10_000;          // 10 saniye kontrol
  readonly WARNING_SECONDS = 60;                        // modal geri sayımı

  // ===== State =====
  readonly showModal = signal(false);
  readonly secondsRemaining = signal(this.WARNING_SECONDS);

  private lastActivity = Date.now();
  private checkSub?: Subscription;
  private activitySub?: Subscription;
  private countdownTimer?: ReturnType<typeof setInterval>;

  /** Login sonrası çağrılır */
  initialize(): void {
    this.lastActivity = Date.now();
    this.showModal.set(false);
    this.stopMonitoring();
    this.startMonitoring();
  }

  /** Logout / destroy'da çağrılır */
  stop(): void {
    this.stopMonitoring();
    this.showModal.set(false);
  }

  /** Modal: Oturumu devam ettir */
  continueSession(): void {
    this.lastActivity = Date.now();
    this.showModal.set(false);
    this.clearCountdown();
  }

  /** Modal: İptal → Logout */
  cancelSession(): void {
    this.showModal.set(false);
    this.clearCountdown();
    this.doLogout();
  }

  // ===== Private =====
  private startMonitoring(): void {
    this.ngZone.runOutsideAngular(() => {
      // Kullanıcı aktivitesi
      const events = ['click', 'mousemove', 'keydown', 'scroll', 'touchstart'].map(
        ev => fromEvent(document, ev).pipe(debounceTime(500))
      );
      this.activitySub = merge(...events).subscribe(() => {
        this.lastActivity = Date.now();
      });

      // Periyodik kontrol
      this.checkSub = timer(0, this.CHECK_INTERVAL_MS).subscribe(() => {
        this.ngZone.run(() => this.checkStatus());
      });
    });

    this.destroyRef.onDestroy(() => this.stopMonitoring());
  }

  private stopMonitoring(): void {
    this.activitySub?.unsubscribe();
    this.activitySub = undefined;
    this.checkSub?.unsubscribe();
    this.checkSub = undefined;
    this.clearCountdown();
  }

  private checkStatus(): void {
    // Modal zaten açıksa kontrol etme (countdown çalışıyor)
    if (this.showModal()) return;

    // Token yoksa çık
    if (!this.session.token) return;

    // Token süresi dolmuşsa direkt logout
    if (this.session.isTokenExpired()) {
      this.doLogout();
      return;
    }

    // İnaktif mi?
    const idle = Date.now() - this.lastActivity;
    if (idle >= this.IDLE_TIMEOUT_MS) {
      this.startCountdown();
      return;
    }

    // Token'a 2 dakika kaldıysa (expire yaklaşıyor)
    const expiry = this.session.getTokenExpiryDate();
    if (expiry) {
      const remaining = expiry.getTime() - Date.now();
      if (remaining <= 120_000 && remaining > 0) {
        this.startCountdown();
      }
    }
  }

  private startCountdown(): void {
    this.secondsRemaining.set(this.WARNING_SECONDS);
    this.showModal.set(true);

    this.countdownTimer = setInterval(() => {
      this.ngZone.run(() => {
        const next = this.secondsRemaining() - 1;
        if (next <= 0) {
          this.clearCountdown();
          this.showModal.set(false);
          this.doLogout();
        } else {
          this.secondsRemaining.set(next);
        }
      });
    }, 1000);
  }

  private clearCountdown(): void {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = undefined;
    }
  }

  private doLogout(): void {
    this.stopMonitoring();
    this.session.clearAll();
    this.permissions.clear();
    this.router.navigate(['/auth/login']);
  }
}
