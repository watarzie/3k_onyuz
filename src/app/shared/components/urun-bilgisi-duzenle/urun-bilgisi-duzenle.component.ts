import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UrunAciklamaAlani } from '../../../core/constants/enums';
import { SandikService } from '../../../core/services/sandik.service';
import { ToastService } from '../../../core/services/toast.service';
import { TranslationService } from '../../../core/services/translation.service';
import { SandikIcerikBilgisiGuncelleDto } from '../../models/sandik.model';

/** Sunucudaki `SandikIcerikUrunBilgisiKurali.EnFazlaUzunluk` ile aynıdır. */
export const URUN_BILGISI_EN_FAZLA = 1000;
/** Sunucudaki `UrunAciklamaKurali.EnFazlaUzunluk` ile aynıdır. */
export const URUN_ACIKLAMA_EN_FAZLA = 1000;

/** Grid ve 3K satırlarının ürün bilgisi (seri no, SKT, lot) ve açıklama için ortak alanları. */
export interface UrunBilgisiSatiri {
  sandikId?: number | null;
  sandikIcerikId?: number;
  urunBilgisi?: string | null;
  sandikSevkEdildiMi: boolean;
  aciklama: string;
  barkodNo: string;
  sandikNo: string;
  /** Açıklama çeki satırındadır; çeki bağı olmayan (saha manuel) satırda açıklama bu pencereden düzenlenmez. */
  cekiSatiriId?: number | null;
  gridAciklama?: string | null;
  ucKAciklama?: string | null;
}

/** Açıklama düzenlemesinin isteğe eklenen kısmı; pencere açıklama alanıyla açılmadıysa gönderilmez. */
export interface UrunAciklamaGirdisi {
  alan: UrunAciklamaAlani;
  girilen: string;
}

/**
 * Sunucu kuralının aynası: bilgi gerçek sandık tahsisi olan (sandık ve içerik kimliği), sevk kilidi bulunmayan
 * satırda ve ekranın yazma izniyle kaydedilir. Grid ve 3K aynı fonksiyonu kullanır; işlem kilitleri (Grid İptal,
 * 3K işlemi yapılmış, Tadilatta) ürün bilgisini ve açıklamayı kilitlemez.
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

/** Ekranın açıklaması: Grid ekranında Grid, 3K ekranında 3K açıklaması. */
export function urunAciklamasi(satir: UrunBilgisiSatiri, alan: UrunAciklamaAlani): string | null {
  return (alan === UrunAciklamaAlani.Grid ? satir.gridAciklama : satir.ucKAciklama) ?? null;
}

/**
 * Kayıt isteği. Düzenlemeye başlanırken ekranda görülen değerler de gönderilir: Grid ve 3K aynı alanları düzenler,
 * başkası arada değiştirdiyse sunucu 409 döner ve onun girdiği bilgi fark edilmeden ezilmez.
 */
export function urunBilgisiIstegi(
  projeId: number,
  satir: UrunBilgisiSatiri,
  girilen: string,
  aciklama?: UrunAciklamaGirdisi,
): SandikIcerikBilgisiGuncelleDto {
  const istek: SandikIcerikBilgisiGuncelleDto = {
    projeId,
    sandikId: satir.sandikId!,
    sandikIcerikId: satir.sandikIcerikId!,
    urunBilgisi: girilen.trim() || null,
    oncekiUrunBilgisi: satir.urunBilgisi?.trim() || null,
  };
  if (aciklama) {
    istek.aciklamaAlani = aciklama.alan;
    istek.aciklama = aciklama.girilen.trim() || null;
    istek.oncekiAciklama = urunAciklamasi(satir, aciklama.alan)?.trim() || null;
  }
  return istek;
}

/**
 * Satırdaki "Ürün bilgisi ve açıklama" düğmesinin penceresi. Grid ve 3K ürün listelerinde aynıdır; Grid/3K işlem
 * panellerinin kilitlerinden bağımsız açılır, yalnız {@link urunBilgisiKaydedilebilir} kuralına bağlıdır.
 * `aciklamaAlani` verilirse ekranın açıklaması da aynı kayıtla düzenlenir (Grid → Grid, 3K → 3K açıklaması);
 * işlem sonrası not eklemenin yolu budur ve Grid/3K durumunu değiştirmez.
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
  /** Verilirse pencere ekranın açıklamasını da düzenler. */
  readonly aciklamaAlani = input<UrunAciklamaAlani | null>(null);
  /** Kayıt başarılı; ürün bilgisi boşaltıldıysa null. Pencere bu olayla kapanır. */
  readonly kaydedildi = output<string | null>();
  /** Açıklama değiştiyse {@link kaydedildi}'den önce yayılır; boşaltıldıysa null. */
  readonly aciklamaKaydedildi = output<string | null>();
  readonly kapat = output<void>();
  /** Bilgi arada başka bir kullanıcı tarafından değiştirildi (409); ekran listeyi tazelemelidir. */
  readonly cakisti = output<void>();

  readonly ts = inject(TranslationService);
  private readonly sandikService = inject(SandikService);
  private readonly toast = inject(ToastService);

  readonly enFazla = URUN_BILGISI_EN_FAZLA;
  readonly aciklamaEnFazla = URUN_ACIKLAMA_EN_FAZLA;
  /** Satır değişince (ör. liste tazelenince) kayıtlı değere döner. */
  readonly deger = linkedSignal(() => this.satir().urunBilgisi ?? '');
  readonly kayitliAciklama = computed(() => {
    const alan = this.aciklamaAlani();
    return alan == null ? '' : urunAciklamasi(this.satir(), alan) ?? '';
  });
  readonly aciklama = linkedSignal(() => this.kayitliAciklama());
  readonly kaydediliyor = signal(false);
  readonly kaydedilebilir = computed(() => urunBilgisiKaydedilebilir(this.satir(), this.yazabilir()));
  readonly kilitNedeni = computed(() => urunBilgisiKilitNedeni(this.satir(), this.yazabilir(), this.ts));
  /** Açıklama kutusu yalnız ekran açıklama alanı verdiyse görünür. */
  readonly aciklamaGorunur = computed(() => this.aciklamaAlani() != null);
  /** Açıklama çeki satırındadır; çeki bağı olmayan satırda kutu kapalıdır. */
  readonly aciklamaDuzenlenebilir = computed(() =>
    this.aciklamaGorunur() && this.kaydedilebilir() && (this.satir().cekiSatiriId ?? 0) > 0);
  readonly aciklamaEtiketi = computed(() => this.aciklamaAlani() === UrunAciklamaAlani.Grid
    ? 'LABELS.URUN_GRID_ACIKLAMASI'
    : 'LABELS.URUN_UCK_ACIKLAMASI');
  readonly bilgiDegisti = computed(() => this.deger().trim() !== (this.satir().urunBilgisi ?? '').trim());
  readonly aciklamaDegisti = computed(() =>
    this.aciklamaDuzenlenebilir() && this.aciklama().trim() !== this.kayitliAciklama().trim());
  readonly degisti = computed(() => this.bilgiDegisti() || this.aciklamaDegisti());

  kaydet(): void {
    if (this.kaydediliyor() || !this.kaydedilebilir() || !this.degisti()) return;
    const alan = this.aciklamaAlani();
    const aciklamaGirdisi = this.aciklamaDuzenlenebilir() && alan != null
      ? { alan, girilen: this.aciklama() }
      : undefined;
    const istek = urunBilgisiIstegi(this.projeId(), this.satir(), this.deger(), aciklamaGirdisi);
    if ((istek.urunBilgisi?.length ?? 0) > this.enFazla) {
      this.toast.error(this.ts.translate('MESSAGES.URUN_BILGISI_UZUN'));
      return;
    }
    if ((istek.aciklama?.length ?? 0) > this.aciklamaEnFazla) {
      this.toast.error(this.ts.translate('MESSAGES.URUN_ACIKLAMA_UZUN'));
      return;
    }

    const aciklamaDegisti = this.aciklamaDegisti();
    this.kaydediliyor.set(true);
    this.sandikService.icerikBilgisiGuncelle(istek).subscribe(res => {
      this.kaydediliyor.set(false);
      if (!res.isSuccess) {
        this.toast.error(res.error ?? this.ts.translate('MESSAGES.URUN_BILGISI_KAYDEDILEMEDI'));
        if (res.statusCode === 409) this.cakisti.emit();
        return;
      }
      this.toast.success(this.ts.translate(aciklamaDegisti
        ? 'MESSAGES.URUN_BILGISI_ACIKLAMA_KAYDEDILDI'
        : 'MESSAGES.URUN_BILGISI_KAYDEDILDI'));
      if (aciklamaDegisti) this.aciklamaKaydedildi.emit(istek.aciklama ?? null);
      this.kaydedildi.emit(istek.urunBilgisi);
    });
  }
}
