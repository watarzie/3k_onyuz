export interface AmbalajProjeOzetDto {
  projeId: number;
  projeNo: string;
  fbNo?: string;
  musteri: string;
  projeTipiId: number;
  projeTipiMetni: string;
  toplamSandikAdedi: number;
  olculuSandikSayisi: number;
  eksikOlculuSandikSayisi: number;
  eksikOlculuSandiklar: string[];
  toplamHacimM3: number;
  firinPartiNo?: string;
  uretimeAlinanSandikAdedi: number;
  ilaveSandikSayisi: number;
  icSandikSayisi: number;
  uretimHacimM3: number;
  projeSandiklariDurumId: UretimDurumId;
  ilaveSandiklarDurumId: UretimDurumId;
  icSandiklarDurumId: UretimDurumId;
  ilaveFirinPartiNo?: string;
  icSandikFirinPartiNo?: string;
  projeSandikSayisi: number;
  projeSandiklariHacimM3: number;
  ilaveSandiklarHacimM3: number;
  icSandiklarHacimM3: number;
}

export interface AmbalajUretimPlanDto {
  projeId: number;
  projeNo: string;
  fbNo?: string;
  musteri: string;
  projeTipiId: number;
  projeTipiMetni: string;
  firinPartiNo?: string;
  ilaveFirinPartiNo?: string;
  icSandikFirinPartiNo?: string;
  projeSandiklariDurumId: UretimDurumId;
  ilaveSandiklarDurumId: UretimDurumId;
  icSandiklarDurumId: UretimDurumId;
  kalemler: AmbalajUretimKalemDto[];
  seciliSandikAdedi: number;
  seciliHacimM3: number;
}

export interface AmbalajUretimKalemDto {
  id: number;
  kaynakSandikId?: number;
  ustKalemId?: number;
  tur: 1 | 2 | 3;
  turMetni: string;
  uretimeAlindi: boolean;
  sandikNo: string;
  ad?: string;
  sandikTipi: SandikTipi;
  adet: number;
  boy: number;
  en: number;
  yukseklik: number;
  kullanimAmaci?: string;
  talimatVeren?: string;
  aciklama?: string;
  hacimM3: number;
}

export interface AmbalajKalemKaydetRequest {
  tur: 1 | 2 | 3;
  ustKalemId?: number;
  ustKaynakSandikId?: number;
  uretimeAlindi: boolean;
  sandikNo: string;
  ad?: string;
  sandikTipi: SandikTipi;
  adet: number;
  boy: number;
  en: number;
  yukseklik: number;
  kullanimAmaci: string;
  talimatVeren: string;
  aciklama?: string;
}

export interface AmbalajIcSandikSablonDto {
  id: number;
  ad: string;
  sandikTipi: SandikTipi;
  boy: number;
  en: number;
  yukseklik: number;
}

export interface AmbalajIcSandikSablonKaydetRequest {
  ad: string;
  sandikTipi: SandikTipi;
  boy: number;
  en: number;
  yukseklik: number;
}

export interface AmbalajBagimsizSandikDto {
  id: number;
  tur: 2 | 3;
  uretimeAlindi: boolean;
  sandikNo: string;
  ad: string;
  sandikTipi: SandikTipi;
  adet: number;
  boy: number;
  en: number;
  yukseklik: number;
  kullanimAmaci?: string;
  talimatVeren?: string;
  aciklama?: string;
  hacimM3: number;
}

export type AmbalajKuyruk = 'normal' | 'saha' | 'yedek' | 'ilave' | 'ic';
export type AmbalajGrup = 1 | 2 | 3;
export type UretimDurumId = 1 | 2 | 3;
export type SandikTipi = 'Ahşap Kapalı' | 'Kafes Sandık' | 'Kontrplak Sandık';