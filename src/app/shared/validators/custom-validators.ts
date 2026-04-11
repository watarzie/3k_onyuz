import { AbstractControl, ValidationErrors } from '@angular/forms';

export class CustomValidators {
  static email(control: AbstractControl): ValidationErrors | null {
    if (!control.value) return null;
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(control.value) ? null : { emailInvalid: true };
  }

  static passwordStrength(control: AbstractControl): ValidationErrors | null {
    if (!control.value) return null;
    return control.value.length >= 6 ? null : { passwordWeak: true };
  }

  static noWhitespace(control: AbstractControl): ValidationErrors | null {
    if (!control.value) return null;
    return control.value.trim().length > 0 ? null : { whitespace: true };
  }
}
