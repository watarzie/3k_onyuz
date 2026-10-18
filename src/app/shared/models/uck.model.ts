// ===== 3K (UcK) =====
import { SahaTamamlamaIzDto } from './saha-iz.model';

export interface UcKUrunDto {
  cekiSatiriId: number;
  sandikIcerikId?: number;
  /** Satırın sandığı; ürün bilgisi bu sandık ve içerik üzerinden kaydedilir. */
  sandikId?: number | null;
  /** Çeki satırındaki ana talep; sandık dağılımından bağımsız toplamdır. */
  anaIstenenAdet?: number;
  /** İlk miktar düzenlemesinden önceki çeki miktarı; null ise kayıtlı miktar düzenlemesi yoktur. */
  orijinalIstenenAdet?: number | null;
  /** Bu sandık içeriğine tahsis edilmiş güncel miktardır. */
  sandikMiktari?: number;
  sandikBazliDagitim?: boolean;
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
  /** Seçili sandık satırının kalıcı ürün bilgisi (seri no, SKT, lot); Grid ve 3K ekranlarında aynı alandır. */
  urunBilgisi?: string | null;
  kaynakSiraNo?: number;
  sahaTamamlamalari: SahaTamamlamaIzDto[];
  siraNo: number;
  barkodNo: string;
  olcuResmiPozNo?: string;
  aciklama: string;
  sandikNo: string;
  sandikDurumId?: number;
  sandikDurumMetni?: string;
  sandikSevkEdildiMi: boolean;
  istenenAdet: number;
  birimId: number;
  birim: string;
  gridDurumuId: number;
  gridDurumuMetni: string;
  /**
   * Grid gelen, Trafo, aktif Grid sevki, hatalı, geri gönderilen ve başka projeye verilen
   * satır bazlıdır: çok sandıklı üründe sandığa bölünmez. Sandık bazlı teslim sınırı
   * aktifGridSevkPartisi* ve gridGeriGonderilebilirMiktar alanlarından gelir.
   */
  gridGelenAdet: number;
  trafoSevkAdet: number;
  gridSevkDurumuId: number;
  gridSevkDurumuMetni: string;
  gridSevkMiktari?: number;
  /** Backend'in aktif Grid sevk partisi için verdiği teslim uygunluğu kararı. */
  aktifGridSevkPartisiTeslimeAcikMi?: boolean;
  /** Aktif Grid sevk partisinde 3K tarafından henüz teslim alınmamış miktar. */
  aktifGridSevkPartisiKalanMiktari?: number;
  /** Aktif sevke bağlı fazla teslimin stoka alınabilmesi için backend kararı. */
  aktifGridSevkPartisiFazlaTeslimeAcikMi?: boolean;
  /** Seçili sandıktan güvenle Grid'e geri gönderilebilecek fiziksel miktar. */
  gridGeriGonderilebilirMiktar?: number;
  /** Geri gönderimin aktif sevk yaşam döngüsünü bozmadan yapılabileceğine dair backend kararı. */
  gridGeriGonderimeAcikMi?: boolean;
  ucKKarsilamaTipiId: number;
  ucKKarsilamaTipiMetni: string;
  gelenMiktar: number;
  karsilananMiktar: number;
  hataliMiktar: number;
  kaynakHedefProjeNo?: string;
  geriGonderilmeSebebiId?: number;
  geriGonderilmeSebebiMetni?: string;
  geriGonderilenMiktar: number;
  ucKAciklama?: string;
  // Çapraz açıklama: Grid tarafının açıklaması (3K tarafı görür)
  gridAciklama?: string;
  // Parçalı karşılama (Madde 2)
  stokKarsilanan: number;
  projeKarsilanan: number;
  projeGonderilen: number;
  netKullanilabilir: number;
  transferZinciriVar: boolean;
  transferZinciri: ProjeTransferZincirDto[];
  tedarikciKarsilanan: number;
  eksikMiktar: number;
  kalan: number;
  kontrolUyari: string;
  genelDurumId: number;
  genelDurumMetni: string;
  // Kalite & Süreç (read-only)
  kaliteDurumId?: number;
  kaliteDurumMetni?: string;
  surecDurumId?: number;
  surecDurumMetni?: string;
  isManuelEklenen: boolean;
}

export interface ProjeTransferZincirDto {
  id: number;
  yon: string;
  kaynakProjeNo: string;
  hedefProjeNo: string;
  barkodNo: string;
  urunAdi: string;
  miktar: number;
  transferTipi: string;
  durum: string;
  parentTransferId?: number;
  rootTransferId?: number;
  zincirSeviyesi: number;
  aciklama?: string;
  tarih: string;
}

export interface UcKIsListesiDto {
  toplam: number;
  teslimBekleyen: number;
  trafoSevk: number;
  gridKapandi: number;
  bugunGridIslemi: number;
  liste: UcKPagedResultDto<UcKIsListesiItemDto>;
}

export interface UcKPagedResultDto<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface UcKIsListesiItemDto {
  cekiSatiriId: number;
  projeId: number;
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

export interface UcKDurumGuncelleDto {
  cekiSatiriId: number;
  sandikIcerikId?: number;
  projeId: number;
  karsilamaTipiId: number;
  gelenAdet?: number;
  kaynakHedefProjeNo?: string;
  kaynakCekiSatiriId?: number;
  stokKaydiId?: number;
  aciklama?: string;
  geriGonderilmeSebebiId?: number;
  stogaAktar?: boolean;
  urunAdi?: string;
  mevcutProjeNo?: string;
  mevcutSandikNo?: string;
  kaynakUrunAdi?: string;
}

/**
 * "Projeden Karşılandı" panelinde kaynak projeden seçilebilecek ürün.
 * GET /api/uck/{hedefProjeId}/projeden-karsilama-kaynaklari?kaynakProjeId= — hedef projenin 3K W izniyle açılır;
 * değerler kaynak projenin Grid satırlarıyla aynıdır. Çok sandıklı satır her sandık için ayrı döner.
 */
export interface ProjedenKarsilamaKaynakDto {
  cekiSatiriId: number;
  siraNo: number;
  barkodNo: string;
  olcuResmiPozNo?: string | null;
  aciklama: string;
  /** Bu sandık satırına 3K'da gelen miktar. */
  gelenMiktar: number;
  /** Bu sandık satırında kullanılabilir net miktar. */
  netKullanilabilir: number;
}

export interface TopluTamGeldiDto {
  projeId: number;
  cekiSatiriIdler: number[];
  secimler?: UcKTopluSecimDto[];
  aciklama?: string;
}

export interface UcKTopluSecimDto {
  cekiSatiriId: number;
  sandikIcerikId?: number;
}

export interface UcKDurumSifirlaDto {
  cekiSatiriId: number;
  sandikIcerikId?: number;
  projeId: number;
  aciklama?: string;
}
