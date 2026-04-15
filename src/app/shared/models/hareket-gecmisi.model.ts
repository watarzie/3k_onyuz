// ===== Hareket Gecmisi =====

export interface HareketGecmisiDto {
  id: number;
  islem: string;
  referansTipi: string;
  referansId?: string;
  eskiDeger?: string;
  yeniDeger?: string;
  aciklama?: string;
  kullaniciAdi: string;
  tarih: string;
}
