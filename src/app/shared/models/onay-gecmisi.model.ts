export type OnayGecmisiKapsami = 'tumu' | 'kararVerdiklerim' | 'taleplerim' | 'bekleyenler';

export type OnayGecmisiDurumu = 'tumu' | 'bekliyor' | 'onaylandi' | 'reddedildi';

export type OnayCalistirmaDurumu =
  | 'tumu'
  | 'bilinmiyor'
  | 'bekliyor'
  | 'calisiyor'
  | 'basarili'
  | 'basarisiz'
  | 'atlandi';

export interface OnayGecmisiDto {
  id: number;
  islemKodu: string;
  islemAdi: string;
  islemAciklamasi: string;
  talepEdenKullaniciId: number;
  talepEdenKisi: string;
  kararVerenKullaniciId?: number | null;
  kararVerenKisi?: string | null;
  durumId: number;
  durum: string;
  talepTarihi: string;
  kararTarihi?: string | null;
  kararAciklamasi?: string | null;
  calistirmaDurumuId: number;
  calistirmaDurumu: string;
  calistirmaBaslamaTarihi?: string | null;
  calistirmaBitisTarihi?: string | null;
  calistirmaHatasi?: string | null;
  referansTipi?: string | null;
  referansId?: number | null;
  projeId?: number | null;
  projeNo?: string | null;
  hedefUrl?: string | null;
  aksiyonAktifMi: boolean;
}

export interface OnayGecmisiListeDto {
  kayitlar: OnayGecmisiDto[];
  toplamKayit: number;
  sayfa: number;
  sayfaBoyutu: number;
  toplamSayfa: number;
}

export interface OnayGecmisiListeFiltre {
  kapsam: OnayGecmisiKapsami;
  durum: OnayGecmisiDurumu;
  calistirmaDurumu: OnayCalistirmaDurumu;
  baslangicTarihi?: string;
  bitisTarihi?: string;
  arama?: string;
  sayfa: number;
  sayfaBoyutu: number;
}
