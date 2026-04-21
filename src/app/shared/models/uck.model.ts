// ===== 3K (UcK) =====

export interface UcKUrunDto {
  cekiSatiriId: number;
  siraNo: number;
  barkodNo: string;
  aciklama: string;
  sandikNo: string;
  istenenAdet: number;
  birim: string;
  gridDurumuId: number;
  gridDurumuMetni: string;
  gridGelenAdet: number;
  trafoSevkAdet: number;
  gridSevkDurumuId: number;
  gridSevkDurumuMetni: string;
  ucKKarsilamaTipiId: number;
  ucKKarsilamaTipiMetni: string;
  gelenMiktar: number;
  karsilananMiktar: number;
  hataliMiktar: number;
  kaynakHedefProjeNo?: string;
  geriGonderilmeSebebiId?: number;
  geriGonderilmeSebebiMetni?: string;
  ucKAciklama?: string;
  ucKNotu?: string;
  kalan: number;
  kontrolUyari: string;
  genelDurumId: number;
  genelDurumMetni: string;
}

export interface UcKDurumGuncelleDto {
  cekiSatiriId: number;
  projeId: number;
  karsilamaTipiId: number;
  gelenAdet?: number;
  kaynakHedefProjeNo?: string;
  kaynakCekiSatiriId?: number;
  stokKaydiId?: number;
  aciklama?: string;
  geriGonderilmeSebebiId?: number;
  not?: string;
  urunAdi?: string;
  mevcutProjeNo?: string;
  mevcutSandikNo?: string;
  kaynakUrunAdi?: string;
}
