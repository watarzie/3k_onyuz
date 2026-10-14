import { FinansSandikMalzemesi } from '../../../core/constants/enums';
import { finansAhsapUretimden, finansHacimBilesik, finansHacimGecerli } from './finans-hacim';

describe('Finans ahşap/kontra hacim yardımcıları', () => {
  it('bileşik toplam ahşap ve kontra m³ toplamıdır, boş değer sıfır sayılır', () => {
    expect(finansHacimBilesik(1.2, 0.8)).toBe(2);
    expect(finansHacimBilesik(null, 0.333333)).toBe(0.333333);
    expect(finansHacimBilesik(0.1, 0.2)).toBe(0.3);
  });

  it('negatif değer, iki sıfır ve üst sınır aşımı geçersizdir', () => {
    expect(finansHacimGecerli(1.2, 0.8)).toBeTrue();
    expect(finansHacimGecerli(0, 0.5)).toBeTrue();
    expect(finansHacimGecerli(0, 0)).toBeFalse();
    expect(finansHacimGecerli(-1, 2)).toBeFalse();
    expect(finansHacimGecerli(1_000_000, 0)).toBeFalse();
  });

  it('yalnız ahşap sandıkta ahşap m³ üretimden gelir', () => {
    expect(finansAhsapUretimden(FinansSandikMalzemesi.Ahsap)).toBeTrue();
    expect(finansAhsapUretimden(FinansSandikMalzemesi.Kontra)).toBeFalse();
    expect(finansAhsapUretimden(0)).toBeFalse();
  });
});
