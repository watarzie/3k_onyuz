import { EkipmanTeknikVerisi } from '../../../shared/models/yukleme-planlama.model';
import {
  ElleArac,
  ElleTaslak,
  ElleYuk,
  aracEkle,
  araciBosalt,
  aracaTasi,
  aracaYerlestir,
  ayniTiptenEkle,
  bekleyeneGonder,
  bosAraciKaldir,
  bosYerBul,
  dondur,
  istek,
  istif,
  taslakKur,
  tasi,
  yapistir,
  yerelSorunlar,
  yuzeyler,
} from './elle-yerlesim';

/** 12.000 × 2.400 mm konteyner; tek yüzey yerden 0 mm. */
const VERI: EkipmanTeknikVerisi = {
  disOlcu: { uzunlukMm: 12000, genislikMm: 2400, yukseklikMm: 2600 },
  yuzeyler: [{ kod: 'ANA', baslangicXMm: 0, uzunlukMm: 12000, genislikMm: 2400, yerdenYukseklikMm: 0 }],
};

function yuk(anahtar: string, x: number, y: number, z = 0, boy = 1000, en = 1000, h = 1000): ElleYuk {
  return { anahtar, kod: anahtar, projeNo: 'P1', brutKg: 500, boyMm: boy, enMm: en, yukseklikMm: h, xMm: x, yMm: y, zMm: z, donduruldu: false };
}

function arac(kimlik: number, yukler: ElleYuk[]): ElleArac {
  return { kimlik, konfigurasyonId: 40, ekipmanKodu: 'K40', ekipmanAdi: 'K40', tipAdi: 'Konteyner', teknikVeriJson: '', veri: VERI, yukler };
}

function taslak(...araclar: ElleArac[]): ElleTaslak {
  return { araclar, bekleyenler: [] };
}

describe('elle-yerlesim', () => {
  it('istif: yük üstündekilerle birlikte gelir; yandaki yük gelmez', () => {
    const a = arac(1, [yuk('alt', 0, 0), yuk('ust', 0, 0, 1000), yuk('en-ust', 100, 100, 2000, 500, 500), yuk('yan', 2000, 0)]);
    expect(istif(a, 'alt').map((y) => y.anahtar)).toEqual(['alt', 'ust', 'en-ust']);
    expect(istif(a, 'ust').map((y) => y.anahtar)).toEqual(['ust', 'en-ust']);
  });

  it('taşıma istifi bütün taşır ve bırakılan yer altındakinin üstüne oturur', () => {
    const t = taslak(arac(1, [yuk('alt', 0, 0), yuk('ust', 0, 0, 1000), yuk('hedef', 5000, 0, 0, 1000, 1000, 1500)]));
    const sonuc = tasi(t, 1, 'alt', 5000, 0).araclar[0].yukler;
    const bul = (k: string) => sonuc.find((y) => y.anahtar === k)!;
    expect([bul('alt').xMm, bul('alt').zMm]).toEqual([5000, 1500]);
    expect([bul('ust').xMm, bul('ust').zMm]).toEqual([5000, 2500]);
    // Boş yere bırakılan üst yük yüzeye iner.
    const indi = tasi(t, 1, 'ust', 2000, 0).araclar[0].yukler.find((y) => y.anahtar === 'ust')!;
    expect([indi.xMm, indi.zMm]).toEqual([2000, 0]);
  });

  it('yapışma: komşunun arkasına boşluk bırakarak, orta eksene ve kenara; uzaksa ızgaraya', () => {
    const a = arac(1, [yuk('k', 0, 0)]);
    expect(yapistir(a, 1080, 700, 1000, 1000, 30, new Set())).toEqual({ x: 1030, y: 700 });
    expect(yapistir(a, 4004, 760, 1000, 1000, 30, new Set())).toEqual({ x: 4000, y: 700 });
    expect(yapistir(a, 4004, 1390, 1000, 1000, 30, new Set())).toEqual({ x: 4000, y: 1400 });
  });

  it('döndürme merkezi korur; üstünde yük varsa reddedilir', () => {
    const t = taslak(arac(1, [yuk('a', 1000, 0, 0, 2000, 1000), yuk('b', 1000, 0, 1000, 500, 500)]));
    expect(typeof dondur(t, 1, 'a')).toBe('string');
    const d = dondur(t, 1, 'b') as ElleTaslak;
    const b = d.araclar[0].yukler.find((y) => y.anahtar === 'b')!;
    expect(b.donduruldu).toBeTrue();
    const tek = dondur(taslak(arac(1, [yuk('a', 1000, 0, 0, 2000, 1000)])), 1, 'a') as ElleTaslak;
    expect([tek.araclar[0].yukler[0].xMm, tek.araclar[0].yukler[0].yMm]).toEqual([1500, -500]);
  });

  it('bekleyenlere gönderme ve araca yerleştirme; üstünde yük varsa gönderilmez', () => {
    const t = taslak(arac(1, [yuk('a', 0, 0), yuk('b', 0, 0, 1000)]));
    expect(typeof bekleyeneGonder(t, 1, 'a')).toBe('string');
    const g = bekleyeneGonder(t, 1, 'b') as ElleTaslak;
    expect(g.bekleyenler.map((y) => y.anahtar)).toEqual(['b']);
    const geri = aracaYerlestir(g, 'b', 1, 30);
    const b = geri.araclar[0].yukler.find((y) => y.anahtar === 'b')!;
    expect(geri.bekleyenler).toEqual([]);
    expect(b.zMm).toBe(0);
    expect(yerelSorunlar(geri.araclar[0]).size).toBe(0);
  });

  it('başka araca taşıma, aynı tipten boş araç ve yalnız boş aracın kaldırılması', () => {
    let t = ayniTiptenEkle(taslak(arac(1, [yuk('a', 0, 0), yuk('b', 0, 0, 1000)])), 1);
    expect(t.araclar.map((a) => [a.kimlik, a.yukler.length])).toEqual([[1, 2], [2, 0]]);
    expect(bosAraciKaldir(t, 1).araclar.length).toBe(2);
    t = aracaTasi(t, 1, 'a', 2, 30);
    expect(t.araclar.map((a) => a.yukler.map((y) => y.anahtar))).toEqual([[], ['a', 'b']]);
    expect(t.araclar[1].yukler.map((y) => y.zMm)).toEqual([0, 1000]);
    expect(istek(t)).toEqual([
      { konfigurasyonId: 40, konumlar: [] },
      { konfigurasyonId: 40, konumlar: [
        { yukAnahtari: 'a', xMm: 0, yMm: 0, zMm: 0, donduruldu: false },
        { yukAnahtari: 'b', xMm: 0, yMm: 0, zMm: 1000, donduruldu: false },
      ] },
    ]);
  });

  it('yerel kontrol kasa dışını ve hacim kesişmesini işaretler; üst üste oturma kesişme değildir', () => {
    const a = arac(1, [yuk('dis', 11500, 0), yuk('k1', 3000, 0), yuk('k2', 3500, 500), yuk('alt', 6000, 0), yuk('ust', 6000, 0, 1000)]);
    expect([...yerelSorunlar(a)].sort()).toEqual(['dis', 'k1', 'k2']);
  });

  it('istenen tipte boş araç eklenir; araç boşaltılınca yükleri bekleyenlere döner', () => {
    const e = { konfigurasyonId: 77, kod: 'TNT', ad: 'Tenteli', tipAdi: 'Tenteli', aileAdi: 'Tenteli', aileDisi: true, ozelYukEkipmani: false, dogrulandi: false, teknikVeriJson: JSON.stringify(VERI) };
    const t = aracEkle(taslak(arac(1, [yuk('a', 0, 0), yuk('b', 2000, 0)])), e);
    expect(t.araclar.map((a) => [a.kimlik, a.konfigurasyonId, a.yukler.length])).toEqual([[1, 40, 2], [2, 77, 0]]);
    expect(t.araclar[1].veri?.disOlcu?.uzunlukMm).toBe(12000);
    const b = araciBosalt(t, 1);
    expect(b.araclar[0].yukler).toEqual([]);
    expect(b.bekleyenler.map((y) => [y.anahtar, y.xMm, y.zMm])).toEqual([['a', 0, 0], ['b', 0, 0]]);
    expect(araciBosalt(b, 2)).toBe(b);
  });

  it('yerleşim yoksa taslak araçsız başlar, hesaplanabilir yükler bekler', () => {
    const satir = { kaynak: 1, sandikId: 5, manuelGrupNo: null, birimNo: 1, birimSayisi: 1, kod: 'P1-5', projeNo: 'P1', dahil: true, boyMm: 1000, enMm: 800, yukseklikMm: 700, brutKg: 300 };
    const t = taslakKur({ yerlesim: null, yukler: [satir, { ...satir, sandikId: 6, kod: 'P1-6', boyMm: null }] } as never);
    expect(t.araclar).toEqual([]);
    expect(t.bekleyenler.map((y) => y.kod)).toEqual(['P1-5']);
  });

  it('boş yer önden arkaya, yüzey içinde aranır; yüzey ortalanır', () => {
    expect(yuzeyler({ ...VERI, yuzeyler: [{ ...VERI.yuzeyler![0], genislikMm: 2300 }] })[0].yBas).toBe(50);
    const a = arac(1, [yuk('a', 0, 0, 0, 1000, 2400)]);
    expect(bosYerBul(a, 1000, 1000, 30)).toEqual({ x: 1050, y: 0 });
  });
});
