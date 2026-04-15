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
  },
  PROJE: {
    LIST: `${BASE}/proje`,
    CREATE: `${BASE}/proje`,
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
    DEGISTIR: `${BASE}/sandik/degistir`,
    IPTAL: `${BASE}/sandik/iptal`,
    STOKTAN_KARSILA: `${BASE}/sandik/stoktan-karsila`,
    FBDEN_KARSILA: `${BASE}/sandik/fbden-karsila`,
    TESLIM_AL: `${BASE}/sandik/teslim-al`,
    TOPLU_TESLIM_AL: `${BASE}/sandik/toplu-teslim-al`,
    EKSIK_URUNLER: (projeId: number) => `${BASE}/sandik/${projeId}/eksik-urunler`,
  },
  GRID: {
    URUNLER: (projeId: number) => `${BASE}/grid/${projeId}/urunler`,
    DURUM_GUNCELLE: `${BASE}/grid/durum-guncelle`,
    TOPLU_SEVK: `${BASE}/grid/toplu-sevk`,
  },
  UCK: {
    URUNLER: (projeId: number) => `${BASE}/uck/${projeId}/urunler`,
    DURUM_GUNCELLE: `${BASE}/uck/durum-guncelle`,
  },
  STOK: {
    LIST: `${BASE}/stok`,
    CREATE: `${BASE}/stok`,
    KARSILA: `${BASE}/stok/karsila`,
  },
  FB_TRANSFER: {
    CREATE: `${BASE}/fbtransfer`,
  },
  HAREKET: {
    BY_PROJE: (projeId: number) => `${BASE}/hareketgecmisi/${projeId}/gecmis`,
  },
  KULLANICI: {
    LIST: `${BASE}/kullanici/liste`,
    CREATE: `${BASE}/kullanici/olustur`,
    UPDATE: `${BASE}/kullanici/guncelle`,
    DELETE: (id: number) => `${BASE}/kullanici/${id}/sil`,
  },
  PDF: {
    INDIR: (projeId: number) => `${BASE}/pdf/${projeId}/indir`,
    EXCEL: (projeId: number) => `${BASE}/pdf/${projeId}/excel`,
  },
  LOOKUP: {
    GET: `${BASE}/lookup`,
  },
  ROL: {
    LIST: `${BASE}/rol/liste`,
    DETAY: (id: number) => `${BASE}/rol/${id}/detay`,
    CREATE: `${BASE}/rol/olustur`,
    UPDATE: `${BASE}/rol/guncelle`,
    DELETE: (id: number) => `${BASE}/rol/${id}/sil`,
  },
} as const;
