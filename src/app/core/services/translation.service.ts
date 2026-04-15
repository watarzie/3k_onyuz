import { Injectable, signal, effect } from '@angular/core';
import en from '../../../assets/i18n/en.json';
import tr from '../../../assets/i18n/tr.json';

/**
 * Çoklu dil (i18n) çeviri servisi.
 * befasoft-app referans mimarisinden birebir adapte edildi.
 *
 * JSON dosyaları build-time import edilir (tree-shaking destekli).
 * Dil değişikliği reactive (signal tabanlı), pipe'larla template'lerde kullanılır.
 */
@Injectable({
  providedIn: 'root'
})
export class TranslationService {
  private translations: Record<string, Record<string, unknown>> = { en, tr };
  currentLang = signal<string>(localStorage.getItem('3k_lang') || 'tr');

  constructor() {
    effect(() => {
      localStorage.setItem('3k_lang', this.currentLang());
    });
  }

  /** Dil değiştir */
  switchLanguage(lang: string): void {
    this.currentLang.set(lang);
  }

  /**
   * Verilen anahtarın mevcut dildeki karşılığını döndürür.
   * İç içe anahtarları (örn: 'LABELS.PROJE_NO') destekler.
   * @param key Çeviri anahtarı (dot-notation).
   * @returns Çevrilmiş metin. Bulunamazsa key'in kendisi döner.
   */
  translate(key: string): string {
    const lang = this.currentLang();
    const keys = key.split('.');

    let result: unknown = this.translations[lang];
    for (const k of keys) {
      if (result && typeof result === 'object' && k in (result as Record<string, unknown>)) {
        result = (result as Record<string, unknown>)[k];
      } else {
        return key; // anahtar bulunamadı — fallback
      }
    }

    return (typeof result === 'string') ? result : key;
  }
}
