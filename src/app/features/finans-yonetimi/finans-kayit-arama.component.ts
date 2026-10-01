import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subject, debounceTime, distinctUntilChanged, finalize, switchMap } from 'rxjs';
import { FINANS_YETKI } from '../../core/constants/yetki-kodlari';
import { FinansService } from '../../core/services/finans.service';
import { FinansParaBirimiService } from '../../core/services/finans-para-birimi.service';
import { PermissionService } from '../../core/services/permission.service';
import { ToastService } from '../../core/services/toast.service';
import { TranslationService } from '../../core/services/translation.service';
import { ServerPagerComponent } from '../../shared/components/server-pager/server-pager.component';
import { ApiResult } from '../../shared/models/common.model';
import { FinansIsKaydi, FinansListelemeRequest, FinansSayfaliSonuc } from '../../shared/models/finans.model';
import { FinansBekleyen, FinansBekleyenAsama, FinansVarlikTuru } from '../../shared/models/finans-v2.model';

export type FinansKayitAramaGorunumu = 'arama' | 'bekleyen';

/** Açılış durumu: görünüm ve (bekleyen işler için) panel kovasından gelen aşama/eşik. */
export interface FinansKayitAramaAcilisi {
  anahtar: number;
  gorunum: FinansKayitAramaGorunumu;
  asama?: FinansBekleyenAsama | '';
  minimumGun?: number;
}

/**
 * Finans İş Takibi içinde sandık/kalem bazlı liste: bütün dönemlerde arama ve sipariş/fatura bekleyen işler.
 * Kontrol paneli yalnız genel özeti gösterir; kalem listesi burada tutulur.
 */
@Component({
  selector: 'app-finans-kayit-arama',
  standalone: true,
  imports: [FormsModule, DatePipe, DecimalPipe, ServerPagerComponent],
  templateUrl: './finans-kayit-arama.component.html',
  styleUrls: ['./finans-v2.scss', './finans-panel.component.scss'],
})
export class FinansKayitAramaComponent implements OnInit {
  private readonly translation = inject(TranslationService);
  t(key: string): string {
    return this.translation.translate(`FINANS_V2.${key}`);
  }
  private readonly service = inject(FinansService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);
  readonly permissions = inject(PermissionService);
  readonly paraBirimleri = inject(FinansParaBirimiService);
  readonly izin = FINANS_YETKI;
  readonly acilis = input<FinansKayitAramaAcilisi>({ anahtar: 0, gorunum: 'arama' });
  readonly kayitAc = output<{ tur: FinansVarlikTuru; id: number }>();
  readonly siparisAc = output<number[]>();

  readonly gorunum = signal<FinansKayitAramaGorunumu>('arama');
  readonly asama = signal<FinansBekleyenAsama | ''>('');
  readonly loading = signal(false);
  readonly sonuclar = signal<FinansSayfaliSonuc<FinansIsKaydi> | null>(null);
  readonly bekleyenler = signal<FinansSayfaliSonuc<FinansBekleyen> | null>(null);
  readonly secilenler = signal(new Set<number>());
  readonly bekleyenGorunur = computed(() => this.permissions.hasAccess(FINANS_YETKI.RaporGoruntule));
  readonly pager = computed(() => (this.gorunum() === 'arama' ? this.sonuclar() : this.bekleyenler()));
  arama = '';
  para = '';
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
  private readonly refresh = new Subject<void>();
  private readonly search = new Subject<string>();

  ngOnInit(): void {
    this.paraBirimleri.yukle();
    const acilis = this.acilis();
    this.gorunum.set(acilis.gorunum === 'bekleyen' && this.bekleyenGorunur() ? 'bekleyen' : 'arama');
    this.asama.set(acilis.asama ?? '');
    if (acilis.minimumGun) this.minimumGun = acilis.minimumGun;
    this.search
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.filtrele());
    this.refresh
      .pipe(
        switchMap(() => {
          this.loading.set(true);
          const request: FinansListelemeRequest = {
            pageNumber: this.pageNumber,
            pageSize: this.pageSize,
            arama: this.arama.trim() || undefined,
            paraBirimi: this.para || undefined,
            isTuru: this.isTuru ? Number(this.isTuru) : undefined,
            durum: this.durum ? Number(this.durum) : undefined,
          };
          const istek: Observable<ApiResult<FinansSayfaliSonuc<FinansIsKaydi | FinansBekleyen>>> =
            this.gorunum() === 'arama'
              ? this.service.genelArama(request)
              : this.service.yaslandirma(request, this.bugun(), this.minimumGun, this.asama() || undefined);
          return istek.pipe(finalize(() => this.loading.set(false)));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((r) => {
        if (!r.isSuccess) {
          this.toast.error(r.error ?? this.t('LIST_LOAD_ERROR'));
          return;
        }
        if (this.gorunum() === 'arama') this.sonuclar.set(r.value as FinansSayfaliSonuc<FinansIsKaydi>);
        else this.bekleyenler.set(r.value as FinansSayfaliSonuc<FinansBekleyen>);
      });
    this.refresh.next();
  }

  parasal(alan: string): boolean {
    return this.permissions.hasAccess(FINANS_YETKI.ParasalVeriGoruntule) && this.permissions.hasAccess(alan);
  }
  gorunumSec(value: FinansKayitAramaGorunumu): void {
    if (value === this.gorunum() || (value === 'bekleyen' && !this.bekleyenGorunur())) return;
    this.gorunum.set(value);
    if (value === 'arama') this.asama.set('');
    this.filtrele();
  }
  /** Etkin filtre sayısı; "Filtreleri temizle" yalnız filtre varken gösterilir. */
  etkinFiltre(): number {
    return [this.arama.trim(), this.para, this.isTuru, this.durum, this.gorunum() === 'bekleyen' ? this.asama() : '']
      .filter(Boolean).length;
  }
  filtreleriTemizle(): void {
    this.arama = '';
    this.para = '';
    this.isTuru = '';
    this.durum = '';
    this.asama.set('');
    this.minimumGun = 15;
    this.filtrele();
  }
  aramaDegisti(): void {
    this.search.next(this.arama);
  }
  filtrele(): void {
    this.pageNumber = 1;
    this.secilenler.set(new Set());
    this.refresh.next();
  }
  sayfa(page: number): void {
    this.pageNumber = page;
    this.refresh.next();
  }
  boyut(size: number): void {
    this.pageSize = size;
    this.filtrele();
  }
  sec(id: number, checked: boolean): void {
    this.secilenler.update((old) => {
      const next = new Set(old);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }
  topluSiparis(): void {
    if (this.secilenler().size) this.siparisAc.emit([...this.secilenler()]);
  }
  private bugun(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
