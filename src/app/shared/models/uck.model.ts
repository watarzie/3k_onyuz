// ===== 3K (UcK) =====

export interface UcKUrunDto {
  cekiSatiriId: number;
  sandikIcerikId?: number;
  isSahaManuelSandikIcerigi?: boolean;
  siraNo: number;
  barkodNo: string;
  olcuResmiPozNo?: string;
  aciklama: string;
  sandikNo: string;
  sandikDurumId?: number;
  sandikDurumMetni?: string;
  sandikSevkEdildiMi: boolean;
  istenenAdet: number;
  birimId: number;
  birim: string;
  gridDurumuId: number;
  gridDurumuMetni: string;
  gridGelenAdet: number;
  trafoSevkAdet: number;
  gridSevkDurumuId: number;
  gridSevkDurumuMetni: string;
  gridSevkMiktari?: number;
  ucKKarsilamaTipiId: number;
  ucKKarsilamaTipiMetni: string;
  gelenMiktar: number;
  karsilananMiktar: number;
  hataliMiktar: number;
  kaynakHedefProjeNo?: string;
  geriGonderilmeSebebiId?: number;
  geriGonderilmeSebebiMetni?: string;
  geriGonderilenMiktar: number;
  ucKAciklama?: string;
  // Çapraz açıklama: Grid tarafının açıklaması (3K tarafı görür)
  gridAciklama?: string;
  // Parçalı karşılama (Madde 2)
  stokKarsilanan: number;
  projeKarsilanan: number;
  projeGonderilen: number;
  netKullanilabilir: number;
  transferZinciriVar: boolean;
  transferZinciri: ProjeTransferZincirDto[];
  tedarikciKarsilanan: number;
  eksikMiktar: number;
  kalan: number;
  kontrolUyari: string;
  genelDurumId: number;
  genelDurumMetni: string;
  // Kalite & Süreç (read-only)
  kaliteDurumId?: number;
  kaliteDurumMetni?: string;
  surecDurumId?: number;
  surecDurumMetni?: string;
  isManuelEklenen: boolean;
}

export interface ProjeTransferZincirDto {
  id: number;
  yon: string;
  kaynakProjeNo: string;
  hedefProjeNo: string;
  barkodNo: string;
  urunAdi: string;
  miktar: number;
  transferTipi: string;
  durum: string;
  parentTransferId?: number;
  rootTransferId?: number;
  zincirSeviyesi: number;
  aciklama?: string;
  tarih: string;
}

export interface UcKIsListesiDto {
  toplam: number;
  teslimBekleyen: number;
  eksikGelen: number;
  trafoSevk: number;
  yenidenSevkGerekli: number;
  gridKapandi: number;
  bugunGridIslemi: number;
  liste: UcKPagedResultDto<UcKIsListesiItemDto>;
}

export interface UcKPagedResultDto<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface UcKIsListesiItemDto {
  cekiSatiriId: number;
  projeId: number;
  projeNo: string;
  musteri: string;
  sandikNo?: string;
  siraNo: number;
  barkodNo: string;
  olcuResmiPozNo?: string;
  aciklama: string;
  birim: string;
  istenenAdet: number;
  gridGelenAdet: number;
  gridSevkMiktari: number;
  trafoSevkAdet: number;
  yenidenSevkGerekliAdet: number;
  ucKGelenMiktar: number;
  kalanMiktar: number;
  gridDurumuId: number;
  gridDurumuMetni: string;
  gridSevkDurumuId: number;
  gridSevkDurumuMetni: string;
  ucKDurumuId: number;
  ucKDurumuMetni: string;
  gridAciklama?: string;
  gridSevkTarihi?: string;
  sonIslemTarihi?: string;
  isTipi: string;
  isTipiMetni: string;
  oncelik: number;
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
  stogaAktar?: boolean;
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

export interface UcKDurumSifirlaDto {
  cekiSatiriId: number;
  projeId: number;
  aciklama?: string;
}
