import { FinansFiyatlandirmaBirimi } from './finans.model';

export type FinansVarlikTuru = 'IsKaydi' | 'Siparis' | 'Fatura' | 'Gider';
export interface FinansHareket {
  tur: FinansVarlikTuru;
  id: number;
  projeNo: string;
  ad: string;
  isTarihi: string;
  finansTarihi: string;
  finansDonemi: string;
  paraBirimi: string;
  netTutar: number | null;
  durum: string;
}
export interface FinansGrafik {
  grup: string;
  paraBirimi: string;
  gelir: number | null;
  gider: number | null;
}
export interface FinansPanelPara {
  paraBirimi: string;
  isBedeli: number | null;
  siparisNetTutar: number | null;
  siparisBekleyen: number | null;
  faturaBekleyen: number | null;
  gelir: number | null;
  gider: number | null;
  fark: number | null;
  tahminiKar: number | null;
  karOrani: number | null;
  yilGelir: number | null;
  yilGider: number | null;
}
export interface FinansPanel {
  baslangic: string;
  bitis: string;
  tarihEkseni: string;
  tutarlar: FinansPanelPara[];
  aylik: FinansGrafik[];
  isTurleri: FinansGrafik[];
  giderTurleri: FinansGrafik[];
  projeler?: FinansGrafik[];
  ozelIsTurleri?: FinansGrafik[];
  siparisBekleyen: number;
  kismiSiparis: number;
  siparisTam: number;
  kismiFatura: number;
  tamamlanan: number;
}
export interface FinansBekleyen {
  isKaydiId: number;
  siparisKalemiId: number | null;
  projeNo: string;
  isAdi: string;
  poNumarasi: string | null;
  asama: string;
  baslangic: string;
  gun: number;
  grup: string;
  paraBirimi: string;
  kalanNetTutar: number | null;
}
export interface FinansFiyatBileseni {
  ad: string;
  yontem: FinansFiyatlandirmaBirimi;
  miktar: number;
  birimFiyat: number;
}
export interface FinansSablonAlan {
  kod: string;
  ad: string;
  veriTuru: string;
  zorunlu: boolean;
}
export interface FinansSablonKaydet {
  kod: string;
  ad: string;
  aktif: boolean;
  alanlar: FinansSablonAlan[];
}
export interface FinansSablon extends FinansSablonKaydet {
  id: number;
  surumId: number;
  surum: number;
}
export interface FinansFiyatlandirma {
  fiyatlandirmaBirimi: FinansFiyatlandirmaBirimi;
  adet: number;
  birimM3: number;
  birimFiyat: number;
  paraBirimi: string;
  kdvOrani: number;
  aciklama: string;
  manuelNetTutar?: number | null;
  sablonSurumId?: number | null;
  alanDegerleri?: Record<string, string | null>;
  bilesenler?: FinansFiyatBileseni[];
}
export interface FinansBagimlilik {
  varlikTuru: string;
  id: number;
  referans: string;
}
export interface FinansKaliciSilOnizleme {
  varlikTuru: FinansVarlikTuru;
  id: number;
  referans: string;
  surum: string;
  silinebilir: boolean;
  bagimliliklar: FinansBagimlilik[];
  engeller: string[];
}
export interface FinansKaliciSil {
  varlikTuru: FinansVarlikTuru;
  id: number;
  surum: string;
  ikinciOnay: boolean;
  aciklama: string;
}
export interface FinansBelge {
  id: number;
  hedefTuru: FinansVarlikTuru;
  hedefId: number;
  surum: number;
  orijinalAd: string;
  boyut: number;
  icerikTuru: string;
  hash: string;
  yukleyen: string;
  yuklemeTarihi: string;
}
export interface FinansDegisiklik {
  id: number;
  varlikTuru: string;
  varlikId: number;
  islem: string;
  alanAdi: string;
  eskiDeger: string | null;
  yeniDeger: string | null;
  aciklama: string | null;
  kullanici: string;
  tarih: string;
}
