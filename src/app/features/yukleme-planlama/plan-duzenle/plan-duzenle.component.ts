import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime } from 'rxjs';
import { BreadcrumbComponent } from '../../../shared/components/breadcrumb/breadcrumb.component';
import { ServerPagerComponent } from '../../../shared/components/server-pager/server-pager.component';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { PermissionService } from '../../../core/services/permission.service';
import { YuklemePlanlamaService } from '../../../core/services/yukleme-planlama.service';
import { YETKI } from '../../../core/constants/yetki-kodlari';
import {
  EkipmanKonfigurasyonOzeti,
  PaginatedList,
  PlanMevcutArac,
  PlanProjeAdayi,
  PlanProjeBilgisi,
  PlanYukDurumu,
  PlanYukIzni,
  PlanYukKaynagi,
  PlanYukSatiri,
  YerlesimKontrolSonucu,
  YukTuru,
  YuklemeCalismaBicimi,
  YuklemeLokasyonTercihi,
  YuklemePlanAyarlari,
  YuklemePlaniDetayi,
  YuklemePlaniTanimlari,
  YuklemeProjeKarisimi,
} from '../../../shared/models/index';
import {
  BOS_TOPLU_DUZENLEME,
  ENFAZLA_AGIRLIK_KG,
  ENFAZLA_OLCU_MM,
  IzinAlani,
  ManuelYukBilgisi,
  TopluIzinDuzenlemesi,
  UcDurum,
  dahilDegistir,
  izinDegistir,
  manuelYukSatirlari,
  ortakDeger,
  satirAnahtari,
  sayaclariHesapla,
  sonrakiGrupNo,
  topluUygula as topluUygulaSaf,
  ustYukDegistir,
  ustYukSiniriGecerli,
  varsayilanaDondur,
  yukIstekleri,
} from '../ortak/plan-yuk-listesi';
import { CALISMA_BICIMI, KAYNAK_FARKI, PROJE_KARISIMI, YUK_DURUMU } from '../ortak/yukleme-etiketleri';
import { PlanYerlesimComponent } from './plan-yerlesim.component';

type DurumSuzgeci = 'hepsi' | PlanYukDurumu;
type UstYukTuru = 'koru' | 'bos' | 'brut' | 'deger';

interface ManuelForm {
  grupNo: number | null;
  kod: string;
  aciklama: string;
  yukTuruId: number;
  boyMm: number | null;
  enMm: number | null;
  yukseklikMm: number | null;
  brutKg: number | null;
  adet: number;
  projeId: number | null;
  lokasyonId: number | null;
  ozelTasimaNotu: string;
}

/**
 * Yükleme planı: başlık, projeler, ayarlar ve yük listesi (isterler 3–7). Değişiklikler yerelde tutulur ve
 * "Kaydet" ile yeni revizyon olarak yazılır; arada başka biri kaydettiyse sunucu 409 döner. Ölçü, ağırlık ve lokasyon
 * plandaki kopyadan gelir; kaynak sandık değiştiyse fark listesi gösterilir ve yalnız "Kaynaktan güncelle" ile alınır.
 */
@Component({
  selector: 'app-plan-duzenle',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DecimalPipe, FormsModule, BreadcrumbComponent, ServerPagerComponent, PlanYerlesimComponent],
  templateUrl: './plan-duzenle.component.html',
  styleUrls: ['../ortak/yukleme.scss', './plan-duzenle.component.scss'],
})
export class PlanDuzenleComponent implements OnInit {
  private readonly api = inject(YuklemePlanlamaService);
  private readonly toast = inject(ToastService);
  private readonly onay = inject(ConfirmService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly izin = inject(PermissionService);
  private readonly destroyRef = inject(DestroyRef);

  readonly CALISMA_BICIMI = CALISMA_BICIMI;
  readonly PROJE_KARISIMI = PROJE_KARISIMI;
  readonly YUK_DURUMU = YUK_DURUMU;
  readonly KAYNAK_FARKI = KAYNAK_FARKI;
  readonly Bicim = YuklemeCalismaBicimi;
  readonly Karisim = YuklemeProjeKarisimi;
  readonly Durum = PlanYukDurumu;
  readonly Kaynak = PlanYukKaynagi;
  readonly Izin = PlanYukIzni;
  readonly ENFAZLA_OLCU_MM = ENFAZLA_OLCU_MM;
  readonly ENFAZLA_AGIRLIK_KG = ENFAZLA_AGIRLIK_KG;
  readonly anahtar = satirAnahtari;

  readonly yazabilir = computed(() => this.izin.canWrite(YETKI.YUKLEME_PLANLAMA.PLANLAR));

  readonly planId = signal(0);
  readonly plan = signal<YuklemePlaniDetayi | null>(null);
  readonly tanimlar = signal<YuklemePlaniTanimlari | null>(null);
  readonly yukleniyor = signal(true);
  readonly kaydediliyor = signal(false);
  readonly degisti = signal(false);

  // ----- Düzenlenen durum -----
  readonly ad = signal('');
  readonly calismaBicimi = signal<YuklemeCalismaBicimi>(YuklemeCalismaBicimi.IhtiyacaGoreArac);
  readonly tasimaAilesiId = signal<number | null>(null);
  readonly projeKarisimi = signal<YuklemeProjeKarisimi>(YuklemeProjeKarisimi.Karisik);
  readonly yuklemeTarihi = signal('');
  readonly aciklama = signal('');
  readonly ayarlar = signal<YuklemePlanAyarlari>({
    yerlesimBosluguMm: 30, yukseklikPayiMm: null, genislikPayiMm: null, uzunlukPayiMm: null, agirlikPayiKg: null, yuklemeHareketiPayiMm: null, agirlikMerkeziSapmaYuzde: null,
    mevcutAraclar: [], tipIdleri: [],
  });
  /** Seçili taşıma ailesinin tipleri (iki kademeli seçim: önce aile, sonra tip). */
  readonly aileTipleri = computed(() => (this.tanimlar()?.tasimaTipleri ?? []).filter((t) => t.aileId === this.tasimaAilesiId()));
  readonly seciliTipler = computed(() => new Set(this.ayarlar().tipIdleri));
  readonly hesaplaniyor = signal(false);
  /** Mevcut araçlara yerleştirmede seçilebilecek konfigürasyonlar (aktif, en fazla 100). */
  readonly konfigurasyonlar = signal<EkipmanKonfigurasyonOzeti[]>([]);
  readonly projeler = signal<PlanProjeBilgisi[]>([]);
  readonly satirlar = signal<PlanYukSatiri[]>([]);
  readonly secili = signal<Set<string>>(new Set());

  readonly breadcrumb = computed(() => [
    { label: 'Ana Kontrol Paneli', link: '/dashboard' },
    { label: 'Yükleme Planları', link: '/yukleme-planlari' },
    { label: this.plan()?.planNo ?? 'Plan' },
  ]);

  readonly sayaclar = computed(() => {
    const p = this.plan();
    return sayaclariHesapla(this.satirlar(), p?.sayaclar.sevkEdilmisSandik ?? 0);
  });
  readonly projeIdleri = computed(() => this.projeler().filter((p) => p.projeId != null).map((p) => p.projeId!));
  /** Kaydedilmemiş proje değişikliği varsa yeni projenin sandıkları kayıttan sonra gelir. */
  readonly projelerDegisti = computed(() => {
    const kayitli = (this.plan()?.projeler ?? []).filter((p) => p.projeId != null).map((p) => p.projeId!).sort().join(',');
    return kayitli !== [...this.projeIdleri()].sort().join(',');
  });

  // ----- Süzgeç ve seçim -----
  readonly arama = signal('');
  readonly durumSuzgeci = signal<DurumSuzgeci>('hepsi');
  readonly projeSuzgeci = signal<number | 'hepsi' | 'manuel'>('hepsi');
  readonly gorunenler = computed(() => {
    const metin = this.arama().trim().toLocaleLowerCase('tr-TR');
    const durum = this.durumSuzgeci();
    const proje = this.projeSuzgeci();
    return this.satirlar().filter((s) =>
      (durum === 'hepsi' || s.durum === durum) &&
      (proje === 'hepsi' || (proje === 'manuel' ? s.kaynak === PlanYukKaynagi.Manuel : s.projeId === proje)) &&
      (!metin || s.kod.toLocaleLowerCase('tr-TR').includes(metin) || (s.aciklama ?? '').toLocaleLowerCase('tr-TR').includes(metin)));
  });
  readonly gorunenSeciliSayisi = computed(() => {
    const secili = this.secili();
    return this.gorunenler().filter((s) => secili.has(satirAnahtari(s))).length;
  });
  readonly hepsiSecili = computed(() => this.gorunenler().length > 0 && this.gorunenSeciliSayisi() === this.gorunenler().length);

  // ----- Toplu izin penceresi -----
  readonly topluAcik = signal(false);
  readonly toplu = signal<TopluIzinDuzenlemesi>({ ...BOS_TOPLU_DUZENLEME });
  readonly topluUstYukTuru = signal<UstYukTuru>('koru');
  readonly topluUstYukKg = signal<number | null>(null);
  readonly TOPLU_ALANLAR: { alan: keyof Omit<TopluIzinDuzenlemesi, 'ustYuk'>; satirAlani: IzinAlani | 'dahil'; ad: string }[] = [
    { alan: 'dahil', satirAlani: 'dahil', ad: 'Planlamaya dahil' },
    { alan: 'dondurme', satirAlani: 'dondurulebilirMi', ad: 'Tabanda 90° döndürülebilir' },
    { alan: 'usteKonma', satirAlani: 'usteKonabilirMi', ad: 'Üstüne yük konabilir' },
    { alan: 'altaKalma', satirAlani: 'altaKalabilirMi', ad: 'Başka yükün üstüne konabilir' },
  ];

  // ----- Elle yük penceresi -----
  readonly manuelAcik = signal(false);
  readonly manuel = signal<ManuelForm>(this.bosManuel());

  // ----- Proje ekleme penceresi -----
  readonly projeEkleAcik = signal(false);
  readonly adayArama = signal('');
  readonly adaySayfa = signal(1);
  readonly adaylar = signal<PaginatedList<PlanProjeAdayi> | null>(null);
  private readonly adayAramaAkisi = new Subject<void>();

  // ----- Kaydetme penceresi -----
  readonly kaydetAcik = signal(false);
  readonly revizyonAciklamasi = signal('');
  readonly ayarlarAcik = signal(false);

  ngOnInit(): void {
    this.adayAramaAkisi.pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.adaySayfa.set(1);
      this.adaylariYukle();
    });
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((p) => {
      this.planId.set(Number(p.get('id')));
      this.yukle();
    });
    this.api.tanimlar().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((r) => {
      if (r.isSuccess && r.value) this.tanimlar.set(r.value);
    });
  }

  yukle(): void {
    this.yukleniyor.set(true);
    this.api.plan(this.planId()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe((r) => {
      this.yukleniyor.set(false);
      if (r.isSuccess && r.value) this.planiYerlestir(r.value);
      else {
        this.toast.error(r.error ?? 'Plan yüklenemedi.');
        if (r.statusCode === 404) this.router.navigate(['/yukleme-planlari']);
      }
    });
  }

  private planiYerlestir(p: YuklemePlaniDetayi): void {
    this.plan.set(p);
    this.ad.set(p.ad);
    this.calismaBicimi.set(p.calismaBicimi);
    this.tasimaAilesiId.set(p.tasimaAilesiId);
    this.projeKarisimi.set(p.projeKarisimi);
    this.yuklemeTarihi.set(p.yuklemeTarihi ? p.yuklemeTarihi.substring(0, 10) : '');
    this.aciklama.set(p.aciklama ?? '');
    this.ayarlar.set({ ...p.ayarlar, mevcutAraclar: [...(p.ayarlar.mevcutAraclar ?? [])], tipIdleri: [...(p.ayarlar.tipIdleri ?? [])] });
    if (p.calismaBicimi === YuklemeCalismaBicimi.MevcutAraclaraYerlestirme) this.konfigurasyonlariYukle();
    this.projeler.set([...p.projeler]);
    this.satirlar.set(p.yukler.map((y) => ({ ...y })));
    this.secili.set(new Set());
    this.degisti.set(false);
  }

  degistir<T>(sinyal: { set(v: T): void }, deger: T): void {
    sinyal.set(deger);
    this.degisti.set(true);
  }

  /** Aile değişince önceki ailenin tip seçimi geçersizdir (sunucu da reddeder). */
  aileDegistir(aileId: number): void {
    if (aileId === this.tasimaAilesiId()) return;
    this.tasimaAilesiId.set(aileId);
    this.ayarlar.update((a) => ({ ...a, tipIdleri: [] }));
    this.degisti.set(true);
  }

  tipDegistir(tipId: number): void {
    this.ayarlar.update((a) => ({
      ...a,
      tipIdleri: a.tipIdleri.includes(tipId) ? a.tipIdleri.filter((id) => id !== tipId) : [...a.tipIdleri, tipId],
    }));
    this.degisti.set(true);
  }

  calismaBicimiDegistir(bicim: YuklemeCalismaBicimi): void {
    this.degistir(this.calismaBicimi, bicim);
    if (bicim === YuklemeCalismaBicimi.MevcutAraclaraYerlestirme) {
      this.ayarlarAcik.set(true);
      this.konfigurasyonlariYukle();
    }
  }

  private konfigurasyonlariYukle(): void {
    if (this.konfigurasyonlar().length) return;
    this.api.konfigurasyonlar({ boyut: 100 }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe((r) => {
      if (r.isSuccess && r.value) this.konfigurasyonlar.set(r.value.items);
    });
  }

  mevcutAracEkle(): void {
    const kullanilan = new Set(this.ayarlar().mevcutAraclar.map((m) => m.konfigurasyonId));
    const ilk = this.konfigurasyonlar().find((k) => !kullanilan.has(k.id));
    if (!ilk) return this.toast.error('Eklenecek başka ekipman konfigürasyonu yok.');
    this.mevcutAraclariAyarla([...this.ayarlar().mevcutAraclar, { konfigurasyonId: ilk.id, adet: 1 }]);
  }

  mevcutAracDegistir(i: number, alan: keyof PlanMevcutArac, deger: number | null): void {
    const liste = this.ayarlar().mevcutAraclar.map((m, j) => (j === i ? { ...m, [alan]: deger ?? 1 } : m));
    this.mevcutAraclariAyarla(liste);
  }

  mevcutAracSil(i: number): void {
    this.mevcutAraclariAyarla(this.ayarlar().mevcutAraclar.filter((_, j) => j !== i));
  }

  private mevcutAraclariAyarla(liste: PlanMevcutArac[]): void {
    this.ayarlar.update((a) => ({ ...a, mevcutAraclar: liste }));
    this.degisti.set(true);
  }

  /** Otomatik yerleşim: son kaydedilen revizyonla; sonuç yeni revizyon olarak gelir. */
  hesapla(tercih: YuklemeLokasyonTercihi): void {
    const p = this.plan();
    if (!p || this.hesaplaniyor() || this.degisti()) return;
    this.hesaplaniyor.set(true);
    this.api.hesapla(p.id, p.revizyonNo, tercih).subscribe((r) => {
      this.hesaplaniyor.set(false);
      if (r.isSuccess && r.value) {
        this.planiYerlestir(r.value);
        const y = r.value.yerlesim;
        this.toast.success(y
          ? `Yerleşim hesaplandı: ${y.araclar.length} araç, ${r.value.sayaclar.yerlesemeyen} yerleşemeyen yük.`
          : 'Yerleşim hesaplandı.');
      } else {
        this.toast.error(r.error ?? 'Yerleşim hesaplanamadı.');
      }
    });
  }

  /** Elle düzenlenen yerleşim yeni revizyon olarak kaydedildi. */
  elleKaydedildi(p: YuklemePlaniDetayi): void {
    this.planiYerlestir(p);
    this.toast.success(p.yerlesim?.sonuc === YerlesimKontrolSonucu.Uygunsuz
      ? `Elle yerleşim revizyon ${p.revizyonNo} olarak kaydedildi; uygunsuzluk var, raporlar taslak basılır.`
      : `Elle yerleşim revizyon ${p.revizyonNo} olarak kaydedildi.`);
  }

  ayarDegistir(alan: keyof YuklemePlanAyarlari, deger: number | null): void {
    this.ayarlar.update((a) => ({ ...a, [alan]: deger === null || Number.isNaN(deger) ? (alan === 'yerlesimBosluguMm' ? 0 : null) : deger }));
    this.degisti.set(true);
  }

  // ----- Satır işlemleri -----

  private satirGuncelle(s: PlanYukSatiri, f: (s: PlanYukSatiri) => PlanYukSatiri): void {
    const anahtar = satirAnahtari(s);
    this.satirlar.update((liste) => liste.map((x) => (satirAnahtari(x) === anahtar ? f(x) : x)));
    this.degisti.set(true);
  }

  dahilDegistir(s: PlanYukSatiri, dahil: boolean): void {
    this.satirGuncelle(s, (x) => dahilDegistir(x, dahil));
  }

  izinDegistir(s: PlanYukSatiri, alan: IzinAlani, deger: boolean): void {
    this.satirGuncelle(s, (x) => izinDegistir(x, alan, deger));
  }

  ustYukDegistir(s: PlanYukSatiri, deger: number | null): void {
    const kg = deger === null || Number.isNaN(deger) ? null : deger;
    if (!ustYukSiniriGecerli(kg)) {
      this.toast.error('Üst yük sınırı sıfır veya pozitif olmalıdır.');
      return;
    }
    this.satirGuncelle(s, (x) => ustYukDegistir(x, kg));
  }

  varsayilanaDondur(s: PlanYukSatiri): void {
    this.satirGuncelle(s, varsayilanaDondur);
  }

  elleDegistiMi(s: PlanYukSatiri, bayrak: PlanYukIzni): boolean {
    return (s.elleDegisenIzinler & bayrak) !== 0;
  }

  seciliMi(s: PlanYukSatiri): boolean {
    return this.secili().has(satirAnahtari(s));
  }

  secimDegistir(s: PlanYukSatiri): void {
    const yeni = new Set(this.secili());
    const a = satirAnahtari(s);
    if (yeni.has(a)) yeni.delete(a);
    else yeni.add(a);
    this.secili.set(yeni);
  }

  hepsiniSec(sec: boolean): void {
    const yeni = new Set(this.secili());
    for (const s of this.gorunenler()) {
      if (sec) yeni.add(satirAnahtari(s));
      else yeni.delete(satirAnahtari(s));
    }
    this.secili.set(yeni);
  }

  secimiTemizle(): void {
    this.secili.set(new Set());
  }

  // ----- Toplu izin -----

  topluAc(): void {
    if (!this.secili().size) return;
    this.toplu.set({ ...BOS_TOPLU_DUZENLEME });
    this.topluUstYukTuru.set('koru');
    this.topluUstYukKg.set(null);
    this.topluAcik.set(true);
  }

  topluAlanDegistir(alan: keyof Omit<TopluIzinDuzenlemesi, 'ustYuk'>, deger: UcDurum): void {
    this.toplu.update((t) => ({ ...t, [alan]: deger }));
  }

  ortakDeger(alan: IzinAlani | 'dahil'): string {
    const d = ortakDeger(this.satirlar(), this.secili(), alan);
    return d === 'aktif' ? 'Şu an: hepsi açık' : d === 'pasif' ? 'Şu an: hepsi kapalı' : d === 'karisik' ? 'Şu an: karışık' : '';
  }

  topluUygula(): void {
    const tur = this.topluUstYukTuru();
    const kg = this.topluUstYukKg();
    if (tur === 'deger' && (kg === null || !ustYukSiniriGecerli(kg))) {
      this.toast.error('Üst yük sınırı sıfır veya pozitif olmalıdır.');
      return;
    }
    const duzenleme: TopluIzinDuzenlemesi = {
      ...this.toplu(),
      ustYuk: tur === 'deger' ? { tur, kg: kg! } : { tur },
    };
    this.satirlar.update((liste) => topluUygulaSaf(liste, this.secili(), duzenleme));
    this.degisti.set(true);
    this.topluAcik.set(false);
    this.toast.success(`${this.secili().size} yük güncellendi; kaydedince yeni revizyona yazılır.`);
  }

  // ----- Elle yük -----

  private bosManuel(): ManuelForm {
    return {
      grupNo: null, kod: '', aciklama: '', yukTuruId: YukTuru.DigerOzelYuk, boyMm: null, enMm: null, yukseklikMm: null,
      brutKg: null, adet: 1, projeId: null, lokasyonId: null, ozelTasimaNotu: '',
    };
  }

  manuelEkle(): void {
    this.manuel.set(this.bosManuel());
    this.manuelAcik.set(true);
  }

  manuelDuzenle(s: PlanYukSatiri): void {
    this.manuel.set({
      grupNo: s.manuelGrupNo, kod: s.kod, aciklama: s.aciklama ?? '', yukTuruId: s.yukTuruId, boyMm: s.boyMm, enMm: s.enMm,
      yukseklikMm: s.yukseklikMm, brutKg: s.brutKg, adet: s.birimSayisi, projeId: s.projeId, lokasyonId: s.lokasyonId,
      ozelTasimaNotu: s.ozelTasimaNotu ?? '',
    });
    this.manuelAcik.set(true);
  }

  manuelAlan<K extends keyof ManuelForm>(alan: K, deger: ManuelForm[K]): void {
    this.manuel.update((m) => ({ ...m, [alan]: deger }));
  }

  sayi(deger: unknown): number | null {
    if (deger === null || deger === undefined || deger === '') return null;
    const n = Number(deger);
    return Number.isNaN(n) ? null : n;
  }

  manuelKaydet(): void {
    const m = this.manuel();
    const kod = m.kod.trim();
    if (!kod) return this.toast.error('Yük kodu giriniz.');
    if (!Number.isInteger(m.adet) || m.adet < 1 || m.adet > 500) return this.toast.error('Adet 1 ile 500 arasında olmalıdır.');
    for (const o of [m.boyMm, m.enMm, m.yukseklikMm]) {
      if (o !== null && (o <= 0 || o > ENFAZLA_OLCU_MM)) return this.toast.error('Geçerli bir ölçü giriniz.');
    }
    if (m.brutKg !== null && (m.brutKg <= 0 || m.brutKg > ENFAZLA_AGIRLIK_KG)) return this.toast.error('Geçerli bir ağırlık giriniz.');

    const proje = this.projeler().find((p) => p.projeId === m.projeId);
    const bilgi: ManuelYukBilgisi = {
      kod,
      aciklama: m.aciklama.trim() || null,
      yukTuruId: m.yukTuruId,
      yukTuruAdi: this.tanimlar()?.yukTurleri.find((t) => t.id === m.yukTuruId)?.ad ?? '',
      boyMm: m.boyMm,
      enMm: m.enMm,
      yukseklikMm: m.yukseklikMm,
      brutKg: m.brutKg,
      adet: m.adet,
      projeId: proje?.projeId ?? null,
      projeNo: proje?.projeNo ?? null,
      lokasyonId: m.lokasyonId,
      lokasyonAdi: this.tanimlar()?.lokasyonlar.find((l) => l.id === m.lokasyonId)?.ad ?? null,
      ozelTasimaNotu: m.ozelTasimaNotu.trim() || null,
    };
    this.satirlar.update((liste) => {
      if (m.grupNo === null) return [...liste, ...manuelYukSatirlari(bilgi, sonrakiGrupNo(liste))];
      const eski = liste.filter((s) => s.kaynak === PlanYukKaynagi.Manuel && s.manuelGrupNo === m.grupNo);
      const yeni = manuelYukSatirlari(bilgi, m.grupNo, eski);
      const ilk = liste.findIndex((s) => s.kaynak === PlanYukKaynagi.Manuel && s.manuelGrupNo === m.grupNo);
      const kalan = liste.filter((s) => !(s.kaynak === PlanYukKaynagi.Manuel && s.manuelGrupNo === m.grupNo));
      kalan.splice(ilk < 0 ? kalan.length : ilk, 0, ...yeni);
      return kalan;
    });
    this.degisti.set(true);
    this.manuelAcik.set(false);
  }

  async manuelSil(s: PlanYukSatiri): Promise<void> {
    const tamam = await this.onay.ask({
      title: 'Elle eklenen yükü kaldır',
      message: s.birimSayisi > 1 ? `Bu yükün ${s.birimSayisi} biriminin tamamı plandan kaldırılacak.` : 'Yük plandan kaldırılacak.',
      confirmText: 'Kaldır',
      type: 'danger',
    });
    if (!tamam) return;
    this.satirlar.update((liste) => liste.filter((x) => !(x.kaynak === PlanYukKaynagi.Manuel && x.manuelGrupNo === s.manuelGrupNo)));
    const yeni = new Set([...this.secili()].filter((a) => !a.startsWith(`m:${s.manuelGrupNo}:`)));
    this.secili.set(yeni);
    this.degisti.set(true);
  }

  // ----- Projeler -----

  projeEkle(): void {
    this.adayArama.set('');
    this.adaySayfa.set(1);
    this.projeEkleAcik.set(true);
    this.adaylariYukle();
  }

  adaylariYukle(): void {
    this.api.projeAdaylari(this.adayArama(), this.adaySayfa(), 10).pipe(takeUntilDestroyed(this.destroyRef)).subscribe((r) => {
      if (r.isSuccess && r.value) this.adaylar.set(r.value);
      else this.toast.error(r.error ?? 'Projeler yüklenemedi.');
    });
  }

  adayAramaDegisti(metin: string): void {
    this.adayArama.set(metin);
    this.adayAramaAkisi.next();
  }

  adaySayfaDegisti(sayfa: number): void {
    this.adaySayfa.set(sayfa);
    this.adaylariYukle();
  }

  plandaMi(projeId: number): boolean {
    return this.projeIdleri().includes(projeId);
  }

  adayEkle(a: PlanProjeAdayi): void {
    if (this.plandaMi(a.projeId)) return;
    this.projeler.update((l) => [...l, {
      projeId: a.projeId, projeNo: a.projeNo, musteri: a.musteri, projeTipiId: a.projeTipiId, sevkEdilmisSandikSayisi: a.sevkEdilmisSandikSayisi,
    }]);
    this.degisti.set(true);
  }

  async projeCikar(p: PlanProjeBilgisi): Promise<void> {
    if (p.projeId == null) return;
    const sandik = this.satirlar().filter((s) => s.kaynak === PlanYukKaynagi.Sandik && s.projeId === p.projeId).length;
    const tamam = await this.onay.ask({
      title: 'Projeyi plandan çıkar',
      message: `${p.projeNo} projesinin ${sandik} sandığı plandan çıkacak. Kaydedince uygulanır.`,
      confirmText: 'Çıkar',
      type: 'warning',
    });
    if (!tamam) return;
    this.projeler.update((l) => l.filter((x) => x.projeId !== p.projeId));
    this.satirlar.update((l) => l.filter((s) => !(s.kaynak === PlanYukKaynagi.Sandik && s.projeId === p.projeId)));
    this.secili.set(new Set([...this.secili()].filter((a) => this.satirlar().some((s) => satirAnahtari(s) === a))));
    this.degisti.set(true);
  }

  // ----- Kaydet ve kaynaktan güncelle -----

  kaydetAc(): void {
    if (!this.ad().trim()) return this.toast.error('Plan adı giriniz.');
    if (!this.tasimaAilesiId()) return this.toast.error('Taşıma ailesi seçiniz.');
    if (!this.projeIdleri().length) return this.toast.error('Plana en az bir proje ekleyiniz.');
    const mevcut = this.ayarlar().mevcutAraclar;
    if (new Set(mevcut.map((m) => m.konfigurasyonId)).size !== mevcut.length) return this.toast.error('Aynı ekipman mevcut araç listesinde bir kez olmalıdır.');
    if (mevcut.some((m) => !Number.isInteger(m.adet) || m.adet < 1 || m.adet > 50)) return this.toast.error('Araç adedi 1 ile 50 arasında olmalıdır.');
    this.revizyonAciklamasi.set('');
    this.kaydetAcik.set(true);
  }

  kaydet(): void {
    const p = this.plan();
    if (!p || this.kaydediliyor()) return;
    this.kaydediliyor.set(true);
    const { sandikYukleri, manuelYukler } = yukIstekleri(this.satirlar());
    this.api.kaydet(p.id, {
      beklenenRevizyonNo: p.revizyonNo,
      ad: this.ad().trim(),
      calismaBicimi: this.calismaBicimi(),
      tasimaAilesiId: this.tasimaAilesiId()!,
      projeKarisimi: this.projeKarisimi(),
      yuklemeTarihi: this.yuklemeTarihi() || null,
      aciklama: this.aciklama().trim() || null,
      revizyonAciklamasi: this.revizyonAciklamasi().trim() || null,
      ayarlar: this.ayarlar(),
      projeIdleri: this.projeIdleri(),
      sandikYukleri,
      manuelYukler,
    }).subscribe((r) => {
      this.kaydediliyor.set(false);
      if (r.isSuccess && r.value) {
        this.kaydetAcik.set(false);
        this.planiYerlestir(r.value);
        this.toast.success(`Revizyon ${r.value.revizyonNo} kaydedildi.`);
      } else {
        this.toast.error(r.statusCode === 409
          ? (r.error ?? 'Plan arada başka biri tarafından kaydedildi.') + ' Sayfayı yenileyip tekrar deneyin.'
          : r.error ?? 'Plan kaydedilemedi.');
      }
    });
  }

  async kaynaktanGuncelle(): Promise<void> {
    const p = this.plan();
    if (!p) return;
    const tamam = await this.onay.ask({
      title: 'Kaynaktan güncelle',
      message: (this.degisti() ? '<b>Kaydedilmemiş değişiklikler kaybolacak.</b><br>' : '') +
        `${p.kaynakFarklari.length} fark yeni revizyon olarak plana alınacak. Elle değiştirdiğiniz izinler korunur.`,
      confirmText: 'Güncelle',
      type: this.degisti() ? 'warning' : 'info',
    });
    if (!tamam) return;
    this.kaydediliyor.set(true);
    this.api.kaynaktanGuncelle(p.id, p.revizyonNo).subscribe((r) => {
      this.kaydediliyor.set(false);
      if (r.isSuccess && r.value) {
        this.planiYerlestir(r.value);
        this.toast.success(`Kaynak farkları alındı; revizyon ${r.value.revizyonNo}.`);
      } else {
        this.toast.error(r.error ?? 'Plan güncellenemedi.');
      }
    });
  }

  async vazgec(): Promise<void> {
    const p = this.plan();
    if (!p || !this.degisti()) return;
    const tamam = await this.onay.ask({
      title: 'Değişikliklerden vazgeç',
      message: 'Kaydedilmemiş değişiklikler silinip son revizyon yeniden yüklenecek.',
      confirmText: 'Vazgeç',
      type: 'warning',
    });
    if (tamam) this.planiYerlestir(p);
  }
}
