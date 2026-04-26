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
  Proje = 1,
  Yedek = 2,
  Saha = 3,
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
}

// ===== 3K (UcK) Durumu =====
export enum UcKDurum {
  Bekliyor = 1,
  TamGeldi = 2,
  EksikGeldi = 3,
  Gelmedi = 4,
  Paketlendi = 5,
  KontrolEdildi = 6,
  IadeEdildi = 7,
  ProjedenKarsilandi = 8,
  StoktanKarsilandi = 9,
  TedarikcidenGeldi = 10,
  // BaskaProyeVerildi = 11, -- kaldırıldı
  GeriGonderildi = 12,
  HataliUrun = 13,
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
  SandikOlusturuldu = 2,
  SandikBolundu = 3,
  SandikDegisti = 4,
  UrunTasindi = 5,
  FBTransferi = 6,
  StokKullanimi = 7,
  EksikKapatildi = 8,
  PDFAlindi = 9,
  MailGonderildi = 10,
  UrunGuncellendi = 11,
  KullaniciOlusturuldu = 12,
  ProjeOlusturuldu = 13,
}

/**
 * Status Metni → CSS badge class mapping.
 * Backend'den gelen *Metni alanı kullanılarak renk çözümlenir.
 * Böylece farklı enum'lar arasındaki ID çakışması sorun olmaz.
 */
export const STATUS_BADGE_MAP: Record<string, string> = {
  // === Yeşil (Başarılı / Tamamlandı) ===
  'TamGeldi': 'badge-success',
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
};

