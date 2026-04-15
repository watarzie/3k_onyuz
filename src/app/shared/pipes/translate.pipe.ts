import { inject, Pipe, PipeTransform } from '@angular/core';
import { TranslationService } from '../../core/services/translation.service';

/**
 * Template'lerde çeviri için kullanılan pipe.
 * Kullanım: {{ 'LABELS.PROJE_NO' | translate }}
 *
 * pure: false → Dil değiştiğinde pipe otomatik yeniden çalışır.
 * befasoft-app referans mimarisinden birebir adapte edildi.
 */
@Pipe({
  name: 'translate',
  standalone: true,
  pure: false
})
export class TranslatePipe implements PipeTransform {
  private translationService = inject(TranslationService);

  transform(key: string): string {
    return this.translationService.translate(key);
  }
}
