import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { YuklemePlanAyarlari, YuklemePlaniTanimlari } from '../../../shared/models/index';

/** Yükler arası boşluk girilmezse sunucunun uyguladığı değer (YuklemePlaniKurali.VarsayilanYerlesimBosluguMm). */
export const VARSAYILAN_BOSLUK_MM = 30;
/** Yükler arası boşluğun üst sınırı (YuklemePlaniKurali.YerlesimBosluguEnFazlaMm). */
export const BOSLUK_EN_FAZLA_MM = 500;

/** Başlangıç ayarları: boşluk girilmemiş (varsayılan uygulanır), tip seçimi yok. */
export const YENI_PLAN_AYARLARI: YuklemePlanAyarlari = {
  yerlesimBosluguMm: null, agirlikMerkeziSapmaYuzde: null, mevcutAraclar: [], tipIdleri: [],
};

/** Aynı sayfada birden çok örnek olursa etiket kimlikleri çakışmasın. */
let ornekNo = 0;

/**
 * Simülasyonun araç girdileri: iki kademeli araç seçimi (önce taşıma ailesi, sonra isteğe bağlı tip) ve isteğe bağlı
 * yükler arası boşluk. Durumu tutmaz; değişiklikleri çıkışla bildirir. Aile değişince tip seçimi sıfırlanır (önceki
 * ailenin tipi geçersizdir).
 */
@Component({
  selector: 'app-plan-secimleri',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  templateUrl: './plan-secimleri.component.html',
  styleUrls: ['./yukleme.scss', './plan-secimleri.component.scss'],
})
export class PlanSecimleriComponent {
  readonly tanimlar = input<YuklemePlaniTanimlari | null>(null);
  readonly aileId = input<number | null>(null);
  readonly ayarlar = input.required<YuklemePlanAyarlari>();
  readonly kilitli = input(false);
  readonly aileDegisti = output<number>();
  readonly ayarlarDegisti = output<YuklemePlanAyarlari>();

  readonly VARSAYILAN_BOSLUK_MM = VARSAYILAN_BOSLUK_MM;
  readonly BOSLUK_EN_FAZLA_MM = BOSLUK_EN_FAZLA_MM;
  readonly kimlik = `ps-${++ornekNo}`;
  /** Seçili taşıma ailesinin tipleri (iki kademeli seçim: önce aile, sonra tip). */
  readonly aileTipleri = computed(() => (this.tanimlar()?.tasimaTipleri ?? []).filter((t) => t.aileId === this.aileId()));
  readonly seciliTipler = computed(() => new Set(this.ayarlar().tipIdleri));

  aileSec(aileId: number): void {
    if (aileId === this.aileId()) return;
    this.aileDegisti.emit(aileId);
    if (this.ayarlar().tipIdleri.length) this.ayarlarDegisti.emit({ ...this.ayarlar(), tipIdleri: [] });
  }

  tipDegistir(tipId: number): void {
    const a = this.ayarlar();
    this.ayarlarDegisti.emit({
      ...a,
      tipIdleri: a.tipIdleri.includes(tipId) ? a.tipIdleri.filter((id) => id !== tipId) : [...a.tipIdleri, tipId],
    });
  }

  /** Boşluk sunucuda tamsayı mm'dir: ondalık girilirse yuvarlanır; boşaltılan alan girilmemiş (null, varsayılan) olur. */
  boslukDegistir(deger: unknown): void {
    const sayi = deger === '' || deger === null || deger === undefined ? null : Number(deger);
    this.ayarlarDegisti.emit({ ...this.ayarlar(), yerlesimBosluguMm: sayi === null || Number.isNaN(sayi) ? null : Math.round(sayi) });
  }
}
