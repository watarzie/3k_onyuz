// ===== Proje =====

export interface ProjeDto {
  id: number;
  projeNo: string;
  musteri: string;
  durumId: number;
  durumMetni: string;
  projeTipiId: number;
  projeTipiMetni: string;
  planlananSevkTarihi?: string;
  gerceklesenSevkTarihi?: string;
  sorumluKisi: string;
  sandikSayisi: number;
  hazirSandikSayisi: number;
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
  projeTipiId?: number;
  planlananSevkTarihi?: string;
  sorumluKisi: string;
  lokasyon?: string;
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

/** Dropdown'lar için hafif proje DTO — sadece Id/ProjeNo/Musteri */
export interface ProjeDropdownDto {
  id: number;
  projeNo: string;
  musteri: string;
}
