import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, finalize, forkJoin, switchMap } from 'rxjs';
import { AmbalajService } from '../../core/services/ambalaj.service';
import { FinansService } from '../../core/services/finans.service';
import { ToastService } from '../../core/services/toast.service';
import { BreadcrumbComponent } from '../../shared/components/breadcrumb/breadcrumb.component';
import { ServerPagerComponent } from '../../shared/components/server-pager/server-pager.component';
import {
  FinansAylikIs,
  FinansAylikFinansOzeti,
  FinansAylikGrupToplami,
  FinansDuzenliIs,
  FinansDuzenliIsKaydetRequest,
  FinansFaturaOlusturRequest,
  FinansGider,
  FinansGiderKategori,
  FinansGiderKaydetRequest,
  FinansIsKaydi,
  FinansOzelIsKaydetRequest,
  FinansSiparis,
  FinansSiparisDetay,
  FinansSiparisOlusturRequest,
  FinansUrun,
  FinansUrunKaydetRequest,
  FinansParaToplami,
  AmbalajIcSandikSablonDto,
} from '../../shared/models';

interface AylikGrup {
  ad: string;
  satirlar: FinansAylikIs[];
  eur: number;
  try: number;
}

type AnaSekme = 'akis' | 'giderler' | 'ayarlar';
type AyarGorunumu = 'duzenli' | 'tarifeler';
type RaporFormati = 'pdf' | 'excel' | 'ayri';

@Component({
  selector: 'app-finans-yonetimi',
  standalone: true,
  imports: [BreadcrumbComponent, DatePipe, DecimalPipe, FormsModule, ServerPagerComponent],
  templateUrl: './finans-aylik.component.html',
  styleUrl: './finans-aylik.component.scss',
})
export class FinansYonetimiComponent implements OnInit {
  private service = inject(FinansService);
  private ambalajService = inject(AmbalajService);
  private toast = inject(ToastService);
  private destroyRef = inject(DestroyRef);

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
  activeTab = signal<AnaSekme>('akis');
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
  acikProjeler = signal(new Set<string>());

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

  siparisAcik = signal(false);
  siparisKaydediliyor = signal(false);
  siparisYukleniyor = signal(false);
  siparisHatasi = signal('');
  siparisSatiri = signal<FinansAylikIs | null>(null);
  siparisKayitlari = signal<FinansIsKaydi[]>([]);
  siparisForm = this.bosSiparisFormu();
  siparisMiktarlari: Record<number, { adet: number; m3: number }> = {};

  faturalandirilanSiparisId = signal<number | null>(null);

  giderAcik = signal(false);
  giderKaydediliyor = signal(false);
  giderHatasi = signal('');
  giderRaporIndiriliyor = signal<'pdf' | 'excel' | null>(null);
  duzenlenenGiderId = signal<number | null>(null);
  giderForm = this.bosGiderFormu();

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
    const anaProjeAnahtarlari = new Set(tumSatirlar.filter(satir => satir.isTuru === 1).map(satir => satir.projeBirimAnahtari));
    const satirlar = tumSatirlar.filter(satir => !(anaProjeAnahtarlari.has(satir.projeBirimAnahtari)
      && [2, 3, 4, 5, 9].includes(satir.isTuru)));
    const sabitIsler = satirlar.filter(satir => ['Kira', 'Sevkiyat'].includes(satir.isGrubu));
    const anaAmbalajlar = satirlar.filter(satir => satir.isTuru === 1
      || ([2, 3, 4, 5, 9].includes(satir.isTuru) && !anaProjeAnahtarlari.has(satir.projeBirimAnahtari)));
    const ekstraIsler = satirlar.filter(satir => satir.isTuru === 8 && !['Kira', 'Sevkiyat'].includes(satir.isGrubu));
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
      kategoriler: this.service.giderKategorileri(),
      icSandikSablonlari: this.ambalajService.getIcSandikSablonlari(),
    }).subscribe(result => {
      if (result.kategoriler.isSuccess) this.giderKategorileri.set((result.kategoriler.value ?? []).filter(kategori => kategori.aktif));
      if (result.icSandikSablonlari.isSuccess) this.icSandikSablonlari.set(result.icSandikSablonlari.value ?? []);
      this.loading.set(false);
    });
    this.donemiYukle();
  }

  selectTab(tab: AnaSekme): void {
    this.activeTab.set(tab);
    if (tab === 'giderler' && !this.giderlerYuklendi) {
      this.giderlerYuklendi = true;
      this.giderListeIstekleri.next();
    }
    if (tab === 'ayarlar') this.ayarListesiniYukle();
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
    const tarih = this.seciliDonem();
    this.service.duzenliIsDonemOlustur(this.tarihMetni(tarih)).subscribe(olusturma => {
      if (!olusturma.isSuccess) this.toast.error(olusturma.error ?? 'Dönem oluşturulamadı.');
      this.aylikListeyiYukle();
    });
  }

  aylikListeyiYukle(): void {
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

  projeAcik(projeBirimAnahtari: string): boolean { return this.acikProjeler().has(projeBirimAnahtari); }
  projeDegistir(satir: FinansAylikIs, event: MouseEvent): void {
    if (satir.isTuru !== 1 || (event.target as HTMLElement).closest('button')) return;
    this.acikProjeler.update(mevcut => {
      const sonraki = new Set(mevcut);
      sonraki.has(satir.projeBirimAnahtari)
        ? sonraki.delete(satir.projeBirimAnahtari)
        : sonraki.add(satir.projeBirimAnahtari);
      return sonraki;
    });
  }

  projeAltKalemleri(satir: FinansAylikIs): FinansAylikIs[] {
    return this.aylikIsler().filter(kalem => kalem.projeBirimAnahtari === satir.projeBirimAnahtari
      && [2, 3, 4, 5, 9].includes(kalem.isTuru));
  }

  satirDurumu(satir: FinansAylikIs): string {
    if (satir.isTuru !== 1) return satir.durum;

    const projeIsleri = this.aylikIsler().filter(kalem => kalem.projeBirimAnahtari === satir.projeBirimAnahtari
      && [1, 2, 3, 4, 5, 9].includes(kalem.isTuru)
      && !kalem.iptalEdildi
      && kalem.miktar > 0.000001);
    if (!projeIsleri.length) return satir.durum;

    const siparisAcilanlar = projeIsleri.filter(kalem => kalem.siparisMiktari > 0.000001);
    if (!siparisAcilanlar.length) return 'Sipariş Bekliyor';
    if (projeIsleri.some(kalem => kalem.miktar - kalem.siparisMiktari > 0.000001)) return 'Kısmi Sipariş';

    const faturalananlar = projeIsleri.filter(kalem => kalem.faturalananMiktar > 0.000001);
    if (!faturalananlar.length) return 'Fatura Bekliyor';
    if (projeIsleri.some(kalem => kalem.miktar - kalem.faturalananMiktar > 0.000001)) return 'Kısmi Tamamlandı';
    return 'Tamamlandı';
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
    this.aylikDegerSatiri.set(satir);
    this.aylikDeger = satir.tutarDuzenlenebilir ? satir.netTutar : satir.miktar;
    this.aylikDegerHatasi.set('');
    this.aylikDegerAcik.set(true);
  }

  aylikDegerKaydet(): void {
    const satir = this.aylikDegerSatiri();
    const deger = Number(this.aylikDeger);
    if (!satir?.ozelIsId || deger < 0 || (!satir.tutarDuzenlenebilir && deger === 0)) {
      this.aylikDegerHatasi.set('Sıfırdan büyük geçerli bir değer girin.');
      return;
    }
    const request = satir.tutarDuzenlenebilir ? { netBirimFiyat: deger } : { miktar: deger };
    this.aylikDegerKaydediliyor.set(true);
    this.service.ozelIsAylikDegerGuncelle(satir.ozelIsId, request).subscribe(result => {
      this.aylikDegerKaydediliyor.set(false);
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
      if (!result.isSuccess) this.toast.error(result.error ?? 'İş geri alınamadı.');
      else {
        this.toast.success('İş yeniden aktifleştirildi.');
        this.aylikListeyiYukle();
      }
    });
  }

  yeniOzelIs(): void {
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
      musteri: this.finansMusterisi,
      aciklama: this.temizle(form.aciklama),
      miktar: Number(form.miktar),
      birimFiyat: Number(form.birimFiyat),
      kdvOrani: Number(form.kdvOrani),
    };
    this.ozelIsKaydediliyor.set(true);
    this.service.ozelIsOlustur(request).subscribe(result => {
      this.ozelIsKaydediliyor.set(false);
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
    if (!satir.isKaydiIds.length || satir.durum.toLocaleLowerCase('tr-TR').includes('miktar bekliyor')) return;
    this.siparisSatiri.set(satir);
    this.siparisForm = this.bosSiparisFormu();
    this.siparisKayitlari.set([]);
    this.siparisMiktarlari = {};
    this.siparisHatasi.set('');
    this.siparisAcik.set(true);
    this.siparisYukleniyor.set(true);
    this.service.isKayitlariSecim(satir.isKaydiIds).subscribe(result => {
      this.siparisYukleniyor.set(false);
      if (!result.isSuccess) {
        this.siparisHatasi.set(result.error ?? 'İş kayıtları yüklenemedi.');
        return;
      }
      this.siparisKayitlariniKur(result.value ?? []);
    });
  }

  siparisKaydet(): void {
    const kalemler = this.siparisKayitlari().map(kayit => ({
      isKaydiId: kayit.id,
      adet: Number(this.siparisMiktarlari[kayit.id]?.adet ?? 0),
      m3: Number(this.siparisMiktarlari[kayit.id]?.m3 ?? 0),
    }));
    if (!this.siparisForm.poNumarasi.trim() || !this.siparisForm.siparisTarihi || !kalemler.length
      || kalemler.some(kalem => kalem.adet <= 0 && kalem.m3 <= 0)) {
      this.siparisHatasi.set('PO numarası, tarih ve sıfırdan büyük kalem miktarları zorunludur.');
      return;
    }
    const request: FinansSiparisOlusturRequest = {
      poNumarasi: this.siparisForm.poNumarasi.trim(),
      siparisTarihi: this.siparisForm.siparisTarihi,
      aciklama: this.temizle(this.siparisForm.aciklama),
      kalemler,
    };
    this.siparisKaydediliyor.set(true);
    this.service.siparisOlustur(request).subscribe(result => {
      this.siparisKaydediliyor.set(false);
      if (!result.isSuccess) {
        this.siparisHatasi.set(result.error ?? 'Sipariş oluşturulamadı.');
        return;
      }
      this.siparisAcik.set(false);
      this.toast.success('Sipariş oluşturuldu.');
      this.aylikListeyiYukle();
    });
  }

  satiriFaturalandir(satir: FinansAylikIs): void {
    const poNumaralari = [...new Set(satir.poNumaralari.map(po => po.trim()).filter(Boolean))];
    if (!poNumaralari.length) {
      this.toast.error('Satırda faturalandırılabilecek bir PO numarası bulunmuyor.');
      return;
    }
    this.faturalandirilanSiparisId.set(-1);
    forkJoin(poNumaralari.map(poNumarasi => this.service.siparisler({
      poNumarasi,
      pageNumber: 1,
      pageSize: 25,
    }))).subscribe({
      next: sonuclar => {
        const bulunanSiparisler = sonuclar
          .filter(sonuc => sonuc.isSuccess)
          .flatMap(sonuc => sonuc.value?.items ?? [])
          .filter(siparis => poNumaralari.some(po => po.localeCompare(siparis.poNumarasi, 'tr-TR', { sensitivity: 'base' }) === 0));
        const siparisler = [...new Map(bulunanSiparisler.map(siparis => [siparis.id, siparis])).values()]
          .sort((sol, sag) => Number(sag.kalanM3 > 0.000001) - Number(sol.kalanM3 > 0.000001));
        if (!siparisler.length) {
          this.faturalandirilanSiparisId.set(null);
          this.toast.error('Satırın PO numarasıyla eşleşen sipariş bulunamadı.');
          return;
        }
        this.faturalandirilabilirSiparisiBul(satir, siparisler);
      },
      error: () => {
        this.faturalandirilanSiparisId.set(null);
        this.toast.error('Sipariş bilgisi yüklenemedi.');
      },
    });
  }

  yeniGider(): void {
    this.duzenlenenGiderId.set(null);
    this.giderForm = this.bosGiderFormu();
    this.giderHatasi.set('');
    this.giderAcik.set(true);
  }

  giderDuzenle(gider: FinansGider): void {
    this.duzenlenenGiderId.set(gider.id);
    this.giderForm = { tarih: gider.tarih.slice(0, 10), kategoriId: gider.kategoriId, altKategori: gider.altKategori ?? null, firmaVeyaKisi: gider.firmaVeyaKisi ?? null, aciklama: gider.aciklama, tutar: gider.tutar, paraBirimi: gider.paraBirimi, kdvDahil: gider.kdvDahil, kdvOrani: gider.kdvOrani, projeId: gider.projeId ?? null, isTuru: gider.isTuru ?? null };
    this.giderHatasi.set('');
    this.giderAcik.set(true);
  }

  giderKaydet(): void {
    if (!this.giderForm.tarih || this.giderForm.kategoriId <= 0 || !this.giderForm.aciklama.trim() || this.giderForm.tutar <= 0) {
      this.giderHatasi.set('Tarih, kategori, açıklama ve sıfırdan büyük tutar zorunludur.');
      return;
    }
    const id = this.duzenlenenGiderId();
    const request = { ...this.giderForm, aciklama: this.giderForm.aciklama.trim() };
    this.giderKaydediliyor.set(true);
    const operation = id ? this.service.giderGuncelle(id, request) : this.service.giderOlustur(request);
    operation.subscribe(result => {
      this.giderKaydediliyor.set(false);
      if (!result.isSuccess) this.giderHatasi.set(result.error ?? 'Gider kaydedilemedi.');
      else {
        this.giderAcik.set(false);
        this.toast.success(id ? 'Gider güncellendi.' : 'Gider kaydedildi.');
        this.giderleriYenile();
      }
    });
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
    this.duzenlenenDuzenliIsId.set(null);
    this.duzenliIsForm = this.bosDuzenliIsFormu();
    this.duzenliIsHatasi.set('');
    this.duzenliIsAcik.set(true);
  }

  duzenliIsDuzenle(is: FinansDuzenliIs): void {
    this.duzenlenenDuzenliIsId.set(is.id);
    this.duzenliIsForm = { projeId: null, isAdi: is.isAdi, isTuru: is.isTuru, musteri: this.finansMusterisi, aciklama: is.aciklama, tekrarSikligi: is.tekrarSikligi, baslangicTarihi: is.baslangicTarihi.slice(0, 10), bitisTarihi: is.bitisTarihi?.slice(0, 10) ?? null, olusturmaGunu: is.olusturmaGunu, miktar: is.miktar, birim: is.birim, birimFiyat: is.birimFiyat, paraBirimi: is.paraBirimi, kdvOrani: is.kdvOrani, aktif: is.aktif };
    this.duzenliIsHatasi.set('');
    this.duzenliIsAcik.set(true);
  }

  duzenliIsKaydet(): void {
    const form = this.duzenliIsForm;
    if (!form.isAdi.trim() || !form.isTuru.trim() || !form.baslangicTarihi || form.olusturmaGunu < 1 || form.olusturmaGunu > 31 || form.miktar <= 0 || form.birimFiyat < 0 || form.kdvOrani < 0 || form.kdvOrani > 100) {
      this.duzenliIsHatasi.set('İş adı, tür, tarih, gün, miktar, fiyat ve KDV alanlarını kontrol edin.');
      return;
    }
    const id = this.duzenlenenDuzenliIsId();
    const request: FinansDuzenliIsKaydetRequest = { ...form, isAdi: form.isAdi.trim(), isTuru: form.isTuru.trim(), aciklama: this.temizle(form.aciklama), bitisTarihi: form.bitisTarihi || null };
    this.duzenliIsKaydediliyor.set(true);
    const operation = id ? this.service.duzenliIsGuncelle(id, request) : this.service.duzenliIsOlustur(request);
    operation.subscribe(result => {
      this.duzenliIsKaydediliyor.set(false);
      if (!result.isSuccess) this.duzenliIsHatasi.set(result.error ?? 'Düzenli iş kaydedilemedi.');
      else {
        this.duzenliIsAcik.set(false);
        this.toast.success(id ? 'Düzenli iş güncellendi.' : 'Düzenli iş eklendi.');
        this.duzenliIsleriYenile();
      }
    });
  }

  yeniUrun(): void {
    this.duzenlenenUrunId.set(null);
    this.urunForm = this.bosUrunFormu();
    this.urunHatasi.set('');
    this.urunAcik.set(true);
  }

  urunDuzenle(urun: FinansUrun): void {
    const eslesme = urun.eslesmeler[0];
    this.duzenlenenUrunId.set(urun.id);
    this.urunForm = { kod: urun.kod, ad: urun.ad, fiyatlandirmaBirimi: urun.fiyatlandirmaBirimi, birimFiyat: urun.birimFiyat, paraBirimi: urun.paraBirimi, kdvOrani: urun.kdvOrani, aktif: urun.aktif, sira: urun.sira, isTuru: eslesme?.isTuru ?? 0, sandikAdi: eslesme?.sandikAdi ?? '', sandikTipi: eslesme?.sandikTipi ?? '', boy: eslesme?.boy ?? null, en: eslesme?.en ?? null, yukseklik: eslesme?.yukseklik ?? null, icSandikSablonId: eslesme?.icSandikSablonId ?? null };
    this.urunHatasi.set('');
    this.urunAcik.set(true);
  }

  urunKaydet(): void {
    const form = this.urunForm;
    if (!form.kod.trim() || !form.ad.trim() || form.birimFiyat < 0 || form.kdvOrani < 0 || form.kdvOrani > 100) {
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
      if (!result.isSuccess) this.urunHatasi.set(result.error ?? 'Tarife kaydedilemedi.');
      else {
        this.urunAcik.set(false);
        this.toast.success(id ? 'Tarife güncellendi.' : 'Tarife eklendi.');
        this.urunleriYenile();
      }
    });
  }

  urunSil(urun: FinansUrun): void {
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
      const olcu = eslesme.sandikTipi === 'Katlanır Sandık' ? ` · ${eslesme.boy}×${eslesme.en}×${eslesme.yukseklik} mm` : '';
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

  private siparisKayitlariniKur(kayitlar: FinansIsKaydi[]): void {
    this.siparisKayitlari.set(kayitlar);
    this.siparisMiktarlari = Object.fromEntries(kayitlar.map(kayit => [kayit.id, { adet: kayit.siparisBekleyenAdet, m3: kayit.siparisBekleyenM3 }]));
  }

  private aylikKayitOlustur(satir: FinansAylikIs, id: number, index: number): FinansIsKaydi {
    const m3 = satir.birim.toLocaleLowerCase('tr-TR').includes('m³') ? satir.miktar / satir.isKaydiIds.length : 0;
    const adet = m3 ? 0 : satir.miktar / satir.isKaydiIds.length;
    return { id, projeId: null, projeNo: satir.projeNo, musteri: this.finansMusterisi, sandikNo: `${satir.ozelIsId ?? 'AY'}-${index + 1}`, sandikAdi: satir.isAdi, sandikTipi: satir.sandikTipi, boy: satir.boy, en: satir.en, yukseklik: satir.yukseklik, icSandikSablonId: null, isTuru: satir.isTuru, adet, birimM3: 0, toplamM3: m3, siparisAdedi: 0, siparisM3: 0, siparisBekleyenAdet: adet, siparisBekleyenM3: m3, faturalananAdet: 0, faturalananM3: 0, poNumaralari: satir.poNumaralari, faturaNumaralari: satir.faturaNumaralari, kaynakAktif: true };
  }

  private faturalandirilabilirSiparisiBul(satir: FinansAylikIs, siparisler: FinansSiparis[]): void {
    forkJoin(siparisler.map(siparis => this.service.siparisDetay(siparis.id))).subscribe({
      next: detaylar => {
        const adayIndex = detaylar.findIndex(detay => detay.isSuccess && detay.value?.kalemler.some(kalem =>
          satir.isKaydiIds.includes(kalem.isKaydiId)
          && (kalem.kalanAdet > 0.000001 || kalem.kalanM3 > 0.000001)));
        if (adayIndex < 0) {
          this.faturalandirilanSiparisId.set(null);
          this.toast.error('Bu PO kayıtlarında fatura bekleyen kalem bulunmuyor.');
          return;
        }
        const detay = detaylar[adayIndex].value;
        if (!detay) {
          this.faturalandirilanSiparisId.set(null);
          this.toast.error('Sipariş detayları yüklenemedi.');
          return;
        }
        this.siparisiFaturalandir(satir, siparisler[adayIndex], detay);
      },
      error: () => {
        this.faturalandirilanSiparisId.set(null);
        this.toast.error('Sipariş detayları yüklenemedi.');
      },
    });
  }

  private siparisiFaturalandir(satir: FinansAylikIs, siparis: FinansSiparis, detay: FinansSiparisDetay): void {
    this.faturalandirilanSiparisId.set(siparis.id);
    const kalemler = detay.kalemler
        .filter(kalem => satir.isKaydiIds.includes(kalem.isKaydiId)
          && (kalem.kalanAdet > 0.000001 || kalem.kalanM3 > 0.000001))
        .map(kalem => ({ siparisKalemiId: kalem.id, adet: kalem.kalanAdet, m3: kalem.kalanM3 }));
    const request: FinansFaturaOlusturRequest = {
      siparisId: siparis.id,
      faturaNumarasi: `İŞARETLİ-${siparis.kayitNo}`,
      faturaTarihi: this.tarihMetni(new Date()),
      aciklama: 'Aylık finans iş takibinden faturalandı olarak işaretlendi.',
      kalemler,
    };
    this.service.faturaOlustur(request).subscribe(result => {
      this.faturalandirilanSiparisId.set(null);
      if (!result.isSuccess) {
        this.toast.error(result.error ?? 'Fatura oluşturulamadı.');
        return;
      }
      this.toast.success('Sipariş faturalandı olarak işaretlendi.');
      this.aylikListeyiYukle();
    });
  }

  private grupAdi(deger: string): string {
    return deger.trim() || 'Diğer';
  }

  private grupOlustur(ad: string, satirlar: FinansAylikIs[]): AylikGrup {
    const toplamlar = this.aylikGrupToplamlari()
      .filter(item => this.gorunumGrubu(item.grup) === ad)
      .reduce((toplam, item) => {
        if (item.paraBirimi === 'EUR') toplam.eur += item.toplamTutar;
        if (item.paraBirimi === 'TRY') toplam.try += item.toplamTutar;
        return toplam;
      }, { eur: 0, try: 0 });
    return { ad, satirlar, eur: toplamlar.eur, try: toplamlar.try };
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
  private bosSiparisFormu(): Omit<FinansSiparisOlusturRequest, 'kalemler'> { return { poNumarasi: '', siparisTarihi: this.tarihMetni(new Date()), aciklama: null }; }
  private bosGiderFormu(): FinansGiderKaydetRequest { return { tarih: this.tarihMetni(new Date()), kategoriId: 0, altKategori: null, firmaVeyaKisi: null, aciklama: '', tutar: 0, paraBirimi: 'TRY', kdvDahil: false, kdvOrani: 20, projeId: null, isTuru: null }; }
  private bosDuzenliIsFormu(): FinansDuzenliIsKaydetRequest { return { projeId: null, isAdi: '', isTuru: '', musteri: this.finansMusterisi, aciklama: null, tekrarSikligi: 'Aylık', baslangicTarihi: this.tarihMetni(new Date()), bitisTarihi: null, olusturmaGunu: 1, miktar: 1, birim: 'Hizmet', birimFiyat: 0, paraBirimi: 'EUR', kdvOrani: 20, aktif: true }; }
  private bosUrunFormu() { return { kod: '', ad: '', fiyatlandirmaBirimi: 2 as 1 | 2, birimFiyat: 0, paraBirimi: 'EUR', kdvOrani: 20, aktif: true, sira: 0, isTuru: 0, sandikAdi: '', sandikTipi: '', boy: null as number | null, en: null as number | null, yukseklik: null as number | null, icSandikSablonId: null as number | null }; }
  private ayinIlkGunu(tarih: Date): Date { return new Date(tarih.getFullYear(), tarih.getMonth(), 1); }
  private tarihMetni(tarih: Date): string { return `${tarih.getFullYear()}-${String(tarih.getMonth() + 1).padStart(2, '0')}-${String(tarih.getDate()).padStart(2, '0')}`; }
  private temizle(value: string | null | undefined): string | null { const temiz = value?.trim(); return temiz || null; }
  private dosyaIndir(blob: Blob, dosyaAdi: string): void { const url = URL.createObjectURL(blob); const baglanti = document.createElement('a'); baglanti.href = url; baglanti.download = dosyaAdi; baglanti.click(); URL.revokeObjectURL(url); }
}
