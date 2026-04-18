// ===== Grid =====

export interface GridUrunDto {
  cekiSatiriId: number;
  siraNo: number;
  barkodNo: string;
  aciklama: string;
  istenenAdet: number;
  birim: string;
  sandikNo: string;
  gridDurumu: string;
  gridGelenAdet: number;
  trafoSevkAdet: number;
  gridSevkDurumu: string;
  gridSevkMiktari?: number;
  gridSevkTarihi?: string;
  gridNotu?: string;
  gridEksikMiktar: number;
  ucKDurumu: string;
  gelenMiktar: number;
  kaynakHedefProjeNo?: string;
  genelDurum: string;
}

export interface GridDurumGuncelleDto {
  cekiSatiriId: number;
  projeId: number;
  yeniDurum: string;
  gridGelenAdet?: number;
  trafoSevkAdet?: number;
  gridSevkDurumu?: string;
  sevkMiktari?: number;
  not?: string;
}

export interface GridTopluSevkDto {
  projeId: number;
  cekiSatiriIdler: number[];
  not?: string;
}
