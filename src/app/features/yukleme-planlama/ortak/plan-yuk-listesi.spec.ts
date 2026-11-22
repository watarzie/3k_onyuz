import { PlanYukDurumu, PlanYukIzni, PlanYukKaynagi, PlanYukSatiri, YukTuru } from '../../../shared/models/index';
import {
  BOS_TOPLU_DUZENLEME,
  ElleYukBilgisi,
  bosElleYukFormu,
  dahilDegistir,
  elleYukFormu,
  elleYukHatalari,
  elleYukProjeleriniBirak,
  elleYukuSil,
  elleYukuYaz,
  izinDegistir,
  manuelYukler,
  ortakDeger,
  sandikYukleri,
  satirAnahtari,
  sayaclariHesapla,
  secimleriKoru,
  topluUygula,
  ustYukSiniriGecerli,
  varsayilanIzinler,
  varsayilanaDondur,
} from './plan-yuk-listesi';

function sandik(id: number, ek: Partial<PlanYukSatiri> = {}): PlanYukSatiri {
  return {
    siraNo: id, kaynak: PlanYukKaynagi.Sandik, sandikId: id, manuelGrupNo: null, birimNo: 1, birimSayisi: 1, kod: `P1-${id}`,
    aciklama: null, projeId: 1, projeNo: 'P1', yukTuruId: YukTuru.Sandik, yukTuruAdi: 'Sandık', boyMm: 1200, enMm: 800,
    yukseklikMm: 900, brutKg: 450, lokasyonId: null, lokasyonAdi: null, dahil: true, dondurulebilirMi: false,
    usteKonabilirMi: true, altaKalabilirMi: true, ustYukSiniriKg: 450, elleDegisenIzinler: PlanYukIzni.Yok,
    ozelTasimaNotu: null, durum: PlanYukDurumu.Bekliyor, veriSorunlari: [], ...ek,
  };
}

const elleYuk = (): PlanYukSatiri =>
  sandik(0, { kaynak: PlanYukKaynagi.Manuel, sandikId: null, manuelGrupNo: 3, birimNo: 2, kod: 'TRAFO-1', yukTuruId: YukTuru.Trafo });

describe('yük listesi kuralları', () => {
  it('satır anahtarı: sandıkta sandık kimliği, elle eklenen yükte grup ve birim (sunucudaki yük anahtarıyla aynı)', () => {
    expect(satirAnahtari(sandik(42))).toBe('s:42');
    expect(satirAnahtari(elleYuk())).toBe('m:3:2');
  });

  it('sandıkta varsayılan: döndürme pasif, üst/alt aktif, sınır brüt; özel yükte hepsi kapalı', () => {
    expect(varsayilanIzinler(YukTuru.Sandik, 450)).toEqual({ dondurulebilirMi: false, usteKonabilirMi: true, altaKalabilirMi: true, ustYukSiniriKg: 450 });
    expect(varsayilanIzinler(YukTuru.Sandik, null).ustYukSiniriKg).toBeNull();
    expect(varsayilanIzinler(YukTuru.Trafo, 30000)).toEqual({ dondurulebilirMi: false, usteKonabilirMi: false, altaKalabilirMi: false, ustYukSiniriKg: null });
  });

  it('üst yük sınırı boş, sıfır ya da pozitif olabilir; negatif ve sınır üstü geçersizdir', () => {
    expect([null, 0, 450, 1_000_000].map(ustYukSiniriGecerli)).toEqual([true, true, true, true]);
    expect([-1, 1_000_001, Number.NaN].map(ustYukSiniriGecerli)).toEqual([false, false, false]);
  });

  it('hariç tutulan yük durumunu ve araç bilgisini bırakır; yeniden dahil edilince yerleşim bekler, verisi eksikse eksik kalır', () => {
    const yerlesti = sandik(1, { durum: PlanYukDurumu.Yerlesti, aracNo: 2 });
    const haric = dahilDegistir(yerlesti, false);
    expect([haric.dahil, haric.durum, haric.aracNo]).toEqual([false, PlanYukDurumu.HaricTutuldu, null]);
    expect(dahilDegistir(haric, true).durum).toBe(PlanYukDurumu.Bekliyor);
    expect(dahilDegistir(sandik(2, { dahil: false, durum: PlanYukDurumu.HaricTutuldu, veriSorunlari: ['Ölçü giriniz.'] }), true).durum)
      .toBe(PlanYukDurumu.EksikVeri);
    // Değer değişmiyorsa satır (ve son hesaptaki durumu) aynen kalır.
    expect(dahilDegistir(yerlesti, true)).toBe(yerlesti);
  });

  it('tek izin değişikliği bayrağı işaretler, varsayılana dönüş temizler', () => {
    const degisti = izinDegistir(sandik(1), 'dondurulebilirMi', true);
    expect(degisti.elleDegisenIzinler).toBe(PlanYukIzni.Dondurme);
    const geri = varsayilanaDondur(degisti);
    expect([geri.dondurulebilirMi, geri.elleDegisenIzinler]).toEqual([false, PlanYukIzni.Yok]);
  });

  it('toplu düzenleme yalnız seçili yükleri (sandık ve elle eklenen) değiştirir ve koru olan izne dokunmaz', () => {
    const satirlar = [sandik(1), sandik(2, { usteKonabilirMi: false, elleDegisenIzinler: PlanYukIzni.UsteKonma }), sandik(3), elleYuk()];
    const secili = new Set(['s:1', 's:2', 'm:3:2']);

    const sonuc = topluUygula(satirlar, secili, { ...BOS_TOPLU_DUZENLEME, dondurme: 'aktif', altaKalma: 'pasif' });

    expect([sonuc[0].dondurulebilirMi, sonuc[0].altaKalabilirMi, sonuc[0].usteKonabilirMi]).toEqual([true, false, true]);
    expect(sonuc[1].usteKonabilirMi).toBeFalse();
    expect(sonuc[1].elleDegisenIzinler).toBe(PlanYukIzni.UsteKonma | PlanYukIzni.Dondurme | PlanYukIzni.AltaKalma);
    expect(sonuc[2]).toBe(satirlar[2]);
    // Elle eklenen yük de sandık gibi düzenlenir (22.11.2026).
    expect([sonuc[3].dondurulebilirMi, sonuc[3].elleDegisenIzinler]).toEqual([true, PlanYukIzni.Dondurme | PlanYukIzni.AltaKalma]);
  });

  it('toplu hariç tutma durumu ve sayaçları günceller', () => {
    const satirlar = [sandik(1), sandik(2), sandik(3, { boyMm: null, veriSorunlari: ['Ölçü giriniz.'], durum: PlanYukDurumu.EksikVeri })];
    const sonuc = topluUygula(satirlar, new Set(['s:1']), { ...BOS_TOPLU_DUZENLEME, dahil: 'pasif' });

    expect(sonuc[0].durum).toBe(PlanYukDurumu.HaricTutuldu);
    expect(sayaclariHesapla(sonuc)).toEqual({ toplam: 3, dahil: 2, hesaplanabilir: 1, veriEksik: 1, haricTutulan: 1 });
  });

  it('üst yükte brüt seçimi varsayılana döndürür, sabit değer elle değişti olur', () => {
    const satirlar = [sandik(1, { ustYukSiniriKg: 100, elleDegisenIzinler: PlanYukIzni.UstYukSiniri })];
    const brut = topluUygula(satirlar, new Set(['s:1']), { ...BOS_TOPLU_DUZENLEME, ustYuk: { tur: 'brut' } });
    expect([brut[0].ustYukSiniriKg, brut[0].elleDegisenIzinler]).toEqual([450, PlanYukIzni.Yok]);

    const deger = topluUygula(satirlar, new Set(['s:1']), { ...BOS_TOPLU_DUZENLEME, ustYuk: { tur: 'deger', kg: 2000 } });
    expect([deger[0].ustYukSiniriKg, deger[0].elleDegisenIzinler]).toEqual([2000, PlanYukIzni.UstYukSiniri]);

    expect(() => topluUygula(satirlar, new Set(['s:1']), { ...BOS_TOPLU_DUZENLEME, ustYuk: { tur: 'deger', kg: -1 } })).toThrow();
  });

  it('seçili satırlarda ortak değer karışık olabilir', () => {
    const satirlar = [sandik(1), sandik(2, { dondurulebilirMi: true })];
    expect(ortakDeger(satirlar, new Set(['s:1', 's:2']), 'dondurulebilirMi')).toBe('karisik');
    expect(ortakDeger(satirlar, new Set(['s:1']), 'usteKonabilirMi')).toBe('aktif');
    expect(ortakDeger(satirlar, new Set(), 'dahil')).toBeNull();
  });

  it('liste yeniden gelince hâlâ listedeki sandığın seçimleri korunur; veri ve elle değişmemiş izin yeni satırdandır', () => {
    const eski = [
      dahilDegistir(sandik(1), false),
      izinDegistir(sandik(2, { ustYukSiniriKg: 450 }), 'dondurulebilirMi', true),
      sandik(3),
    ];
    const yeni = [
      sandik(1, { brutKg: 500, ustYukSiniriKg: 500 }),
      sandik(2, { brutKg: 600, ustYukSiniriKg: 600, lokasyonAdi: 'Depo 2' }),
      sandik(9),
    ];

    const sonuc = secimleriKoru(yeni, eski);

    expect([sonuc[0].dahil, sonuc[0].durum, sonuc[0].brutKg, sonuc[0].ustYukSiniriKg]).toEqual([false, PlanYukDurumu.HaricTutuldu, 500, 500]);
    expect([sonuc[1].dondurulebilirMi, sonuc[1].elleDegisenIzinler, sonuc[1].ustYukSiniriKg, sonuc[1].lokasyonAdi])
      .toEqual([true, PlanYukIzni.Dondurme, 600, 'Depo 2']);
    // Listeye yeni giren sandık sunucunun varsayılanlarıyla kalır; listeden çıkan sandık geri gelmez.
    expect(sonuc[2]).toBe(yeni[2]);
    expect(sonuc.map((s) => s.sandikId)).toEqual([1, 2, 9]);
  });

  it('liste yeniden gelince elle eklenen yükler eski listeden aynen sona eklenir', () => {
    const elle = elleYuk();
    const sonuc = secimleriKoru([sandik(9)], [sandik(1), elle]);
    expect(sonuc.map(satirAnahtari)).toEqual(['s:9', 'm:3:2']);
    expect(sonuc[1]).toBe(elle);
  });

  it('sandık isteğine yalnız sandık satırları girer', () => {
    const satirlar = [dahilDegistir(sandik(5), false), izinDegistir(sandik(6), 'altaKalabilirMi', false), elleYuk()];
    expect(sandikYukleri(satirlar)).toEqual([
      { sandikId: 5, dahil: false, dondurulebilirMi: false, usteKonabilirMi: true, altaKalabilirMi: true, ustYukSiniriKg: 450, elleDegisenIzinler: 0 },
      { sandikId: 6, dahil: true, dondurulebilirMi: false, usteKonabilirMi: true, altaKalabilirMi: false, ustYukSiniriKg: 450, elleDegisenIzinler: 4 },
    ]);
  });
});

describe('elle eklenen yük', () => {
  const bilgi = (ek: Partial<ElleYukBilgisi> = {}): ElleYukBilgisi => ({
    kod: 'Ek sandık 1', aciklama: null, yukTuruId: YukTuru.Sandik, yukTuruAdi: 'Sandık', boyMm: 1200, enMm: 800, yukseklikMm: 900,
    brutKg: 450, adet: 2, projeId: 1, projeNo: 'P1', lokasyonId: null, lokasyonAdi: null, ozelTasimaNotu: null, ...ek,
  });
  const tamForm = () => ({ ...bosElleYukFormu(), kod: 'Ek', boyMm: 1000, enMm: 800, yukseklikMm: 600, brutKg: 300 });

  it('pencere doğrulaması: zorunlu alanlar, tam sayı ölçü ve adet, sıfırdan büyük değerler, liste sınırı', () => {
    expect(Object.keys(elleYukHatalari(bosElleYukFormu(), 0)).sort()).toEqual(['boyMm', 'brutKg', 'enMm', 'kod', 'yukseklikMm']);
    expect(elleYukHatalari(tamForm(), 0)).toEqual({});
    expect(elleYukHatalari({ ...tamForm(), kod: '   ' }, 0).kod).toBe('Kod / ad zorunludur.');
    expect(elleYukHatalari({ ...tamForm(), boyMm: 1000.5 }, 0).boyMm).toBe('Tam sayı (mm) girin.');
    expect(elleYukHatalari({ ...tamForm(), enMm: 0 }, 0).enMm).toBe('Sıfırdan büyük olmalı.');
    expect(elleYukHatalari({ ...tamForm(), yukseklikMm: -5 }, 0).yukseklikMm).toBe('Sıfırdan büyük olmalı.');
    expect(elleYukHatalari({ ...tamForm(), yukseklikMm: 50_001 }, 0).yukseklikMm).toContain('En fazla');
    expect(elleYukHatalari({ ...tamForm(), brutKg: 0 }, 0).brutKg).toBe('Sıfırdan büyük olmalı.');
    expect(elleYukHatalari({ ...tamForm(), brutKg: 12.5 }, 0)).toEqual({});
    expect(elleYukHatalari({ ...tamForm(), brutKg: Number.NaN }, 0).brutKg).toBe('Sayı girin.');
    expect(elleYukHatalari({ ...tamForm(), adet: null }, 0).adet).toBe('Zorunlu.');
    expect(elleYukHatalari({ ...tamForm(), adet: 1.5 }, 0).adet).toBe('Tam sayı girin.');
    expect(elleYukHatalari({ ...tamForm(), adet: 0 }, 0).adet).toBe('En az 1.');
    expect(elleYukHatalari({ ...tamForm(), adet: 501 }, 0).adet).toBe('En fazla 500.');
    expect(elleYukHatalari({ ...tamForm(), adet: 3 }, 1998).adet).toContain('en fazla 2');
  });

  it('adet kadar birim satırı; sandık varsayılan izinleri yük türüne ve ağırlığa göre', () => {
    const [b1, b2] = elleYukuYaz([sandik(1)], bilgi(), null).slice(1);
    expect([b1.kaynak, b1.manuelGrupNo, b1.birimNo, b1.birimSayisi, b2.birimNo]).toEqual([PlanYukKaynagi.Manuel, 1, 1, 2, 2]);
    expect([b1.usteKonabilirMi, b1.altaKalabilirMi, b1.dondurulebilirMi, b1.ustYukSiniriKg]).toEqual([true, true, false, 450]);
    expect([b1.dahil, b1.durum, b1.veriSorunlari]).toEqual([true, PlanYukDurumu.Bekliyor, []]);
    const trafo = elleYukuYaz([], bilgi({ yukTuruId: YukTuru.Trafo, adet: 1 }), null)[0];
    expect([trafo.usteKonabilirMi, trafo.altaKalabilirMi, trafo.ustYukSiniriKg]).toEqual([false, false, null]);
  });

  it('yeni grup en büyük grup numarasının bir fazlasıdır; düzenleme grubu yerinde değiştirir, elle değişen izni korur', () => {
    let liste = elleYukuYaz(elleYukuYaz([sandik(1)], bilgi(), null), bilgi({ kod: 'B', adet: 1 }), null);
    expect(liste.map(satirAnahtari)).toEqual(['s:1', 'm:1:1', 'm:1:2', 'm:2:1']);
    liste = liste.map((s) => (satirAnahtari(s) === 'm:1:2' ? izinDegistir(dahilDegistir(s, false), 'dondurulebilirMi', true) : s));

    liste = elleYukuYaz(liste, bilgi({ kod: 'A2', brutKg: 600, adet: 3 }), 1);
    expect(liste.map(satirAnahtari)).toEqual(['s:1', 'm:1:1', 'm:1:2', 'm:1:3', 'm:2:1']);
    const b2 = liste[2];
    expect([b2.kod, b2.dahil, b2.dondurulebilirMi, b2.elleDegisenIzinler, b2.ustYukSiniriKg, b2.birimSayisi])
      .toEqual(['A2', false, true, PlanYukIzni.Dondurme, 600, 3]);
    expect(elleYukFormu(liste, 1)).toEqual(jasmine.objectContaining({ grupNo: 1, kod: 'A2', adet: 3, brutKg: 600 }));
    expect(elleYukFormu(liste, 9)).toBeNull();

    expect(elleYukuSil(liste, 1).map(satirAnahtari)).toEqual(['s:1', 'm:2:1']);
  });

  it('projesi seçimden çıkan elle yük silinmez, projesiz kalır', () => {
    const liste = elleYukuYaz(elleYukuYaz([], bilgi(), null), bilgi({ kod: 'B', adet: 1, projeId: 2, projeNo: 'P2' }), null);
    const sonuc = elleYukProjeleriniBirak(liste, [2]);
    expect(sonuc.grupSayisi).toBe(1);
    expect(sonuc.satirlar.map((s) => [s.kod, s.projeId, s.projeNo])).toEqual([['Ek sandık 1', null, null], ['Ek sandık 1', null, null], ['B', 2, 'P2']]);
    expect(elleYukProjeleriniBirak(liste, [1, 2]).grupSayisi).toBe(0);
  });

  it('hesap isteğinin elle yük kısmı: grup başına ortak bilgi ve birim seçimleri; elle yük yoksa boş dizi', () => {
    expect(manuelYukler([sandik(1)])).toEqual([]);
    const liste = elleYukuYaz([sandik(1)], bilgi(), null).map((s) => (s.birimNo === 2 ? dahilDegistir(s, false) : s));
    expect(manuelYukler(liste)).toEqual([{
      kod: 'Ek sandık 1', aciklama: null, yukTuruId: YukTuru.Sandik, boyMm: 1200, enMm: 800, yukseklikMm: 900, brutKg: 450, adet: 2,
      projeId: 1, lokasyonId: null, ozelTasimaNotu: null,
      birimler: [
        { birimNo: 1, dahil: true, dondurulebilirMi: false, usteKonabilirMi: true, altaKalabilirMi: true, ustYukSiniriKg: 450, elleDegisenIzinler: 0 },
        { birimNo: 2, dahil: false, dondurulebilirMi: false, usteKonabilirMi: true, altaKalabilirMi: true, ustYukSiniriKg: 450, elleDegisenIzinler: 0 },
      ],
    }]);
  });
});
