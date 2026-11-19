import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { YuklemePlanAyarlari, YuklemePlaniTanimlari } from '../../../shared/models/index';

/** Yeni planın başlangıç ayarları: paylar tanımsız, tip seçimi yok (yükler arası boşluk sunucu varsayılanı). */
export const YENI_PLAN_AYARLARI: YuklemePlanAyarlari = {
  yerlesimBosluguMm: 30, yukseklikPayiMm: null, genislikPayiMm: null, uzunlukPayiMm: null, agirlikPayiKg: null,
  yuklemeHareketiPayiMm: null, agirlikMerkeziSapmaYuzde: null, mevcutAraclar: [], tipIdleri: [],
};

/** Aynı sayfada birden çok örnek olursa etiket kimlikleri çakışmasın. */
let ornekNo = 0;

/** Formda kalan güvenlik payları (saha geri bildirimi 19.11.2026 madde 9); diğer ayarlar ekranda gösterilmez. */
export type PayAlani = 'yukseklikPayiMm' | 'genislikPayiMm' | 'uzunlukPayiMm' | 'agirlikPayiKg' | 'yuklemeHareketiPayiMm';

export const PAYLAR: readonly { alan: PayAlani; ad: string; birim: string; enFazla: number }[] = [
  { alan: 'yukseklikPayiMm', ad: 'Yükseklik payı', birim: 'mm', enFazla: 1000 },
  { alan: 'genislikPayiMm', ad: 'Genişlik payı', birim: 'mm', enFazla: 1000 },
  { alan: 'uzunlukPayiMm', ad: 'Uzunluk payı', birim: 'mm', enFazla: 1000 },
  { alan: 'agirlikPayiKg', ad: 'Ağırlık payı', birim: 'kg', enFazla: 10000 },
  { alan: 'yuklemeHareketiPayiMm', ad: 'Yükleme hareket payı', birim: 'mm', enFazla: 1000 },
];

/**
 * Plan girdileri (yeni plan penceresi ve plan ekranı ortak): iki kademeli araç seçimi (önce taşıma ailesi, sonra
 * isteğe bağlı tip) ve güvenlik payları. Durumu tutmaz; değişiklikleri çıkışla bildirir. Aile değişince tip seçimi
 * sıfırlanır (önceki ailenin tipi geçersizdir).
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

  readonly PAYLAR = PAYLAR;
  readonly kimlik = `ps-${++ornekNo}`;
  readonly paylarAcik = signal(false);
  /** Seçili taşıma ailesinin tipleri (iki kademeli seçim: önce aile, sonra tip). */
  readonly aileTipleri = computed(() => (this.tanimlar()?.tasimaTipleri ?? []).filter((t) => t.aileId === this.aileId()));
  readonly seciliTipler = computed(() => new Set(this.ayarlar().tipIdleri));
  /** Tanımlı pay sayısı (kapalı başlıkta gösterilir). */
  readonly tanimliPay = computed(() => PAYLAR.filter((p) => this.ayarlar()[p.alan] != null).length);

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

  /** Paylar sunucuda tamsayıdır (mm, kg): ondalık girilirse yuvarlanır, boşaltılan pay tanımsız (null) olur. */
  payDegistir(alan: PayAlani, deger: unknown): void {
    const sayi = deger === '' || deger === null || deger === undefined ? null : Number(deger);
    this.ayarlarDegisti.emit({ ...this.ayarlar(), [alan]: sayi === null || Number.isNaN(sayi) ? null : Math.round(sayi) });
  }
}
