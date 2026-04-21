// ===== Sandik =====

export interface SandikDto {
  id: number;
  sandikNo: string;
  durumId: number;
  durumMetni: string;
  depoLokasyonId: number;
  depoLokasyonMetni: string;
  urunSayisi: number;
}

export interface SandikDetayDto {
  id: number;
  sandikNo: string;
  durumId: number;
  durumMetni: string;
  depoLokasyonId: number;
  depoLokasyonMetni: string;
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
}

export interface SandikEkleDto {
  projeId: number;
  sandikNo: string;
  tipId: number;
  depoLokasyonId: number;
}

export interface ManuelUrunEkleDto {
  projeId: number;
  sandikId: number;
  barkodNo: string;
  aciklama: string;
  istenenAdet: number;
  birim: string;
  eklemeNedeni?: string;
}

export interface UrunGuncelleDto {
  cekiSatiriId: number;
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
