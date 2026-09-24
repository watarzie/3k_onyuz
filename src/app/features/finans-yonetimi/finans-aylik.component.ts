import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { EMPTY, Subject, debounceTime, distinctUntilChanged, finalize, forkJoin, of, switchMap } from 'rxjs';
import { AmbalajService } from '../../core/services/ambalaj.service';
import { FinansService } from '../../core/services/finans.service';
import { ToastService } from '../../core/services/toast.service';
import { PermissionService } from '../../core/services/permission.service';
import { AMBALAJ_YETKI, FINANS_YETKI } from '../../core/constants/yetki-kodlari';
import { FinansPanelComponent } from './finans-panel.component';
import { FinansDagitimComponent } from './finans-dagitim.component';
import { FinansKayitDetayComponent } from './finans-kayit-detay.component';
import { FinansBelgelerListesiComponent } from './finans-belgeler-listesi.component';
import { FinansSablonlarComponent } from './finans-sablonlar.component';
import { FinansRaporlarComponent } from './finans-raporlar.component';
import { FinansKategorilerComponent } from './finans-kategoriler.component';
import { FinansProjeSeciciComponent } from './finans-proje-secici.component';
import { FinansVarlikTuru } from '../../shared/models/finans-v2.model';
import { ApiResult } from '../../shared/models/common.model';
import { CanWriteDirective } from '../../shared/directives/can-write.directive';
import { CanAccessDirective } from '../../shared/directives/can-access.directive';
import { BreadcrumbComponent } from '../../shared/components/breadcrumb/breadcrumb.component';
import { ServerPagerComponent } from '../../shared/components/server-pager/server-pager.component';
import {
  FinansAylikIs,
  FinansAylikFinansOzeti,
  FinansAylikGrupToplami,
  FinansDuzenliIs,
  FinansDuzenliIsKaydetRequest,
  FinansGider,
  FinansGiderKategori,
  FinansGiderKalemi,
  FinansGiderKaydetRequest,
  FinansOzelIsKaydetRequest,
  FinansUrun,
  FinansUrunKaydetRequest,
  FinansParaToplami,
  AmbalajIcSandikSablonDto,
} from '../../shared/models';

interface AylikGrup {
  ad: string;
  satirlar: FinansAylikIs[];
  eur: number;
  usd: number;
  try: number;
}

type AnaSekme = 'panel' | 'akis' | 'giderler' | 'ayarlar' | 'belgeler' | 'sablonlar' | 'raporlar' | 'kategoriler';
type AyarGorunumu = 'duzenli' | 'tarifeler';
type RaporFormati = 'pdf' | 'excel' | 'ayri';

@Component({
  selector: 'app-finans-yonetimi',
  standalone: true,
  imports: [BreadcrumbComponent, DatePipe, DecimalPipe, FormsModule, ServerPagerComponent,
    FinansPanelComponent, FinansDagitimComponent, FinansKayitDetayComponent, FinansBelgelerListesiComponent, FinansSablonlarComponent,
    CanWriteDirective, CanAccessDirective, FinansRaporlarComponent, FinansKategorilerComponent, FinansProjeSeciciComponent],
  templateUrl: './finans-aylik.component.html',
  styleUrl: './finans-aylik.component.scss',
})
export class FinansYonetimiComponent implements OnInit {
  private service = inject(FinansService);
  private ambalajService = inject(AmbalajService);
  private toast = inject(ToastService);
  private destroyRef = inject(DestroyRef);
  readonly permissions = inject(PermissionService);
  readonly izin = FINANS_YETKI;
  readonly alanIzni = AMBALAJ_YETKI;
  readonly detayHedef = signal<{tur: FinansVarlikTuru; id: number} | null>(null);
  readonly dagitim = signal<{tur: 'Siparis' | 'Fatura'; ids: number[]; siparisId: number | null} | null>(null);

  private readonly aylikListeIstekleri = new Subject<void>();
  private readonly aylikAramaIstekleri = new Subject<string>();
  private readonly giderListeIstekleri = new Subject<void>();
  private readonly giderAramaIstekleri = new Subject<string>();
  private readonly duzenliListeIstekleri = new Subject<void>();
  private readonly duzenliAramaIstekleri = new Subject<string>();
  private readonly urunListeIstekleri = new Subject<void>();
  private readonly urunAramaIstekleri = new Subject<string>();
  private giderlerYuklendi = false;
  private duzenliIslerYuklendi = false;
  private urunlerYuklendi = false;

  readonly finansMusterisi = 'GE Vernova';
  readonly breadcrumb = [{ label: 'Ana Kontrol Paneli', link: '/dashboard' }, { label: 'Finans ve Sipariş Takibi' }];
  readonly grupSirasi = ['Sabit İşler', 'Ana Ambalaj', 'Ekstra İşler'];
  readonly ozelIsGrubuSecenekleri = ['Haliade-X', 'SKIT', 'Diğer'];
  readonly birimler = ['Adet', 'm³', 'Ay', 'Sefer', 'Hizmet'];
  readonly sandikTipleri = ['Ahşap Kapalı', 'Kafes Sandık', 'Kontrplak Sandık', 'Katlanır Sandık'];
  readonly sayfaBoyutuSecenekleri = [25, 50, 100] as const;
  readonly isTuruSecenekleri = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(id => ({ id, ad: this.isTuruMetni(id) }));

  loading = signal(true);
  aylikLoading = signal(false);
  activeTab = signal<AnaSekme>('panel');
  ayarGorunumu = signal<AyarGorunumu>('duzenli');
  seciliDonem = signal(this.ayinIlkGunu(new Date()));
  aylikIsler = signal<FinansAylikIs[]>([]);
  aylikFinansOzeti = signal<FinansAylikFinansOzeti[]>([]);
  aylikGrupToplamlari = signal<FinansAylikGrupToplami[]>([]);
  giderler = signal<FinansGider[]>([]);
  giderLoading = signal(false);
  giderArama = signal('');
  giderToplamlari = signal<FinansParaToplami[]>([]);
  giderKategorileri = signal<FinansGiderKategori[]>([]);
  duzenliIsler = signal<FinansDuzenliIs[]>([]);
  duzenliLoading = signal(false);
  duzenliArama = signal('');
  urunler = signal<FinansUrun[]>([]);
  urunLoading = signal(false);
  icSandikSablonlari = signal<AmbalajIcSandikSablonDto[]>([]);
  arama = signal('');
  tarifeArama = signal('');
  iptalEdilenleriGoster = signal(false);
  acikGruplar = signal(new Set<string>(this.grupSirasi));

  aylikPageNumber = signal(1);
  aylikPageSize = signal(25);
  aylikTotalCount = signal(0);
  aylikTotalPages = signal(0);
  aylikHasPreviousPage = signal(false);
  aylikHasNextPage = signal(false);
  giderPageNumber = signal(1);
  giderPageSize = signal(25);
  giderTotalCount = signal(0);
  giderTotalPages = signal(0);
  giderHasPreviousPage = signal(false);
  giderHasNextPage = signal(false);
  duzenliPageNumber = signal(1);
  duzenliPageSize = signal(25);
  duzenliTotalCount = signal(0);
  duzenliTotalPages = signal(0);
  duzenliHasPreviousPage = signal(false);
  duzenliHasNextPage = signal(false);
  urunPageNumber = signal(1);
  urunPageSize = signal(25);
  urunTotalCount = signal(0);
  urunTotalPages = signal(0);
  urunHasPreviousPage = signal(false);
  urunHasNextPage = signal(false);

  raporAcik = signal(false);
  raporIndiriliyor = signal<RaporFormati | null>(null);
  raporSecimleri: Record<string, boolean> = {};
  siparisRaporIndiriliyor = signal<'pdf' | 'excel' | null>(null);
  siparisRaporTumDonemler = true;
  siparisRaporBaslangic = '';
  siparisRaporBitis = '';
  siparisRaporProjeNo = '';
  siparisRaporIsGrubu = '';
  siparisRaporDurum = '';

  aylikDegerAcik = signal(false);
  aylikDegerSatiri = signal<FinansAylikIs | null>(null);
  aylikDeger = 0;
  aylikDegerHatasi = signal('');
  aylikDegerKaydediliyor = signal(false);

  iptalAcik = signal(false);
  iptalSatiri = signal<FinansAylikIs | null>(null);
  iptalAciklamasi = '';
  iptalHatasi = signal('');
  iptalKaydediliyor = signal(false);

  ozelIsAcik = signal(false);
  ozelIsKaydediliyor = signal(false);
  ozelIsHatasi = signal('');
  ozelIsForm = this.bosOzelIsFormu();
  ozelRaporGrubu = 'Diğer';


  giderAcik = signal(false);
  giderKaydediliyor = signal(false);
  giderHatasi = signal('');
  giderRaporIndiriliyor = signal<'pdf' | 'excel' | null>(null);
  duzenlenenGiderId = signal<number | null>(null);
  giderForm = this.bosGiderFormu();
  giderKalemleri = signal<FinansGiderKalemi[]>([]);
  giderKalemLoading = signal(false);
  giderKalemHatasi = signal('');
  giderEskiKalem = signal<{ id: number; ad: string } | null>(null);
  giderEskiKategori = signal<{ id: number; ad: string } | null>(null);
  private giderKalemIstekSurumu = 0;
  giderProjeEtiketi = '';
  ozelProjeEtiketi = '';
  duzenliProjeEtiketi = '';

  duzenliIsAcik = signal(false);
  duzenliIsKaydediliyor = signal(false);
  duzenliIsHatasi = signal('');
  duzenlenenDuzenliIsId = signal<number | null>(null);
  duzenliIsForm = this.bosDuzenliIsFormu();

  urunAcik = signal(false);
  urunKaydediliyor = signal(false);
  urunSiliniyorId = signal<number | null>(null);
  urunHatasi = signal('');
  duzenlenenUrunId = signal<number | null>(null);
  urunForm = this.bosUrunFormu();

  donemBaslangici = computed(() => this.tarihMetni(this.seciliDonem()));
  donemBitisi = computed(() => {
    const tarih = this.seciliDonem();
    return this.tarihMetni(new Date(tarih.getFullYear(), tarih.getMonth() + 1, 0));
  });
  donemBasligi = computed(() => new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' }).format(this.seciliDonem()));
  aylikGruplar = computed<AylikGrup[]>(() => {
    const tumSatirlar = this.aylikIsler();
    // Her mali kalem kendi bakiyesiyle görünür. Sayfanın dışındaki proje kalemleri
    // buradaki bir satırın altına saklanmaz veya tamamlanma hesabına katılmaz.
    const satirlar = tumSatirlar;
    const sabitIsler = satirlar.filter(satir => this.gorunumGrubu(satir.isGrubu) === 'Sabit İşler');
    const anaAmbalajlar = satirlar.filter(satir => this.gorunumGrubu(satir.isGrubu) === 'Ana Ambalaj');
    const ekstraIsler = satirlar.filter(satir => this.gorunumGrubu(satir.isGrubu) === 'Ekstra İşler');
    return [
      this.grupOlustur('Sabit İşler', sabitIsler),
      this.grupOlustur('Ana Ambalaj', anaAmbalajlar),
      this.grupOlustur('Ekstra İşler', ekstraIsler),
    ].filter(grup => grup.satirlar.length > 0);
  });
  finansOzeti = computed(() => this.aylikFinansOzeti());
  raporGruplari = computed(() => [...new Set(this.aylikGrupToplamlari().map(item => this.grupAdi(item.grup)))]
    .sort((a, b) => this.raporGrubuSirasi(a) - this.raporGrubuSirasi(b) || a.localeCompare(b, 'tr-TR')));

  ngOnInit(): void {
    this.listeAkislariniKur();
    forkJoin({
      kategoriler: this.permissions.hasAccess(this.izin.Modul) && this.permissions.hasAccess(this.izin.GiderGoruntule) ? this.service.giderKategorileri() : of({ isSuccess: true, value: [] }),
      icSandikSablonlari: this.permissions.hasAccess(AMBALAJ_YETKI.Listele) && this.permissions.hasAccess(AMBALAJ_YETKI.PlanGoruntule)
        ? this.ambalajService.getIcSandikSablonlari() : of({ isSuccess: true, value: [] }),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(result => {
      if (result.kategoriler.isSuccess) this.giderKategorileri.set((result.kategoriler.value ?? []).filter(kategori => kategori.aktif));
      if (result.icSandikSablonlari.isSuccess) this.icSandikSablonlari.set(result.icSandikSablonlari.value ?? []);
      this.loading.set(false);
    });
    this.donemiYukle();
  }

  selectTab(tab: AnaSekme): void {
    if (!this.permissions.hasAccess(this.izin.Modul)) return;
    if (tab === 'akis' && !this.permissions.hasAccess(this.izin.KayitGoruntule) ||
        tab === 'giderler' && !this.permissions.hasAccess(this.izin.GiderGoruntule) ||
        tab === 'ayarlar' && !this.ayarOkuyabilir('duzenli') && !this.ayarOkuyabilir('tarifeler')) return;
    this.activeTab.set(tab);
    if (tab === 'akis') this.aylikListeyiYukle();
    if (tab === 'giderler' && !this.giderlerYuklendi) {
      this.giderlerYuklendi = true;
      this.giderListeIstekleri.next();
    }
    if (tab === 'ayarlar') {
      if (!this.permissions.hasAccess(this.izin.DuzenliIsYonet)) this.ayarGorunumu.set('tarifeler');
      this.ayarListesiniYukle();
    }
  }
  kategorileriYenile(): void {
    if (!this.permissions.hasAccess(this.izin.GiderGoruntule)) return;
    this.service.giderKategorileri().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(r => {
      if (r.isSuccess) this.giderKategorileri.set((r.value ?? []).filter(x => x.aktif));
    });
  }
  giderProjesiSec(proje: { projeId: number; projeNo: string; musteri: string } | null): void {
    this.giderForm.projeId = proje?.projeId ?? null;
    this.giderProjeEtiketi = proje ? `${proje.projeNo} · ${proje.musteri}` : '';
  }
  isProjesiSec(tur: 'ozel' | 'duzenli', proje: { projeId: number; projeNo: string; musteri: string } | null): void {
    const form = tur === 'ozel' ? this.ozelIsForm : this.duzenliIsForm;
    form.projeId = proje?.projeId ?? null;
    if (proje?.musteri) form.musteri = proje.musteri;
    const label = proje ? `${proje.projeNo} · ${proje.musteri}` : '';
    if (tur === 'ozel') this.ozelProjeEtiketi = label; else this.duzenliProjeEtiketi = label;
  }

  donemDegistir(fark: number): void {
    const mevcut = this.seciliDonem();
    this.seciliDonem.set(new Date(mevcut.getFullYear(), mevcut.getMonth() + fark, 1));
    this.aylikPageNumber.set(1);
    this.donemiYukle();
  }

  buguneDon(): void {
    this.seciliDonem.set(this.ayinIlkGunu(new Date()));
    this.aylikPageNumber.set(1);
    this.donemiYukle();
  }

  donemiYukle(): void {
    this.aylikListeyiYukle();
  }

  aylikListeyiYukle(): void {
    if (!this.permissions.hasAccess(this.izin.KayitGoruntule)) return;
    this.aylikListeIstekleri.next();
  }

  aylikAramaDegisti(value: string): void {
    this.arama.set(value);
    this.aylikAramaIstekleri.next(value.trim());
  }

  iptalEdilenleriDegisti(value: boolean): void {
    this.iptalEdilenleriGoster.set(value);
    this.aylikPageNumber.set(1);
    this.aylikListeyiYukle();
  }

  aylikSayfaDegisti(pageNumber: number): void {
    this.aylikPageNumber.set(pageNumber);
    this.aylikListeyiYukle();
  }

  aylikSayfaBoyutuDegisti(pageSize: number): void {
    this.aylikPageSize.set(pageSize);
    this.aylikPageNumber.set(1);
    this.aylikListeyiYukle();
  }

  giderAramaDegisti(value: string): void {
    this.giderArama.set(value);
    this.giderAramaIstekleri.next(value.trim());
  }

  giderSayfaDegisti(pageNumber: number): void {
    this.giderPageNumber.set(pageNumber);
    this.giderListeIstekleri.next();
  }

  giderSayfaBoyutuDegisti(pageSize: number): void {
    this.giderPageSize.set(pageSize);
    this.giderPageNumber.set(1);
    this.giderListeIstekleri.next();
  }

  ayarGorunumuDegistir(gorunum: AyarGorunumu): void {
    if (!this.ayarOkuyabilir(gorunum)) return;
    this.ayarGorunumu.set(gorunum);
    this.ayarListesiniYukle();
  }

  duzenliAramaDegisti(value: string): void {
    this.duzenliArama.set(value);
    this.duzenliAramaIstekleri.next(value.trim());
  }

  duzenliSayfaDegisti(pageNumber: number): void {
    this.duzenliPageNumber.set(pageNumber);
    this.duzenliListeIstekleri.next();
  }

  duzenliSayfaBoyutuDegisti(pageSize: number): void {
    this.duzenliPageSize.set(pageSize);
    this.duzenliPageNumber.set(1);
    this.duzenliListeIstekleri.next();
  }

  tarifeAramaDegisti(value: string): void {
    this.tarifeArama.set(value);
    this.urunAramaIstekleri.next(value.trim());
  }

  urunSayfaDegisti(pageNumber: number): void {
    this.urunPageNumber.set(pageNumber);
    this.urunListeIstekleri.next();
  }

  urunSayfaBoyutuDegisti(pageSize: number): void {
    this.urunPageSize.set(pageSize);
    this.urunPageNumber.set(1);
    this.urunListeIstekleri.next();
  }

  grupAcik(grup: string): boolean { return this.acikGruplar().has(grup); }
  grupDegistir(grup: string): void {
    this.acikGruplar.update(mevcut => {
      const sonraki = new Set(mevcut);
      sonraki.has(grup) ? sonraki.delete(grup) : sonraki.add(grup);
      return sonraki;
    });
  }

  satirDurumu(satir: FinansAylikIs): string {
    return satir.durum;
  }

  raporFormunuAc(): void {
    this.raporSecimleri = Object.fromEntries(this.raporGruplari().map(grup => [grup, true]));
    this.siparisRaporBaslangic = this.donemBaslangici();
    this.siparisRaporBitis = this.donemBitisi();
    this.raporAcik.set(true);
  }

  raporIndir(format: RaporFormati): void {
    const gruplar = this.raporGruplari().filter(grup => this.raporSecimleri[grup]);
    if (!gruplar.length) {
      this.toast.error('En az bir rapor grubu seçin.');
      return;
    }
    const tarih = this.seciliDonem();
    this.raporIndiriliyor.set(format);
    this.service.aylikRapor(format, tarih.getFullYear(), tarih.getMonth() + 1, gruplar).subscribe({
      next: blob => {
        this.raporIndiriliyor.set(null);
        const uzanti = format === 'pdf' ? 'pdf' : format === 'excel' ? 'xlsx' : 'zip';
        this.dosyaIndir(blob, `Finans_Is_Takibi_${tarih.getFullYear()}_${String(tarih.getMonth() + 1).padStart(2, '0')}.${uzanti}`);
      },
      error: () => {
        this.raporIndiriliyor.set(null);
        this.toast.error('Rapor indirilemedi.');
      },
    });
  }

  siparisDurumRaporuIndir(format: 'pdf' | 'excel'): void {
    if (!this.siparisRaporTumDonemler && (!this.siparisRaporBaslangic || !this.siparisRaporBitis || this.siparisRaporBaslangic > this.siparisRaporBitis)) {
      this.toast.error('Geçerli bir başlangıç ve bitiş tarihi seçin.');
      return;
    }
    const filtre = {
      baslangic: this.siparisRaporTumDonemler ? undefined : this.siparisRaporBaslangic,
      bitis: this.siparisRaporTumDonemler ? undefined : this.siparisRaporBitis,
      projeNo: this.temizle(this.siparisRaporProjeNo) ?? undefined,
      isGrubu: this.siparisRaporIsGrubu || undefined,
      durum: this.siparisRaporDurum || undefined,
    };
    this.siparisRaporIndiriliyor.set(format);
    this.service.siparisDurumRaporu(format, filtre).subscribe({
      next: blob => {
        this.siparisRaporIndiriliyor.set(null);
        this.dosyaIndir(blob, `Finans_Siparis_Durum_Raporu.${format === 'pdf' ? 'pdf' : 'xlsx'}`);
      },
      error: () => {
        this.siparisRaporIndiriliyor.set(null);
        this.toast.error('Sipariş durum raporu indirilemedi.');
      },
    });
  }

  aylikDegerDuzenle(satir: FinansAylikIs): void {
    if (!this.aylikDegerDuzenlenebilir(satir)) return;
    this.aylikDegerSatiri.set(satir);
    this.aylikDeger = satir.tutarDuzenlenebilir ? satir.netTutar : satir.miktar;
    this.aylikDegerHatasi.set('');
    this.aylikDegerAcik.set(true);
  }

  aylikDegerKaydet(): void {
    const satir = this.aylikDegerSatiri();
    if (!this.aylikDegerDuzenlenebilir(satir) || !Number.isFinite(this.aylikDeger) || this.aylikDegerKaydediliyor()) return;
    const deger = Number(this.aylikDeger);
    if (!satir?.ozelIsId || deger < 0 || (!satir.tutarDuzenlenebilir && deger === 0)) {
      this.aylikDegerHatasi.set('Sıfırdan büyük geçerli bir değer girin.');
      return;
    }
    const request = satir.tutarDuzenlenebilir ? { netBirimFiyat: deger } : { miktar: deger };
    this.aylikDegerKaydediliyor.set(true);
    this.service.ozelIsAylikDegerGuncelle(satir.ozelIsId, request).subscribe(result => {
      this.aylikDegerKaydediliyor.set(false);
      if (this.onayaAlindi(result)) return;
      if (!result.isSuccess) {
        this.aylikDegerHatasi.set(result.error ?? 'Aylık değer kaydedilemedi.');
        return;
      }
      this.aylikDegerAcik.set(false);
      this.toast.success('Aylık değer güncellendi.');
      this.aylikListeyiYukle();
    });
  }

  iptalFormunuAc(satir: FinansAylikIs): void {
    this.iptalSatiri.set(satir);
    this.iptalAciklamasi = '';
    this.iptalHatasi.set('');
    this.iptalAcik.set(true);
  }

  ozelIsIptal(): void {
    const satir = this.iptalSatiri();
    if (!satir?.ozelIsId || !this.iptalAciklamasi.trim()) {
      this.iptalHatasi.set('İptal açıklaması zorunludur.');
      return;
    }
    this.iptalKaydediliyor.set(true);
    this.service.ozelIsIptal(satir.ozelIsId, this.iptalAciklamasi.trim()).subscribe(result => {
      this.iptalKaydediliyor.set(false);
      if (this.onayaAlindi(result)) return;
      if (!result.isSuccess) {
        this.iptalHatasi.set(result.error ?? 'İş iptal edilemedi.');
        return;
      }
      this.iptalAcik.set(false);
      this.toast.success('İş iptal edildi.');
      this.aylikListeyiYukle();
    });
  }

  ozelIsGeriAl(satir: FinansAylikIs): void {
    if (!satir.ozelIsId) return;
    this.service.ozelIsGeriAl(satir.ozelIsId).subscribe(result => {
      if (this.onayaAlindi(result)) return;
      if (!result.isSuccess) this.toast.error(result.error ?? 'İş geri alınamadı.');
      else {
        this.toast.success('İş yeniden aktifleştirildi.');
        this.aylikListeyiYukle();
      }
    });
  }

  yeniOzelIs(): void {
    this.ozelProjeEtiketi = '';
    this.ozelIsForm = this.bosOzelIsFormu();
    this.ozelRaporGrubu = 'Diğer';
    this.ozelIsHatasi.set('');
    this.ozelIsAcik.set(true);
  }

  ozelIsTuruSecildi(isTuru: string): void {
    this.ozelIsForm.isTuru = isTuru;
    if (!isTuru) return;
    this.ozelIsForm.raporGrubu = isTuru;
    if (isTuru !== 'Diğer' && !this.ozelIsForm.isAdi.trim()) this.ozelIsForm.isAdi = isTuru;
  }

  ozelIsKaydet(): void {
    const form = this.ozelIsForm;
    const raporGrubu = form.raporGrubu === 'Özel' ? this.ozelRaporGrubu.trim() : form.raporGrubu.trim();
    const tarihGecerli = form.isTarihi >= this.donemBaslangici() && form.isTarihi <= this.donemBitisi();
    if (!form.isAdi.trim() || !form.isTuru.trim() || !raporGrubu || !tarihGecerli
      || form.miktar <= 0 || form.birimFiyat < 0 || form.kdvOrani < 0 || form.kdvOrani > 100) {
      this.ozelIsHatasi.set('Zorunlu alanları ve seçili aya ait geçerli tarih/tutar bilgilerini kontrol edin.');
      return;
    }
    const request: FinansOzelIsKaydetRequest = {
      ...form,
      isAdi: form.isAdi.trim(),
      isTuru: form.isTuru.trim(),
      raporGrubu,
      musteri: form.musteri.trim(),
      aciklama: this.temizle(form.aciklama),
      miktar: Number(form.miktar),
      birimFiyat: Number(form.birimFiyat),
      kdvOrani: Number(form.kdvOrani),
    };
    this.ozelIsKaydediliyor.set(true);
    this.service.ozelIsOlustur(request).subscribe(result => {
      this.ozelIsKaydediliyor.set(false);
      if (this.onayaAlindi(result)) return;
      if (!result.isSuccess) {
        this.ozelIsHatasi.set(result.error ?? 'Tek seferlik iş oluşturulamadı.');
        return;
      }
      this.ozelIsAcik.set(false);
      this.toast.success('Tek seferlik iş oluşturuldu.');
      this.aylikListeyiYukle();
    });
  }

  siparisFormunuAc(satir: FinansAylikIs): void {
    this.topluSiparisAc(satir.isKaydiIds);
  }

  topluSiparisAc(ids: number[]): void {
    if (!ids.length || !this.permissions.canWrite(this.izin.PoGir)) return;
    this.detayHedef.set(null);
    this.dagitim.set({tur: 'Siparis', ids, siparisId: null});
  }

  satiriFaturalandir(_satir: FinansAylikIs): void { this.faturaAc(null); }

  faturaAc(siparisId: number | null): void {
    if (!this.permissions.canWrite(this.izin.FaturaGir)) return;
    this.detayHedef.set(null);
    this.dagitim.set({tur: 'Fatura', ids: [], siparisId});
  }

  belgeKaydedildi(hedef: {tur: FinansVarlikTuru; id: number}): void {
    this.dagitim.set(null); this.detayHedef.set(hedef); this.aylikListeyiYukle();
  }

  parasal(kod: string): boolean {
    return this.permissions.hasAccess(this.izin.Modul) && this.permissions.hasAccess(this.izin.ParasalVeriGoruntule) && this.permissions.hasAccess(kod);
  }

  ayarOkuyabilir(gorunum: AyarGorunumu): boolean {
    return this.permissions.hasAccess(this.izin.Modul) && this.permissions.hasAccess(gorunum === 'duzenli' ? this.izin.DuzenliIsYonet : this.izin.IsKutuphanesiYonet);
  }

  ayarYazabilir(gorunum: AyarGorunumu): boolean {
    return this.ayarOkuyabilir(gorunum) && this.permissions.canWrite(gorunum === 'duzenli' ? this.izin.DuzenliIsYonet : this.izin.TarifeYonet);
  }

  miktarGorebilir(birim: string | undefined, isTuru?: number): boolean {
    const m3 = birim === 'm³' || birim === 'm3' || isTuru === 9;
    return !m3 || this.permissions.hasAccess(this.alanIzni.M3Goruntule) && (isTuru !== 9 || this.permissions.hasAccess(this.alanIzni.SarfGoruntule));
  }

  giderAlanlariniGorebilir(): boolean {
    return this.parasal(this.izin.BirimFiyatGoruntule) && this.parasal(this.izin.TutarGoruntule) && this.permissions.hasAccess(this.izin.GiderGoruntule);
  }

  giderDuzenlenebilir(gider: FinansGider): boolean {
    return this.permissions.canWrite(this.izin.GiderDuzenle) && this.giderAlanlariniGorebilir() &&
      this.miktarGorebilir(gider.birim) && Number.isFinite(gider.miktar) && Number.isFinite(gider.birimFiyat) && Number.isFinite(gider.kdvOrani);
  }

  aylikDegerDuzenlenebilir(satir: FinansAylikIs | null): boolean {
    if (!satir || !this.permissions.hasAccess(this.izin.Modul) || !this.permissions.canWrite(this.izin.FiyatlandirmaDegistir)) return false;
    return satir.tutarDuzenlenebilir
      ? this.parasal(this.izin.TutarGoruntule) && Number.isFinite(satir.netTutar)
      : this.miktarGorebilir(satir.birim, satir.isTuru) && Number.isFinite(satir.miktar);
  }

  private onayaAlindi(result: ApiResult<unknown>): boolean {
    if (result.statusCode !== 202) return false;
    this.toast.info('İşlem onaya gönderildi; henüz uygulanmadı.');
    return true;
  }

  yeniGider(): void {
    this.duzenlenenGiderId.set(null);
    this.giderProjeEtiketi = '';
    this.giderForm = this.bosGiderFormu();
    ++this.giderKalemIstekSurumu;
    this.giderKalemleri.set([]); this.giderKalemLoading.set(false); this.giderKalemHatasi.set('');
    this.giderEskiKalem.set(null); this.giderEskiKategori.set(null);
    this.giderHatasi.set('');
    this.giderAcik.set(true);
  }

  giderDuzenle(gider: FinansGider): void {
    if (!this.giderDuzenlenebilir(gider)) {
      this.toast.error('Gizlenmiş tutar veya miktar içeren gider düzenlenemez. Gerekli alan izinlerini kontrol edin.');
      return;
    }
    this.giderProjeEtiketi = gider.projeNo;
    this.duzenlenenGiderId.set(gider.id);
    this.giderForm = { tarih: gider.tarih.slice(0, 10), kategoriId: gider.kategoriId, giderKalemiId: gider.giderKalemiId ?? null, altKategori: gider.altKategori ?? null, firmaVeyaKisi: gider.firmaVeyaKisi ?? null, aciklama: gider.aciklama, tutar: gider.tutar, paraBirimi: gider.paraBirimi, kdvDahil: gider.kdvDahil, kdvOrani: gider.kdvOrani, projeId: gider.projeId ?? null, isTuru: gider.isTuru ?? null,
      miktar: gider.miktar, birim: gider.birim, birimFiyat: gider.birimFiyat,
      finansTarihi: (gider.finansTarihi ?? gider.tarih).slice(0, 10), finansDonemi: gider.finansDonemi,
      belgeNo: gider.belgeNo ?? null, avansMi: gider.avansMi ?? false, mahsupEdilenAvansId: gider.mahsupEdilenAvansId ?? null };
    this.giderHatasi.set('');
    this.giderEskiKategori.set(this.giderKategorileri().some(k => k.id === gider.kategoriId) ? null : { id: gider.kategoriId, ad: gider.kategori });
    this.giderEskiKalem.set(gider.giderKalemiId ? { id: gider.giderKalemiId, ad: gider.giderKalemi ?? gider.altKategori ?? `Kalem #${gider.giderKalemiId}` } : null);
    this.giderKalemleriniYukle();
    this.giderAcik.set(true);
  }

  giderKategoriDegisti(kategoriId: number): void {
    this.giderForm.kategoriId = kategoriId;
    this.giderForm.giderKalemiId = null; this.giderForm.altKategori = null;
    this.giderEskiKalem.set(null); this.giderEskiKategori.set(null);
    this.giderKalemleriniYukle();
  }

  giderKalemiSecildi(id: number | null): void {
    const kalem = this.giderKalemleri().find(k => k.id === id && k.aktif && k.kategoriId === this.giderForm.kategoriId);
    this.giderForm.giderKalemiId = kalem?.id ?? null;
    this.giderForm.altKategori = kalem?.ad ?? null;
    this.giderEskiKalem.set(null);
    // Yalnız yeni giderde ve açık kullanıcı seçiminde varsayılanları uygula.
    // Mevcut gideri okumak fiyat/miktar/para birimi snapshot'ını yeniden yazmaz.
    if (kalem && !this.duzenlenenGiderId()) {
      this.giderForm.firmaVeyaKisi = kalem.varsayilanFirmaVeyaKisi ?? this.giderForm.firmaVeyaKisi;
      this.giderForm.miktar = kalem.varsayilanMiktar ?? this.giderForm.miktar;
      this.giderForm.birim = kalem.varsayilanBirim ?? this.giderForm.birim;
      this.giderForm.birimFiyat = kalem.varsayilanBirimFiyat ?? this.giderForm.birimFiyat;
      this.giderForm.paraBirimi = kalem.varsayilanParaBirimi ?? this.giderForm.paraBirimi;
      this.giderForm.kdvOrani = kalem.varsayilanKdvOrani ?? this.giderForm.kdvOrani;
      this.giderForm.kdvDahil = kalem.varsayilanKdvDahil ?? this.giderForm.kdvDahil;
    }
  }

  private giderKalemleriniYukle(): void {
    const version = ++this.giderKalemIstekSurumu;
    const kategoriId = this.giderForm.kategoriId;
    this.giderKalemleri.set([]); this.giderKalemHatasi.set('');
    if (!kategoriId) { this.giderKalemLoading.set(false); return; }
    this.giderKalemLoading.set(true);
    this.service.giderKalemleri(kategoriId, true)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => { if (version === this.giderKalemIstekSurumu) this.giderKalemLoading.set(false); }))
      .subscribe({ next: r => {
        if (version !== this.giderKalemIstekSurumu) return;
        if (!r.isSuccess) { this.giderKalemHatasi.set(r.error ?? 'Gider kalemleri alınamadı.'); return; }
        const items = (r.value ?? []).filter(k => k.aktif && k.kategoriId === kategoriId);
        this.giderKalemleri.set(items);
        if (items.some(k => k.id === this.giderForm.giderKalemiId)) this.giderEskiKalem.set(null);
      }, error: () => { if (version === this.giderKalemIstekSurumu) this.giderKalemHatasi.set('Gider kalemleri alınamadı.'); } });
  }

  giderKaydet(): void {
    if (this.giderKaydediliyor() || this.giderKalemLoading() || !this.permissions.canWrite(this.duzenlenenGiderId() ? this.izin.GiderDuzenle : this.izin.GiderEkle)) return;
    if (!this.permissions.hasAccess(this.izin.Modul) || this.duzenlenenGiderId() && (!this.giderAlanlariniGorebilir() || !this.miktarGorebilir(this.giderForm.birim))) return;
    if (this.giderEskiKategori() || this.giderEskiKalem() || this.giderKalemHatasi()) {
      this.giderHatasi.set('Aktif kategori/kalem seçin veya eski kalem bağlantısını açıkça kaldırın. Kalem listesi alınamadıysa yeniden deneyin.');
      return;
    }
    if (!this.giderForm.tarih || this.giderForm.kategoriId <= 0 || !this.giderForm.aciklama.trim() ||
        !Number.isFinite(this.giderForm.birimFiyat) || !Number.isFinite(this.giderForm.miktar) || !Number.isFinite(this.giderForm.kdvOrani) ||
        this.giderForm.birimFiyat! < 0 || this.giderForm.miktar! <= 0 || this.giderForm.kdvOrani < 0 || this.giderForm.kdvOrani > 100) {
      this.giderHatasi.set('Tarih, kategori, açıklama ve sıfırdan büyük tutar zorunludur.');
      return;
    }
    const id = this.duzenlenenGiderId();
    const request = { ...this.giderForm, aciklama: this.giderForm.aciklama.trim() };
    this.giderKaydediliyor.set(true);
    const operation = id ? this.service.giderGuncelle(id, request) : this.service.giderOlustur(request);
    operation.pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.giderKaydediliyor.set(false))).subscribe({ next: result => {
      if (this.onayaAlindi(result)) return;
      if (!result.isSuccess) this.giderHatasi.set(result.error ?? 'Gider kaydedilemedi.');
      else {
        this.giderAcik.set(false);
        this.toast.success(id ? 'Gider güncellendi.' : 'Gider kaydedildi.');
        this.giderleriYenile();
      }
    }, error: () => this.giderHatasi.set('Gider kaydedilemedi.') });
  }

  giderRaporuIndir(format: 'pdf' | 'excel'): void {
    this.giderRaporIndiriliyor.set(format);
    this.service.giderRaporu(format).subscribe({
      next: blob => {
        this.giderRaporIndiriliyor.set(null);
        this.dosyaIndir(blob, `FinansGiderRaporu.${format === 'pdf' ? 'pdf' : 'xlsx'}`);
      },
      error: () => {
        this.giderRaporIndiriliyor.set(null);
        this.toast.error('Gider raporu indirilemedi.');
      },
    });
  }

  yeniDuzenliIs(): void {
    if (!this.ayarYazabilir('duzenli')) return;
    this.duzenliProjeEtiketi = '';
    this.duzenlenenDuzenliIsId.set(null);
    this.duzenliIsForm = this.bosDuzenliIsFormu();
    this.duzenliIsHatasi.set('');
    this.duzenliIsAcik.set(true);
  }

  duzenliIsDuzenle(is: FinansDuzenliIs): void {
    if (!this.ayarYazabilir('duzenli') || !this.parasal(this.izin.BirimFiyatGoruntule) || !this.parasal(this.izin.TutarGoruntule) || !this.miktarGorebilir(is.birim) || !Number.isFinite(is.birimFiyat) || !Number.isFinite(is.kdvOrani) || !Number.isFinite(is.miktar)) return;
    this.duzenlenenDuzenliIsId.set(is.id);
    this.duzenliProjeEtiketi = '';
    this.duzenliIsForm = { projeId: is.projeId ?? null, isAdi: is.isAdi, isTuru: is.isTuru, musteri: is.musteri, aciklama: is.aciklama, tekrarSikligi: is.tekrarSikligi, baslangicTarihi: is.baslangicTarihi.slice(0, 10), bitisTarihi: is.bitisTarihi?.slice(0, 10) ?? null, olusturmaGunu: is.olusturmaGunu, miktar: is.miktar, birim: is.birim, birimFiyat: is.birimFiyat, paraBirimi: is.paraBirimi, kdvOrani: is.kdvOrani, aktif: is.aktif, hesaplamaYontemi: is.hesaplamaYontemi, raporGrubu: is.raporGrubu };
    this.duzenliIsHatasi.set('');
    this.duzenliIsAcik.set(true);
  }

  duzenliIsKaydet(): void {
    if (!this.ayarYazabilir('duzenli') || this.duzenliIsKaydediliyor()) return;
    if (this.duzenlenenDuzenliIsId() && (!this.parasal(this.izin.BirimFiyatGoruntule) || !this.parasal(this.izin.TutarGoruntule) || !this.miktarGorebilir(this.duzenliIsForm.birim))) return;
    const form = this.duzenliIsForm;
    if (!form.isAdi.trim() || !form.isTuru.trim() || !form.baslangicTarihi || !Number.isFinite(form.miktar) || !Number.isFinite(form.birimFiyat) || !Number.isFinite(form.kdvOrani) || form.olusturmaGunu < 1 || form.olusturmaGunu > 31 || form.miktar <= 0 || form.birimFiyat < 0 || form.kdvOrani < 0 || form.kdvOrani > 100) {
      this.duzenliIsHatasi.set('İş adı, tür, tarih, gün, miktar, fiyat ve KDV alanlarını kontrol edin.');
      return;
    }
    const id = this.duzenlenenDuzenliIsId();
    const request: FinansDuzenliIsKaydetRequest = { ...form, isAdi: form.isAdi.trim(), isTuru: form.isTuru.trim(), aciklama: this.temizle(form.aciklama), bitisTarihi: form.bitisTarihi || null };
    this.duzenliIsKaydediliyor.set(true);
    const operation = id ? this.service.duzenliIsGuncelle(id, request) : this.service.duzenliIsOlustur(request);
    operation.subscribe(result => {
      this.duzenliIsKaydediliyor.set(false);
      if (this.onayaAlindi(result)) return;
      if (!result.isSuccess) this.duzenliIsHatasi.set(result.error ?? 'Düzenli iş kaydedilemedi.');
      else {
        this.duzenliIsAcik.set(false);
        this.toast.success(id ? 'Düzenli iş güncellendi.' : 'Düzenli iş eklendi.');
        this.duzenliIsleriYenile();
      }
    });
  }

  yeniUrun(): void {
    if (!this.ayarYazabilir('tarifeler')) return;
    this.duzenlenenUrunId.set(null);
    this.urunForm = this.bosUrunFormu();
    this.urunHatasi.set('');
    this.urunAcik.set(true);
  }

  urunDuzenle(urun: FinansUrun): void {
    if (!this.ayarYazabilir('tarifeler') || !this.parasal(this.izin.BirimFiyatGoruntule) || !this.parasal(this.izin.TutarGoruntule) || !Number.isFinite(urun.birimFiyat) || !Number.isFinite(urun.kdvOrani)) return;
    if (urun.eslesmeler.some(e => e.sandikTipi === 'Katlanır Sandık') && !this.permissions.hasAccess(this.alanIzni.OlcuGoruntule)) return;
    const eslesme = urun.eslesmeler[0];
    this.duzenlenenUrunId.set(urun.id);
    this.urunForm = { kod: urun.kod, ad: urun.ad, fiyatlandirmaBirimi: urun.fiyatlandirmaBirimi, birimFiyat: urun.birimFiyat, paraBirimi: urun.paraBirimi, kdvOrani: urun.kdvOrani, aktif: urun.aktif, sira: urun.sira, isTuru: eslesme?.isTuru ?? 0, sandikAdi: eslesme?.sandikAdi ?? '', sandikTipi: eslesme?.sandikTipi ?? '', boy: eslesme?.boy ?? null, en: eslesme?.en ?? null, yukseklik: eslesme?.yukseklik ?? null, icSandikSablonId: eslesme?.icSandikSablonId ?? null };
    this.urunHatasi.set('');
    this.urunAcik.set(true);
  }

  urunKaydet(): void {
    if (!this.ayarYazabilir('tarifeler') || this.urunKaydediliyor()) return;
    if (this.duzenlenenUrunId() && (!this.parasal(this.izin.BirimFiyatGoruntule) || !this.parasal(this.izin.TutarGoruntule) || this.urunForm.sandikTipi === 'Katlanır Sandık' && !this.permissions.hasAccess(this.alanIzni.OlcuGoruntule))) return;
    const form = this.urunForm;
    if (!form.kod.trim() || !form.ad.trim() || !Number.isFinite(form.birimFiyat) || !Number.isFinite(form.kdvOrani) || form.birimFiyat < 0 || form.kdvOrani < 0 || form.kdvOrani > 100) {
      this.urunHatasi.set('Kod, ad, geçerli fiyat ve KDV zorunludur.');
      return;
    }
    if (form.isTuru === 3 && !form.icSandikSablonId) {
      this.urunHatasi.set('İç sandık tarifesinde kayıtlı iç sandık tipi zorunludur.');
      return;
    }
    if ([4, 5].includes(form.isTuru) && !form.sandikTipi) {
      this.urunHatasi.set('Saha ve yedek sandık tarifesinde sandık tipi zorunludur.');
      return;
    }
    if (form.sandikTipi === 'Katlanır Sandık' && (!form.boy || !form.en || !form.yukseklik)) {
      this.urunHatasi.set('Katlanır sandık tarifesinde boy, en ve yükseklik zorunludur.');
      return;
    }
    const id = this.duzenlenenUrunId();
    const ozelSandik = [4, 5].includes(form.isTuru);
    const katlanir = ozelSandik && form.sandikTipi === 'Katlanır Sandık';
    const request: FinansUrunKaydetRequest = { kod: form.kod.trim(), ad: form.ad.trim(), fiyatlandirmaBirimi: form.fiyatlandirmaBirimi, birimFiyat: Number(form.birimFiyat), paraBirimi: form.paraBirimi, kdvOrani: Number(form.kdvOrani), aktif: form.aktif, sira: form.sira, eslesmeler: form.isTuru ? [{ isTuru: form.isTuru, sandikAdi: form.isTuru === 3 || ozelSandik ? null : this.temizle(form.sandikAdi), icSandikSablonId: form.isTuru === 3 ? form.icSandikSablonId : null, sandikTipi: ozelSandik ? form.sandikTipi : null, boy: katlanir ? Number(form.boy) : null, en: katlanir ? Number(form.en) : null, yukseklik: katlanir ? Number(form.yukseklik) : null }] : [] };
    this.urunKaydediliyor.set(true);
    const operation = id ? this.service.urunGuncelle(id, request) : this.service.urunOlustur(request);
    operation.subscribe(result => {
      this.urunKaydediliyor.set(false);
      if (this.onayaAlindi(result)) return;
      if (!result.isSuccess) this.urunHatasi.set(result.error ?? 'Tarife kaydedilemedi.');
      else {
        this.urunAcik.set(false);
        this.toast.success(id ? 'Tarife güncellendi.' : 'Tarife eklendi.');
        this.urunleriYenile();
      }
    });
  }

  urunSil(urun: FinansUrun): void {
    if (!this.ayarYazabilir('tarifeler')) return;
    if (!confirm(`${urun.kod} · ${urun.ad} tarifesini silmek istediğinize emin misiniz?\n\nSipariş geçmişinde kullanılmış tarifeler silinemez; düzenlenerek pasif duruma getirilebilir.`)) return;
    this.urunSiliniyorId.set(urun.id);
    this.service.urunSil(urun.id).subscribe(result => {
      this.urunSiliniyorId.set(null);
      if (!result.isSuccess) {
        this.toast.error(result.error ?? 'Tarife silinemedi.');
        return;
      }
      this.toast.success('Tarife silindi.');
      this.urunleriYenile();
    });
  }

  urunEslesmeMetni(urun: FinansUrun): string {
    return urun.eslesmeler.map(eslesme => {
      const tur = eslesme.sandikTipi ? ` · ${eslesme.sandikTipi}` : '';
      const olcu = eslesme.sandikTipi === 'Katlanır Sandık' && this.permissions.hasAccess(this.alanIzni.OlcuGoruntule) ? ` · ${eslesme.boy}×${eslesme.en}×${eslesme.yukseklik} mm` : '';
      const detay = eslesme.icSandikSablonId ? ` · ${this.icSandikSablonAdi(eslesme.icSandikSablonId)}` : eslesme.sandikAdi ? ` · ${eslesme.sandikAdi}` : '';
      return `${this.isTuruMetni(eslesme.isTuru)}${tur}${olcu}${detay}`;
    }).join(', ') || 'Manuel seçim';
  }

  icSandikSablonAdi(id: number): string {
    return this.icSandikSablonlari().find(sablon => sablon.id === id)?.ad ?? 'Silinmiş İç Sandık Tipi';
  }

  urunIsTuruDegisti(isTuru: number): void {
    this.urunForm.isTuru = Number(isTuru);
    this.urunForm.sandikAdi = '';
    this.urunForm.sandikTipi = '';
    this.urunForm.boy = null;
    this.urunForm.en = null;
    this.urunForm.yukseklik = null;
    this.urunForm.icSandikSablonId = null;
  }

  urunSandikTipiDegisti(sandikTipi: string): void {
    this.urunForm.sandikTipi = sandikTipi;
    this.urunForm.fiyatlandirmaBirimi = sandikTipi === 'Katlanır Sandık' ? 1 : 2;
    if (sandikTipi !== 'Katlanır Sandık') {
      this.urunForm.boy = null;
      this.urunForm.en = null;
      this.urunForm.yukseklik = null;
    }
  }

  isTuruMetni(isTuru: number): string {
    return ({ 1: 'AMBALAJ', 2: 'İLAVE SANDIK', 3: 'İÇ SANDIK', 4: 'SAHA SANDIĞI', 5: 'YEDEK SANDIK', 6: 'TADİLAT', 7: 'DİĞER AMBALAJ', 8: 'ÖZEL İŞ', 9: 'SARF KERESTE' } as Record<number, string>)[isTuru] ?? 'DİĞER';
  }


  private grupAdi(deger: string): string {
    return deger.trim() || 'Diğer';
  }

  private grupOlustur(ad: string, satirlar: FinansAylikIs[]): AylikGrup {
    const toplamlar = this.aylikGrupToplamlari()
      .filter(item => this.gorunumGrubu(item.grup) === ad)
      .reduce((toplam, item) => {
        if (item.paraBirimi === 'EUR') toplam.eur += item.toplamTutar;
        if (item.paraBirimi === 'USD') toplam.usd += item.toplamTutar;
        if (item.paraBirimi === 'TRY') toplam.try += item.toplamTutar;
        return toplam;
      }, { eur: 0, usd: 0, try: 0 });
    return { ad, satirlar, eur: toplamlar.eur, usd: toplamlar.usd, try: toplamlar.try };
  }

  private gorunumGrubu(grup: string): string {
    const ad = this.grupAdi(grup);
    if (['Kira', 'Sevkiyat', 'Sabit İşler'].includes(ad)) return 'Sabit İşler';
    if (ad === 'Ana Ambalaj') return 'Ana Ambalaj';
    return 'Ekstra İşler';
  }

  private raporGrubuSirasi(grup: string): number {
    const gorunumSirasi = this.grupSirasi.indexOf(this.gorunumGrubu(grup));
    return gorunumSirasi < 0 ? this.grupSirasi.length : gorunumSirasi;
  }

  private ayarListesiniYukle(): void {
    if (!this.ayarOkuyabilir(this.ayarGorunumu())) return;
    if (this.ayarGorunumu() === 'duzenli') {
      if (!this.duzenliIslerYuklendi) {
        this.duzenliIslerYuklendi = true;
        this.duzenliListeIstekleri.next();
      }
      return;
    }
    if (!this.urunlerYuklendi) {
      this.urunlerYuklendi = true;
      this.urunListeIstekleri.next();
    }
  }

  private giderleriYenile(): void {
    this.giderlerYuklendi = true;
    this.giderListeIstekleri.next();
  }

  private duzenliIsleriYenile(): void {
    this.duzenliIslerYuklendi = true;
    this.duzenliListeIstekleri.next();
  }

  private urunleriYenile(): void {
    this.urunlerYuklendi = true;
    this.urunListeIstekleri.next();
  }

  private listeAkislariniKur(): void {
    this.aylikListeIstekleri.pipe(
      switchMap(() => {
        if (!this.permissions.hasAccess(this.izin.Modul) || !this.permissions.hasAccess(this.izin.KayitGoruntule)) return EMPTY;
        const tarih = this.seciliDonem();
        this.aylikLoading.set(true);
        return this.service.aylikIsler(tarih.getFullYear(), tarih.getMonth() + 1, {
          pageNumber: this.aylikPageNumber(),
          pageSize: this.aylikPageSize(),
          arama: this.arama().trim() || undefined,
          iptalEdilenleriDahilEt: this.iptalEdilenleriGoster(),
        }).pipe(finalize(() => this.aylikLoading.set(false)));
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(result => {
      if (!result.isSuccess || !result.value) {
        this.toast.error(result.error ?? 'Aylık işler yüklenemedi.');
        return;
      }
      const value = result.value;
      this.aylikIsler.set(value.items ?? []);
      this.aylikFinansOzeti.set(value.finansOzeti ?? []);
      this.aylikGrupToplamlari.set(value.grupToplamlari ?? []);
      this.aylikPageNumber.set(value.pageNumber);
      this.aylikPageSize.set(value.pageSize);
      this.aylikTotalCount.set(value.totalCount);
      this.aylikTotalPages.set(value.totalPages);
      this.aylikHasPreviousPage.set(value.hasPreviousPage);
      this.aylikHasNextPage.set(value.hasNextPage);
    });

    this.giderListeIstekleri.pipe(
      switchMap(() => {
        if (!this.permissions.hasAccess(this.izin.Modul) || !this.permissions.hasAccess(this.izin.GiderGoruntule)) return EMPTY;
        this.giderLoading.set(true);
        return this.service.giderler({
          pageNumber: this.giderPageNumber(),
          pageSize: this.giderPageSize(),
          arama: this.giderArama().trim() || undefined,
        }).pipe(finalize(() => this.giderLoading.set(false)));
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(result => {
      if (!result.isSuccess || !result.value) {
        this.toast.error(result.error ?? 'Giderler yüklenemedi.');
        return;
      }
      const value = result.value;
      this.giderler.set(value.items ?? []);
      this.giderToplamlari.set(value.toplamlar ?? []);
      this.giderPageNumber.set(value.pageNumber);
      this.giderPageSize.set(value.pageSize);
      this.giderTotalCount.set(value.totalCount);
      this.giderTotalPages.set(value.totalPages);
      this.giderHasPreviousPage.set(value.hasPreviousPage);
      this.giderHasNextPage.set(value.hasNextPage);
    });

    this.duzenliListeIstekleri.pipe(
      switchMap(() => {
        if (!this.ayarOkuyabilir('duzenli')) return EMPTY;
        this.duzenliLoading.set(true);
        return this.service.duzenliIsler({
          pageNumber: this.duzenliPageNumber(),
          pageSize: this.duzenliPageSize(),
          arama: this.duzenliArama().trim() || undefined,
        }).pipe(finalize(() => this.duzenliLoading.set(false)));
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(result => {
      if (!result.isSuccess || !result.value) {
        this.toast.error(result.error ?? 'Düzenli işler yüklenemedi.');
        return;
      }
      const value = result.value;
      this.duzenliIsler.set(value.items ?? []);
      this.duzenliPageNumber.set(value.pageNumber);
      this.duzenliPageSize.set(value.pageSize);
      this.duzenliTotalCount.set(value.totalCount);
      this.duzenliTotalPages.set(value.totalPages);
      this.duzenliHasPreviousPage.set(value.hasPreviousPage);
      this.duzenliHasNextPage.set(value.hasNextPage);
    });

    this.urunListeIstekleri.pipe(
      switchMap(() => {
        if (!this.ayarOkuyabilir('tarifeler')) return EMPTY;
        this.urunLoading.set(true);
        return this.service.urunler({
          pageNumber: this.urunPageNumber(),
          pageSize: this.urunPageSize(),
          arama: this.tarifeArama().trim() || undefined,
        }).pipe(finalize(() => this.urunLoading.set(false)));
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(result => {
      if (!result.isSuccess || !result.value) {
        this.toast.error(result.error ?? 'Ürün ve tarifeler yüklenemedi.');
        return;
      }
      const value = result.value;
      this.urunler.set(value.items ?? []);
      this.urunPageNumber.set(value.pageNumber);
      this.urunPageSize.set(value.pageSize);
      this.urunTotalCount.set(value.totalCount);
      this.urunTotalPages.set(value.totalPages);
      this.urunHasPreviousPage.set(value.hasPreviousPage);
      this.urunHasNextPage.set(value.hasNextPage);
    });

    this.aylikAramaIstekleri.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => {
      this.aylikPageNumber.set(1);
      this.aylikListeyiYukle();
    });
    this.giderAramaIstekleri.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => {
      this.giderPageNumber.set(1);
      this.giderListeIstekleri.next();
    });
    this.duzenliAramaIstekleri.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => {
      this.duzenliPageNumber.set(1);
      this.duzenliListeIstekleri.next();
    });
    this.urunAramaIstekleri.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => {
      this.urunPageNumber.set(1);
      this.urunListeIstekleri.next();
    });
  }

  private bosOzelIsFormu(): FinansOzelIsKaydetRequest {
    return { isTuru: '', musteri: this.finansMusterisi, projeId: null, isAdi: '', aciklama: null, miktar: 1, birim: 'Adet', isTarihi: this.tarihMetni(this.seciliDonem()), hesaplamaYontemi: 3, raporGrubu: 'Diğer', birimFiyat: 0, paraBirimi: 'EUR', kdvOrani: 20 };
  }
  private bosGiderFormu(): FinansGiderKaydetRequest { return { tarih: this.tarihMetni(new Date()), finansTarihi: this.tarihMetni(new Date()), miktar: 1, birim: 'Adet', birimFiyat: 0, belgeNo: null, avansMi: false, mahsupEdilenAvansId: null, kategoriId: 0, giderKalemiId: null, altKategori: null, firmaVeyaKisi: null, aciklama: '', tutar: 0, paraBirimi: 'TRY', kdvDahil: false, kdvOrani: 20, projeId: null, isTuru: null }; }
  private bosDuzenliIsFormu(): FinansDuzenliIsKaydetRequest { return { projeId: null, isAdi: '', isTuru: '', musteri: this.finansMusterisi, aciklama: null, tekrarSikligi: 'Aylık', baslangicTarihi: this.tarihMetni(new Date()), bitisTarihi: null, olusturmaGunu: 1, miktar: 1, birim: 'Hizmet', birimFiyat: 0, paraBirimi: 'EUR', kdvOrani: 20, aktif: true }; }
  private bosUrunFormu() { return { kod: '', ad: '', fiyatlandirmaBirimi: 2 as 1 | 2 | 3 | 4, birimFiyat: 0, paraBirimi: 'EUR', kdvOrani: 20, aktif: true, sira: 0, isTuru: 0, sandikAdi: '', sandikTipi: '', boy: null as number | null, en: null as number | null, yukseklik: null as number | null, icSandikSablonId: null as number | null }; }
  private ayinIlkGunu(tarih: Date): Date { return new Date(tarih.getFullYear(), tarih.getMonth(), 1); }
  private tarihMetni(tarih: Date): string { return `${tarih.getFullYear()}-${String(tarih.getMonth() + 1).padStart(2, '0')}-${String(tarih.getDate()).padStart(2, '0')}`; }
  private temizle(value: string | null | undefined): string | null { const temiz = value?.trim(); return temiz || null; }
  private dosyaIndir(blob: Blob, dosyaAdi: string): void { const url = URL.createObjectURL(blob); const baglanti = document.createElement('a'); baglanti.href = url; baglanti.download = dosyaAdi; baglanti.click(); URL.revokeObjectURL(url); }
}
