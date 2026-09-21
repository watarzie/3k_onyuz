import { TranslationService } from '../../core/services/translation.service';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  Subject,
  debounceTime,
  distinctUntilChanged,
  finalize,
  forkJoin,
  of,
  switchMap,
} from 'rxjs';
import { NgApexchartsModule, ApexAxisChartSeries, ApexChart, ApexXAxis } from 'ng-apexcharts';
import { FinansService } from '../../core/services/finans.service';
import { PermissionService } from '../../core/services/permission.service';
import { ToastService } from '../../core/services/toast.service';
import { ServerPagerComponent } from '../../shared/components/server-pager/server-pager.component';
import {
  FinansIsKaydi,
  FinansListelemeRequest,
  FinansSayfaliSonuc,
} from '../../shared/models/finans.model';
import {
  FinansPanel,
  FinansHareket,
  FinansBekleyen,
  FinansVarlikTuru,
} from '../../shared/models/finans-v2.model';
import { FINANS_YETKI } from '../../core/constants/yetki-kodlari';
import { ApiResult } from '../../shared/models/common.model';

@Component({
  selector: 'app-finans-panel',
  standalone: true,
  imports: [FormsModule, DatePipe, DecimalPipe, ServerPagerComponent, NgApexchartsModule],
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
  readonly kayitGorunur = computed(() => this.permissions.hasAccess(FINANS_YETKI.KayitGoruntule));
  readonly kayitAc = output<{ tur: FinansVarlikTuru; id: number }>();
  readonly siparisAc = output<number[]>();
  private readonly refresh = new Subject<void>();
  private readonly search = new Subject<string>();
  readonly loading = signal(false);
  readonly panel = signal<FinansPanel | null>(null);
  readonly hareketler = signal<FinansSayfaliSonuc<FinansHareket> | null>(null);
  readonly sonuclar = signal<FinansSayfaliSonuc<FinansIsKaydi> | null>(null);
  readonly bekleyenler = signal<FinansSayfaliSonuc<FinansBekleyen> | null>(null);
  readonly secilenler = signal(new Set<number>());
  readonly gorunum = signal<'aylik' | 'arama' | 'bekleyen'>('aylik');
  readonly para = signal('EUR');
  readonly grafik = signal<
    'aylik' | 'isTurleri' | 'giderTurleri' | 'projeler' | 'ozelIsTurleri' | 'siparis' | 'fatura'
  >('aylik');
  baslangic = this.date(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  bitis = this.date(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0));
  arama = '';
  tur = '';
  isTuru = '';
  durum = '';
  minimumGun = 15;
  pageNumber = 1;
  pageSize = 25;
  readonly isTurleri = [
    { id: 1, ad: 'MAIN_PACKAGING' },
    { id: 9, ad: 'WASTE_TIMBER' },
    { id: 2, ad: 'ADDITIONAL' },
    { id: 3, ad: 'INNER_CRATE' },
    { id: 4, ad: 'SITE' },
    { id: 5, ad: 'SPARE' },
    { id: 6, ad: 'REPAIR' },
    { id: 7, ad: 'OTHER_PACKAGING' },
    { id: 8, ad: 'CUSTOM_REGULAR' },
  ];
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
      if (!this.parasal('finans-tutar-goruntule')) return [];
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
    if (this.parasal('finans-gelir-goruntule') && rows.some((x) => x.gelir != null))
      result.push({ name: this.t('NET_INCOME'), data: rows.map((x) => x.gelir) });
    if (this.parasal('finans-gider-goruntule') && rows.some((x) => x.gider != null))
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
  readonly pager = computed(() =>
    this.gorunum() === 'aylik'
      ? this.hareketler()
      : this.gorunum() === 'arama'
        ? this.sonuclar()
        : this.bekleyenler(),
  );

  ngOnInit(): void {
    this.search
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.filtrele());
    this.refresh
      .pipe(
        switchMap(() => {
          this.loading.set(true);
          this.hareketler.set(null);
          this.sonuclar.set(null);
          this.bekleyenler.set(null);
          if (!this.kayitGorunur()) this.gorunum.set('aylik');
          const request: FinansListelemeRequest = {
            pageNumber: this.pageNumber,
            pageSize: this.pageSize,
            arama: this.arama.trim() || undefined,
            paraBirimi: this.para() || undefined,
            isTuru: this.isTuru ? Number(this.isTuru) : undefined,
            durum: this.durum ? Number(this.durum) : undefined,
          };
          if (this.gorunum() === 'arama')
            return this.service.genelArama(request).pipe(finalize(() => this.loading.set(false)));
          if (this.gorunum() === 'bekleyen')
            return this.service
              .yaslandirma(request, this.bitis, this.minimumGun)
              .pipe(finalize(() => this.loading.set(false)));
          const liste = this.kayitGorunur()
            ? this.service.hareketler(
                { ...request, baslangic: this.baslangic, bitis: this.bitis },
                this.tur || undefined,
              )
            : of<ApiResult<FinansSayfaliSonuc<FinansHareket>>>({ isSuccess: true });
          return forkJoin({ panel: this.service.panel(this.baslangic, this.bitis), liste }).pipe(
            finalize(() => this.loading.set(false)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        if ('panel' in result) {
          this.panel.set(result.panel.isSuccess ? (result.panel.value ?? null) : null);
          this.hareketler.set(result.liste.isSuccess ? (result.liste.value ?? null) : null);
          if (!result.panel.isSuccess || !result.liste.isSuccess)
            this.toast.error(
              result.panel.error ?? result.liste.error ?? this.t('PANEL_LOAD_ERROR'),
            );
        } else if (!result.isSuccess) this.toast.error(result.error ?? this.t('LIST_LOAD_ERROR'));
        else if (this.gorunum() === 'arama')
          this.sonuclar.set(result.value as FinansSayfaliSonuc<FinansIsKaydi>);
        else this.bekleyenler.set(result.value as FinansSayfaliSonuc<FinansBekleyen>);
      });
    this.refresh.next();
  }
  parasal(alan: string): boolean {
    return (
      this.permissions.hasAccess('finans-parasal-veri-goruntule') &&
      this.permissions.hasAccess(alan)
    );
  }
  gorunumSec(value: 'aylik' | 'arama' | 'bekleyen'): void {
    if (value !== 'aylik' && !this.kayitGorunur()) return;
    this.gorunum.set(value);
    this.arama = '';
    this.filtrele();
  }
  aramaDegisti(): void {
    this.search.next(this.arama);
  }
  filtrele(): void {
    this.pageNumber = 1;
    this.secilenler.set(new Set());
    this.yenile();
  }
  yenile(): void {
    if (
      this.gorunum() !== 'arama' &&
      (!this.baslangic || !this.bitis || this.baslangic > this.bitis)
    ) {
      this.toast.error(this.t('DATE_RANGE_ERROR'));
      return;
    }
    this.refresh.next();
  }
  sayfa(page: number): void {
    this.pageNumber = page;
    this.yenile();
  }
  boyut(size: number): void {
    this.pageSize = size;
    this.filtrele();
  }
  sec(id: number, checked: boolean): void {
    this.secilenler.update((old) => {
      const next = new Set(old);
      checked ? next.add(id) : next.delete(id);
      return next;
    });
  }
  topluSiparis(): void {
    if (this.secilenler().size) this.siparisAc.emit([...this.secilenler()]);
  }
  private date(value: Date): string {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
}
