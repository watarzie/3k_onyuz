// ===== Stok =====

export interface StokKaydiDto {
  id: number;
  malzemeKodu: string;
  malzemeAdi: string;
  miktar: number;
  birim: string;
  lokasyon?: string;
  kaynakProje?: string;
  durum: string;
}

export interface StokKaydiOlusturDto {
  malzemeKodu: string;
  malzemeAdi: string;
  miktar: number;
  birim: string;
  lokasyon?: string;
  kaynakProje?: string;
}

export interface StokKarsilamaDto {
  cekiSatiriId: number;
  stokKaydiId: number;
  miktar: number;
  kullaniciId: number;
  projeId: number;
}
