import { AMBALAJ_YETKI, FINANS_YETKI } from '../../core/constants/yetki-kodlari';
import {
  FINANS_TUM_ALAN_IZINLERI,
  finansBelgesiIndirilebilir,
  finansFaturaGirilebilir,
  finansOdemeKaydedilebilir,
  finansOzelIsiEklenebilir,
  finansPoGirilebilir,
  finansRaporuIndirilebilir,
  tumFinansAlanlariGorunur,
} from './finans-izinleri';

describe('Finans izinleri sunucu kurallarının aynası', () => {
  function izinler(okuma: string[], yazma: string[] = []) {
    return {
      hasAccess: (kod: string) => okuma.includes(kod) || yazma.includes(kod),
      canWrite: (kod: string) => yazma.includes(kod),
    };
  }
  const tumAlanlar = [...FINANS_TUM_ALAN_IZINLERI];

  it('tek bir mali veya ölçü alanı eksikse dosya içeriği görünür sayılmaz', () => {
    expect(tumFinansAlanlariGorunur(izinler(tumAlanlar))).toBeTrue();
    for (const eksik of tumAlanlar) {
      expect(tumFinansAlanlariGorunur(izinler(tumAlanlar.filter((kod) => kod !== eksik)))).toBeFalse();
    }
  });

  it('rapor dosyası rapor görme, biçim izni ve bütün alan izinlerini birlikte ister', () => {
    const tam = [...tumAlanlar, FINANS_YETKI.RaporGoruntule, FINANS_YETKI.PdfAktar];
    expect(finansRaporuIndirilebilir(izinler(tam), 'pdf')).toBeTrue();
    expect(finansRaporuIndirilebilir(izinler(tam), 'excel')).toBeFalse();
    expect(finansRaporuIndirilebilir(izinler(tam.filter((kod) => kod !== FINANS_YETKI.RaporGoruntule)), 'pdf')).toBeFalse();
    expect(finansRaporuIndirilebilir(izinler(tam.filter((kod) => kod !== AMBALAJ_YETKI.SarfGoruntule)), 'pdf')).toBeFalse();
  });

  it('belge indirme belge izni ve bütün alan izinlerini ister', () => {
    expect(finansBelgesiIndirilebilir(izinler([...tumAlanlar, FINANS_YETKI.BelgeIndir]))).toBeTrue();
    expect(finansBelgesiIndirilebilir(izinler([FINANS_YETKI.BelgeIndir]))).toBeFalse();
  });

  it('tek seferlik iş fiyat taşıdığı için birim fiyat değiştirme yazma iznini de ister', () => {
    expect(finansOzelIsiEklenebilir(izinler([], [FINANS_YETKI.ManuelIsEkle]))).toBeFalse();
    expect(
      finansOzelIsiEklenebilir(izinler([], [FINANS_YETKI.ManuelIsEkle, FINANS_YETKI.BirimFiyatDegistir])),
    ).toBeTrue();
  });

  it('PO ve fatura girişi yazma izniyle birlikte kayıt ve sipariş görüntüleme izinlerini ister', () => {
    const okuma = [FINANS_YETKI.KayitGoruntule, FINANS_YETKI.SiparisOperasyonGoruntule];
    expect(finansPoGirilebilir(izinler(okuma, [FINANS_YETKI.PoGir]))).toBeTrue();
    expect(finansPoGirilebilir(izinler([FINANS_YETKI.KayitGoruntule], [FINANS_YETKI.PoGir]))).toBeFalse();
    expect(finansPoGirilebilir(izinler(okuma))).toBeFalse();
    expect(finansFaturaGirilebilir(izinler(okuma, [FINANS_YETKI.FaturaGir]))).toBeTrue();
    expect(finansFaturaGirilebilir(izinler([FINANS_YETKI.SiparisOperasyonGoruntule], [FINANS_YETKI.FaturaGir]))).toBeFalse();
  });

  it('ödeme işareti ayrı ödeme yazma izniyle birlikte fatura okuma izinlerini ister (D3)', () => {
    const okuma = [FINANS_YETKI.KayitGoruntule, FINANS_YETKI.SiparisOperasyonGoruntule];
    expect(finansOdemeKaydedilebilir(izinler(okuma, [FINANS_YETKI.OdemeKaydet]))).toBeTrue();
    expect(finansOdemeKaydedilebilir(izinler(okuma, [FINANS_YETKI.FaturaGir]))).toBeFalse();
    expect(finansOdemeKaydedilebilir(izinler([...okuma, FINANS_YETKI.OdemeKaydet]))).toBeFalse();
    expect(finansOdemeKaydedilebilir(izinler([FINANS_YETKI.KayitGoruntule], [FINANS_YETKI.OdemeKaydet]))).toBeFalse();
  });
});
