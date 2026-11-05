import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { Subject, debounceTime, switchMap, map } from 'rxjs';
import { ToastService } from '../../../core/services/toast.service';
import { YuklemePlanlamaService } from '../../../core/services/yukleme-planlama.service';
import { PlanAraci, PlanYerlesimi, YerlesimKontrolSonucu, YuklemePlaniDetayi } from '../../../shared/models/index';
import { Ekipman3dComponent, Yuk3d } from '../ekipman-kitapligi/ekipman-3d.component';
import { KONTROL_SONUCU, KONTROL_TURU, mm } from '../ortak/yukleme-etiketleri';
import {
  ElleArac,
  ElleTaslak,
  ElleYuk,
  aracaTasi,
  aracaYerlestir,
  ayniTiptenEkle,
  bekleyeneGonder,
  bosAraciKaldir,
  disGenislik,
  disUzunluk,
  dondur,
  istek,
  istif,
  olcu,
  taslakKur,
  tasi,
  yapistir,
  yerelSorunlar,
  yuzeyler,
} from '../ortak/elle-yerlesim';

const PROJE_RENKLERI = ['#0e7490', '#7c3aed', '#ea580c', '#16a34a', '#2563eb', '#be185d', '#a16207', '#0f766e', '#4f46e5', '#65a30d'];

interface Surukleme {
  kimlik: number;
  anahtar: string;
  /** İmlecin yükün köşesine uzaklığı (mm). */
  ofsX: number;
  ofsY: number;
  /** Önizlemedeki taban konumu. */
  x: number;
  y: number;
  basX: number;
  basY: number;
}

/** Üstten çizimde bir kutu (SVG koordinatı: X sağa, sağ kenar üstte; rapordaki üstten görünümle aynı). */
interface CizimKutu {
  yuk: ElleYuk;
  no: number;
  x: number;
  y: number;
  boy: number;
  en: number;
  renk: string;
  sorunlu: boolean;
  ust: boolean;
}

/**
 * Elle yerleşim düzenleyicisi (isterler 20–22): araç başına üstten 2B çizimde sürükle-bırak (istif bütün taşınır,
 * kenara/eksene yapışır, bırakılan yük altındakine oturur), 90° döndürme, başka araca taşıma, bekleyenler listesi ve
 * "aynı tipten araç ekle". Her değişiklikten sonra sunucu kaydetmeden denetler; sorunlu yük kırmızıdır. Kaydetme yeni
 * revizyon açar; sorunlu yerleşim de kaydedilir ve raporları taslak basılır.
 */
@Component({
  selector: 'app-plan-elle-yerlesim',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, Ekipman3dComponent],
  templateUrl: './plan-elle-yerlesim.component.html',
  styleUrls: ['../ortak/yukleme.scss', './plan-yerlesim.component.scss', './plan-elle-yerlesim.component.scss'],
})
export class PlanElleYerlesimComponent implements OnInit {
  private readonly api = inject(YuklemePlanlamaService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly plan = input.required<YuklemePlaniDetayi>();
  readonly kaydedildi = output<YuklemePlaniDetayi>();
  readonly vazgec = output<void>();

  readonly KONTROL_SONUCU = KONTROL_SONUCU;
  readonly KONTROL_TURU = KONTROL_TURU;
  readonly Sonuc = YerlesimKontrolSonucu;
  readonly mm = mm;

  readonly taslak = signal<ElleTaslak>({ araclar: [], bekleyenler: [] });
  readonly seciliKimlik = signal<number | null>(null);
  readonly seciliYuk = signal<string | null>(null);
  readonly surukleme = signal<Surukleme | null>(null);
  readonly degisti = signal(false);
  readonly kaydediliyor = signal(false);
  /** Taslağın sürümü; sunucu denetimi hangi sürüme aitse ona bağlanır (eski yanıt yeni çizimi boyamaz). */
  private readonly surum = signal(0);
  /** Son denetim; <c>sonuc</c> null ise o sürüm denetlenemedi (hata bildirildi). */
  readonly denetim = signal<{ surum: number; sonuc: PlanYerlesimi | null } | null>(null);
  readonly denetleniyor = computed(() => this.denetim()?.surum !== this.surum());
  readonly denetlenemedi = computed(() => !this.denetleniyor() && this.denetim()?.sonuc == null);
  private readonly denetimIstegi = new Subject<number>();

  readonly bosluk = computed(() => this.plan().ayarlar.yerlesimBosluguMm ?? 0);
  readonly araclar = computed(() => this.taslak().araclar);
  readonly bekleyenler = computed(() => this.taslak().bekleyenler);
  readonly seciliArac = computed<ElleArac | null>(() =>
    this.araclar().find((a) => a.kimlik === this.seciliKimlik()) ?? this.araclar()[0] ?? null);
  readonly seciliYukNesnesi = computed<ElleYuk | null>(() => this.seciliArac()?.yukler.find((y) => y.anahtar === this.seciliYuk()) ?? null);

  readonly projeRenkleri = computed(() => {
    const renkler = new Map<string, string>();
    this.plan().projeler.forEach((p, i) => renkler.set(p.projeNo, PROJE_RENKLERI[i % PROJE_RENKLERI.length]));
    return renkler;
  });

  /** Güncel denetimde aracın sonucu (araç sırası = araç numarası); denetim eskiyse null. */
  readonly sonuclar = computed<Map<number, PlanAraci>>(() => {
    const d = this.denetim();
    const m = new Map<number, PlanAraci>();
    if (!d?.sonuc || d.surum !== this.surum()) return m;
    const sonuc = d.sonuc;
    this.araclar().forEach((a, i) => {
      const s = sonuc.araclar[i];
      if (s) m.set(a.kimlik, s);
    });
    return m;
  });

  readonly seciliSonuc = computed(() => {
    const a = this.seciliArac();
    return a ? this.sonuclar().get(a.kimlik) ?? null : null;
  });

  /** Sorunlu yükler: hızlı yerel kontrol (kasa dışı, kesişme) ve güncel sunucu denetimindeki uygunsuz yük sonuçları. */
  readonly sorunlular = computed(() => {
    const a = this.seciliArac();
    const s = new Set<string>(a ? yerelSorunlar(a) : []);
    for (const y of this.seciliSonuc()?.yukSorunlari ?? []) if (y.sonuc === YerlesimKontrolSonucu.Uygunsuz) s.add(y.yukAnahtari);
    return s;
  });

  readonly genelSonuc = computed(() => {
    const d = this.denetim();
    return d?.sonuc && d.surum === this.surum() ? d.sonuc.sonuc : null;
  });

  // ===== Üstten çizim =====
  readonly g = computed(() => disGenislik(this.seciliArac()?.veri ?? null));
  readonly u = computed(() => disUzunluk(this.seciliArac()?.veri ?? null));
  readonly yuzeyCizimi = computed(() => {
    const g = this.g();
    return yuzeyler(this.seciliArac()?.veri ?? null).map((s) => ({ ...s, svgY: g - s.yBas - s.genislik }));
  });
  readonly engelCizimi = computed(() => {
    const g = this.g();
    return (this.seciliArac()?.veri?.engeller ?? []).map((e) => ({ x: e.xMm, y: g - e.yMm - e.genislikMm, boy: e.uzunlukMm, en: e.genislikMm, sokulebilir: e.sokulebilir }));
  });
  readonly arkaAcik = computed(() => (this.seciliArac()?.veri?.acikliklar ?? []).some((a) => a.taraf === 'arka'));

  readonly viewBox = computed(() => {
    const a = this.seciliArac();
    const g = this.g() || 2500;
    const u = this.u() || 6000;
    let minX = 0;
    let maxX = u;
    let minY = 0;
    let maxY = g;
    for (const y of a?.yukler ?? []) {
      const o = olcu(y);
      minX = Math.min(minX, y.xMm);
      maxX = Math.max(maxX, y.xMm + o.boy);
      minY = Math.min(minY, g - y.yMm - o.en);
      maxY = Math.max(maxY, g - y.yMm);
    }
    const pay = g * 0.25;
    return { x: minX - pay, y: minY - pay * 0.6, w: maxX - minX + 2 * pay, h: maxY - minY + pay * 1.2, yazi: Math.max(120, g * 0.07) };
  });

  readonly kutular = computed<CizimKutu[]>(() => {
    const a = this.seciliArac();
    if (!a) return [];
    const g = this.g();
    const s = this.surukleme();
    const tasinan = s && s.kimlik === a.kimlik ? istif(a, s.anahtar) : [];
    const kok = tasinan[0];
    const [dx, dy] = kok && s ? [s.x - kok.xMm, s.y - kok.yMm] : [0, 0];
    const sorunlu = this.sorunlular();
    const siralar = new Map(a.yukler.map((y, i) => [y.anahtar, i + 1]));
    return [...a.yukler]
      .sort((p, q) => p.zMm + p.yukseklikMm - (q.zMm + q.yukseklikMm))
      .map((y) => {
        const o = olcu(y);
        const kayma = tasinan.includes(y);
        const x = y.xMm + (kayma ? dx : 0);
        const yy = y.yMm + (kayma ? dy : 0);
        return {
          yuk: y, no: siralar.get(y.anahtar)!, x, y: g - yy - o.en, boy: o.boy, en: o.en,
          renk: this.projeRenkleri().get(y.projeNo ?? '') ?? '#64748b', sorunlu: sorunlu.has(y.anahtar), ust: y.zMm > this.tabanZ(a, y),
        };
      });
  });

  readonly yukler3d = computed<Yuk3d[]>(() => {
    const a = this.seciliArac();
    const sorunlu = this.sorunlular();
    return (a?.yukler ?? []).map((y) => {
      const o = olcu(y);
      return {
        anahtar: y.anahtar, kod: y.kod, xMm: y.xMm, yMm: y.yMm, zMm: y.zMm, boyMm: o.boy, enMm: o.en, yukseklikMm: y.yukseklikMm,
        renk: this.projeRenkleri().get(y.projeNo ?? '') ?? '#64748b', sorunlu: sorunlu.has(y.anahtar),
      };
    });
  });

  readonly seciliYukSorunlari = computed(() => {
    const k = this.seciliYuk();
    return (this.seciliSonuc()?.yukSorunlari ?? []).filter((s) => s.yukAnahtari === k);
  });

  ngOnInit(): void {
    const p = this.plan();
    this.taslak.set(taslakKur(p));
    // Başlangıçta kaydedilmiş yerleşimin kendi sonucu gösterilir; ilk değişiklikte sunucu yeniden denetler.
    if (p.yerlesim) this.denetim.set({ surum: 0, sonuc: p.yerlesim });
    this.denetimIstegi
      .pipe(
        debounceTime(350),
        switchMap((surum) => this.api.elleDenetle(p.id, istek(this.taslak())).pipe(map((r) => ({ surum, r })))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ surum, r }) => {
        if (surum !== this.surum()) return;
        if (r.isSuccess && r.value) this.denetim.set({ surum, sonuc: r.value });
        else {
          this.denetim.set({ surum, sonuc: null });
          this.toast.error(r.error ?? 'Yerleşim denetlenemedi.');
        }
      });
  }

  private tabanZ(a: ElleArac, y: ElleYuk): number {
    const s = yuzeyler(a.veri).find((s) => y.xMm + olcu(y).boy / 2 >= s.xBas && y.xMm + olcu(y).boy / 2 <= s.xBas + s.uzunluk);
    return s?.z ?? 0;
  }

  private uygula(sonuc: ElleTaslak | string): void {
    if (typeof sonuc === 'string') {
      this.toast.warning(sonuc);
      return;
    }
    if (sonuc === this.taslak()) return;
    this.taslak.set(sonuc);
    this.degisti.set(true);
    this.surum.update((s) => s + 1);
    this.denetimIstegi.next(this.surum());
  }

  aracSec(a: ElleArac): void {
    this.seciliKimlik.set(a.kimlik);
    this.seciliYuk.set(null);
  }

  aracNo(a: ElleArac): number {
    return this.araclar().indexOf(a) + 1;
  }

  aracSonucu(a: ElleArac): PlanAraci | null {
    return this.sonuclar().get(a.kimlik) ?? null;
  }

  yukKodu(a: ElleArac, anahtar: string): string {
    return a.yukler.find((y) => y.anahtar === anahtar)?.kod ?? anahtar;
  }

  renk(y: ElleYuk): string {
    return this.projeRenkleri().get(y.projeNo ?? '') ?? '#64748b';
  }

  // ===== Sürükle-bırak =====
  private svgNoktasi(e: PointerEvent): { x: number; y: number } | null {
    const svg = (e.currentTarget as Element).closest('svg') as SVGSVGElement | null;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return { x: p.x, y: this.g() - p.y };
  }

  suruklemeBasla(e: PointerEvent, k: CizimKutu): void {
    const a = this.seciliArac();
    const n = this.svgNoktasi(e);
    if (!a || !n || e.button !== 0) return;
    e.preventDefault();
    // preventDefault odağı engeller; klavye kısayolları için çizim odaklanır.
    ((e.currentTarget as Element).closest('svg') as SVGSVGElement | null)?.focus();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    // Üstteki yük tutulursa yalnız o (ve üstündekiler) taşınır; alttaki tutulursa bütün istif.
    this.seciliYuk.set(k.yuk.anahtar);
    this.surukleme.set({ kimlik: a.kimlik, anahtar: k.yuk.anahtar, ofsX: n.x - k.yuk.xMm, ofsY: n.y - k.yuk.yMm, x: k.yuk.xMm, y: k.yuk.yMm, basX: k.yuk.xMm, basY: k.yuk.yMm });
  }

  suruklemeDevam(e: PointerEvent): void {
    const s = this.surukleme();
    const n = s ? this.svgNoktasi(e) : null;
    if (!s || !n) return;
    this.surukleme.set({ ...s, x: Math.round(n.x - s.ofsX), y: Math.round(n.y - s.ofsY) });
  }

  suruklemeBitir(): void {
    const s = this.surukleme();
    this.surukleme.set(null);
    const a = this.seciliArac();
    if (!s || !a) return;
    if (Math.abs(s.x - s.basX) < 15 && Math.abs(s.y - s.basY) < 15) return; // tıklama: yalnız seçim
    this.konumla(a, s.anahtar, s.x, s.y);
  }

  private konumla(a: ElleArac, anahtar: string, x: number, y: number): void {
    const grup = istif(a, anahtar);
    if (grup.length === 0) return;
    const o = olcu(grup[0]);
    const yer = yapistir(a, x, y, o.boy, o.en, this.bosluk(), new Set(grup.map((g) => g.anahtar)));
    this.uygula(tasi(this.taslak(), a.kimlik, anahtar, yer.x, yer.y));
  }

  /** Klavye: oklar 10 mm (Shift ile 100 mm) kaydırır, R döndürür, Delete bekleyenlere gönderir. */
  tus(e: KeyboardEvent): void {
    const a = this.seciliArac();
    const y = this.seciliYukNesnesi();
    if (!a || !y) return;
    const adim = e.shiftKey ? 100 : 10;
    const kayma: Record<string, [number, number]> = { ArrowLeft: [-adim, 0], ArrowRight: [adim, 0], ArrowUp: [0, adim], ArrowDown: [0, -adim] };
    if (kayma[e.key]) {
      e.preventDefault();
      const [dx, dy] = kayma[e.key];
      this.uygula(tasi(this.taslak(), a.kimlik, y.anahtar, y.xMm + dx, y.yMm + dy));
    } else if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      this.dondur();
    } else if (e.key === 'Delete') {
      e.preventDefault();
      this.bekleyeneGonder();
    }
  }

  // ===== İşlemler =====
  dondur(): void {
    const a = this.seciliArac();
    const y = this.seciliYuk();
    if (a && y) this.uygula(dondur(this.taslak(), a.kimlik, y));
  }

  bekleyeneGonder(): void {
    const a = this.seciliArac();
    const y = this.seciliYuk();
    if (!a || !y) return;
    this.uygula(bekleyeneGonder(this.taslak(), a.kimlik, y));
    if (!this.seciliArac()?.yukler.some((d) => d.anahtar === y)) this.seciliYuk.set(null);
  }

  aracaTasi(hedef: string): void {
    const a = this.seciliArac();
    const y = this.seciliYuk();
    const hedefKimlik = Number(hedef);
    if (!a || !y || !hedefKimlik) return;
    this.uygula(aracaTasi(this.taslak(), a.kimlik, y, hedefKimlik, this.bosluk()));
    this.seciliKimlik.set(hedefKimlik);
  }

  aracaYerlestir(y: ElleYuk): void {
    const a = this.seciliArac();
    if (!a) return;
    this.uygula(aracaYerlestir(this.taslak(), y.anahtar, a.kimlik, this.bosluk()));
    this.seciliYuk.set(y.anahtar);
  }

  ayniTiptenEkle(): void {
    const a = this.seciliArac();
    if (!a) return;
    const once = new Set(this.araclar().map((x) => x.kimlik));
    this.uygula(ayniTiptenEkle(this.taslak(), a.kimlik));
    const yeni = this.araclar().find((x) => !once.has(x.kimlik));
    if (yeni) this.aracSec(yeni);
  }

  bosAraciKaldir(): void {
    const a = this.seciliArac();
    if (!a || a.yukler.length > 0) return;
    this.uygula(bosAraciKaldir(this.taslak(), a.kimlik));
    this.seciliKimlik.set(null);
  }

  kaydet(): void {
    const p = this.plan();
    if (this.kaydediliyor()) return;
    this.kaydediliyor.set(true);
    this.api.elleKaydet(p.id, p.revizyonNo, istek(this.taslak())).subscribe((r) => {
      this.kaydediliyor.set(false);
      if (r.isSuccess && r.value) this.kaydedildi.emit(r.value);
      else this.toast.error(r.error ?? 'Elle yerleşim kaydedilemedi.');
    });
  }
}
