import { TranslationService } from '../../../core/services/translation.service';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { FinansService } from '../../../core/services/finans.service';
import { FinansParaBirimiService } from '../../../core/services/finans-para-birimi.service';
import {
  FinansGiderRaporuGruplamasi,
  FinansIsRaporuKapsami,
  FinansOdemeFiltresi,
} from '../../../core/constants/enums';
import { ToastService } from '../../../core/services/toast.service';
import { FinansGiderKategori, FinansListelemeRequest } from '../../../shared/models/finans.model';
import {
  FinansRaporOnizleme,
  FinansRaporSatirTuru,
  FinansRaporSecenekleri,
} from '../../../shared/models/finans-v2.model';
import { dosyaAdiBasliktan, dosyayiKaydet } from '../../../core/services/dosya-kaydet';
import {
  FINANS_RAPOR_GRUPLARI,
  FinansRaporTanimi,
  FinansRaporTuru,
  GIDER_RAPORU_GRUPLAMALARI,
  IS_RAPORU_KAPSAMLARI,
  raporTanimi,
} from './rapor-tanimlari';

@Component({
  selector: 'app-finans-raporlar',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './finans-raporlar.component.html',
  styleUrls: ['../ortak/finans-v2.scss', './finans-raporlar.component.scss'],
})
/**
 * Yalnız Raporlar sekmesinde açılır: sekmenin R izni bütün rapor türlerini (alacak ve finansal durum dahil),
 * önizlemeyi, PDF/Excel dışa aktarmayı ve gider kategorisi filtresini kapsar; ayrı alan veya biçim izni yoktur.
 * Rapor kataloktan seçilir; işler raporunda kapsam, gider raporunda gruplama seçilir. Filtre alanları seçili
 * raporun sunucuda uyguladığı filtrelerdir (finansal durum yalnız dönem ve para birimi).
 */
export class FinansRaporlarComponent implements OnInit {
  private readonly translation = inject(TranslationService);
  t(key: string): string {
    return this.translation.translate(`FINANS_V2.${key}`);
  }
  private readonly service = inject(FinansService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);
  readonly paraBirimleri = inject(FinansParaBirimiService);
  readonly odemeFiltreleri = FinansOdemeFiltresi;
  readonly raporGruplari = FINANS_RAPOR_GRUPLARI;
  readonly kapsamlar = IS_RAPORU_KAPSAMLARI;
  readonly gruplamalar = GIDER_RAPORU_GRUPLAMALARI;
  readonly loading = signal(false);
  readonly kategoriler = signal<FinansGiderKategori[]>([]);
  tur: FinansRaporTuru = 'is';
  kapsam = FinansIsRaporuKapsami.Birlesik;
  gruplama = FinansGiderRaporuGruplamasi.Duz;
  filtre: FinansListelemeRequest = { pageNumber: 1, pageSize: 25 };

  get tanim(): FinansRaporTanimi {
    return raporTanimi(this.tur);
  }

  sec(tur: FinansRaporTuru): void {
    this.tur = tur;
  }

  filtreleriTemizle(): void {
    this.filtre = { pageNumber: 1, pageSize: 25 };
    this.kapsam = FinansIsRaporuKapsami.Birlesik;
    this.gruplama = FinansGiderRaporuGruplamasi.Duz;
  }

  /** Yalnız seçili rapora ait seçim gönderilir (işlerde kapsam, giderde gruplama). */
  secenekler(): FinansRaporSecenekleri {
    return this.tur === 'is' ? { kapsam: this.kapsam } : this.tur === 'gider' ? { gruplama: this.gruplama } : {};
  }

  /**
   * Gönderilen filtre: seçili raporun ekranda gösterilmeyen alanları gönderilmez; başka rapordan kalan gizli bir
   * değer (ör. ödeme durumu) önizlemeyi ve dosyayı sessizce daraltmaz.
   */
  gonderilenFiltre(): FinansListelemeRequest {
    const t = this.tanim;
    const f: FinansListelemeRequest = {
      pageNumber: 1,
      pageSize: 25,
      baslangic: this.filtre.baslangic,
      bitis: this.filtre.bitis,
      paraBirimi: this.filtre.paraBirimi,
    };
    if (t.projeVeArama) Object.assign(f, { projeNo: this.filtre.projeNo, arama: this.filtre.arama });
    if (t.odeme) f.odemeDurumu = this.filtre.odemeDurumu;
    if (t.gelismis) {
      Object.assign(f, {
        poNumarasi: this.filtre.poNumarasi,
        faturaNumarasi: this.filtre.faturaNumarasi,
        siparisDurumu: this.filtre.siparisDurumu,
        faturaDurumu: this.filtre.faturaDurumu,
        firma: this.filtre.firma,
        talepEden: this.filtre.talepEden,
        isTuru: this.filtre.isTuru,
        sandikCinsi: this.filtre.sandikCinsi,
        durum: this.filtre.durum,
        giderKategoriId: this.filtre.giderKategoriId,
        iptalEdilenleriDahilEt: this.filtre.iptalEdilenleriDahilEt,
      });
    }
    return f;
  }

  /** Önizleme: seçili rapor türü, seçim ve filtrelerle dosyada yer alacak satırlar (ilk 50, genel toplam dahil). */
  readonly onizleme = signal<FinansRaporOnizleme | null>(null);
  readonly onizlemeYukleniyor = signal(false);
  private onizlemeImzasi = '';
  /** Önizlemeden sonra rapor türü, seçim veya filtre değiştiyse gösterilen satırlar indirilecek dosyayı yansıtmaz. */
  onizlemeEski(): boolean {
    return !!this.onizleme() && this.onizlemeImzasi !== this.imza();
  }
  private imza(): string {
    return JSON.stringify([this.tur, this.secenekler(), this.gonderilenFiltre()]);
  }

  satirTuru(o: FinansRaporOnizleme, index: number): FinansRaporSatirTuru {
    return o.satirTurleri?.[index] ?? 'veri';
  }

  /** Önizlemede görünen veri satırı sayısı (bölüm ve toplam satırları hariç). */
  gorunenVeriSatiri(o: FinansRaporOnizleme): number {
    return o.satirTurleri ? o.satirTurleri.filter((x) => x === 'veri').length : o.satirlar.length;
  }

  tabloNotu(o: FinansRaporOnizleme): string | null {
    const tablolar = o.tablolar ?? [];
    if (tablolar.length < 2) return null;
    return this.t('REPORT_PREVIEW_TABLES').replace('{0}', String(tablolar.length)).replace('{1}', tablolar.join(', '));
  }

  private tarihleriDogrula(): boolean {
    if (this.filtre.baslangic && this.filtre.bitis && this.filtre.baslangic > this.filtre.bitis) {
      this.toast.error(this.t('REPORT_DATES_ERROR'));
      return false;
    }
    return true;
  }

  onizle(): void {
    if (this.onizlemeYukleniyor() || !this.tarihleriDogrula()) return;
    const imza = this.imza();
    this.onizlemeYukleniyor.set(true);
    this.service
      .raporOnizleme(this.tur, this.gonderilenFiltre(), this.secenekler())
      .pipe(
        finalize(() => this.onizlemeYukleniyor.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((r) => {
        if (!r.isSuccess || !r.value) {
          this.toast.error(r.error ?? this.t('REPORT_PREVIEW_ERROR'));
          return;
        }
        this.onizlemeImzasi = imza;
        this.onizleme.set(r.value);
      });
  }

  ngOnInit(): void {
    this.paraBirimleri.yukle();
    this.service
      .giderKategorileri()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((r) => {
        if (r.isSuccess) this.kategoriler.set(r.value ?? []);
        else this.toast.error(r.error ?? this.t('REPORT_CATEGORY_ERROR'));
      });
  }

  indir(format: 'pdf' | 'excel'): void {
    if (this.loading() || !this.tarihleriDogrula()) return;
    this.loading.set(true);
    const varsayilanAd = `Finans_${this.tur}_Raporu.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
    this.service
      .raporDosyasi(this.tur, format, this.gonderilenFiltre(), this.secenekler())
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (yanit) =>
          dosyayiKaydet(
            yanit.body ?? new Blob(),
            dosyaAdiBasliktan(yanit.headers.get('Content-Disposition'), varsayilanAd),
          ),
        error: async (error: unknown) =>
          this.toast.error(await this.service.downloadErrorMessage(error, this.t('REPORT_ERROR'))),
      });
  }
}
