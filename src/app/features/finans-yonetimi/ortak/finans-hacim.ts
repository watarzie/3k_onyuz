import { FinansSandikMalzemesi } from '../../../core/constants/enums';

/** Sunucudaki FinansHacimKurallari.EnFazlaM3 ile aynı üst sınır. */
export const FINANS_HACIM_EN_FAZLA = 999_999;

/** Bileşik toplam = ahşap m³ + kontra m³ (altı ondalık); boş değer 0 sayılır. */
export function finansHacimBilesik(ahsap: number | null | undefined, kontra: number | null | undefined): number {
  return Math.round(((Number(ahsap) || 0) + (Number(kontra) || 0)) * 1_000_000) / 1_000_000;
}

/** Elle hacim girişi: değerler sıfır veya pozitif, en az biri sıfırdan büyük ve üst sınırın altında. */
export function finansHacimGecerli(ahsap: number | null | undefined, kontra: number | null | undefined): boolean {
  const a = Number(ahsap ?? 0);
  const k = Number(kontra ?? 0);
  return Number.isFinite(a) && Number.isFinite(k) && a >= 0 && k >= 0 && a + k > 0
    && a <= FINANS_HACIM_EN_FAZLA && k <= FINANS_HACIM_EN_FAZLA;
}

/**
 * Ahşap/kontra m³ elle girilebilir mi (sunucudaki FinansHacimKurallari.ElleGirilebilir ile aynı): Ambalaj'ın m³
 * hesaplamadığı kontrplak/katlanır sandıkta; daha önce elle girilmiş hacim (ör. özel iş) düzeltilebilir kalır.
 */
export function finansHacimElleGirilir(malzeme: FinansSandikMalzemesi | 0 | null | undefined, hacimManuel: boolean | null | undefined): boolean {
  return hacimManuel === true || malzeme === FinansSandikMalzemesi.Kontra;
}

/**
 * Ahşap sandıkta ahşap m³ üretimden gelir ve ekranda salt okunur kalır; kontra/katlanır ve malzemesi belirsiz
 * işlerde (ör. özel iş) iki değer de elle girilir.
 */
export function finansAhsapUretimden(malzeme: FinansSandikMalzemesi | 0 | null | undefined): boolean {
  return malzeme === FinansSandikMalzemesi.Ahsap;
}
