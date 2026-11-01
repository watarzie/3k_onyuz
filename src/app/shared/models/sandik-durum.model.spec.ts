import { sandikEksikMetni, sandikTarihMetni } from './sandik-durum.model';

describe('Sandık kapanma tarihi ve eksik uyarısı metinleri', () => {
  it('sunucunun saat dilimsiz zamanını gün.ay.yıl saat:dakika yazar; boş veya bozuksa null', () => {
    expect(sandikTarihMetni('2026-10-24T14:32:09')).toBe('24.10.2026 14:32');
    expect(sandikTarihMetni('2026-01-05T08:03:00')).toBe('05.01.2026 08:03');
    expect(sandikTarihMetni(null)).toBeNull();
    expect(sandikTarihMetni(undefined)).toBeNull();
    expect(sandikTarihMetni('tarih değil')).toBeNull();
  });

  it('eksik yoksa uyarı yoktur; varsa ürün ve adet sayısını Türkçe biçimle yazar', () => {
    expect(sandikEksikMetni({})).toBeNull();
    expect(sandikEksikMetni({ eksikUrunSayisi: 0, eksikAdet: 0 })).toBeNull();
    expect(sandikEksikMetni({ eksikUrunSayisi: 2, eksikAdet: 5 })).toBe('Eksik: 2 ürün / 5 adet');
    expect(sandikEksikMetni({ eksikUrunSayisi: 1, eksikAdet: 2.5 })).toBe('Eksik: 1 ürün / 2,5 adet');
  });
});
