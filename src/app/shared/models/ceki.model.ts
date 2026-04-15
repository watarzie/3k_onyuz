// ===== Ceki =====

export interface CekiYuklemeResultDto {
  cekiId: number;
  satirSayisi: number;
  sandikSayisi: number;
  mesaj: string;
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
