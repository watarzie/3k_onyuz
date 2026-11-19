import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Subject, debounceTime, switchMap, tap } from 'rxjs';
import { BreadcrumbComponent } from '../../../shared/components/breadcrumb/breadcrumb.component';
import { ServerPagerComponent } from '../../../shared/components/server-pager/server-pager.component';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { PermissionService } from '../../../core/services/permission.service';
import { YuklemePlanlamaService } from '../../../core/services/yukleme-planlama.service';
import { YETKI } from '../../../core/constants/yetki-kodlari';
import {
  PaginatedList,
  PlanProjeAdayi,
  PlanProjeBilgisi,
  PlanYukDurumu,
  PlanYukIzni,
  PlanYukKaynagi,
  PlanYukSatiri,
  YerlesimKontrolSonucu,
  YuklemeLokasyonTercihi,
  YuklemePlanAyarlari,
  YuklemePlaniDetayi,
  YuklemePlaniTanimlari,
} from '../../../shared/models/index';
import {
  BOS_TOPLU_DUZENLEME,
  IzinAlani,
  TopluIzinDuzenlemesi,
  UcDurum,
  dahilDegistir,
  duzenlenebilir,
  izinDegistir,
  ortakDeger,
  sandikYukleri,
  satirAnahtari,
  sayaclariHesapla,
  secimleriKoru,
  topluUygula,
  ustYukDegistir,
  ustYukSiniriGecerli,
  varsayilanaDondur,
} from '../ortak/plan-yuk-listesi';
import { PlanSecimleriComponent, YENI_PLAN_AYARLARI } from '../ortak/plan-secimleri.component';
import { KAYNAK_FARKI, YUK_DURUMU } from '../ortak/yukleme-etiketleri';
import { PlanYerlesimComponent } from './plan-yerlesim.component';

type DurumSuzgeci = 'hepsi' | PlanYukDurumu;
type UstYukTuru = 'koru' | 'bos' | 'brut' | 'deger';
type TopluAlan = keyof Omit<TopluIzinDuzenlemesi, 'ustYuk'>;
/** Yük listesinin kaynağı: seçim yok, önizleme bekleniyor, liste seçimle uyumlu ya da önizleme alınamadı. */
type ListeDurumu = 'bos' | 'yukleniyor' | 'hazir' | 'hata';

/** Yük tablosunun hazır satırı: şablon satır başına hesap yapmaz. */
interface YukGorunumu {
  satir: PlanYukSatiri;
  anahtar: string;
  /** Boy × en × yükseklik (mm); girilmemiş ölçü tire. */
  olcu: string;
  secili: boolean;
  /** Seçimleri hesap isteğiyle gönderilebilir (sandık yükü). */
  duzenlenebilir: boolean;
  elleDondurme: boolean;
  elleUsteKonma: boolean;
  elleAltaKalma: boolean;
  elleUstYuk: boolean;
}

const TOPLU_ALANLAR: { alan: TopluAlan; satirAlani: IzinAlani | 'dahil'; ad: string }[] = [
  { alan: 'dahil', satirAlani: 'dahil', ad: 'Hesaba dahil' },
  { alan: 'dondurme', satirAlani: 'dondurulebilirMi', ad: 'Tabanda 90° döndürülebilir' },
  { alan: 'usteKonma', satirAlani: 'usteKonabilirMi', ad: 'Üstüne yük konabilir' },
  { alan: 'altaKalma', satirAlani: 'altaKalabilirMi', ad: 'Başka yükün üstüne konabilir' },
];
const UC_DURUMLAR: { deger: UcDurum; ad: string }[] = [
  { deger: 'koru', ad: 'Koru' },
  { deger: 'aktif', ad: 'Aktif' },
  { deger: 'pasif', ad: 'Pasif' },
];
const ORTAK_DEGER_METNI = { aktif: 'Şu an: hepsi açık', pasif: 'Şu an: hepsi kapalı', karisik: 'Şu an: karışık' } as const;
const UST_YUK_MESAJI = 'Üst yük sınırı sıfır veya pozitif olmalıdır.';

/**
 * Yükleme simülasyonu (saha isteği 20.11.2026): tek sayfada projeler seçilir, araç ve yükleme yeri belirlenir, yük
 * listesinde hangi sandığın yükleneceği ve izinleri düzenlenir, "Hesapla" sonucu ve PDF raporları aynı sayfada verir.
 * Liste, ad ve kaydetme adımı yoktur; sunucu sonucu arka planda saklar. Yük listesi proje seçimi değiştikçe sunucudan
 * önizlemeyle gelir; kullanıcının bir sandıkta yaptığı seçim, sandık listede kaldıkça korunur.
 */
@Component({
  selector: 'app-plan-duzenle',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, FormsModule, BreadcrumbComponent, ServerPagerComponent, PlanSecimleriComponent, PlanYerlesimComponent],
  templateUrl: './plan-duzenle.component.html',
  styleUrls: ['../ortak/yukleme.scss', './plan-duzenle.component.scss'],
})
export class PlanDuzenleComponent implements OnInit {
  private readonly api = inject(YuklemePlanlamaService);
  private readonly toast = inject(ToastService);
  private readonly onay = inject(ConfirmService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly permissions = inject(PermissionService);
  private readonly destroyRef = inject(DestroyRef);

  readonly YUK_DURUMU = YUK_DURUMU;
  readonly KAYNAK_FARKI = KAYNAK_FARKI;
  readonly Durum = PlanYukDurumu;
  readonly Kaynak = PlanYukKaynagi;
  readonly Tercih = YuklemeLokasyonTercihi;
  readonly UC_DURUMLAR = UC_DURUMLAR;
  readonly breadcrumb = [{ label: 'Ana Kontrol Paneli', link: '/dashboard' }, { label: 'Yükleme Simülasyonu' }];

  /** Hesap ve elle yerleşim W ister; önizleme ve görüntüleme R ile açıktır. */
  readonly yazabilir = computed(() => this.permissions.canWrite(YETKI.YUKLEME_PLANLAMA.PLANLAR));

  /** Ekrandaki son hesap sonucu (sunucudaki kayıt); hesaplanana ya da bağlantıyla açılana kadar boştur. */
  readonly plan = signal<YuklemePlaniDetayi | null>(null);
  readonly tanimlar = signal<YuklemePlaniTanimlari | null>(null);
  /** Bağlantıyla açılan kaydın yüklenmesi. */
  readonly yukleniyor = signal(false);
  readonly hesaplaniyor = signal(false);
  /** Seçimler (proje, araç, yükleme yeri, yük seçimleri) son hesaptan farklı: yeni sonuç için "Hesapla" gerekir. */
  readonly degisti = signal(false);
  /** Elle yerleşim düzenleyicisi açık: son hesabın üstüne yazar, bu sırada seçimler değiştirilemez. */
  readonly elleDuzenleme = signal(false);
  /** Hesap sürüyor ya da elle düzenleme açık: yanıt seçimleri sessizce ezmesin diye proje seçimi de kilitlenir. */
  readonly mesgul = computed(() => this.hesaplaniyor() || this.elleDuzenleme());
  /** Hesabı etkileyen seçimler kilitli: W izni yok ya da ekran meşgul. */
  readonly kilitli = computed(() => !this.yazabilir() || this.mesgul());

  // ----- Seçimler -----
  readonly projeler = signal<PlanProjeBilgisi[]>([]);
  readonly projeIdleri = computed(() => this.projeler().filter((p) => p.projeId != null).map((p) => p.projeId!));
  readonly tasimaAilesiId = signal<number | null>(null);
  readonly ayarlar = signal<YuklemePlanAyarlari>(YENI_PLAN_AYARLARI);
  readonly lokasyonTercihi = signal<YuklemeLokasyonTercihi>(YuklemeLokasyonTercihi.Karisik);

  /** Ekrandaki sonucun proje kümesi seçimle aynı: hesap o kaydın üstüne yazılır (arada değiştiyse 409). */
  readonly ayniProjeKumesi = computed(() => {
    const p = this.plan();
    if (!p) return false;
    const sonuc = p.projeler.filter((x) => x.projeId != null).map((x) => x.projeId!).sort((a, b) => a - b);
    const secim = [...this.projeIdleri()].sort((a, b) => a - b);
    return sonuc.length === secim.length && sonuc.every((id, i) => id === secim[i]);
  });

  // ----- Proje tablosu (sunucuda sayfalı) -----
  readonly adayArama = signal('');
  readonly adaySayfa = signal(1);
  readonly adaylar = signal<PaginatedList<PlanProjeAdayi> | null>(null);
  readonly adayYukleniyor = signal(false);
  readonly adaySatirlari = computed(() => {
    const secili = new Set(this.projeIdleri());
    return (this.adaylar()?.items ?? []).map((aday) => ({ aday, secili: secili.has(aday.projeId) }));
  });
  private readonly adayAramaAkisi = new Subject<void>();
  /** Aday istekleri tek akıştan geçer: eski yanıt yeni aramanın ya da sayfanın sonucunu ezmez. */
  private readonly adayIstekleri = new Subject<void>();

  // ----- Yük listesi -----
  readonly satirlar = signal<PlanYukSatiri[]>([]);
  readonly listeDurumu = signal<ListeDurumu>('bos');
  /** Hesaba dahil yüklerin farklı lokasyon sayısı (sunucudan; yükleme yeri ipucu). */
  readonly farkliLokasyonSayisi = signal(0);
  /** Önizleme istekleri tek akıştan geçer: proje seçimi hızlı değişirse eski yanıt yenisini ezmez. */
  private readonly onizlemeIstekleri = new Subject<number[]>();

  readonly sayaclar = computed(() => sayaclariHesapla(this.satirlar()));
  readonly elleYukVar = computed(() => this.satirlar().some((s) => s.kaynak === PlanYukKaynagi.Manuel));
  readonly lokasyonIpucu = computed(() => {
    if (this.satirlar().length && this.farkliLokasyonSayisi() <= 1) {
      return 'Yükler şu an tek lokasyonda; ayrılacak başka lokasyon yok.';
    }
    return this.lokasyonTercihi() === YuklemeLokasyonTercihi.LokasyonaGoreAyri
      ? 'Her lokasyonun sandıkları ayrı araçlara dizilir; araç talep formu lokasyon başına araç sayısını verir.'
      : 'Bütün sandıklar birlikte, en az araçla dizilir.';
  });

  // ----- Süzgeç ve seçim -----
  readonly arama = signal('');
  readonly durumSuzgeci = signal<DurumSuzgeci>('hepsi');
  readonly projeSuzgeci = signal<number | 'hepsi' | 'manuel'>('hepsi');
  readonly secili = signal<ReadonlySet<string>>(new Set());
  readonly gorunenler = computed<YukGorunumu[]>(() => {
    const metin = this.arama().trim().toLocaleLowerCase('tr-TR');
    const durum = this.durumSuzgeci();
    const proje = this.projeSuzgeci();
    const secili = this.secili();
    return this.satirlar()
      .filter((s) =>
        (durum === 'hepsi' || s.durum === durum) &&
        (proje === 'hepsi' || (proje === 'manuel' ? s.kaynak === PlanYukKaynagi.Manuel : s.projeId === proje)) &&
        (!metin || s.kod.toLocaleLowerCase('tr-TR').includes(metin) || (s.aciklama ?? '').toLocaleLowerCase('tr-TR').includes(metin)))
      .map((s) => {
        const anahtar = satirAnahtari(s);
        return {
          satir: s,
          anahtar,
          olcu: `${s.boyMm ?? '—'} × ${s.enMm ?? '—'} × ${s.yukseklikMm ?? '—'}`,
          secili: secili.has(anahtar),
          duzenlenebilir: duzenlenebilir(s),
          elleDondurme: (s.elleDegisenIzinler & PlanYukIzni.Dondurme) !== 0,
          elleUsteKonma: (s.elleDegisenIzinler & PlanYukIzni.UsteKonma) !== 0,
          elleAltaKalma: (s.elleDegisenIzinler & PlanYukIzni.AltaKalma) !== 0,
          elleUstYuk: (s.elleDegisenIzinler & PlanYukIzni.UstYukSiniri) !== 0,
        };
      });
  });
  private readonly secilebilirGorunenler = computed(() => this.gorunenler().filter((g) => g.duzenlenebilir));
  readonly gorunenSeciliSayisi = computed(() => this.secilebilirGorunenler().filter((g) => g.secili).length);
  readonly hepsiSecili = computed(() => this.secilebilirGorunenler().length > 0 && this.gorunenSeciliSayisi() === this.secilebilirGorunenler().length);
  readonly sutunSayisi = computed(() => (this.yazabilir() ? 13 : 11));
  readonly bosListeMetni = computed(() =>
    this.satirlar().length ? 'Süzgece uyan yük yok.' : this.listeDurumu() === 'yukleniyor' ? 'Yük listesi yükleniyor…' : 'Seçilen projelerde sandık yok.');

  // ----- Toplu izin penceresi -----
  readonly topluAcik = signal(false);
  readonly toplu = signal<TopluIzinDuzenlemesi>({ ...BOS_TOPLU_DUZENLEME });
  readonly topluUstYukTuru = signal<UstYukTuru>('koru');
  readonly topluUstYukKg = signal<number | null>(null);
  readonly topluAlanlar = computed(() => {
    const satirlar = this.satirlar();
    const secili = this.secili();
    const duzenleme = this.toplu();
    return TOPLU_ALANLAR.map((a) => {
      const ortak = ortakDeger(satirlar, secili, a.satirAlani);
      return { alan: a.alan, ad: a.ad, deger: duzenleme[a.alan], ortak: ortak ? ORTAK_DEGER_METNI[ortak] : '' };
    });
  });

  /** "Hesapla" neden kapalı (yoksa boş): izin, proje, yük listesi, taşıma ailesi ya da açık elle düzenleme. */
  readonly hesapEngeli = computed<string | null>(() => {
    if (!this.yazabilir()) return 'Hesaplamak için bu ekranda düzenleme yetkisi gerekir.';
    if (this.elleDuzenleme()) return 'Elle düzenleme açıkken hesaplanamaz.';
    if (!this.projeIdleri().length) return 'Önce en az bir proje seçin.';
    if (this.listeDurumu() === 'yukleniyor') return 'Yük listesi yükleniyor…';
    if (this.listeDurumu() === 'hata') return 'Yük listesi alınamadı; yeniden deneyin.';
    if (!this.tasimaAilesiId()) return 'Taşıma ailesi seçin.';
    // Sunucudaki "hesaplanacak yük yok" kuralının aynası: dahil ve ölçü/ağırlığı tam en az bir yük gerekir.
    if (this.sayaclar().hesaplanabilir === 0) return 'Hesaplanacak yük yok: dahil ve ölçüsü, ağırlığı tam en az bir sandık olmalı.';
    return null;
  });

  ngOnInit(): void {
    this.adayAramaAkisi.pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.adaySayfa.set(1);
      this.adaylariYukle();
    });
    this.adayIstekleri
      .pipe(
        tap(() => this.adayYukleniyor.set(true)),
        switchMap(() => this.api.projeAdaylari(this.adayArama(), this.adaySayfa(), 10)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((r) => {
        this.adayYukleniyor.set(false);
        if (r.isSuccess && r.value) this.adaylar.set(r.value);
        else this.toast.error(r.error ?? 'Projeler yüklenemedi.');
      });
    this.onizlemeIstekleri
      .pipe(
        switchMap((idler) => (idler.length ? this.api.yukOnizleme(idler) : EMPTY)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((r) => {
        if (r.isSuccess && r.value) {
          this.yukleriYerlestir(secimleriKoru(r.value.yukler, this.satirlar()), r.value.farkliLokasyonSayisi);
        } else {
          this.listeDurumu.set('hata');
          this.toast.error(r.error ?? 'Yük listesi alınamadı.');
        }
      });
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((p) => {
      const id = Number(p.get('id'));
      if (p.has('id') && Number.isInteger(id) && id > 0) this.yukle(id);
    });
    this.api.tanimlar().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((r) => {
      if (r.isSuccess && r.value) {
        this.tanimlar.set(r.value);
        if (!this.tasimaAilesiId() && r.value.tasimaAileleri.length) this.tasimaAilesiId.set(r.value.tasimaAileleri[0].id);
      } else {
        this.toast.error(r.error ?? 'Taşıma aileleri yüklenemedi.');
      }
    });
    this.adaylariYukle();
  }

  /** Bağlantıyla (`/yukleme-planlari/:id`) açılan kaydı getirir; bulunamazsa boş sayfaya döner. */
  private yukle(id: number): void {
    this.yukleniyor.set(true);
    this.api.plan(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe((r) => {
      this.yukleniyor.set(false);
      if (r.isSuccess && r.value) this.sonucuYerlestir(r.value);
      else {
        this.toast.error(r.error ?? 'Simülasyon yüklenemedi.');
        if (r.statusCode === 404) this.router.navigate(['/yukleme-planlari']);
      }
    });
  }

  /** Sunucudan gelen sonucu ekrana alır: seçimler ve yük listesi sunucunun uyguladığı değerlerle güncellenir. */
  private sonucuYerlestir(p: YuklemePlaniDetayi): void {
    this.onizlemeIstekleri.next([]);
    this.plan.set(p);
    this.tasimaAilesiId.set(p.tasimaAilesiId);
    this.ayarlar.set({ ...p.ayarlar, mevcutAraclar: [], tipIdleri: [...(p.ayarlar.tipIdleri ?? [])] });
    this.lokasyonTercihi.set(
      p.lokasyonTercihi === YuklemeLokasyonTercihi.LokasyonaGoreAyri ? YuklemeLokasyonTercihi.LokasyonaGoreAyri : YuklemeLokasyonTercihi.Karisik);
    this.projeler.set([...p.projeler]);
    this.yukleriYerlestir(p.yukler, p.farkliLokasyonSayisi);
    this.degisti.set(false);
  }

  private yukleriYerlestir(satirlar: PlanYukSatiri[], farkliLokasyonSayisi: number): void {
    this.satirlar.set(satirlar);
    this.farkliLokasyonSayisi.set(farkliLokasyonSayisi);
    const anahtarlar = new Set(satirlar.map(satirAnahtari));
    this.secili.update((secili) => new Set([...secili].filter((a) => anahtarlar.has(a))));
    this.listeDurumu.set('hazir');
  }

  // ----- Projeler -----

  adaylariYukle(): void {
    this.adayIstekleri.next();
  }

  adayAramaDegisti(metin: string): void {
    this.adayArama.set(metin);
    this.adayAramaAkisi.next();
  }

  adaySayfaDegisti(sayfa: number): void {
    this.adaySayfa.set(sayfa);
    this.adaylariYukle();
  }

  /** Proje tablosunda satır: seçiliyse çıkarır, değilse ekler. */
  projeDegistir(a: PlanProjeAdayi): void {
    if (this.mesgul()) return;
    if (this.projeIdleri().includes(a.projeId)) this.projeler.update((l) => l.filter((x) => x.projeId !== a.projeId));
    else this.projeler.update((l) => [...l, { projeId: a.projeId, projeNo: a.projeNo, musteri: a.musteri, projeTipiId: a.projeTipiId }]);
    this.projelerDegisti();
  }

  /** Seçili proje etiketindeki çıkarma düğmesi. */
  projeCikar(p: PlanProjeBilgisi): void {
    if (p.projeId == null || this.mesgul()) return;
    this.projeler.update((l) => l.filter((x) => x.projeId !== p.projeId));
    this.projelerDegisti();
  }

  /** Proje seçimi değişti: yük listesi sunucudan yeniden istenir; seçim boşsa çağrı atılmaz, liste boşalır. */
  private projelerDegisti(): void {
    this.degisti.set(true);
    this.projeSuzgeci.set('hepsi');
    this.yukleriIste();
  }

  yukleriIste(): void {
    const idler = this.projeIdleri();
    if (idler.length) {
      this.listeDurumu.set('yukleniyor');
    } else {
      this.satirlar.set([]);
      this.farkliLokasyonSayisi.set(0);
      this.secili.set(new Set());
      this.listeDurumu.set('bos');
    }
    this.onizlemeIstekleri.next(idler);
  }

  // ----- Araç ve yükleme -----

  aileDegistir(aileId: number): void {
    this.tasimaAilesiId.set(aileId);
    this.degisti.set(true);
  }

  ayarlarDegistir(ayarlar: YuklemePlanAyarlari): void {
    this.ayarlar.set(ayarlar);
    this.degisti.set(true);
  }

  lokasyonSec(tercih: YuklemeLokasyonTercihi): void {
    if (this.kilitli() || tercih === this.lokasyonTercihi()) return;
    this.lokasyonTercihi.set(tercih);
    this.degisti.set(true);
  }

  // ----- Yük seçimleri -----

  private satirGuncelle(anahtar: string, f: (s: PlanYukSatiri) => PlanYukSatiri): void {
    if (this.kilitli()) return;
    this.satirlar.update((liste) => liste.map((x) => (duzenlenebilir(x) && satirAnahtari(x) === anahtar ? f(x) : x)));
    this.degisti.set(true);
  }

  dahilDegistir(g: YukGorunumu): void {
    this.satirGuncelle(g.anahtar, (s) => dahilDegistir(s, !s.dahil));
  }

  izinDegistir(g: YukGorunumu, alan: IzinAlani): void {
    this.satirGuncelle(g.anahtar, (s) => izinDegistir(s, alan, !s[alan]));
  }

  /** Üst yük sınırı kutusu: boş "bilinmiyor" demektir; geçersiz değer reddedilir ve kutu eski değere döner. */
  ustYukDegistir(g: YukGorunumu, kutu: HTMLInputElement): void {
    const kg = sayi(kutu.value);
    if (Number.isNaN(kg) || !ustYukSiniriGecerli(kg)) {
      kutu.value = g.satir.ustYukSiniriKg?.toString() ?? '';
      this.toast.error(UST_YUK_MESAJI);
      return;
    }
    this.satirGuncelle(g.anahtar, (s) => ustYukDegistir(s, kg));
  }

  varsayilanaDondur(g: YukGorunumu): void {
    this.satirGuncelle(g.anahtar, varsayilanaDondur);
  }

  secimDegistir(g: YukGorunumu): void {
    const yeni = new Set(this.secili());
    if (yeni.has(g.anahtar)) yeni.delete(g.anahtar);
    else yeni.add(g.anahtar);
    this.secili.set(yeni);
  }

  hepsiniSec(sec: boolean): void {
    const yeni = new Set(this.secili());
    for (const g of this.secilebilirGorunenler()) {
      if (sec) yeni.add(g.anahtar);
      else yeni.delete(g.anahtar);
    }
    this.secili.set(yeni);
  }

  secimiTemizle(): void {
    this.secili.set(new Set());
  }

  // ----- Toplu izin -----

  topluAc(): void {
    if (!this.secili().size || this.kilitli()) return;
    this.toplu.set({ ...BOS_TOPLU_DUZENLEME });
    this.topluUstYukTuru.set('koru');
    this.topluUstYukKg.set(null);
    this.topluAcik.set(true);
  }

  topluAlanDegistir(alan: TopluAlan, deger: UcDurum): void {
    this.toplu.update((t) => ({ ...t, [alan]: deger }));
  }

  topluUstYukDegistir(deger: unknown): void {
    const kg = sayi(deger);
    this.topluUstYukKg.set(Number.isNaN(kg) ? null : kg);
  }

  topluUygula(): void {
    if (this.kilitli()) return;
    const tur = this.topluUstYukTuru();
    const kg = this.topluUstYukKg();
    if (tur === 'deger' && (kg === null || !ustYukSiniriGecerli(kg))) {
      this.toast.error(UST_YUK_MESAJI);
      return;
    }
    const duzenleme: TopluIzinDuzenlemesi = { ...this.toplu(), ustYuk: tur === 'deger' ? { tur, kg: kg! } : { tur } };
    this.satirlar.update((liste) => topluUygula(liste, this.secili(), duzenleme));
    this.degisti.set(true);
    this.topluAcik.set(false);
    this.toast.success(`${this.secili().size} yük güncellendi; "Hesapla" ile uygulanır.`);
  }

  // ----- Hesap -----

  /**
   * Tek adımlı hesap: seçimler ve listedeki bütün sandık seçimleriyle sonuç yeniden kurulur; sayfada kalınır. Ekrandaki
   * yerleşim elle düzenlenmişse önce sorulur.
   */
  async hesapla(): Promise<void> {
    if (this.hesaplaniyor()) return;
    const engel = this.hesapEngeli();
    if (engel) return this.toast.error(engel);
    const p = this.plan();
    if (p?.yerlesim?.elleDuzenlendi) {
      const tamam = await this.onay.ask({
        title: 'Yeniden hesapla',
        message: 'Yerleşim elle düzenlendi. Yeniden hesaplamak elle düzenlemeyi otomatik öneriyle değiştirir.',
        confirmText: 'Hesapla',
        type: 'warning',
      });
      if (!tamam) return;
    }
    const ayni = p !== null && this.ayniProjeKumesi();
    this.hesaplaniyor.set(true);
    this.api.planHesapla({
      planId: ayni ? p.id : null,
      beklenenRevizyonNo: ayni ? p.revizyonNo : null,
      projeIdleri: this.projeIdleri(),
      tasimaAilesiId: this.tasimaAilesiId()!,
      lokasyonTercihi: this.lokasyonTercihi(),
      ayarlar: this.ayarlar(),
      sandikYukleri: sandikYukleri(this.satirlar()),
    }).subscribe((r) => {
      this.hesaplaniyor.set(false);
      if (r.isSuccess && r.value) {
        this.sonucuYerlestir(r.value);
        const y = r.value.yerlesim;
        this.toast.success(y
          ? `Yerleşim hesaplandı: ${y.araclar.length} araç, ${r.value.sayaclar.yerlesemeyen} yerleşemeyen yük.`
          : 'Yerleşim hesaplandı.');
      } else {
        // 409'da yönergeyi sunucu verir (yenile ya da yeniden hesapla); istemci ayrıca cümle eklemez.
        this.toast.error(r.error ?? (r.statusCode === 409
          ? 'Sonuç arada başka biri tarafından yeniden hesaplandı; sayfayı yenileyip tekrar deneyin.'
          : 'Yerleşim hesaplanamadı.'));
      }
    });
  }

  /** Elle düzenlenen yerleşim sunucuya yazıldı. */
  elleKaydedildi(p: YuklemePlaniDetayi): void {
    this.sonucuYerlestir(p);
    this.toast.success(p.yerlesim?.sonuc === YerlesimKontrolSonucu.Uygunsuz
      ? 'Elle yerleşim uygulandı; uygunsuzluk var, raporlar taslak basılır.'
      : 'Elle yerleşim uygulandı.');
  }

  /** Seçimleri ve yük listesini son hesaba döndürür. */
  sonHesabaDon(): void {
    const p = this.plan();
    if (p && this.degisti() && !this.mesgul()) this.sonucuYerlestir(p);
  }
}

/** Sayı kutusunun değeri: boş `null`, sayı değilse `NaN`. */
function sayi(deger: unknown): number | null {
  if (deger === null || deger === undefined || deger === '') return null;
  return Number(deger);
}
