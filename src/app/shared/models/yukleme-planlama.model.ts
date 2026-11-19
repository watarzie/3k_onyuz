import type { AracYuklemeOturumu } from './arac-yukleme.model';

// ===== Yükleme planlama: plan, yük listesi, ekipman kitaplığı ve mevzuat kuralları =====
// Sunucu sözleşmesi: 3K.Core/Models/YuklemePlaniModelleri.cs, EkipmanKitapligiModelleri.cs, MevzuatModelleri.cs.
// Enum'lar sayı olarak taşınır; değerler sunucudaki enum'larla aynıdır.

export enum YuklemeCalismaBicimi {
  IhtiyacaGoreArac = 1,
  MevcutAraclaraYerlestirme = 2,
}

export enum YuklemeProjeKarisimi {
  Karisik = 1,
  ProjeBazindaAyri = 2,
}

export enum YuklemeLokasyonTercihi {
  HenuzSecilmedi = 1,
  LokasyonaGoreAyri = 2,
  Karisik = 3,
}

export enum PlanYukKaynagi {
  Sandik = 1,
  Manuel = 2,
}

/** Eski akışta elle değiştirilmiş izinler (bayrak; yalnız gösterim, 19.11.2026'dan beri ekranda düzenlenmez). */
export enum PlanYukIzni {
  Yok = 0,
  Dondurme = 1,
  UsteKonma = 2,
  AltaKalma = 4,
  UstYukSiniri = 8,
}

export enum PlanYukDurumu {
  HaricTutuldu = 1,
  EksikVeri = 2,
  Bekliyor = 3,
  /** Son hesapta bir araca yerleşti. */
  Yerlesti = 4,
  /** Son hesapta yerleşemedi; neden satırda. */
  Yerlesemedi = 5,
}

/** Kontrol sonucu: veri yoksa uygunluk üretilmez ("Teyit edilmedi"). */
export enum YerlesimKontrolSonucu {
  Uygun = 1,
  Uygunsuz = 2,
  TeyitEdilmedi = 3,
}

export enum YerlesimKontrolTuru {
  Agirlik = 1,
  KapidanGecis = 2,
  IcYukseklik = 3,
  YasalYukseklik = 4,
  YasalGenislik = 5,
  Tasma = 6,
  Dingil = 7,
  BaglantiYuku = 8,
  Destek = 9,
  EkipmanVerisi = 10,
  GuvenlikPayi = 11,
  Mevzuat = 12,
  Organizasyon = 13,
  ElleYerlesim = 14,
  /** Yükün ağırlık merkezinin araç ortasından boyuna ve enine sapması. */
  AgirlikDagilimi = 15,
}

/** Yükün (ya da istif grubunun) araca giriş yönü (bayrak). */
export enum YerlesimGirisYonu {
  Yok = 0,
  Arkadan = 1,
  Yandan = 2,
  Ustten = 4,
}

export enum PlanKaynakFarkTuru {
  YeniSandik = 1,
  SandikSilindi = 2,
  // 3 kullanılmıyor: sevk edilmiş sandık da plana gelir (19.11.2026).
  OlcuDegisti = 4,
  AgirlikDegisti = 5,
  LokasyonDegisti = 6,
  YukTuruDegisti = 7,
  KodDegisti = 8,
  ProjedenCikti = 9,
}

/** Sunucudaki `YukTuru` lookup kimlikleri. */
export enum YukTuru {
  Sandik = 1,
  Trafo = 2,
  DigerOzelYuk = 3,
}

export interface SecimOgesi {
  id: number;
  ad: string;
}

/**
 * Taşıma ailesinin tipi (ör. Konteyner → 40' High Cube). `otomatikSecilir`: tip seçilmeyen planda da kullanılır;
 * değilse (Reefer, Pallet Wide, frigo) yalnız açıkça seçilince.
 */
export interface TasimaTipi {
  id: number;
  aileId: number;
  ad: string;
  otomatikSecilir: boolean;
}

export interface YuklemePlaniTanimlari {
  tasimaAileleri: SecimOgesi[];
  /** Ailelerin sandık taşımaya uygun aktif tipleri; ailede sadelik sırasıyla (otomatik seçilmeyenler sonda). */
  tasimaTipleri: TasimaTipi[];
  yukTurleri: SecimOgesi[];
  lokasyonlar: SecimOgesi[];
}

export interface PlanMevcutArac {
  konfigurasyonId: number;
  adet: number;
}

export interface YuklemePlanAyarlari {
  yerlesimBosluguMm: number;
  yukseklikPayiMm: number | null;
  genislikPayiMm: number | null;
  uzunlukPayiMm: number | null;
  agirlikPayiKg: number | null;
  /** Ağırlık merkezinin araç ortasından izin verilen en fazla sapması (araç boyu/genişliğinin yüzdesi, 1–50); boşsa teyit edilmedi. */
  agirlikMerkeziSapmaYuzde?: number | null;
  yuklemeHareketiPayiMm: number | null;
  /** Mevcut araçlara yerleştirmede kullanıcının verdiği araçlar. */
  mevcutAraclar: PlanMevcutArac[];
  /**
   * Taşıma ailesinde seçilen tipler (`TasimaTipi.id`). Boşsa her yük ailede kendisini alan en sade tipe gider; seçilirse
   * normal yükler yalnız seçilen tiplere, sığmayanlar gerekçesiyle ailenin diğer tiplerine ya da lowbed'e gider.
   */
  tipIdleri: number[];
}

export interface YuklemePlaniOzeti {
  id: number;
  planNo: string;
  ad: string;
  calismaBicimi: YuklemeCalismaBicimi;
  tasimaAilesiAdi: string;
  projeler: string;
  yukSayisi: number;
  dahilYukSayisi: number;
  revizyonNo: number;
  sonKayitTarihi: string;
  sonKaydeden: string | null;
}

export interface PlanProjeBilgisi {
  projeId: number | null;
  projeNo: string;
  musteri: string | null;
  projeTipiId: number | null;
}

export interface PlanYukSatiri {
  siraNo: number;
  kaynak: PlanYukKaynagi;
  sandikId: number | null;
  manuelGrupNo: number | null;
  birimNo: number;
  birimSayisi: number;
  kod: string;
  aciklama: string | null;
  projeId: number | null;
  projeNo: string | null;
  yukTuruId: number;
  yukTuruAdi: string;
  boyMm: number | null;
  enMm: number | null;
  yukseklikMm: number | null;
  brutKg: number | null;
  lokasyonId: number | null;
  lokasyonAdi: string | null;
  dahil: boolean;
  dondurulebilirMi: boolean;
  usteKonabilirMi: boolean;
  altaKalabilirMi: boolean;
  ustYukSiniriKg: number | null;
  elleDegisenIzinler: PlanYukIzni;
  ozelTasimaNotu: string | null;
  durum: PlanYukDurumu;
  veriSorunlari: string[];
  /** Son hesapta yerleştiği araç. */
  aracNo?: number | null;
  /** Son hesapta yerleşemediyse nedeni. */
  yerlesimNotu?: string | null;
}

export interface PlanYukSayaclari {
  toplam: number;
  secilen: number;
  hesaplanabilir: number;
  veriEksik: number;
  haricTutulan: number;
  yerlesen: number;
  yerlesemeyen: number;
}

export interface PlanKaynakFarki {
  tur: PlanKaynakFarkTuru;
  sandikId: number | null;
  kod: string;
  onceki: string | null;
  guncel: string | null;
}

export interface YuklemePlaniDetayi {
  id: number;
  planNo: string;
  ad: string;
  calismaBicimi: YuklemeCalismaBicimi;
  tasimaAilesiId: number;
  tasimaAilesiAdi: string;
  projeKarisimi: YuklemeProjeKarisimi;
  lokasyonTercihi: YuklemeLokasyonTercihi;
  yuklemeTarihi: string | null;
  aciklama: string | null;
  revizyonNo: number;
  revizyonTarihi: string;
  kaydeden: string | null;
  revizyonAciklamasi: string | null;
  ayarlar: YuklemePlanAyarlari;
  projeler: PlanProjeBilgisi[];
  yukler: PlanYukSatiri[];
  sayaclar: PlanYukSayaclari;
  kaynakFarklari: PlanKaynakFarki[];
  /** Bu revizyonun yerleşimi ("Hesapla" ve elle düzenleme yerleşimli revizyon yazar). */
  yerlesim: PlanYerlesimi | null;
  /** Planlamaya dahil yüklerin farklı lokasyon sayısı (bilgi; lokasyon tercihi 19.11.2026'dan beri sorulmaz). */
  farkliLokasyonSayisi: number;
  /** Sahada süren yükleme oturumu (yoksa null); oturum başladığı revizyonla sürer, plan revize edilse de değişmez. */
  surenYukleme: AracYuklemeOturumu | null;
}

export interface PlanYukKonumu {
  yukAnahtari: string;
  kod: string;
  projeNo: string | null;
  brutKg: number;
  xMm: number;
  yMm: number;
  zMm: number;
  boyMm: number;
  enMm: number;
  yukseklikMm: number;
  donduruldu: boolean;
  yuzeyKodu: string;
  istifNo: number;
  kat: number;
  yuklemeSirasi: number;
  yuklemeYontemi: YerlesimGirisYonu;
}

export interface PlanAracKontrolu {
  tur: YerlesimKontrolTuru;
  sonuc: YerlesimKontrolSonucu;
  mesaj: string;
}

/** Elle yerleşimde eklenebilecek ekipman (araç ekleme seçicisi). */
export interface ElleEkipmanSecenegi {
  konfigurasyonId: number;
  kod: string;
  ad: string;
  tipAdi: string;
  aileAdi: string;
  aileDisi: boolean;
  ozelYukEkipmani: boolean;
  dogrulandi: boolean;
  teknikVeriJson: string;
}

export interface PlanAraci {
  aracNo: number;
  konfigurasyonId: number;
  revizyonNo: number;
  ekipmanKodu: string;
  ekipmanAdi: string;
  aileAdi: string;
  tipAdi: string;
  aileDisi: boolean;
  /** Aile dışı araç zorunlu özel yük için mi eklendi (kullanıcının mevcut araç listesinden seçtiği aile dışı araç değil). */
  zorunluOzelEkipman: boolean;
  aileDisiGerekce: string | null;
  projeNolari: string[];
  lokasyonlar: string[];
  konumlar: PlanYukKonumu[];
  toplamKg: number;
  kapasiteKg: number | null;
  tabanDolulukYuzde: number;
  agirlikMerkeziXMm: number | null;
  yukluYukseklikMm: number;
  yukluGenislikMm: number;
  yukluUzunlukMm: number;
  solTasmaMm: number;
  sagTasmaMm: number;
  onTasmaMm: number;
  arkaTasmaMm: number;
  kontroller: PlanAracKontrolu[];
  sonuc: YerlesimKontrolSonucu;
  /** Elle yerleşimde yük düzeyindeki sonuçlar (çakışma, destek, kasa sınırı…); otomatik yerleşimde boş. */
  yukSorunlari: PlanYukSorunu[];
  /** Hesapta kullanılan ekipman revizyonunun teknik verisi (3B görünüm). */
  teknikVeriJson: string;
}

export interface PlanYukSorunu {
  yukAnahtari: string;
  sonuc: YerlesimKontrolSonucu;
  mesaj: string;
}

/** Elle yerleşimde yükün konumu (ekipman koordinatları, mm); ölçü ve ağırlık sunucuda plandan alınır. */
export interface ElleKonumIstegi {
  yukAnahtari: string;
  xMm: number;
  yMm: number;
  zMm: number;
  donduruldu: boolean;
}

/** Elle yerleşimde bir araç; boş olabilir ("aynı tipten araç ekle"). */
export interface ElleAracIstegi {
  konfigurasyonId: number;
  konumlar: ElleKonumIstegi[];
}

export interface PlanYerlesemeyenYuk {
  yukAnahtari: string;
  kod: string;
  neden: string;
}

export interface PlanEkEkipmanIhtiyaci {
  konfigurasyonId: number;
  ekipmanKodu: string;
  ekipmanAdi: string;
  adet: number;
}

export interface PlanYerlesimi {
  hesapTarihi: string;
  sonuc: YerlesimKontrolSonucu;
  /** Yerleşim kullanıcı tarafından elle düzenlendi (otomatik öneri değil). */
  elleDuzenlendi: boolean;
  lokasyonaGoreAyri: boolean;
  projeBazindaAyri: boolean;
  araclar: PlanAraci[];
  yerlesemeyenler: PlanYerlesemeyenYuk[];
  ekIhtiyaclar: PlanEkEkipmanIhtiyaci[];
  uyarilar: string[];
}

export interface PlanProjeAdayi {
  projeId: number;
  projeNo: string;
  musteri: string;
  projeTipiId: number;
  projeTipiAdi: string;
  /** Projenin bütün sandıkları (sevk edilmişler dahil). */
  planaGelecekSandikSayisi: number;
}

/**
 * Tek adımlı plan hesabı: projeler, taşıma ailesi/tipleri ve paylarla plan (planId boşsa yenisi) kaynaktan kurulur ve
 * yerleşim hesaplanır. Var olan planda arada başka biri hesapladıysa 409.
 */
export interface YuklemePlaniHesaplaIstegi {
  planId: number | null;
  beklenenRevizyonNo: number | null;
  projeIdleri: number[];
  tasimaAilesiId: number;
  ayarlar: YuklemePlanAyarlari;
}

// ===== Ekipman kitaplığı =====

export enum EkipmanKategorisi {
  KapaliKonteyner = 1,
  HardtopKonteyner = 2,
  OpenTopKonteyner = 3,
  FlatRack = 4,
  PlatformKonteyner = 5,
  AcikKasa = 6,
  Platform = 7,
  UzamaliPlatform = 8,
  Tenteli = 9,
  KapaliKasa = 10,
  Frigo = 11,
  Lowbed = 12,
  AgirYukDorsesi = 13,
  ModulerAgirYuk = 14,
  KonteynerSasisi = 15,
  Damper = 16,
  HareketliTaban = 17,
  Silobas = 18,
  Tanker = 19,
  Diger = 99,
}

/** Yük alma yönü (bayrak). */
export enum YuklemeYontemi {
  Yok = 0,
  Arkadan = 1,
  Yandan = 2,
  Ustten = 4,
}

export enum EkipmanKaynakTuru {
  IsoAsgari = 1,
  TasiyiciFoyu = 2,
  UreticiFoyu = 3,
  SahadaOlculdu = 4,
  Diger = 5,
}

export enum EkipmanDogrulamaDurumu {
  Dogrulanmadi = 1,
  Dogrulandi = 2,
}

export enum EkipmanIceAktarimIslemi {
  Yeni = 1,
  YeniRevizyon = 2,
  Degismedi = 3,
}

export interface EkipmanTipiModeli {
  id: number;
  kod: string;
  ad: string;
  kategori: EkipmanKategorisi;
  yuklemeYontemleri: YuklemeYontemi;
  sandikTasimayaUygun: boolean;
  aktif: boolean;
}

export interface EkipmanAilesiModeli {
  id: number;
  kod: string;
  ad: string;
  sira: number;
  tipler: EkipmanTipiModeli[];
}

export interface EkipmanKonfigurasyonOzeti {
  id: number;
  kod: string;
  ad: string;
  aileAdi: string;
  tipAdi: string;
  kategori: EkipmanKategorisi;
  uretici: string;
  modelAdi: string;
  aktif: boolean;
  revizyonNo: number;
  dogrulamaDurumu: EkipmanDogrulamaDurumu;
  kaynakTuru: EkipmanKaynakTuru;
  kaynakTarihi: string | null;
  disUzunlukMm: number | null;
  disGenislikMm: number | null;
  disYukseklikMm: number | null;
  teknikKapasiteKg: number | null;
}

export interface EkipmanRevizyonBilgisi {
  revizyonNo: number;
  kaynakTuru: EkipmanKaynakTuru;
  kaynakAciklama: string | null;
  kaynakTarihi: string | null;
  aciklama: string | null;
  dogrulamaDurumu: EkipmanDogrulamaDurumu;
  dogrulayan: string | null;
  dogrulamaTarihi: string | null;
  olusturan: string | null;
  tarih: string;
}

export interface EkipmanKonfigurasyonDetayi {
  id: number;
  kod: string;
  ad: string;
  aktif: boolean;
  aileAdi: string;
  tipKodu: string;
  tipAdi: string;
  kategori: EkipmanKategorisi;
  yuklemeYontemleri: YuklemeYontemi;
  sandikTasimayaUygun: boolean;
  uretici: string;
  modelAdi: string;
  revizyon: EkipmanRevizyonBilgisi;
  /** Teknik veri JSON'u (`EkipmanTeknikVerisi`, camelCase, enum'lar metin). */
  teknikVeriJson: string;
  veriUyarilari: string[];
  revizyonlar: EkipmanRevizyonBilgisi[];
}

export interface EkipmanIceAktarimSatiri {
  kod: string;
  ad: string;
  /** Ad değişiyorsa eski ad (ad revizyon açmaz; teknik verisi aynı satır "Değişmedi" kalır ama adı güncellenir). */
  oncekiAd: string | null;
  tipKodu: string;
  islem: EkipmanIceAktarimIslemi;
  revizyonNo: number;
  veriUyarilari: string[];
}

export interface EkipmanIceAktarimSorunu {
  sayfa: string;
  satir: number | null;
  konfigurasyonKodu: string | null;
  mesaj: string;
}

export interface EkipmanIceAktarimSonucu {
  uygulandi: boolean;
  yeniSayisi: number;
  yeniRevizyonSayisi: number;
  degismeyenSayisi: number;
  konfigurasyonlar: EkipmanIceAktarimSatiri[];
  sorunlar: EkipmanIceAktarimSorunu[];
}

export interface EkipmanListeSuzgeci {
  arama?: string;
  aileId?: number | null;
  tipId?: number | null;
  dogrulamaDurumu?: EkipmanDogrulamaDurumu | null;
  pasifleriGoster?: boolean;
  sayfa?: number;
  boyut?: number;
}

// Teknik veri (3K.YuklemeMotoru/Ekipman/EkipmanTeknikVerisi.cs). Koordinatlar: X ön uçtan arkaya, Y sol kenardan
// sağa, Z yerden yukarı; birimler mm ve kg. Boş alan "bilinmiyor" demektir.

export interface TeknikOlcu {
  uzunlukMm: number;
  genislikMm: number;
  yukseklikMm: number;
}

export interface TeknikYukYuzeyi {
  kod: string;
  ad?: string | null;
  baslangicXMm: number;
  uzunlukMm: number;
  genislikMm: number;
  yerdenYukseklikMm: number;
  kullanilabilirYukseklikMm?: number | null;
  tabanYukuKgM2?: number | null;
  noktasalYukKg?: number | null;
}

export type AciklikTarafi = 'arka' | 'on' | 'sol' | 'sag' | 'ust';
export type EngelTuru = 'dikme' | 'travers' | 'tekerHavuzu' | 'ucDuvar' | 'kapak' | 'diger';
export type DingilTuru = 'tahriksiz' | 'tahrikli' | 'pandul';

export interface TeknikAciklik {
  taraf: AciklikTarafi;
  baslangicXMm?: number | null;
  uzunlukMm?: number | null;
  genislikMm?: number | null;
  yukseklikMm?: number | null;
}

export interface TeknikEngel {
  tur: EngelTuru;
  xMm: number;
  yMm: number;
  zMm: number;
  uzunlukMm: number;
  genislikMm: number;
  yukseklikMm: number;
  sokulebilir: boolean;
  aciklama?: string | null;
}

export interface TeknikDingil {
  xMm: number;
  tur: DingilTuru;
  grupNo: number;
  kapasiteKg?: number | null;
}

export interface TeknikKingPin {
  xMm: number;
  azamiBaglantiYukuKg?: number | null;
}

export interface TeknikBaglamaNoktasi {
  xMm: number;
  yMm: number;
  zMm: number;
  kapasiteDaN?: number | null;
}

export interface EkipmanTeknikVerisi {
  semaSurumu?: number;
  disOlcu?: TeknikOlcu | null;
  daraKg?: number | null;
  teknikKapasiteKg?: number | null;
  azamiBrutKg?: number | null;
  uzamaEnFazlaMm?: number | null;
  kingPin?: TeknikKingPin | null;
  yuzeyler?: TeknikYukYuzeyi[];
  acikliklar?: TeknikAciklik[];
  engeller?: TeknikEngel[];
  dingiller?: TeknikDingil[];
  baglamaNoktalari?: TeknikBaglamaNoktasi[];
}

// ===== Mevzuat =====

export enum MevzuatKaynakTuru {
  Kanun = 1,
  Yonetmelik = 2,
  YonetmelikTaslagi = 3,
  Genelge = 4,
  Standart = 5,
  IcKural = 6,
}

export enum MevzuatKuralSetiDurumu {
  Taslak = 1,
  Onayli = 2,
  Kaldirildi = 3,
}

export interface MevzuatKuralSetiOzeti {
  id: number;
  yetkiAlani: string;
  ad: string;
  surumNo: number;
  gecerlilikBaslangici: string;
  gecerlilikBitisi: string | null;
  durum: MevzuatKuralSetiDurumu;
  onayTarihi: string | null;
  kuralSayisi: number;
}

export interface MevzuatKuraliModeli {
  id: number;
  kod: string;
  tip: number;
  parametrelerJson: string;
  kaynakId: number | null;
  madde: string | null;
  aciklama: string;
  sira: number;
}

export interface MevzuatKaynagiModeli {
  id: number;
  ad: string;
  tur: MevzuatKaynakTuru;
  resmiGazeteTarihi: string | null;
  resmiGazeteSayisi: string | null;
  url: string | null;
  erisimTarihi: string | null;
  aciklama: string | null;
}

export interface MevzuatKuralSetiDetayi {
  ozet: MevzuatKuralSetiOzeti;
  aciklama: string | null;
  kurallar: MevzuatKuraliModeli[];
  kaynaklar: MevzuatKaynagiModeli[];
}
