import { Injectable, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { BaseApiService } from '../services/base-api.service';
import { API } from '../constants/api-endpoints';
import { SessionManager } from '../managers/session.manager';
import { PermissionService } from '../services/permission.service';
import {
  ApiResult,
  LoginDto,
  LoginResultDto,
  PendingTwoFactorChallenge,
  TwoFactorSetupDto,
} from '../../shared/models/auth.model';

const TWO_FACTOR_CHALLENGE_KEY = '3k_2fa_challenge';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = inject(BaseApiService);
  private router = inject(Router);
  private session = inject(SessionManager);
  private permissions = inject(PermissionService);

  /**
   * Kullanıcı bilgileri — JWT'den decode edilir.
   * localStorage'da hassas veri SAKLANMAZ.
   */
  currentUser = signal(this.session.getUser());
  isLoggedIn = computed(() => !!this.currentUser() && !this.session.isTokenExpired());

  login(dto: LoginDto): Observable<ApiResult<LoginResultDto>> {
    // Yeni bir kimlik doğrulama akışı başlarken eski tam oturumu kullanma.
    this.clearPendingTwoFactorChallenge();
    this.clearAuthenticatedSession();

    return this.api.post<LoginResultDto>(API.AUTH.LOGIN, dto).pipe(
      tap((result) => {
        if (result.isSuccess && result.value) {
          this.processLoginResult(result.value, dto.beniHatirla);
        }
      })
    );
  }

  startTwoFactorSetup(challengeToken: string): Observable<ApiResult<TwoFactorSetupDto>> {
    return this.api
      .post<TwoFactorSetupDto>(API.AUTH.TWO_FACTOR_SETUP_START, { challengeToken })
      .pipe(
        tap((result) => {
          if (result.isSuccess && result.value) {
            this.refreshPendingChallenge(
              result.value.challengeToken,
              result.value.expiresInSeconds
            );
          }
        })
      );
  }

  confirmTwoFactorSetup(
    challengeToken: string,
    kod: string
  ): Observable<ApiResult<LoginResultDto>> {
    return this.api
      .post<LoginResultDto>(API.AUTH.TWO_FACTOR_SETUP_CONFIRM, { challengeToken, kod })
      .pipe(tap((result) => this.processAuthenticatedApiResult(result)));
  }

  verifyTwoFactorCode(
    challengeToken: string,
    kod: string
  ): Observable<ApiResult<LoginResultDto>> {
    return this.api
      .post<LoginResultDto>(API.AUTH.TWO_FACTOR_VERIFY, { challengeToken, kod })
      .pipe(tap((result) => this.processAuthenticatedApiResult(result)));
  }

  verifyRecoveryCode(
    challengeToken: string,
    kurtarmaKodu: string
  ): Observable<ApiResult<LoginResultDto>> {
    return this.api
      .post<LoginResultDto>(API.AUTH.TWO_FACTOR_RECOVERY_VERIFY, {
        challengeToken,
        kurtarmaKodu,
      })
      .pipe(tap((result) => this.processAuthenticatedApiResult(result)));
  }

  getPendingTwoFactorChallenge(): PendingTwoFactorChallenge | null {
    const serialized = sessionStorage.getItem(TWO_FACTOR_CHALLENGE_KEY);
    if (!serialized) return null;

    try {
      const challenge = JSON.parse(serialized) as PendingTwoFactorChallenge;
      const validStep =
        challenge.nextStep === 'twoFactorRequired' ||
        challenge.nextStep === 'twoFactorSetupRequired';

      if (!challenge.challengeToken || !validStep || challenge.expiresAt <= Date.now()) {
        this.clearPendingTwoFactorChallenge();
        return null;
      }

      return challenge;
    } catch {
      this.clearPendingTwoFactorChallenge();
      return null;
    }
  }

  clearPendingTwoFactorChallenge(): void {
    sessionStorage.removeItem(TWO_FACTOR_CHALLENGE_KEY);
  }

  logout(): void {
    this.clearPendingTwoFactorChallenge();
    this.session.clearAll();
    this.currentUser.set(null);
    this.permissions.clear();
    this.router.navigate(['/auth/login']);
  }

  getToken(): string | null {
    return this.session.token;
  }

  private processLoginResult(result: LoginResultDto, rememberMe: boolean): void {
    if (result.nextStep === 'authenticated') {
      this.establishAuthenticatedSession(result, rememberMe);
      return;
    }

    if (!result.challengeToken) {
      this.clearPendingTwoFactorChallenge();
      return;
    }

    const pending: PendingTwoFactorChallenge = {
      challengeToken: result.challengeToken,
      nextStep: result.nextStep,
      expiresAt: Date.now() + Math.max(1, result.expiresInSeconds ?? 300) * 1000,
      rememberMe,
    };

    sessionStorage.setItem(TWO_FACTOR_CHALLENGE_KEY, JSON.stringify(pending));
  }

  private processAuthenticatedApiResult(result: ApiResult<LoginResultDto>): void {
    if (!result.isSuccess || !result.value || result.value.nextStep !== 'authenticated') {
      return;
    }

    const rememberMe = this.getPendingTwoFactorChallenge()?.rememberMe ?? false;
    this.establishAuthenticatedSession(result.value, rememberMe);
  }

  private establishAuthenticatedSession(result: LoginResultDto, rememberMe: boolean): void {
    if (!result.token) return;

    this.permissions.clear();
    this.session.setToken(result.token, rememberMe);
    this.currentUser.set(this.session.getUser());
    this.clearPendingTwoFactorChallenge();
  }

  private refreshPendingChallenge(challengeToken: string, expiresInSeconds: number): void {
    const current = this.getPendingTwoFactorChallenge();
    if (!current) return;

    sessionStorage.setItem(
      TWO_FACTOR_CHALLENGE_KEY,
      JSON.stringify({
        ...current,
        challengeToken,
        expiresAt: Date.now() + Math.max(1, expiresInSeconds) * 1000,
      } satisfies PendingTwoFactorChallenge)
    );
  }

  private clearAuthenticatedSession(): void {
    this.session.clearAll();
    this.currentUser.set(null);
    this.permissions.clear();
  }

}
