import { FinansIsKategorisi, FinansKarsilanma, FinansOdemeDurumu, FinansSandikMalzemesi } from '../../core/constants/enums';
import { FinansFiyatlandirmaBirimi, FinansParaToplami } from './finans.model';

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
  /** Dönemdeki projelerin PO ve fatura karşılanmasına göre sayıları (F4). */
  projeDurumlari?: FinansProjeDurumSayilari | null;
  /** Para birimi bazında alacak özeti (D3): ödenmemiş, vadesi geçen/yaklaşan, zamanında/geç ödenen. */
  alacaklar?: FinansAlacakOzeti[] | null;
  /** Ödenmemiş faturaların vade ayına göre dağılımı (grup = yyyy-MM, gelir = brüt tutar). */
  beklenenTahsilat?: FinansGrafik[] | null;
  /** Sipariş ve fatura bekleyen kalemlerin 15+/30+/60+/90+ gün kovaları (R1 §5). */
  yaslandirma?: FinansYaslandirmaKovasi[] | null;
  /** Vadesi yaklaşan sayılan gün penceresi (finans parametresi). */
  vadeUyariGunu?: number;
  /** Seçili dönemin genel durum sayıları: iş kalemi, proje, PO ve fatura (iptaller hariç). */
  sayilar?: FinansPanelSayilari | null;
  /** Ay bazında iş kalemi, PO ve fatura sayıları; ilk veri ayından dönem sonuna kesintisizdir. */
  aylikSayilar?: FinansPanelAylikSayi[] | null;
  /** Detay dökümü: proje × para birimi (tutarlar yetkiye göre null olabilir). */
  projeOzetleri?: FinansPanelProjeOzeti[] | null;
  /** Detay dökümü: kategori × para birimi. */
  kategoriOzetleri?: FinansPanelKategoriOzeti[] | null;
  siparisBekleyen: number;
  kismiSiparis: number;
  siparisTam: number;
  kismiFatura: number;
  tamamlanan: number;
}
export interface FinansPanelSayilari {
  isKaydi: number;
  proje: number;
  po: number;
  acikPo: number;
  kismiFaturaliPo: number;
  kapaliPo: number;
  fatura: number;
  odenenFatura: number;
  odenmemisFatura: number;
  vadesiGecenFatura: number;
  giderKaydi: number;
}
export interface FinansPanelProjeOzeti {
  projeNo: string;
  musteri: string;
  paraBirimi: string;
  isKaydi: number;
  isBedeli: number | null;
  siparisNetTutar: number | null;
  faturalananNetTutar: number | null;
  kalanSiparisNetTutar: number | null;
  kalanFaturaNetTutar: number | null;
  gider: number | null;
  siparis: FinansKarsilanma;
  fatura: FinansKarsilanma;
}
export interface FinansPanelKategoriOzeti {
  kategori: FinansIsKategorisi;
  paraBirimi: string;
  isKaydi: number;
  proje: number;
  isBedeli: number | null;
  siparisNetTutar: number | null;
  faturalananNetTutar: number | null;
}
export interface FinansPanelAylikSayi {
  ay: string;
  isKaydi: number;
  po: number;
  fatura: number;
}
export interface FinansAlacakOzeti {
  paraBirimi: string;
  bekleyenTutar: number | null;
  bekleyenAdet: number;
  vadesiGecenTutar: number | null;
  vadesiGecenAdet: number;
  yaklasanTutar: number | null;
  yaklasanAdet: number;
  zamanindaOdenenAdet: number;
  gecOdenenAdet: number;
  odenenTutar: number | null;
}
/** Kümülatif bekleme kovası: en az minGun gündür bekleyen kalem sayısı ve para birimi bazında kalan net tutar. */
export interface FinansYaslandirmaKovasi {
  asama: FinansBekleyenAsama;
  minGun: number;
  adet: number;
  tutarlar: FinansParaToplami[];
}
export type FinansBekleyenAsama = 'Sipariş' | 'Fatura';
export interface FinansVadeUyarisi {
  faturaId: number;
  faturaNumarasi: string;
  poNumarasi: string;
  projeNo: string;
  faturaTarihi: string;
  vadeTarihi: string;
  kalanGun: number;
  odemeDurumu: FinansOdemeDurumu;
  paraBirimi: string;
  toplamTutar: number | null;
}
export interface FinansVadeUyarilari {
  vadeUyariGunu: number;
  vadesiGecenAdet: number;
  yaklasanAdet: number;
  kalemler: FinansVadeUyarisi[];
}
export interface FinansOdemeKaydet {
  odendi: boolean;
  odemeTarihi: string | null;
  aciklama: string | null;
}
/** Para birimi tanımı (F1); yeni para birimi kartlarda, grafiklerde, filtrelerde ve raporlarda görünür. */
/** Rapor önizlemesi: indirilecek dosyanın başlığı, sütunları, ilk satırları ve toplam satır sayısı. */
export interface FinansRaporOnizleme {
  baslik: string;
  sutunlar: string[];
  satirlar: string[][];
  toplamSatir: number;
}
export interface FinansParaBirimi {
  id: number;
  kod: string;
  ad: string;
  sembol: string | null;
  aktif: boolean;
  sira: number;
}
export type FinansParaBirimiKaydet = Omit<FinansParaBirimi, 'id'>;
/** Vade parametreleri (D3). */
export interface FinansParametreler {
  varsayilanVadeGunu: number;
  vadeUyariGunu: number;
}
export interface FinansYenidenFiyatlamaSonuc {
  urunId: number;
  incelenenKalem: number;
  fiyatlananKalem: number;
}
export interface FinansProjeDurumSayilari {
  toplamProje: number;
  siparisYok: number;
  siparisKismi: number;
  siparisTam: number;
  faturaYok: number;
  faturaKismi: number;
  faturaTam: number;
  tamamlanan: number;
  fiyatBekleyen: number;
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
/** Fiyat satırı (F11): m³ satırı malzemesini taşır; malzeme boşsa sandığın kendi malzemesi sayılır. */
export interface FinansFiyatBileseni {
  ad: string;
  yontem: FinansFiyatlandirmaBirimi;
  miktar: number;
  birimFiyat: number;
  malzeme?: FinansSandikMalzemesi | null;
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
  /** Kaydın kendi satırları ve ekleri; kayıtla aynı işlemde silinir. */
  birlikteSilinecekler?: FinansBagimlilik[];
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
