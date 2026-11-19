import { PlanYukDurumu, PlanYukIzni, PlanYukKaynagi, PlanYukSatiri, YukTuru } from '../../../shared/models/index';
import {
  BOS_TOPLU_DUZENLEME,
  dahilDegistir,
  izinDegistir,
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

  it('toplu düzenleme yalnız seçili sandıkları değiştirir ve koru olan izne dokunmaz', () => {
    const satirlar = [sandik(1), sandik(2, { usteKonabilirMi: false, elleDegisenIzinler: PlanYukIzni.UsteKonma }), sandik(3), elleYuk()];
    const secili = new Set(['s:1', 's:2', 'm:3:2']);

    const sonuc = topluUygula(satirlar, secili, { ...BOS_TOPLU_DUZENLEME, dondurme: 'aktif', altaKalma: 'pasif' });

    expect([sonuc[0].dondurulebilirMi, sonuc[0].altaKalabilirMi, sonuc[0].usteKonabilirMi]).toEqual([true, false, true]);
    expect(sonuc[1].usteKonabilirMi).toBeFalse();
    expect(sonuc[1].elleDegisenIzinler).toBe(PlanYukIzni.UsteKonma | PlanYukIzni.Dondurme | PlanYukIzni.AltaKalma);
    expect(sonuc[2]).toBe(satirlar[2]);
    // Elle eklenmiş yükün seçimleri istekle gönderilemez; seçili gelse de değişmez.
    expect(sonuc[3]).toBe(satirlar[3]);
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

  it('hesap isteğine listedeki bütün sandıkların seçimleri girer; elle eklenmiş yük girmez', () => {
    const satirlar = [dahilDegistir(sandik(5), false), izinDegistir(sandik(6), 'altaKalabilirMi', false), elleYuk()];
    expect(sandikYukleri(satirlar)).toEqual([
      { sandikId: 5, dahil: false, dondurulebilirMi: false, usteKonabilirMi: true, altaKalabilirMi: true, ustYukSiniriKg: 450, elleDegisenIzinler: 0 },
      { sandikId: 6, dahil: true, dondurulebilirMi: false, usteKonabilirMi: true, altaKalabilirMi: false, ustYukSiniriKg: 450, elleDegisenIzinler: 4 },
    ]);
  });
});
