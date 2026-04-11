export interface ApiResult<T> {
  isSuccess: boolean;
  value?: T;
  error?: string;
  statusCode?: number;
}

export interface KullaniciDto {
  id: number;
  adSoyad: string;
  basHarf: string;
  rol: string;
  email: string;
}

export interface LoginDto {
  email: string;
  sifre: string;
}

export interface LoginResultDto {
  token: string;
  kullanici: KullaniciDto;
}

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

export interface CekiYuklemeResultDto {
  cekiId: number;
  satirSayisi: number;
  sandikSayisi: number;
  mesaj: string;
}

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
