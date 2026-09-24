export type FinansSekme = 'akis' | 'projeler' | 'siparisler' | 'faturalar' | 'ozel-isler' | 'duzenli-isler' | 'giderler' | 'urunler' | 'raporlar' | 'ayarlar';

export type FinansFiyatlandirmaBirimi = 1 | 2 | 3 | 4;

export interface FinansParaToplami {
  paraBirimi: string;
  netTutar: number;
  kdvTutari: number;
  toplamTutar: number;
}

export interface FinansSayfaliSonuc<T> {
  items: T[];
  toplamlar: FinansParaToplami[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface FinansListelemeRequest {
  pageNumber: number;
  pageSize: number;
  arama?: string;
  projeNo?: string;
  poNumarasi?: string;
  baslangic?: string;
  bitis?: string;
  iptalEdilenleriDahilEt?: boolean;
  projeId?: number;
  isTuru?: number;
  durum?: number;
  paraBirimi?: string;
  talepEden?: string;
  siparisDurumu?: number;
  faturaDurumu?: number;
  faturaBekleyen?: boolean;
  faturaNumarasi?: string;
  firma?: string;
  sandikCinsi?: string;
  giderKategoriId?: number;
}

export interface FinansDuzenliIsListelemeRequest {
  pageNumber: number;
  pageSize: number;
  arama?: string;
  sadeceAktif?: boolean;
}

export interface FinansUrunListelemeRequest {
  pageNumber: number;
  pageSize: number;
  arama?: string;
  sadeceAktif?: boolean;
  tarifeTarihi?: string;
}

export interface FinansDashboard {
  toplamIs: number;
  toplamSandik: number;
  toplamM3: number;
  siparisBekleyen: number;
  siparisAcik: number;
  kismiSiparis: number;
  faturaBekleyen: number;
  faturalanan: number;
  buAyOzelIs: number;
  buAyGider: number;
}

export interface FinansProjeOzet {
  projeId: number | null;
  projeNo: string;
  musteri: string;
  toplamIsAdedi: number;
  toplamSandikAdedi: number;
  toplamM3: number;
  siparisAcikM3: number;
  siparisBekleyenM3: number;
  faturalananM3: number;
  faturaBekleyenM3: number;
  sonUretimeAlmaTarihi: string;
  genelDurum: string;
  birimFiyat: number;
  paraBirimi: string;
  kdvOrani: number;
  netTutar: number;
  kdvTutari: number;
  toplamTutar: number;
  tarifeEksik: boolean;
  poNumaralari: string[];
  faturaNumaralari: string[];
  faturaBekleyenSiparisId?: number;
}

export interface FinansSiparis {
  kalemler?: FinansSiparisKalemi[];
  createdDate?: string;
  createdBy?: string;
  id: number;
  kayitNo: string;
  poNumarasi: string;
  projeNo: string;
  musteri: string;
  isTurleri: string[];
  siparisTarihi: string;
  sandikAdedi: number;
  toplamM3: number;
  faturalananM3: number;
  kalanM3: number;
  durum: number;
  faturaDurumu: number;
  belgeli: boolean;
  aciklama?: string;
  tutarlar: FinansParaToplami[];
}

export interface FinansSiparisKalemi {
  kalanFaturaNetTutar?: number | null;
  faturalananNetTutar?: number | null;
  id: number;
  isKaydiId: number;
  sandikNo: string;
  sandikAdi: string;
  isTuru: number;
  adet: number;
  m3: number;
  faturalananAdet: number;
  faturalananM3: number;
  kalanAdet: number;
  kalanM3: number;
  urunId?: number;
  urunKodu: string;
  urunAdi: string;
  fiyatlandirmaBirimi: FinansFiyatlandirmaBirimi;
  fiyatlandirmaMiktari: number;
  birimFiyat: number;
  paraBirimi: string;
  kdvOrani: number;
  netTutar: number;
  kdvTutari: number;
  toplamTutar: number;
  fiyatManuelDegistirildi: boolean;
}

export interface FinansSiparisDetay {
  ozet: FinansSiparis;
  kalemler: FinansSiparisKalemi[];
  belgeler: unknown[];
  createdDate: string;
  createdBy?: string;
}

export interface FinansFaturaOlusturRequest {
  siparisId: number;
  faturaNumarasi: string;
  faturaTarihi: string;
  aciklama: string | null;
  kalemler: { siparisKalemiId: number; adet: number; m3: number; netTutar?: number }[];
  paraBirimi?: string;
  belgeNetTutar?: number;
}

export interface FinansIsKaydi {
  sablonSurumId?: number | null;
  sablon?: import('./finans-v2.model').FinansSablon | null;
  manuelNetTutar?: number | null;
  alanDegerleri?: Record<string, string | null> | null;
  bilesenler?: import('./finans-v2.model').FinansFiyatBileseni[] | null;
  isAdi?: string;
  aciklama?: string | null;
  finansTarihi?: string;
  finansDonemi?: string;
  uretimTarihi?: string;
  kaynakBileseni?: string;
  birimFiyat?: number | null;
  fiyatlandirmaBirimi?: FinansFiyatlandirmaBirimi;
  fiyatlandirmaHazir?: boolean;
  paraBirimi?: string;
  kdvOrani?: number | null;
  netTutar?: number | null;
  siparisNetTutar?: number | null;
  faturalananNetTutar?: number | null;
  kalanSiparisNetTutar?: number | null;
  kalanFaturaNetTutar?: number | null;
  durum?: number;
  iptalEdildi?: boolean;
  id: number;
  projeId: number | null;
  projeNo: string;
  musteri: string;
  sandikNo: string;
  sandikAdi: string;
  sandikTipi?: string | null;
  boy?: number | null;
  en?: number | null;
  yukseklik?: number | null;
  icSandikSablonId?: number | null;
  isTuru: number;
  adet: number;
  birimM3: number;
  toplamM3: number;
  siparisAdedi: number;
  siparisM3: number;
  siparisBekleyenAdet: number;
  siparisBekleyenM3: number;
  faturalananAdet: number;
  faturalananM3: number;
  poNumaralari: string[];
  faturaNumaralari: string[];
  kaynakAktif: boolean;
}

export interface FinansDagitimRequest {
  netTutar?: number;
  isKaydiId: number;
  adet: number;
  m3: number;
  urunId?: number | null;
  birimFiyat?: number | null;
  paraBirimi?: string | null;
  kdvOrani?: number | null;
}

export interface FinansSiparisOlusturRequest {
  paraBirimi?: string;
  belgeNetTutar?: number;
  poNumarasi: string;
  siparisTarihi: string;
  aciklama: string | null;
  kalemler: FinansDagitimRequest[];
}

export interface FinansFatura {
  kalemler?: FinansFaturaKalemi[];
  siparisId?: number;
  tutarlar?: FinansParaToplami[];
  id: number;
  kayitNo: string;
  faturaNumarasi: string;
  faturaTarihi: string;
  poNumarasi: string;
  projeNo: string;
  isTurleri: string[];
  sandikAdedi: number;
  toplamM3: number;
  durum: number;
  belgeli: boolean;
  aciklama?: string;
}

export interface FinansOzelIs {
  id: number;
  kayitNo: string;
  isTuru: string;
  musteri: string;
  isAdi: string;
  miktar: number;
  birim: string;
  birimFiyat: number;
  paraBirimi: string;
  kdvOrani: number;
  finansKaydiId: number | null;
  isTarihi: string;
  duzenliIsId: number | null;
  poNumaralari: string[];
  faturaNumaralari: string[];
  faturaBekleyenSiparisId: number | null;
}

export interface FinansDuzenliIs {
  projeId?: number | null;
  hesaplamaYontemi?: 1 | 2 | 3 | 4 | 5;
  raporGrubu?: string;
  id: number;
  isAdi: string;
  isTuru: string;
  musteri: string;
  aciklama: string | null;
  tekrarSikligi: string;
  baslangicTarihi: string;
  bitisTarihi: string | null;
  olusturmaGunu: number;
  miktar: number;
  birim: string;
  birimFiyat: number;
  paraBirimi: string;
  kdvOrani: number;
  aktif: boolean;
}

export interface FinansDuzenliIsKaydetRequest {
  hesaplamaYontemi?: 1 | 2 | 3 | 4 | 5;
  raporGrubu?: string;
  projeId: number | null;
  isAdi: string;
  isTuru: string;
  musteri: string;
  aciklama: string | null;
  tekrarSikligi: string;
  baslangicTarihi: string;
  bitisTarihi: string | null;
  olusturmaGunu: number;
  miktar: number;
  birim: string;
  birimFiyat: number;
  paraBirimi: string;
  kdvOrani: number;
  aktif: boolean;
}

export interface FinansDonemOlusturSonuc {
  taranan: number;
  olusturulan: number;
  referansTarihi: string;
}

export interface FinansGider {
  giderKalemiId?: number | null;
  giderKalemi?: string | null;
  miktar?: number;
  birim?: string;
  birimFiyat?: number;
  finansTarihi?: string;
  finansDonemi?: string;
  belgeNo?: string;
  avansMi?: boolean;
  mahsupEdilenAvansId?: number | null;
  id: number;
  tarih: string;
  kategoriId: number;
  kategori: string;
  altKategori?: string;
  firmaVeyaKisi?: string;
  aciklama: string;
  tutar: number;
  paraBirimi: string;
  kdvDahil: boolean;
  kdvOrani: number;
  matrah: number;
  kdvTutari: number;
  toplamTutar: number;
  projeId?: number;
  projeNo: string;
  isTuru?: number;
  iptalEdildi: boolean;
  belgeSayisi: number;
}

export interface FinansGiderKategori {
  id: number;
  ad: string;
  aktif: boolean;
}

export interface FinansGiderKalemi {
  id: number;
  kategoriId: number;
  kod: string;
  ad: string;
  aktif: boolean;
  varsayilanFirmaVeyaKisi?: string | null;
  varsayilanMiktar?: number | null;
  varsayilanBirim?: string | null;
  varsayilanBirimFiyat?: number | null;
  varsayilanParaBirimi?: string | null;
  varsayilanKdvDahil?: boolean;
  varsayilanKdvOrani?: number | null;
}

export interface FinansGiderKaydetRequest {
  giderKalemiId?: number | null;
  miktar?: number;
  birim?: string;
  birimFiyat?: number;
  finansTarihi?: string;
  finansDonemi?: string;
  belgeNo?: string | null;
  avansMi?: boolean;
  mahsupEdilenAvansId?: number | null;
  tarih: string;
  kategoriId: number;
  altKategori: string | null;
  firmaVeyaKisi: string | null;
  aciklama: string;
  tutar: number;
  paraBirimi: string;
  kdvDahil: boolean;
  kdvOrani: number;
  projeId: number | null;
  isTuru: number | null;
}

export interface FinansUrunEslesmesi {
  id?: number;
  isTuru: number;
  sandikAdi: string | null;
  sandikTipi?: string | null;
  boy?: number | null;
  en?: number | null;
  yukseklik?: number | null;
  icSandikSablonId?: number | null;
  aktif?: boolean;
}

export interface FinansUrun {
  id: number;
  kod: string;
  ad: string;
  fiyatlandirmaBirimi: FinansFiyatlandirmaBirimi;
  birimFiyat: number;
  paraBirimi: string;
  kdvOrani: number;
  aktif: boolean;
  sira: number;
  eslesmeler: FinansUrunEslesmesi[];
}

export interface FinansUrunKaydetRequest {
  kod: string;
  ad: string;
  fiyatlandirmaBirimi: FinansFiyatlandirmaBirimi;
  birimFiyat: number;
  paraBirimi: string;
  kdvOrani: number;
  aktif: boolean;
  sira: number;
  eslesmeler: { isTuru: number; sandikAdi: string | null; icSandikSablonId?: number | null; sandikTipi?: string | null; boy?: number | null; en?: number | null; yukseklik?: number | null }[];
}

export interface FinansOzelIsKaydetRequest {
  talepEdenKisi?: string | null;
  talepEdenBolum?: string | null;
  isTuru: string;
  musteri: string;
  projeId: number | null;
  isAdi: string;
  aciklama: string | null;
  miktar: number;
  birim: string;
  isTarihi: string;
  hesaplamaYontemi: 1 | 2 | 3 | 4 | 5;
  raporGrubu: string;
  birimFiyat: number;
  paraBirimi: string;
  kdvOrani: number;
}

export interface FinansAylikIs {
  kaynakTuru: string;
  ozelIsId: number | null;
  projeId: number | null;
  projeBirimAnahtari: string;
  musteri: string;
  isTuru: number;
  isGrubu: string;
  projeNo: string;
  isAdi: string;
  sandikTipi: string | null;
  boy: number | null;
  en: number | null;
  yukseklik: number | null;
  uretimBaslangic: string;
  uretimBitis: string;
  sandikAdedi: number;
  miktar: number;
  birim: string;
  birimFiyat: number;
  kdvOrani: number;
  netTutar: number;
  kdvTutari: number;
  toplamTutar: number;
  paraBirimi: string;
  siparisMiktari: number;
  faturalananMiktar: number;
  siparisToplamTutar: number;
  faturalananToplamTutar: number;
  isKaydiIds: number[];
  poNumaralari: string[];
  faturaNumaralari: string[];
  durum: string;
  miktarDuzenlenebilir: boolean;
  tutarDuzenlenebilir: boolean;
  iptalEdildi: boolean;
  iptalAciklamasi: string | null;
}

export interface FinansFaturaKalemi {
  id: number;
  siparisKalemiId: number;
  isKaydiId: number;
  netTutar: number | null;
  kdvTutari: number | null;
  toplamTutar: number | null;
  paraBirimi: string;
  tutarBazli: boolean;
}

export interface FinansSiparisGuncelleRequest {
  poNumarasi: string;
  siparisTarihi: string;
  aciklama: string;
  gerekce: string;
  kalemler?: { isKaydiId: number; adet: number; m3: number; netTutar: number }[];
}

export interface FinansFaturaGuncelleRequest {
  faturaNumarasi: string;
  faturaTarihi: string;
  aciklama: string;
  gerekce: string;
  belgeMutabakatiniKoru?: boolean;
  kalemler?: { siparisKalemiId: number; adet: number; m3: number; netTutar: number }[];
}

export interface FinansAylikFinansOzeti {
  paraBirimi: string;
  toplam: number;
  siparisAcik: number;
  siparisBekleyen: number;
  faturalanan: number;
  faturaBekleyen: number;
  gider: number;
  net: number;
}

export interface FinansAylikGrupToplami {
  grup: string;
  paraBirimi: string;
  netTutar: number;
  kdvTutari: number;
  toplamTutar: number;
}

export interface FinansAylikSayfaliSonuc {
  items: FinansAylikIs[];
  finansOzeti: FinansAylikFinansOzeti[];
  grupToplamlari: FinansAylikGrupToplami[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface FinansAylikDegerRequest {
  miktar?: number;
  netBirimFiyat?: number;
}
