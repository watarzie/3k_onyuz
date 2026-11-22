import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EKIPMAN_KILAVUZU_YOLU, KilavuzBolumu } from './ekipman-kilavuzu-bolumleri';

/**
 * Bölüm başlığının yanındaki küçük yardım bağlantısı (soru işareti): Ekipman Kitaplığı Kılavuzu'nun ilgili bölümünü
 * yeni sekmede açar; açık form kapanmaz, girilen değerler kaybolmaz.
 */
@Component({
  selector: 'app-kilavuz-yardimi',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <a class="ky" [routerLink]="YOL" [fragment]="bolum().id" target="_blank" rel="noopener"
       [attr.aria-label]="etiket()" [title]="etiket()">
      <i class="ri-question-line" aria-hidden="true"></i>
    </a>
  `,
  styles: [`
    :host { display: inline-flex; }
    .ky {
      display: inline-grid;
      place-items: center;
      width: 22px;
      height: 22px;
      border: 1px solid var(--borderColor);
      border-radius: 50%;
      background: var(--whiteColor);
      color: var(--bodyColor);
      text-decoration: none;
      transition: border-color .15s ease, color .15s ease;
    }
    .ky i {
      color: inherit;
      font-size: 14px;
      line-height: 1;
    }
    .ky:hover,
    .ky:focus-visible {
      border-color: color-mix(in srgb, var(--primaryColor) 45%, transparent);
      color: var(--primaryColor);
    }
  `],
})
export class KilavuzYardimiComponent {
  /** Açılacak kılavuz bölümü (`KILAVUZ_BOLUMU.*`). */
  readonly bolum = input.required<KilavuzBolumu>();

  readonly YOL = EKIPMAN_KILAVUZU_YOLU;
  readonly etiket = computed(() => `${this.bolum().baslik}: alanlar ne demek? Kılavuzda aç (yeni sekme)`);
}
