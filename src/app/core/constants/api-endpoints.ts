import { environment } from '@env/environment';

const BASE = environment.apiBaseUrl;

/**
 * API Endpoint sabitleri.
 *
 * Network Tab Best Practice:
 * URL'in son segmenti her zaman açıklayıcı bir isim olmalı (ID değil).
 * Böylece Chrome DevTools Network tab'da "1", "2" yerine
 * "satirlar", "urunler", "detay" gibi anlamlı isimler görünür.
 *
 * Pattern: /api/{controller}/{id}/{action}
 * Ör: /api/sandik/5/icerik → Network'te "icerik" görünür.
 */
export const API = {
  AUTH: {
    LOGIN: `${BASE}/auth/login`,
    SEED_ADMIN: `${BASE}/auth/seed-admin`,
    REFRESH_TOKEN: `${BASE}/auth/refresh-token`,
  },
  PROJE: {
    LIST: `${BASE}/proje`,
    DROPDOWN: `${BASE}/proje/dropdown`,
    CREATE: `${BASE}/proje`,
    SANDIK_KAPAT: `${BASE}/proje/sandik-kapat`,
    SEVK_ET: (id: number) => `${BASE}/proje/${id}/sevk-et`,
    SEVKIYATLAR: (id: number) => `${BASE}/proje/${id}/sevkiyatlar`,
    KILIDI_AC: (id: number) => `${BASE}/proje/${id}/kilidi-ac`,
    SEVK_TARIHI_GUNCELLE: `${BASE}/proje/sevk-tarihi-guncelle`,
    DELETE: (id: number) => `${BASE}/proje/${id}`,
  },
  DASHBOARD: {
    OZET: `${BASE}/dashboard/ozet`,
    PROJELER: (page: number, pageSize: number, projeTipiId?: number | null) =>
      `${BASE}/dashboard/projeler?page=${page}&pageSize=${pageSize}${projeTipiId != null ? `&projeTipiId=${projeTipiId}` : ''}`,
    KRITIK_EKSIKLER: (page: number, pageSize: number) => `${BASE}/dashboard/kritik-eksikler?page=${page}&pageSize=${pageSize}`,
    EKSIK_SIRALAMA: (page: number, pageSize: number) => `${BASE}/dashboard/eksik-siralama?page=${page}&pageSize=${pageSize}`,
  },
  CEKI: {
    YUKLE: `${BASE}/ceki/yukle`,
    SATIRLAR: (cekiId: number) => `${BASE}/ceki/${cekiId}/satirlar`,
  },
  SANDIK: {
    BY_PROJE: (projeId: number) => `${BASE}/sandik/${projeId}/sandiklar`,
    ICERIK: (sandikId: number) => `${BASE}/sandik/${sandikId}/icerik`,
    EKLE: `${BASE}/sandik/ekle`,
    MANUEL_EKLE: `${BASE}/sandik/manuel-ekle`,
    URUN_GUNCELLE: `${BASE}/sandik/urun-guncelle`,
    CEKI_SATIRI_GUNCELLE: `${BASE}/sandik/ceki-satiri-guncelle`,
    CEKI_SATIRLARI_SIL: `${BASE}/sandik/ceki-satirlari-sil`,
    OZELLIK_GUNCELLE: `${BASE}/sandik/ozellik-guncelle`,
    DEGISTIR: `${BASE}/sandik/degistir`,
    IPTAL: `${BASE}/sandik/iptal`,
    STOKTAN_KARSILA: `${BASE}/sandik/stoktan-karsila`,
    FBDEN_KARSILA: `${BASE}/sandik/fbden-karsila`,
    TESLIM_AL: `${BASE}/sandik/teslim-al`,
    TOPLU_TESLIM_AL: `${BASE}/sandik/toplu-teslim-al`,
    EKSIK_URUNLER: (projeId: number) => `${BASE}/sandik/${projeId}/eksik-urunler`,
    KAPAT: `${BASE}/sandik/kapat`,
    TOPLU_KAPAT: `${BASE}/sandik/toplu-kapat`,
    LOKASYON_GUNCELLE: `${BASE}/sandik/lokasyon-guncelle`,
    URUN_TASI: `${BASE}/sandik/urun-tasi`,
    SAHA_YEDEK_MALZEME_EKLE: `${BASE}/sandik/saha-yedek-malzeme-ekle`,
    SEVK_ET: `${BASE}/sandik/sevk-et`,
    MANUEL_URUN_SIL: `${BASE}/sandik/manuel-urun-sil`,
    SIL: `${BASE}/sandik/sil`,
    EKSIK_URUNLER_BY_PROJE: (projeId: number) => `${BASE}/sandik/eksik-urunler-by-proje/${projeId}`,
  },
  GRID: {
    URUNLER: (projeId: number) => `${BASE}/grid/${projeId}/urunler`,
    DURUM_GUNCELLE: `${BASE}/grid/durum-guncelle`,
    DURUM_SIFIRLA: `${BASE}/grid/durum-sifirla`,
    TOPLU_SEVK: `${BASE}/grid/toplu-sevk`,
    TOPLU_DURUM_GUNCELLE: `${BASE}/grid/toplu-durum-guncelle`,
    TOPLU_SIFIRLA: `${BASE}/grid/toplu-sifirla`,
    MANUEL_EKLE: `${BASE}/grid/manuel-urun-ekle`,
    KALITE_DURUM: `${BASE}/grid/kalite-durum`,
    SUREC_DURUM: `${BASE}/grid/surec-durum`,
  },
  UCK: {
    URUNLER: (projeId: number) => `${BASE}/uck/${projeId}/urunler`,
    IS_LISTESI: `${BASE}/uck/is-listesi`,
    DURUM_GUNCELLE: `${BASE}/uck/durum-guncelle`,
    DURUM_SIFIRLA: `${BASE}/uck/durum-sifirla`,
    TOPLU_TAM_GELDI: `${BASE}/uck/toplu-tam-geldi`,
    TOPLU_TEDARIKCI: `${BASE}/uck/toplu-tedarikci`,
    TOPLU_SIFIRLA: `${BASE}/uck/toplu-sifirla`,
  },
  STOK: {
    LIST: `${BASE}/stok`,
    CREATE: `${BASE}/stok`,
    KARSILA: `${BASE}/stok/karsila`,
  },
  ONAY: {
    BEKLEYENLER: `${BASE}/onay`,
    BEKLEYEN_SAYISI: `${BASE}/onay/bekleyen-sayisi`,
    ONAYLA: `${BASE}/onay/onayla`,
    REDDET: `${BASE}/onay/reddet`,
    SSE_STREAM: `${BASE}/onay/sse-stream`,
  },
  HAREKET: {
    BY_PROJE: (projeId: number) => `${BASE}/hareketgecmisi/${projeId}/gecmis`,
  },
  KULLANICI: {
    LIST: `${BASE}/kullanici/liste`,
    CREATE: `${BASE}/kullanici/olustur`,
    UPDATE: `${BASE}/kullanici/guncelle`,
    DELETE: (id: number) => `${BASE}/kullanici/${id}/sil`,
    SIFRE_DEGISTIR: `${BASE}/kullanici/sifre-degistir`,
  },
  PDF: {
    INDIR: (projeId: number) => `${BASE}/pdf/${projeId}/indir`,
    EXCEL: (projeId: number) => `${BASE}/pdf/${projeId}/excel`,
    SAHA_SANDIK: (sandikId: number) => `${BASE}/pdf/saha-sandik/${sandikId}`,
    SAHA_PROJE: (projeId: number) => `${BASE}/pdf/saha-proje/${projeId}`,
    EKSIK_URUNLER: (projeId: number) => `${BASE}/pdf/eksik-urunler/${projeId}`,
    EKSIK_URUNLER_EXCEL: (projeId: number) => `${BASE}/pdf/eksik-urunler/${projeId}/excel`,
    GERCEKLESEN_CEKI_LISTESI: (projeId: number) => `${BASE}/pdf/gerceklesen-ceki-listesi/${projeId}`,
    GERCEKLESEN_CEKI_LISTESI_EXCEL: (projeId: number) => `${BASE}/pdf/gerceklesen-ceki-listesi/${projeId}/excel`,
    STOK: `${BASE}/pdf/stok`,
    DEPO_SANDIK: (projeTipiId?: number | null) =>
      projeTipiId ? `${BASE}/pdf/depo-sandik?projeTipiId=${projeTipiId}` : `${BASE}/pdf/depo-sandik`,
  },
  LOOKUP: {
    GET: `${BASE}/lookup`,
    DEPO_LOKASYON: `${BASE}/lookup/depo-lokasyon`,
    DEPO_LOKASYON_DELETE: (id: number) => `${BASE}/lookup/depo-lokasyon/${id}`,
  },
  ROL: {
    LIST: `${BASE}/rol/liste`,
    DETAY: (id: number) => `${BASE}/rol/${id}/detay`,
    CREATE: `${BASE}/rol/olustur`,
    UPDATE: `${BASE}/rol/guncelle`,
    DELETE: (id: number) => `${BASE}/rol/${id}/sil`,
  },
  MENU: {
    KULLANICI_MENU: `${BASE}/menu/kullanici-menu`,
  },
} as const;
