// ===== 3K (UcK) =====

export interface UcKUrunDto {
  cekiSatiriId: number;
  siraNo: number;
  barkodNo: string;
  aciklama: string;
  sandikNo: string;
  istenenAdet: number;
  birim: string;
  gridDurumu: string;
  gridGelenAdet: number;
  trafoSevkAdet: number;
  ucKKarsilamaTipi: string;
  gelenMiktar: number;
  karsilananMiktar: number;
  hataliMiktar: number;
  kaynakHedefProjeNo?: string;
  geriGonderilmeSebebi?: string;
  ucKAciklama?: string;
  ucKNotu?: string;
  kalan: number;
  kontrolUyari: string;
  genelDurum: string;
}

export interface UcKDurumGuncelleDto {
  cekiSatiriId: number;
  projeId: number;
  karsilamaTipi: string;
  gelenAdet?: number;
  kaynakHedefProjeNo?: string;
  kaynakCekiSatiriId?: number;
  stokKaydiId?: number;
  aciklama?: string;
  geriGonderilmeSebebi?: string;
  not?: string;
}
