// ===== Proje =====

export interface ProjeDto {
  id: number;
  projeNo: string;
  musteri: string;
  durum: string;
  planlananSevkTarihi?: string;
  sorumluKisi: string;
  sandikSayisi: number;
  toplamUrunSayisi: number;
  tamamlananUrunSayisi: number;
  fbNo?: string;
  guc?: string;
  gerilim?: string;
  lokasyon?: string;
  olcuResmiNo?: string;
  nakilOlcuResmiNo?: string;
  sonMontajResmiNo?: string;
  projeMuduru?: string;
}

export interface ProjeOlusturDto {
  projeNo: string;
  musteri: string;
  planlananSevkTarihi?: string;
  sorumluKisi: string;
}

export interface ProjeTransferDto {
  id: number;
  kaynakProjeNo: string;
  hedefProjeNo: string;
  barkodNo: string;
  miktar: number;
  kullaniciAdi: string;
  aciklama?: string;
  tarih: string;
}
