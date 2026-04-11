// ===== Common =====

export interface ApiResult<T> {
  isSuccess: boolean;
  value?: T;
  error?: string;
  statusCode?: number;
}

// ===== Auth =====

export interface LoginDto {
  email: string;
  sifre: string;
}

export interface RegisterDto {
  adSoyad: string;
  email: string;
  sifre: string;
  rol: string;
}

export interface LoginResultDto {
  token: string;
  kullanici: KullaniciDto;
}

// ===== Kullanici =====

export interface KullaniciDto {
  id: number;
  adSoyad: string;
  basHarf: string;
  rol: string;
  email: string;
}

// ===== Proje =====

export interface ProjeDto {
  id: number;
  projeNo: string;
  musteri: string;
  durum: string;
  planlananSevkTarihi?: string;
  sorumluKisi: string;
  sandikSayisi: number;
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
}

export interface ProjeOlusturDto {
  projeNo: string;
  musteri: string;
  planlananSevkTarihi?: string;
  sorumluKisi: string;
}

// ===== Ceki =====

export interface CekiYuklemeResultDto {
  cekiId: number;
  satirSayisi: number;
  sandikSayisi: number;
  mesaj: string;
}

export interface CekiSatiriDto {
  id: number;
  siraNo: number;
  olcuResmiPozNo?: string;
  barkodNo: string;
  aciklama: string;
  istenenAdet: number;
  birim: string;
  cekideGecenSandikNo: string;
  fiiliSandikNo?: string;
  remarks?: string;
  durum: string;
  paketleyenBasHarf?: string;
  kontrolEdenBasHarf?: string;
  konulanAdet: number;
  eksikAdet: number;
}

// ===== Sandik =====

export interface SandikDto {
  id: number;
  sandikNo: string;
  durum: string;
  depoLokasyonu?: string;
  urunSayisi: number;
}

export interface SandikDetayDto {
  id: number;
  sandikNo: string;
  durum: string;
  depoLokasyonu?: string;
  icerikler: SandikIcerikDto[];
}

export interface SandikIcerikDto {
  id: number;
  cekiSatiriId: number;
  olcuResmiPozNo?: string;
  barkodNo: string;
  aciklama: string;
  istenenAdet: number;
  konulanAdet: number;
  eksikAdet: number;
  durum: string;
  paketleyenBasHarf?: string;
  kontrolEdenBasHarf?: string;
  remarks?: string;
}

export interface SandikEkleDto {
  projeId: number;
  sandikNo: string;
  tip: string;
  depoLokasyonu: string;
}

export interface ManuelUrunEkleDto {
  projeId: number;
  sandikId: number;
  barkodNo: string;
  aciklama: string;
  istenenAdet: number;
  birim: string;
  eklemeNedeni?: string;
}

export interface UrunGuncelleDto {
  cekiSatiriId: number;
  konulanAdet?: number;
  eksikAdet?: number;
  paketleyenId?: number;
  kontrolEdenId?: number;
  aciklama?: string;
  yeniFiiliSandikNo?: string;
  kullaniciId: number;
  projeId: number;
}

export interface SandikDegistirDto {
  cekiSatiriId: number;
  yeniFiiliSandikNo: string;
  projeId: number;
  kullaniciId: number;
}

export interface TeslimAlDto {
  cekiSatiriId: number;
  projeId: number;
  gelenMiktar: number;
  not?: string;
}

export interface TopluTeslimAlDto {
  projeId: number;
  urunler: { cekiSatiriId: number; gelenMiktar: number }[];
  not?: string;
}

export interface UrunIptalDto {
  cekiSatiriId: number;
  projeId: number;
  kullaniciId: number;
}

// ===== Grid =====

export interface GridUrunDto {
  cekiSatiriId: number;
  siraNo: number;
  barkodNo: string;
  aciklama: string;
  istenenAdet: number;
  birim: string;
  sandikNo: string;
  gridDurumu: string;
  gridSevkMiktari?: number;
  gridSevkTarihi?: string;
  gridNotu?: string;
  ucKDurumu: string;
  gelenMiktar: number;
  genelDurum: string;
}

export interface GridDurumGuncelleDto {
  cekiSatiriId: number;
  projeId: number;
  yeniDurum: string;
  sevkMiktari?: number;
  not?: string;
}

export interface GridTopluSevkDto {
  projeId: number;
  cekiSatiriIdler: number[];
  not?: string;
}

// ===== Stok =====

export interface StokKaydiDto {
  id: number;
  malzemeKodu: string;
  malzemeAdi: string;
  miktar: number;
  birim: string;
  lokasyon?: string;
  kaynakProje?: string;
  durum: string;
}

export interface StokKaydiOlusturDto {
  malzemeKodu: string;
  malzemeAdi: string;
  miktar: number;
  birim: string;
  lokasyon?: string;
  kaynakProje?: string;
}

export interface StokKarsilamaDto {
  cekiSatiriId: number;
  stokKaydiId: number;
  miktar: number;
  kullaniciId: number;
  projeId: number;
}

// ===== FB Transfer =====

export interface FBTransferDto {
  cekiSatiriId: number;
  asilFB: string;
  alinanFB: string;
  miktar: number;
  neden?: string;
  iadeDurumu?: string;
  aciklama?: string;
  kullaniciId: number;
}

export interface FBTransferResultDto {
  id: number;
  asilFB: string;
  alinanFB: string;
  miktar: number;
  neden?: string;
  iadeDurumu?: string;
  aciklama?: string;
  tarih: string;
}

// ===== Eksik Urun =====

export interface EksikUrunDto {
  cekiSatiriId: number;
  siraNo: number;
  barkodNo: string;
  aciklama: string;
  istenenAdet: number;
  gelenMiktar: number;
  eksikMiktar: number;
  gridDurumu: string;
  ucKDurumu: string;
  sandikNo: string;
}

// ===== Hareket Gecmisi =====

export interface HareketGecmisiDto {
  id: number;
  islem: string;
  referansTipi: string;
  referansId?: string;
  eskiDeger?: string;
  yeniDeger?: string;
  aciklama?: string;
  kullaniciAdi: string;
  tarih: string;
}
