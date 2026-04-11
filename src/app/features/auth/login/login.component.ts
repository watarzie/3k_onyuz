import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { NgClass } from '@angular/common';
import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../shared/i18n/i18n.service';
import { CustomValidators } from '../../../shared/validators/custom-validators';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, NgClass],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  i18n = inject(I18nService);

  form: FormGroup;
  loading = signal(false);
  error = signal('');
  showPassword = signal(false);

  togglePassword() { this.showPassword.update(v => !v); }

  constructor() {
    this.form = this.fb.group({
      email: ['', [Validators.required, CustomValidators.email]],
      sifre: ['', [Validators.required, CustomValidators.passwordStrength]],
    });
  }

  getError(field: string): string {
    const control = this.form.get(field);
    if (!control?.touched || !control.errors) return '';
    const t = this.i18n.t().VALIDATION;
    if (control.errors['required']) return t.REQUIRED;
    if (control.errors['emailInvalid']) return t.EMAIL_INVALID;
    if (control.errors['passwordWeak']) return t.PASSWORD_WEAK;
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
          this.router.navigate(['/dashboard']);
        } else {
          this.error.set(result.error ?? this.i18n.t().MESSAGES.LOGIN_FAIL);
        }
      },
      error: () => {
        this.loading.set(false);
        this.error.set(this.i18n.t().MESSAGES.LOGIN_FAIL);
      },
    });
  }
}
