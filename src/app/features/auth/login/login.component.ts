import { NgClass } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ToastService } from '../../../core/services/toast.service';
import { TranslationService } from '../../../core/services/translation.service';
import {
  ApiResult,
  LoginResultDto,
  PendingTwoFactorChallenge,
  TwoFactorSetupDto,
} from '../../../shared/models';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { CustomValidators } from '../../../shared/validators/custom-validators';

type LoginViewStep = 'credentials' | 'setup' | 'verify' | 'recovery' | 'recoveryCodes';

interface TwoFactorFailureDetails {
  issues?: {
    kalanDenemeSayisi?: number | null;
  };
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [TranslatePipe, ReactiveFormsModule, NgClass],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private permissionService = inject(PermissionService);
  private toast = inject(ToastService);
  readonly ts = inject(TranslationService);

  readonly form: FormGroup;
  readonly verificationForm: FormGroup;
  readonly recoveryForm: FormGroup;

  readonly flowStep = signal<LoginViewStep>('credentials');
  readonly loading = signal(false);
  readonly error = signal('');
  readonly showPassword = signal(false);
  readonly setupDetails = signal<TwoFactorSetupDto | null>(null);
  readonly recoveryCodes = signal<readonly string[]>([]);
  readonly remainingSeconds = signal(0);
  readonly copiedManualKey = signal(false);
  readonly copiedRecoveryCodes = signal(false);

  private countdownId: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.form = this.fb.group({
      email: ['', [Validators.required, CustomValidators.email]],
      sifre: ['', [Validators.required, CustomValidators.passwordStrength]],
      rememberMe: [false],
    });

    this.verificationForm = this.fb.group({
      kod: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    });

    this.recoveryForm = this.fb.group({
      kurtarmaKodu: ['', [Validators.required]],
    });
  }

  ngOnInit(): void {
    const pending = this.auth.getPendingTwoFactorChallenge();
    if (!pending) return;

    this.startCountdown(pending.expiresAt);
    if (pending.nextStep === 'twoFactorSetupRequired') {
      this.beginSetup(pending.challengeToken);
    } else {
      this.flowStep.set('verify');
    }
  }

  ngOnDestroy(): void {
    this.stopCountdown();
  }

  togglePassword(): void {
    this.showPassword.update(value => !value);
  }

  switchLang(lang: string): void {
    this.ts.switchLanguage(lang);
  }

  getError(field: string): string {
    const control = this.form.get(field);
    if (!control?.touched || !control.errors) return '';
    if (control.errors['required']) return this.ts.translate('VALIDATION.REQUIRED');
    if (control.errors['emailInvalid']) return this.ts.translate('VALIDATION.EMAIL_INVALID');
    if (control.errors['passwordWeak']) return this.ts.translate('VALIDATION.PASSWORD_WEAK');
    return '';
  }

  getVerificationCodeError(): string {
    const control = this.verificationForm.get('kod');
    if (!control?.touched || !control.errors) return '';
    if (control.errors['required']) return this.ts.translate('VALIDATION.REQUIRED');
    return this.ts.translate('AUTH_2FA.CODE_FORMAT_ERROR');
  }

  getRecoveryCodeError(): string {
    const control = this.recoveryForm.get('kurtarmaKodu');
    if (!control?.touched || !control.errors) return '';
    return this.ts.translate('VALIDATION.REQUIRED');
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set('');

    const { email, sifre, rememberMe } = this.form.getRawValue();
    this.auth
      .login({
        email: String(email ?? '').trim(),
        sifre: String(sifre ?? ''),
        beniHatirla: Boolean(rememberMe),
      })
      .subscribe((result) => {
        this.loading.set(false);
        if (!result.isSuccess || !result.value) {
          this.showFailure(result, 'MESSAGES.LOGIN_FAIL');
          return;
        }

        this.handleLoginResult(result.value);
      });
  }

  submitVerificationCode(): void {
    if (this.verificationForm.invalid) {
      this.verificationForm.markAllAsTouched();
      return;
    }

    const pending = this.requirePendingChallenge();
    if (!pending) return;

    const kod = String(this.verificationForm.getRawValue().kod ?? '').replace(/\s/g, '');
    this.loading.set(true);
    this.error.set('');

    const request$ =
      this.flowStep() === 'setup'
        ? this.auth.confirmTwoFactorSetup(pending.challengeToken, kod)
        : this.auth.verifyTwoFactorCode(pending.challengeToken, kod);

    request$.subscribe((result) => {
      this.loading.set(false);
      if (!result.isSuccess || !result.value) {
        this.verificationForm.reset();
        this.showTwoFactorFailure(result);
        return;
      }

      if (!this.isAuthenticatedResult(result.value)) {
        this.showMalformedResponse();
        return;
      }

      const codes = result.value.kurtarmaKodlari ?? [];
      if (codes.length > 0) {
        this.stopCountdown();
        this.recoveryCodes.set(codes);
        this.flowStep.set('recoveryCodes');
        return;
      }

      void this.finishLogin();
    });
  }

  submitRecoveryCode(): void {
    if (this.recoveryForm.invalid) {
      this.recoveryForm.markAllAsTouched();
      return;
    }

    const pending = this.requirePendingChallenge();
    if (!pending) return;

    const kurtarmaKodu = String(
      this.recoveryForm.getRawValue().kurtarmaKodu ?? ''
    ).trim();

    this.loading.set(true);
    this.error.set('');
    this.auth.verifyRecoveryCode(pending.challengeToken, kurtarmaKodu).subscribe((result) => {
      this.loading.set(false);
      if (!result.isSuccess || !result.value) {
        this.recoveryForm.reset();
        this.showTwoFactorFailure(result);
        return;
      }

      if (!this.isAuthenticatedResult(result.value)) {
        this.showMalformedResponse();
        return;
      }

      void this.finishLogin();
    });
  }

  showRecoveryMode(): void {
    this.error.set('');
    this.recoveryForm.reset();
    this.flowStep.set('recovery');
  }

  showAuthenticatorMode(): void {
    this.error.set('');
    this.verificationForm.reset();
    this.flowStep.set('verify');
  }

  cancelTwoFactor(): void {
    this.auth.clearPendingTwoFactorChallenge();
    this.stopCountdown();
    this.setupDetails.set(null);
    this.verificationForm.reset();
    this.recoveryForm.reset();
    this.flowStep.set('credentials');
    this.error.set('');
  }

  acknowledgeRecoveryCodes(): void {
    if (this.recoveryCodes().length === 0) return;
    void this.finishLogin();
  }

  async copyManualKey(): Promise<void> {
    const key = this.setupDetails()?.manuelAnahtar;
    if (!key) return;

    try {
      await navigator.clipboard.writeText(key);
      this.copiedManualKey.set(true);
      setTimeout(() => this.copiedManualKey.set(false), 1800);
    } catch {
      this.toast.error(this.ts.translate('AUTH_2FA.COPY_FAILED'));
    }
  }

  async copyRecoveryCodes(): Promise<void> {
    const codes = this.recoveryCodes();
    if (codes.length === 0) return;

    try {
      await navigator.clipboard.writeText(codes.join('\n'));
      this.copiedRecoveryCodes.set(true);
      setTimeout(() => this.copiedRecoveryCodes.set(false), 1800);
    } catch {
      this.toast.error(this.ts.translate('AUTH_2FA.COPY_FAILED'));
    }
  }

  countdownText(): string {
    const total = Math.max(0, this.remainingSeconds());
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  private handleLoginResult(result: LoginResultDto): void {
    if (result.nextStep === 'authenticated') {
      if (!this.isAuthenticatedResult(result)) {
        this.showMalformedResponse();
        return;
      }

      void this.finishLogin();
      return;
    }

    const pending = this.auth.getPendingTwoFactorChallenge();
    if (!pending) {
      this.showMalformedResponse();
      return;
    }

    this.startCountdown(pending.expiresAt);
    if (result.nextStep === 'twoFactorSetupRequired') {
      this.beginSetup(pending.challengeToken);
    } else if (result.nextStep === 'twoFactorRequired') {
      this.flowStep.set('verify');
    } else {
      this.showMalformedResponse();
    }
  }

  private beginSetup(challengeToken: string): void {
    this.loading.set(true);
    this.error.set('');
    this.auth.startTwoFactorSetup(challengeToken).subscribe((result) => {
      this.loading.set(false);
      if (!result.isSuccess || !result.value) {
        this.showTwoFactorFailure(result);
        return;
      }

      this.setupDetails.set(result.value);
      this.flowStep.set('setup');
      const pending = this.auth.getPendingTwoFactorChallenge();
      if (pending) this.startCountdown(pending.expiresAt);
    });
  }

  private requirePendingChallenge(): PendingTwoFactorChallenge | null {
    const pending = this.auth.getPendingTwoFactorChallenge();
    if (pending) return pending;

    this.expireChallenge();
    return null;
  }

  private isAuthenticatedResult(result: LoginResultDto): boolean {
    return result.nextStep === 'authenticated' && Boolean(result.token);
  }

  private async finishLogin(): Promise<void> {
    this.loading.set(true);
    const permissionsLoaded = await this.permissionService.reloadPermissions();
    this.loading.set(false);

    if (!permissionsLoaded) {
      const message = this.ts.translate('AUTH_2FA.PERMISSIONS_LOAD_FAILED');
      this.error.set(message);
      this.toast.error(message);
      return;
    }

    this.stopCountdown();
    this.recoveryCodes.set([]);
    this.toast.success(this.ts.translate('MESSAGES.LOGIN_SUCCESS'));
    await this.router.navigate(['/dashboard']);
  }

  private showTwoFactorFailure<T>(result: ApiResult<T>): void {
    const details = result as ApiResult<T> & TwoFactorFailureDetails;
    const attempts = details.issues?.kalanDenemeSayisi;
    let message = result.error ?? this.ts.translate('AUTH_2FA.VERIFICATION_FAILED');

    if (typeof attempts === 'number') {
      message += ` ${this.ts
        .translate('AUTH_2FA.ATTEMPTS_REMAINING')
        .replace('{0}', attempts.toString())}`;
    }

    if (result.statusCode === 429) {
      this.stopCountdown();
      this.auth.clearPendingTwoFactorChallenge();
      this.setupDetails.set(null);
      this.verificationForm.reset();
      this.recoveryForm.reset();
      this.flowStep.set('credentials');
    }

    this.error.set(message);
    this.toast.error(message);
  }

  private showFailure<T>(result: ApiResult<T>, fallbackKey: string): void {
    const message = result.error ?? this.ts.translate(fallbackKey);
    this.error.set(message);
    this.toast.error(message);
  }

  private showMalformedResponse(): void {
    this.stopCountdown();
    this.auth.clearPendingTwoFactorChallenge();
    this.setupDetails.set(null);
    this.verificationForm.reset();
    this.recoveryForm.reset();
    this.flowStep.set('credentials');
    const message = this.ts.translate('AUTH_2FA.INVALID_RESPONSE');
    this.error.set(message);
    this.toast.error(message);
  }

  private startCountdown(expiresAt: number): void {
    this.stopCountdown();

    const update = () => {
      const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      this.remainingSeconds.set(remaining);
      if (remaining === 0) this.expireChallenge();
    };

    update();
    if (this.remainingSeconds() > 0) {
      this.countdownId = setInterval(update, 1000);
    }
  }

  private stopCountdown(): void {
    if (this.countdownId !== null) {
      clearInterval(this.countdownId);
      this.countdownId = null;
    }
  }

  private expireChallenge(): void {
    if (this.flowStep() === 'credentials' || this.flowStep() === 'recoveryCodes') return;

    this.stopCountdown();
    this.auth.clearPendingTwoFactorChallenge();
    this.setupDetails.set(null);
    this.verificationForm.reset();
    this.recoveryForm.reset();
    this.flowStep.set('credentials');

    const message = this.ts.translate('AUTH_2FA.CHALLENGE_EXPIRED');
    this.error.set(message);
    this.toast.error(message);
  }
}
