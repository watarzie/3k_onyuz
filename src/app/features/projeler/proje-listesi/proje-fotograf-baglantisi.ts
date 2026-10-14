/**
 * Proje fotoğraf sayfası bağlantısı; sunucudaki ProjeFotografBaglantisiKurali ile aynı: yalnız http/https adresi,
 * en fazla 1000 karakter, boşluk içermez. Şemasız yazılan adres (ör. foto.ornek.com/pa727) https kabul edilir; boş
 * değer bağlantıyı kaldırır. Son karar sunucunundur; bu fonksiyonlar kullanıcıya anında geri bildirim içindir.
 */
export const FOTOGRAF_BAGLANTISI_EN_FAZLA = 1000;

/** Kırpılmış adres; şema yoksa https:// eklenir; boşsa null. */
export function fotografBaglantisiNormalize(deger: string | null | undefined): string | null {
  const metin = (deger ?? '').trim();
  if (!metin) return null;
  return metin.includes('://') ? metin : `https://${metin}`;
}

/** Boş (kaldırma) veya geçerli bir http/https adresi mi. */
export function fotografBaglantisiGecerli(deger: string | null | undefined): boolean {
  const adres = fotografBaglantisiNormalize(deger);
  if (adres === null) return true;
  if (adres.length > FOTOGRAF_BAGLANTISI_EN_FAZLA || /\s/.test(adres)) return false;
  try {
    const url = new URL(adres);
    return (url.protocol === 'https:' || url.protocol === 'http:') && !!url.hostname;
  } catch {
    return false;
  }
}

/** Bağlantının kısa site adı (ipucu ve pencere için), ör. "foto.ornek.com". */
export function fotografSitesi(adres: string | null | undefined): string {
  if (!adres) return '';
  try {
    return new URL(adres).hostname.replace(/^www\./, '');
  } catch {
    return adres;
  }
}
