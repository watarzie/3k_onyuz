import { TranslationService } from '../../core/services/translation.service';
import { DecimalPipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, finalize, switchMap } from 'rxjs';
import { NgApexchartsModule, ApexAxisChartSeries, ApexChart, ApexXAxis } from 'ng-apexcharts';
import { FinansService } from '../../core/services/finans.service';
import { FinansParaBirimiService } from '../../core/services/finans-para-birimi.service';
import { PermissionService } from '../../core/services/permission.service';
import { ToastService } from '../../core/services/toast.service';
import {
  FinansPanel,
  FinansBekleyenAsama,
  FinansYaslandirmaKovasi,
} from '../../shared/models/finans-v2.model';
import { FINANS_YETKI } from '../../core/constants/yetki-kodlari';
import { finansSiparisFaturaOkunabilir } from './finans-izinleri';

@Component({
  selector: 'app-finans-panel',
  standalone: true,
  imports: [FormsModule, DecimalPipe, NgApexchartsModule],
  templateUrl: './finans-panel.component.html',
  styleUrls: ['./finans-v2.scss', './finans-panel.component.scss'],
})
export class FinansPanelComponent implements OnInit {
  private readonly translation = inject(TranslationService);
  t(key: string): string {
    return this.translation.translate(`FINANS_V2.${key}`);
  }
  private readonly service = inject(FinansService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);
  readonly permissions = inject(PermissionService);
  private readonly paraBirimleri = inject(FinansParaBirimiService);
  readonly izin = FINANS_YETKI;
  readonly kayitGorunur = computed(() => this.permissions.hasAccess(FINANS_YETKI.KayitGoruntule));
  /** Alacak kartları faturalardan türetildiği için fatura okuma izniyle gösterilir (RR Q6). */
  readonly alacakGorunur = computed(() => finansSiparisFaturaOkunabilir(this.permissions));
  /** Para birimi seçenekleri: panelin para birimleri (aktif tanımlar + verideki kodlar), yoksa tanım tablosu. */
  readonly paraKodlari = computed(() => {
    const paneldekiler = this.panel()?.tutarlar.map((x) => x.paraBirimi) ?? [];
    return paneldekiler.length ? paneldekiler : this.paraBirimleri.aktifKodlar();
  });
  readonly yaslandirmaEsikleri = [15, 30, 60, 90];
  readonly yaslandirmaGorunur = computed(() => this.permissions.hasAccess(FINANS_YETKI.RaporGoruntule));
  /** Yaşlandırma kovası tıklanınca kalem listesi Finans İş Takibi'nde açılır. */
  readonly bekleyenAc = output<{ asama: FinansBekleyenAsama; minimumGun: number }>();
  private readonly refresh = new Subject<void>();
  readonly loading = signal(false);
  readonly panel = signal<FinansPanel | null>(null);
  readonly para = signal('EUR');
  readonly grafik = signal<
    'aylik' | 'isTurleri' | 'giderTurleri' | 'projeler' | 'ozelIsTurleri' | 'beklenenTahsilat' | 'siparis' | 'fatura'
  >('aylik');
  /**
   * Panel varsayılan olarak bütün dönemlerin genel özetini gösterir; isteğe bağlı dönem filtresi uygulanır.
   * "Tüm dönemler" sunucunun izin verdiği en geniş aralıktır (bu yılın sonundan geriye on yıl).
   */
  readonly donem = signal<'tum' | 'yil' | 'ay' | 'ozel'>('tum');
  baslangic = '';
  bitis = '';
  readonly chart: ApexChart = {
    type: 'bar',
    height: 270,
    toolbar: { show: false },
    animations: { enabled: false },
  };
  readonly grafikVerileri = computed(() => {
    const grafik = this.grafik();
    return grafik === 'siparis' || grafik === 'fatura'
      ? []
      : (this.panel()?.[grafik] ?? []).filter((x) => x.paraBirimi === this.para());
  });
  readonly series = computed<ApexAxisChartSeries>(() => {
    const grafik = this.grafik();
    if (grafik === 'siparis' || grafik === 'fatura') {
      if (!this.parasal(FINANS_YETKI.TutarGoruntule)) return [];
      const p = this.panel()?.tutarlar.find((x) => x.paraBirimi === this.para());
      if (!p) return [];
      // Kartların sunucu toplamları kullanılır; mevcut sayfa mali otorite değildir.
      return [
        {
          name: `${this.t('AMOUNT')} (${this.para()})`,
          data:
            grafik === 'siparis'
              ? [p.siparisBekleyen, p.siparisNetTutar]
              : [p.faturaBekleyen, p.gelir],
        },
      ];
    }
    const rows = this.grafikVerileri();
    const result: ApexAxisChartSeries = [];
    if (this.parasal(FINANS_YETKI.GelirGoruntule) && rows.some((x) => x.gelir != null))
      result.push({
        name: grafik === 'beklenenTahsilat' ? this.t('PANEL_EXPECTED_COLLECTION') : this.t('NET_INCOME'),
        data: rows.map((x) => x.gelir),
      });
    if (this.parasal(FINANS_YETKI.GiderGoruntule) && rows.some((x) => x.gider != null))
      result.push({ name: this.t('NET_EXPENSE'), data: rows.map((x) => x.gider) });
    return result;
  });
  readonly xaxis = computed<ApexXAxis>(() => ({
    categories:
      this.grafik() === 'siparis'
        ? [this.t('PENDING_ORDER'), this.t('PANEL_ORDERED')]
        : this.grafik() === 'fatura'
          ? [this.t('PENDING_INVOICE'), this.t('PANEL_INVOICED')]
          : this.grafikVerileri().map((x) => x.grup),
  }));
  ngOnInit(): void {
    this.refresh
      .pipe(
        switchMap(() => {
          this.loading.set(true);
          return this.service.panel(this.baslangic, this.bitis).pipe(finalize(() => this.loading.set(false)));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        this.panel.set(result.isSuccess ? (result.value ?? null) : null);
        const kodlar = this.paraKodlari();
        if (kodlar.length && !kodlar.includes(this.para())) this.para.set(kodlar[0]);
        if (!result.isSuccess) this.toast.error(result.error ?? this.t('PANEL_LOAD_ERROR'));
      });
    this.donemSec('tum');
  }
  /** Hazır dönem seçimi; "Özel aralık" seçilince mevcut tarihler korunur ve kullanıcı değiştirir. */
  donemSec(donem: 'tum' | 'yil' | 'ay' | 'ozel'): void {
    const bugun = new Date();
    const yil = bugun.getFullYear();
    this.donem.set(donem);
    if (donem === 'tum') {
      this.baslangic = this.date(new Date(yil - 9, 0, 1));
      this.bitis = this.date(new Date(yil, 11, 31));
    } else if (donem === 'yil') {
      this.baslangic = this.date(new Date(yil, 0, 1));
      this.bitis = this.date(new Date(yil, 11, 31));
    } else if (donem === 'ay') {
      this.baslangic = this.date(new Date(yil, bugun.getMonth(), 1));
      this.bitis = this.date(new Date(yil, bugun.getMonth() + 1, 0));
    } else return;
    this.yenile();
  }
  parasal(alan: string): boolean {
    return (
      this.permissions.hasAccess(FINANS_YETKI.ParasalVeriGoruntule) &&
      this.permissions.hasAccess(alan)
    );
  }
  /** Panel kovası (R1 §5): kovanın aşaması ve eşiğiyle bekleme listesi Finans İş Takibi'nde açılır. */
  kovaAc(kova: FinansYaslandirmaKovasi): void {
    if (!this.kayitGorunur() || !this.yaslandirmaGorunur()) return;
    this.bekleyenAc.emit({ asama: kova.asama, minimumGun: kova.minGun });
  }
  kova(asama: FinansBekleyenAsama, minGun: number): FinansYaslandirmaKovasi | undefined {
    return this.panel()?.yaslandirma?.find((x) => x.asama === asama && x.minGun === minGun);
  }
  yenile(): void {
    if (!this.baslangic || !this.bitis || this.baslangic > this.bitis) {
      this.toast.error(this.t('DATE_RANGE_ERROR'));
      return;
    }
    this.refresh.next();
  }
  private date(value: Date): string {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
}
