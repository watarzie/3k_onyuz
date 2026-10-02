import { FinansIsKategorisi, FinansKarsilanma, FinansOdemeDurumu } from '../../../core/constants/enums';

/**
 * PO/fatura alanındaki kategori kırılımı. Sıra ve anlam sunucudaki FinansKategoriKurali ile aynıdır;
 * değerler FINANS_V2 çeviri anahtarlarıdır.
 */
export const FINANS_KATEGORILERI: readonly { deger: FinansIsKategorisi; anahtar: string }[] = [
  { deger: FinansIsKategorisi.AnaAmbalaj, anahtar: 'MAIN_PACKAGING' },
  { deger: FinansIsKategorisi.SarfKereste, anahtar: 'WASTE_TIMBER' },
  { deger: FinansIsKategorisi.Ilave, anahtar: 'ADDITIONAL' },
  { deger: FinansIsKategorisi.Ic, anahtar: 'INNER_CRATE' },
  { deger: FinansIsKategorisi.Saha, anahtar: 'SITE' },
  { deger: FinansIsKategorisi.Yedek, anahtar: 'SPARE' },
  { deger: FinansIsKategorisi.DigerUretim, anahtar: 'OTHER_PRODUCTION' },
  { deger: FinansIsKategorisi.OzelIs, anahtar: 'SPECIAL_JOB' },
  { deger: FinansIsKategorisi.DuzenliIs, anahtar: 'RECURRING_JOB' },
];

/** Üretim kategorisi mi; özel ve düzenli işler üretim kategorisi değildir (sunucudaki UretimKategorisi). */
export function uretimKategorisi(kategori: FinansIsKategorisi | null | undefined): boolean {
  return kategori != null && kategori !== FinansIsKategorisi.OzelIs && kategori !== FinansIsKategorisi.DuzenliIs;
}

export function kategoriAnahtari(kategori: FinansIsKategorisi | null | undefined): string {
  return FINANS_KATEGORILERI.find((x) => x.deger === kategori)?.anahtar ?? 'OTHER';
}

export function siparisKarsilanmaAnahtari(karsilanma: FinansKarsilanma | null | undefined): string {
  return karsilanma === FinansKarsilanma.Tam
    ? 'FULL_ORDER'
    : karsilanma === FinansKarsilanma.Kismi
      ? 'PARTIAL_ORDER'
      : 'NO_ORDER';
}

export function faturaKarsilanmaAnahtari(karsilanma: FinansKarsilanma | null | undefined): string {
  return karsilanma === FinansKarsilanma.Tam
    ? 'FULL_INVOICE'
    : karsilanma === FinansKarsilanma.Kismi
      ? 'PARTIAL_INVOICE'
      : 'NO_INVOICE';
}

/** Sunucudaki FinansIsDurumu akışı: Sipariş Bekliyor → … → Tamamlandı. */
export function isDurumuAnahtari(durum: number | null | undefined): string {
  return (
    {
      1: 'FLOW_PENDING_ORDER',
      2: 'FLOW_PARTIAL_ORDER',
      3: 'FLOW_ORDERED',
      4: 'FLOW_PARTIAL_INVOICE',
      5: 'FLOW_COMPLETED',
      6: 'FLOW_CANCELLED',
    } as Record<number, string>
  )[durum ?? 0] ?? 'FLOW_PENDING_ORDER';
}

/** Sunucudaki FinansOdemeDurumu (D3): vade ve ödeme işaretinden türetilir, elle atanmaz. */
export function odemeDurumuAnahtari(durum: FinansOdemeDurumu | null | undefined): string {
  return (
    {
      [FinansOdemeDurumu.Bekliyor]: 'PAYMENT_PENDING',
      [FinansOdemeDurumu.VadesiYaklasiyor]: 'PAYMENT_DUE_SOON',
      [FinansOdemeDurumu.VadesiGecti]: 'PAYMENT_OVERDUE',
      [FinansOdemeDurumu.ZamanindaOdendi]: 'PAYMENT_PAID_ON_TIME',
      [FinansOdemeDurumu.GecOdendi]: 'PAYMENT_PAID_LATE',
    } as Record<number, string>
  )[durum ?? 0] ?? 'PAYMENT_PENDING';
}

/** Ödeme durumu rozetinin rengi: ödendi yeşil, yaklaşan/geç ödenen sarı, vadesi geçen kırmızı. */
export function odemeDurumuSinifi(durum: FinansOdemeDurumu | null | undefined): string {
  switch (durum) {
    case FinansOdemeDurumu.ZamanindaOdendi:
      return 'is-active';
    case FinansOdemeDurumu.VadesiYaklasiyor:
    case FinansOdemeDurumu.GecOdendi:
      return 'is-warning';
    case FinansOdemeDurumu.VadesiGecti:
      return 'is-danger';
    default:
      return '';
  }
}

/** Sunucudaki FinansSiparisDurumu: 1 Açık, 2 Kısmi faturalandı, 3 Faturalandı, 4 İptal edildi. */
export function poDurumuAnahtari(durum: number | null | undefined): string {
  return (
    { 1: 'PO_OPEN', 2: 'PO_PARTIAL', 3: 'PO_INVOICED', 4: 'PO_CANCELLED' } as Record<number, string>
  )[durum ?? 0] ?? 'PO_OPEN';
}
