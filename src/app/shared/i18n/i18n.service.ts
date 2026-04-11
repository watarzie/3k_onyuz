import { Injectable, signal } from '@angular/core';
import { TR } from './tr';

@Injectable({ providedIn: 'root' })
export class I18nService {
  private translations = signal(TR);

  t = this.translations.asReadonly();

  get(path: string): string {
    const keys = path.split('.');
    let result: unknown = TR;
    for (const key of keys) {
      result = (result as Record<string, unknown>)?.[key];
    }
    return (result as string) ?? path;
  }
}
