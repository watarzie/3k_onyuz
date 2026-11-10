import { PlanYukKonumu } from '../../../shared/models/index';

/**
 * Araç içi yükleme sırası: sunucudaki `YuklemeSirasiKurali` (3K.Core) kuralının aynası. Yükler yükleme sırasına, aynı
 * sırada kata göre dizilir; listedeki konum yükün numarasıdır ("No", PDF'teki ile aynı). Adım, aynı yükleme sırasını
 * paylaşan yüklerdir: istif grubu dışarıda hazırlanır ve bütün hâlinde yüklenir.
 */

/** Adımdaki bir yük: yük listesindeki ve rapordaki numarası ile konumu. */
export interface YuklemeAdimYuku {
  no: number;
  konum: PlanYukKonumu;
}

/** Bir yükleme adımı; yükler alt kattan üste. Adım numarası saklanan sıra boşluklu olsa da ardışıktır. */
export interface YuklemeAdimi {
  adimNo: number;
  yuklemeSirasi: number;
  yukler: YuklemeAdimYuku[];
}

/** Yükler yükleme sırasıyla, aynı sırada alt kat önce. */
export function siraliKonumlar(konumlar: readonly PlanYukKonumu[]): PlanYukKonumu[] {
  return [...konumlar].sort((a, b) => a.yuklemeSirasi - b.yuklemeSirasi || a.kat - b.kat);
}

export function yuklemeAdimlari(konumlar: readonly PlanYukKonumu[]): YuklemeAdimi[] {
  const adimlar: YuklemeAdimi[] = [];
  siraliKonumlar(konumlar).forEach((konum, i) => {
    const son = adimlar[adimlar.length - 1];
    if (son && son.yuklemeSirasi === konum.yuklemeSirasi) {
      son.yukler.push({ no: i + 1, konum });
    } else {
      adimlar.push({ adimNo: adimlar.length + 1, yuklemeSirasi: konum.yuklemeSirasi, yukler: [{ no: i + 1, konum }] });
    }
  });
  return adimlar;
}

/** Adım sınır içine çekilir (1…adım sayısı); adım yoksa 0. */
export function adimSinirla(adimNo: number, adimSayisi: number): number {
  return adimSayisi <= 0 ? 0 : Math.min(Math.max(1, Math.trunc(adimNo) || 1), adimSayisi);
}

/** Verilen adımda araçta görünen yükler (o adıma kadar yüklenenler) ve o adımda yüklenenler (vurgulanır). */
export function adimGorunumu(
  adimlar: readonly YuklemeAdimi[],
  adimNo: number,
): { gorunenler: Set<string>; vurgulular: Set<string> } {
  const gorunenler = new Set<string>();
  const vurgulular = new Set<string>();
  for (const a of adimlar) {
    if (a.adimNo > adimNo) break;
    for (const y of a.yukler) {
      gorunenler.add(y.konum.yukAnahtari);
      if (a.adimNo === adimNo) vurgulular.add(y.konum.yukAnahtari);
    }
  }
  return { gorunenler, vurgulular };
}
