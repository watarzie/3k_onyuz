/**
 * Proje fotoğraf bağlantıları; sunucudaki ProjeFotografBaglantisiKurali ile aynı: yalnız http/https adresi, en fazla
 * 1000 karakter, boşluk içermez. Şemasız yazılan adres (ör. foto.ornek.com/pa727) https kabul edilir. Açıklama isteğe
 * bağlıdır (en fazla 100 karakter); bir projede en fazla 20 bağlantı olur. Son karar sunucunundur; bu fonksiyonlar
 * kullanıcıya anında geri bildirim içindir.
 */
export const FOTOGRAF_BAGLANTISI_EN_FAZLA = 1000;
export const FOTOGRAF_ACIKLAMASI_EN_FAZLA = 100;
export const FOTOGRAF_BAGLANTISI_SAYISI_EN_FAZLA = 20;

/** Kırpılmış adres; şema yoksa https:// eklenir; boşsa null. */
export function fotografBaglantisiNormalize(deger: string | null | undefined): string | null {
  const metin = (deger ?? '').trim();
  if (!metin) return null;
  return metin.includes('://') ? metin : `https://${metin}`;
}

/** Dolu ve geçerli bir http/https adresi mi (boş adres bağlantı değildir). */
export function fotografBaglantisiGecerli(deger: string | null | undefined): boolean {
  const adres = fotografBaglantisiNormalize(deger);
  if (adres === null) return false;
  if (adres.length > FOTOGRAF_BAGLANTISI_EN_FAZLA || /\s/.test(adres)) return false;
  try {
    const url = new URL(adres);
    return (url.protocol === 'https:' || url.protocol === 'http:') && !!url.hostname;
  } catch {
    return false;
  }
}

/** Boş veya en fazla 100 karakterlik (kırpılmış) açıklama mı. */
export function fotografAciklamasiGecerli(deger: string | null | undefined): boolean {
  return (deger ?? '').trim().length <= FOTOGRAF_ACIKLAMASI_EN_FAZLA;
}

/** Bağlantının kısa site adı (ipucu ve liste için), ör. "foto.ornek.com". */
export function fotografSitesi(adres: string | null | undefined): string {
  if (!adres) return '';
  try {
    return new URL(adres).hostname.replace(/^www\./, '');
  } catch {
    return adres;
  }
}

/** Listede görünen ad: açıklama, yoksa sitenin adı. */
export function fotografBaglantisiEtiketi(baglanti: { adres: string; aciklama?: string | null }): string {
  return baglanti.aciklama?.trim() || fotografSitesi(baglanti.adres);
}
