import { SurecDurum } from '../../../core/constants/enums';

/** Grid satır durumu seçeneği (süreç, kalite): sunucudaki lookup sayısı, görünen adı ve rozet rengi. */
export interface DurumSecenegi {
  id: number;
  etiket: string;
  renk: string;
}

/** Süreç durumu seçeneği: sunucudaki `SurecDurum` sayısı, `LookupSurecDurum` görünen adı ve rozet rengi. */
export interface SurecSecenegi extends DurumSecenegi {
  id: SurecDurum;
}

/** Atanmamış süreç rozetinin gri tonu. */
export const SUREC_BOS_RENK = '#94a3b8';

/**
 * Grid ekranındaki süreç seçenekleri (toplu atama penceresi, satır içi seçici). Sıra ve adlar sunucudaki lookup
 * tablosuyla aynıdır; renkler Grid ürün tablosundaki süreç rozetleridir.
 */
export const SUREC_SECENEKLERI: readonly SurecSecenegi[] = [
  { id: SurecDurum.Ambar, etiket: 'Ambar', renk: '#607D8B' },
  { id: SurecDurum.Imalat, etiket: 'İmalat', renk: '#3584FC' },
  { id: SurecDurum.Tedarik, etiket: 'Tedarik', renk: '#9C27B0' },
  { id: SurecDurum.Tedarik3KTeslim, etiket: 'Tedarik 3K Teslim', renk: '#1B7D3A' },
  { id: SurecDurum.Sipariste, etiket: 'Siparişte', renk: '#D97706' },
  { id: SurecDurum.Tamamlandi, etiket: 'Tamamlandı', renk: '#25B003' },
];

/** Talep formunda satıra verilebilen süreçler: Tamamlandı nihai durumdur, talep edilen ürüne verilmez. */
export const TALEP_SUREC_SECENEKLERI: readonly SurecSecenegi[] = SUREC_SECENEKLERI.filter(
  s => s.id !== SurecDurum.Tamamlandi,
);

/**
 * Kalite seçenekleri: sunucudaki `LookupKaliteDurum` (1 Onaylandı, 2 Tadilatta). Renkler Grid tablosundaki kalite
 * rozetleridir; Onaylandı dışındaki her kalite değeri turuncudur.
 */
export const KALITE_SECENEKLERI: readonly DurumSecenegi[] = [
  { id: 1, etiket: 'Onaylandı', renk: '#25B003' },
  { id: 2, etiket: 'Tadilatta', renk: '#E65100' },
];

/** Görünen durum adının seçenek listesindeki rozet rengi; boş değer gri, listede olmayan değer `bilinmeyen` döner. */
export function durumRengi(
  secenekler: readonly DurumSecenegi[], etiket?: string | null, bilinmeyen = SUREC_BOS_RENK,
): string {
  if (!etiket) return SUREC_BOS_RENK;
  return secenekler.find(s => s.etiket === etiket)?.renk ?? bilinmeyen;
}

/** Görünen süreç adının rozet rengi; bilinmeyen veya boş değer gri döner. */
export function surecDurumRengi(etiket?: string | null): string {
  return durumRengi(SUREC_SECENEKLERI, etiket);
}

/** Kalite rozet rengi: boş değer gri, Onaylandı yeşil, diğer her değer turuncu (Grid tablosundaki kural). */
export function kaliteDurumRengi(etiket?: string | null): string {
  return durumRengi(KALITE_SECENEKLERI, etiket, '#E65100');
}

/** Kalite sayısının görünen adı; tanımsız değer "-" döner. */
export function kaliteEtiketi(id: number | null | undefined): string {
  return KALITE_SECENEKLERI.find(s => s.id === id)?.etiket ?? '-';
}

/** Süreç sayısının görünen adı; tanımsız değer "-" döner. */
export function surecEtiketi(id: number | null | undefined): string {
  return SUREC_SECENEKLERI.find(s => s.id === id)?.etiket ?? '-';
}

/**
 * Talep formu satırlarını sürece göre gruplar; her grup bir süreç atama isteğidir. Aynı çeki satırı (bölünmüş
 * sandık satırı) bir kez gönderilir. Sıra formdaki ilk görünüşe göredir.
 */
export function talepSurecGruplari(
  items: readonly { cekiSatiriId: number; surecDurumId: number }[],
): { surecDurumId: number; cekiSatiriIdler: number[] }[] {
  const gruplar = new Map<number, Set<number>>();
  for (const item of items) {
    if (!gruplar.has(item.surecDurumId)) gruplar.set(item.surecDurumId, new Set());
    gruplar.get(item.surecDurumId)!.add(item.cekiSatiriId);
  }
  return Array.from(gruplar, ([surecDurumId, idler]) => ({ surecDurumId, cekiSatiriIdler: Array.from(idler) }));
}
