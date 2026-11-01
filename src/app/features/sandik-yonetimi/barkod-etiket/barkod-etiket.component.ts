import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, WritableSignal, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpParams } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, firstValueFrom, switchMap } from 'rxjs';
import { BreadcrumbComponent } from '../../../shared/components/breadcrumb/breadcrumb.component';
import { ServerPagerComponent } from '../../../shared/components/server-pager/server-pager.component';
import { IslemlerMenusuComponent } from '../../../shared/components/islemler-menusu/islemler-menusu.component';
import { BaseApiService } from '../../../core/services/base-api.service';
import { ToastService } from '../../../core/services/toast.service';
import { PdfYazdirService } from '../../../core/services/pdf-yazdir.service';
import { QzTrayCalismiyorHatasi, QzTrayService } from '../../../core/services/qz-tray.service';
import { API } from '../../../core/constants/api-endpoints';
import { projeTipiBaglami } from '../../../core/constants/proje-tipi';
import { dosyaAdiBasliktan, dosyayiKaydet } from '../../../core/services/dosya-kaydet';
import {
  ApiResult,
  BarkodEtiketBicimi,
  BarkodEtiketProjesi,
  BarkodEtiketSandikSatiri,
  BarkodEtiketUrunKaynagi,
  BarkodEtiketUrunSatiri,
  PaginatedList,
} from '../../../shared/models/index';

/** Sunucudaki BarkodEtiketKurali sınırlarıyla aynı. */
export const ETIKET_SINIRLARI = { adet: 100, toplam: 1000, remarks: 60, arama: 100 } as const;
/** "Tümünü seç" sayfaları sunucunun en büyük sayfa boyutuyla çeker (SayfaKurali: en fazla 100). */
const TUMUNU_SEC_SAYFA_BOYUTU = 100;

type Sekme = 'sandik' | 'urun';
interface SandikSecimi { satir: BarkodEtiketSandikSatiri; adet: number; }
interface UrunSecimi { satir: BarkodEtiketUrunSatiri; adet: number; remarks: string; }

/** Ürün seçiminin anahtarı: aynı kimlik farklı kaynakta başka üründür. */
export const urunAnahtari = (satir: Pick<BarkodEtiketUrunSatiri, 'kaynak' | 'id'>) => `${satir.kaynak}-${satir.id}`;

/** Bu ay "YYYY-AA" (ay seçici biçimi). */
export function buAy(bugun = new Date()): string {
  return `${bugun.getFullYear()}-${String(bugun.getMonth() + 1).padStart(2, '0')}`;
}

/** QZ Tray yazıcı seçiminin tarayıcıdaki anahtarı ({ sandik, urun }). */
export const QZ_YAZICI_ANAHTARI = 'barkodEtiket.qzYazici';

function qzYazicilariOku(): Partial<Record<'sandik' | 'urun', string>> {
  try {
    const deger = JSON.parse(localStorage.getItem(QZ_YAZICI_ANAHTARI) ?? '{}');
    return deger && typeof deger === 'object' ? deger : {};
  } catch {
    return {};
  }
}

/** Adet kutusundaki değer 1–100 arasına çekilir; sayı değilse 1. */
export function adetDuzelt(deger: unknown): number {
  const sayi = Math.trunc(Number(deger));
  return Number.isFinite(sayi) ? Math.min(Math.max(sayi, 1), ETIKET_SINIRLARI.adet) : 1;
}

/**
 * Barkod etiketi (barkod-etiket R): bir projenin seçilen sandıkları (100×75 mm) ve ürünleri (60×40 mm) için Grid
 * etiketi. Listeler sunucuda sayfalıdır; seçim ve adetler sayfa değişince korunur. Yazdır, PDF'i indirmeden
 * yazdırma penceresinde açar (Godex Windows sürücüsü, etiket boyunda kâğıt); İndir, PDF veya EZPL (.prn, yazıcıya ham)
 * dosyası verir. Kenar menüde yoktur; Projeler ve 3K sandık listesinin
 * "Diğer" menüsünden açılır. Proje ve sekme adres çubuğundadır (?projeId=, ?tur=urun).
 */
@Component({
  selector: 'app-barkod-etiket',
  standalone: true,
  imports: [DecimalPipe, BreadcrumbComponent, ServerPagerComponent, IslemlerMenusuComponent],
  templateUrl: './barkod-etiket.component.html',
  styleUrl: './barkod-etiket.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BarkodEtiketComponent implements OnInit {
  private readonly api = inject(BaseApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly yazici = inject(PdfYazdirService);
  private readonly qz = inject(QzTrayService);
  private readonly destroyRef = inject(DestroyRef);

  readonly SINIR = ETIKET_SINIRLARI;
  readonly Bicim = BarkodEtiketBicimi;
  readonly SAYFA_BOYUTLARI = [25, 50, 100] as const;
  readonly breadcrumb = [
    { label: 'Ana Kontrol Paneli', link: '/dashboard' },
    { label: 'Barkod Etiketi' },
  ];

  // --- Proje seçimi ---
  readonly proje = signal<BarkodEtiketProjesi | null>(null);
  readonly projeArama = signal('');
  readonly projeler = signal<PaginatedList<BarkodEtiketProjesi> | null>(null);
  readonly projeYukleniyor = signal(false);
  readonly projeBoyut = signal(25);
  private readonly projeIstegi$ = new Subject<number>();
  private readonly projeAramaDegisti$ = new Subject<void>();

  // --- Sekmeler ve listeler ---
  readonly sekme = signal<Sekme>('sandik');
  readonly sandikArama = signal('');
  readonly sandikBoyut = signal(25);
  readonly sandiklar = signal<PaginatedList<BarkodEtiketSandikSatiri> | null>(null);
  readonly urunArama = signal('');
  readonly urunSandikId = signal<number | null>(null);
  readonly urunBoyut = signal(25);
  readonly urunler = signal<PaginatedList<BarkodEtiketUrunSatiri> | null>(null);
  /** Ürün sekmesindeki sandık süzgecinin seçenekleri (projenin ilk 100 sandığı). */
  readonly sandikSecenekleri = signal<BarkodEtiketSandikSatiri[]>([]);
  /** Projenin bütün sandık sayısı; 100'ü aşarsa süzgeçte yalnız ilk 100 sandık olduğu yazılır. */
  readonly sandikToplami = signal(0);
  readonly listeYukleniyor = signal(false);
  readonly hata = signal('');
  private readonly sandikIstegi$ = new Subject<number>();
  private readonly urunIstegi$ = new Subject<number>();
  private readonly aramaDegisti$ = new Subject<void>();

  // --- Seçim ve çıktı ---
  readonly sandikSecimleri = signal(new Map<number, SandikSecimi>());
  readonly urunSecimleri = signal(new Map<string, UrunSecimi>());
  /** Sandık etiketindeki tarih (AA/YY basılır); varsayılan bu ay. */
  readonly tarih = signal(buAy());
  /** Süren çıktı isteği: yazdırma (PDF penceresi), indirme ya da QZ Tray ile yazıcıya gönderme (EZPL). */
  readonly olusturuluyor = signal<'yazdir' | 'indir' | 'gonder' | null>(null);
  /** QZ Tray'in gördüğü yazıcılar; boşsa liste henüz alınmamıştır. */
  readonly qzYazicilari = signal<string[]>([]);
  readonly qzYukleniyor = signal(false);
  /** QZ Tray bu sayfada henüz yoklanmadı / çalışıyor / bulunamadı. */
  readonly qzDurum = signal<'bilinmiyor' | 'var' | 'yok'>('bilinmiyor');
  /** Sekme başına seçili QZ Tray yazıcısı; "" yazdırma penceresi (PDF) demektir (bu tarayıcıda hatırlanır). */
  private readonly qzYazicilariSekme = signal<Partial<Record<Sekme, string>>>(qzYazicilariOku());
  readonly qzYazici = computed(() => this.qzYazicilariSekme()[this.sekme()] ?? '');

  readonly secimSayisi = computed(() => this.sekme() === 'sandik' ? this.sandikSecimleri().size : this.urunSecimleri().size);
  readonly etiketSayisi = computed(() => {
    const secimler = this.sekme() === 'sandik' ? [...this.sandikSecimleri().values()] : [...this.urunSecimleri().values()];
    return secimler.reduce((toplam, s) => toplam + s.adet, 0);
  });
  readonly tarihGecerli = computed(() => /^20\d{2}-(0[1-9]|1[0-2])$/.test(this.tarih()));
  readonly olusturulabilir = computed(() =>
    !!this.proje() && this.olusturuluyor() === null && this.secimSayisi() > 0
    && this.etiketSayisi() <= ETIKET_SINIRLARI.toplam && (this.sekme() === 'urun' || this.tarihGecerli()));

  ngOnInit(): void {
    this.projeIstegi$
      .pipe(
        switchMap(sayfa => {
          this.projeYukleniyor.set(true);
          let params = new HttpParams().set('sayfa', String(sayfa)).set('boyut', String(this.projeBoyut()));
          const arama = this.projeArama().trim();
          if (arama) params = params.set('arama', arama);
          return this.api.get<PaginatedList<BarkodEtiketProjesi>>(API.BARKOD_ETIKET.PROJELER, { params });
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(res => {
        this.projeYukleniyor.set(false);
        if (res.isSuccess && res.value) this.projeler.set(res.value);
        else this.toast.error(res.error || 'Projeler yüklenemedi.');
      });
    this.projeAramaDegisti$.pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef)).subscribe(() => this.projeIstegi$.next(1));

    this.sandikIstegi$
      .pipe(
        switchMap(sayfa => {
          this.listeYukleniyor.set(true);
          return this.sandikSayfasi(sayfa, this.sandikBoyut());
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(res => this.listeGeldi(res, this.sandiklar));
    this.urunIstegi$
      .pipe(
        switchMap(sayfa => {
          this.listeYukleniyor.set(true);
          return this.urunSayfasi(sayfa, this.urunBoyut());
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(res => this.listeGeldi(res, this.urunler));
    this.aramaDegisti$.pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef)).subscribe(() => this.listeyiYukle(1));

    const parametreler = this.route.snapshot.queryParamMap;
    if (parametreler.get('tur') === 'urun') this.sekme.set('urun');
    const projeId = Number(parametreler.get('projeId'));
    if (Number.isInteger(projeId) && projeId > 0) this.projeyiAc(projeId);
    else this.projeIstegi$.next(1);
  }

  // --- Proje ---

  projeAramaDegisti(deger: string): void {
    this.projeArama.set(deger);
    this.projeAramaDegisti$.next();
  }

  projeSayfasi(sayfa: number): void {
    this.projeIstegi$.next(sayfa);
  }

  projeBoyutuDegisti(boyut: number): void {
    this.projeBoyut.set(boyut);
    this.projeIstegi$.next(1);
  }

  projeSec(proje: BarkodEtiketProjesi): void {
    this.proje.set(proje);
    this.projeDegisti();
  }

  /** Proje değiştirilir: seçimler başka projeye taşınmaz. */
  projeyiDegistir(): void {
    this.proje.set(null);
    this.secimiTemizle();
    this.sandiklar.set(null);
    this.urunler.set(null);
    this.adresiGuncelle();
    if (!this.projeler()) this.projeIstegi$.next(1);
  }

  projeTipiAdi(projeTipiId: number): string {
    return projeTipiBaglami(projeTipiId).ad;
  }

  private projeyiAc(projeId: number): void {
    this.projeYukleniyor.set(true);
    this.api.get<BarkodEtiketProjesi>(API.BARKOD_ETIKET.PROJE(projeId))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(res => {
        this.projeYukleniyor.set(false);
        if (res.isSuccess && res.value) {
          this.proje.set(res.value);
          this.projeDegisti();
          return;
        }
        this.toast.error(res.error || 'Proje bulunamadı.');
        this.projeIstegi$.next(1);
      });
  }

  private projeDegisti(): void {
    this.secimiTemizle();
    this.sandikArama.set('');
    this.urunArama.set('');
    this.urunSandikId.set(null);
    this.sandikSecenekleri.set([]);
    this.sandikToplami.set(0);
    this.adresiGuncelle();
    this.listeyiYukle(1);
    const params = new HttpParams().set('sayfa', '1').set('boyut', '100');
    this.api.get<PaginatedList<BarkodEtiketSandikSatiri>>(API.BARKOD_ETIKET.SANDIKLAR(this.proje()!.projeId), { params })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(res => {
        this.sandikSecenekleri.set(res.isSuccess && res.value ? res.value.items : []);
        this.sandikToplami.set(res.isSuccess && res.value ? res.value.totalCount : 0);
      });
  }

  // --- Listeler ---

  sekmeSec(sekme: Sekme): void {
    if (this.sekme() === sekme) return;
    this.sekme.set(sekme);
    this.adresiGuncelle();
    if (this.proje() && !(sekme === 'sandik' ? this.sandiklar() : this.urunler())) this.listeyiYukle(1);
  }

  aramaDegisti(deger: string): void {
    (this.sekme() === 'sandik' ? this.sandikArama : this.urunArama).set(deger);
    this.aramaDegisti$.next();
  }

  urunSandigiDegisti(deger: string): void {
    this.urunSandikId.set(deger ? Number(deger) : null);
    this.listeyiYukle(1);
  }

  sayfaDegisti(sayfa: number): void {
    this.listeyiYukle(sayfa);
  }

  boyutDegisti(boyut: number): void {
    (this.sekme() === 'sandik' ? this.sandikBoyut : this.urunBoyut).set(boyut);
    this.listeyiYukle(1);
  }

  private listeyiYukle(sayfa: number): void {
    if (!this.proje()) return;
    (this.sekme() === 'sandik' ? this.sandikIstegi$ : this.urunIstegi$).next(sayfa);
  }

  /** Sandık sekmesinin bir sayfası (arama süzgeciyle); liste ve "tümünü seç" aynı isteği kullanır. */
  private sandikSayfasi(sayfa: number, boyut: number) {
    let params = new HttpParams().set('sayfa', String(sayfa)).set('boyut', String(boyut));
    const arama = this.sandikArama().trim();
    if (arama) params = params.set('arama', arama);
    return this.api.get<PaginatedList<BarkodEtiketSandikSatiri>>(API.BARKOD_ETIKET.SANDIKLAR(this.proje()!.projeId), { params });
  }

  /** Ürün sekmesinin bir sayfası (arama ve sandık süzgeciyle). */
  private urunSayfasi(sayfa: number, boyut: number) {
    let params = new HttpParams().set('sayfa', String(sayfa)).set('boyut', String(boyut));
    const arama = this.urunArama().trim();
    if (arama) params = params.set('arama', arama);
    const sandikId = this.urunSandikId();
    if (sandikId) params = params.set('sandikId', String(sandikId));
    return this.api.get<PaginatedList<BarkodEtiketUrunSatiri>>(API.BARKOD_ETIKET.URUNLER(this.proje()!.projeId), { params });
  }

  private listeGeldi<T>(res: ApiResult<PaginatedList<T>>, hedef: WritableSignal<PaginatedList<T> | null>): void {
    this.listeYukleniyor.set(false);
    if (res.isSuccess && res.value) {
      this.hata.set('');
      hedef.set(res.value);
      return;
    }
    hedef.set(null);
    this.hata.set(res.error || 'Liste yüklenemedi.');
  }

  // --- Seçim ---

  sandikSecili(satir: BarkodEtiketSandikSatiri): boolean {
    return this.sandikSecimleri().has(satir.sandikId);
  }

  urunSecili(satir: BarkodEtiketUrunSatiri): boolean {
    return this.urunSecimleri().has(urunAnahtari(satir));
  }

  sandikSecimDegistir(satir: BarkodEtiketSandikSatiri, secili: boolean): void {
    const yeni = new Map(this.sandikSecimleri());
    if (!secili) yeni.delete(satir.sandikId);
    else if (!yeni.has(satir.sandikId)) yeni.set(satir.sandikId, { satir, adet: 1 });
    this.sandikSecimleri.set(yeni);
  }

  urunSecimDegistir(satir: BarkodEtiketUrunSatiri, secili: boolean): void {
    if (!satir.etiketBarkodu) return;
    const yeni = new Map(this.urunSecimleri());
    const anahtar = urunAnahtari(satir);
    if (!secili) yeni.delete(anahtar);
    else if (!yeni.has(anahtar)) yeni.set(anahtar, { satir, adet: 1, remarks: satir.remarks?.trim() ?? '' });
    this.urunSecimleri.set(yeni);
  }

  /** "Tümünü seç" sürerken (sayfalar sunucudan çekilirken) başlık kutusu kilitlenir. */
  readonly tumuSeciliyor = signal(false);
  /**
   * Son "tümünü seç"in kapsamı: hangi sekme/süzgeçte hangi satırları seçtiği. Bütün sayfalar seçili mi sorusu buna göre
   * cevaplanır; süzgeç değişince ya da satırlardan biri kaldırılınca kutu yeniden boş görünür.
   */
  private readonly tumSecimKapsami = signal<{ suzgec: string; anahtarlar: string[] } | null>(null);

  /** Başlık kutusu: süzgece uyan bütün sayfalardaki seçilebilir satırlar seçili mi. */
  readonly tumuSecili = computed(() => {
    const sandik = this.sekme() === 'sandik';
    const kapsam = this.tumSecimKapsami();
    const secili = (anahtar: string) =>
      sandik ? this.sandikSecimleri().has(Number(anahtar)) : this.urunSecimleri().has(anahtar);
    if (kapsam && kapsam.suzgec === this.suzgecAnahtari() && kapsam.anahtarlar.length > 0)
      return kapsam.anahtarlar.every(secili);
    // Tek sayfalık listede sayfadaki satırlar bütün kümedir.
    const liste = sandik ? this.sandiklar() : this.urunler();
    if (!liste || liste.totalPages > 1) return false;
    const anahtarlar = this.sayfaAnahtarlari();
    return anahtarlar.length > 0 && anahtarlar.every(secili);
  });

  /**
   * Başlıktaki kutu: süzgece uyan bütün sayfalardaki seçilebilir satırları seçer (sunucudan 100'erli sayfalarla çekilir).
   * Seçim sayısının sınırı yoktur; yalnız tek dosyadaki etiket toplamı (1000) aşılmaz, her yeni seçim bir etikettir.
   * Hepsi zaten seçiliyse bu süzgecin satırlarını bırakır; başka süzgeçteki seçim kalır.
   */
  async tumunuSec(): Promise<void> {
    if (!this.proje() || this.tumuSeciliyor()) return;
    const sandik = this.sekme() === 'sandik';
    const suzgec = this.suzgecAnahtari();
    if (this.tumuSecili()) {
      const kapsam = this.tumSecimKapsami();
      const anahtarlar = kapsam?.suzgec === suzgec ? kapsam.anahtarlar : this.sayfaAnahtarlari();
      this.secimdenCikar(sandik, anahtarlar);
      this.tumSecimKapsami.set(null);
      return;
    }

    this.tumuSeciliyor.set(true);
    try {
      const sandiklar: BarkodEtiketSandikSatiri[] = [];
      const urunler: BarkodEtiketUrunSatiri[] = [];
      // Bu sekmedeki etiket toplamıyla eklenebilecek yeni seçim sayısı (her biri adet 1).
      const yer = Math.max(ETIKET_SINIRLARI.toplam - this.etiketSayisi(), 0);
      let kesildi = false;
      for (let sayfa = 1; ; sayfa++) {
        const res = sandik
          ? await firstValueFrom(this.sandikSayfasi(sayfa, TUMUNU_SEC_SAYFA_BOYUTU))
          : await firstValueFrom(this.urunSayfasi(sayfa, TUMUNU_SEC_SAYFA_BOYUTU));
        if (!res.isSuccess || !res.value) {
          this.toast.error(res.error || 'Liste yüklenemedi.');
          return;
        }
        if (sandik) sandiklar.push(...(res.value.items as BarkodEtiketSandikSatiri[]));
        else urunler.push(...(res.value.items as BarkodEtiketUrunSatiri[]).filter(u => u.etiketBarkodu));
        const toplanan = sandik ? sandiklar.length : urunler.length;
        if (!res.value.hasNextPage) break;
        if (toplanan >= ETIKET_SINIRLARI.toplam) { kesildi = true; break; }
      }
      // Süzgeç beklerken değiştiyse eski süzgecin sonucu yazılmaz.
      if (this.suzgecAnahtari() !== suzgec || this.sekme() !== (sandik ? 'sandik' : 'urun')) return;

      let sigmayan = 0;
      let eklenen = 0;
      if (sandik) {
        const yeni = new Map(this.sandikSecimleri());
        for (const satir of sandiklar) {
          if (yeni.has(satir.sandikId)) continue;
          if (eklenen >= yer) { sigmayan++; continue; }
          yeni.set(satir.sandikId, { satir, adet: 1 });
          eklenen++;
        }
        this.sandikSecimleri.set(yeni);
        this.tumSecimKapsami.set({ suzgec, anahtarlar: sandiklar.filter(s => yeni.has(s.sandikId)).map(s => String(s.sandikId)) });
      } else {
        const yeni = new Map(this.urunSecimleri());
        for (const satir of urunler) {
          const anahtar = urunAnahtari(satir);
          if (yeni.has(anahtar)) continue;
          if (eklenen >= yer) { sigmayan++; continue; }
          yeni.set(anahtar, { satir, adet: 1, remarks: satir.remarks?.trim() ?? '' });
          eklenen++;
        }
        this.urunSecimleri.set(yeni);
        this.tumSecimKapsami.set({ suzgec, anahtarlar: urunler.map(urunAnahtari).filter(a => yeni.has(a)) });
      }
      if (sigmayan > 0 || kesildi) {
        this.toast.info(`Tek dosyada en fazla ${ETIKET_SINIRLARI.toplam} etiket basılabilir; sınıra kadar seçildi.`);
      }
    } finally {
      this.tumuSeciliyor.set(false);
    }
  }

  /** Sekme, proje ve süzgeçlerin anahtarı: "tümünü seç" kapsamı bununla eşlenir. */
  private suzgecAnahtari(): string {
    const projeId = this.proje()?.projeId ?? 0;
    return this.sekme() === 'sandik'
      ? `sandik|${projeId}|${this.sandikArama().trim()}`
      : `urun|${projeId}|${this.urunArama().trim()}|${this.urunSandikId() ?? ''}`;
  }

  /** Görünen sayfadaki seçilebilir satırların seçim anahtarları. */
  private sayfaAnahtarlari(): string[] {
    return this.sekme() === 'sandik'
      ? (this.sandiklar()?.items ?? []).map(s => String(s.sandikId))
      : (this.urunler()?.items ?? []).filter(u => u.etiketBarkodu).map(urunAnahtari);
  }

  private secimdenCikar(sandik: boolean, anahtarlar: string[]): void {
    if (sandik) {
      const yeni = new Map(this.sandikSecimleri());
      anahtarlar.forEach(a => yeni.delete(Number(a)));
      this.sandikSecimleri.set(yeni);
    } else {
      const yeni = new Map(this.urunSecimleri());
      anahtarlar.forEach(a => yeni.delete(a));
      this.urunSecimleri.set(yeni);
    }
  }

  sandikAdedi(satir: BarkodEtiketSandikSatiri): number {
    return this.sandikSecimleri().get(satir.sandikId)?.adet ?? 1;
  }

  urunAdedi(satir: BarkodEtiketUrunSatiri): number {
    return this.urunSecimleri().get(urunAnahtari(satir))?.adet ?? 1;
  }

  urunRemarks(satir: BarkodEtiketUrunSatiri): string {
    return this.urunSecimleri().get(urunAnahtari(satir))?.remarks ?? satir.remarks ?? '';
  }

  sandikAdediDegisti(satir: BarkodEtiketSandikSatiri, deger: unknown): void {
    const secim = this.sandikSecimleri().get(satir.sandikId);
    if (!secim) return;
    this.sandikSecimleri.set(new Map(this.sandikSecimleri()).set(satir.sandikId, { ...secim, adet: adetDuzelt(deger) }));
  }

  urunAdediDegisti(satir: BarkodEtiketUrunSatiri, deger: unknown): void {
    const anahtar = urunAnahtari(satir);
    const secim = this.urunSecimleri().get(anahtar);
    if (!secim) return;
    this.urunSecimleri.set(new Map(this.urunSecimleri()).set(anahtar, { ...secim, adet: adetDuzelt(deger) }));
  }

  /**
   * "= miktar" düğmesinin miktarı: sandıkla süzülmüşse o sandıktaki tahsis, değilse istenen adet (bölünmüş satırda
   * bütün sandıklar için etiket basılmasın diye).
   */
  etiketMiktari(satir: BarkodEtiketUrunSatiri): number {
    return satir.sandiktakiMiktar ?? satir.miktar;
  }

  /** Ürünün miktarı kadar etiket (tam sayıya yuvarlanır, 1–100). */
  adediMiktarYap(satir: BarkodEtiketUrunSatiri): void {
    this.urunAdediDegisti(satir, Math.ceil(this.etiketMiktari(satir)));
  }

  urunRemarksDegisti(satir: BarkodEtiketUrunSatiri, deger: string): void {
    const anahtar = urunAnahtari(satir);
    const secim = this.urunSecimleri().get(anahtar);
    if (!secim) return;
    this.urunSecimleri.set(new Map(this.urunSecimleri()).set(anahtar, { ...secim, remarks: deger.slice(0, ETIKET_SINIRLARI.remarks) }));
  }

  secimiTemizle(): void {
    this.sandikSecimleri.set(new Map());
    this.urunSecimleri.set(new Map());
    this.tumSecimKapsami.set(null);
  }

  // --- Çıktı ---

  /**
   * Tek Yazdır düğmesi: QZ Tray çalışıyor ve bir yazıcı seçiliyse Godex komutu (EZPL) pencere açılmadan o yazıcıya
   * gider; QZ Tray yoksa ya da "Yazdırma penceresi (PDF)" seçiliyse PDF tarayıcının yazdırma penceresinde açılır.
   * QZ Tray sayfada ilk Yazdır'da yoklanır; bulunamazsa sessizce pencereye düşülür.
   */
  async yazdir(): Promise<void> {
    if (!this.olusturulabilir()) return;
    if (this.qzDurum() === 'bilinmiyor') await this.qzYazicilariniGetir(true);
    if (this.qzDurum() === 'var' && this.qzYazici()) this.cikti('gonder', BarkodEtiketBicimi.Ezpl);
    else this.cikti('yazdir', BarkodEtiketBicimi.Pdf);
  }

  /** İndir menüsü: PDF ya da Godex EZPL (.prn; GoLabel gibi bir araçla yazıcıya ham gönderilir) dosyası. */
  indir(bicim: BarkodEtiketBicimi): void {
    this.cikti('indir', bicim);
  }

  /**
   * QZ Tray yazıcıları: bilgisayardaki QZ Tray'in gördüğü yazıcılar listelenir. Bu sekme için hiç seçim yapılmamışsa
   * (ya da seçilen yazıcı artık yoksa) listede tek Godex varsa o seçilir, yoksa yazdırma penceresi kalır. Kullanıcının
   * bilerek seçtiği "Yazdırma penceresi (PDF)" korunur. <paramref name="sessiz"/> ise QZ Tray yokluğu uyarı vermez.
   */
  async qzYazicilariniGetir(sessiz = false): Promise<void> {
    this.qzYukleniyor.set(true);
    try {
      const yazicilar = await this.qz.yazicilar();
      this.qzYazicilari.set(yazicilar);
      this.qzDurum.set('var');
      const kayitli = this.qzYazicilariSekme()[this.sekme()];
      if (kayitli === undefined || (kayitli !== '' && !yazicilar.includes(kayitli))) {
        const godex = yazicilar.filter(y => /godex/i.test(y));
        this.qzYaziciSec(godex.length === 1 ? godex[0] : '');
      }
    } catch (hata) {
      this.qzDurum.set('yok');
      if (!sessiz) this.toast.error(hata instanceof QzTrayCalismiyorHatasi ? hata.message : 'QZ Tray yazıcıları alınamadı.');
    } finally {
      this.qzYukleniyor.set(false);
    }
  }

  /** Seçilen yazıcı sekme başına bu tarayıcıda hatırlanır (sandık ve ürün rulosu farklı yazıcıda olabilir). */
  qzYaziciSec(yazici: string): void {
    const yeni = { ...this.qzYazicilariSekme(), [this.sekme()]: yazici };
    this.qzYazicilariSekme.set(yeni);
    try {
      localStorage.setItem(QZ_YAZICI_ANAHTARI, JSON.stringify(yeni));
    } catch {
      // Tarayıcı depolaması kapalıysa seçim yalnız bu oturumda kalır.
    }
  }

  private cikti(tur: 'yazdir' | 'indir' | 'gonder', bicim: BarkodEtiketBicimi): void {
    const proje = this.proje();
    if (!proje || !this.olusturulabilir()) return;
    const sandik = this.sekme() === 'sandik';
    const [yil, ay] = this.tarih().split('-').map(Number);
    const govde = sandik
      ? { bicim, yil, ay, secimler: [...this.sandikSecimleri().values()].map(s => ({ sandikId: s.satir.sandikId, adet: s.adet })) }
      : {
          bicim,
          secimler: [...this.urunSecimleri().values()].map(s => ({
            kaynak: s.satir.kaynak, id: s.satir.id, adet: s.adet, remarks: s.remarks.trim() || null,
          })),
        };
    const url = sandik ? API.BARKOD_ETIKET.SANDIK_ETIKETLERI(proje.projeId) : API.BARKOD_ETIKET.URUN_ETIKETLERI(proje.projeId);
    const etiketSayisi = this.etiketSayisi();
    this.olusturuluyor.set(tur);
    this.api.downloadPostFileResponse(url, govde)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: async yanit => {
          if (tur === 'gonder') {
            const yazici = this.qzYazici();
            try {
              await this.qz.hamGonder(yazici, await yanit.body!.text());
              this.toast.success(`${etiketSayisi} etiket ${yazici} yazıcısına gönderildi.`);
            } catch (hata) {
              this.olusturuluyor.set(null);
              if (hata instanceof QzTrayCalismiyorHatasi) {
                // QZ Tray bu arada kapandı: kullanıcı hata görmez, yazdırma penceresi açılır.
                this.qzDurum.set('yok');
                this.toast.info('QZ Tray çalışmıyor; yazdırma penceresi açılıyor.');
                this.cikti('yazdir', BarkodEtiketBicimi.Pdf);
                return;
              }
              this.toast.error(`Etiketler yazıcıya gönderilemedi: ${hata instanceof Error ? hata.message : String(hata)}`);
              return;
            }
            this.olusturuluyor.set(null);
            return;
          }
          if (tur === 'yazdir') {
            await this.yazici.yazdir(yanit.body!);
            this.olusturuluyor.set(null);
            return;
          }
          this.olusturuluyor.set(null);
          const uzanti = bicim === BarkodEtiketBicimi.Ezpl ? 'prn' : 'pdf';
          const varsayilan = `${sandik ? 'Sandik' : 'Urun'}_Etiketleri_${proje.projeNo}.${uzanti}`;
          dosyayiKaydet(yanit.body!, dosyaAdiBasliktan(yanit.headers.get('Content-Disposition'), varsayilan));
          this.toast.success(`${etiketSayisi} etiket oluşturuldu.`);
        },
        error: async hata => {
          this.olusturuluyor.set(null);
          this.toast.error(await this.api.downloadErrorMessage(hata, 'Etiketler oluşturulamadı.'));
        },
      });
  }

  /** Proje ve sekme adres çubuğuna yazılır: yenilenince ya da bağlantı paylaşılınca aynı ekran açılır. */
  private adresiGuncelle(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      replaceUrl: true,
      queryParams: { projeId: this.proje()?.projeId ?? null, tur: this.sekme() === 'urun' ? 'urun' : null },
    });
  }
}
