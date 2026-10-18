import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SandikService } from '../../../core/services/sandik.service';
import { ToastService } from '../../../core/services/toast.service';
import { TranslationService } from '../../../core/services/translation.service';
import { SandikIcerikBilgisiGuncelleDto } from '../../models/sandik.model';

/** Sunucudaki `SandikIcerikUrunBilgisiKurali.EnFazlaUzunluk` ile aynıdır. */
export const URUN_BILGISI_EN_FAZLA = 1000;

/** Grid ve 3K satırlarının ürün bilgisi (seri no, SKT, lot) için ortak alanları. */
export interface UrunBilgisiSatiri {
  sandikId?: number | null;
  sandikIcerikId?: number;
  urunBilgisi?: string | null;
  sandikSevkEdildiMi: boolean;
  aciklama: string;
  barkodNo: string;
  sandikNo: string;
}

/**
 * Sunucu kuralının aynası: bilgi gerçek sandık tahsisi olan (sandık ve içerik kimliği), sevk kilidi bulunmayan
 * satırda ve ekranın yazma izniyle kaydedilir. Grid ve 3K aynı fonksiyonu kullanır; işlem kilitleri (Grid İptal,
 * 3K işlemi yapılmış, Tadilatta) ürün bilgisini kilitlemez.
 */
export function urunBilgisiKaydedilebilir(satir: UrunBilgisiSatiri | null | undefined, yazabilir: boolean): boolean {
  return !!satir && yazabilir && (satir.sandikIcerikId ?? 0) > 0 && (satir.sandikId ?? 0) > 0 && !satir.sandikSevkEdildiMi;
}

export function urunBilgisiKilitNedeni(
  satir: UrunBilgisiSatiri | null | undefined,
  yazabilir: boolean,
  ts: Pick<TranslationService, 'translate'>,
): string {
  if (!satir || urunBilgisiKaydedilebilir(satir, yazabilir)) return '';
  if (satir.sandikSevkEdildiMi) return ts.translate('MESSAGES.URUN_BILGISI_KILITLI');
  return 'Bu ürünün sandık tahsisi bulunmadığı için ürün bilgisi kaydedilemez.';
}

/**
 * Kayıt isteği. Düzenlemeye başlanırken ekranda görülen değer de gönderilir: Grid ve 3K aynı alanı düzenler,
 * başkası arada değiştirdiyse sunucu 409 döner ve onun girdiği bilgi fark edilmeden ezilmez.
 */
export function urunBilgisiIstegi(projeId: number, satir: UrunBilgisiSatiri, girilen: string): SandikIcerikBilgisiGuncelleDto {
  return {
    projeId,
    sandikId: satir.sandikId!,
    sandikIcerikId: satir.sandikIcerikId!,
    urunBilgisi: girilen.trim() || null,
    oncekiUrunBilgisi: satir.urunBilgisi?.trim() || null,
  };
}

/**
 * Satırdaki "Ürün bilgisi" düğmesinin penceresi. Grid ve 3K ürün listelerinde aynıdır; Grid/3K işlem panellerinin
 * kilitlerinden bağımsız açılır, yalnız {@link urunBilgisiKaydedilebilir} kuralına bağlıdır.
 */
@Component({
  selector: 'app-urun-bilgisi-duzenle',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './urun-bilgisi-duzenle.component.html',
  styleUrl: './urun-bilgisi-duzenle.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UrunBilgisiDuzenleComponent {
  readonly satir = input.required<UrunBilgisiSatiri>();
  readonly projeId = input.required<number>();
  readonly yazabilir = input.required<boolean>();
  /** Kayıt başarılı; değer boşaltıldıysa null. */
  readonly kaydedildi = output<string | null>();
  readonly kapat = output<void>();
  /** Bilgi arada başka bir kullanıcı tarafından değiştirildi (409); ekran listeyi tazelemelidir. */
  readonly cakisti = output<void>();

  readonly ts = inject(TranslationService);
  private readonly sandikService = inject(SandikService);
  private readonly toast = inject(ToastService);

  readonly enFazla = URUN_BILGISI_EN_FAZLA;
  /** Satır değişince (ör. liste tazelenince) kayıtlı değere döner. */
  readonly deger = linkedSignal(() => this.satir().urunBilgisi ?? '');
  readonly kaydediliyor = signal(false);
  readonly kaydedilebilir = computed(() => urunBilgisiKaydedilebilir(this.satir(), this.yazabilir()));
  readonly kilitNedeni = computed(() => urunBilgisiKilitNedeni(this.satir(), this.yazabilir(), this.ts));
  readonly degisti = computed(() => this.deger().trim() !== (this.satir().urunBilgisi ?? '').trim());

  kaydet(): void {
    if (this.kaydediliyor() || !this.kaydedilebilir() || !this.degisti()) return;
    const istek = urunBilgisiIstegi(this.projeId(), this.satir(), this.deger());
    if ((istek.urunBilgisi?.length ?? 0) > this.enFazla) {
      this.toast.error(this.ts.translate('MESSAGES.URUN_BILGISI_UZUN'));
      return;
    }

    this.kaydediliyor.set(true);
    this.sandikService.icerikBilgisiGuncelle(istek).subscribe(res => {
      this.kaydediliyor.set(false);
      if (!res.isSuccess) {
        this.toast.error(res.error ?? this.ts.translate('MESSAGES.URUN_BILGISI_KAYDEDILEMEDI'));
        if (res.statusCode === 409) this.cakisti.emit();
        return;
      }
      this.toast.success(this.ts.translate('MESSAGES.URUN_BILGISI_KAYDEDILDI'));
      this.kaydedildi.emit(istek.urunBilgisi);
    });
  }
}
