import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subject, debounceTime, distinctUntilChanged, finalize, switchMap } from 'rxjs';
import { finansAltSekmeAcik, finansPoGirilebilir } from '../ortak/finans-izinleri';
import { FinansService } from '../../../core/services/finans.service';
import { FinansParaBirimiService } from '../../../core/services/finans-para-birimi.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ToastService } from '../../../core/services/toast.service';
import { TranslationService } from '../../../core/services/translation.service';
import { ServerPagerComponent } from '../../../shared/components/server-pager/server-pager.component';
import { ApiResult } from '../../../shared/models/common.model';
import { FinansIsKaydi, FinansListelemeRequest, FinansSayfaliSonuc } from '../../../shared/models/finans.model';
import { FinansBekleyen, FinansBekleyenAsama, FinansVarlikTuru } from '../../../shared/models/finans-v2.model';
import { kategoriAnahtari } from '../ortak/finans-etiketleri';
import { FinansAramaProjeGrubu, FinansAramaSandikGrubu, aramaProjeGruplari, sarfKaydi } from '../ortak/finans-kirilim';
import { FinansProjeSeciciComponent } from '../finans-proje-secici/finans-proje-secici.component';

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
  imports: [FormsModule, DatePipe, DecimalPipe, ServerPagerComponent, FinansProjeSeciciComponent],
  templateUrl: './finans-kayit-arama.component.html',
  styleUrl: '../ortak/finans-v2.scss',
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
  readonly acilis = input<FinansKayitAramaAcilisi>({ anahtar: 0, gorunum: 'arama' });
  readonly kayitAc = output<{ tur: FinansVarlikTuru; id: number }>();
  readonly siparisAc = output<number[]>();

  readonly gorunum = signal<FinansKayitAramaGorunumu>('arama');
  readonly asama = signal<FinansBekleyenAsama | ''>('');
  readonly loading = signal(false);
  readonly sonuclar = signal<FinansSayfaliSonuc<FinansIsKaydi> | null>(null);
  readonly bekleyenler = signal<FinansSayfaliSonuc<FinansBekleyen> | null>(null);
  readonly secilenler = signal(new Set<number>());
  /** Bekleyen işler (yaşlandırma): Kontrol Paneli, İş Takibi veya Raporlar sekmesinden biri. */
  /** Görünümler İş Takibi alt sekmeleridir: "Tüm dönemlerde ara" ve "Bekleyen işler" kendi R izinleriyle açılır. */
  readonly aramaGorunur = computed(() => finansAltSekmeAcik(this.permissions, 'arama'));
  readonly bekleyenGorunur = computed(() => finansAltSekmeAcik(this.permissions, 'bekleyen'));
  readonly pager = computed(() => (this.gorunum() === 'arama' ? this.sonuclar() : this.bekleyenler()));
  readonly kategoriAnahtari = kategoriAnahtari;
  readonly sarfKaydi = sarfKaydi;
  /**
   * Sonuçlar proje → sandık başlıklarında, alt toplamlarla. Proje ve sandık no filtreleri sunucuda uygulanır;
   * böylece seçilen projenin/sandığın bütün kalemleri gelir (sayfa yalnız sayfa boyutunu sınırlar).
   */
  readonly projeGruplari = computed<FinansAramaProjeGrubu[]>(() => aramaProjeGruplari(this.sonuclar()?.items ?? []));
  readonly acikProjeler = signal(new Set<string>());
  projeAcik(anahtar: string): boolean {
    return this.acikProjeler().has(anahtar);
  }
  projeAcKapat(anahtar: string): void {
    this.acikProjeler.update((x) => {
      const y = new Set(x);
      if (y.has(anahtar)) y.delete(anahtar);
      else y.add(anahtar);
      return y;
    });
  }
  tumunuAcKapat(): void {
    const hepsi = this.projeGruplari().map((g) => g.anahtar);
    this.acikProjeler.set(hepsi.every((p) => this.acikProjeler().has(p)) ? new Set() : new Set(hepsi));
  }
  tumuAcik(): boolean {
    const gruplar = this.projeGruplari();
    return gruplar.length > 0 && gruplar.every((g) => this.acikProjeler().has(g.anahtar));
  }
  /** Proje veya sandık başlığındaki seçim o başlığın bu sayfadaki bütün kalemlerini PO için seçer/bırakır. */
  projeSecili(grup: FinansAramaProjeGrubu | FinansAramaSandikGrubu): boolean {
    return grup.kalemler.every((k) => this.secilenler().has(k.id));
  }
  projeSec(grup: FinansAramaProjeGrubu | FinansAramaSandikGrubu, checked: boolean): void {
    this.secilenler.update((old) => {
      const next = new Set(old);
      for (const k of grup.kalemler) {
        if (checked) next.add(k.id);
        else next.delete(k.id);
      }
      return next;
    });
  }
  /** Proje filtresi (finans proje seçici) ve sandık no; ikisi de sunucuda uygulanır. */
  projeFiltresi: { projeId: number; projeNo: string; musteri: string } | null = null;
  sandikNo = '';
  arama = '';
  para = '';
  isTuru = '';
  durum = '';
  minimumGun = 15;
  pageNumber = 1;
  pageSize = 100;
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

  constructor() {
    // Açık görünümün alt sekme izni kaldırılırsa okunabilen diğer görünüme geçilir.
    effect(() => {
      const gorunum = this.gorunum();
      const diger: FinansKayitAramaGorunumu = gorunum === 'arama' ? 'bekleyen' : 'arama';
      if (!this.gorunumAcik(gorunum) && this.gorunumAcik(diger)) untracked(() => this.gorunumSec(diger));
    });
  }

  /** Görünümün alt sekme izni. */
  gorunumAcik(gorunum: FinansKayitAramaGorunumu): boolean {
    return gorunum === 'arama' ? this.aramaGorunur() : this.bekleyenGorunur();
  }

  ngOnInit(): void {
    this.paraBirimleri.yukle();
    const acilis = this.acilis();
    // Açılış: istenen görünüm okunabiliyorsa o, değilse okunabilen diğeri.
    const diger: FinansKayitAramaGorunumu = acilis.gorunum === 'arama' ? 'bekleyen' : 'arama';
    this.gorunum.set(this.gorunumAcik(acilis.gorunum) || !this.gorunumAcik(diger) ? acilis.gorunum : diger);
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
            projeId: this.projeFiltresi?.projeId,
            sandikNo: this.sandikNo.trim() || undefined,
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
        if (this.gorunum() === 'arama') {
          this.sonuclar.set(r.value as FinansSayfaliSonuc<FinansIsKaydi>);
          // Proje veya sandık süzülmüşse başlıklar açık gelir; kullanıcı aradığı sandığı hemen görür.
          if (this.projeFiltresi || this.sandikNo.trim())
            this.acikProjeler.set(new Set(this.projeGruplari().map((g) => g.anahtar)));
        } else this.bekleyenler.set(r.value as FinansSayfaliSonuc<FinansBekleyen>);
      });
    this.refresh.next();
  }

  /** PO açma / seçili kalemlerle PO: PO/Fatura, İş Takibi veya Münferit İşler sekmesinin W izni. */
  poGirilebilir(): boolean {
    return finansPoGirilebilir(this.permissions);
  }
  gorunumSec(value: FinansKayitAramaGorunumu): void {
    if (value === this.gorunum() || !this.gorunumAcik(value)) return;
    this.gorunum.set(value);
    if (value === 'arama') this.asama.set('');
    this.filtrele();
  }
  /** Etkin filtre sayısı; "Filtreleri temizle" yalnız filtre varken gösterilir. */
  etkinFiltre(): number {
    return [this.arama.trim(), this.para, this.isTuru, this.durum, this.gorunum() === 'bekleyen' ? this.asama() : '',
      this.projeFiltresi ? 'proje' : '', this.sandikNo.trim()]
      .filter(Boolean).length;
  }
  projeSecildi(proje: { projeId: number; projeNo: string; musteri: string } | null): void {
    this.projeFiltresi = proje;
    this.filtrele();
  }
  sandikNoDegisti(): void {
    this.search.next('sandik:' + this.sandikNo);
  }
  filtreleriTemizle(): void {
    this.projeFiltresi = null;
    this.sandikNo = '';
    this.arama = '';
    this.para = '';
    this.isTuru = '';
    this.durum = '';
    this.asama.set('');
    this.minimumGun = 15;
    this.filtrele();
  }
  aramaDegisti(): void {
    this.search.next('arama:' + this.arama);
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
