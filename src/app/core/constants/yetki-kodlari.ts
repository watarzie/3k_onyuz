/**
 * Backend 3K.Core/Constants/YetkiKodlari.cs ile bire bir menü/işlem/alan kodları.
 * Bütün kodlar aynı N/R/W modeliyle değerlendirilir: R görüntüleme, W işlem.
 * Üst düğüm alt düğümün tavanıdır; üst W alt izni kendiliğinden vermez.
 */
export const YETKI = {
  DASHBOARD: 'dashboard',
  DEPO_DURUMU: 'depo-durumu',
  HAREKET_GECMISI: 'hareket-gecmisi',
  KULLANICILAR: 'kullanicilar',
  ROL_YONETIMI: 'rol-yonetimi',
  PROJE: {
    KOK: 'projeler',
    AKTIF_PROJELER: 'aktif-projeler',
    SEVK_EDILEN: 'sevk-edilen',
    /** Sevkiyatlar sayfası: tır seferleri ve sevkiyat istatistikleri (R). */
    SEVKIYATLAR: 'sevkiyatlar',
    SEVK_ET: 'proje-sevk-et',
    SIL: 'proje-sil',
    CEKI_YUKLE: 'ceki-yukle',
    PLANLANAN_SEVK_TARIHI: 'planlanan-sevk-tarihi',
    /** Proje fotoğraf bağlantısı; bütün proje listelerinde aynı kod: R görür ve açar, W ekler/düzenler/kaldırır. */
    FOTOGRAF_BAGLANTISI: 'proje-fotograf-baglantisi',
  },
  SANDIK: {
    YONETIMI: 'sandik-yonetimi',
    GRID_MODULU: 'grid-modulu',
    UCK_MODULU: '3k-modulu',
    KALITE_MODULU: 'kalite-modulu',
    SUREC_MODULU: 'surec-modulu',
    EKSIK_RAPORU: 'eksik-raporu',
    GERCEKLESEN_CEKI_RAPORU: 'gerceklesen-ceki-raporu',
    CEKI_VERISI_DUZENLE: 'ceki-verisi-duzenle',
    CEKI_VERISI_SIL: 'ceki-verisi-sil',
    UCK_IS_LISTESI: '3k-is-listesi',
    GRID_IS_LISTESI: 'grid-is-listesi',
    /** Grid Sahası: Grid'e gelmiş ürünler ve mal kabul kayıtları; proje tipinden bağımsız salt görüntüleme (R). */
    GRID_SAHA_GORUNUMU: 'grid-saha-gorunumu',
    /** Barkodla ürün arama: bir barkodun bütün projelerdeki satırları ve raporu; proje tipinden bağımsız salt görüntüleme (R). */
    BARKOD_URUN_ARAMA: 'barkod-urun-arama',
    CEKI_REVIZYON_YUKLE: 'ceki-revizyon-yukle',
    UCK_SANDIK_DURUM_RAPORU: '3k-sandik-durum-raporu',
    LOKASYON_ATAMA: 'sandik-lokasyon-atama',
    /**
     * Sevk sonrası düzeltme (W): sevkli sandığı sevkiyat kaydı korunarak düzeltmeye açma. Proje tipinin sandık/proje
     * izniyle birlikte istenir; düzeltmedeki işlemler mevcut izinlerle yapılır.
     */
    SEVK_SONRASI_DUZELTME: 'sevk-sonrasi-duzeltme',
  },
  STOK: { KOK: 'stok', SIL: 'stok-sil' },
  SAHA: {
    YONETIMI: 'saha-yonetimi',
    GRID_MODULU: 'saha-grid-modulu',
    UCK_MODULU: 'saha-3k-modulu',
    RAPORU: 'saha-raporu',
    SANDIKLAR: 'saha-sandiklar',
    SEVK_ET: 'saha-sevk-et',
    PROJE_SIL: 'saha-proje-sil',
    SEVK_SONRASI_EKSIK_RAPORU: 'saha-sevk-sonrasi-eksik-raporu',
    UCK_SANDIK_DURUM_RAPORU: 'saha-3k-sandik-durum-raporu',
    GERCEKLESEN_CEKI_RAPORU: 'saha-gerceklesen-ceki-raporu',
    SAHAYA_AKTAR: 'sahaya-aktar',
    AKTARIM_GERI_AL: 'saha-aktarim-geri-al',
  },
  YEDEK: {
    YONETIMI: 'yedek-yonetimi',
    CEKI_YUKLE: 'yedek-ceki-yukle',
    GRID_MODULU: 'yedek-grid-modulu',
    UCK_MODULU: 'yedek-3k-modulu',
    SANDIKLAR: 'yedek-sandiklar',
    RAPORU: 'yedek-raporu',
    EKSIK_RAPORU: 'yedek-eksik-raporu',
    GERCEKLESEN_CEKI_RAPORU: 'yedek-gerceklesen-ceki-raporu',
    UCK_SANDIK_DURUM_RAPORU: 'yedek-3k-sandik-durum-raporu',
    SEVK_ET: 'yedek-sevk-et',
    PROJE_SIL: 'yedek-proje-sil',
    PLANLANAN_SEVK_TARIHI: 'yedek-planlanan-sevk-tarihi',
  },
  ONAY: { MERKEZI: 'islem-onay-merkezi', KURALLARI_YONET: 'onay-kurallari-yonet' },
} as const;

/** Sistem yöneticisi rolü kimliğiyle tanınır (backend SistemRolleri.AdminId). */
export const ADMIN_ROL_ID = 1;

export const AMBALAJ_YETKI = {
  Listele: 'ambalaj-uretim-listesi',
  KayitDuzenle: 'ambalaj-kayit-duzenle',
  RaporGoruntule: 'ambalaj-rapor-goruntule',
  M3Goruntule: 'ambalaj-m3-goruntule',
  SarfGoruntule: 'ambalaj-sarf-goruntule',
  KaynakGoruntule: 'ambalaj-kaynak-goruntule',
  DahilEt: 'ambalaj-dahil-et',
  HaricTut: 'ambalaj-haric-tut',
  DurumDuzenle: 'ambalaj-durum-duzenle',
  Iptal: 'ambalaj-iptal',
  KaynakMudahalesi: 'ambalaj-kaynak-mudahalesi',
  FormGoruntule: 'ambalaj-form-goruntule',
  FormIndir: 'ambalaj-form-indir',
  ExcelIndir: 'ambalaj-excel-indir',
  PdfIndir: 'ambalaj-pdf-indir',
  FormOlustur: 'ambalaj-form-olustur',
  FormYenidenOlustur: 'ambalaj-form-yeniden-olustur',
  UretimiTamamla: 'ambalaj-uretimi-tamamla',
  UretimiYenidenAc: 'ambalaj-uretimi-yeniden-ac',
  DurumuGeriAl: 'ambalaj-durumu-geri-al',
  KritikVeriDuzenle: 'ambalaj-kritik-veri-duzenle',
  FormSonrasiSecimDegistir: 'ambalaj-form-sonrasi-secim-degistir',
  TamamlananProjeyeEkle: 'ambalaj-tamamlanan-projeye-ekle',
  OlcuGoruntule: 'ambalaj-olcu-goruntule',
  PlanGoruntule: 'ambalaj-plan-goruntule',
  PlanOlustur: 'ambalaj-plan-olustur',
  BekleyenGoruntule: 'ambalaj-bekleyen-goruntule',
  UretimdeGoruntule: 'ambalaj-uretimde-goruntule',
  TamamlananGoruntule: 'ambalaj-tamamlanan-goruntule',
  GerceklesmeDuzelt: 'ambalaj-gerceklesme-duzelt',
  ProjeDetayGoruntule: 'ambalaj-proje-detay-goruntule',
  SandikListesiGoruntule: 'ambalaj-sandik-listesi-goruntule',
  M3RaporGoruntule: 'ambalaj-m3-rapor-goruntule',
  KayitEkle: 'ambalaj-kayit-ekle',
  KayitSil: 'ambalaj-kayit-sil',
} as const;
/**
 * Finans yetkisi yalnız sekme ve alt sekme düzeyindedir (sunucudaki YetkiKodlari.Finans): R görünen verilerin tamamını
 * (tutar, fiyat, gelir, gider, kârlılık, ölçü, m³) gösterir, W o sekmedeki bütün işlemleri yapar. İş Takibi, Tanımlar
 * ve PO/Fatura sekmelerinin alt sekmeleri vardır; sekme alt sekmenin tavanıdır. Alt işlem ve alan izni yoktur; birden
 * çok sekmede açılan ortak işlemler için ortak/finans-izinleri.ts'deki sekme kümelerine bakın.
 */
export const FINANS_YETKI = {
  Modul: 'finans-yonetimi',
  SekmePanel: 'finans-sekme-panel',
  SekmeIsTakibi: 'finans-sekme-is-takibi',
  SekmePoFatura: 'finans-sekme-po-fatura',
  SekmeGiderler: 'finans-sekme-giderler',
  SekmeGiderKategorileri: 'finans-sekme-gider-kategorileri',
  SekmeTanimlar: 'finans-sekme-tanimlar',
  SekmeRaporlar: 'finans-sekme-raporlar',
  SekmeMunferitIsler: 'finans-sekme-munferit-isler',
  /** İş Takibi alt sekmeleri: Aylık görünüm, Tüm dönemlerde ara, Bekleyen işler. */
  SekmeIsTakibiAylik: 'finans-sekme-is-takibi-aylik',
  SekmeIsTakibiArama: 'finans-sekme-is-takibi-arama',
  SekmeIsTakibiBekleyen: 'finans-sekme-is-takibi-bekleyen',
  /** İş ve Tarife Tanımları alt sekmeleri: Düzenli İşler, Ürün ve Tarifeler, Para Birimi ve Vade. */
  SekmeTanimlarDuzenli: 'finans-sekme-tanimlar-duzenli',
  SekmeTanimlarTarifeler: 'finans-sekme-tanimlar-tarifeler',
  SekmeTanimlarParaBirimi: 'finans-sekme-tanimlar-para-birimi',
  /** PO ve Faturalar alt sekmeleri: PO'lar, Faturalar. */
  SekmePoFaturaPo: 'finans-sekme-po-fatura-po',
  SekmePoFaturaFatura: 'finans-sekme-po-fatura-fatura',
  /** İş Takibi'nin üstündeki vade uyarısı (vadesi geçen/yaklaşan faturalar); yalnız R. */
  VadeUyarisi: 'finans-vade-uyarisi',
} as const;
