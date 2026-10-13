import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime } from 'rxjs';
import { BreadcrumbComponent } from '../../../shared/components/breadcrumb/breadcrumb.component';
import { ServerPagerComponent } from '../../../shared/components/server-pager/server-pager.component';
import { StatCardComponent } from '../../../shared/components/stat-card/stat-card.component';
import { SevkiyatService } from '../../../core/services/sevkiyat.service';
import { ToastService } from '../../../core/services/toast.service';
import { dosyayiKaydet } from '../../../core/services/dosya-kaydet';
import { TranslationService } from '../../../core/services/translation.service';
import { ProjeTipi } from '../../../core/constants/enums';
import { projeTipiBaglami } from '../../../core/constants/proje-tipi';
import {
  PlakaIstatistik,
  ProjeSevkIstatistik,
  SevkSeferiDetay,
  SevkSeferiFiltre,
  SevkSeferiOzet,
  SevkiyatIstatistik,
} from '../../../shared/models/index';

export type SevkiyatGorunumu = 'seferler' | 'plaka' | 'proje' | 'aylik';

type SeferDetayDurumu = { durum: 'yukleniyor' } | { durum: 'hata'; mesaj: string } | { durum: 'hazir'; detay: SevkSeferiDetay };

/**
 * Sevkiyatlar (sevkiyatlar R): tır seferleri ve sevkiyat istatistikleri. Kaynak sefer ve sevkiyat kayıtlarıdır; sefere
 * bağlı olmayan eski sevkiyatlar plaka + sevk günüyle "eski kayıt" seferi olarak gelir.
 */
@Component({
  selector: 'app-sevkiyatlar',
  standalone: true,
  imports: [BreadcrumbComponent, ServerPagerComponent, StatCardComponent, DatePipe, DecimalPipe],
  templateUrl: './sevkiyatlar.component.html',
  styleUrl: './sevkiyatlar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SevkiyatlarComponent implements OnInit {
  private readonly service = inject(SevkiyatService);
  private readonly ts = inject(TranslationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);
  private readonly metinDegisti = new Subject<void>();
  private seferIstekSurumu = 0;
  private istatistikIstekSurumu = 0;

  readonly breadcrumb = [
    { label: 'Ana Kontrol Paneli', link: '/dashboard' },
    { label: 'Sevkiyatlar' },
  ];
  readonly projeTipiSecenekleri = [
    { deger: null, etiket: 'SHIPMENTS.ALL_TYPES' },
    { deger: ProjeTipi.Normal, etiket: 'SHIPMENTS.TYPE_NORMAL' },
    { deger: ProjeTipi.Saha, etiket: 'SHIPMENTS.TYPE_FIELD' },
    { deger: ProjeTipi.Yedek, etiket: 'SHIPMENTS.TYPE_SPARE' },
  ] as const;

  readonly baslangic = signal('');
  readonly bitis = signal('');
  readonly plaka = signal('');
  readonly projeNo = signal('');
  readonly projeTipiId = signal<number | null>(null);
  readonly gorunum = signal<SevkiyatGorunumu>('seferler');

  readonly seferler = signal<SevkSeferiOzet[]>([]);
  readonly seferlerYukleniyor = signal(true);
  readonly seferHatasi = signal('');
  readonly sayfa = signal(1);
  readonly sayfaBoyutu = signal(25);
  readonly toplamKayit = signal(0);
  readonly toplamSayfa = signal(0);

  readonly istatistik = signal<SevkiyatIstatistik | null>(null);
  readonly istatistikYukleniyor = signal(true);
  readonly istatistikHatasi = signal('');

  /** İnen dönem raporu biçimi; aynı anda tek indirme. */
  readonly raporIndiriliyor = signal<'pdf' | 'excel' | null>(null);
  /** PDF'i inen seferin anahtarı. */
  readonly seferRaporuIndiriliyor = signal<string | null>(null);

  readonly acikSefer = signal<string | null>(null);
  readonly detaylar = signal<Record<string, SeferDetayDurumu>>({});

  readonly filtreVar = computed(() =>
    !!(this.baslangic() || this.bitis() || this.plaka().trim() || this.projeNo().trim() || this.projeTipiId()));
  /** Aylık görünümde çubuk uzunluğu en yoğun aya göre ölçeklenir (en yeni ay üstte). */
  readonly aylik = computed(() => {
    const aylar = [...(this.istatistik()?.aylik ?? [])].sort((a, b) => b.yil - a.yil || b.ay - a.ay);
    const enCok = Math.max(1, ...aylar.map(a => a.seferSayisi));
    return aylar.map(a => ({ ...a, oran: Math.round((a.seferSayisi / enCok) * 100) }));
  });

  ngOnInit(): void {
    this.metinDegisti.pipe(debounceTime(400), takeUntilDestroyed(this.destroyRef)).subscribe(() => this.seferleriYenile());
    this.seferleriYukle();
    this.istatistikYukle();
  }

  t(key: string, degerler?: Record<string, string | number>): string {
    let metin = this.ts.translate(key);
    for (const [ad, deger] of Object.entries(degerler ?? {})) metin = metin.split(`{${ad}}`).join(String(deger));
    return metin;
  }

  projeTipiAdi(projeTipiId: number): string {
    return projeTipiBaglami(projeTipiId).ad;
  }

  ayAdi(yil: number, ay: number): string {
    const dil = this.ts.currentLang() === 'en' ? 'en-GB' : 'tr-TR';
    return new Date(yil, ay - 1, 1).toLocaleDateString(dil, { month: 'long', year: 'numeric' });
  }

  // ===== Süzgeçler =====

  tarihDegisti(alan: 'baslangic' | 'bitis', deger: string): void {
    (alan === 'baslangic' ? this.baslangic : this.bitis).set(deger);
    this.seferleriYenile();
    this.istatistikYukle();
  }

  metinFiltresiDegisti(alan: 'plaka' | 'projeNo', deger: string): void {
    (alan === 'plaka' ? this.plaka : this.projeNo).set(deger);
    this.metinDegisti.next();
  }

  projeTipiDegisti(deger: string): void {
    this.projeTipiId.set(deger ? Number(deger) : null);
    this.seferleriYenile();
  }

  filtreleriTemizle(): void {
    this.baslangic.set('');
    this.bitis.set('');
    this.plaka.set('');
    this.projeNo.set('');
    this.projeTipiId.set(null);
    this.seferleriYenile();
    this.istatistikYukle();
  }

  /** Plaka/proje istatistiğinden seferlere geçiş: süzgeç ayarlanır, sefer listesi açılır. */
  plakaSeferleri(plaka: PlakaIstatistik): void {
    this.plaka.set(plaka.plaka);
    this.projeNo.set('');
    this.gorunum.set('seferler');
    this.seferleriYenile();
  }

  projeSeferleri(proje: ProjeSevkIstatistik): void {
    this.projeNo.set(proje.projeNo);
    this.plaka.set('');
    this.gorunum.set('seferler');
    this.seferleriYenile();
  }

  // ===== Raporlar =====

  /**
   * Rapor, ekranda görünen süzgeçlerle alınır: sefer listesinde tarih, plaka, proje no ve proje tipi; istatistik
   * görünümlerinde (yalnız tarih süzgeci) tarih aralığı.
   */
  raporFiltresi(): SevkSeferiFiltre {
    const filtre = this.filtre();
    return this.gorunum() === 'seferler'
      ? filtre
      : { baslangic: filtre.baslangic, bitis: filtre.bitis, projeTipiId: null };
  }

  raporIndir(format: 'pdf' | 'excel'): void {
    if (this.raporIndiriliyor()) return;
    this.raporIndiriliyor.set(format);
    this.service.donemRaporu(format, this.raporFiltresi()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: dosya => {
        this.raporIndiriliyor.set(null);
        dosyayiKaydet(dosya, `Sevkiyat_Raporu_${this.bugun()}.${format === 'pdf' ? 'pdf' : 'xlsx'}`);
      },
      error: async hata => {
        this.raporIndiriliyor.set(null);
        this.toast.error(await this.service.indirmeHatasi(hata, this.t('SHIPMENTS.REPORT_FAILED')));
      },
    });
  }

  seferRaporuIndir(sefer: SevkSeferiOzet): void {
    if (this.seferRaporuIndiriliyor()) return;
    this.seferRaporuIndiriliyor.set(sefer.anahtar);
    const ad = sefer.eskiKayit
      ? `Sevkiyat_${(sefer.aracPlaka || 'Plakasiz').replace(/\s+/g, '')}_${sefer.sevkTarihi.slice(0, 10).replace(/-/g, '')}.pdf`
      : `Sefer_${sefer.seferNo}.pdf`;
    this.service.seferRaporu(sefer).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: dosya => {
        this.seferRaporuIndiriliyor.set(null);
        dosyayiKaydet(dosya, ad);
      },
      error: async hata => {
        this.seferRaporuIndiriliyor.set(null);
        this.toast.error(await this.service.indirmeHatasi(hata, this.t('SHIPMENTS.REPORT_FAILED')));
      },
    });
  }

  private bugun(): string {
    const simdi = new Date();
    return `${simdi.getFullYear()}${String(simdi.getMonth() + 1).padStart(2, '0')}${String(simdi.getDate()).padStart(2, '0')}`;
  }

  // ===== Sefer listesi ve detay =====

  sayfaDegisti(sayfa: number): void {
    this.sayfa.set(sayfa);
    this.seferleriYukle();
  }

  sayfaBoyutuDegisti(boyut: number): void {
    this.sayfaBoyutu.set(boyut);
    this.sayfa.set(1);
    this.seferleriYukle();
  }

  seferAcKapat(sefer: SevkSeferiOzet): void {
    if (this.acikSefer() === sefer.anahtar) {
      this.acikSefer.set(null);
      return;
    }
    this.acikSefer.set(sefer.anahtar);
    const mevcut = this.detaylar()[sefer.anahtar];
    if (mevcut && mevcut.durum !== 'hata') return;

    this.detayAyarla(sefer.anahtar, { durum: 'yukleniyor' });
    this.service.seferDetay(sefer).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: sonuc => this.detayAyarla(sefer.anahtar, sonuc.isSuccess && sonuc.value
        ? { durum: 'hazir', detay: sonuc.value }
        : { durum: 'hata', mesaj: sonuc.error || this.t('SHIPMENTS.DETAIL_FAILED') }),
      error: () => this.detayAyarla(sefer.anahtar, { durum: 'hata', mesaj: this.t('SHIPMENTS.DETAIL_FAILED') }),
    });
  }

  detay(anahtar: string): SeferDetayDurumu | undefined {
    return this.detaylar()[anahtar];
  }

  seferSandikSayisi(detay: SevkSeferiDetay): number {
    return detay.projeler.reduce((toplam, p) => toplam + p.sandiklar.length, 0);
  }

  private detayAyarla(anahtar: string, durum: SeferDetayDurumu): void {
    this.detaylar.update(detaylar => ({ ...detaylar, [anahtar]: durum }));
  }

  private filtre(): SevkSeferiFiltre {
    return {
      baslangic: this.baslangic() || undefined,
      bitis: this.bitis() || undefined,
      plaka: this.plaka().trim() || undefined,
      projeNo: this.projeNo().trim() || undefined,
      projeTipiId: this.projeTipiId(),
    };
  }

  private seferleriYenile(): void {
    this.sayfa.set(1);
    this.seferleriYukle();
  }

  private seferleriYukle(): void {
    const surum = ++this.seferIstekSurumu;
    this.seferlerYukleniyor.set(true);
    this.seferHatasi.set('');
    this.acikSefer.set(null);
    this.service.seferler(this.filtre(), this.sayfa(), this.sayfaBoyutu()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: sonuc => {
        if (surum !== this.seferIstekSurumu) return;
        this.seferlerYukleniyor.set(false);
        if (sonuc.isSuccess && sonuc.value) {
          this.seferler.set(sonuc.value.items);
          this.toplamKayit.set(sonuc.value.totalCount);
          this.toplamSayfa.set(sonuc.value.totalPages);
        } else {
          this.seferler.set([]);
          this.toplamKayit.set(0);
          this.toplamSayfa.set(0);
          this.seferHatasi.set(sonuc.error || this.t('SHIPMENTS.LIST_FAILED'));
        }
      },
      error: () => {
        if (surum !== this.seferIstekSurumu) return;
        this.seferlerYukleniyor.set(false);
        this.seferHatasi.set(this.t('SHIPMENTS.LIST_FAILED'));
      },
    });
  }

  private istatistikYukle(): void {
    const surum = ++this.istatistikIstekSurumu;
    this.istatistikYukleniyor.set(true);
    this.istatistikHatasi.set('');
    this.service.istatistik(this.filtre()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: sonuc => {
        if (surum !== this.istatistikIstekSurumu) return;
        this.istatistikYukleniyor.set(false);
        if (sonuc.isSuccess && sonuc.value) {
          this.istatistik.set(sonuc.value);
        } else {
          this.istatistik.set(null);
          this.istatistikHatasi.set(sonuc.error || this.t('SHIPMENTS.STATS_FAILED'));
        }
      },
      error: () => {
        if (surum !== this.istatistikIstekSurumu) return;
        this.istatistikYukleniyor.set(false);
        this.istatistikHatasi.set(this.t('SHIPMENTS.STATS_FAILED'));
      },
    });
  }
}
