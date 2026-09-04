export type FinansSekme = 'akis' | 'projeler' | 'siparisler' | 'faturalar' | 'ozel-isler' | 'duzenli-isler' | 'giderler' | 'urunler' | 'raporlar' | 'ayarlar';

export type FinansFiyatlandirmaBirimi = 1 | 2;

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
  kalemler: { siparisKalemiId: number; adet: number; m3: number }[];
}

export interface FinansIsKaydi {
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
  isKaydiId: number;
  adet: number;
  m3: number;
  urunId?: number | null;
  birimFiyat?: number | null;
  paraBirimi?: string | null;
  kdvOrani?: number | null;
}

export interface FinansSiparisOlusturRequest {
  poNumarasi: string;
  siparisTarihi: string;
  aciklama: string | null;
  kalemler: FinansDagitimRequest[];
}

export interface FinansFatura {
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

export interface FinansGiderKaydetRequest {
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
  isTuru: string;
  musteri: string;
  projeId: number | null;
  isAdi: string;
  aciklama: string | null;
  miktar: number;
  birim: string;
  isTarihi: string;
  hesaplamaYontemi: 1 | 2 | 3;
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
