import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, finalize, switchMap } from 'rxjs';
import { FINANS_YETKI } from '../../../core/constants/yetki-kodlari';
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
import { finansMunferitIsEklenebilir, finansPoGirilebilir } from '../ortak/finans-izinleri';

interface MunferitIsFormu {
  isAdi: string;
  ozelIsTuru: string;
  musteri: string;
  projeId: number | null;
  adet: number;
  birim: string;
  isTarihi: string;
  ahsapM3: number | null;
  kontraM3: number | null;
  aciklama: string;
  talepEdenKisi: string;
  talepEdenBolum: string;
}

/**
 * Münferit İşler sekmesi (iskelet): elle açılmış tek seferlik işlerin listesi ve tarifeden fiyatlanan yeni iş
 * formu. Fiyat yazılmaz; kayıt seçilen iş/ürün tanımının iş tarihindeki tarifesiyle fiyatlanır.
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
  readonly izin = FINANS_YETKI;
  readonly kayitAc = output<{ tur: FinansVarlikTuru; id: number }>();
  readonly siparisAc = output<number[]>();

  /** Eski "Tek Seferlik İş" formuyla aynı iş türü önerileri. */
  readonly turSecenekleri = ['Haliade-X', 'SKIT', 'Diğer'];
  readonly hacimBilesik = finansHacimBilesik;

  readonly ekleyebilir = computed(() => finansMunferitIsEklenebilir(this.permissions));
  readonly iptalEdebilir = computed(() => this.permissions.canWrite(FINANS_YETKI.IsIptal));
  readonly poAcabilir = computed(() => finansPoGirilebilir(this.permissions));
  readonly tutarGorunur = computed(() => this.parasal(FINANS_YETKI.TutarGoruntule));
  /** Fiyat önizlemesi tarife listesinden okunur; yalnız tarifeleri ve birim fiyatı görebilen kullanıcıya. */
  readonly fiyatOnizlemeGorunur = computed(
    () =>
      this.parasal(FINANS_YETKI.BirimFiyatGoruntule) &&
      this.permissions.hasAccess(FINANS_YETKI.SekmeTanimlar) &&
      this.permissions.hasAccess(FINANS_YETKI.IsKutuphanesiYonet),
  );

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
  readonly fiyatOnizleme = signal<{ birimFiyat: number; paraBirimi: string } | null>(null);
  private readonly urunAramalari = new Subject<string>();

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
    this.urunAramalari
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((arama) => this.service.urunSecenekleri(arama)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((r) => this.urunSecenekleri.set(r.isSuccess ? (r.value ?? []) : []));
    this.listeIstekleri.next();
  }

  parasal(alan: string): boolean {
    return this.permissions.hasAccess(FINANS_YETKI.ParasalVeriGoruntule) && this.permissions.hasAccess(alan);
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
    this.fiyatOnizleme.set(null);
    this.hata.set('');
    this.formAcik.set(true);
    this.urunAramalari.next('');
  }
  urunAramaDegisti(): void {
    this.urunAramalari.next(this.urunArama.trim());
  }
  urunSec(urun: FinansUrunSecenegi | null): void {
    this.secilenUrun.set(urun);
    if (urun && !this.m3Urun()) {
      this.form.ahsapM3 = null;
      this.form.kontraM3 = null;
    }
    this.fiyatOnizlemeYukle();
  }
  projeSec(proje: { projeId: number; projeNo: string; musteri: string } | null): void {
    this.form.projeId = proje?.projeId ?? null;
    this.projeEtiketi = proje ? `${proje.projeNo} · ${proje.musteri}` : '';
    if (proje?.musteri) this.form.musteri = proje.musteri;
  }
  /** Seçilen ürün m³ ile fiyatlanıyor mu (fiyatlandırma birimi 2): ahşap/kontra m³ zorunludur. */
  m3Urun(): boolean {
    return this.secilenUrun()?.fiyatlandirmaBirimi === 2;
  }
  /** İş tarihindeki tarife fiyatı (yalnız tarifeleri görebilen kullanıcıya); tarih değişince yeniden okunur. */
  fiyatOnizlemeYukle(): void {
    this.fiyatOnizleme.set(null);
    const urun = this.secilenUrun();
    if (!urun || !this.fiyatOnizlemeGorunur() || !this.form.isTarihi) return;
    this.service
      .urunler({ pageNumber: 1, pageSize: 10, sadeceAktif: true, arama: urun.kod, tarifeTarihi: this.form.isTarihi })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((r) => {
        const bulunan = r.isSuccess ? r.value?.items.find((x) => x.id === urun.id) : undefined;
        if (bulunan?.guncelBirimFiyat != null)
          this.fiyatOnizleme.set({ birimFiyat: bulunan.guncelBirimFiyat, paraBirimi: bulunan.guncelParaBirimi ?? '' });
      });
  }
  /** Önizleme tutarı: birim fiyat × fiyatlandırma miktarı (adet, bileşik m³ ya da sabit/toplam için 1). */
  onizlemeTutari(): number | null {
    const fiyat = this.fiyatOnizleme();
    const urun = this.secilenUrun();
    if (!fiyat || !urun) return null;
    const miktar = urun.fiyatlandirmaBirimi === 1
      ? Number(this.form.adet) || 0
      : urun.fiyatlandirmaBirimi === 2 ? finansHacimBilesik(this.form.ahsapM3, this.form.kontraM3) : 1;
    return Math.round(fiyat.birimFiyat * miktar * 100) / 100;
  }

  kaydet(): void {
    const urun = this.secilenUrun();
    const f = this.form;
    if (!urun) return this.hata.set(this.t('ADHOC_PRODUCT_REQUIRED'));
    if (!f.isAdi.trim() || !f.musteri.trim() || !f.birim.trim() || !f.isTarihi || !(Number(f.adet) > 0))
      return this.hata.set(this.t('ADHOC_REQUIRED_FIELDS'));
    if (this.m3Urun() && !finansHacimGecerli(f.ahsapM3, f.kontraM3)) return this.hata.set(this.t('ADHOC_M3_REQUIRED'));
    const istek: FinansMunferitIsKaydetRequest = {
      finansUrunId: urun.id,
      isAdi: f.isAdi.trim(),
      ozelIsTuru: f.ozelIsTuru.trim() || null,
      musteri: f.musteri.trim(),
      projeId: f.projeId,
      adet: Number(f.adet),
      birim: f.birim.trim(),
      isTarihi: f.isTarihi,
      ahsapM3: this.m3Urun() ? Number(f.ahsapM3) || 0 : null,
      kontraM3: this.m3Urun() ? Number(f.kontraM3) || 0 : null,
      aciklama: f.aciklama.trim() || null,
      talepEdenKisi: f.talepEdenKisi.trim() || null,
      talepEdenBolum: f.talepEdenBolum.trim() || null,
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
      isAdi: '', ozelIsTuru: '', musteri: 'GE Vernova', projeId: null, adet: 1, birim: 'Adet',
      isTarihi: this.tarihMetni(new Date()), ahsapM3: null, kontraM3: null, aciklama: '', talepEdenKisi: '', talepEdenBolum: '',
    };
  }
  private tarihMetni(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
