// ===== Grid =====
import { SahaTamamlamaIzDto } from './saha-iz.model';
import { PaginatedList } from './common.model';

// ===== Grid Sahası (GET api/grid/saha/urunler, GET api/grid/saha/mal-kabul; arka uç GridSahaDtolari ile birebir) =====

/** Ürün listesi kapsamı: Grid'de bekleyenler (varsayılan) ya da Grid'e gelmiş bütün ürünler. */
export type GridSahaKapsam = 'bekleyen' | 'tumu';
export type GridSahaSiralama = 'proje' | 'bekleyen' | 'sandik';
/** Mal kabul kayıtlarının türü: yalnız mal kabul (varsayılan), yalnız toplu sevk ya da ikisi. */
export type GridMalKabulTuru = 'mal-kabul' | 'toplu-sevk' | 'hepsi';

export interface GridSahaUrunleriParams {
  pageNumber?: number;
  pageSize?: number;
  kapsam?: GridSahaKapsam;
  arama?: string;
  projeTipiId?: number | null;
  projeId?: number | null;
  gridDurumuId?: number | null;
  siralama?: GridSahaSiralama;
  azalan?: boolean;
}

export interface GridSahaOzetDto {
  bekleyenSatir: number;
  bekleyenAdet: number;
  projeSayisi: number;
  eksikGelenSatir: number;
  bugunMalKabul: number;
}

export interface GridSahaUrunDto {
  cekiSatiriId: number;
  projeId: number;
  projeNo: string;
  projeTipiId: number;
  musteri: string;
  sandikNo: string;
  siraNo: number;
  barkodNo: string;
  olcuResmiPozNo?: string | null;
  aciklama: string;
  birim: string;
  istenenAdet: number;
  gridGelenAdet: number;
  ucKGelenMiktar: number;
  yoldakiMiktar: number;
  griddeBekleyenMiktar: number;
  gridDurumuId: number;
  gridDurumuMetni: string;
  gridSevkDurumuId: number;
  gridSevkDurumuMetni: string;
  sonMalKabulTarihi?: string | null;
  sonMalKabulPersoneli?: string | null;
  sahayaAktarildiMi: boolean;
  gridAciklama?: string | null;
}

export interface GridSahaUrunleriDto {
  ozet: GridSahaOzetDto;
  liste: PaginatedList<GridSahaUrunDto>;
}

export interface GridMalKabulParams {
  pageNumber?: number;
  pageSize?: number;
  baslangic?: string;
  bitis?: string;
  personelId?: number | null;
  projeId?: number | null;
  arama?: string;
  tur?: GridMalKabulTuru;
}

export interface GridMalKabulPersonelDto {
  kullaniciId: number;
  kullaniciAdi: string;
  islemSayisi: number;
}

export interface GridMalKabulHareketDto {
  anahtar: string;
  tarih: string;
  kullaniciId: number;
  kullaniciAdi: string;
  projeId: number;
  projeNo: string;
  projeTipiId?: number | null;
  islemMetni: string;
  topluMu: boolean;
  cekiSatiriId?: number | null;
  urunMetni: string;
  sandikNo?: string | null;
  oncekiDurumMetni?: string | null;
  gelenAdet?: number | null;
  guncelGridGelenAdet?: number | null;
  topluUrunSayisi?: number | null;
  aciklama?: string | null;
}

export interface GridMalKabulGecmisiDto {
  baslangic: string;
  bitis: string;
  liste: PaginatedList<GridMalKabulHareketDto>;
  personelOzeti: GridMalKabulPersonelDto[];
}

export interface GridUrunDto {
  cekiSatiriId: number;
  sandikIcerikId?: number;
  /** Satırın sandığı; ürün bilgisi bu sandık ve içerik üzerinden kaydedilir (3K listesiyle aynı). */
  sandikId?: number | null;
  /** Sandık satırının kalıcı ürün bilgisi (seri no, SKT, lot); 3K listesindekiyle aynı alandır. */
  urunBilgisi?: string | null;
  /** Çeki satırındaki sandık dağılımından bağımsız toplam talep. */
  anaIstenenAdet?: number;
  /** İlk miktar düzenlemesinden önceki çeki miktarı; null ise kayıtlı miktar düzenlemesi yoktur. */
  orijinalIstenenAdet?: number | null;
  /** Bu sandık içeriğine tahsis edilmiş güncel miktar. */
  sandikMiktari?: number;
  sandikBazliDagitim?: boolean;
  /** Satır toplamları (sandık dağılımından bağımsız). Grid komutları satır bazlıdır. */
  toplamGridGelenAdet?: number;
  toplamUcKGelenMiktar?: number;
  toplamKalanMiktar?: number;
  sandikAktarilanGiris?: number;
  sandikAktarilanCikis?: number;
  sandikTransferOzeti?: string;
  isSahaManuelSandikIcerigi?: boolean;
  kaynakCekiSatiriId?: number;
  kaynakProjeNo?: string;
  kaynakSandikNo?: string;
  kaynakSiraNo?: number;
  sahaTamamlamalari: SahaTamamlamaIzDto[];
  siraNo: number;
  barkodNo: string;
  olcuResmiPozNo?: string;
  aciklama: string;
  istenenAdet: number;
  birimId: number;
  birim: string;
  sandikNo: string;
  sandikDurumId?: number;
  sandikDurumMetni?: string;
  sandikSevkEdildiMi: boolean;
  gridDurumuId: number;
  gridDurumuMetni: string;
  /**
   * Grid tarafı sayaçları satır bazlıdır: çok sandıklı üründe her sandık satırı satırın
   * gerçek değerini taşır (sandığa oranla bölünmez). Grid gelen, Trafo, aktif sevk,
   * yeniden sevk borcu, Grid eksik, başka projeye verilen ve geri gönderilen bu gruptadır.
   */
  gridGelenAdet: number;
  trafoSevkAdet: number;
  gridSevkDurumuId: number;
  gridSevkDurumuMetni: string;
  gridSevkMiktari?: number;
  yenidenSevkGerekliAdet: number;
  /** Backend iş kuralına göre satırın yeni bir Grid sevk partisine açılabilmesi. */
  gridYenidenSevkEdilebilirMi?: boolean;
  /** Yeni sevk partisi için backend tarafından hesaplanan azami miktar. */
  gridYenidenSevkUstSiniri?: number;
  gridSevkTarihi?: string;
  gridAciklama?: string;
  gridEksikMiktar: number;
  // Parçalı karşılama (Madde 2)
  stokKarsilanan: number;
  projeKarsilanan: number;
  projeGonderilen: number;
  netKullanilabilir: number;
  tedarikciKarsilanan: number;
  eksikMiktar: number;
  kalanMiktar: number;
  ucKDurumuId: number;
  ucKDurumuMetni: string;
  gelenMiktar: number;
  geriGonderilenMiktar: number;
  geriGonderilmeSebebiId?: number;
  geriGonderilmeSebebiMetni?: string;
  kaynakHedefProjeNo?: string;
  // Çapraz açıklama: 3K tarafının açıklaması (Grid tarafı görür)
  ucKAciklama?: string;
  genelDurumId: number;
  genelDurumMetni: string;
  // Kalite & Süreç
  kaliteDurumId?: number;
  kaliteDurumMetni?: string;
  surecDurumId?: number;
  surecDurumMetni?: string;
}

export interface GridIsListesiDto {
  toplam: number;
  eksikGelen: number;
  yenidenSevkGerekli: number;
  bugunGridIslemi: number;
  liste: GridPagedResultDto<GridIsListesiItemDto>;
}

export interface GridPagedResultDto<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface GridIsListesiItemDto {
  cekiSatiriId: number;
  projeId: number;
  projeTipiId: number;
  projeNo: string;
  musteri: string;
  sandikNo?: string;
  siraNo: number;
  barkodNo: string;
  olcuResmiPozNo?: string;
  aciklama: string;
  birim: string;
  istenenAdet: number;
  gridGelenAdet: number;
  gridEksikMiktar: number;
  gridSevkMiktari: number;
  trafoSevkAdet: number;
  yenidenSevkGerekliAdet: number;
  ucKGelenMiktar: number;
  kalanMiktar: number;
  gridDurumuId: number;
  gridDurumuMetni: string;
  gridSevkDurumuId: number;
  gridSevkDurumuMetni: string;
  ucKDurumuId: number;
  ucKDurumuMetni: string;
  gridAciklama?: string;
  gridSevkTarihi?: string;
  sonIslemTarihi?: string;
  isTipi: string;
  isTipiMetni: string;
  oncelik: number;
}

export interface GridDurumGuncelleDto {
  cekiSatiriId: number;
  projeId: number;
  yeniDurumId: number;
  gridGelenAdet?: number;
  trafoSevkAdet?: number;
  gridSevkDurumuId?: number;
  sevkMiktari?: number;
  aciklama?: string;
}

export interface GridTopluSevkDto {
  projeId: number;
  cekiSatiriIdler: number[];
  aciklama?: string;
}

export interface GridDurumSifirlaDto {
  cekiSatiriId: number;
  projeId: number;
  aciklama?: string;
}

export interface KaliteDurumGuncelleDto {
  projeId: number;
  cekiSatiriIdler: number[];
  kaliteDurumId: number;
}

export interface SurecDurumGuncelleDto {
  projeId: number;
  cekiSatiriIdler: number[];
  surecDurumId: number;
}
