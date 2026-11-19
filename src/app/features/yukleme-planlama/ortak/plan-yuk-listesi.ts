import { PlanYukKaynagi, PlanYukSatiri } from '../../../shared/models/index';

/**
 * Yük listesinde satırın kimliği: sandık yükünde sandık, elle eklenen yükte grup ve birim. Sunucudaki yük anahtarıyla
 * ("s:{sandıkId}", "m:{grupNo}:{birimNo}") aynıdır; yerleşim sonucu satırla bu anahtarla eşlenir.
 */
export function satirAnahtari(s: Pick<PlanYukSatiri, 'kaynak' | 'sandikId' | 'manuelGrupNo' | 'birimNo'>): string {
  return s.kaynak === PlanYukKaynagi.Sandik ? `s:${s.sandikId}` : `m:${s.manuelGrupNo}:${s.birimNo}`;
}
