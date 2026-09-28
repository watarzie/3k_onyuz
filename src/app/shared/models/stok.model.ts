// ===== Stok =====

export interface StokKaydiDto {
  id: number;
  malzemeKodu: string;
  malzemeAdi: string;
  miktar: number;
  birimId: number;
  birimMetni: string;
  lokasyon?: string;
  kaynakProje?: string;
  stokGirisNedeni?: string;
  durumId: number;
  durumMetni: string;
}

export interface StokKaydiOlusturDto {
  id?: number;
  malzemeKodu: string;
  malzemeAdi: string;
  miktar: number;
  birimId: number;
  lokasyon?: string;
  kaynakProje?: string;
  stokGirisNedeni?: string;
}
