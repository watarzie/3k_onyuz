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
    EKSIKLERDEN_SAHA_OLUSTUR: `${BASE}/proje/eksiklerden-saha-olustur`,
    SANDIKLARDAN_SAHA_OLUSTUR: `${BASE}/proje/sandiklardan-saha-olustur`,
    SAHA_AKTARIM_GERI_AL: `${BASE}/proje/saha-aktarim-geri-al`,
    SAHA_AKTARIMLARI: (id: number) => `${BASE}/proje/${id}/saha-aktarimlari`,
    SANDIK_KAPAT: `${BASE}/proje/sandik-kapat`,
    SEVK_ET: (id: number) => `${BASE}/proje/${id}/sevk-et`,
    SEVKIYATLAR: (id: number) => `${BASE}/proje/${id}/sevkiyatlar`,
    KILIDI_AC: (id: number) => `${BASE}/proje/${id}/kilidi-ac`,
    SEVK_TARIHI_GUNCELLE: `${BASE}/proje/sevk-tarihi-guncelle`,
    DELETE: (id: number) => `${BASE}/proje/${id}`,
  },
  AMBALAJ: {
    PROJELER: `${BASE}/ambalaj/projeler`,
    PLAN: (projeId: number, kaynakProjeTipiId?: number, grup?: number) => {
      const params = new URLSearchParams();
      if (kaynakProjeTipiId) params.set('kaynakProjeTipiId', kaynakProjeTipiId.toString());
      if (grup) params.set('grup', grup.toString());
      const query = params.toString();
      return `${BASE}/ambalaj/projeler/${projeId}/plan${query ? `?${query}` : ''}`;
    },
    KALEMLER: (projeId: number) => `${BASE}/ambalaj/projeler/${projeId}/kalemler`,
    KALEM: (kalemId: number) => `${BASE}/ambalaj/kalemler/${kalemId}`,
    BAGIMSIZ_SANDIKLAR: (tur?: number) => `${BASE}/ambalaj/bagimsiz-sandiklar${tur ? `?tur=${tur}` : ''}`,
    BAGIMSIZ_SANDIK: (sandikId: number) => `${BASE}/ambalaj/bagimsiz-sandiklar/${sandikId}`,
    IC_SANDIK_SABLONLARI: `${BASE}/ambalaj/ic-sandik-sablonlari`,
    IC_SANDIK_SABLONU: (sablonId: number) => `${BASE}/ambalaj/ic-sandik-sablonlari/${sablonId}`,
  },
  DASHBOARD: {
    OZET: `${BASE}/dashboard/ozet`,
    PROJELER: (page: number, pageSize: number, projeTipiId?: number | null) =>
      `${BASE}/dashboard/projeler?page=${page}&pageSize=${pageSize}${projeTipiId != null ? `&projeTipiId=${projeTipiId}` : ''}`,
    KRITIK_EKSIKLER: (page: number, pageSize: number) => `${BASE}/dashboard/kritik-eksikler?page=${page}&pageSize=${pageSize}`,
    EKSIK_SIRALAMA: (page: number, pageSize: number) => `${BASE}/dashboard/eksik-siralama?page=${page}&pageSize=${pageSize}`,
    SAHAYA_AKTARILAN_SANDIKLAR: (page: number, pageSize: number, projeId?: number | null) =>
      `${BASE}/dashboard/sahaya-aktarilan-sandiklar?page=${page}&pageSize=${pageSize}${projeId ? `&projeId=${projeId}` : ''}`,
    PROJE_SECENEKLERI: (searchTerm = '', projeTipiId?: number | null, sadeceSandikAktarimli = false, take = 30) =>
      `${BASE}/dashboard/proje-secenekleri?take=${take}&sadeceSandikAktarimli=${sadeceSandikAktarimli}${projeTipiId ? `&projeTipiId=${projeTipiId}` : ''}${searchTerm.trim() ? `&searchTerm=${encodeURIComponent(searchTerm.trim())}` : ''}`,
    PROJE_SANDIK_DURUMLARI: (projeId: number) => `${BASE}/dashboard/projeler/${projeId}/sandik-durumlari`,
    PROJE_DURUM_SANDIKLARI: (projeId: number, durumId: number, page: number, pageSize: number, searchTerm = '') =>
      `${BASE}/dashboard/projeler/${projeId}/sandiklar?durumId=${durumId}&page=${page}&pageSize=${pageSize}${searchTerm.trim() ? `&searchTerm=${encodeURIComponent(searchTerm.trim())}` : ''}`,
  },
  CEKI: {
    YUKLE: `${BASE}/ceki/yukle`,
    REVIZYON_ONIZLE: `${BASE}/ceki/revizyon-onizle`,
    REVIZYON_YUKLE: `${BASE}/ceki/revizyon-yukle`,
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
    KILIDI_AC: `${BASE}/sandik/kilidi-ac`,
    SEVKIYAT_DUZELTME_TAMAMLA: `${BASE}/sandik/sevkiyat-duzeltme-tamamla`,
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
    DELETE: (id: number) => `${BASE}/stok/${id}`,
  },
  ONAY: {
    BEKLEYENLER: `${BASE}/onay`,
    BEKLEYEN_SAYISI: `${BASE}/onay/bekleyen-sayisi`,
    GECMIS: `${BASE}/onay/gecmis`,
    GECMIS_DETAY: (id: number) => `${BASE}/onay/gecmis/${id}`,
    ONAYLA: `${BASE}/onay/onayla`,
    REDDET: `${BASE}/onay/reddet`,
    SSE_STREAM: `${BASE}/onay/sse-stream`,
  },
  BILDIRIM: {
    LIST: `${BASE}/bildirimler`,
    DETAY: (bildirimId: number) => `${BASE}/bildirimler/${bildirimId}`,
    OKUNMAMIS: `${BASE}/bildirimler/okunmamis`,
    OKUNDU: (bildirimId: number) => `${BASE}/bildirimler/${bildirimId}/okundu`,
    TUMUNU_OKUNDU: `${BASE}/bildirimler/tumunu-okundu`,
    ABONELIK_AYARLARI: `${BASE}/bildirimler/abonelik-ayarlari`,
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
    SAHA_GERCEKLESEN_CEKI_LISTESI: (projeId: number) => `${BASE}/pdf/saha-gerceklesen-ceki-listesi/${projeId}`,
    SAHA_GERCEKLESEN_CEKI_LISTESI_EXCEL: (projeId: number) => `${BASE}/pdf/saha-gerceklesen-ceki-listesi/${projeId}/excel`,
    UCK_SANDIK_DURUM: (projeId: number) => `${BASE}/pdf/uck-sandik-durum/${projeId}`,
    STOK: `${BASE}/pdf/stok`,
    DEPO_SANDIK: (projeTipiId?: number | null) =>
      projeTipiId ? `${BASE}/pdf/depo-sandik?projeTipiId=${projeTipiId}` : `${BASE}/pdf/depo-sandik`,
    DEPO_SANDIK_PROJE: (projeId: number) => `${BASE}/pdf/depo-sandik/proje/${projeId}`,
    AMBALAJ_URETIM: (projeId: number, tur?: number | null) =>
      `${BASE}/pdf/ambalaj-uretim/${projeId}${tur ? `?tur=${tur}` : ''}`,
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
