// ===== Ceki =====

export interface CekiYuklemeResultDto {
  cekiId: number;
  satirSayisi: number;
  sandikSayisi: number;
  mesaj: string;
}

export interface ManuelCekiOlusturDto {
  projeNo: string;
  fbNo?: string;
  musteri?: string;
  lokasyon?: string;
  guc?: string;
  gerilim?: string;
  projeMuduru?: string;
  sorumluKisi?: string;
  olcuResmiNo?: string;
  nakilOlcuResmiNo?: string;
  sonMontajResmiNo?: string;
  planlananSevkTarihi?: string | null;
  projeTipiId: number;
  sandiklar: ManuelCekiSandikDto[];
  satirlar: ManuelCekiSatiriDto[];
}

export interface ManuelCekiSandikDto {
  sandikNo: string;
  ad?: string;
  en?: number | null;
  boy?: number | null;
  yukseklik?: number | null;
  netKg?: number | null;
  grossKg?: number | null;
}

export interface ManuelCekiSatiriDto {
  siraNo?: number | null;
  barkodNo?: string;
  aciklama: string;
  sandikNo: string;
  istenenAdet: number;
  birimId?: number | null;
  birim?: string;
  remarks?: string;
}

export interface CekiSatiriDto {
  id: number;
  siraNo: number;
  olcuResmiPozNo?: string;
  barkodNo: string;
  aciklama: string;
  istenenAdet: number;
  birim: string;
  cekideGecenSandikNo: string;
  fiiliSandikNo?: string;
  remarks?: string;
  durum: string;
  paketleyenBasHarf?: string;
  kontrolEdenBasHarf?: string;
  konulanAdet: number;
  eksikAdet: number;
}
