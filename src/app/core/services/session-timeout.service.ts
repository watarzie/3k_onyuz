import { DestroyRef, Injectable, NgZone, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SessionManager } from '../managers/session.manager';
import { PermissionService } from '../services/permission.service';

/**
 * JWT'nin geçerlilik süresini izler.
 *
 * KULLANIM: MainLayoutComponent'te inject + initialize edilir.
 */
@Injectable({ providedIn: 'root' })
export class SessionTimeoutService {
  private session = inject(SessionManager);
  private permissions = inject(PermissionService);
  private router = inject(Router);
  private ngZone = inject(NgZone);
  private destroyRef = inject(DestroyRef);

  // setTimeout tarayıcılarda yaklaşık 24,8 gün ile sınırlıdır.
  private readonly MAX_TIMER_DELAY_MS = 2_147_000_000;

  private expiryTimer?: ReturnType<typeof setTimeout>;
  private monitoring = false;

  constructor() {
    this.destroyRef.onDestroy(() => this.stop());
  }

  /** Login sonrası çağrılır */
  initialize(): void {
    this.stop();
    this.monitoring = true;
    this.scheduleExpiryCheck();
  }

  /** Logout / destroy'da çağrılır */
  stop(): void {
    this.monitoring = false;
    this.clearExpiryTimer();
  }

  private scheduleExpiryCheck(): void {
    this.clearExpiryTimer();

    if (!this.monitoring || !this.session.token) return;

    const expiry = this.session.getTokenExpiryDate();
    if (!expiry) {
      this.doLogout();
      return;
    }

    const remainingMs = expiry.getTime() - Date.now();
    if (remainingMs <= 0) {
      this.doLogout();
      return;
    }

    const delayMs = Math.min(remainingMs, this.MAX_TIMER_DELAY_MS);
    this.ngZone.runOutsideAngular(() => {
      this.expiryTimer = setTimeout(() => {
        this.ngZone.run(() => {
          this.expiryTimer = undefined;
          this.handleExpiryTimer();
        });
      }, delayMs);
    });
  }

  private handleExpiryTimer(): void {
    if (!this.monitoring || !this.session.token) return;

    const expiry = this.session.getTokenExpiryDate();
    if (!expiry || expiry.getTime() <= Date.now()) {
      this.doLogout();
      return;
    }

    // Token zamanlayıcı çalışmadan önce yenilenmiş olabilir.
    // Her tetiklemede güncel JWT'nin exp değerine göre yeniden planla.
    this.scheduleExpiryCheck();
  }

  private clearExpiryTimer(): void {
    if (this.expiryTimer) {
      clearTimeout(this.expiryTimer);
      this.expiryTimer = undefined;
    }
  }

  private doLogout(): void {
    this.stop();
    this.session.clearAll();
    this.permissions.clear();
    this.router.navigate(['/auth/login']);
  }
}
