import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, finalize, switchMap } from 'rxjs';
import { ConfirmService } from '../../../core/services/confirm.service';
import { FinansService } from '../../../core/services/finans.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ToastService } from '../../../core/services/toast.service';
import { TranslationService } from '../../../core/services/translation.service';
import { IslemlerMenusuComponent } from '../../../shared/components/islemler-menusu/islemler-menusu.component';
import { ServerPagerComponent } from '../../../shared/components/server-pager/server-pager.component';
import { onayaAlindi } from '../../../shared/models/common.model';
import {
  FinansIsKaydi,
  FinansMunferitIsKaydetRequest,
  FinansSayfaliSonuc,
  FinansUrunSecenegi,
} from '../../../shared/models/finans.model';
import { FinansVarlikTuru } from '../../../shared/models/finans-v2.model';
import { FinansProjeSeciciComponent } from '../finans-proje-secici/finans-proje-secici.component';
import { finansHacimBilesik, finansHacimGecerli } from '../ortak/finans-hacim';
import { finansIsDuzenlenebilir, finansPoGirilebilir, finansSekmeYazilabilir } from '../ortak/finans-izinleri';

/** Münferit iş formu: proje sistemden seçilir ya da serbest ad yazılır; miktar tarifenin birimine göredir. */
interface MunferitIsFormu {
  projeKaynagi: 'sistem' | 'serbest';
  projeId: number | null;
  projeAdi: string;
  isTarihi: string;
  adet: number;
  ahsapM3: number | null;
  kontraM3: number | null;
}

/**
 * Münferit İşler sekmesi: elle açılmış tek seferlik işlerin listesi ve yeni iş formu. Form yalnız tarife (İş ve Tarife
 * Tanımları), proje ve tarih ister; iş adı tarifenin adıdır ve fiyat tarifenin iş tarihindeki sürümünden otomatik gelir.
 */
@Component({
  selector: 'app-finans-munferit-isler',
  standalone: true,
  imports: [FormsModule, DatePipe, DecimalPipe, ServerPagerComponent, IslemlerMenusuComponent, FinansProjeSeciciComponent],
  templateUrl: './finans-munferit-isler.component.html',
  styleUrl: '../ortak/finans-v2.scss',
})
export class FinansMunferitIslerComponent implements OnInit {
  private readonly translation = inject(TranslationService);
  t(key: string): string {
    return this.translation.translate(`FINANS_V2.${key}`);
  }
  private readonly service = inject(FinansService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  readonly permissions = inject(PermissionService);
  readonly kayitAc = output<{ tur: FinansVarlikTuru; id: number }>();
  readonly siparisAc = output<number[]>();

  readonly hacimBilesik = finansHacimBilesik;

  /** Münferit iş tarifeden fiyatlanır: Münferit İşler sekmesinin W izni yeter. */
  readonly ekleyebilir = computed(() => finansSekmeYazilabilir(this.permissions, 'munferit'));
  /** İptal/geri alma: İş Takibi veya Münferit İşler sekmesinin W izni (iş kaydı düzenleme). */
  readonly iptalEdebilir = computed(() => finansIsDuzenlenebilir(this.permissions));
  readonly poAcabilir = computed(() => finansPoGirilebilir(this.permissions));

  // Liste
  baslangic = '';
  bitis = '';
  arama = '';
  iptalleriGoster = false;
  pageNumber = 1;
  pageSize = 25;
  readonly loading = signal(false);
  readonly sonuc = signal<FinansSayfaliSonuc<FinansIsKaydi> | null>(null);
  private readonly listeIstekleri = new Subject<void>();
  private readonly aramaIstekleri = new Subject<string>();

  // Form
  readonly formAcik = signal(false);
  readonly kaydediliyor = signal(false);
  readonly hata = signal('');
  form: MunferitIsFormu = this.bosForm();
  projeEtiketi = '';
  urunArama = '';
  readonly secilenUrun = signal<FinansUrunSecenegi | null>(null);
  readonly urunSecenekleri = signal<FinansUrunSecenegi[]>([]);
  readonly seceneklerYukleniyor = signal(false);
  readonly secenekHatasi = signal('');
  private readonly secenekIstekleri = new Subject<{ arama: string; tarih: string }>();

  ngOnInit(): void {
    const bugun = new Date();
    this.baslangic = this.tarihMetni(new Date(bugun.getFullYear(), bugun.getMonth(), 1));
    this.bitis = this.tarihMetni(new Date(bugun.getFullYear(), bugun.getMonth() + 1, 0));
    this.listeIstekleri
      .pipe(
        switchMap(() => {
          this.loading.set(true);
          return this.service
            .munferitIsler({
              pageNumber: this.pageNumber,
              pageSize: this.pageSize,
              baslangic: this.baslangic || undefined,
              bitis: this.bitis || undefined,
              arama: this.arama.trim() || undefined,
              iptalEdilenleriDahilEt: this.iptalleriGoster,
            })
            .pipe(finalize(() => this.loading.set(false)));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((r) => {
        if (r.isSuccess) this.sonuc.set(r.value ?? null);
        else this.toast.error(r.error ?? this.t('LIST_LOAD_ERROR'));
      });
    this.aramaIstekleri
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.filtrele());
    // Tarife seçenekleri iş tarihindeki fiyatla gelir; yükleme hatası sessizce boş listeye dönmez, formda gösterilir.
    this.secenekIstekleri
      .pipe(
        debounceTime(200),
        switchMap(({ arama, tarih }) => {
          this.seceneklerYukleniyor.set(true);
          return this.service.urunSecenekleri(arama, undefined, tarih).pipe(finalize(() => this.seceneklerYukleniyor.set(false)));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((r) => {
        if (!r.isSuccess) {
          this.urunSecenekleri.set([]);
          this.secenekHatasi.set(r.error ?? this.t('ADHOC_OPTIONS_ERROR'));
          return;
        }
        this.secenekHatasi.set('');
        const liste = r.value ?? [];
        this.urunSecenekleri.set(liste);
        // Tarih değişince seçili tarifenin fiyatı yeni tarihe göre yenilenir.
        const secili = this.secilenUrun();
        if (secili) this.secilenUrun.set(liste.find((x) => x.id === secili.id) ?? secili);
      });
    this.listeIstekleri.next();
  }

  filtrele(): void {
    this.pageNumber = 1;
    this.listeIstekleri.next();
  }
  aramaDegisti(): void {
    this.aramaIstekleri.next(this.arama);
  }
  sayfa(page: number): void {
    this.pageNumber = page;
    this.listeIstekleri.next();
  }
  boyut(size: number): void {
    this.pageSize = size;
    this.filtrele();
  }

  yeniAc(): void {
    if (!this.ekleyebilir()) return;
    this.form = this.bosForm();
    this.projeEtiketi = '';
    this.urunArama = '';
    this.secilenUrun.set(null);
    this.hata.set('');
    this.formAcik.set(true);
    this.secenekleriYukle();
  }
  /** Tarife listesini arama metni ve iş tarihiyle (fiyat o tarihe göre) yeniden okur. */
  secenekleriYukle(): void {
    this.secenekIstekleri.next({ arama: this.urunArama.trim(), tarih: this.form.isTarihi });
  }
  urunSecId(id: number | null): void {
    this.urunSec(this.urunSecenekleri().find((x) => x.id === id) ?? null);
  }
  urunSec(urun: FinansUrunSecenegi | null): void {
    this.secilenUrun.set(urun);
    if (urun && !this.m3Urun()) {
      this.form.ahsapM3 = null;
      this.form.kontraM3 = null;
    }
  }
  projeKaynagiSec(kaynak: 'sistem' | 'serbest'): void {
    this.form.projeKaynagi = kaynak;
    this.form.projeId = null;
    this.form.projeAdi = '';
    this.projeEtiketi = '';
  }
  projeSec(proje: { projeId: number; projeNo: string; musteri: string } | null): void {
    this.form.projeId = proje?.projeId ?? null;
    this.projeEtiketi = proje ? `${proje.projeNo} · ${proje.musteri}` : '';
  }
  /** Tarife seçeneğinin etiketi: kod · ad ve iş tarihindeki fiyat ya da "tarife yok". */
  secenekEtiketi(urun: FinansUrunSecenegi): string {
    const ad = `${urun.kod} · ${urun.ad}`;
    if (urun.birimFiyat == null) return `${ad} — ${this.t('ADHOC_NO_TARIFF_SHORT')}`;
    const birim = urun.fiyatlandirmaBirimi === 2 ? '/m³' : urun.fiyatlandirmaBirimi === 1 ? `/${this.t('ADHOC_PIECE')}` : '';
    const fiyat = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(urun.birimFiyat);
    return `${ad} — ${fiyat} ${urun.paraBirimi ?? ''}${birim}`;
  }
  /** Seçilen tarife m³ ile fiyatlanıyor mu (birim 2): ahşap/kontra m³ zorunludur. */
  m3Urun(): boolean {
    return this.secilenUrun()?.fiyatlandirmaBirimi === 2;
  }
  /** Seçilen tarife adetle fiyatlanıyor mu (birim 1): adet girilir; sabit tutarda miktar sorulmaz. */
  adetUrun(): boolean {
    return this.secilenUrun()?.fiyatlandirmaBirimi === 1;
  }
  /** Seçilen tarifenin iş tarihinde fiyatı yok. */
  tarifesizTarih(): boolean {
    const urun = this.secilenUrun();
    return !!urun && urun.birimFiyat == null;
  }
  /** Önizleme tutarı: tarife fiyatı × fiyatlandırma miktarı (adet, bileşik m³ ya da sabit tutar için 1). */
  onizlemeTutari(): number | null {
    const urun = this.secilenUrun();
    if (!urun || urun.birimFiyat == null) return null;
    const miktar = urun.fiyatlandirmaBirimi === 1
      ? Number(this.form.adet) || 0
      : urun.fiyatlandirmaBirimi === 2 ? finansHacimBilesik(this.form.ahsapM3, this.form.kontraM3) : 1;
    return Math.round(urun.birimFiyat * miktar * 100) / 100;
  }

  kaydet(): void {
    const urun = this.secilenUrun();
    const f = this.form;
    if (!urun) return this.hata.set(this.t('ADHOC_PRODUCT_REQUIRED'));
    const projeAdi = f.projeAdi.trim();
    if (f.projeKaynagi === 'sistem' ? !f.projeId : !projeAdi) return this.hata.set(this.t('ADHOC_PROJECT_REQUIRED'));
    if (!f.isTarihi) return this.hata.set(this.t('ADHOC_DATE_REQUIRED'));
    if (this.adetUrun() && !(Number(f.adet) > 0)) return this.hata.set(this.t('ADHOC_QUANTITY_REQUIRED'));
    if (this.m3Urun() && !finansHacimGecerli(f.ahsapM3, f.kontraM3)) return this.hata.set(this.t('ADHOC_M3_REQUIRED'));
    if (this.tarifesizTarih()) return this.hata.set(this.t('ADHOC_NO_TARIFF_ON_DATE'));
    const istek: FinansMunferitIsKaydetRequest = {
      finansUrunId: urun.id,
      projeId: f.projeKaynagi === 'sistem' ? f.projeId : null,
      projeAdi: f.projeKaynagi === 'serbest' ? projeAdi : null,
      isTarihi: f.isTarihi,
      adet: this.adetUrun() ? Number(f.adet) : 1,
      ahsapM3: this.m3Urun() ? Number(f.ahsapM3) || 0 : null,
      kontraM3: this.m3Urun() ? Number(f.kontraM3) || 0 : null,
    };
    this.hata.set('');
    this.kaydediliyor.set(true);
    this.service
      .munferitIsOlustur(istek)
      .pipe(finalize(() => this.kaydediliyor.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe((r) => {
        if (onayaAlindi(r)) {
          this.toast.info(this.t('APPROVAL_PENDING'));
          this.formAcik.set(false);
          return;
        }
        if (!r.isSuccess) return this.hata.set(r.error ?? this.t('ADHOC_SAVE_ERROR'));
        this.toast.success(this.t('ADHOC_SAVED'));
        this.formAcik.set(false);
        this.listeIstekleri.next();
      });
  }

  async iptal(kayit: FinansIsKaydi): Promise<void> {
    if (!this.iptalEdebilir()) return;
    const aciklama = await this.confirm.askWithReason({
      title: this.t('ADHOC_CANCEL_TITLE'),
      message: this.t('ADHOC_CANCEL_MESSAGE'),
      type: 'warning',
      reason: { label: this.t('ADHOC_CANCEL_REASON') },
    });
    if (!aciklama) {
      if (aciklama === '') this.toast.error(this.t('ADHOC_CANCEL_REASON_REQUIRED'));
      return;
    }
    this.service.ozelIsIptal(kayit.id, aciklama).subscribe((r) => this.sonucuBildir(r, 'ADHOC_CANCELLED'));
  }
  geriAl(kayit: FinansIsKaydi): void {
    if (!this.iptalEdebilir()) return;
    this.service.ozelIsGeriAl(kayit.id).subscribe((r) => this.sonucuBildir(r, 'ADHOC_RESTORED'));
  }
  poAc(kayit: FinansIsKaydi): void {
    if (this.poAcabilir()) this.siparisAc.emit([kayit.id]);
  }

  private sonucuBildir(r: { isSuccess: boolean; error?: string; statusCode?: number }, basari: string): void {
    if (onayaAlindi(r)) {
      this.toast.info(this.t('APPROVAL_PENDING'));
      return;
    }
    if (!r.isSuccess) {
      this.toast.error(r.error ?? this.t('ADHOC_SAVE_ERROR'));
      return;
    }
    this.toast.success(this.t(basari));
    this.listeIstekleri.next();
  }
  private bosForm(): MunferitIsFormu {
    return {
      projeKaynagi: 'sistem', projeId: null, projeAdi: '', isTarihi: this.tarihMetni(new Date()), adet: 1, ahsapM3: null, kontraM3: null,
    };
  }
  private tarihMetni(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
