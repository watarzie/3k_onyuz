// ===== Sandik =====

export interface SandikDto {
  id: number;
  sandikNo: string;
  ad?: string;
  durumId: number;
  durumMetni: string;
  sevkiyatDuzeltmeAcikMi?: boolean;
  depoLokasyonId: number;
  depoLokasyonMetni: string;
  urunSayisi: number;
  isManuelSandik: boolean;
  silinebilirMi: boolean;
  depodaSayilacakMi: boolean;
  sahayaAktarildiMi?: boolean;
  sahayaAktarilanMiktar?: number;
  en?: number;
  boy?: number;
  yukseklik?: number;
  netKg?: number;
  grossKg?: number;
}

export interface SandikDetayDto {
  id: number;
  sandikNo: string;
  ad?: string;
  durumId: number;
  durumMetni: string;
  sevkiyatDuzeltmeAcikMi?: boolean;
  depoLokasyonId: number;
  depoLokasyonMetni: string;
  sahayaAktarildiMi?: boolean;
  sahayaAktarilanMiktar?: number;
  en?: number;
  boy?: number;
  yukseklik?: number;
  netKg?: number;
  grossKg?: number;
  icerikler: SandikIcerikDto[];
}

export interface SandikIcerikDto {
  id: number;
  cekiSatiriId: number;
  olcuResmiPozNo?: string;
  barkodNo: string;
  aciklama: string;
  istenenAdet: number;
  konulanAdet: number;
  eksikAdet: number;
  durumId: number;
  durumMetni: string;
  paketleyenBasHarf?: string;
  kontrolEdenBasHarf?: string;
  remarks?: string;
  isManuelEklenen: boolean;
  // Saha/Yedek
  isim?: string;
  miktar: number;
  birimId?: number;
  birimMetni?: string;
  // Parçalı karşılama (Madde 2)
  stokKarsilanan: number;
  projeKarsilanan: number;
  tedarikciKarsilanan: number;
  kaynakProjeNo?: string;
}

export interface SandikEkleDto {
  projeId: number;
  sandikNo: string;
  sandikIsmi?: string;
  tipId: number;
  depoLokasyonId: number;
  en?: number;
  boy?: number;
  yukseklik?: number;
  netKg?: number;
  grossKg?: number;
}

export interface ManuelUrunEkleDto {
  projeId: number;
  sandikId: number;
  barkodNo: string;
  aciklama: string;
  istenenAdet: number;
  birimId: number;
  eklemeNedeni?: string;
}

export interface UrunGuncelleDto {
  cekiSatiriId?: number | null;
  sandikIcerikId?: number;
  sandikId: number;
  konulanAdet?: number;
  eksikAdet?: number;
  gridDurumuId?: number;
  ucKDurumuId?: number;
  paketleyenId?: number;
  kontrolEdenId?: number;
  aciklama?: string;
  kullaniciId: number;
  projeId: number;
}

export interface SandikDegistirDto {
  cekiSatiriId: number;
  yeniFiiliSandikNo: string;
  projeId: number;
  kullaniciId: number;
}

export interface SandikOzellikGuncelleDto {
  sandikId: number;
  sandikIsmi?: string;
  en?: number;
  boy?: number;
  yukseklik?: number;
  netKg?: number;
  grossKg?: number;
  depoLokasyonId?: number;
}

export interface TeslimAlDto {
  cekiSatiriId: number;
  projeId: number;
  gelenMiktar: number;
  not?: string;
}

export interface TopluTeslimAlDto {
  projeId: number;
  urunler: { cekiSatiriId: number; gelenMiktar: number }[];
  not?: string;
}

export interface UrunIptalDto {
  cekiSatiriId: number;
  projeId: number;
  kullaniciId: number;
}

export interface EksikUrunDto {
  cekiSatiriId: number;
  siraNo: number;
  barkodNo: string;
  aciklama: string;
  istenenAdet: number;
  gelenMiktar: number;
  eksikMiktar: number;
  gridDurumuId: number;
  gridDurumuMetni: string;
  ucKDurumuId: number;
  ucKDurumuMetni: string;
  sandikNo: string;
}

export interface UrunTasiDto {
  kaynakSandikIcerikId: number;
  hedefSandikId: number;
  tasinanAdet: number;
  projeId: number;
}

export interface EksikUrunForSandikDto {
  cekiSatiriId: number;
  siraNo: number;
  barkodNo: string;
  aciklama: string;
  sandikNo: string;
  istenenAdet: number;
  gelenMiktar: number;
  kalanMiktar: number;
  tamamlamaPlanlananAdet?: number;
  birim: string;
  projeId: number;
  projeNo: string;
}

export interface CekiSatiriAnaVeriGuncelleDto {
  cekiSatiriId: number;
  siraNo: number;
  olcuResmiPozNo?: string | null;
  barkodNo: string;
  aciklama: string;
  istenenAdet: number;
  birimId: number;
  sandikNo: string;
}

export interface CekiSatirlariSilDto {
  cekiSatiriIds: number[];
}

export interface CekiSatirlariSilResultDto {
  silinenSatirSayisi: number;
  silinenSandikSayisi: number;
  silinenCekiSayisi: number;
  iadeEdilenStokHareketiSayisi: number;
  pasifeAlinanTransferSayisi: number;
}
