const BASE = 'http://localhost:50447/api';

export const API = {
  AUTH: {
    LOGIN: `${BASE}/auth/login`,
    REGISTER: `${BASE}/auth/register`,
    SEED_ADMIN: `${BASE}/auth/seed-admin`,
  },
  PROJE: {
    LIST: `${BASE}/proje`,
    CREATE: `${BASE}/proje`,
  },
  CEKI: {
    YUKLE: `${BASE}/ceki/yukle`,
    SATIRLAR: (cekiId: number) => `${BASE}/ceki/satirlar/${cekiId}`,
  },
  SANDIK: {
    BY_PROJE: (projeId: number) => `${BASE}/sandik/proje/${projeId}`,
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
    EKSIK_URUNLER: (projeId: number) => `${BASE}/sandik/eksik-urunler/${projeId}`,
  },
  GRID: {
    URUNLER: (projeId: number) => `${BASE}/grid/urunler/${projeId}`,
    DURUM_GUNCELLE: `${BASE}/grid/durum-guncelle`,
    TOPLU_SEVK: `${BASE}/grid/toplu-sevk`,
  },
  UCK: {
    URUNLER: (projeId: number) => `${BASE}/uck/urunler/${projeId}`,
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
    BY_PROJE: (projeId: number) => `${BASE}/hareketgecmisi/proje/${projeId}`,
  },
  KULLANICI: {
    LIST: `${BASE}/kullanici`,
  },
  PDF: {
    INDIR: (projeId: number) => `${BASE}/pdf/indir/${projeId}`,
    EXCEL: (projeId: number) => `${BASE}/pdf/excel/${projeId}`,
  },
} as const;
