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

export interface AmbalajPlanlamaProjeFiltreOzetiDto {
  projeSayisi: number;
  toplamSandikAdedi: number;
  toplamHacimM3: number;
  eksikOlculuProjeSayisi: number;
}

export interface AmbalajPlanlamaProjeleriSayfasiDto {
  items: AmbalajProjeOzetDto[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasPreviousPage?: boolean;
  hasNextPage?: boolean;
  filteredSummary?: AmbalajPlanlamaProjeFiltreOzetiDto | null;
}

export interface AmbalajProjeListelemeRequest {
  arama?: string;
  projeTipiId?: number;
  grup: AmbalajGrup;
  pageNumber: number;
  pageSize: number;
  includeSummary?: boolean;
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
  icSandikSablonId?: number;
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
  ambalajaDahilMi: boolean | null;
  ambalajKarariOneriliyor: boolean;
}

export interface AmbalajKalemKaydetRequest {
  tur: 1 | 2 | 3;
  ustKalemId?: number;
  ustKaynakSandikId?: number;
  icSandikSablonId?: number;
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

export interface AmbalajTalepEdenDto {
  id: number;
  ad: string;
}

export interface AmbalajKullaniciSecenegiDto {
  id: number;
  adSoyad: string;
}

export interface AmbalajIlaveSandikAdayDto {
  id: number;
  sandikNo: string;
  ad?: string;
  boy?: number;
  en?: number;
  yukseklik?: number;
}

export interface AmbalajSandikSecenegiDto {
  id: number;
  sandikNo: string;
  ad?: string;
  boy?: number;
  en?: number;
  yukseklik?: number;
}

export interface AmbalajBagimsizSandikDto {
  id: number;
  tur: OzelSandikTur;
  turMetni: string;
  projeId?: number;
  projeNo?: string;
  musteri?: string;
  kaynakSandikId?: number;
  kaynakSandikNo?: string;
  kaynakSandikAdi?: string;
  ustKaynakSandikId?: number;
  icSandikSablonId?: number;
  ustSandikNo?: string;
  ustSandikAdi?: string;
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

export interface AmbalajBagimsizSandikTurOzetiDto {
  tur: OzelSandikTur;
  kayitSayisi: number;
  toplamSandikAdedi: number;
  toplamHacimM3: number;
}

export interface AmbalajBagimsizSandikFiltreOzetiDto {
  kayitSayisi: number;
  toplamSandikAdedi: number;
  uretimeAlinanSandikAdedi: number;
  toplamHacimM3: number;
  turOzetleri: AmbalajBagimsizSandikTurOzetiDto[];
}

export interface AmbalajBagimsizSandiklarSayfasiDto {
  items: AmbalajBagimsizSandikDto[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasPreviousPage?: boolean;
  hasNextPage?: boolean;
  filteredSummary?: AmbalajBagimsizSandikFiltreOzetiDto | null;
}

export interface AmbalajBagimsizSandikListelemeRequest {
  arama?: string;
  tur?: OzelSandikTur;
  pageNumber: number;
  pageSize: number;
  includeSummary?: boolean;
}

export interface AmbalajOzelSandikKaydetRequest {
  tur: OzelSandikTur;
  projeId: number;
  kaynakSandikId?: number;
  ustKaynakSandikId?: number;
  icSandikSablonId?: number;
  uretimeAlindi: boolean;
  sandikNo: string;
  ad?: string;
  sandikTipi: SandikTipi;
  adet: number;
  boy: number;
  en: number;
  yukseklik: number;
  talimatVeren: string;
  aciklama?: string;
}

export type AmbalajKuyruk = 'normal' | 'ozel' | 'saha' | 'yedek' | 'ilave' | 'ic';
export type OzelSandikTur = 2 | 3 | 4 | 5;
export type AmbalajGrup = 1 | 2 | 3;
export type UretimDurumId = 1 | 2 | 3;
export type SandikTipi = 'Ahşap Kapalı' | 'Kafes Sandık' | 'Kontrplak Sandık' | 'Katlanır Sandık';
