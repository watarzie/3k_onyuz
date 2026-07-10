/**
 * Frontend Enum'ları — Backend C# Enum'larıyla birebir eşleşir.
 * Tüm lookup tabloları int ID üzerinden yönetilir.
 * UI labelleri backend'den DTO'daki *Metni alanlarıyla gelir.
 *
 * ÖNEMLİ: Bu dosyadaki değerler veritabanı seed datası ile senkronize olmalıdır.
 */

// ===== Proje Durumu =====
export enum ProjeDurum {
  Hazirlaniyor = 1,
  Devam = 2,
  Tamamlandi = 3,
  Beklemede = 4,
  SevkEdildi = 5,
  EksikSevkEdildi = 6,
}

// ===== Sandık Durumu =====
export enum SandikDurum {
  Bos = 1,
  Hazirlaniyor = 2,
  Hazir = 3,
  Sevkedildi = 4,
}

// ===== Sandık Tipi =====
export enum SandikTipi {
  AhsapKapali = 1,
  KatlanirSandik = 2,
}

// ===== Depo Lokasyonu =====
export enum DepoLokasyon {
  Belirsiz = 1,
  UcK = 2,
  Seymen = 4,
  Grid = 5,
}

// ===== Ürün Genel Durumu =====
export enum UrunDurum {
  Bekliyor = 1,
  KismiGeldi = 2,
  Tamamlandi = 3,
  Eksik = 4,
  StoktanKarsilandi = 5,
  FBdenKarsilandi = 6,
  SonraGidecek = 7,
  SandikDegisti = 8,
  IptalVeyaPasif = 9,
  TeslimAlindi = 10,
  GeriGonderildi = 11,
  KismiTamamlandi = 12,
  Kayip = 13,
  GriddeHazir = 14,
  GriddeEksik = 15,
  Sipariste = 16,
  Gelmedi = 17,
  TrafoSevk = 18,
  BaskaProyeVerildi = 19,
  HataliUrun = 20,
  HataliUyumsuzGonderim = 21,
}

// ===== Grid Durumu =====
export enum GridDurum {
  Bekliyor = 1,
  Uretimde = 2,
  StokHazir = 3,
  SevkEdildi = 4,
  KismiSevkEdildi = 5,
  Bekletiliyor = 6,
  IptalEdildi = 7,
  TamGeldi = 8,
  EksikGeldi = 9,
  Gelmedi = 10,
  TrafoSevk = 11,
  Iptal = 12,
  Sipariste = 13,
  GridKapandi = 14,
}

// ===== 3K (UcK) Durumu =====
export enum UcKDurum {
  Bekliyor = 1,
  TamGeldi = 2,
  EksikGeldi = 3,
  Gelmedi = 4,
  Paketlendi = 5, // deprecated - artık "Tamamlandı"
  Tamamlandi = 5,
  KontrolEdildi = 6,
  IadeEdildi = 7,
  ProjedenKarsilandi = 8,
  StoktanKarsilandi = 9,
  TedarikcidenGeldi = 10,
  BaskaProyeVerildi = 11,
  GeriGonderildi = 12,
  HataliUrun = 13,
  FazlaGeldi = 14,
}

// ===== Süreç Durumu =====
export enum SurecDurum {
  Ambar = 1,
  Imalat = 2,
  Tedarik = 3,
  Tedarik3KTeslim = 4,
  Sipariste = 5,
  Tamamlandi = 6,
}

// ===== Stok Durumu =====
export enum StokDurum {
  Aktif = 1,
  Tukendi = 2,
  Rezerve = 3,
}

// ===== Geri Gönderilme Sebebi =====
export enum GeriGonderilmeSebebi {
  Tadilat = 1,
  Iptal = 2,
  ProyeGeriDonus = 3,
  HataliUrun = 4,
}

// ===== Yetki Tipi =====
export enum YetkiTipi {
  N = 1,  // Yetkisiz
  R = 2,  // Sadece okuma
  W = 3,  // Tam yetki
}

// ===== Onay Durumu =====
export enum OnayDurumu {
  Bekliyor = 1,
  Onaylandi = 2,
  Reddedildi = 3,
}

// ===== Grid Sevk Durumu (CekiSatiri.GridSevkDurumuId — internal enum) =====
export enum GridSevkDurum {
  SevkEdildi = 1,
  Bekliyor = 2,
  SevkEdilmedi = 3,
  YenidenSevkGerekli = 4,
}

export enum SevkiyatKilitAcmaTipi {
  SevkiyatKaydiKorunarakAc = 1,
  SevkiyatGeriAlinarakAc = 2,
}

// ===== Birim =====
export enum Birim {
  Adet = 1,
  Set = 2,
  Metre = 3,
  Kg = 4,
  Litre = 5,
  Takim = 6,
  Paket = 7,
  Ton = 8,
  Metrekare = 9,
  Metrekup = 10,
}

// ===== İşlem Tipi =====
export enum IslemTipi {
  CekiYuklendi = 1,
  ProjeOlusturuldu = 2,
  GridDurumGuncellendi = 3,
  GridTopluSevkEdildi = 4,
  UcKDurumGuncellendi = 5,
  UcKTeslimAlindi = 6,
  UcKTopluTeslimAlindi = 7,
  ManuelUrunEklendi = 8,
  UrunTasindi = 9,
  UrunGuncellendi = 10,
  UrunIptalEdildi = 11,
  StoktanKarsilandi = 12,
  FBDenKarsilandi = 13,
  SandikKapatildi = 14,
  TopluSandikKapatildi = 15,
  FiiliSandikDegistirildi = 16,
  SandikLokasyonGuncellendi = 17,
  SandikOtomatikHazirlandi = 18,
  ExcelIndirildi = 19,
  PDFIndirildi = 20,
  SandikOlusturuldu = 21,
  KullaniciOlusturuldu = 22,
  ProjeSevkEdildi = 23,
  SandikSevkEdildi = 24,
  SahaYedekMalzemeEklendi = 25,
  TopluDurumGuncellendi = 26,
  NotEklendi = 27,
  ManuelUrunSandikEklendi = 28,
  SandikKapandi = 29,
  UcKDurumSifirlandi = 30,
  GridDurumSifirlandi = 31,
  ManuelUrunSilindi = 32,
  SandikSilindi = 33,
}

/**
 * Status Metni → CSS badge class mapping.
 * Backend'den gelen *Metni alanı kullanılarak renk çözümlenir.
 * Böylece farklı enum'lar arasındaki ID çakışması sorun olmaz.
 */
export const STATUS_BADGE_MAP: Record<string, string> = {
  // === Yeşil (Başarılı / Tamamlandı) ===
  'TamGeldi': 'badge-success',
  'Tam Geldi': 'badge-success',
  'Sevk Adeti Tam Geldi': 'badge-success',
  'Tamamlandi': 'badge-success',
  'Paketlendi': 'badge-success',
  'KontrolEdildi': 'badge-success',
  'Aktif': 'badge-success',
  'StokHazir': 'badge-success',
  'Hazir': 'badge-success',
  'Hazır': 'badge-success',

  // === Kırmızı (Tehlike / Kayıp / İptal) ===
  'Gelmedi': 'badge-danger',
  'Kayip': 'badge-danger',
  'IptalEdildi': 'badge-danger',
  'IptalVeyaPasif': 'badge-danger',
  'Iptal': 'badge-danger',

  // === Sarı (Uyarı / Eksik) ===
  'EksikGeldi': 'badge-warning',
  'Eksik Geldi': 'badge-warning',
  'Sevk Adeti Eksik Geldi': 'badge-warning',
  'Eksik': 'badge-warning',
  'KismiSevkEdildi': 'badge-warning',
  'KismiGeldi': 'badge-warning',
  'KismiTamamlandi': 'badge-warning',
  'HataliUrun': 'badge-warning',
  'EksikSevkEdildi': 'badge-warning',

  // === Mavi (Bilgi / Devam Ediyor) ===
  'SevkEdildi': 'badge-info',
  'Sevkedildi': 'badge-info',
  'Sevk Edildi': 'badge-info',
  'Uretimde': 'badge-info',
  'Devam': 'badge-info',
  'DevamEdiyor': 'badge-info',
  'TedarikcidenGeldi': 'badge-info',

  // === Gri (Bekliyor / Pasif) ===
  'Bekliyor': 'badge-secondary',
  'Bekletiliyor': 'badge-secondary',
  'Hazirlaniyor': 'badge-secondary',
  'Hazırlanıyor': 'badge-secondary',
  'Boş': 'badge-secondary',
  'Beklemede': 'badge-secondary',

  // === Mor (Özel durum) ===
  'SonraGidecek': 'badge-purple',
  'GeriGonderildi': 'badge-purple',
  'IadeEdildi': 'badge-purple',
  'BaskaProyeVerildi': 'badge-purple',
  'ProjedenKarsilandi': 'badge-purple',
  'StoktanKarsilandi': 'badge-purple',

  // === Turuncu (Hatalı/Uyumsuz) ===
  'HataliUyumsuzGonderim': 'badge-warning',

  // === Kapanı ===
  'Kapandi': 'badge-success',
  'Grid Kapandı': 'badge-dark',
  'GridKapandi': 'badge-dark',
  'Siparişte': 'badge-purple',
  'Tamamlandı': 'badge-success',
};
