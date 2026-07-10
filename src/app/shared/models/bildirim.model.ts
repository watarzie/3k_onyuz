export enum BildirimTipi {
  CekiYuklendi = 1,
  CekiRevizyonuYuklendi = 2,
}

export type BildirimDurumu = 'tumu' | 'okunmamis' | 'okunmus';

export interface BildirimMetadataDto {
  projeId?: number | null;
  projeNo?: string | null;
  olusturanKullaniciId?: number | null;
  olusturanKullaniciAdi?: string | null;
}

export interface BildirimDto {
  id: number;
  tipId: BildirimTipi;
  baslik: string;
  mesaj: string;
  hedefUrl?: string | null;
  olusturulmaTarihi: string;
  okunduMu: boolean;
  okunmaTarihi?: string | null;
  referansTipi?: string | null;
  referansId?: number | null;
  metadata?: BildirimMetadataDto | null;
}

export interface BildirimOzetDto {
  toplamOkunmamis: number;
  bildirimler: BildirimDto[];
}

export interface BildirimListeDto {
  bildirimler: BildirimDto[];
  toplamKayit: number;
  toplamOkunmamis: number;
  sayfa: number;
  sayfaBoyutu: number;
  toplamSayfa: number;
}

export interface BildirimListeFiltre {
  durum: BildirimDurumu;
  baslangicTarihi?: string;
  bitisTarihi?: string;
  tipId?: BildirimTipi;
  arama?: string;
  sayfa: number;
  sayfaBoyutu: number;
}

export interface BildirimAbonelikAyariDto {
  kullaniciId: number;
  adSoyad: string;
  email: string;
  rol: string;
  cekiYuklendiBildirimi: boolean;
  cekiRevizyonuBildirimi: boolean;
}

export interface BildirimAbonelikleriniGuncelleRequest {
  cekiYuklendiAliciIdleri: number[];
  cekiRevizyonuAliciIdleri: number[];
}
