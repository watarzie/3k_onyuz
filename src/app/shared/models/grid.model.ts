// ===== Grid =====

export interface GridUrunDto {
  cekiSatiriId: number;
  siraNo: number;
  barkodNo: string;
  aciklama: string;
  istenenAdet: number;
  birim: string;
  sandikNo: string;
  gridDurumuId: number;
  gridDurumuMetni: string;
  gridGelenAdet: number;
  trafoSevkAdet: number;
  gridSevkDurumuId: number;
  gridSevkDurumuMetni: string;
  gridSevkMiktari?: number;
  gridSevkTarihi?: string;
  gridNotu?: string;
  gridEksikMiktar: number;
  // Parçalı karşılama (Madde 2)
  stokKarsilanan: number;
  projeKarsilanan: number;
  tedarikciKarsilanan: number;
  eksikMiktar: number;
  kalanMiktar: number;
  ucKDurumuId: number;
  ucKDurumuMetni: string;
  gelenMiktar: number;
  kaynakHedefProjeNo?: string;
  genelDurumId: number;
  genelDurumMetni: string;
}

export interface GridDurumGuncelleDto {
  cekiSatiriId: number;
  projeId: number;
  yeniDurumId: number;
  gridGelenAdet?: number;
  trafoSevkAdet?: number;
  gridSevkDurumuId?: number;
  sevkMiktari?: number;
  not?: string;
}

export interface GridTopluSevkDto {
  projeId: number;
  cekiSatiriIdler: number[];
  not?: string;
}
