import { PlanYukDurumu, PlanYukIzni, PlanYukKaynagi, PlanYukSatiri, YukTuru } from '../../../shared/models/yukleme-planlama.model';
import {
  AGIRLIK_GIRINIZ,
  BOS_TOPLU_DUZENLEME,
  OLCU_GIRINIZ,
  izinDegistir,
  manuelYukSatirlari,
  ortakDeger,
  satirAnahtari,
  sayaclariHesapla,
  topluUygula,
  varsayilanIzinler,
  varsayilanaDondur,
  veriSorunlari,
  yukIstekleri,
} from './plan-yuk-listesi';

function sandik(id: number, ek: Partial<PlanYukSatiri> = {}): PlanYukSatiri {
  return {
    siraNo: id,
    kaynak: PlanYukKaynagi.Sandik,
    sandikId: id,
    manuelGrupNo: null,
    birimNo: 1,
    birimSayisi: 1,
    kod: `P1-${id}`,
    aciklama: null,
    projeId: 1,
    projeNo: 'P1',
    yukTuruId: YukTuru.Sandik,
    yukTuruAdi: 'Sandık',
    boyMm: 1200,
    enMm: 800,
    yukseklikMm: 900,
    brutKg: 450,
    lokasyonId: null,
    lokasyonAdi: null,
    dahil: true,
    dondurulebilirMi: false,
    usteKonabilirMi: true,
    altaKalabilirMi: true,
    ustYukSiniriKg: 450,
    elleDegisenIzinler: PlanYukIzni.Yok,
    ozelTasimaNotu: null,
    durum: PlanYukDurumu.Bekliyor,
    veriSorunlari: [],
    ...ek,
  };
}

describe('plan yük listesi kuralları', () => {
  it('sandıkta varsayılan: döndürme pasif, üst/alt aktif, sınır brüt; özel yükte hepsi kapalı', () => {
    expect(varsayilanIzinler(YukTuru.Sandik, 450)).toEqual({ dondurulebilirMi: false, usteKonabilirMi: true, altaKalabilirMi: true, ustYukSiniriKg: 450 });
    expect(varsayilanIzinler(YukTuru.Sandik, null).ustYukSiniriKg).toBeNull();
    expect(varsayilanIzinler(YukTuru.Trafo, 30000)).toEqual({ dondurulebilirMi: false, usteKonabilirMi: false, altaKalabilirMi: false, ustYukSiniriKg: null });
  });

  it('sıfır veya boş ölçü/ağırlık eksik veri sayılır', () => {
    expect(veriSorunlari(1200, 0, 900, 450)).toEqual([OLCU_GIRINIZ]);
    expect(veriSorunlari(1200, 800, 900, null)).toEqual([AGIRLIK_GIRINIZ]);
    expect(veriSorunlari(1200, 800, 900, 450)).toEqual([]);
  });

  // Kabul senaryosu 3: toplu izin düzenlemesi yalnız seçili satırlara uygulanır, "koru" değeri bırakır.
  it('toplu düzenleme yalnız seçili yükleri değiştirir ve koru olan izne dokunmaz', () => {
    const satirlar = [sandik(1), sandik(2, { usteKonabilirMi: false, elleDegisenIzinler: PlanYukIzni.UsteKonma }), sandik(3)];
    const secili = new Set([satirAnahtari(satirlar[0]), satirAnahtari(satirlar[1])]);

    const sonuc = topluUygula(satirlar, secili, { ...BOS_TOPLU_DUZENLEME, dondurme: 'aktif', altaKalma: 'pasif' });

    expect(sonuc[0].dondurulebilirMi).toBeTrue();
    expect(sonuc[0].altaKalabilirMi).toBeFalse();
    expect(sonuc[0].usteKonabilirMi).toBeTrue();
    expect(sonuc[1].usteKonabilirMi).toBeFalse();
    expect(sonuc[1].elleDegisenIzinler).toBe(PlanYukIzni.UsteKonma | PlanYukIzni.Dondurme | PlanYukIzni.AltaKalma);
    expect(sonuc[2]).toBe(satirlar[2]);
  });

  it('toplu hariç tutma durumu ve sayaçları günceller', () => {
    const satirlar = [sandik(1), sandik(2), sandik(3, { boyMm: null, veriSorunlari: [OLCU_GIRINIZ], durum: PlanYukDurumu.EksikVeri })];
    const sonuc = topluUygula(satirlar, new Set(['s:1']), { ...BOS_TOPLU_DUZENLEME, dahil: 'pasif' });

    expect(sonuc[0].durum).toBe(PlanYukDurumu.HaricTutuldu);
    expect(sayaclariHesapla(sonuc, 4)).toEqual({ toplam: 3, secilen: 2, hesaplanabilir: 1, veriEksik: 1, haricTutulan: 1, sevkEdilmisSandik: 4, yerlesen: 0, yerlesemeyen: 0 });
  });

  it('üst yükte brüt seçimi varsayılana döndürür, sabit değer elle değişti olur', () => {
    const satirlar = [sandik(1, { ustYukSiniriKg: 100, elleDegisenIzinler: PlanYukIzni.UstYukSiniri })];
    const brut = topluUygula(satirlar, new Set(['s:1']), { ...BOS_TOPLU_DUZENLEME, ustYuk: { tur: 'brut' } });
    expect(brut[0].ustYukSiniriKg).toBe(450);
    expect(brut[0].elleDegisenIzinler).toBe(PlanYukIzni.Yok);

    const deger = topluUygula(satirlar, new Set(['s:1']), { ...BOS_TOPLU_DUZENLEME, ustYuk: { tur: 'deger', kg: 2000 } });
    expect(deger[0].ustYukSiniriKg).toBe(2000);
    expect(deger[0].elleDegisenIzinler).toBe(PlanYukIzni.UstYukSiniri);

    expect(() => topluUygula(satirlar, new Set(['s:1']), { ...BOS_TOPLU_DUZENLEME, ustYuk: { tur: 'deger', kg: -1 } })).toThrow();
  });

  it('seçili satırlarda ortak değer karışık olabilir', () => {
    const satirlar = [sandik(1), sandik(2, { dondurulebilirMi: true })];
    expect(ortakDeger(satirlar, new Set(['s:1', 's:2']), 'dondurulebilirMi')).toBe('karisik');
    expect(ortakDeger(satirlar, new Set(['s:1']), 'usteKonabilirMi')).toBe('aktif');
    expect(ortakDeger(satirlar, new Set(), 'dahil')).toBeNull();
  });

  it('tek izin değişikliği bayrağı işaretler, varsayılana dönüş temizler', () => {
    const degisti = izinDegistir(sandik(1), 'dondurulebilirMi', true);
    expect(degisti.elleDegisenIzinler).toBe(PlanYukIzni.Dondurme);
    const geri = varsayilanaDondur(degisti);
    expect(geri.dondurulebilirMi).toBeFalse();
    expect(geri.elleDegisenIzinler).toBe(PlanYukIzni.Yok);
  });

  it('elle yük adet kadar birim üretir; düzenlemede elle değişen izin korunur', () => {
    const bilgi = {
      kod: 'TRAFO-1', aciklama: null, yukTuruId: YukTuru.Trafo, yukTuruAdi: 'Trafo', boyMm: 4000, enMm: 2500,
      yukseklikMm: 3200, brutKg: 32000, adet: 2, projeId: null, projeNo: null, lokasyonId: null, lokasyonAdi: null,
      ozelTasimaNotu: 'Kaldırma noktalarından',
    };
    const ilk = manuelYukSatirlari(bilgi, 1);
    expect(ilk.length).toBe(2);
    expect(ilk.every((s) => !s.usteKonabilirMi && s.ustYukSiniriKg === null)).toBeTrue();

    const elle = [izinDegistir(ilk[0], 'altaKalabilirMi', true), ilk[1]];
    const yeni = manuelYukSatirlari({ ...bilgi, adet: 3 }, 1, elle);
    expect(yeni.length).toBe(3);
    expect(yeni[0].altaKalabilirMi).toBeTrue();
    expect(yeni[2].birimSayisi).toBe(3);

    const istek = yukIstekleri([sandik(5), ...yeni]);
    expect(istek.sandikYukleri.map((s) => s.sandikId)).toEqual([5]);
    expect(istek.manuelYukler.length).toBe(1);
    expect(istek.manuelYukler[0].adet).toBe(3);
    expect(istek.manuelYukler[0].birimler[0].elleDegisenIzinler).toBe(PlanYukIzni.AltaKalma);
  });
});
