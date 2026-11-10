import { PlanYukKonumu, YerlesimGirisYonu } from '../../../shared/models/yukleme-planlama.model';
import { adimGorunumu, adimSinirla, siraliKonumlar, yuklemeAdimlari } from './yukleme-adimlari';

function konum(kod: string, sira: number, kat: number): PlanYukKonumu {
  return {
    yukAnahtari: 's:' + kod, kod, projeNo: 'P1', brutKg: 500, xMm: 0, yMm: 0, zMm: 0, boyMm: 1000, enMm: 1000, yukseklikMm: 1000,
    donduruldu: false, yuzeyKodu: 'ANA', istifNo: sira, kat, yuklemeSirasi: sira, yuklemeYontemi: YerlesimGirisYonu.Arkadan,
  };
}

// Sunucudaki YuklemeSirasiKuraliTests ile aynı örnekler: iki taraf aynı numarayı ve adımı üretmeli.
describe('yukleme-adimlari', () => {
  it('numara: yükleme sırası, aynı sırada alt kat önce; girdi sırası sonucu değiştirmez', () => {
    const konumlar = [konum('C', 2, 1), konum('B-UST', 1, 2), konum('D', 3, 1), konum('B-ALT', 1, 1)];
    expect(siraliKonumlar(konumlar).map((k) => k.kod)).toEqual(['B-ALT', 'B-UST', 'C', 'D']);
    expect(konumlar[0].kod).toBe('C');
  });

  it('adım: istif grubu tek adımdır; adım numarası ardışık, yük numarası sıralı listedeki konumdur', () => {
    const konumlar = [konum('E', 7, 1), konum('A', 1, 1), konum('C-UST', 3, 2), konum('C-ALT', 3, 1), konum('C-EN-UST', 3, 3)];
    const adimlar = yuklemeAdimlari(konumlar);
    expect(adimlar.map((a) => [a.adimNo, a.yuklemeSirasi])).toEqual([[1, 1], [2, 3], [3, 7]]);
    expect(adimlar[1].yukler.map((y) => y.konum.kod)).toEqual(['C-ALT', 'C-UST', 'C-EN-UST']);
    expect(adimlar.flatMap((a) => a.yukler.map((y) => y.no))).toEqual([1, 2, 3, 4, 5]);
    expect(yuklemeAdimlari([])).toEqual([]);
  });

  it('adım görünümü: o adıma kadar yüklenenler görünür, o adımın yükleri vurgulanır', () => {
    const adimlar = yuklemeAdimlari([konum('A', 1, 1), konum('B-ALT', 2, 1), konum('B-UST', 2, 2), konum('C', 3, 1)]);
    const g = adimGorunumu(adimlar, 2);
    expect([...g.gorunenler]).toEqual(['s:A', 's:B-ALT', 's:B-UST']);
    expect([...g.vurgulular]).toEqual(['s:B-ALT', 's:B-UST']);
    expect(adimGorunumu(adimlar, 3).gorunenler.size).toBe(4);
  });

  it('adım sınır içine çekilir', () => {
    expect([adimSinirla(0, 5), adimSinirla(9, 5), adimSinirla(3, 5), adimSinirla(NaN, 5), adimSinirla(1, 0)]).toEqual([1, 5, 3, 1, 0]);
  });
});
