import { AMBALAJ_YETKI, FINANS_YETKI } from '../../../core/constants/yetki-kodlari';
import {
  FINANS_TUM_ALAN_IZINLERI,
  finansBelgesiIndirilebilir,
  FINANS_SEKME_KODLARI,
  FINANS_SEKME_SIRASI,
  finansFaturaGirilebilir,
  finansIlkSekme,
  finansOdemeKaydedilebilir,
  finansOzelIsiEklenebilir,
  finansPoGirilebilir,
  finansRaporuIndirilebilir,
  finansSekmeAcik,
  finansTanimOkunabilir,
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

  describe('sekme düğümleri', () => {
    const ekranIzinleri: Record<string, string[]> = {
      panel: [],
      akis: [FINANS_YETKI.KayitGoruntule],
      munferit: [FINANS_YETKI.KayitGoruntule],
      giderler: [FINANS_YETKI.GiderGoruntule],
      ayarlar: [FINANS_YETKI.DuzenliIsYonet],
      belgeler: [FINANS_YETKI.KayitGoruntule, FINANS_YETKI.SiparisOperasyonGoruntule],
      raporlar: [FINANS_YETKI.RaporGoruntule],
      kategoriler: [FINANS_YETKI.GiderKutuphanesiYonet],
    };

    it('her sekme modülü, kendi sekme düğümünü ve ekranının okuma iznini birlikte ister', () => {
      for (const sekme of FINANS_SEKME_SIRASI) {
        const tam = [FINANS_YETKI.Modul, FINANS_SEKME_KODLARI[sekme], ...ekranIzinleri[sekme]];
        expect(finansSekmeAcik(izinler(tam), sekme)).withContext(sekme).toBeTrue();
        expect(finansSekmeAcik(izinler(tam.filter((k) => k !== FINANS_SEKME_KODLARI[sekme])), sekme)).withContext(sekme + ' düğümsüz').toBeFalse();
        expect(finansSekmeAcik(izinler(tam.filter((k) => k !== FINANS_YETKI.Modul)), sekme)).withContext(sekme + ' modülsüz').toBeFalse();
        for (const kod of ekranIzinleri[sekme])
          expect(finansSekmeAcik(izinler(tam.filter((k) => k !== kod)), sekme)).withContext(sekme + ' ' + kod).toBeFalse();
      }
    });

    it('gider kategorileri okuma izniyle açılır; tanımlar alt görünümleri sunucunun okuma izinlerini ister', () => {
      const kategori = [FINANS_YETKI.Modul, FINANS_YETKI.SekmeGiderKategorileri, FINANS_YETKI.GiderKutuphanesiYonet];
      expect(finansSekmeAcik(izinler(kategori), 'kategoriler')).toBeTrue();
      const tarife = [FINANS_YETKI.Modul, FINANS_YETKI.IsKutuphanesiYonet];
      expect(finansTanimOkunabilir(izinler(tarife), 'parametreler')).toBeTrue();
      expect(finansTanimOkunabilir(izinler(tarife), 'tarifeler')).toBeFalse();
      expect(finansTanimOkunabilir(izinler([...tarife, FINANS_YETKI.BirimFiyatGoruntule]), 'tarifeler')).toBeTrue();
      expect(finansTanimOkunabilir(izinler(tarife), 'duzenli')).toBeFalse();
    });

    it('açılış sekmesi ekran sırasıyla erişilebilen ilk sekmedir; hiçbiri yoksa null', () => {
      const raporcu = [FINANS_YETKI.Modul, FINANS_YETKI.SekmeRaporlar, FINANS_YETKI.RaporGoruntule, FINANS_YETKI.SekmeGiderler, FINANS_YETKI.GiderGoruntule];
      expect(finansIlkSekme(izinler(raporcu))).toBe('giderler');
      expect(finansIlkSekme(izinler([...raporcu, FINANS_YETKI.SekmePanel]))).toBe('panel');
      expect(finansIlkSekme(izinler([FINANS_YETKI.Modul, FINANS_YETKI.KayitGoruntule]))).toBeNull();
    });
  });
});
