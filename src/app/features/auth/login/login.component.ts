import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { NgClass } from '@angular/common';
import { AuthService } from '../../../core/auth/auth.service';
import { TranslationService } from '../../../core/services/translation.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ToastService } from '../../../core/services/toast.service';
import { CustomValidators } from '../../../shared/validators/custom-validators';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [TranslatePipe, ReactiveFormsModule, NgClass],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private permissionService = inject(PermissionService);
  private toast = inject(ToastService);
  ts = inject(TranslationService);

  form: FormGroup;
  loading = signal(false);
  error = signal('');
  showPassword = signal(false);

  togglePassword() { this.showPassword.update(v => !v); }

  switchLang(lang: string) {
    this.ts.switchLanguage(lang);
  }

  constructor() {
    this.form = this.fb.group({
      email: ['', [Validators.required, CustomValidators.email]],
      sifre: ['', [Validators.required, CustomValidators.passwordStrength]],
    });
  }

  getError(field: string): string {
    const control = this.form.get(field);
    if (!control?.touched || !control.errors) return '';
        if (control.errors['required']) return this.ts.translate('VALIDATION.REQUIRED');
    if (control.errors['emailInvalid']) return this.ts.translate('VALIDATION.EMAIL_INVALID');
    if (control.errors['passwordWeak']) return this.ts.translate('VALIDATION.PASSWORD_WEAK');
    return '';
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set('');

    this.auth.login(this.form.value).subscribe({
      next: (result) => {
        this.loading.set(false);
        if (result.isSuccess) {
          this.toast.success('Giriş başarılı!');
          this.permissionService.loadPermissions();
          this.router.navigate(['/dashboard']);
        } else {
          const msg = result.error ?? this.ts.translate('MESSAGES.LOGIN_FAIL');
          this.error.set(msg);
          this.toast.error(msg);
        }
      },
      error: () => {
        this.loading.set(false);
        const msg = this.ts.translate('MESSAGES.LOGIN_FAIL');
        this.error.set(msg);
        this.toast.error(msg);
      },
    });
  }
}
