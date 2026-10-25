import { FinansIsKategorisi, FinansKarsilanma, FinansOdemeDurumu, FinansPoOnayDurumu, FinansOdemeFiltresi, FinansSandikMalzemesi } from '../../core/constants/enums';

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
  faturalamaBekleyen?: boolean;
  siparisKarsilanma?: FinansKarsilanma;
  faturaKarsilanma?: FinansKarsilanma;
  /** Çoklu kategori filtresi; sunucuya `kategoriler=1&kategoriler=3` olarak gider. */
  kategoriler?: FinansIsKategorisi[];
  /** Fatura listesi ödeme/vade filtresi (D3). */
  odemeDurumu?: FinansOdemeFiltresi;
  /** Sandık no içinde geçen metin (sunucuda büyük/küçük harf duyarsız). */
  sandikNo?: string;
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

/** Sunucudaki FinansSiparisDurumu: 1 Açık, 2 Kısmi faturalandı, 3 Faturalandı, 4 İptal edildi. */
export type FinansSiparisDurumu = 1 | 2 | 3 | 4;

/** PO'nun tek para birimindeki sipariş, faturalanan, gider ve net sonucu (tutarlar çevrilmez). */
export interface FinansPoNet {
  paraBirimi: string;
  siparisNetTutar: number | null;
  faturalananNetTutar: number | null;
  gider: number | null;
  net: number | null;
  tahminiKar: number | null;
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
  toplamM3: number | null;
  faturalananM3: number | null;
  kalanM3: number | null;
  durum: FinansSiparisDurumu;
  aciklama?: string;
  paraBirimi?: string | null;
  tutarlar: FinansParaToplami[];
  /** Aktif faturalardaki faturalanan tutarlar (para birimi bazında). */
  faturalananTutarlar?: FinansParaToplami[];
  /** PO ile ilişkilendirilmiş giderler (para birimi bazında). */
  giderler?: FinansParaToplami[];
  netler?: FinansPoNet[];
  faturaNumaralari?: string[];
  iptalEdildi?: boolean;
  iptalAciklamasi?: string | null;
}

export interface FinansSiparisKalemi {
  kalanFaturaNetTutar?: number | null;
  faturalananNetTutar?: number | null;
  id: number;
  isKaydiId: number;
  projeId?: number | null;
  projeNo?: string;
  musteri?: string;
  isAdi?: string;
  kategori?: FinansIsKategorisi;
  duzenliIsId?: number | null;
  finansTarihi?: string;
  /** İşin bütün PO'lar için toplam net bedeli. */
  isBedeli?: number | null;
  /** İşin henüz hiçbir PO'ya bağlanmamış net tutarı. */
  kalanSiparisNetTutar?: number | null;
  tutarBazli?: boolean;
  finansUrunId?: number | null;
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
  /** PO'nun proje × kategori grubuna girilen fatura net tutarı; sunucu grubun kalemlerine dağıtır. */
  gruplar?: FinansFaturaGrupKalemi[];
  paraBirimi?: string;
  belgeNetTutar?: number;
  /** Boşsa sunucu fatura tarihi + varsayılan vade günü uygular (D3). */
  vadeTarihi?: string | null;
}

export interface FinansFaturaGrupKalemi {
  siparisKalemiIds: number[];
  netTutar: number;
}

export interface FinansIsKaydi {
  /** Ahşap/kontra m³ "Hacim" bölümünden elle girildi; üretim aktarımı ezmez. */
  hacimManuel?: boolean;
  /** Sandık malzemesi (1 ahşap, 2 kontra, 0 bilinmiyor; katlanır sandıkta 0); hacim girişinin biçimini belirler. */
  sandikMalzemesi?: FinansSandikMalzemesi | 0;
  /**
   * Katlanır sandık: fiyat tarifeden ve m³'ten hesaplanmaz, elle girilir (adet × birim fiyat veya net toplam). Ekran m³
   * yöntemini ve hacim girişini kapatır; sunucudaki FinansKatlanirKurali ile aynı.
   */
  elleFiyatlanir?: boolean;
  manuelNetTutar?: number | null;
  bilesenler?: import('./finans-v2.model').FinansFiyatBileseni[] | null;
  isAdi?: string;
  aciklama?: string | null;
  finansTarihi?: string;
  finansDonemi?: string;
  uretimTarihi?: string;
  /** Kaynak bileşeni: sandığın kendi satırı "NET", sarf kereste payı "SARF". */
  kaynakBileseni?: string;
  /** Kaydın kaynağı (ör. AMBALAJURETIM, Manuel, OzelIs) ve kaynak kaydın kimliği (üretim iş akışı). */
  kaynakTuru?: string;
  kaynakKayitId?: string | null;
  ozelIsTuru?: string | null;
  raporGrubu?: string | null;
  birimFiyat?: number | null;
  /** Malzemeli fiyatta ahşap m³ fiyatı; doluysa birimFiyat kontra m³ fiyatıdır (net = kontra × birimFiyat + ahşap × bu). */
  ahsapBirimFiyat?: number | null;
  ahsapFinansUrunId?: number | null;
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
  kategori?: FinansIsKategorisi;
  duzenliIsId?: number | null;
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
  /** Miktar birimi (Adet, m³, Hizmet…). */
  birim?: string;
  birimM3: number;
  toplamM3: number;
  /** Ahşap ve kontra m³ payı (F11); m³ izni yoksa sunucudan null gelir. */
  ahsapM3?: number | null;
  kontraM3?: number | null;
  siparisAdedi: number;
  siparisM3: number;
  siparisBekleyenAdet: number;
  siparisBekleyenM3: number;
  faturalananAdet: number;
  faturalananM3: number;
  poNumaralari: string[];
  faturaNumaralari: string[];
  kaynakAktif: boolean;
  /** PO öncesi onay durumu (liste, seçim ve detay uçlarında dolu). */
  poOnayDurumu?: FinansPoOnayDurumu;
  poOnayAciklamasi?: string | null;
  poOnayTarihi?: string | null;
}

/** Münferit iş formunun ürün seçeneği; fiyat taşımaz (kayıt ürünün iş tarihindeki tarifesiyle fiyatlanır). */
/** Münferit iş tarife seçeneği; fiyat alanları istenen iş tarihindeki tarife sürümüdür (yoksa null). */
export interface FinansUrunSecenegi {
  id: number;
  kod: string;
  ad: string;
  fiyatlandirmaBirimi: FinansFiyatlandirmaBirimi;
  birimFiyat?: number | null;
  paraBirimi?: string | null;
  kdvOrani?: number | null;
}

/**
 * "Yeni Münferit İş" isteği: tarife + proje (sistem projesi ya da serbest ad, biri) + tarih + miktar. İş adı tarifenin
 * adıdır, fiyat tarifeden gelir; adet tarifesinde adet, m³ tarifesinde ahşap/kontra m³ gönderilir.
 */
export interface FinansMunferitIsKaydetRequest {
  finansUrunId: number;
  projeId?: number | null;
  projeAdi?: string | null;
  isTarihi: string;
  adet?: number;
  ahsapM3?: number | null;
  kontraM3?: number | null;
}

/** İş Takibi proje → sandık kırılımı isteği: proje kimliği ya da sisteme bağlı olmayan proje için no + müşteri. */
export interface FinansSandikKirilimiRequest {
  projeId?: number | null;
  projeNo?: string;
  musteri?: string;
  yil?: number;
  ay?: number;
  iptalEdilenleriDahilEt?: boolean;
  sandikNo?: string;
}

/** Sandığın altındaki iş kaydı; sarf kereste payı kaynakBileseni = "SARF" ile ayrılır. */
export interface FinansSandikKirilimKalemi {
  id: number;
  isTuru: number;
  kategori: FinansIsKategorisi;
  kaynakBileseni: string;
  isAdi: string;
  finansTarihi: string;
  adet: number;
  toplamM3: number | null;
  ahsapM3: number | null;
  kontraM3: number | null;
  paraBirimi: string;
  netTutar: number | null;
  siparisNetTutar: number | null;
  faturalananNetTutar: number | null;
  durum: number;
  aktif: boolean;
  poNumaralari: string[];
  faturaNumaralari: string[];
}

/** Bir sandığın özeti: tutarlar NET + SARF, adet ve m³ yalnız sandığın kendi kayıtları; durum en düşük iş durumu. */
export interface FinansSandikKirilimSatiri {
  anahtar: string;
  sandikNo: string | null;
  sandikAdi: string | null;
  sandikTipi: string | null;
  sandikCinsi: number | null;
  sandikMalzemesi: FinansSandikMalzemesi | 0;
  kayitSayisi: number;
  fiyatBekleyenKayitSayisi: number;
  adet: number;
  toplamM3: number | null;
  ahsapM3: number | null;
  kontraM3: number | null;
  paraBirimi: string;
  netTutar: number | null;
  siparisNetTutar: number | null;
  faturalananNetTutar: number | null;
  durum: number;
  ilkTarih: string;
  sonTarih: string;
  poNumaralari: string[];
  faturaNumaralari: string[];
  kayitlar: FinansSandikKirilimKalemi[];
}

export interface FinansProjeSandikKirilimi {
  projeId: number | null;
  projeNo: string;
  musteri: string;
  kayitSayisi: number;
  sandiklar: FinansSandikKirilimSatiri[];
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

/** Proje × kategori (veya düzenli iş) grubuna girilen PO tutarı; sunucu grubun kalemlerine dağıtır. */
export interface FinansSiparisGrupDagitimi {
  isKaydiIds: number[];
  netTutar: number;
}

/** Doğrudan girilen PO; belge yüklemesi gerektirmez, PDF sonradan isteğe bağlı eklenir. */
export interface FinansSiparisOlusturRequest {
  paraBirimi?: string;
  belgeNetTutar?: number;
  poNumarasi: string;
  siparisTarihi: string;
  aciklama: string | null;
  kalemler: FinansDagitimRequest[];
  gruplar?: FinansSiparisGrupDagitimi[];
}

/** Mevcut aktif PO'ya yeni iş kalemi veya aynı işe ek tutar bağlama isteği. */
export interface FinansSiparisKalemEkleRequest {
  kalemler?: FinansDagitimRequest[];
  gruplar?: FinansSiparisGrupDagitimi[];
}

/** PO açma ekranındaki proje × kategori / düzenli iş seçicisinin filtresi. */
export interface FinansSiparisGrupFiltre {
  pageNumber: number;
  pageSize: number;
  arama?: string;
  kategoriler?: FinansIsKategorisi[];
  baslangic?: string;
  bitis?: string;
  paraBirimi?: string;
  projeId?: number;
  isKaydiIds?: number[];
  sadeceSiparisBekleyen?: boolean;
  /** Yalnız bu düzenli işin dönemleri. */
  duzenliIsId?: number;
}

/**
 * PO'ya bağlanabilecek grup: üretim işleri proje × kategori × para birimi, düzenli işler iş × para birimi,
 * özel işler tek iş olarak gruplanır. `isKaydiIds` sunucunun dağıtım sırasıdır.
 */
export interface FinansSiparisGrubu {
  anahtar: string;
  projeId: number | null;
  projeNo: string;
  musteri: string;
  kategori: FinansIsKategorisi;
  isTuru: number;
  duzenliIsId: number | null;
  ad: string;
  paraBirimi: string;
  ilkTarih: string;
  sonTarih: string;
  kalemSayisi: number;
  isKaydiIds: number[];
  netTutar: number | null;
  siparisNetTutar: number | null;
  kalanSiparisNetTutar: number | null;
  faturalananNetTutar: number | null;
  ahsapM3: number | null;
  kontraM3: number | null;
  siparisKarsilanma: FinansKarsilanma;
  faturaKarsilanma: FinansKarsilanma;
  fiyatBekleyenKalem: number;
  /**
   * PO öncesi onay durumu. Kural açıkken grup aynı onay durumundaki kalemlerden oluşur; onaylı kısım ayrı satırdır.
   * Eski sunucu yanıtında yoksa onay aranmıyor sayılır.
   */
  poOnayDurumu?: FinansPoOnayDurumu;
  /** Ret nedeni veya onayın düşme/uygulanamama nedeni. */
  poOnayAciklamasi?: string | null;
  /** Grup PO'ya bağlanabilir (kural kapalı, kapsam dışı veya onaylı). */
  poyaBaglanabilir?: boolean;
  /** Kural açık ve grup "Onaya gönder" ile onaya sunulabilir. */
  poOnayaGonderilebilir?: boolean;
}

/** "Onaya gönder" sonucu: grup başına talep; kural açıksa Onay Merkezi'ne düşer (202), kapalıysa hemen onaylanır. */
export interface FinansPoOnayGonderSonucu {
  talepler: { talepId: number; projeNo: string; ad: string; kalemSayisi: number; netTutar: number; paraBirimi: string }[];
  kalemSayisi: number;
  atlananKalemSayisi: number;
  onayaAlinanTalepSayisi: number;
  dogrudanOnaylananTalepSayisi: number;
}

/** Onaya sunulan kalemin onay anındaki değerleri (Onay Merkezi detayı). */
export interface FinansPoOnayKalemi {
  isKaydiId: number;
  isAdi: string;
  sandikNo: string | null;
  sandikAdi: string | null;
  sandikTipi: string | null;
  boy: number | null;
  en: number | null;
  yukseklik: number | null;
  adet: number;
  birim: string;
  toplamM3: number;
  ahsapM3: number;
  kontraM3: number;
  fiyatlandirmaBirimi: FinansFiyatlandirmaBirimi;
  birimFiyat: number;
  ahsapBirimFiyat: number | null;
  kdvOrani: number;
  netTutar: number;
  siparisNetTutar: number;
  paraBirimi: string;
  uretimTarihi: string;
  finansTarihi: string;
}

/** Onaycıya gösterilen PO öncesi iş onayı talebi: onaya sunulan görüntü ve kalemlerin şimdiki durumu. */
export interface FinansPoOnayDetay {
  talepId: number;
  onizleme: {
    projeId: number | null;
    projeNo: string;
    musteri: string;
    kategori: FinansIsKategorisi;
    kategoriAdi: string;
    paraBirimi: string;
    kalemSayisi: number;
    netTutar: number;
    kdvTutari: number;
    toplamTutar: number;
    toplamM3: number;
    ahsapM3: number;
    kontraM3: number;
    ilkFinansTarihi: string;
    sonFinansTarihi: string;
    kalemler: FinansPoOnayKalemi[];
  };
  kalemDurumlari: {
    isKaydiId: number;
    guncelNetTutar: number | null;
    guncelParaBirimi: string | null;
    degisti: boolean;
    degisiklik: string | null;
  }[];
  degisenKalemSayisi: number;
  uygulamaTarihi: string | null;
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
  toplamM3: number | null;
  /** Sunucudaki FinansFaturaDurumu: 1 Aktif, 2 İptal edildi. */
  durum: number;
  aciklama?: string;
  iptalEdildi?: boolean;
  /** Vade ve tahsilat (D3): ödeme dışarıdan gelir, kullanıcı ödendi olarak işaretler. */
  vadeTarihi?: string;
  odendiMi?: boolean;
  odemeTarihi?: string | null;
  odemeAciklamasi?: string | null;
  odemeDurumu?: FinansOdemeDurumu;
  /** Ödenmemişte vadeye kalan gün (negatif: gecikme); ödenende vadeden kaç gün sonra ödendiği. */
  vadeFarkiGun?: number;
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

export interface FinansGider {
  /** Giderin ilişkilendirildiği PO; PO net sonucuna katılır. */
  finansSiparisId?: number | null;
  poNumarasi?: string | null;
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
  finansSiparisId?: number | null;
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
  icSandikSablonId?: number | null;
  /**
   * Malzemeli m³ tarifesi (1 ahşap, 2 kontra; boş = genel tek m³ tarifesi). Kontrplak sandıkta ahşap m³
   * ahşap, kontra m³ kontra tarifesiyle fiyatlanır. Katlanır sandık tarifeyle eşleşmez, elle fiyatlanır.
   */
  malzeme?: FinansSandikMalzemesi | null;
  aktif?: boolean;
}

/** Tarife sürümü; fiyat değişikliği eski sürümü kapatıp yenisini açar, geçmiş değişmez. */
export interface FinansTarifeSurumu {
  id: number;
  gecerlilikBaslangici: string;
  gecerlilikBitisi: string;
  birimFiyat: number | null;
  paraBirimi: string;
  kdvOrani: number | null;
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
  /** İstenen tarihte (varsayılan bugün) geçerli tarifenin fiyatı; tarife yoksa veya izin yoksa null. */
  guncelBirimFiyat?: number | null;
  guncelParaBirimi?: string | null;
  /** Bugün geçerli tarife sürümünün başlangıç ve bitişi. */
  guncelGecerlilikBaslangici?: string | null;
  guncelGecerlilikBitisi?: string | null;
  /** Aktif tarife sürümleri (eski → yeni). */
  tarifeler?: FinansTarifeSurumu[];
}

export interface FinansUrunKaydetRequest {
  kod: string;
  ad: string;
  fiyatlandirmaBirimi: FinansFiyatlandirmaBirimi;
  birimFiyat: number;
  paraBirimi: string;
  kdvOrani: number;
  /** Yeni fiyatın geçerli olacağı ilk gün; boşsa bugün. */
  gecerlilikBaslangici?: string | null;
  aktif: boolean;
  sira: number;
  eslesmeler: { id?: number | null; aktif: boolean; isTuru: number; sandikAdi: string | null; icSandikSablonId?: number | null; sandikTipi?: string | null; malzeme?: FinansSandikMalzemesi | null }[];
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
  /** m³ yönteminde zorunlu; birim m³ = (ahşap + kontra) / miktar. */
  ahsapM3?: number | null;
  kontraM3?: number | null;
}

/** Kayıt detayındaki "Hacim" bölümünün isteği. */
export interface FinansHacimGirRequest {
  ahsapM3: number;
  kontraM3: number;
  /** İsteğe bağlı gerekçe. */
  aciklama?: string;
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
  /** Malzemeli fiyatta ahşap m³ fiyatı (birimFiyat kontra m³ fiyatıdır). */
  ahsapBirimFiyat?: number | null;
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
  kategori?: FinansIsKategorisi;
  siparisKarsilanma?: FinansKarsilanma;
  faturaKarsilanma?: FinansKarsilanma;
  ahsapM3?: number | null;
  kontraM3?: number | null;
  kalanSiparisNetTutar?: number | null;
  kalanFaturaNetTutar?: number | null;
  /** Satırın kalemlerinden birleşik PO öncesi onay durumu. */
  poOnayDurumu?: FinansPoOnayDurumu;
  /** Onay kapsamındaki aktif kalem sayısı ve bunlardan onayı geçerli olanlar. */
  poOnayGerekliKalemSayisi?: number;
  poOnayliKalemSayisi?: number;
  poOnayAciklamasi?: string | null;
}

/** Projenin tek para birimindeki net bedel, siparişe bağlanan ve faturalanan net tutarı. */
export interface FinansProjeTutari {
  paraBirimi: string;
  netTutar: number | null;
  siparisNetTutar: number | null;
  faturalananNetTutar: number | null;
}

/** Aylık görünümde projenin bütün aktif kalemlerinden türetilen birleşik sipariş/fatura durumu (F7). */
export interface FinansAylikProjeOzeti {
  projeBirimAnahtari: string;
  projeId: number | null;
  projeNo: string;
  musteri: string;
  siparisKarsilanma: FinansKarsilanma;
  faturaKarsilanma: FinansKarsilanma;
  /** Sunucudaki FinansIsDurumu: 1 Sipariş bekliyor … 5 Faturalandı. */
  durum: number;
  gerekliKalem: number;
  fiyatBekleyenKalem: number;
  ahsapM3: number | null;
  kontraM3: number | null;
  tutarlar: FinansProjeTutari[];
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
  projeNo?: string;
  isAdi?: string;
  kategori?: FinansIsKategorisi;
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
  vadeTarihi?: string | null;
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
  /** Sayfadaki proje birimlerinin (özel işler hariç) birleşik sipariş/fatura durumu. */
  projeler?: FinansAylikProjeOzeti[];
  /** Sayfadaki projelere bağlı özel/düzenli işler; proje bloğunun "Özel / Düzenli" alt grubunda da gösterilir. */
  projeOzelIsleri?: FinansAylikIs[];
  finansOzeti: FinansAylikFinansOzeti[];
  grupToplamlari: FinansAylikGrupToplami[];
  /** PO öncesi iş onayı kuralı açık mı; kapalıyken PO onay aramaz ve "Onaya gönder" gösterilmez. */
  poOnayKuraliAcik?: boolean;
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

/** Düzenli iş dönem üretimi sonucu. */
export interface FinansDonemOlusturSonuc {
  taranan: number;
  olusturulan: number;
  referansTarihi: string;
  hatalar?: string[];
}
