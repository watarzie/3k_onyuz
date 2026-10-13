import { TranslationService } from '../../../core/services/translation.service';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, finalize, switchMap } from 'rxjs';
import {
  NgApexchartsModule,
  ApexAxisChartSeries,
  ApexChart,
  ApexDataLabels,
  ApexFill,
  ApexGrid,
  ApexLegend,
  ApexPlotOptions,
  ApexStroke,
  ApexTooltip,
  ApexXAxis,
  ApexYAxis,
} from 'ng-apexcharts';
import { FinansService } from '../../../core/services/finans.service';
import { FinansParaBirimiService } from '../../../core/services/finans-para-birimi.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  FinansPanel,
  FinansBekleyenAsama,
  FinansVarlikTuru,
  FinansYaslandirmaKovasi,
} from '../../../shared/models/finans-v2.model';
import { finansAltSekmeAcik, finansSekmeAcik } from '../ortak/finans-izinleri';
import { isTuruAdiAnahtari } from '../ortak/finans-etiketleri';
import { FinansPanelDetayComponent } from '../finans-panel-detay/finans-panel-detay.component';

/** Üst sıradaki genel durum kartı; alt satırdaki rozetler kartın kırılımıdır. */
export interface FinansPanelKpi {
  anahtar: string;
  etiket: string;
  deger: number;
  ikon: string;
  ton: 'primary' | 'info' | 'success' | 'warning' | 'danger';
  rozetler: { metin: string; ton: 'neutral' | 'success' | 'warning' | 'danger' | 'info' }[];
}

/** İş kalemi durum çubuğunun bir dilimi. */
export interface FinansPanelDilim {
  anahtar: string;
  etiket: string;
  adet: number;
  oran: number;
  renk: string;
}

/** Grafik serisi: göstergede kalıcı anahtar, ekrandaki ad, sabit renk ve veri. */
export interface FinansPanelSeri {
  anahtar: string;
  ad: string;
  renk: string;
  data: (number | null)[];
}

export type FinansPanelGrafikGorunumu = 'adet' | 'tutar' | 'dagilim';
type FinansPanelGrafik =
  | 'aylik'
  | 'isTurleri'
  | 'giderTurleri'
  | 'projeler'
  | 'ozelIsTurleri'
  | 'beklenenTahsilat'
  | 'siparis'
  | 'fatura';

const GRAFIK_TERCIHI = '3k_finans_panel_grafik';

/**
 * Panel tarih aralığı denetimi (sunucudaki FinansTarihKurallari.GecerliAralik ile aynı): iki tarih tam (yyyy-MM-dd),
 * yıl 2000–2200, başlangıç bitişten sonra değil ve aralık en fazla on yıl (3660 gün). Geçerliyse null, değilse
 * çeviri anahtarı döner.
 */
export function finansPanelAralikHatasi(baslangic: string, bitis: string): string | null {
  const tam = /^\d{4}-\d{2}-\d{2}$/;
  if (!tam.test(baslangic ?? '') || !tam.test(bitis ?? '')) return 'DATE_RANGE_INCOMPLETE';
  const yilGecerli = (t: string) => { const y = Number(t.slice(0, 4)); return y >= 2000 && y <= 2200; };
  if (!yilGecerli(baslangic) || !yilGecerli(bitis)) return 'DATE_RANGE_YEAR';
  const bas = Date.parse(baslangic + 'T00:00:00Z');
  const bit = Date.parse(bitis + 'T00:00:00Z');
  if (Number.isNaN(bas) || Number.isNaN(bit)) return 'DATE_RANGE_INCOMPLETE';
  if (bas > bit) return 'DATE_RANGE_ORDER';
  if ((bit - bas) / 86_400_000 > 3660) return 'DATE_RANGE_TOO_LONG';
  return null;
}

@Component({
  selector: 'app-finans-panel',
  standalone: true,
  imports: [FormsModule, DatePipe, DecimalPipe, NgApexchartsModule, FinansPanelDetayComponent],
  templateUrl: './finans-panel.component.html',
  styleUrls: ['../ortak/finans-v2.scss', './finans-panel.component.scss'],
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
  /** Para birimi seçenekleri: panelin para birimleri (aktif tanımlar + verideki kodlar), yoksa tanım tablosu. */
  readonly paraKodlari = computed(() => {
    const paneldekiler = this.panel()?.tutarlar.map((x) => x.paraBirimi) ?? [];
    return paneldekiler.length ? paneldekiler : this.paraBirimleri.aktifKodlar();
  });
  readonly yaslandirmaEsikleri = [15, 30, 60, 90];
  /** Yaşlandırma kovası İş Takibi'nin "Bekleyen işler" alt sekmesini açar; o alt sekme kapalıysa kova tıklanamaz. */
  readonly bekleyenlerAcilabilir = computed(() => finansAltSekmeAcik(this.permissions, 'bekleyen'));
  /** Yaşlandırma kovası tıklanınca kalem listesi Finans İş Takibi'nde açılır. */
  readonly bekleyenAc = output<{ asama: FinansBekleyenAsama; minimumGun: number }>();
  /** Detay dökümünde bir kalem seçilince kayıt detayı finans sayfasında açılır. */
  readonly kayitAc = output<{ tur: FinansVarlikTuru; id: number }>();
  /** Paneldeki münferit iş kartının "Tümü" düğmesi: Münferit İşler sekmesine geçilir. */
  readonly munferitAc = output<void>();
  readonly munferitSekmesiAcik = computed(() => finansSekmeAcik(this.permissions, 'munferit'));
  private readonly refresh = new Subject<void>();
  readonly loading = signal(false);
  readonly panel = signal<FinansPanel | null>(null);
  readonly para = signal('EUR');
  readonly grafik = signal<FinansPanelGrafik>('aylik');
  /** Grafik kartı: adet (iş/PO/fatura), tutar (aylık gelir/gider) veya dağılım (seçilen kırılım). */
  readonly grafikGorunumu = signal<FinansPanelGrafikGorunumu>('adet');
  /** Dönem grafiği isteğe bağlıdır; kullanıcının aç/kapat tercihi bu tarayıcıda hatırlanır. */
  readonly grafikAcik = signal(this.grafikTercihi());
  /**
   * Panel varsayılan olarak bütün dönemlerin genel özetini gösterir; isteğe bağlı dönem filtresi uygulanır.
   * "Tüm dönemler" sunucunun izin verdiği en geniş aralıktır (bu yılın sonundan geriye on yıl).
   */
  readonly donem = signal<'tum' | 'yil' | 'ay' | 'ozel'>('tum');
  readonly donemler = ['tum', 'yil', 'ay', 'ozel'] as const;
  baslangic = '';
  bitis = '';
  /** Özel aralıkta tamamlanmamış/geçersiz tarih için satır içi uyarı (bildirim yağmuru yerine). */
  readonly tarihHatasi = signal<string | null>(null);
  private readonly tarihDegisimi = new Subject<void>();

  /** Genel durum kartları: iş kalemi, PO, fatura ve tahsilat. */
  readonly kpiKartlari = computed<FinansPanelKpi[]>(() => {
    const p = this.panel();
    if (!p) return [];
    const s = p.sayilar;
    const kartlar: FinansPanelKpi[] = [
      {
        anahtar: 'is',
        etiket: this.t('PANEL_KPI_ITEMS'),
        deger: s?.isKaydi ?? p.siparisBekleyen + p.kismiSiparis + p.siparisTam + p.kismiFatura + p.tamamlanan,
        ikon: 'ri-stack-line',
        ton: 'primary',
        rozetler: [
          ...(s ? [{ metin: `${s.proje} ${this.t('PANEL_PROJECTS')}`, ton: 'neutral' as const }] : []),
          { metin: `${p.tamamlanan} ${this.t('PANEL_KPI_DONE')}`, ton: 'success' },
        ],
      },
    ];
    if (s) {
      kartlar.push(
        {
          anahtar: 'po',
          etiket: this.t('PANEL_KPI_PO'),
          deger: s.po,
          ikon: 'ri-file-list-3-line',
          ton: 'info',
          rozetler: [
            { metin: `${s.acikPo} ${this.t('PANEL_KPI_OPEN')}`, ton: 'warning' },
            { metin: `${s.kismiFaturaliPo} ${this.t('PANEL_KPI_PARTIAL')}`, ton: 'info' },
            { metin: `${s.kapaliPo} ${this.t('PANEL_KPI_CLOSED')}`, ton: 'success' },
          ],
        },
        {
          anahtar: 'fatura',
          etiket: this.t('PANEL_KPI_INVOICES'),
          deger: s.fatura,
          ikon: 'ri-bill-line',
          ton: 'success',
          rozetler: [
            { metin: `${s.odenenFatura} ${this.t('PANEL_KPI_PAID')}`, ton: 'success' },
            { metin: `${s.odenmemisFatura} ${this.t('PANEL_KPI_UNPAID')}`, ton: 'warning' },
          ],
        },
      );
    }
    if (p.alacaklar?.length) {
      const toplam = (alan: 'bekleyenAdet' | 'vadesiGecenAdet' | 'yaklasanAdet') =>
        p.alacaklar!.reduce((a, x) => a + x[alan], 0);
      const gecen = toplam('vadesiGecenAdet');
      kartlar.push({
        anahtar: 'tahsilat',
        etiket: this.t('PANEL_KPI_COLLECTION'),
        deger: toplam('bekleyenAdet'),
        ikon: 'ri-hand-coin-line',
        ton: gecen > 0 ? 'danger' : 'warning',
        rozetler: [
          { metin: `${gecen} ${this.t('PANEL_KPI_OVERDUE')}`, ton: gecen > 0 ? 'danger' : 'neutral' },
          { metin: `${toplam('yaklasanAdet')} ${this.t('PANEL_KPI_DUE_SOON')}`, ton: 'warning' },
        ],
      });
    } else if (s) {
      kartlar.push({
        anahtar: 'gider',
        etiket: this.t('PANEL_KPI_EXPENSES'),
        deger: s.giderKaydi,
        ikon: 'ri-wallet-3-line',
        ton: 'warning',
        rozetler: [],
      });
    }
    return kartlar;
  });

  /** İş kalemlerinin sipariş/fatura aşamalarına dağılımı (tek yatay çubuk + açıklama). */
  readonly isDurumlari = computed<FinansPanelDilim[]>(() => {
    const p = this.panel();
    if (!p) return [];
    const dilimler = [
      { anahtar: 'siparisBekleyen', etiket: this.t('PENDING_ORDER'), adet: p.siparisBekleyen, renk: '#fd9b45' },
      { anahtar: 'kismiSiparis', etiket: this.t('PARTIAL_ORDER'), adet: p.kismiSiparis, renk: '#ffc94d' },
      { anahtar: 'siparisTam', etiket: this.t('FULL_ORDER'), adet: p.siparisTam, renk: '#605dff' },
      { anahtar: 'kismiFatura', etiket: this.t('PARTIAL_INVOICE'), adet: p.kismiFatura, renk: '#3584fc' },
      { anahtar: 'tamamlanan', etiket: this.t('COMPLETED'), adet: p.tamamlanan, renk: '#25b003' },
    ];
    const toplam = dilimler.reduce((a, x) => a + x.adet, 0);
    return dilimler.map((x) => ({ ...x, oran: toplam ? (x.adet / toplam) * 100 : 0 }));
  });
  readonly isDurumuToplami = computed(() => this.isDurumlari().reduce((a, x) => a + x.adet, 0));

  /** Proje kapsaması: PO ve fatura için yok/kısmi/tam dilimleri. */
  readonly projeKapsami = computed(() => {
    const pd = this.panel()?.projeDurumlari;
    if (!pd) return [];
    const satir = (baslik: string, yok: number, kismi: number, tam: number, etiketler: [string, string, string]) => {
      const toplam = yok + kismi + tam;
      const oran = (x: number) => (toplam ? (x / toplam) * 100 : 0);
      return {
        baslik,
        toplam,
        dilimler: [
          { etiket: etiketler[0], adet: yok, oran: oran(yok), ton: 'none' },
          { etiket: etiketler[1], adet: kismi, oran: oran(kismi), ton: 'partial' },
          { etiket: etiketler[2], adet: tam, oran: oran(tam), ton: 'full' },
        ],
      };
    };
    return [
      satir('PO', pd.siparisYok, pd.siparisKismi, pd.siparisTam, [this.t('NO_ORDER'), this.t('PARTIAL_ORDER'), this.t('FULL_ORDER')]),
      satir(this.t('INVOICE'), pd.faturaYok, pd.faturaKismi, pd.faturaTam, [
        this.t('NO_INVOICE'),
        this.t('PARTIAL_INVOICE'),
        this.t('FULL_INVOICE'),
      ]),
    ];
  });

  /** Bekleme kovalarından en az biri doluysa kart kovaları gösterir; hepsi boşsa sakin bir "geciken iş yok" durumu. */
  readonly gecikenVar = computed(() => (this.panel()?.yaslandirma ?? []).some((x) => x.adet > 0));

  private readonly ayBicimi = computed(
    () =>
      new Intl.DateTimeFormat(this.translation.currentLang() === 'en' ? 'en-GB' : 'tr-TR', {
        month: 'short',
        year: '2-digit',
      }),
  );
  private isTuruEtiketi(ad: string): string {
    const anahtar = isTuruAdiAnahtari(ad);
    return anahtar ? this.t(anahtar) : ad;
  }
  private ayEtiketi(ay: string): string {
    const [yil, no] = ay.split('-').map(Number);
    return yil && no ? this.ayBicimi().format(new Date(yil, no - 1, 1)) : ay;
  }

  readonly grafikVerileri = computed(() => {
    const grafik = this.grafik();
    return grafik === 'siparis' || grafik === 'fatura'
      ? []
      : (this.panel()?.[grafik] ?? []).filter((x) => x.paraBirimi === this.para());
  });
  /** Seçili görünümün bütün serileri; renk seriye bağlıdır, bir seri gizlenince diğerlerinin rengi kaymaz. */
  readonly grafikSerileri = computed<FinansPanelSeri[]>(() => {
    if (this.grafikGorunumu() === 'adet') {
      const aylar = this.panel()?.aylikSayilar ?? [];
      if (!aylar.length) return [];
      const seriler: FinansPanelSeri[] = [
        { anahtar: 'is', ad: this.t('PANEL_KPI_ITEMS'), renk: '#605dff', data: aylar.map((x) => x.isKaydi) },
      ];
      seriler.push(
        { anahtar: 'po', ad: this.t('PANEL_KPI_PO'), renk: '#3584fc', data: aylar.map((x) => x.po) },
        { anahtar: 'fatura', ad: this.t('PANEL_KPI_INVOICES'), renk: '#25b003', data: aylar.map((x) => x.fatura) },
      );
      return seriler;
    }
    const grafik = this.grafik();
    if (grafik === 'siparis' || grafik === 'fatura') {
      const p = this.panel()?.tutarlar.find((x) => x.paraBirimi === this.para());
      if (!p) return [];
      // Kartların sunucu toplamları kullanılır; mevcut sayfa mali otorite değildir.
      return [
        {
          anahtar: 'tutar',
          ad: `${this.t('AMOUNT')} (${this.para()})`,
          renk: '#605dff',
          data: grafik === 'siparis' ? [p.siparisBekleyen, p.siparisNetTutar] : [p.faturaBekleyen, p.gelir],
        },
      ];
    }
    const rows = this.grafikVerileri();
    const result: FinansPanelSeri[] = [];
    if (rows.some((x) => x.gelir != null))
      result.push({
        anahtar: 'gelir',
        ad: grafik === 'beklenenTahsilat' ? this.t('PANEL_EXPECTED_COLLECTION') : this.t('NET_INCOME'),
        renk: '#605dff',
        data: rows.map((x) => x.gelir),
      });
    if (rows.some((x) => x.gider != null))
      result.push({ anahtar: 'gider', ad: this.t('NET_EXPENSE'), renk: '#fd9b45', data: rows.map((x) => x.gider) });
    return result;
  });
  /**
   * Göstergede kapatılan seriler. Gösterge ApexCharts'ın değil bizimdir: ApexCharts 5.10 gizlenen seriyi
   * yeniden gösterdiğinde gösterge öğesini sönük bırakıyordu (seri çizilse de). Seri burada süzülür; yalnız
   * seri değiştiği için grafik yeniden kurulmaz, mevcut grafikte güncellenir.
   */
  readonly gizliSeriler = signal<ReadonlySet<string>>(new Set());
  readonly series = computed<ApexAxisChartSeries>(() => {
    const gizli = this.gizliSeriler();
    const tumu = this.grafikSerileri();
    const gorunen = tumu.filter((x) => !gizli.has(x.anahtar));
    return (gorunen.length ? gorunen : tumu).map((x) => ({ name: x.ad, data: x.data, color: x.renk }));
  });
  readonly xaxis = computed<ApexXAxis>(() => {
    const ortak: ApexXAxis = {
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: { style: { colors: '#64748b', fontSize: '12px' }, rotate: 0, hideOverlappingLabels: true, trim: true },
    };
    if (this.grafikGorunumu() === 'adet')
      return { ...ortak, categories: (this.panel()?.aylikSayilar ?? []).map((x) => this.ayEtiketi(x.ay)) };
    const grafik = this.grafik();
    return {
      ...ortak,
      categories:
        grafik === 'siparis'
          ? [this.t('PENDING_ORDER'), this.t('PANEL_ORDERED')]
          : grafik === 'fatura'
            ? [this.t('PENDING_INVOICE'), this.t('PANEL_INVOICED')]
            : this.grafikVerileri().map((x) =>
                grafik === 'aylik' || grafik === 'beklenenTahsilat'
                  ? this.ayEtiketi(x.grup)
                  : grafik === 'isTurleri'
                    ? this.isTuruEtiketi(x.grup)
                    : x.grup,
              ),
    };
  });
  readonly chart = computed<ApexChart>(() => ({
    type: this.grafikGorunumu() === 'adet' ? 'area' : 'bar',
    height: 300,
    fontFamily: 'Inter, sans-serif',
    toolbar: { show: false },
    zoom: { enabled: false },
    animations: { enabled: false },
  }));
  readonly stroke = computed<ApexStroke>(() =>
    this.grafikGorunumu() === 'adet' ? { curve: 'smooth', width: 2.5 } : { show: true, width: 2, colors: ['transparent'] },
  );
  readonly fill = computed<ApexFill>(() =>
    this.grafikGorunumu() === 'adet'
      ? { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.28, opacityTo: 0.02, stops: [0, 95, 100] } }
      : { opacity: 1 },
  );
  readonly yaxis = computed<ApexYAxis>(() => ({
    labels: {
      style: { colors: '#64748b', fontSize: '12px' },
      formatter: (deger: number) =>
        this.grafikGorunumu() === 'adet'
          ? String(Math.round(deger))
          : new Intl.NumberFormat('tr-TR', { notation: 'compact', maximumFractionDigits: 1 }).format(deger),
    },
  }));
  readonly tooltip = computed<ApexTooltip>(() => ({
    shared: true,
    intersect: false,
    y: {
      formatter: (deger: number) =>
        deger == null
          ? '—'
          : this.grafikGorunumu() === 'adet'
            ? String(deger)
            : `${new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(deger)} ${this.para()}`,
    },
  }));
  readonly grid: ApexGrid = { borderColor: '#eceef2', strokeDashArray: 4, padding: { left: 8, right: 8 } };
  readonly legend: ApexLegend = { show: false };
  readonly dataLabels: ApexDataLabels = { enabled: false };
  readonly plotOptions: ApexPlotOptions = { bar: { borderRadius: 4, columnWidth: '46%' } };

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
        // Hatalı istekte önceki panel korunur; ekran boşalmaz, yalnız hata bildirilir.
        if (result.isSuccess) this.panel.set(result.value ?? null);
        const kodlar = this.paraKodlari();
        if (kodlar.length && !kodlar.includes(this.para())) this.para.set(kodlar[0]);
        if (!result.isSuccess) this.toast.error(result.error ?? this.t('PANEL_LOAD_ERROR'));
      });
    // Tarih kutusuna yazarken (yıl 0002 → 2026 gibi) her tuşta istek gitmez: yazma bitince ve tarih geçerliyse yüklenir.
    this.tarihDegisimi.pipe(debounceTime(600), takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      const hata = finansPanelAralikHatasi(this.baslangic, this.bitis);
      this.tarihHatasi.set(hata);
      if (!hata) this.refresh.next();
    });
    this.donemSec('tum');
  }
  tarihDegisti(): void {
    this.tarihDegisimi.next();
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
  /** Grafik görünümü: tutar aylık gelir/gider kırılımını, dağılım ilk açılışta iş türü kırılımını seçer. */
  grafikGorunumuSec(gorunum: FinansPanelGrafikGorunumu): void {
    this.grafikGorunumu.set(gorunum);
    this.gizliSeriler.set(new Set());
    if (gorunum === 'tutar') this.grafik.set('aylik');
    else if (gorunum === 'dagilim' && this.grafik() === 'aylik') this.grafik.set('isTurleri');
  }
  seriGizli(anahtar: string): boolean {
    return this.gizliSeriler().has(anahtar);
  }
  /** Gösterge düğmesi seriyi gizler/gösterir; son görünen seri gizlenmez, grafik boş kalmaz. */
  seriAcKapat(anahtar: string): void {
    const gizli = new Set(this.gizliSeriler());
    if (gizli.has(anahtar)) gizli.delete(anahtar);
    else if (this.series().length > 1) gizli.add(anahtar);
    else return;
    this.gizliSeriler.set(gizli);
  }
  grafikAcKapat(): void {
    const acik = !this.grafikAcik();
    this.grafikAcik.set(acik);
    try {
      localStorage.setItem(GRAFIK_TERCIHI, acik ? '1' : '0');
    } catch {
      // Tarayıcı depolaması kapalıysa tercih yalnız bu oturumda geçerlidir.
    }
  }
  /** Panel kovası (R1 §5): kovanın aşaması ve eşiğiyle bekleme listesi Finans İş Takibi'nde açılır. */
  kovaAc(kova: FinansYaslandirmaKovasi): void {
    if (!this.bekleyenlerAcilabilir()) return;
    this.bekleyenAc.emit({ asama: kova.asama, minimumGun: kova.minGun });
  }
  /** Kovanın kalan net tutarı, ipucu olarak gösterilir. */
  kovaTutari(kova: FinansYaslandirmaKovasi): string {
    const bicim = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return kova.tutarlar.map((x) => `${bicim.format(x.netTutar ?? 0)} ${x.paraBirimi}`).join(' · ');
  }
  kova(asama: FinansBekleyenAsama, minGun: number): FinansYaslandirmaKovasi | undefined {
    return this.panel()?.yaslandirma?.find((x) => x.asama === asama && x.minGun === minGun);
  }
  yenile(): void {
    const hata = finansPanelAralikHatasi(this.baslangic, this.bitis);
    this.tarihHatasi.set(hata);
    if (hata) {
      this.toast.error(this.t(hata));
      return;
    }
    this.refresh.next();
  }
  private grafikTercihi(): boolean {
    try {
      return localStorage.getItem(GRAFIK_TERCIHI) !== '0';
    } catch {
      return true;
    }
  }
  private date(value: Date): string {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
}
