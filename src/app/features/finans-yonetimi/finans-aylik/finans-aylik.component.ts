import { DatePipe, DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { finansHacimGecerli } from '../ortak/finans-hacim';
import {
  FINANS_SANDIK_DURUM_SUZGECLERI,
  FinansSandikDurumSuzgeci,
  aramayaUyar,
  kategoriKirilimKayitlari,
  kirilimSandiklari,
  sandikDurumSuzgeceUyar,
  sarfKaydi,
} from '../ortak/finans-kirilim';
import { FinansProjeBelgeleriComponent } from '../ortak/finans-proje-belgeleri.component';
import { Component, DestroyRef, OnInit, WritableSignal, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { EMPTY, Subject, debounceTime, distinctUntilChanged, finalize, forkJoin, of, switchMap } from 'rxjs';
import { AmbalajService } from '../../../core/services/ambalaj.service';
import { FinansService } from '../../../core/services/finans.service';
import { ToastService } from '../../../core/services/toast.service';
import { PermissionService } from '../../../core/services/permission.service';
import { AMBALAJ_YETKI, FINANS_YETKI } from '../../../core/constants/yetki-kodlari';
import { FinansPanelComponent } from '../finans-panel/finans-panel.component';
import { FinansKayitAramaAcilisi, FinansKayitAramaComponent, FinansKayitAramaGorunumu } from '../finans-kayit-arama/finans-kayit-arama.component';
import { FinansDagitimComponent } from '../finans-dagitim/finans-dagitim.component';
import { FinansKayitDetayComponent } from '../finans-kayit-detay/finans-kayit-detay.component';
import { FinansBelgelerListesiComponent } from '../finans-belgeler-listesi/finans-belgeler-listesi.component';
import { FinansRaporlarComponent } from '../finans-raporlar/finans-raporlar.component';
import { FinansKategorilerComponent } from '../finans-kategoriler/finans-kategoriler.component';
import { FinansParametrelerComponent } from '../finans-parametreler/finans-parametreler.component';
import { FinansProjeDetayComponent } from '../finans-proje-detay/finans-proje-detay.component';
import { FinansProjeSeciciComponent } from '../finans-proje-secici/finans-proje-secici.component';
import { FinansMunferitIslerComponent } from '../finans-munferit-isler/finans-munferit-isler.component';
import {
  FINANS_GIDER_TANIM_SEKMELERI,
  FinansSekme,
  FinansAltSekme,
  finansAltSekmeAcik,
  finansAltSekmeYazilabilir,
  finansFaturaGirilebilir,
  finansHerhangiSekmeAcik,
  finansIlkAltSekme,
  finansIlkSekme,
  finansIsDuzenlenebilir,
  finansKayitOkunabilir,
  finansPoGirilebilir,
  finansSekmeAcik,
  finansSekmeYazilabilir,
  finansVadeUyarisiGorunur,
} from '../ortak/finans-izinleri';
import {
  FINANS_KATEGORILERI,
  faturaKarsilanmaAnahtari,
  isDurumuAnahtari,
  kategoriAnahtari,
  poOnayDurumuAnahtari,
  poOnayaGonderilebilir,
  siparisKarsilanmaAnahtari,
} from '../ortak/finans-etiketleri';
import { poOnayBildirimleri } from '../ortak/finans-po-onayi';
import { TranslationService } from '../../../core/services/translation.service';
import { FinansIsKategorisi, FinansKarsilanma, FinansOdemeFiltresi, FinansPoOnayDurumu } from '../../../core/constants/enums';
import {
  FinansBekleyenAsama,
  FinansTarifeDuzeltmeOnizleme,
  FinansVadeUyarilari,
  FinansVarlikTuru,
} from '../../../shared/models/finans-v2.model';
import { FinansParaBirimiService } from '../../../core/services/finans-para-birimi.service';
import { ApiResult } from '../../../shared/models/common.model';
import { BreadcrumbComponent } from '../../../shared/components/breadcrumb/breadcrumb.component';
import { ServerPagerComponent } from '../../../shared/components/server-pager/server-pager.component';
import { IslemlerMenusuComponent } from '../../../shared/components/islemler-menusu/islemler-menusu.component';
import {
  FinansAylikDegerRequest,
  FinansAylikIs,
  FinansAylikProjeOzeti,
  FinansIsKaydi,
  FinansProjeSandikKirilimi,
  FinansSandikKirilimKalemi,
  FinansSandikKirilimSatiri,
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
  FinansSayfaliSonuc,
  FinansSiparis,
  FinansTarifeSurumu,
  AmbalajIcSandikSablonDto,
  onayaAlindi,
} from '../../../shared/models';
import { dosyayiKaydet } from '../../../core/services/dosya-kaydet';
import { ConfirmService, duzMetin } from '../../../core/services/confirm.service';

/** Para birimi bazında toplam; para birimleri toplanmaz, çevrilmez (F1). */
interface ParaTutari {
  paraBirimi: string;
  tutar: number;
}

interface AylikGrup {
  ad: string;
  satirlar: FinansAylikIs[];
  toplamlar: ParaTutari[];
}

/** Aylık görünümde proje satırı; kategorileri, sandıkları ve PO/faturaları sağdaki proje panelinde açılır (F5). */
interface AylikProjeBlogu {
  anahtar: string;
  projeId: number | null;
  projeNo: string;
  musteri: string;
  /** Projenin ayın bütün aktif kalemlerinden türetilen birleşik durumu (F7); iptal satırlarında yoktur. */
  ozet: FinansAylikProjeOzeti | null;
  satirlar: FinansAylikIs[];
  /** Projeye bağlı özel/düzenli işler; proje durumuna katılmaz, ayrı alt grupta listelenir. */
  ozelIsler: FinansAylikIs[];
}

/** Proje panelinin sekmeleri: ayın kategori satırları, sandık kırılımı, projenin PO ve faturaları. */
type ProjePaneliSekmesi = 'kategoriler' | 'sandiklar' | 'belgeler';
/** Sunucuda sipariş/fatura dağıtımı yapılamayan, önce miktar veya fiyat bekleyen satır durumları. */
const DAGITIM_BEKLEYEN_DURUMLAR = ['miktar bekliyor', 'fiyatlandırma bekliyor'];

type AnaSekme = FinansSekme;
/** İş ve Tarife Tanımları alt görünümleri; her biri kendi alt sekme iznine bağlıdır (tanımlar sekmesi tavandır). */
type AyarGorunumu = Extract<FinansAltSekme, 'duzenli' | 'tarifeler' | 'parametreler'>;
/** İş Takibi alt görünümleri: aylık görünüm, tüm dönemlerde ara, bekleyen işler. */
type AkisAltSekmesi = Extract<FinansAltSekme, 'aylik' | 'arama' | 'bekleyen'>;
type RaporFormati = 'pdf' | 'excel' | 'ayri';

@Component({
  selector: 'app-finans-yonetimi',
  standalone: true,
  imports: [BreadcrumbComponent, DatePipe, DecimalPipe, NgTemplateOutlet, FormsModule, ServerPagerComponent,
    FinansPanelComponent, FinansKayitAramaComponent, FinansDagitimComponent, FinansKayitDetayComponent, FinansBelgelerListesiComponent,
    FinansRaporlarComponent, FinansKategorilerComponent, FinansProjeSeciciComponent, FinansMunferitIslerComponent,
    FinansParametrelerComponent, FinansProjeDetayComponent, IslemlerMenusuComponent, FinansProjeBelgeleriComponent],
  templateUrl: './finans-aylik.component.html',
  styleUrls: ['./finans-aylik.component.scss', '../ortak/finans-proje-paneli.scss'],
})
export class FinansYonetimiComponent implements OnInit {
  private service = inject(FinansService);
  private ambalajService = inject(AmbalajService);
  private toast = inject(ToastService);
  private confirmService = inject(ConfirmService);
  private destroyRef = inject(DestroyRef);
  readonly permissions = inject(PermissionService);
  readonly paraBirimleri = inject(FinansParaBirimiService);
  readonly izin = FINANS_YETKI;
  /** Vade uyarısı (D3): vadesi geçen ve uyarı penceresinde vadesi gelen ödenmemiş faturalar. */
  readonly vadeUyarilari = signal<FinansVadeUyarilari | null>(null);
  /** Vade uyarıları varsayılan açık: her fatura kalan günüyle tek tek görünür; kullanıcı gizleyebilir. */
  readonly vadeUyariAcik = signal(true);
  /** PO ve Faturalar sekmesinin açılış görünümü; uyarıdan gelindiğinde fatura listesi ve ödeme filtresi. */
  readonly belgeGorunumu = signal<{ anahtar: number; tur: 'Siparis' | 'Fatura'; odeme: FinansOdemeFiltresi | null }>({
    anahtar: 0,
    tur: 'Siparis',
    odeme: null,
  });
  readonly odemeFiltreleri = FinansOdemeFiltresi;
  private readonly translation = inject(TranslationService);
  t(key: string): string {
    return this.translation.translate(`FINANS_V2.${key}`);
  }
  readonly detayHedef = signal<{tur: FinansVarlikTuru; id: number} | null>(null);
  /** Proje detayı (R1 §49, F11): bütün aylardaki kalemler, sandık kırılımı, PO/fatura/ödeme bağlantıları. */
  readonly projeDetay = signal<{ projeNo: string; musteri: string } | null>(null);
  readonly dagitim = signal<{
    tur: 'Siparis' | 'Fatura';
    ids: number[];
    siparisId: number | null;
    donem?: { baslangic: string; bitis: string } | null;
    duzenliIsId?: number | null;
    poNumarasi?: string;
  } | null>(null);
  readonly kategoriAnahtari = kategoriAnahtari;
  readonly siparisKarsilanmaAnahtari = siparisKarsilanmaAnahtari;
  readonly faturaKarsilanmaAnahtari = faturaKarsilanmaAnahtari;
  readonly isDurumuAnahtari = isDurumuAnahtari;
  readonly karsilanma = FinansKarsilanma;
  readonly poOnayDurumuAnahtari = poOnayDurumuAnahtari;
  readonly poOnay = FinansPoOnayDurumu;
  /** PO öncesi iş onayı kuralı açık mı (aylık listenin yanıtından); kapalıyken "Onaya gönder" gösterilmez. */
  readonly poOnayKuraliAcik = signal(false);
  readonly poOnayaGonderiliyor = signal(false);

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
  /** Proje dışı (özel ve düzenli) işlerin görünüm grupları. */
  readonly ozelGrupSirasi = ['Sabit İşler', 'Özel ve Düzenli İşler'];
  readonly ozelIsGrubuSecenekleri = ['Haliade-X', 'SKIT', 'Diğer'];
  readonly birimler = ['Adet', 'm³', 'Ay', 'Sefer', 'Hizmet'];
  /** Tarife eşleşmesinin sandık tipleri. Katlanır sandık tarifeyle eşleşmez (elle fiyatlanır; sunucu 400 döner). */
  readonly sandikTipleri = ['Ahşap Kapalı', 'Kafes Sandık', 'Kontrplak Sandık'];
  readonly sayfaBoyutuSecenekleri = [25, 50, 100] as const;
  readonly isTuruSecenekleri = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(id => ({ id, ad: this.isTuruMetni(id) }));

  loading = signal(true);
  aylikLoading = signal(false);
  /** Açılış sekmesi: rolün erişebildiği ilk sekme (sekme düğümleri rol ağacından gelir). */
  activeTab = signal<AnaSekme>(finansIlkSekme(this.permissions) ?? 'panel');
  /** Finans İş Takibi: aylık görünüm veya bütün dönemlerdeki kalem listesi (arama / bekleyen işler). */
  readonly akisGorunumu = signal<'aylik' | 'kayitlar'>('aylik');
  readonly kayitAramaAcilisi = signal<FinansKayitAramaAcilisi>({ anahtar: 0, gorunum: 'arama' });

  kayitAramasiniAc(gorunum: FinansKayitAramaGorunumu): void {
    if (!this.altSekmeAcik(gorunum)) return;
    this.kayitAramaAcilisi.update((x) => ({ anahtar: x.anahtar + 1, gorunum }));
    this.akisGorunumu.set('kayitlar');
  }

  /** Kontrol panelindeki yaşlandırma kovası: bekleyen işler İş Takibi'nde kovanın aşaması ve eşiğiyle açılır. */
  bekleyenleriAc(kova: { asama: FinansBekleyenAsama; minimumGun: number }): void {
    if (!this.altSekmeAcik('bekleyen')) return;
    this.kayitAramaAcilisi.update((x) => ({ anahtar: x.anahtar + 1, gorunum: 'bekleyen', ...kova }));
    this.akisGorunumu.set('kayitlar');
    this.selectTab('akis');
  }
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
  acikGruplar = signal(new Set<string>(this.ozelGrupSirasi));
  aylikProjeler = signal<FinansAylikProjeOzeti[]>([]);
  aylikProjeOzelIsleri = signal<FinansAylikIs[]>([]);

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
  /** Rapor kategori filtresi (çoklu); boşsa bütün kategoriler. */
  siparisRaporKategorileri = new Set<FinansIsKategorisi>();
  siparisRaporSiparisDurumu: FinansKarsilanma | null = null;
  siparisRaporFaturaDurumu: FinansKarsilanma | null = null;
  readonly raporKategorileri = FINANS_KATEGORILERI;

  aylikDegerAcik = signal(false);
  aylikDegerSatiri = signal<FinansAylikIs | null>(null);
  /** Aylık değer penceresi: bu ayın miktarı ve tarifesi (birim fiyat); yalnız değişen değer gönderilir. */
  aylikMiktar: number | null = null;
  aylikTarife: number | null = null;
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

  /** Düzenli işin dönemlerini ileri tarihe kadar üretme paneli. */
  donemUretIs = signal<FinansDuzenliIs | null>(null);
  donemUretBitis = '';
  donemUretHatasi = signal('');
  donemUretiliyor = signal(false);

  /** Gider formunda isteğe bağlı PO bağlantısı (PO net sonucuna katılır). */
  giderPoArama = '';
  giderPoSecenekleri = signal<FinansSiparis[]>([]);
  giderPoEtiketi = '';
  private readonly giderPoAramalari = new Subject<string>();

  duzenliIsAcik = signal(false);
  duzenliIsKaydediliyor = signal(false);
  duzenliIsHatasi = signal('');
  duzenlenenDuzenliIsId = signal<number | null>(null);
  duzenliIsForm = this.bosDuzenliIsFormu();

  /** D4: tarife değişikliğinden sonra açık kalemleri yeniden fiyatlama paneli. */
  yenidenFiyatlaUrun = signal<FinansUrun | null>(null);
  yenidenFiyatlaAciklama = '';
  yenidenFiyatlaHatasi = signal('');
  yenidenFiyatlaniyor = signal(false);

  /**
   * Hatalı tarife düzeltme: geçmişteki bir sürümün yanlış fiyatı gerekçeyle düzeltilir. Önce etkisi (düzeltilecek ve
   * korunacak kalemler) gösterilir; değerler değişince önizleme düşer, uygulama yalnız görülen etkiyle yapılır.
   */
  tarifeDuzeltmeSurumu = signal<FinansTarifeSurumu | null>(null);
  tarifeDuzeltmeForm = { birimFiyat: 0, kdvOrani: 0, aciklama: '' };
  tarifeDuzeltmeOnizlemesi = signal<FinansTarifeDuzeltmeOnizleme | null>(null);
  tarifeDuzeltmeHatasi = signal('');
  tarifeDuzeltmeYukleniyor = signal(false);

  urunAcik = signal(false);
  urunKaydediliyor = signal(false);
  urunSiliniyorId = signal<number | null>(null);
  urunHatasi = signal('');
  duzenlenenUrunId = signal<number | null>(null);
  urunForm = this.bosUrunFormu();
  /** Düzenlenen tarifenin sürüm geçmişi (eski → yeni); fiyat değişikliği yeni sürüm açar. */
  duzenlenenUrunTarifeleri = signal<FinansTarifeSurumu[]>([]);
  /** Açık uçlu tarife sürümünün sunucudaki bitiş işareti. */
  readonly acikUcluTarifeBitisi = '2200-12-31';

  donemBaslangici = computed(() => this.tarihMetni(this.seciliDonem()));
  donemBitisi = computed(() => {
    const tarih = this.seciliDonem();
    return this.tarihMetni(new Date(tarih.getFullYear(), tarih.getMonth() + 1, 0));
  });
  donemBasligi = computed(() => new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' }).format(this.seciliDonem()));
  /**
   * Proje satırları (F5): her proje kendi kategori satırlarıyla (Ana Ambalaj, Sarf, İlave, İç, Saha, Yedek,
   * Diğer üretim) gelir; sandıklar satır değildir. Proje durumu sunucunun birleşik özetidir (F7).
   */
  aylikProjeBloklari = computed<AylikProjeBlogu[]>(() => {
    const bloklar = new Map<string, AylikProjeBlogu>();
    for (const ozet of this.aylikProjeler())
      bloklar.set(ozet.projeBirimAnahtari, {
        anahtar: ozet.projeBirimAnahtari, projeId: ozet.projeId, projeNo: ozet.projeNo, musteri: ozet.musteri,
        ozet, satirlar: [], ozelIsler: [],
      });
    for (const satir of this.aylikIsler().filter(x => x.kaynakTuru === 'Proje')) {
      const blok = bloklar.get(satir.projeBirimAnahtari)
        ?? { anahtar: satir.projeBirimAnahtari, projeId: satir.projeId, projeNo: satir.projeNo, musteri: satir.musteri, ozet: null, satirlar: [], ozelIsler: [] };
      blok.satirlar.push(satir);
      bloklar.set(blok.anahtar, blok);
    }
    // Projeye bağlı özel/düzenli işler (sunucunun ayrı listesi) projenin "Özel / Düzenli" alt grubunda da görünür.
    for (const satir of this.aylikProjeOzelIsleri()) bloklar.get(satir.projeBirimAnahtari)?.ozelIsler.push(satir);
    const sira = (satir: FinansAylikIs) => {
      const index = FINANS_KATEGORILERI.findIndex(k => k.deger === satir.kategori);
      return index < 0 ? FINANS_KATEGORILERI.length : index;
    };
    return [...bloklar.values()]
      .filter(blok => blok.satirlar.length > 0)
      .map(blok => ({
        ...blok,
        satirlar: [...blok.satirlar].sort((a, b) => sira(a) - sira(b) || a.isAdi.localeCompare(b.isAdi, 'tr-TR')),
        ozelIsler: [...blok.ozelIsler].sort((a, b) => sira(a) - sira(b) || a.isAdi.localeCompare(b.isAdi, 'tr-TR')),
      }));
  });
  /** Proje dışı işler: sabit işler (kira, sevkiyat) ile diğer özel ve düzenli işler. */
  aylikGruplar = computed<AylikGrup[]>(() => {
    const satirlar = this.aylikIsler().filter(satir => satir.kaynakTuru !== 'Proje');
    return [
      this.grupOlustur('Sabit İşler', satirlar.filter(satir => this.sabitIs(satir.isGrubu))),
      this.grupOlustur('Özel ve Düzenli İşler', satirlar.filter(satir => !this.sabitIs(satir.isGrubu))),
    ].filter(grup => grup.satirlar.length > 0);
  });
  /** Proje satırlarının para birimi bazında toplamı (sunucunun üretim grubu toplamları). */
  projeToplamlari = computed(() => this.paraToplamlari(this.aylikGrupToplamlari()
    .filter(item => !this.ozelGrupToplami(item.grup))));
  finansOzeti = computed(() => this.aylikFinansOzeti());
  raporGruplari = computed(() => [...new Set(this.aylikGrupToplamlari().map(item => this.grupAdi(item.grup)))]
    .sort((a, b) => this.raporGrubuSirasi(a) - this.raporGrubuSirasi(b) || a.localeCompare(b, 'tr-TR')));

  constructor() {
    // Açık sekmenin izni kaldırılırsa (rol değişikliği oturumda yansır) erişilebilen ilk sekmeye geçilir.
    effect(() => {
      const aktif = this.activeTab();
      if (this.sekmeAcik(aktif)) return;
      const ilk = finansIlkSekme(this.permissions);
      if (ilk) untracked(() => this.selectTab(ilk));
    });
    // Açık alt görünümün (İş Takibi / Tanımlar) izni kaldırılırsa sekmenin okunabilen ilk alt görünümüne geçilir.
    effect(() => {
      const aktif = this.activeTab();
      if (aktif === 'akis' && !this.altSekmeAcik(this.akisAltSekmesi())) untracked(() => this.akisAltSekmesiniDogrula());
      if (aktif === 'ayarlar' && !this.altSekmeAcik(this.ayarGorunumu())) untracked(() => this.ayarGorunumunuDogrula());
    });
  }

  /** Sekme görünür mü (R): modül ve sekme düğümü (ortak/finans-izinleri). */
  sekmeAcik(sekme: AnaSekme): boolean {
    return finansSekmeAcik(this.permissions, sekme);
  }

  /** Sekmedeki işlemler yapılabilir mi (W). */
  sekmeYazilabilir(sekme: AnaSekme): boolean {
    return finansSekmeYazilabilir(this.permissions, sekme);
  }

  /** Alt sekme görünür mü (R): üst sekme ve alt sekme düğümü. */
  altSekmeAcik(altSekme: FinansAltSekme): boolean {
    return finansAltSekmeAcik(this.permissions, altSekme);
  }

  /** Alt sekmedeki işlemler yapılabilir mi (W): üst sekme ve alt sekme düğümünün yazma izni. */
  altSekmeYazilabilir(altSekme: FinansAltSekme): boolean {
    return finansAltSekmeYazilabilir(this.permissions, altSekme);
  }

  /** Açık İş Takibi alt görünümü. */
  akisAltSekmesi(): AkisAltSekmesi {
    return this.akisGorunumu() === 'aylik' ? 'aylik' : this.kayitAramaAcilisi().gorunum;
  }

  /** İş Takibi alt görünümünü açar; aylık görünüm listeyi yeniden yükler. */
  akisAltSekmesiniAc(altSekme: AkisAltSekmesi): void {
    if (!this.altSekmeAcik(altSekme)) return;
    if (altSekme !== 'aylik') {
      this.kayitAramasiniAc(altSekme);
      return;
    }
    this.akisGorunumu.set('aylik');
    this.aylikListeyiYukle();
  }

  /** Açık İş Takibi alt görünümü okunamıyorsa okunabilen ilk alt görünüm açılır. */
  private akisAltSekmesiniDogrula(): void {
    if (this.altSekmeAcik(this.akisAltSekmesi())) return;
    const ilk = finansIlkAltSekme(this.permissions, 'akis') as AkisAltSekmesi | null;
    if (ilk) this.akisAltSekmesiniAc(ilk);
  }

  /** Açık Tanımlar alt görünümü okunamıyorsa okunabilen ilk alt görünüm açılır. */
  private ayarGorunumunuDogrula(): void {
    if (this.altSekmeAcik(this.ayarGorunumu())) return;
    const ilk = finansIlkAltSekme(this.permissions, 'ayarlar') as AyarGorunumu | null;
    if (!ilk) return;
    this.ayarGorunumu.set(ilk);
    this.ayarListesiniYukle();
  }

  /** Vade uyarısı sekmelerin üstünde, modül genelindedir; sekme izninden bağımsız kendi iznine bağlıdır. */
  vadeUyarisiGorunur(): boolean {
    return finansVadeUyarisiGorunur(this.permissions);
  }

  ngOnInit(): void {
    this.listeAkislariniKur();
    forkJoin({
      kategoriler: this.giderKategorileriOkunabilir() ? this.service.giderKategorileri() : of({ isSuccess: true, value: [] }),
      icSandikSablonlari: this.permissions.hasAccess(AMBALAJ_YETKI.Listele) && this.permissions.hasAccess(AMBALAJ_YETKI.PlanGoruntule)
        ? this.ambalajService.getIcSandikSablonlari() : of({ isSuccess: true, value: [] }),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(result => {
      if (result.kategoriler.isSuccess) this.giderKategorileri.set((result.kategoriler.value ?? []).filter(kategori => kategori.aktif));
      if (result.icSandikSablonlari.isSuccess) this.icSandikSablonlari.set(result.icSandikSablonlari.value ?? []);
      this.loading.set(false);
    });
    this.paraBirimleri.yukle();
    this.vadeUyarilariniYukle();
    // Yalnız açılış sekmesinin verisi yüklenir; diğer sekmeler seçildiklerinde yüklenir.
    this.selectTab(this.activeTab());
  }

  /** Vade uyarıları ayrı vade uyarısı iznine bağlıdır (PO ve Faturalar sekmesi kapalı olsa da görülebilir). */
  vadeUyarilariniYukle(): void {
    if (!this.vadeUyarisiGorunur()) return;
    this.service.vadeUyarilari(10).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(result => {
      this.vadeUyarilari.set(result.isSuccess ? (result.value ?? null) : null);
    });
  }

  /** Uyarıdan fatura listesine geçer: vadesi geçen veya yaklaşan faturalar, bütün dönemler. */
  /** Uyarı satırları en acilden (en çok geciken / en az gün kalan) başlayarak. */
  vadeKalemleri(uyari: FinansVadeUyarilari): FinansVadeUyarilari['kalemler'] {
    return [...uyari.kalemler].sort((a, b) => a.kalanGun - b.kalanGun || a.faturaId - b.faturaId);
  }
  /** Rozet rengi: gecikmiş, bir hafta içinde, uyarı süresi içinde. */
  vadeAciliyeti(kalanGun: number): 'gecikti' | 'acil' | 'yaklasiyor' {
    return kalanGun < 0 ? 'gecikti' : kalanGun <= 7 ? 'acil' : 'yaklasiyor';
  }
  vadeTakibiniAc(filtre: FinansOdemeFiltresi): void {
    if (!this.altSekmeAcik('fatura')) return;
    this.belgeGorunumu.update(mevcut => ({ anahtar: mevcut.anahtar + 1, tur: 'Fatura', odeme: filtre }));
    this.selectTab('belgeler');
  }

  selectTab(tab: AnaSekme): void {
    if (!this.sekmeAcik(tab)) return;
    this.activeTab.set(tab);
    if (tab === 'akis') {
      this.akisAltSekmesiniDogrula();
      this.aylikListeyiYukle();
    }
    if (tab === 'giderler' && !this.giderlerYuklendi) {
      this.giderlerYuklendi = true;
      this.giderListeIstekleri.next();
    }
    if (tab === 'ayarlar') {
      this.ayarGorunumunuDogrula();
      this.ayarListesiniYukle();
    }
  }

  /** Gider formundaki kategori/kalem listesi: Giderler, Gider Kategorileri veya Raporlar sekmesinden biri. */
  giderKategorileriOkunabilir(): boolean {
    return finansHerhangiSekmeAcik(this.permissions, FINANS_GIDER_TANIM_SEKMELERI);
  }

  kategorileriYenile(): void {
    if (!this.giderKategorileriOkunabilir()) return;
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
    if (!this.altSekmeAcik('aylik')) return;
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
    if (!this.altSekmeAcik(gorunum)) return;
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

  /**
   * Proje paneli: liste yalnız projelerden oluşur; projeye tıklanınca sağdan açılan panelde ayın özeti ile
   * Kategoriler | Sandıklar | PO / Fatura sekmeleri gösterilir. Sandıklar sunucunun proje → sandık kırılımıdır
   * (sayfalamasız, sunucuda gruplanmış); kırılım proje başına bir kez yüklenip önbellekte tutulur. Liste yenilenince
   * önbellek düşer ve açık panelin projesi yeniden yüklenir.
   */
  readonly projeKirilimlari = signal(new Map<string, FinansProjeSandikKirilimi>());
  readonly kirilimYukleniyor = signal(new Set<string>());
  readonly acikSandikSatirlari = signal(new Set<string>());
  readonly sarfKaydi = sarfKaydi;
  private kirilimNesli = 0;

  readonly projePaneliAnahtari = signal<string | null>(null);
  readonly projePaneliSekmesi = signal<ProjePaneliSekmesi>('kategoriler');
  readonly panelSandikArama = signal('');
  readonly panelSandikFiltresi = signal<FinansSandikDurumSuzgeci>('hepsi');
  /** Kategori satırından açılan sandık dökümü: Sandıklar sekmesi yalnız o kategorinin kayıtlarını gösterir. */
  readonly panelKategori = signal<FinansAylikIs | null>(null);
  /** PO / Fatura sekmesinin yeniden yüklenme sürümü: liste yenilenince (ör. PO / fatura kaydedildi) artar. */
  readonly belgeSurumu = signal(0);
  readonly panelSandikFiltreleri = FINANS_SANDIK_DURUM_SUZGECLERI;

  /** Açık paneldeki proje; liste yenilenip proje sayfada kalmazsa null olur ve panel kapanır. */
  readonly projePaneli = computed(() => {
    const anahtar = this.projePaneliAnahtari();
    return anahtar ? this.aylikProjeBloklari().find(blok => blok.anahtar === anahtar) ?? null : null;
  });
  private readonly panelKirilimSandiklari = computed(() => {
    const blok = this.projePaneli();
    return blok ? kirilimSandiklari(this.projeKirilimi(blok.anahtar)?.sandiklar ?? []) : [];
  });
  /** Sandıklar sekmesi: durum süzgeci ve arama (sandık no/adı/tipi, PO ve fatura no) uygulanmış, doğal sandık sırasıyla. */
  readonly panelSandiklari = computed(() => {
    const arama = this.panelSandikArama().trim().toLocaleLowerCase('tr-TR');
    const filtre = this.panelSandikFiltresi();
    return this.panelKirilimSandiklari().filter(sandik => sandikDurumSuzgeceUyar(sandik, filtre) &&
      aramayaUyar(arama, [sandik.sandikNo, sandik.sandikAdi, sandik.sandikTipi, ...sandik.poNumaralari, ...sandik.faturaNumaralari]));
  });
  /** Süzgeç düğmelerindeki sandık sayıları (aramadan bağımsız). */
  readonly panelSandikSayilari = computed(() => {
    const sandiklar = this.panelKirilimSandiklari();
    return Object.fromEntries(this.panelSandikFiltreleri.map(f =>
      [f.deger, sandiklar.filter(sandik => sandikDurumSuzgeceUyar(sandik, f.deger)).length])) as Record<FinansSandikDurumSuzgeci, number>;
  });
  /** Kategori süzgeci açıkken: kategorinin kayıtları sandığıyla, aramayla daraltılmış. */
  readonly panelKategoriKayitlari = computed(() => {
    const satir = this.panelKategori();
    if (!satir) return [];
    const arama = this.panelSandikArama().trim().toLocaleLowerCase('tr-TR');
    return kategoriKirilimKayitlari(this.projeKirilimi(satir.projeBirimAnahtari)?.sandiklar ?? [], satir.isKaydiIds)
      .filter(x => aramayaUyar(arama, [x.sandik.sandikNo, x.sandik.sandikAdi, x.sandik.sandikTipi, ...x.kayit.poNumaralari, ...x.kayit.faturaNumaralari]));
  });
  /** Bu ayın işlerine bağlı PO ve fatura numaraları; PO / Fatura sekmesinde "Bu ay" olarak işaretlenir. */
  readonly panelAyBelgeNumaralari = computed(() => {
    const satirlar = [...(this.projePaneli()?.satirlar ?? []), ...(this.projePaneli()?.ozelIsler ?? [])];
    return {
      po: [...new Set(satirlar.flatMap(satir => satir.poNumaralari))],
      fatura: [...new Set(satirlar.flatMap(satir => satir.faturaNumaralari))],
    };
  });

  /** Projeye tıklama: sağdaki panel açılır (aynı proje yeniden tıklanırsa kapanır) ve sandık kırılımı yüklenir. */
  projePaneliniAc(blok: AylikProjeBlogu): void {
    if (this.projePaneliAnahtari() === blok.anahtar) {
      this.projePaneliniKapat();
      return;
    }
    this.projePaneliAnahtari.set(blok.anahtar);
    this.projePaneliSekmesi.set('kategoriler');
    this.panelSandikArama.set('');
    this.panelSandikFiltresi.set('hepsi');
    this.panelKategori.set(null);
    this.acikSandikSatirlari.set(new Set());
    this.kirilimYukle(blok.anahtar, blok);
  }
  projePaneliniKapat(): void {
    this.projePaneliAnahtari.set(null);
    this.panelKategori.set(null);
  }
  /** Gösterilen panel sekmesi: PO / Fatura izni oturumda kalkarsa Kategoriler'e düşer. */
  aktifPanelSekmesi(): ProjePaneliSekmesi {
    const sekme = this.projePaneliSekmesi();
    return sekme === 'belgeler' && !this.panelBelgeleriOkunabilir() ? 'kategoriler' : sekme;
  }
  projePaneliSekmesiSec(sekme: ProjePaneliSekmesi): void {
    const blok = this.projePaneli();
    if (!blok) return;
    this.projePaneliSekmesi.set(sekme);
    this.panelKategori.set(null);
  }
  /** Kategori satırından sandık dökümüne: Sandıklar sekmesi yalnız o kategorinin kayıtlarıyla açılır. */
  kategoriSandiklariniGoster(satir: FinansAylikIs): void {
    if (!this.sandikliSatir(satir)) return;
    this.panelKategori.set(satir);
    this.projePaneliSekmesi.set('sandiklar');
  }
  /** Kategori süzgeci etiketi: kategori adı; iş adı farklıysa onunla birlikte. */
  kategoriEtiketi(satir: FinansAylikIs): string {
    const kategori = this.t(kategoriAnahtari(satir.kategori));
    return satir.isAdi && satir.isAdi.toLocaleLowerCase('tr-TR') !== kategori.toLocaleLowerCase('tr-TR') ? `${kategori} · ${satir.isAdi}` : kategori;
  }
  /** "B × E × Y mm"; sunucu yalnız İlave/Saha/Yedek ve Özel İş satırına ölçü yazar, üçü dolu değilse boş. */
  olcuMetni(satir: FinansAylikIs): string | null {
    const { boy, en, yukseklik } = satir;
    if (!boy || !en || !yukseklik) return null;
    const sayi = (deger: number) => deger.toLocaleString('tr-TR', { maximumFractionDigits: 2 });
    return `${sayi(boy)} × ${sayi(en)} × ${sayi(yukseklik)} mm`;
  }
  /** Sandık dökümü olan kategori satırı (projeden gelen kayıtlar). */
  sandikliSatir(satir: FinansAylikIs): boolean {
    return satir.kaynakTuru === 'Proje' && satir.isKaydiIds.length > 0;
  }
  /** Panel özetinde kalan tutarlar: PO bekleyen = iş bedeli − PO, fatura bekleyen = PO − fatura (negatif olmaz). */
  kalanTutar(toplam: number | null | undefined, karsilanan: number | null | undefined): number {
    return Math.max(0, Math.round(((toplam ?? 0) - (karsilanan ?? 0)) * 100) / 100);
  }
  /** Karşılanma yüzdesi (ilerleme çubuğu); toplam sıfırsa 0. */
  oran(karsilanan: number | null | undefined, toplam: number | null | undefined): number {
    return toplam ? Math.min(100, Math.max(0, Math.round(((karsilanan ?? 0) / toplam) * 100))) : 0;
  }

  /** PO / Fatura sekmesi açık mı: listeler sunucuda PO'lar (PO listesi Faturalar'a da açık) ve Faturalar alt sekmesine bağlıdır. */
  panelBelgeleriOkunabilir(): boolean {
    return this.altSekmeAcik('po') || this.altSekmeAcik('fatura');
  }

  private kirilimYukle(anahtar: string, proje: { projeId: number | null; projeNo: string; musteri: string }): void {
    if (this.projeKirilimlari().has(anahtar) || this.kirilimYukleniyor().has(anahtar)) return;
    this.kirilimYukleniyor.update(x => new Set(x).add(anahtar));
    const nesil = this.kirilimNesli;
    const tarih = this.seciliDonem();
    this.service.projeSandikKirilimi({
      projeId: proje.projeId,
      projeNo: proje.projeId ? undefined : proje.projeNo,
      musteri: proje.projeId ? undefined : proje.musteri,
      yil: tarih.getFullYear(),
      ay: tarih.getMonth() + 1,
      iptalEdilenleriDahilEt: this.iptalEdilenleriGoster(),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(result => {
      // Dönem veya liste bu arada değiştiyse eski cevap yeni önbelleğe yazılmaz.
      if (nesil !== this.kirilimNesli) return;
      this.kirilimYukleniyor.update(x => { const y = new Set(x); y.delete(anahtar); return y; });
      if (!result.isSuccess || !result.value) {
        this.toast.error(result.error ?? this.t('CRATES_LOAD_ERROR'));
        return;
      }
      this.projeKirilimlari.update(x => new Map(x).set(anahtar, result.value!));
    });
  }
  /**
   * Liste yenilendi: kırılım önbelleği düşer. Açık panelin projesi yeni sayfada/dönemde varsa kırılımı ve PO/fatura
   * listesi (sürümle) yeniden yüklenir; yoksa panel kapanır.
   */
  private kirilimlariYenile(): void {
    this.kirilimNesli++;
    this.projeKirilimlari.set(new Map());
    this.kirilimYukleniyor.set(new Set());
    const blok = this.projePaneli();
    if (!blok) {
      this.projePaneliniKapat();
      return;
    }
    this.kirilimYukle(blok.anahtar, blok);
    this.belgeSurumu.update(x => x + 1);
  }
  private aciKapat(sinyal: WritableSignal<Set<string>>, anahtar: string): void {
    sinyal.update(mevcut => {
      const sonraki = new Set(mevcut);
      if (sonraki.has(anahtar)) sonraki.delete(anahtar); else sonraki.add(anahtar);
      return sonraki;
    });
  }

  projeKirilimi(anahtar: string): FinansProjeSandikKirilimi | undefined {
    return this.projeKirilimlari().get(anahtar);
  }
  sandikSatiriAcik(sandik: FinansSandikKirilimSatiri): boolean {
    return this.acikSandikSatirlari().has(sandik.anahtar);
  }
  sandikSatiriAcKapat(sandik: FinansSandikKirilimSatiri): void {
    this.aciKapat(this.acikSandikSatirlari, sandik.anahtar);
  }
  sandikDurumSinifi(durum: number): string {
    return durum === 5 ? 'complete' : durum === 6 ? 'cancel-status' : durum > 1 ? 'partial' : '';
  }

  projeTamamlandi(blok: AylikProjeBlogu): boolean {
    return blok.ozet?.durum === 5;
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
        dosyayiKaydet(blob, `Finans_Is_Takibi_${tarih.getFullYear()}_${String(tarih.getMonth() + 1).padStart(2, '0')}.${uzanti}`);
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
      kategoriler: [...this.siparisRaporKategorileri],
      siparisKarsilanma: this.siparisRaporSiparisDurumu ?? undefined,
      faturaKarsilanma: this.siparisRaporFaturaDurumu ?? undefined,
    };
    this.siparisRaporIndiriliyor.set(format);
    this.service.siparisDurumRaporu(format, filtre).subscribe({
      next: blob => {
        this.siparisRaporIndiriliyor.set(null);
        dosyayiKaydet(blob, `Finans_Siparis_Durum_Raporu.${format === 'pdf' ? 'pdf' : 'xlsx'}`);
      },
      error: () => {
        this.siparisRaporIndiriliyor.set(null);
        this.toast.error('Sipariş durum raporu indirilemedi.');
      },
    });
  }

  raporKategorisiDegistir(kategori: FinansIsKategorisi, secili: boolean): void {
    const sonraki = new Set(this.siparisRaporKategorileri);
    secili ? sonraki.add(kategori) : sonraki.delete(kategori);
    this.siparisRaporKategorileri = sonraki;
  }

  aylikDegerDuzenle(satir: FinansAylikIs): void {
    if (!this.aylikDegerDuzenlenebilir(satir)) return;
    this.aylikDegerSatiri.set(satir);
    this.aylikMiktar = this.aylikMiktarDuzenlenebilir(satir) ? satir.miktar : null;
    this.aylikTarife = this.aylikTarifeDuzenlenebilir(satir) ? satir.birimFiyat : null;
    this.aylikDegerHatasi.set('');
    this.aylikDegerAcik.set(true);
  }

  aylikDegerKaydet(): void {
    const satir = this.aylikDegerSatiri();
    if (!satir?.ozelIsId || !this.aylikDegerDuzenlenebilir(satir) || this.aylikDegerKaydediliyor()) return;
    const request: FinansAylikDegerRequest = {};
    if (this.aylikMiktarDuzenlenebilir(satir) && Number(this.aylikMiktar) !== satir.miktar) {
      const miktar = Number(this.aylikMiktar);
      if (!Number.isFinite(miktar) || miktar <= 0) {
        this.aylikDegerHatasi.set('Miktar sıfırdan büyük olmalıdır.');
        return;
      }
      request.miktar = miktar;
    }
    if (this.aylikTarifeDuzenlenebilir(satir) && Number(this.aylikTarife) !== satir.birimFiyat) {
      const tarife = Number(this.aylikTarife);
      if (!Number.isFinite(tarife) || tarife < 0) {
        this.aylikDegerHatasi.set('Tarife sıfır veya daha büyük olmalıdır.');
        return;
      }
      request.netBirimFiyat = tarife;
    }
    if (request.miktar === undefined && request.netBirimFiyat === undefined) {
      this.aylikDegerAcik.set(false);
      return;
    }
    this.aylikDegerKaydediliyor.set(true);
    this.service.ozelIsAylikDegerGuncelle(satir.ozelIsId, request).subscribe(result => {
      this.aylikDegerKaydediliyor.set(false);
      if (this.onayaAlindiysaBildir(result)) return;
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
      if (this.onayaAlindiysaBildir(result)) return;
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
      if (this.onayaAlindiysaBildir(result)) return;
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
    const m3Yontemi = form.hesaplamaYontemi === 4;
    if (m3Yontemi && !finansHacimGecerli(form.ahsapM3, form.kontraM3)) {
      this.ozelIsHatasi.set(this.t('VOLUME_INVALID'));
      return;
    }
    const request: FinansOzelIsKaydetRequest = {
      ...form,
      ahsapM3: m3Yontemi ? Number(form.ahsapM3) || 0 : null,
      kontraM3: m3Yontemi ? Number(form.kontraM3) || 0 : null,
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
      if (this.onayaAlindiysaBildir(result)) return;
      if (!result.isSuccess) {
        this.ozelIsHatasi.set(result.error ?? 'Tek seferlik iş oluşturulamadı.');
        return;
      }
      this.ozelIsAcik.set(false);
      this.toast.success('Tek seferlik iş oluşturuldu.');
      this.aylikListeyiYukle();
    });
  }

  /** PO açılabilir: iptal değil, fiyat/miktar bekliyor değil ve sipariş bekleyen tutarı var (kısmi dahil). */
  poAcilabilir(satir: FinansAylikIs): boolean {
    return !satir.iptalEdildi && satir.isKaydiIds.length > 0 && !this.dagitimBekliyor(satir) &&
      satir.siparisKarsilanma !== FinansKarsilanma.Tam && (satir.kalanSiparisNetTutar ?? 1) > 0;
  }

  /** Fatura girilebilir: PO'su var ve faturalanmamış PO bakiyesi var (kısmi dahil). */
  faturaGirilebilir(satir: FinansAylikIs): boolean {
    return !satir.iptalEdildi && satir.poNumaralari.length > 0 &&
      satir.faturaKarsilanma !== FinansKarsilanma.Tam && (satir.kalanFaturaNetTutar ?? 1) > 0;
  }

  dagitimBekliyor(satir: FinansAylikIs): boolean {
    const durum = satir.durum.toLocaleLowerCase('tr-TR');
    return DAGITIM_BEKLEYEN_DURUMLAR.some(x => durum.includes(x));
  }

  poIzni(): boolean { return finansPoGirilebilir(this.permissions); }
  /** Fatura girişi: Faturalar alt sekmesinin W izni ve faturalanacak PO'yu seçmek için PO'lar alt sekmesinin R izni. */
  faturaIzni(): boolean { return finansFaturaGirilebilir(this.permissions); }
  /** İş kaydı iptal/geri alma: İş Takibi veya Münferit İşler sekmesinin W izni. */
  isDuzenlenebilir(): boolean { return finansIsDuzenlenebilir(this.permissions); }
  /** Kayıt (fatura) detayı: kayıt sekmelerinden biri; vade uyarısındaki fatura bağlantısı buna bağlıdır. */
  kayitOkunabilir(): boolean { return finansKayitOkunabilir(this.permissions); }

  siparisFormunuAc(satir: FinansAylikIs): void {
    this.topluSiparisAc(satir.isKaydiIds);
  }

  /** Satırın onaysız, reddedilmiş veya onayı düşmüş proje kalemleri PO öncesi onaya gönderilebilir. */
  satirOnayaGonderilebilir(satir: FinansAylikIs): boolean {
    return this.poOnayKuraliAcik() && this.poIzni() && !satir.iptalEdildi && poOnayaGonderilebilir(satir.poOnayDurumu);
  }

  /**
   * Satırın kalemlerini PO öncesi onaya gönderir; sunucu uygun kalemleri grup başına bir talebe toplar ve onaylı ya
   * da onaydaki kalemleri atlar. Talepler İşlem Onay Merkezi'ne düşer; liste yeni durumla yenilenir.
   */
  satirOnayaGonder(satir: FinansAylikIs): void {
    if (!this.satirOnayaGonderilebilir(satir) || this.poOnayaGonderiliyor()) return;
    this.poOnayaGonderiliyor.set(true);
    this.service.poOnayinaGonder(satir.isKaydiIds).pipe(
      finalize(() => this.poOnayaGonderiliyor.set(false)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(result => {
      if (!result.isSuccess) {
        this.toast.error(result.error ?? this.t('PO_APPROVAL_SEND_ERROR'));
        return;
      }
      for (const bildirim of poOnayBildirimleri(result)) {
        const mesaj = this.t(bildirim.anahtar).replace('{0}', String(bildirim.sayi));
        if (bildirim.tur === 'success') this.toast.success(mesaj);
        else this.toast.info(mesaj);
      }
      this.aylikListeIstekleri.next();
    });
  }

  /** Projenin sipariş bekleyen bütün kategori satırları için tek PO ekranı açar. */
  projeSiparisAc(blok: AylikProjeBlogu): void {
    this.topluSiparisAc(blok.satirlar.filter(satir => this.poAcilabilir(satir)).flatMap(satir => satir.isKaydiIds));
  }

  projePoAcilabilir(blok: AylikProjeBlogu): boolean {
    return blok.satirlar.some(satir => this.poAcilabilir(satir));
  }

  projeFaturaGirilebilir(blok: AylikProjeBlogu): boolean {
    return blok.satirlar.some(satir => this.faturaGirilebilir(satir));
  }

  projeFaturaAc(blok: AylikProjeBlogu): void {
    const numaralar = [...new Set(blok.satirlar.filter(satir => this.faturaGirilebilir(satir)).flatMap(satir => satir.poNumaralari))];
    this.faturaAc(null, numaralar.length === 1 ? numaralar[0] : undefined);
  }

  topluSiparisAc(ids: number[]): void {
    if (!ids.length || !this.poIzni()) return;
    this.detayHedef.set(null);
    this.dagitim.set({tur: 'Siparis', ids, siparisId: null});
  }

  /** Sipariş Aç: ayın sipariş bekleyen işlerini projeler arası çoklu seçim ve kategori filtresiyle açar. */
  siparisAc(): void {
    if (!this.poIzni()) return;
    this.detayHedef.set(null);
    this.dagitim.set({tur: 'Siparis', ids: [], siparisId: null, donem: { baslangic: this.donemBaslangici(), bitis: this.donemBitisi() }});
  }

  /** PO sekmesinden: yeni PO (dönem sınırı olmadan) veya mevcut PO'ya kalem ekleme. */
  poFormunuAc(siparisId: number | null): void {
    if (!this.poIzni()) return;
    this.detayHedef.set(null);
    this.dagitim.set({tur: 'Siparis', ids: [], siparisId});
  }

  satiriFaturalandir(satir: FinansAylikIs): void {
    this.faturaAc(null, satir.poNumaralari.length === 1 ? satir.poNumaralari[0] : undefined);
  }

  faturaAc(siparisId: number | null, poNumarasi?: string): void {
    if (!this.faturaIzni()) return;
    this.detayHedef.set(null);
    this.dagitim.set({tur: 'Fatura', ids: [], siparisId, poNumarasi});
  }

  projeDetayAc(blok: AylikProjeBlogu): void {
    this.projeDetay.set({ projeNo: blok.projeNo, musteri: blok.musteri });
  }
  projeDetayindanKayitAc(hedef: {tur: FinansVarlikTuru; id: number}): void {
    this.projeDetay.set(null);
    this.detayHedef.set(hedef);
  }

  belgeKaydedildi(hedef: {tur: FinansVarlikTuru; id: number}): void {
    this.dagitim.set(null); this.detayHedef.set(hedef); this.aylikListeyiYukle();
    if (hedef.tur === 'Fatura') this.vadeUyarilariniYukle();
  }

  /**
   * Tanımlar alt görünümündeki işlemler o alt sekmenin W iznine bağlıdır: düzenli iş → Düzenli İşler; tarife, yeniden
   * fiyatlama ve tarife düzeltme → Ürün ve Tarifeler; para birimi ve parametreler → Para Birimi ve Vade.
   */
  tanimYazilabilir(gorunum: AyarGorunumu): boolean {
    return this.altSekmeYazilabilir(gorunum);
  }

  yenidenFiyatlaAc(urun: FinansUrun): void {
    if (!this.tanimYazilabilir('tarifeler')) return;
    this.yenidenFiyatlaUrun.set(urun);
    this.yenidenFiyatlaAciklama = '';
    this.yenidenFiyatlaHatasi.set('');
  }

  yenidenFiyatla(): void {
    const urun = this.yenidenFiyatlaUrun();
    const aciklama = this.yenidenFiyatlaAciklama.trim();
    if (!urun || this.yenidenFiyatlaniyor()) return;
    if (aciklama.length < 5) {
      this.yenidenFiyatlaHatasi.set('Yeniden fiyatlama gerekçesi en az 5 karakter olmalıdır.');
      return;
    }
    this.yenidenFiyatlaniyor.set(true);
    this.service.urunYenidenFiyatla(urun.id, aciklama).pipe(finalize(() => this.yenidenFiyatlaniyor.set(false))).subscribe(result => {
      if (this.onayaAlindiysaBildir(result)) return;
      if (!result.isSuccess || !result.value) {
        this.yenidenFiyatlaHatasi.set(result.error ?? 'Açık kalemler yeniden fiyatlanamadı.');
        return;
      }
      this.yenidenFiyatlaUrun.set(null);
      this.toast.success(`${result.value.fiyatlananKalem} kalem yeni tarifeyle fiyatlandı (${result.value.incelenenKalem} açık kalem incelendi).`);
      this.aylikListeyiYukle();
    });
  }

  tarifeDuzeltilebilir(): boolean {
    return !!this.duzenlenenUrunId() && this.tanimYazilabilir('tarifeler');
  }

  tarifeDuzeltmeAc(surum: FinansTarifeSurumu): void {
    if (!this.tarifeDuzeltilebilir() || surum.birimFiyat === null || surum.kdvOrani === null) return;
    this.tarifeDuzeltmeForm = { birimFiyat: surum.birimFiyat, kdvOrani: surum.kdvOrani, aciklama: '' };
    this.tarifeDuzeltmeOnizlemesi.set(null);
    this.tarifeDuzeltmeHatasi.set('');
    this.tarifeDuzeltmeSurumu.set(surum);
  }

  /** Fiyat veya KDV değişince eski önizleme geçersizdir; uygulamadan önce yeniden görülmelidir. */
  tarifeDuzeltmeDegeriDegisti(): void {
    this.tarifeDuzeltmeOnizlemesi.set(null);
    this.tarifeDuzeltmeHatasi.set('');
  }

  tarifeDuzeltmeOnizle(): void {
    const surum = this.tarifeDuzeltmeSurumu();
    const urunId = this.duzenlenenUrunId();
    const { birimFiyat, kdvOrani } = this.tarifeDuzeltmeForm;
    if (!surum || !urunId || this.tarifeDuzeltmeYukleniyor()) return;
    if (!Number.isFinite(birimFiyat) || !Number.isFinite(kdvOrani) || birimFiyat < 0 || kdvOrani < 0 || kdvOrani > 100) {
      this.tarifeDuzeltmeHatasi.set('Geçerli bir birim fiyat ve 0-100 aralığında KDV girin.');
      return;
    }
    this.tarifeDuzeltmeHatasi.set('');
    this.tarifeDuzeltmeYukleniyor.set(true);
    this.service.tarifeDuzeltmeOnizle(urunId, surum.id, Number(birimFiyat), Number(kdvOrani))
      .pipe(finalize(() => this.tarifeDuzeltmeYukleniyor.set(false)))
      .subscribe(result => {
        if (!result.isSuccess || !result.value) {
          this.tarifeDuzeltmeHatasi.set(result.error ?? 'Düzeltmenin etkisi hesaplanamadı.');
          return;
        }
        this.tarifeDuzeltmeOnizlemesi.set(result.value);
      });
  }

  tarifeDuzelt(): void {
    const surum = this.tarifeDuzeltmeSurumu();
    const urunId = this.duzenlenenUrunId();
    const aciklama = this.tarifeDuzeltmeForm.aciklama.trim();
    if (!surum || !urunId || !this.tarifeDuzeltmeOnizlemesi() || this.tarifeDuzeltmeYukleniyor()) return;
    if (aciklama.length < 5) {
      this.tarifeDuzeltmeHatasi.set('Düzeltme gerekçesi en az 5 karakter olmalıdır.');
      return;
    }
    const istek = { birimFiyat: Number(this.tarifeDuzeltmeForm.birimFiyat), kdvOrani: Number(this.tarifeDuzeltmeForm.kdvOrani), aciklama };
    this.tarifeDuzeltmeYukleniyor.set(true);
    this.service.tarifeDuzelt(urunId, surum.id, istek)
      .pipe(finalize(() => this.tarifeDuzeltmeYukleniyor.set(false)))
      .subscribe(result => {
        if (this.onayaAlindiysaBildir(result)) return;
        if (!result.isSuccess || !result.value) {
          this.tarifeDuzeltmeHatasi.set(result.error ?? 'Tarife düzeltilemedi.');
          return;
        }
        const { duzeltilenKalemSayisi, korunanKalemSayisi } = result.value;
        this.tarifeDuzeltmeSurumu.set(null);
        this.urunAcik.set(false);
        this.toast.success(
          `Tarife düzeltildi: ${duzeltilenKalemSayisi} kalem yeni fiyata çekildi` +
          (korunanKalemSayisi ? `, ${korunanKalemSayisi} kalem korundu.` : '.'));
        this.urunleriYenile();
        this.aylikListeyiYukle();
      });
  }

  /** Gider raporu dosyası: Giderler veya Raporlar sekmesinden birinin R izni. */
  giderRaporuIndirilebilir(): boolean {
    return this.sekmeAcik('giderler') || this.sekmeAcik('raporlar');
  }

  /** Tek seferlik iş ve aylık değer düzeltmesi Aylık görünümde yapılır: Aylık görünüm alt sekmesinin W izni. */
  ozelIsEklenebilir(): boolean {
    return this.altSekmeYazilabilir('aylik');
  }

  aylikDegerDuzenlenebilir(satir: FinansAylikIs | null): boolean {
    if (!satir || !this.altSekmeYazilabilir('aylik')) return false;
    return this.aylikMiktarDuzenlenebilir(satir) || this.aylikTarifeDuzenlenebilir(satir);
  }

  /** Bu ayın miktarı: sunucu izin verdiyse. */
  aylikMiktarDuzenlenebilir(satir: FinansAylikIs | null): boolean {
    return !!satir && satir.miktarDuzenlenebilir && Number.isFinite(satir.miktar);
  }

  /** Bu ayın tarifesi (birim fiyat): sunucu izin verdiyse. */
  aylikTarifeDuzenlenebilir(satir: FinansAylikIs | null): boolean {
    return !!satir && satir.tutarDuzenlenebilir && Number.isFinite(satir.birimFiyat);
  }

  /** Penceredeki değerlerle yeni net tutar önizlemesi. */
  aylikNetOnizleme(satir: FinansAylikIs): number | null {
    const miktar = this.aylikMiktarDuzenlenebilir(satir) ? Number(this.aylikMiktar) : satir.miktar;
    const tarife = this.aylikTarifeDuzenlenebilir(satir) ? Number(this.aylikTarife) : satir.birimFiyat;
    return Number.isFinite(miktar) && Number.isFinite(tarife) ? Math.round(miktar * tarife * 100) / 100 : null;
  }

  private onayaAlindiysaBildir(result: ApiResult<unknown>): boolean {
    if (!onayaAlindi(result)) return false;
    this.toast.info('İşlem onaya gönderildi; henüz uygulanmadı.');
    return true;
  }

  yeniGider(): void {
    this.duzenlenenGiderId.set(null);
    this.giderProjeEtiketi = '';
    this.giderPoEtiketi = '';
    this.giderPoArama = '';
    this.giderPoSecenekleri.set([]);
    this.giderForm = this.bosGiderFormu();
    ++this.giderKalemIstekSurumu;
    this.giderKalemleri.set([]); this.giderKalemLoading.set(false); this.giderKalemHatasi.set('');
    this.giderEskiKalem.set(null); this.giderEskiKategori.set(null);
    this.giderHatasi.set('');
    this.giderAcik.set(true);
  }

  giderDuzenle(gider: FinansGider): void {
    if (!this.sekmeYazilabilir('giderler')) return;
    this.giderProjeEtiketi = gider.projeNo;
    this.duzenlenenGiderId.set(gider.id);
    this.giderForm = { tarih: gider.tarih.slice(0, 10), kategoriId: gider.kategoriId, giderKalemiId: gider.giderKalemiId ?? null, altKategori: gider.altKategori ?? null, firmaVeyaKisi: gider.firmaVeyaKisi ?? null, aciklama: gider.aciklama, tutar: gider.tutar, paraBirimi: gider.paraBirimi, kdvDahil: gider.kdvDahil, kdvOrani: gider.kdvOrani, projeId: gider.projeId ?? null, isTuru: gider.isTuru ?? null,
      miktar: gider.miktar, birim: gider.birim, birimFiyat: gider.birimFiyat,
      finansTarihi: (gider.finansTarihi ?? gider.tarih).slice(0, 10), finansDonemi: gider.finansDonemi,
      belgeNo: gider.belgeNo ?? null, avansMi: gider.avansMi ?? false, mahsupEdilenAvansId: gider.mahsupEdilenAvansId ?? null,
      finansSiparisId: gider.finansSiparisId ?? null };
    this.giderPoEtiketi = gider.poNumarasi ?? '';
    this.giderPoArama = '';
    this.giderPoSecenekleri.set([]);
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
    if (this.giderKaydediliyor() || this.giderKalemLoading() || !this.sekmeYazilabilir('giderler')) return;
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
      if (this.onayaAlindiysaBildir(result)) return;
      if (!result.isSuccess) this.giderHatasi.set(result.error ?? 'Gider kaydedilemedi.');
      else {
        this.giderAcik.set(false);
        this.toast.success(id ? 'Gider güncellendi.' : 'Gider kaydedildi.');
        this.giderleriYenile();
      }
    }, error: () => this.giderHatasi.set('Gider kaydedilemedi.') });
  }

  /** PO listesi (PO'lar alt sekmesi R) okunabiliyorsa gider formunda PO seçimi gösterilir. */
  giderPoSecilebilir(): boolean {
    return this.altSekmeAcik('po');
  }

  giderPoAra(value: string): void {
    this.giderPoArama = value;
    this.giderPoAramalari.next(value.trim());
  }

  giderPoSec(po: FinansSiparis | null): void {
    this.giderForm.finansSiparisId = po?.id ?? null;
    this.giderPoEtiketi = po ? `${po.poNumarasi}${po.projeNo ? ' · ' + po.projeNo : ''}` : '';
    this.giderPoArama = '';
    this.giderPoSecenekleri.set([]);
  }

  giderRaporuIndir(format: 'pdf' | 'excel'): void {
    this.giderRaporIndiriliyor.set(format);
    this.service.giderRaporu(format).subscribe({
      next: blob => {
        this.giderRaporIndiriliyor.set(null);
        dosyayiKaydet(blob, `FinansGiderRaporu.${format === 'pdf' ? 'pdf' : 'xlsx'}`);
      },
      error: () => {
        this.giderRaporIndiriliyor.set(null);
        this.toast.error('Gider raporu indirilemedi.');
      },
    });
  }

  donemUretFormunuAc(is: FinansDuzenliIs): void {
    if (!this.tanimYazilabilir('duzenli') || !is.aktif) return;
    const yilSonu = `${new Date().getFullYear()}-12-31`;
    const bitis = is.bitisTarihi?.slice(0, 10);
    this.donemUretBitis = bitis && bitis < yilSonu ? bitis : yilSonu;
    this.donemUretHatasi.set('');
    this.donemUretIs.set(is);
  }

  donemUret(): void {
    const is = this.donemUretIs();
    if (!is || this.donemUretiliyor() || !this.tanimYazilabilir('duzenli')) return;
    if (!this.donemUretBitis) {
      this.donemUretHatasi.set('Bitiş tarihi zorunludur.');
      return;
    }
    this.donemUretiliyor.set(true);
    this.service.duzenliIsDonemUret(is.id, this.donemUretBitis)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.donemUretiliyor.set(false)))
      .subscribe(result => {
        if (this.onayaAlindiysaBildir(result)) return;
        if (!result.isSuccess || !result.value) {
          this.donemUretHatasi.set(result.error ?? 'Dönemler üretilemedi.');
          return;
        }
        const sonuc = result.value;
        if (sonuc.hatalar?.length) this.toast.error(sonuc.hatalar.join(' '));
        this.toast.success(sonuc.olusturulan ? `${sonuc.olusturulan} dönem üretildi.` : 'Üretilecek yeni dönem yok; dönemler zaten mevcut.');
        this.donemUretIs.set(null);
        this.aylikListeyiYukle();
      });
  }

  /** Düzenli işin bütün dönemlerini (ör. yıllık PO) tek PO'ya bağlamak için PO ekranını açar. */
  duzenliIsPoAc(is: FinansDuzenliIs): void {
    if (!this.poIzni()) return;
    this.detayHedef.set(null);
    this.dagitim.set({ tur: 'Siparis', ids: [], siparisId: null, duzenliIsId: is.id });
  }

  yeniDuzenliIs(): void {
    if (!this.tanimYazilabilir('duzenli')) return;
    this.duzenliProjeEtiketi = '';
    this.duzenlenenDuzenliIsId.set(null);
    this.duzenliIsForm = this.bosDuzenliIsFormu();
    this.duzenliIsHatasi.set('');
    this.duzenliIsAcik.set(true);
  }

  duzenliIsDuzenle(is: FinansDuzenliIs): void {
    if (!this.tanimYazilabilir('duzenli')) return;
    this.duzenlenenDuzenliIsId.set(is.id);
    this.duzenliProjeEtiketi = '';
    this.duzenliIsForm = { projeId: is.projeId ?? null, isAdi: is.isAdi, isTuru: is.isTuru, musteri: is.musteri, aciklama: is.aciklama, tekrarSikligi: is.tekrarSikligi, baslangicTarihi: is.baslangicTarihi.slice(0, 10), bitisTarihi: is.bitisTarihi?.slice(0, 10) ?? null, olusturmaGunu: is.olusturmaGunu, miktar: is.miktar, birim: is.birim, birimFiyat: is.birimFiyat, paraBirimi: is.paraBirimi, kdvOrani: is.kdvOrani, aktif: is.aktif, hesaplamaYontemi: is.hesaplamaYontemi, raporGrubu: is.raporGrubu };
    this.duzenliIsHatasi.set('');
    this.duzenliIsAcik.set(true);
  }

  duzenliIsKaydet(): void {
    if (!this.tanimYazilabilir('duzenli') || this.duzenliIsKaydediliyor()) return;
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
      if (this.onayaAlindiysaBildir(result)) return;
      if (!result.isSuccess) this.duzenliIsHatasi.set(result.error ?? 'Düzenli iş kaydedilemedi.');
      else {
        this.duzenliIsAcik.set(false);
        this.toast.success(id ? 'Düzenli iş güncellendi.' : 'Düzenli iş eklendi.');
        this.duzenliIsleriYenile();
      }
    });
  }

  yeniUrun(): void {
    if (!this.tanimYazilabilir('tarifeler')) return;
    this.duzenlenenUrunId.set(null);
    this.duzenlenenUrunTarifeleri.set([]);
    this.urunForm = this.bosUrunFormu();
    this.urunHatasi.set('');
    this.urunAcik.set(true);
  }

  urunDuzenle(urun: FinansUrun): void {
    if (!this.tanimYazilabilir('tarifeler')) return;
    const eslesme = urun.eslesmeler.find(e => e.aktif !== false) ?? urun.eslesmeler.at(-1);
    this.duzenlenenUrunId.set(urun.id);
    this.duzenlenenUrunTarifeleri.set(urun.tarifeler ?? []);
    this.urunForm = { kod: urun.kod, ad: urun.ad, fiyatlandirmaBirimi: urun.fiyatlandirmaBirimi, birimFiyat: urun.birimFiyat, paraBirimi: urun.paraBirimi, kdvOrani: urun.kdvOrani, gecerlilikBaslangici: this.tarihMetni(new Date()), aktif: urun.aktif, sira: urun.sira, eslesmeId: eslesme?.id ?? null, isTuru: eslesme?.isTuru ?? 0, sandikAdi: eslesme?.sandikAdi ?? '', sandikTipi: eslesme?.sandikTipi ?? '', malzeme: eslesme?.malzeme ?? null, icSandikSablonId: eslesme?.icSandikSablonId ?? null };
    this.urunHatasi.set('');
    this.urunAcik.set(true);
  }

  urunKaydet(): void {
    if (!this.tanimYazilabilir('tarifeler') || this.urunKaydediliyor()) return;
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
    const malzeme = this.urunMalzemesiSecilebilir() ? form.malzeme : null;
    if (malzeme && form.fiyatlandirmaBirimi !== 2) {
      this.urunHatasi.set('Ahşap veya kontra malzemeli tarife m³ ile fiyatlanır.');
      return;
    }
    const id = this.duzenlenenUrunId();
    const ozelSandik = [4, 5].includes(form.isTuru);
    if (!form.gecerlilikBaslangici) {
      this.urunHatasi.set('Fiyatın geçerli olacağı başlangıç tarihi zorunludur.');
      return;
    }
    const request: FinansUrunKaydetRequest = { kod: form.kod.trim(), ad: form.ad.trim(), fiyatlandirmaBirimi: form.fiyatlandirmaBirimi, birimFiyat: Number(form.birimFiyat), paraBirimi: form.paraBirimi, kdvOrani: Number(form.kdvOrani), gecerlilikBaslangici: form.gecerlilikBaslangici, aktif: form.aktif, sira: form.sira, eslesmeler: form.isTuru ? [{ id: form.eslesmeId, aktif: true, isTuru: form.isTuru, sandikAdi: form.isTuru === 3 || ozelSandik ? null : this.temizle(form.sandikAdi), icSandikSablonId: form.isTuru === 3 ? form.icSandikSablonId : null, sandikTipi: form.isTuru === 3 ? null : this.temizle(form.sandikTipi), malzeme }] : [] };
    this.urunKaydediliyor.set(true);
    const operation = id ? this.service.urunGuncelle(id, request) : this.service.urunOlustur(request);
    operation.subscribe(result => {
      this.urunKaydediliyor.set(false);
      if (this.onayaAlindiysaBildir(result)) return;
      if (!result.isSuccess) this.urunHatasi.set(result.error ?? 'Tarife kaydedilemedi.');
      else {
        this.urunAcik.set(false);
        this.toast.success(id ? 'Tarife güncellendi.' : 'Tarife eklendi.');
        this.urunleriYenile();
      }
    });
  }

  async urunSil(urun: FinansUrun): Promise<void> {
    if (!this.tanimYazilabilir('tarifeler')) return;
    const onay = await this.confirmService.ask({
      title: 'Tarifeyi Sil',
      message: `<strong>${duzMetin(urun.kod)} · ${duzMetin(urun.ad)}</strong> tarifesini silmek istediğinize emin misiniz?<br><br><small class="text-muted">Sipariş geçmişinde kullanılmış tarifeler silinemez; düzenlenerek pasif duruma getirilebilir.</small>`,
      confirmText: 'Evet, Sil',
      cancelText: 'Vazgeç',
      type: 'danger'
    });
    if (!onay) return;
    this.urunSiliniyorId.set(urun.id);
    this.service.urunSil(urun.id).subscribe(result => {
      this.urunSiliniyorId.set(null);
      if (this.onayaAlindiysaBildir(result)) return;
      if (!result.isSuccess) {
        this.toast.error(result.error ?? 'Tarife silinemedi.');
        return;
      }
      this.toast.success('Tarife silindi.');
      this.urunleriYenile();
    });
  }

  urunEslesmeMetni(urun: FinansUrun): string {
    return urun.eslesmeler.filter(eslesme => eslesme.aktif !== false).map(eslesme => {
      const tur = eslesme.sandikTipi ? ` · ${eslesme.sandikTipi}` : '';
      const malzeme = eslesme.malzeme === 1 ? ` · ${this.t('WOOD_M3')}` : eslesme.malzeme === 2 ? ` · ${this.t('PLYWOOD_M3')}` : '';
      const detay = eslesme.icSandikSablonId ? ` · ${this.icSandikSablonAdi(eslesme.icSandikSablonId)}` : eslesme.sandikAdi ? ` · ${eslesme.sandikAdi}` : '';
      return `${this.isTuruMetni(eslesme.isTuru)}${tur}${malzeme}${detay}`;
    }).join(', ') || 'Manuel seçim';
  }

  icSandikSablonAdi(id: number): string {
    return this.icSandikSablonlari().find(sablon => sablon.id === id)?.ad ?? 'Silinmiş İç Sandık Tipi';
  }

  urunIsTuruDegisti(isTuru: number): void {
    this.urunForm.isTuru = Number(isTuru);
    this.urunForm.sandikAdi = '';
    this.urunForm.sandikTipi = '';
    this.urunForm.malzeme = null;
    this.urunForm.icSandikSablonId = null;
  }

  /**
   * Malzeme (ahşap/kontra m³ tarifesi) seçilebilir mi: iç sandık ve özel iş dışındaki eşleşmede, sandık tipi boş ya da
   * kontrplak iken. Ahşap kapalı/kafes sandığın m³'ü tek tarifeyle fiyatlanır (ahşap tarifesi de uyar).
   */
  urunMalzemesiSecilebilir(): boolean {
    const f = this.urunForm;
    return f.isTuru !== 0 && f.isTuru !== 3 && f.isTuru !== 8 && ['', 'Kontrplak Sandık'].includes(f.sandikTipi);
  }

  /** Malzemeli tarife m³ fiyatıdır; seçilince fiyatlandırma m³'e sabitlenir. */
  urunMalzemesiSecildi(malzeme: 1 | 2 | null): void {
    this.urunForm.malzeme = malzeme;
    if (malzeme) this.urunForm.fiyatlandirmaBirimi = 2;
  }

  /**
   * Üretim iş türlerinde (4/5 dışı) isteğe bağlı sandık tipi: boş seçim bütün tiplere uyar; Kontrplak gibi bir tip
   * seçilirse tarife yalnız o tipe eşleşir ve fiyatlandırma birimi m³ önerilir (kontrplak sandıkta m³ işin
   * Fiyatlandırma sekmesinde ahşap + kontra olarak girilir). Kullanıcı birimi değiştirebilir.
   */
  urunSandikTipiSecildi(sandikTipi: string): void {
    this.urunForm.sandikTipi = sandikTipi;
    if (sandikTipi) this.urunForm.fiyatlandirmaBirimi = 2;
    if (!this.urunMalzemesiSecilebilir()) this.urunForm.malzeme = null;
  }

  /** Saha/yedek sandık tipi: boyut istenmez; katlanır sandık listede yoktur (tarifeyle değil, elle fiyatlanır). */
  urunSandikTipiDegisti(sandikTipi: string): void {
    this.urunForm.sandikTipi = sandikTipi;
    this.urunForm.fiyatlandirmaBirimi = 2;
    if (!this.urunMalzemesiSecilebilir()) this.urunForm.malzeme = null;
  }

  isTuruMetni(isTuru: number): string {
    return ({ 1: 'AMBALAJ', 2: 'İLAVE SANDIK', 3: 'İÇ SANDIK', 4: 'SAHA SANDIĞI', 5: 'YEDEK SANDIK', 6: 'TADİLAT', 7: 'DİĞER AMBALAJ', 8: 'ÖZEL İŞ', 9: 'SARF KERESTE' } as Record<number, string>)[isTuru] ?? 'DİĞER';
  }


  private grupAdi(deger: string): string {
    return deger.trim() || 'Diğer';
  }

  private sabitIs(grup: string): boolean {
    return ['Kira', 'Sevkiyat', 'Sabit İşler'].includes(this.grupAdi(grup));
  }

  /** Sunucu grup toplamlarında proje dışı işler "Sabit İşler" ve "Ekstra İşler" adıyla gelir. */
  private ozelGrupToplami(grup: string): boolean {
    return this.sabitIs(grup) || this.grupAdi(grup) === 'Ekstra İşler';
  }

  private grupOlustur(ad: string, satirlar: FinansAylikIs[]): AylikGrup {
    const kalemler = this.aylikGrupToplamlari()
      .filter(item => ad === 'Sabit İşler' ? this.sabitIs(item.grup) : this.grupAdi(item.grup) === 'Ekstra İşler');
    return { ad, satirlar, toplamlar: this.paraToplamlari(kalemler) };
  }

  /**
   * Para birimi bazında toplam: aktif para birimleri (tanım sırasıyla, tutarı olmasa da) ve veride geçen diğer
   * kodlar. Yeni para birimi eklendiğinde kod değişmeden görünür (F1).
   */
  private paraToplamlari(kalemler: { paraBirimi: string; toplamTutar: number }[]): ParaTutari[] {
    const toplam = new Map<string, number>();
    for (const kod of this.paraBirimleri.aktifKodlar()) toplam.set(kod, 0);
    for (const kalem of kalemler) toplam.set(kalem.paraBirimi, (toplam.get(kalem.paraBirimi) ?? 0) + kalem.toplamTutar);
    return [...toplam.entries()].map(([paraBirimi, tutar]) => ({ paraBirimi, tutar }));
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
    if (!this.altSekmeAcik(this.ayarGorunumu()) || this.ayarGorunumu() === 'parametreler') return;
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
        if (!this.altSekmeAcik('aylik')) return EMPTY;
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
      this.aylikProjeler.set(value.projeler ?? []);
      this.aylikProjeOzelIsleri.set(value.projeOzelIsleri ?? []);
      this.kirilimlariYenile();
      this.aylikFinansOzeti.set(value.finansOzeti ?? []);
      this.aylikGrupToplamlari.set(value.grupToplamlari ?? []);
      this.poOnayKuraliAcik.set(value.poOnayKuraliAcik ?? false);
      this.aylikPageNumber.set(value.pageNumber);
      this.aylikPageSize.set(value.pageSize);
      this.aylikTotalCount.set(value.totalCount);
      this.aylikTotalPages.set(value.totalPages);
      this.aylikHasPreviousPage.set(value.hasPreviousPage);
      this.aylikHasNextPage.set(value.hasNextPage);
    });

    this.giderListeIstekleri.pipe(
      switchMap(() => {
        if (!this.sekmeAcik('giderler')) return EMPTY;
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
        if (!this.altSekmeAcik('duzenli')) return EMPTY;
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
        if (!this.altSekmeAcik('tarifeler')) return EMPTY;
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

    this.giderPoAramalari.pipe(
      debounceTime(350),
      distinctUntilChanged(),
      switchMap(arama => arama && this.giderPoSecilebilir()
        ? this.service.siparisler({ pageNumber: 1, pageSize: 10, arama })
        : of({ isSuccess: true, value: undefined } as ApiResult<FinansSayfaliSonuc<FinansSiparis>>)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(result => this.giderPoSecenekleri.set(result.isSuccess ? (result.value?.items ?? []) : []));

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
  private bosGiderFormu(): FinansGiderKaydetRequest { return { finansSiparisId: null, tarih: this.tarihMetni(new Date()), finansTarihi: this.tarihMetni(new Date()), miktar: 1, birim: 'Adet', birimFiyat: 0, belgeNo: null, avansMi: false, mahsupEdilenAvansId: null, kategoriId: 0, giderKalemiId: null, altKategori: null, firmaVeyaKisi: null, aciklama: '', tutar: 0, paraBirimi: 'TRY', kdvDahil: false, kdvOrani: 20, projeId: null, isTuru: null }; }
  private bosDuzenliIsFormu(): FinansDuzenliIsKaydetRequest { return { projeId: null, isAdi: '', isTuru: '', musteri: this.finansMusterisi, aciklama: null, tekrarSikligi: 'Aylık', baslangicTarihi: this.tarihMetni(new Date()), bitisTarihi: null, olusturmaGunu: 1, miktar: 1, birim: 'Hizmet', birimFiyat: 0, paraBirimi: 'EUR', kdvOrani: 20, aktif: true }; }
  private bosUrunFormu() { return { kod: '', ad: '', fiyatlandirmaBirimi: 2 as 1 | 2 | 3 | 4, birimFiyat: 0, paraBirimi: 'EUR', kdvOrani: 20, gecerlilikBaslangici: this.tarihMetni(new Date()), aktif: true, sira: 0, eslesmeId: null as number | null, isTuru: 0, sandikAdi: '', sandikTipi: '', malzeme: null as 1 | 2 | null, icSandikSablonId: null as number | null }; }
  private ayinIlkGunu(tarih: Date): Date { return new Date(tarih.getFullYear(), tarih.getMonth(), 1); }
  private tarihMetni(tarih: Date): string { return `${tarih.getFullYear()}-${String(tarih.getMonth() + 1).padStart(2, '0')}-${String(tarih.getDate()).padStart(2, '0')}`; }
  private temizle(value: string | null | undefined): string | null { const temiz = value?.trim(); return temiz || null; }
}
