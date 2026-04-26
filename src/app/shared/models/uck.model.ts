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
  // Parçalı karşılama (Madde 2)
  stokKarsilanan: number;
  projeKarsilanan: number;
  tedarikciKarsilanan: number;
  eksikMiktar: number;
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

export interface TopluTamGeldiDto {
  projeId: number;
  cekiSatiriIdler: number[];
  aciklama?: string;
}

export interface NotEkleDto {
  bagliReferansTipi: string;
  bagliReferansId: number;
  cekiSatiriId?: number;
  icerik: string;
  projeId: number;
}

export interface NotDto {
  id: number;
  yazanTaraf: string;
  icerik: string;
  tarih: string;
  kullaniciAdi: string;
  kullaniciBasHarf?: string;
  bagliReferansTipi: string;
  bagliReferansId: number;
}
