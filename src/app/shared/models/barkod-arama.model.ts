/**
 * Barkodla ürün arama (sunucu BarkodUrunAramaSonucu): barkodun bütün projelerdeki satırları. Barkod tam eşleşir
 * (büyük/küçük harf ve kenar boşluğu önemsiz); eksik Eksik Ürünler raporunun kalan miktarıdır.
 */
export interface BarkodUrunAramaSonucu {
  barkod: string;
  aciklama?: string | null;
  yalnizEksikler: boolean;
  projeTipiId?: number | null;
  olusturmaTarihi: string;
  satirlar: BarkodUrunSatiri[];
  /** Süzgeçten önce barkodun bütün satırları. */
  toplamSatir: number;
  projeSayisi: number;
  eksikSatir: number;
  eksikProjeSayisi: number;
  toplamEksik: number;
  /** Satır sınırı aşıldı; yalnız ilk satırlar döndü. */
  sinirli: boolean;
}

/** Bir projedeki satır; elle eklenen satır saha/yedek sandığına çeki satırı olmadan eklenmiş malzemedir. */
export interface BarkodUrunSatiri {
  projeId: number;
  projeNo: string;
  projeTipiId: number;
  projeTipi: string;
  musteri: string;
  projeDurumu: string;
  sandikNo: string;
  siraNo?: number | null;
  pozNo?: string | null;
  aciklama: string;
  birim?: string | null;
  istenen: number;
  gridGelen: number;
  ucKGelen: number;
  eksik: number;
  gridDurumu: string;
  ucKDurumu: string;
  sevkDurumu: string;
  elleEklenen: boolean;
}

export interface BarkodUrunAramaParams {
  barkod: string;
  yalnizEksikler: boolean;
  projeTipiId?: number | null;
}
