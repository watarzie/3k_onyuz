import { ProjeDurum, ProjeTipi } from '../../core/constants/enums';

// ===== Proje =====

export interface ProjeDepoDagilimDto {
  depoLokasyonId: number;
  depoLokasyonMetni: string;
  sandikSayisi: number;
}

export interface ProjeDto {
  id: number;
  projeNo: string;
  musteri: string;
  durumId: number;
  durumMetni: string;
  projeTipiId: number;
  projeTipiMetni: string;
  baslamaTarihi?: string;
  calismaGunSayisi?: number;
  planlananSevkTarihi?: string;
  gerceklesenSevkTarihi?: string;
  fizikselSevkEdilmisSandikVarMi: boolean;
  sorumluKisi: string;
  sandikSayisi: number;
  hazirSandikSayisi: number;
  depoSandikSayisi: number;
  depoUcKSandikSayisi: number;
  depoSeymenSandikSayisi: number;
  depoGridSandikSayisi: number;
  depoDagilimlari?: ProjeDepoDagilimDto[];
  toplamUrunSayisi: number;
  tamamlananUrunSayisi: number;
  fbNo?: string;
  guc?: string;
  gerilim?: string;
  lokasyon?: string;
  olcuResmiNo?: string;
  nakilOlcuResmiNo?: string;
  sonMontajResmiNo?: string;
  projeMuduru?: string;
  /**
   * Fotoğraf ve gerçekleşen çeki bağlantıları (eklenme sırasıyla, türüyle); sunucu yalnız proje-fotograf-baglantisi R
   * izniyle doldurur.
   */
  fotografBaglantilari?: ProjeFotografBaglantisi[];
}

/** Proje bağlantısının türü; sunucudaki ProjeBaglantiTuru ile aynı sayılar. */
export enum ProjeBaglantiTuru {
  Fotograf = 1,
  GerceklesenCeki = 2,
}

/** Projenin bir bağlantısı. Ekleme, düzenleme ve silme yanıtı projenin güncel bağlantı listesidir (her iki tür). */
export interface ProjeFotografBaglantisi {
  id: number;
  /** Boşsa fotoğraf sayılır. */
  tur?: ProjeBaglantiTuru;
  adres: string;
  aciklama?: string | null;
}

/** Bağlantı ekleme/düzenleme isteği; tür yalnız eklemede okunur (düzenlemede değişmez). */
export interface ProjeFotografBaglantisiKaydetDto {
  tur?: ProjeBaglantiTuru;
  adres: string;
  aciklama: string | null;
}

export interface ProjeOlusturDto {
  projeNo: string;
  musteri: string;
  projeTipiId?: number;
  planlananSevkTarihi?: string;
  sorumluKisi: string;
  lokasyon?: string;
}

export interface EksikSahaUrunDto {
  cekiSatiriId: number;
  kaynakProjeId?: number | null;
  miktar: number;
  aciklama?: string | null;
}

export interface EksikSahaSandikDto {
  hedefSandikId?: number | null;
  sandikNo: string;
  sandikIsmi?: string | null;
  en?: number | null;
  boy?: number | null;
  yukseklik?: number | null;
  netKg?: number | null;
  grossKg?: number | null;
  urunler: EksikSahaUrunDto[];
}

export interface EksiklerdenSahaProjesiOlusturDto {
  kaynakProjeId?: number | null;
  hedefSahaProjeId?: number | null;
  projeNo?: string | null;
  musteri?: string | null;
  lokasyon?: string | null;
  aciklama?: string | null;
  sandiklar: EksikSahaSandikDto[];
}

export interface SandiklardanSahaProjesiOlusturDto {
  kaynakProjeId: number;
  hedefSahaProjeId?: number | null;
  sandikIds: number[];
  projeNo?: string | null;
  aciklama?: string | null;
}


export interface SahaAktarimDto {
  sahaCekiSatiriId: number;
  sahaProjeId: number;
  sahaProjeNo: string;
  sahaSandikId?: number | null;
  sahaSandikNo: string;
  kaynakProjeId: number;
  kaynakProjeNo: string;
  kaynakSandikNo: string;
  siraNo: number;
  barkodNo: string;
  aciklama: string;
  miktar: number;
  birim: string;
  durumMetni: string;
  sevkEdildiMi: boolean;
  islemGormusMu: boolean;
  geriAlinabilirMi: boolean;
  geriAlinamamaNedeni?: string | null;
  /** Satırın bağlı olduğu aktarım başlığı; aktarımın tamamı bu kimlikle geri alınır. */
  sahaAktarimId?: number | null;
  sahaAktarimTarihi?: string | null;
  sahaAktarimAciklama?: string | null;
  /** Başlık sahadan sahaya taşımaysa tamamı geri alınmaz; ters yönde yeni taşıma yapılır. */
  sahaAktarimTasimaMi?: boolean;
}

/** Sahadan sahaya taşıma: ya satırlar (sahaCekiSatiriIds) ya da bir sandığın bütün içeriği (kaynakSandikId). */
export interface SahadanSahayaTasimaTalebi {
  kaynakSahaProjeId: number;
  sahaCekiSatiriIds: number[];
  kaynakSandikId?: number | null;
  hedefSahaProjeId: number;
  hedefSandikId?: number | null;
  yeniSandikNo?: string | null;
}

export interface SahadanSahayaTasiDto extends SahadanSahayaTasimaTalebi {
  /** Pencere açık kaldıkça sabit; ağ tekrarında aynı taşıma ikinci kez yazılmaz. */
  islemAnahtari: string;
  aciklama?: string | null;
}

export interface SahadanSahayaTasimaSatiriDto {
  sahaCekiSatiriId: number;
  kaynakProjeNo: string;
  siraNo: number;
  barkodNo: string;
  aciklama: string;
  kaynakSandikNo: string;
  miktar: number;
  konulanAdet: number;
  birim: string;
}

export interface SahadanSahayaTasimaOnizlemeDto {
  kaynakSahaProjeNo: string;
  hedefSahaProjeNo: string;
  hedefSandikNo: string;
  yeniSandik: boolean;
  tasinabilirMi: boolean;
  manuelIcerikSayisi: number;
  toplamMiktar: number;
  bosalacakSandikNolari: string[];
  engeller: string[];
  satirlar: SahadanSahayaTasimaSatiriDto[];
}

export interface SahadanSahayaTasimaSonucDto {
  sahaAktarimId: number;
  hedefSahaProjeId: number;
  hedefSahaProjeNo: string;
  hedefSandikId: number;
  hedefSandikNo: string;
  tasinanSatirSayisi: number;
  tasinanManuelIcerikSayisi: number;
  toplamMiktar: number;
  bosalanSandikNolari: string[];
}

/** Bir saha aktarımının (otomatik ya da elle) bütün satırlarının geri alınma sonucu. */
export interface SahaAktarimiGeriAlSonucDto {
  sahaAktarimId: number;
  sahaProjeId: number;
  geriAlinanSatirSayisi: number;
  geriAlinanToplamMiktar: number;
  bosalanSandikSayisi: number;
}

/**
 * Ana projenin 1 numaralı sandığı (transformatör) sahaya sandık olarak aktarılamaz; sunucudaki
 * KoliNoKurali.Normalize ile aynı karşılaştırma: "01", "1.0" ve " 1 " de 1 numaralı sandıktır.
 */
export function birNumaraliSandikMi(sandikNo: string | null | undefined): boolean {
  const metin = (sandikNo ?? '').replace(/\s/g, '');
  return /^\+?\d+(\.\d*)?$/.test(metin) && Number(metin) === 1;
}

export interface OtomatikSahaAktarimParametreleri {
  hedefSahaProjeId?: number | null;
  yeniProje?: boolean;
}

export interface OtomatikSahaHedefDto {
  sahaProjeId: number;
  sahaProjeNo: string;
  durumMetni: string;
  sandikSayisi: number;
}

export interface OtomatikSahaUrunDto {
  cekiSatiriId: number;
  siraNo: number;
  barkodNo: string;
  aciklama: string;
  kaynakSandikNo?: string | null;
  istenenAdet: number;
  miktar: number;
  birim: string;
}

export interface OtomatikSahaSandikDto {
  kaynakSandikId: number;
  kaynakSandikNo: string;
  sandikAdi?: string | null;
  hedefSandikNo: string;
  mevcutSandigaEklenir: boolean;
  numaraDegisti: boolean;
  urunSayisi: number;
  toplamAdet: number;
  urunler: OtomatikSahaUrunDto[];
}

export interface OtomatikSahaEksiklerSandigiDto {
  sandikNo: string;
  sandikAdi?: string | null;
  mevcutSandigaEklenir: boolean;
  toplamAdet: number;
  urunler: OtomatikSahaUrunDto[];
}

export interface OtomatikSahaAtlananDto {
  sandikNo?: string | null;
  cekiSatiriId?: number | null;
  urun?: string | null;
  /** Kısa neden (tek cümle). */
  neden: string;
  /** Ürün ürün ayrıntı (elle sandık aktarımının ret gerekçeleri); açılır listede gösterilir. */
  ayrintilar?: string[] | null;
}

/** Otomatik sahaya aktarım önizlemesi; uygulama planOzeti ile gönderilir. */
export interface OtomatikSahaAktarimOnizlemeDto {
  projeId: number;
  projeNo: string;
  planOzeti: string;
  aktarilacakVarMi: boolean;
  aktarilacakSandikSayisi: number;
  eksikSatirSayisi: number;
  eksikToplamAdet: number;
  atlananSayisi: number;
  hedefSahaProjeId?: number | null;
  hedefSahaProjeNo?: string | null;
  yeniSahaProjesi: boolean;
  hedefSecimiGerekli: boolean;
  yeniSahaProjeNoOnerisi: string;
  hedefSecenekleri: OtomatikSahaHedefDto[];
  sandiklar: OtomatikSahaSandikDto[];
  eksiklerSandigi?: OtomatikSahaEksiklerSandigiDto | null;
  atlananlar: OtomatikSahaAtlananDto[];
}

export interface OtomatikSahayaAktarDto {
  hedefSahaProjeId?: number | null;
  yeniProje: boolean;
  yeniProjeNo?: string | null;
  aciklama?: string | null;
  planOzeti: string;
}

export interface OtomatikSahaAktarimSonucDto {
  sahaProjeId: number;
  sahaProjeNo: string;
  sahaAktarimId: number;
  aktarilanSandikSayisi: number;
  eksikSatirSayisi: number;
  toplamSatirSayisi: number;
  toplamAdet: number;
}

export interface SahaSandikAktarimGeriAlResultDto {
  geriAlinanSatirSayisi: number;
  geriAlinanToplamMiktar: number;
  sandikBosaldiMi: boolean;
}

/** Dropdown'lar için hafif proje DTO — sadece Id/ProjeNo/Musteri */
export interface SevkiyatSandikDto {
  sandikId: number;
  sandikNo: string;
  sandikAdi?: string;
}

export interface SevkiyatDto {
  id: number;
  sevkiyatNo: number;
  sevkTarihi: string;
  aciklama?: string;
  aracPlaka?: string;
  kullaniciAdSoyad?: string;
  sandikSayisi: number;
  kayitTipi: string;
  isKilitAcma: boolean;
  sandiklar: SevkiyatSandikDto[];
}

export interface ProjeDropdownDto {
  id: number;
  projeNo: string;
  musteri: string;
  projeTipiId?: number;
  durumId?: number;
  lokasyon?: string | null;
}

/** Sahaya aktarım hedefi olabilecek projeler: sevk edilmemiş saha projeleri, proje numarasına göre sıralı. */
export function aktifSahaProjeleri(projeler: ProjeDropdownDto[]): ProjeDropdownDto[] {
  return projeler
    .filter(p => p.projeTipiId === ProjeTipi.Saha)
    .filter(p => p.durumId !== ProjeDurum.SevkEdildi && p.durumId !== ProjeDurum.EksikSevkEdildi)
    .sort((a, b) => a.projeNo.localeCompare(b.projeNo, 'tr-TR'));
}

/**
 * Sahadan sahaya taşımanın hedefi olabilecek saha projeleri: tamamen sevk edilmiş olanlar dışında hepsi (Eksik Sevk
 * Edildi dahil; ürün yalnız sevk edilmemiş ya da yeni açılan sandığa gider, sunucu sandık düzeyinde denetler).
 */
export function tasimaHedefiSahaProjeleri(projeler: ProjeDropdownDto[]): ProjeDropdownDto[] {
  return projeler
    .filter(p => p.projeTipiId === ProjeTipi.Saha && p.durumId !== ProjeDurum.SevkEdildi)
    .sort((a, b) => a.projeNo.localeCompare(b.projeNo, 'tr-TR'));
}
