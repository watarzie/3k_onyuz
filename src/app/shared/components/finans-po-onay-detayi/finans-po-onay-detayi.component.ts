import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { FinansPoOnayDetay, FinansPoOnayKalemi } from '../../models/finans.model';

/**
 * PO öncesi iş onayı talebinin onaycıya gösterilen detayı: proje, kategori, kalemler (sandık, ölçü, adet, m³, birim
 * fiyat, net tutar), toplamlar ve talepten sonra değişen kalemler. Görüntü sunucuda değişmez olarak saklanır; değişen
 * kalem varsa onay uygulanmaz.
 */
@Component({
  selector: 'app-finans-po-onay-detayi',
  standalone: true,
  imports: [DatePipe, DecimalPipe],
  templateUrl: './finans-po-onay-detayi.component.html',
  styleUrl: './finans-po-onay-detayi.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FinansPoOnayDetayiComponent {
  readonly detay = input.required<FinansPoOnayDetay>();
  readonly baslik = input('Onaylanacak PO Öncesi İş Kalemleri');

  private readonly durumlar = computed(
    () => new Map(this.detay().kalemDurumlari.map((durum) => [durum.isKaydiId, durum])),
  );

  degisiklik(kalem: FinansPoOnayKalemi): string | null {
    return this.durumlar().get(kalem.isKaydiId)?.degisiklik ?? null;
  }

  /** Boy × en × yükseklik; ölçüsü olmayan kalemde (sarf, adet işi) tire. */
  olcu(kalem: FinansPoOnayKalemi): string {
    const parcalar = [kalem.boy, kalem.en, kalem.yukseklik];
    return parcalar.every((x) => x != null && x > 0)
      ? parcalar.map((x) => Number(x).toLocaleString('tr-TR', { maximumFractionDigits: 1 })).join(' × ')
      : '—';
  }
}
