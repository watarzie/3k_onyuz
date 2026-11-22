import {
  EkipmanDogrulamaDurumu,
  EkipmanKategorisi,
  EkipmanKaynakTuru,
  EkipmanKonfigurasyonDetayi,
  EkipmanTeknikVerisi,
  YuklemeYontemi,
} from '../../../shared/models/yukleme-planlama.model';
import {
  EkipmanFormu,
  bosEkipmanFormu,
  ekipmanFormuDenetle,
  ekipmanFormuDoldur,
  ekipmanKaydi,
  formdanTeknikVeri,
  satirEkle,
  satirGuncelle,
  satirSil,
  sorunMetinleri,
  teknikVeriDuzenlemeEngeli,
} from './ekipman-formu';

// Sunucunun yazdığı biçim: camelCase, enum'lar metin, bilinmeyen alan yok.
const TEKNIK: EkipmanTeknikVerisi = {
  semaSurumu: 1,
  disOlcu: { uzunlukMm: 13600, genislikMm: 2550, yukseklikMm: 4000 },
  daraKg: 7000,
  teknikKapasiteKg: 27000,
  kingPin: { xMm: 1200, azamiBaglantiYukuKg: 12000 },
  yuzeyler: [{ kod: 'ANA', ad: 'Ana güverte', baslangicXMm: 0, uzunlukMm: 13600, genislikMm: 2480, yerdenYukseklikMm: 1200, kullanilabilirYukseklikMm: 2700 }],
  acikliklar: [{ taraf: 'arka', genislikMm: 2480, yukseklikMm: 2700 }],
  engeller: [{ tur: 'tekerHavuzu', xMm: 9000, yMm: 0, zMm: 1200, uzunlukMm: 3000, genislikMm: 300, yukseklikMm: 200, sokulebilir: true }],
  dingiller: [{ xMm: 10000, tur: 'tahriksiz', grupNo: 1, kapasiteKg: 9000 }, { xMm: 11300, tur: 'pandul', grupNo: 1 }],
  baglamaNoktalari: [{ xMm: 500, yMm: 0, zMm: 1200, kapasiteDaN: 2000 }],
};

function detay(teknikVeriJson = JSON.stringify(TEKNIK)): EkipmanKonfigurasyonDetayi {
  const revizyon = {
    revizyonNo: 3, kaynakTuru: EkipmanKaynakTuru.UreticiFoyu, kaynakAciklama: 'Föy 12, s. 4', kaynakTarihi: '2026-03-15T00:00:00',
    aciklama: null, dogrulamaDurumu: EkipmanDogrulamaDurumu.Dogrulandi, dogrulayan: null, dogrulamaTarihi: null, olusturan: null,
    tarih: '2026-03-16T09:00:00',
  };
  return {
    id: 7, kod: 'TNT-136', ad: 'Tenteli 13,6 m', aktif: true, aileAdi: 'Tır', tipId: 21, tipKodu: 'TENTELI', tipAdi: 'Tenteli',
    kategori: EkipmanKategorisi.Tenteli, yuklemeYontemleri: YuklemeYontemi.Arkadan, sandikTasimayaUygun: true, uretici: 'Jenerik',
    modelAdi: 'Standart', revizyon, teknikVeriJson, veriUyarilari: [], revizyonlar: [revizyon],
  };
}

describe('ekipman formu', () => {
  it('ayrıntıdan dolar: tip kökten, kaynak son revizyondan, tarih gün biçiminde, boş değer null kalır', () => {
    const f = ekipmanFormuDoldur(detay());
    expect([f.kod, f.ad, f.aileId, f.tipId, f.uretici, f.modelAdi]).toEqual(['TNT-136', 'Tenteli 13,6 m', null, 21, 'Jenerik', 'Standart']);
    expect([f.kaynakTuru, f.kaynakAciklama, f.kaynakTarihi, f.aciklama]).toEqual([EkipmanKaynakTuru.UreticiFoyu, 'Föy 12, s. 4', '2026-03-15', '']);
    expect([f.disUzunlukMm, f.daraKg, f.azamiBrutKg, f.uzamaEnFazlaMm, f.kingPinXMm]).toEqual([13600, 7000, null, null, 1200]);
    expect([f.yuzeyler.length, f.acikliklar.length, f.engeller.length, f.dingiller.length, f.baglamaNoktalari.length]).toEqual([1, 1, 1, 2, 1]);
    expect([f.yuzeyler[0].tabanYukuKgM2, f.acikliklar[0].baslangicXMm, f.dingiller[1].kapasiteKg]).toEqual([null, null, null]);
    expect(new Set([...f.dingiller, ...f.yuzeyler].map((s) => s.satirId)).size).toBe(3);
  });

  it('doldurulan form değişmeden yazılırsa sunucudaki teknik veriyle birebir aynı JSON çıkar', () => {
    const kayit = ekipmanKaydi(ekipmanFormuDoldur(detay()))!;
    expect(JSON.parse(kayit.teknikVeriJson)).toEqual(TEKNIK);
    expect(kayit).toEqual(jasmine.objectContaining({
      kod: 'TNT-136', ad: 'Tenteli 13,6 m', tipId: 21, uretici: 'Jenerik', modelAdi: 'Standart', kaynakTuru: 3,
      kaynakAciklama: 'Föy 12, s. 4', kaynakTarihi: '2026-03-15', aciklama: null,
    }));
    expect(Object.keys(kayit)).not.toContain('aileId');
  });

  it('boş sayı sıfıra çevrilmez: alan JSON\'a hiç yazılmaz; boş metin null gider', () => {
    const f: EkipmanFormu = { ...ekipmanFormuDoldur(detay()), daraKg: null, azamiBaglantiYukuKg: null, kaynakAciklama: '  ', kaynakTarihi: '' };
    const kayit = ekipmanKaydi(satirGuncelle(f, 'dingiller', f.dingiller[0].satirId, { kapasiteKg: null }))!;
    const veri = JSON.parse(kayit.teknikVeriJson) as EkipmanTeknikVerisi;
    expect('daraKg' in veri).toBeFalse();
    expect(veri.kingPin).toEqual({ xMm: 1200 });
    expect(veri.dingiller![0]).toEqual({ xMm: 10000, tur: 'tahriksiz', grupNo: 1 });
    expect(kayit.teknikVeriJson).not.toContain('null');
    expect([kayit.kaynakAciklama, kayit.kaynakTarihi]).toEqual([null, null]);
  });

  it('king pin ve dış ölçü: konum boşsa king pin, üç ölçü tam değilse dış ölçü yazılmaz; şema sürümü güncel sürümdür', () => {
    const f = { ...ekipmanFormuDoldur(detay()), kingPinXMm: null, azamiBaglantiYukuKg: null, disGenislikMm: null };
    const veri = formdanTeknikVeri(f);
    expect([veri.semaSurumu, 'kingPin' in veri, 'disOlcu' in veri]).toEqual([1, false, false]);
    expect(formdanTeknikVeri(bosEkipmanFormu())).toEqual({ semaSurumu: 1, yuzeyler: [], acikliklar: [], engeller: [], dingiller: [], baglamaNoktalari: [] });
  });

  it('satır eklenir, güncellenir ve silinir; zorunlu alanı eksik satır teknik veriye girmez', () => {
    let f = satirEkle(bosEkipmanFormu(), 'acikliklar');
    f = satirEkle(f, 'acikliklar');
    const [ilk, ikinci] = f.acikliklar;
    expect([ilk.taraf, ilk.satirId !== ikinci.satirId]).toEqual([null, true]);
    expect(formdanTeknikVeri(f).acikliklar).toEqual([]);

    f = satirGuncelle(f, 'acikliklar', ikinci.satirId, { taraf: 'sag', baslangicXMm: 0, uzunlukMm: 6000, yukseklikMm: 2500 });
    expect(formdanTeknikVeri(f).acikliklar).toEqual([{ taraf: 'sag', baslangicXMm: 0, uzunlukMm: 6000, yukseklikMm: 2500 }]);

    f = satirSil(f, 'acikliklar', ilk.satirId);
    expect(f.acikliklar.map((s) => s.satirId)).toEqual([ikinci.satirId]);

    f = satirEkle(f, 'engeller');
    expect(f.engeller[0]).toEqual(jasmine.objectContaining({ tur: null, sokulebilir: false, aciklama: '' }));
  });

  it('denetim: zorunlu alanlar, yarım satırlar, birlikte girilecek ölçüler ve tamsayı', () => {
    expect(ekipmanFormuDenetle(ekipmanFormuDoldur(detay()), false)).toEqual([]);
    expect(ekipmanFormuDenetle(bosEkipmanFormu(), true)).toEqual([
      'Kod zorunludur.', 'Ad zorunludur.', 'Tip zorunludur.', 'Üretici zorunludur.', 'Model zorunludur.', 'Kaynak türü zorunludur.',
    ]);
    // Düzenlemede kod salt okunurdur; ayrıca denetlenmez.
    expect(ekipmanFormuDenetle(bosEkipmanFormu(), false)).not.toContain('Kod zorunludur.');

    let f = ekipmanFormuDoldur(detay());
    f = { ...f, disYukseklikMm: null, kingPinXMm: null, daraKg: 7000.5 };
    for (const liste of ['yuzeyler', 'acikliklar', 'engeller', 'dingiller', 'baglamaNoktalari'] as const) f = satirEkle(f, liste);
    expect(ekipmanFormuDenetle(f, false)).toEqual([
      'Dış ölçünün uzunluk, genişlik ve yüksekliği birlikte girilmelidir.',
      'Bağlantı yükü girildiyse king pin konumu (X) da girilmelidir.',
      'Ölçü ve ağırlık: sayılar tamsayı olmalıdır (mm, kg).',
      'Yükleme yüzeyi 2: kod, başlangıç X, uzunluk, genişlik ve yerden yükseklik zorunludur.',
      'Açıklık 2: taraf zorunludur.',
      'Engel 2: tür, X, Y, Z, uzunluk, genişlik ve yükseklik zorunludur.',
      'Dingil 3: X, tür ve grup no zorunludur.',
      'Bağlama noktası 2: X, Y ve Z zorunludur.',
    ]);
  });

  it('tip ya da kaynak türü seçilmemişse gövde üretilmez', () => {
    expect(ekipmanKaydi(bosEkipmanFormu())).toBeNull();
    expect(ekipmanKaydi({ ...ekipmanFormuDoldur(detay()), kaynakTuru: null })).toBeNull();
  });

  describe('kayıpsız düzenleme denetimi (teknikVeriDuzenlemeEngeli)', () => {
    const engel = (veri: unknown) => teknikVeriDuzenlemeEngeli(detay(typeof veri === 'string' ? veri : JSON.stringify(veri)));

    it('formdan geçip aynı kalan veri düzenlenebilir: alan sırası, eksik/boş liste, null ve boş metin fark sayılmaz', () => {
      expect(engel(TEKNIK)).toBeNull();
      expect(engel(Object.fromEntries(Object.entries(TEKNIK).reverse()))).toBeNull();
      // Listeleri hiç yazılmamış, sürümü yazılmamış (sunucuda güncel sürüm sayılır) ve boş değerleri null yazılmış veri.
      expect(engel({ yuzeyler: [{ ...TEKNIK.yuzeyler![0], ad: '', tabanYukuKgM2: null }], daraKg: null, kingPin: null })).toBeNull();
      expect(engel({ semaSurumu: 1, yuzeyler: TEKNIK.yuzeyler, acikliklar: [], engeller: [] })).toBeNull();
      expect(engel({})).toBeNull();
    });

    it('okunamayan ya da nesne olmayan JSON düzenlenemez; form boş dolar ama kaydedilmemelidir', () => {
      for (const bozuk of ['{bozuk', '', '[]', '5', 'null', '"metin"']) expect(engel(bozuk)).toBe('Kayıtlı teknik veri okunamadı.');
      const f = ekipmanFormuDoldur(detay('{bozuk'));
      expect([f.disUzunlukMm, f.yuzeyler.length, f.kod]).toEqual([null, 0, 'TNT-136']);
    });

    it('başka şema sürümü düzenlenemez', () => {
      expect(engel({ ...TEKNIK, semaSurumu: 2 })).toBe('Kayıtlı teknik verinin şema sürümü (2) bu ekranda desteklenmiyor.');
      expect(engel({ ...TEKNIK, semaSurumu: '1' })).toContain('şema sürümü (1)');
    });

    it('formun bilmediği alan ya da taşıyamadığı değer varsa düzenlenemez ve farklı alan adı bildirilir', () => {
      const kaybolur = (veri: unknown, alan: string) =>
        expect(engel(veri)).toBe(`Kayıtlı teknik veride bu formun taşıyamadığı alan ya da değer var (${alan}); ekrandan kaydedilirse kaybolur.`);
      kaybolur({ ...TEKNIK, lastikBasinciBar: 9 }, 'lastikBasinciBar');
      kaybolur({ ...TEKNIK, yuzeyler: [{ ...TEKNIK.yuzeyler![0], egimYuzde: 2 }] }, 'yuzeyler');
      // Zorunlu alanı eksik satır formdan geçerken atılır.
      const { yMm, ...ysizEngel } = TEKNIK.engeller![0];
      expect(yMm).toBe(0);
      kaybolur({ ...TEKNIK, engeller: [ysizEngel] }, 'engeller');
      kaybolur({ ...TEKNIK, kingPin: { azamiBaglantiYukuKg: 12000 } }, 'kingPin');
      kaybolur({ ...TEKNIK, disOlcu: { uzunlukMm: 13600, genislikMm: 2550 } }, 'disOlcu');
      kaybolur({ ...TEKNIK, dingiller: [null, ...TEKNIK.dingiller!] }, 'dingiller');
      kaybolur({ ...TEKNIK, yuzeyler: [{ ...TEKNIK.yuzeyler![0], kod: 7 }], baglamaNoktalari: 'yok' }, 'baglamaNoktalari, yuzeyler');
    });

    it('bozuk yapıdaki veride form doldurulurken hata vermez', () => {
      const f = ekipmanFormuDoldur(detay(JSON.stringify({ disOlcu: 5, kingPin: [1], yuzeyler: [null, 3, { kod: 7 }], engeller: 'x' })));
      expect([f.disUzunlukMm, f.kingPinXMm, f.yuzeyler.map((y) => y.kod), f.engeller]).toEqual([null, null, [''], []]);
      expect(() => formdanTeknikVeri(f)).not.toThrow();
      expect(ekipmanFormuDenetle(f, false).length).toBeGreaterThan(0);
    });
  });

  it('sunucu sorun listesi: metin listesi madde olur; model bağlama hatasındaki nesnenin değerleri düzleştirilir', () => {
    expect(sorunMetinleri({ issues: ['Yüzey çakışıyor.', 'Dara büyük.', { baska: 1 }, '', 5] })).toEqual(['Yüzey çakışıyor.', 'Dara büyük.']);
    expect(sorunMetinleri({ issues: { tipId: ['Tip zorunludur.'], kaynakTarihi: ['Tarih geçersiz.', 'Biçim hatalı.'], diger: 'Tek mesaj.' } }))
      .toEqual(['Tip zorunludur.', 'Tarih geçersiz.', 'Biçim hatalı.', 'Tek mesaj.']);
    expect([sorunMetinleri({ issues: 'x' }), sorunMetinleri({}), sorunMetinleri(null)]).toEqual([[], [], []]);
  });
});
