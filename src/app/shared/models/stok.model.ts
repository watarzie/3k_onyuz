// ===== Stok =====

export interface StokKaydiDto {
  id: number;
  malzemeKodu: string;
  malzemeAdi: string;
  miktar: number;
  birim: string;
  lokasyon?: string;
  kaynakProje?: string;
  stokGirisNedeni?: string;
  durum: string;
}

export interface StokKaydiOlusturDto {
  id?: number;  // For generic updates if needed
  malzemeKodu: string;
  malzemeAdi: string;
  miktar: number;
  birim: string;
  lokasyon?: string;
  kaynakProje?: string;
  stokGirisNedeni?: string;
}

export interface StokKarsilamaDto {
  cekiSatiriId: number;
  stokKaydiId: number;
  miktar: number;
  kullaniciId: number;
  projeId: number;
}
