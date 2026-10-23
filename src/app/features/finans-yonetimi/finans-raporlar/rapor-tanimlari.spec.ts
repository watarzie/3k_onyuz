import { FinansGiderRaporuGruplamasi, FinansIsRaporuKapsami } from '../../../core/constants/enums';
import tr from '../../../../assets/i18n/tr.json';
import en from '../../../../assets/i18n/en.json';
import {
  FINANS_RAPORLARI,
  FINANS_RAPOR_GRUPLARI,
  GIDER_RAPORU_GRUPLAMALARI,
  IS_RAPORU_KAPSAMLARI,
  raporTanimi,
} from './rapor-tanimlari';

describe('Finans rapor tanımları', () => {
  it('her tür bir kez ve bir grupta yer alır; seçim yalnız işler ve gider raporundadır', () => {
    const turler = FINANS_RAPORLARI.map((r) => r.tur);
    expect(new Set(turler).size).toBe(turler.length);
    expect(FINANS_RAPOR_GRUPLARI.flatMap((g) => g.raporlar.map((r) => r.tur))).toEqual(turler);
    expect(FINANS_RAPORLARI.filter((r) => r.secim).map((r) => [r.tur, r.secim])).toEqual([
      ['is', 'kapsam'],
      ['gider', 'gruplama'],
    ]);
    // Finansal durum Kontrol Paneliyle aynı tutarı verir: yalnız dönem ve para birimi uygulanır.
    expect(raporTanimi('finansal-durum')).toEqual(jasmine.objectContaining({ projeVeArama: false, gelismis: false }));
    expect(raporTanimi('yok').tur).toBe('is');
  });

  it('kapsam ve gruplama değerleri sunucu enumlarıyla aynıdır', () => {
    expect(IS_RAPORU_KAPSAMLARI.map((x) => x.deger)).toEqual([
      FinansIsRaporuKapsami.Birlesik, FinansIsRaporuKapsami.SiparisiAcilan, FinansIsRaporuKapsami.SiparisiAcilmayan,
    ]);
    expect([FinansIsRaporuKapsami.Birlesik, FinansIsRaporuKapsami.SiparisiAcilan, FinansIsRaporuKapsami.SiparisiAcilmayan]).toEqual([0, 1, 2]);
    expect(GIDER_RAPORU_GRUPLAMALARI.map((x) => x.deger)).toEqual([0, 1, 2].map((x) => x as FinansGiderRaporuGruplamasi));
  });

  it('bütün çeviri anahtarları TR ve EN dosyalarında vardır', () => {
    const anahtarlar = [
      ...FINANS_RAPORLARI.flatMap((r) => [r.baslik, r.aciklama]),
      ...FINANS_RAPOR_GRUPLARI.map((g) => g.baslik),
      ...IS_RAPORU_KAPSAMLARI.map((x) => x.etiket),
      ...GIDER_RAPORU_GRUPLAMALARI.map((x) => x.etiket),
    ];
    const trFinans = tr.FINANS_V2 as unknown as Record<string, string>;
    const enFinans = en.FINANS_V2 as unknown as Record<string, string>;
    for (const anahtar of anahtarlar) {
      expect(trFinans[anahtar]).withContext(`tr ${anahtar}`).toBeTruthy();
      expect(enFinans[anahtar]).withContext(`en ${anahtar}`).toBeTruthy();
    }
  });
});
