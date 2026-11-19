import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ToastService } from '../../../core/services/toast.service';
import { YuklemePlanlamaService } from '../../../core/services/yukleme-planlama.service';
import { dosyaAdiBasliktan, dosyayiKaydet } from '../../../core/services/dosya-kaydet';
import { DatePipe, DecimalPipe } from '@angular/common';
import {
  EkipmanTeknikVerisi,
  PlanAraci,
  PlanYukKonumu,
  YerlesimGirisYonu,
  YerlesimKontrolSonucu,
  YuklemePlaniDetayi,
} from '../../../shared/models/index';
import { Ekipman3dComponent, Yuk3d } from '../ekipman-kitapligi/ekipman-3d.component';
import { PlanElleYerlesimComponent } from './plan-elle-yerlesim.component';
import { PlanYuklemeOynaticiComponent } from '../plan-yukleme-oynatici/plan-yukleme-oynatici.component';
import { PROJE_RENKLERI, KONTROL_SONUCU, KONTROL_TURU, girisYonuMetni, mm, sandikEtiketi } from '../ortak/yukleme-etiketleri';
import { adimGorunumu, adimSinirla, yuklemeAdimlari } from '../ortak/yukleme-adimlari';

/** Yükleme sırası tablosunun satırı: numara ("No"), ait olduğu adım ve konum. */
interface SiraSatiri {
  no: number;
  adimNo: number;
  konum: PlanYukKonumu;
}

/**
 * Otomatik yerleşim sonucu (isterler 16–19, 22, 25): araç ve tip özeti, uyarılar, yerleşemeyenler, ek ekipman ihtiyacı,
 * seçili aracın kontrolleri, yük listesi ve 3B görünümü. "Hesapla" üst ekrandadır (seçimlerle tek adımlı hesap).
 * Seçili aracın yükleme sırası 3B'de adım adım oynatılabilir (yalnız görünüm; veri değiştirmez).
 */
@Component({
  selector: 'app-plan-yerlesim',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DecimalPipe, Ekipman3dComponent, PlanElleYerlesimComponent, PlanYuklemeOynaticiComponent],
  templateUrl: './plan-yerlesim.component.html',
  styleUrls: ['../ortak/yukleme.scss', './plan-yerlesim.component.scss'],
})
export class PlanYerlesimComponent {
  private readonly api = inject(YuklemePlanlamaService);
  private readonly toast = inject(ToastService);
  readonly plan = input.required<YuklemePlaniDetayi>();
  readonly yazabilir = input(false);
  /** Seçimler son hesaptan farklı: elle düzenleme kapalıdır (son hesaplanan revizyonu düzenler), Hesapla seçimleri uygular. */
  readonly kaydedilmemis = input(false);
  /** Üst ekranda hesap sürüyor: elle düzenleme açılamaz. */
  readonly hesaplaniyor = input(false);
  /** Elle düzenleme kaydedildi: yeni revizyon (isterler 20–21). */
  readonly elleKaydedildi = output<YuklemePlaniDetayi>();
  /** Elle düzenleme açık mı; açıkken otomatik sonuç yerine düzenleyici gösterilir. */
  readonly duzenleme = signal(false);
  /** Elle düzenleme açıldı/kapandı: üst ekran bu sırada seçimleri kilitler. */
  readonly duzenlemeDegisti = output<boolean>();

  readonly KONTROL_SONUCU = KONTROL_SONUCU;
  readonly KONTROL_TURU = KONTROL_TURU;
  readonly girisYonu = girisYonuMetni;
  readonly mm = mm;

  readonly yerlesim = computed(() => this.plan().yerlesim);
  readonly seciliAracNo = signal<number | null>(null);
  readonly seciliYuk = signal<string | null>(null);
  readonly indiriliyor = signal<'talep' | 'yukleme' | null>(null);

  readonly araclar = computed(() => this.yerlesim()?.araclar ?? []);
  readonly seciliArac = computed<PlanAraci | null>(() => this.araclar().find((a) => a.aracNo === this.seciliAracNo()) ?? this.araclar()[0] ?? null);
  readonly teknikVeri = computed<EkipmanTeknikVerisi | null>(() => {
    const a = this.seciliArac();
    if (!a) return null;
    try {
      return JSON.parse(a.teknikVeriJson) as EkipmanTeknikVerisi;
    } catch {
      return null;
    }
  });

  /** Araç tipi özeti (araç talebi): ekipman başına adet; zorunlu özel ekipman ayrı satır. */
  readonly tipOzeti = computed(() => {
    const gruplar = new Map<string, { kod: string; ad: string; adet: number; aileDisi: boolean }>();
    for (const a of this.araclar()) {
      const anahtar = `${a.ekipmanKodu}|${a.zorunluOzelEkipman}`;
      const g = gruplar.get(anahtar) ?? { kod: a.ekipmanKodu, ad: a.ekipmanAdi, adet: 0, aileDisi: a.zorunluOzelEkipman };
      g.adet++;
      gruplar.set(anahtar, g);
    }
    return [...gruplar.values()];
  });

  readonly projeRenkleri = computed(() => {
    const renkler = new Map<string, string>();
    this.plan().projeler.forEach((p, i) => renkler.set(p.projeNo, PROJE_RENKLERI[i % PROJE_RENKLERI.length]));
    return renkler;
  });

  readonly yukler3d = computed<Yuk3d[]>(() => {
    const a = this.seciliArac();
    const v = this.teknikVeri();
    if (!a) return [];
    const uygunsuz = a.sonuc === YerlesimKontrolSonucu.Uygunsuz;
    const sorunlu = new Set(a.yukSorunlari.filter((s) => s.sonuc === YerlesimKontrolSonucu.Uygunsuz).map((s) => s.yukAnahtari));
    const tekProje = this.plan().projeler.length <= 1;
    return a.konumlar.map((k) => ({
      anahtar: k.yukAnahtari,
      kod: k.kod,
      etiket: sandikEtiketi(k.kod, k.projeNo, tekProje),
      xMm: k.xMm,
      yMm: k.yMm,
      zMm: k.zMm,
      boyMm: k.boyMm,
      enMm: k.enMm,
      yukseklikMm: k.yukseklikMm,
      renk: this.projeRenkleri().get(k.projeNo ?? '') ?? '#64748b',
      // Uygunsuz araçta kasa dışına taşan yük ve elle yerleşimde uygunsuz sonucu olan yük kırmızıdır; araç düzeyindeki
      // uygunsuzluk araç kartında ve kontrollerde yazılır.
      sorunlu: (uygunsuz && this.tasiyor(k, v)) || sorunlu.has(k.yukAnahtari),
    }));
  });

  readonly seciliKonum = computed<PlanYukKonumu | null>(() =>
    this.seciliArac()?.konumlar.find((k) => k.yukAnahtari === this.seciliYuk()) ?? null);

  /** Seçili aracın yükleme adımları (istif grubu tek adım). */
  readonly adimlar = computed(() => yuklemeAdimlari(this.seciliArac()?.konumlar ?? []));
  readonly siraSatirlari = computed<SiraSatiri[]>(() =>
    this.adimlar().flatMap((a) => a.yukler.map((y) => ({ no: y.no, adimNo: a.adimNo, konum: y.konum }))));

  /**
   * Adım adım görünüm açık mı; açıkken 3B'de yalnız o adıma kadar yüklenenler çizilir. Yeni revizyon gelince (hesap,
   * kayıt, elle düzenleme) kapanır: yeni yerleşim yarım yüklü görünmesin.
   */
  readonly oynatma = linkedSignal({ source: () => this.plan().revizyonNo, computation: () => false });
  /** İstenen adım; adımlar değişince (başka araç, yeni yerleşim) başa döner. */
  private readonly istenenAdim = linkedSignal({ source: this.adimlar, computation: () => 1 });
  readonly gecerliAdim = computed(() => adimSinirla(this.istenenAdim(), this.adimlar().length));
  /** Sıra tablosunun kaydırılan kabı (geçerli adım görünür tutulur). */
  private readonly siraKap = viewChild<ElementRef<HTMLElement>>('siraKap');
  readonly adimGorunumu = computed(() =>
    this.oynatma() && this.adimlar().length ? adimGorunumu(this.adimlar(), this.gecerliAdim()) : null);

  /**
   * Sıranın fiziksel olarak güvenilir olmadığı durumlar: sıra önden arkaya, sonra soldan sağa verilir; yandan yüklemede
   * taraf planlanmaz, uygunsuz elle yerleşimde üstteki yük alttakinden önce gelebilir.
   */
  readonly siraUyarisi = computed<string | null>(() => {
    const a = this.seciliArac();
    if (!a) return null;
    if (a.yukSorunlari.some((s) => s.sonuc === YerlesimKontrolSonucu.Uygunsuz)) {
      return 'Elle yerleşimde uygunsuz yük var; gösterilen sıra fiziksel olarak uygulanamayabilir. Önce yük sorunlarını giderin.';
    }
    if (a.konumlar.some((k) => k.yuklemeYontemi === YerlesimGirisYonu.Yandan)) {
      return 'Yandan yüklemede sıra önden arkaya, soldan sağa verilir; aracın hangi yanından yükleneceği planlanmaz.';
    }
    return null;
  });

  /** Seçili aracın yük sorunları kod ile (elle yerleşim). */
  readonly yukSorunlari = computed(() => {
    const a = this.seciliArac();
    return (a?.yukSorunlari ?? []).map((s) => ({ ...s, kod: a!.konumlar.find((k) => k.yukAnahtari === s.yukAnahtari)?.kod ?? s.yukAnahtari }));
  });

  constructor() {
    // Adım ilerledikçe sıra tablosu kendi içinde kayarak geçerli adımı görünür tutar; sayfa kaydırılmaz (kullanıcı
    // 3B görünümü izliyor olabilir).
    afterRenderEffect(() => {
      this.gecerliAdim();
      const kap = this.siraKap()?.nativeElement;
      const satir = this.oynatma() ? kap?.querySelector<HTMLElement>('tr.py-sira--adim') : null;
      if (!kap || !satir) return;
      const ust = satir.getBoundingClientRect().top - kap.getBoundingClientRect().top;
      if (ust < 40 || ust + satir.offsetHeight > kap.clientHeight) kap.scrollTop += ust - kap.clientHeight / 3;
    });
  }

  duzenlemeAc(acik: boolean): void {
    this.duzenleme.set(acik);
    this.duzenlemeDegisti.emit(acik);
  }

  elleKaydet(p: YuklemePlaniDetayi): void {
    this.duzenlemeAc(false);
    this.seciliAracNo.set(null);
    this.seciliYuk.set(null);
    this.elleKaydedildi.emit(p);
  }

  aracSec(a: PlanAraci): void {
    this.seciliAracNo.set(a.aracNo);
    this.seciliYuk.set(null);
  }

  /** Adım adım görünümü açar (ilk adımdan) ya da kapatır. */
  oynatmaDegistir(): void {
    this.istenenAdim.set(1);
    this.oynatma.update((o) => !o);
    this.gorunmeyenSecimiBirak();
  }

  adimaGit(adimNo: number): void {
    this.istenenAdim.set(adimNo);
    this.gorunmeyenSecimiBirak();
  }

  /** Sıra tablosunda satır: yükü seçer; adım adım görünümde o yükün adımına gider (oynatma durur). */
  satirSec(s: SiraSatiri): void {
    this.seciliYuk.set(s.konum.yukAnahtari);
    if (this.oynatma()) this.istenenAdim.set(s.adimNo);
  }

  /** Yükü anahtarıyla seçer (yük sorunları listesi); adım adım görünümde yükün yüklendiği adıma gider. */
  yukSec(anahtar: string): void {
    const satir = this.siraSatirlari().find((s) => s.konum.yukAnahtari === anahtar);
    if (satir) this.satirSec(satir);
    else this.seciliYuk.set(anahtar);
  }

  /** Adım adım görünümde henüz yüklenmemiş (çizilmeyen) yük seçili kalmaz. */
  private gorunmeyenSecimiBirak(): void {
    const gorunum = this.adimGorunumu();
    const secili = this.seciliYuk();
    if (gorunum && secili && !gorunum.gorunenler.has(secili)) this.seciliYuk.set(null);
  }

  /** PDF raporları son kaydedilen revizyonun yerleşimiyle üretilir (isterler 28–29). */
  raporIndir(tur: 'talep' | 'yukleme'): void {
    const p = this.plan();
    if (this.indiriliyor()) return;
    const istek: Observable<HttpResponse<Blob>> = tur === 'talep' ? this.api.aracTalepRaporu(p.id) : this.api.yuklemePlaniRaporu(p.id);
    const varsayilan = `${p.planNo}_R${p.revizyonNo}_${tur === 'talep' ? 'AracTalebi' : 'YuklemePlani'}.pdf`;
    this.indiriliyor.set(tur);
    istek.subscribe({
      next: (yanit) => {
        this.indiriliyor.set(null);
        dosyayiKaydet(yanit.body!, dosyaAdiBasliktan(yanit.headers.get('Content-Disposition'), varsayilan));
      },
      error: async (hata) => {
        this.indiriliyor.set(null);
        this.toast.error(await this.api.downloadErrorMessage(hata, 'Rapor indirilemedi.'));
      },
    });
  }

  kapasiteYuzde(a: PlanAraci): number | null {
    return a.kapasiteKg ? Math.round((a.toplamKg * 100) / a.kapasiteKg) : null;
  }

  private tasiyor(k: PlanYukKonumu, v: EkipmanTeknikVerisi | null): boolean {
    const g = v?.disOlcu?.genislikMm;
    const u = v?.disOlcu?.uzunlukMm;
    return (g != null && (k.yMm < 0 || k.yMm + k.enMm > g)) || (u != null && (k.xMm < 0 || k.xMm + k.boyMm > u));
  }
}
