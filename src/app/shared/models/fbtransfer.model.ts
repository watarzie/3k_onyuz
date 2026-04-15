// ===== FB Transfer =====

export interface FBTransferDto {
  cekiSatiriId: number;
  asilFB: string;
  alinanFB: string;
  miktar: number;
  neden?: string;
  iadeDurumu?: string;
  aciklama?: string;
  kullaniciId: number;
}

export interface FBTransferResultDto {
  id: number;
  asilFB: string;
  alinanFB: string;
  miktar: number;
  neden?: string;
  iadeDurumu?: string;
  aciklama?: string;
  tarih: string;
}
