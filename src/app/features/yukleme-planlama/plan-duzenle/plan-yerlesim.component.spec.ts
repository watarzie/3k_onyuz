import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import {
  PlanAraci,
  PlanYukKonumu,
  YerlesimGirisYonu,
  YerlesimKontrolSonucu,
  YuklemeCalismaBicimi,
  YuklemeLokasyonTercihi,
  YuklemePlaniDetayi,
  YuklemeProjeKarisimi,
} from '../../../shared/models/yukleme-planlama.model';
import { Ekipman3dComponent, Yuk3d } from '../ekipman-kitapligi/ekipman-3d.component';
import { PlanYerlesimComponent } from './plan-yerlesim.component';

/** 3B sahnenin (WebGL) yerine geçen sahte bileşen: şablonun verdiği girdileri okumak için. */
@Component({ selector: 'app-ekipman-3d', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush, template: '' })
class Sahte3dComponent {
  readonly veri = input<unknown>(null);
  readonly yukler = input<Yuk3d[]>([]);
  readonly secili = input<string | null>(null);
  readonly gorunenler = input<ReadonlySet<string> | null>(null);
  readonly vurgulular = input<ReadonlySet<string> | null>(null);
  readonly yukSecildi = output<string | null>();
}

function konum(anahtar: string, projeNo: string, yMm = 100, enMm = 1000): PlanYukKonumu {
  return {
    yukAnahtari: anahtar, kod: anahtar, projeNo, brutKg: 500, xMm: 30, yMm, zMm: 0, boyMm: 1000, enMm, yukseklikMm: 1000,
    donduruldu: false, yuzeyKodu: 'ANA', istifNo: 1, kat: 1, yuklemeSirasi: 1, yuklemeYontemi: YerlesimGirisYonu.Arkadan,
  };
}

function arac(no: number, kod: string, konumlar: PlanYukKonumu[], sonuc = YerlesimKontrolSonucu.TeyitEdilmedi, aileDisi = false): PlanAraci {
  return {
    aracNo: no, konfigurasyonId: no, revizyonNo: 1, ekipmanKodu: kod, ekipmanAdi: kod, aileAdi: 'Konteyner', tipAdi: 'Tip', aileDisi,
    zorunluOzelEkipman: aileDisi,
    aileDisiGerekce: aileDisi ? 'Zorunlu özel ekipman' : null, projeNolari: ['P1'], lokasyonlar: ['3K'], konumlar, toplamKg: 1000,
    kapasiteKg: 2000, tabanDolulukYuzde: 10, agirlikMerkeziXMm: 500, yukluYukseklikMm: 2591, yukluGenislikMm: 2438, yukluUzunlukMm: 12192,
    solTasmaMm: 0, sagTasmaMm: 0, onTasmaMm: 0, arkaTasmaMm: 0, kontroller: [], sonuc, yukSorunlari: [],
    teknikVeriJson: '{"disOlcu":{"uzunlukMm":12192,"genislikMm":2438,"yukseklikMm":2591}}',
  };
}

function plan(araclar: PlanAraci[], farkliLokasyon = 1): YuklemePlaniDetayi {
  return {
    id: 1, planNo: 'YP-2026-000001', ad: 'P', calismaBicimi: YuklemeCalismaBicimi.IhtiyacaGoreArac, tasimaAilesiId: 1, tasimaAilesiAdi: 'Konteyner',
    projeKarisimi: YuklemeProjeKarisimi.Karisik, lokasyonTercihi: YuklemeLokasyonTercihi.HenuzSecilmedi, yuklemeTarihi: null, aciklama: null,
    revizyonNo: 2, revizyonTarihi: '2026-11-05T10:00:00', kaydeden: null, revizyonAciklamasi: null,
    ayarlar: { yerlesimBosluguMm: 30, yukseklikPayiMm: null, genislikPayiMm: null, uzunlukPayiMm: null, agirlikPayiKg: null, yuklemeHareketiPayiMm: null, mevcutAraclar: [], tipIdleri: [] },
    projeler: [
      { projeId: 1, projeNo: 'P1', musteri: null, projeTipiId: 1 },
      { projeId: 2, projeNo: 'P2', musteri: null, projeTipiId: 1 },
    ],
    yukler: [], sayaclar: { toplam: 0, secilen: 0, hesaplanabilir: 0, veriEksik: 0, haricTutulan: 0, yerlesen: 0, yerlesemeyen: 0 },
    kaynakFarklari: [], farkliLokasyonSayisi: farkliLokasyon, surenYukleme: null,
    yerlesim: { hesapTarihi: '2026-11-05T10:00:00', sonuc: YerlesimKontrolSonucu.TeyitEdilmedi, elleDuzenlendi: false, lokasyonaGoreAyri: false, projeBazindaAyri: false,
      araclar, yerlesemeyenler: [], ekIhtiyaclar: [], uyarilar: [] },
  };
}

describe('PlanYerlesimComponent', () => {
  function kur(p: YuklemePlaniDetayi) {
    TestBed.configureTestingModule({ imports: [PlanYerlesimComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
    const fixture = TestBed.createComponent(PlanYerlesimComponent);
    fixture.componentRef.setInput('plan', p);
    return fixture.componentInstance;
  }

  it('araç tiplerini adetle özetler; zorunlu özel ekipman ayrı satırdır', () => {
    const c = kur(plan([arac(1, 'K40', []), arac(2, 'K40', []), arac(3, 'LB-3', [], YerlesimKontrolSonucu.TeyitEdilmedi, true)]));
    expect(c.tipOzeti().map((t) => [t.kod, t.adet, t.aileDisi])).toEqual([['K40', 2, false], ['LB-3', 1, true]]);
  });

  it('yükleri proje rengiyle çizer; uygunsuz araçta yalnız taşan yük kırmızıdır', () => {
    const c = kur(plan([arac(1, 'LB-3', [konum('s:1', 'P1'), konum('s:2', 'P2', -500, 3500)], YerlesimKontrolSonucu.Uygunsuz)]));
    const [a, b] = c.yukler3d();
    expect(a.renk).not.toEqual(b.renk);
    expect([a.sorunlu, b.sorunlu]).toEqual([false, true]);
  });

  it('3B kutu etiketi: çok projede tam kod, tek projede yalnız sandık no (madde 8)', () => {
    const cok = kur(plan([arac(1, 'K40', [{ ...konum('s:1', 'P1'), kod: 'P1-12' }, { ...konum('s:2', 'P2'), kod: 'P2-3' }])]));
    expect(cok.yukler3d().map((y) => y.etiket)).toEqual(['P1-12', 'P2-3']);

    TestBed.resetTestingModule();
    const p = plan([arac(1, 'K40', [{ ...konum('s:1', 'P1'), kod: 'P1-12' }, { ...konum('s:2', 'P1'), kod: 'TRAFO' }])]);
    p.projeler = [p.projeler[0]];
    const tek = kur(p);
    expect(tek.yukler3d().map((y) => y.etiket)).toEqual(['12', 'TRAFO']);
  });

  it('elle yerleşimde uygunsuz yük sonucu olan yük kırmızıdır ve kodla listelenir', () => {
    const a = arac(1, 'K40', [konum('s:1', 'P1'), konum('s:2', 'P1', 1200)]);
    a.yukSorunlari = [
      { yukAnahtari: 's:2', sonuc: YerlesimKontrolSonucu.Uygunsuz, mesaj: 'Çakışma: s:1' },
      { yukAnahtari: 's:1', sonuc: YerlesimKontrolSonucu.TeyitEdilmedi, mesaj: 'Kasa sınırı teyit edilmedi' },
    ];
    const c = kur(plan([a]));
    expect(c.yukler3d().map((y) => y.sorunlu)).toEqual([false, true]);
    expect(c.yukSorunlari().map((s) => s.kod)).toEqual(['s:2', 's:1']);
  });

  it('Hesapla seçimler değişse de çalışır (üst ekran seçimlerle hesaplar); lokasyon tercihi sorulmaz', () => {
    TestBed.configureTestingModule({ imports: [PlanYerlesimComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
    const fixture = TestBed.createComponent(PlanYerlesimComponent);
    fixture.componentRef.setInput('plan', plan([arac(1, 'K40', [konum('s:1', 'P1')])], 2));
    fixture.componentRef.setInput('yazabilir', true);
    fixture.componentRef.setInput('kaydedilmemis', true);
    fixture.detectChanges();
    let istek = 0;
    fixture.componentInstance.hesapla.subscribe(() => istek++);
    const kok = fixture.nativeElement as HTMLElement;
    const dugmeler = [...kok.querySelectorAll<HTMLButtonElement>('.py-baslik button')];
    const hesapla = dugmeler.find((b) => b.textContent?.includes('hesapla'))!;
    expect(hesapla.disabled).toBeFalse();
    hesapla.click();
    expect(istek).toBe(1);
    // Elle düzenleme son hesaplanan revizyonu düzenler: seçimler değişmişken kapalıdır.
    expect(dugmeler.find((b) => b.textContent?.includes('Elle'))!.disabled).toBeTrue();
    expect(kok.textContent).toContain('Seçimler değişti');
    expect(kok.textContent).not.toContain('Bu tercihle hesapla');
  });

  it('adım adım görünüm: kapalıyken bütün yükler, açıkken o adıma kadar yüklenenler çizilir; araç değişince başa döner', () => {
    const k = (anahtar: string, sira: number, kat = 1) => ({ ...konum(anahtar, 'P1'), istifNo: sira, yuklemeSirasi: sira, kat });
    const c = kur(plan([arac(1, 'K40', [k('s:3', 2), k('s:1', 1), k('s:2', 1, 2)]), arac(2, 'K40', [k('s:9', 1)])]));
    expect(c.adimGorunumu()).toBeNull();
    expect(c.siraSatirlari().map((s) => [s.no, s.adimNo, s.konum.yukAnahtari])).toEqual([[1, 1, 's:1'], [2, 1, 's:2'], [3, 2, 's:3']]);

    c.oynatmaDegistir();
    expect([...c.adimGorunumu()!.gorunenler]).toEqual(['s:1', 's:2']);
    expect([...c.adimGorunumu()!.vurgulular]).toEqual(['s:1', 's:2']);
    c.adimaGit(2);
    expect([...c.adimGorunumu()!.gorunenler]).toEqual(['s:1', 's:2', 's:3']);
    expect([...c.adimGorunumu()!.vurgulular]).toEqual(['s:3']);
    // Tablodan satır seçmek o yükün adımına götürür.
    c.satirSec(c.siraSatirlari()[0]);
    expect([c.gecerliAdim(), c.seciliYuk()]).toEqual([1, 's:1']);

    c.adimaGit(2);
    c.aracSec(c.araclar()[1]);
    expect(c.gecerliAdim()).toBe(1);
    c.oynatmaDegistir();
    expect(c.adimGorunumu()).toBeNull();
  });

  it('görünmeyen yük seçili kalmaz; yeni revizyon gelince adım adım görünüm kapanır ve başa döner', () => {
    const k = (anahtar: string, sira: number) => ({ ...konum(anahtar, 'P1'), istifNo: sira, yuklemeSirasi: sira });
    const yeniPlan = () => plan([arac(1, 'K40', [k('s:1', 1), k('s:2', 2), k('s:3', 3)])]);
    const p = yeniPlan();
    TestBed.configureTestingModule({ imports: [PlanYerlesimComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
    const fixture = TestBed.createComponent(PlanYerlesimComponent);
    fixture.componentRef.setInput('plan', p);
    const c = fixture.componentInstance;

    c.seciliYuk.set('s:3');
    c.oynatmaDegistir();
    expect(c.seciliYuk()).toBeNull();
    c.adimaGit(3);
    c.yukSec('s:2');
    expect([c.gecerliAdim(), c.seciliYuk()]).toEqual([2, 's:2']);
    c.adimaGit(1);
    expect(c.seciliYuk()).toBeNull();

    c.adimaGit(3);
    // Sunucudan gelen yeni revizyon yeni nesnelerdir.
    fixture.componentRef.setInput('plan', { ...yeniPlan(), revizyonNo: p.revizyonNo + 1 });
    expect([c.oynatma(), c.gecerliAdim(), c.adimGorunumu()]).toEqual([false, 1, null]);
  });

  it('şablon: 3B sahneye adımın görünen ve vurgulu yüklerini verir, sıra tablosunda adımı işaretler', () => {
    const k = (anahtar: string, sira: number) => ({ ...konum(anahtar, 'P1'), istifNo: sira, yuklemeSirasi: sira });
    TestBed.configureTestingModule({ imports: [PlanYerlesimComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
    TestBed.overrideComponent(PlanYerlesimComponent, { remove: { imports: [Ekipman3dComponent] }, add: { imports: [Sahte3dComponent] } });
    const fixture = TestBed.createComponent(PlanYerlesimComponent);
    fixture.componentRef.setInput('plan', plan([arac(1, 'K40', [k('s:1', 1), k('s:2', 2), k('s:3', 3)])]));
    fixture.detectChanges();
    const kok = fixture.nativeElement as HTMLElement;
    const sahne = () => fixture.debugElement.query((d) => d.componentInstance instanceof Sahte3dComponent).componentInstance as Sahte3dComponent;
    const siniflar = () => [...kok.querySelectorAll('.py-sira tbody tr')].map((tr) =>
      tr.classList.contains('py-sira--adim') ? 'adim' : tr.classList.contains('py-sira--bekleyen') ? 'bekleyen' : '');

    // Kapalıyken: oynatıcı yok, bütün yükler çizilir.
    expect([sahne().gorunenler(), kok.querySelector('app-plan-yukleme-oynatici')]).toEqual([null, null]);
    expect(siniflar()).toEqual(['', '', '']);

    kok.querySelector<HTMLButtonElement>('.py-oynatma button')!.click();
    fixture.detectChanges();
    expect([...sahne().gorunenler()!]).toEqual(['s:1']);
    expect(siniflar()).toEqual(['adim', 'bekleyen', 'bekleyen']);

    kok.querySelector<HTMLButtonElement>('button[aria-label="Sonraki adım"]')!.click();
    fixture.detectChanges();
    expect([[...sahne().gorunenler()!], [...sahne().vurgulular()!]]).toEqual([['s:1', 's:2'], ['s:2']]);
    expect(siniflar()).toEqual(['', 'adim', 'bekleyen']);
    expect(kok.textContent).toContain('Adım 2 / 3');
  });

  it('sıra uyarısı: yandan yüklemede taraf planlanmaz, uygunsuz elle yerleşimde sıra güvenilmez', () => {
    const yandan = { ...konum('s:1', 'P1'), yuklemeYontemi: YerlesimGirisYonu.Yandan };
    const uygunsuz = arac(3, 'K40', [konum('s:7', 'P1')]);
    uygunsuz.yukSorunlari = [{ yukAnahtari: 's:7', sonuc: YerlesimKontrolSonucu.Uygunsuz, mesaj: 'Desteksiz' }];
    const c = kur(plan([arac(1, 'K40', [konum('s:5', 'P1')]), arac(2, 'TNT', [yandan]), uygunsuz]));
    expect(c.siraUyarisi()).toBeNull();
    c.aracSec(c.araclar()[1]);
    expect(c.siraUyarisi()).toContain('Yandan yüklemede');
    c.aracSec(c.araclar()[2]);
    expect(c.siraUyarisi()).toContain('uygunsuz yük');
  });
});
