import { finansFiyatiHesapla } from './finans-pricing';

describe('finansFiyatiHesapla', () => {
  it('PA578-01 ana ambalaj tarifesini 10,17 m3 üzerinden hesaplar', () => {
    expect(finansFiyatiHesapla(10.17, 561, 20)).toEqual({
      netTutar: 5705.37,
      kdvTutari: 1141.07,
      toplamTutar: 6846.44,
    });
  });

  it('net, KDV ve genel toplamı iki ondalığa yuvarlar', () => {
    expect(finansFiyatiHesapla(1.234, 100, 20)).toEqual({
      netTutar: 123.4,
      kdvTutari: 24.68,
      toplamTutar: 148.08,
    });
  });

  it('KDV sıfırken net tutarı değiştirmez', () => {
    expect(finansFiyatiHesapla(3, 12.345, 0)).toEqual({
      netTutar: 37.04,
      kdvTutari: 0,
      toplamTutar: 37.04,
    });
  });
});
