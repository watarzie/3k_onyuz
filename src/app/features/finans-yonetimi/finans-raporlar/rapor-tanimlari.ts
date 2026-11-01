import { FinansGiderRaporuGruplamasi, FinansIsRaporuKapsami } from '../../../core/constants/enums';

/** Sunucudaki rapor türü (`raporlar/onizleme/{tur}`); değerler API sözleşmesidir, çevrilmez. */
export type FinansRaporTuru =
  | 'is'
  | 'gider'
  | 'finansal-durum'
  | 'alacak'
  | 'genel'
  | 'gider-kategori'
  | 'proje-maliyet'
  | 'siparis-bekleyen'
  | 'fatura-bekleyen';

/** Rapora özel seçim: işlerde kapsam, giderde gruplama. */
export type FinansRaporSecimi = 'kapsam' | 'gruplama';

export interface FinansRaporTanimi {
  tur: FinansRaporTuru;
  /** `FINANS_V2.*` çeviri anahtarları. */
  baslik: string;
  aciklama: string;
  ikon: string;
  grup: 'ana' | 'ozet';
  secim?: FinansRaporSecimi;
  /**
   * Sunucunun bu raporda uyguladığı filtreler. Dönem ve para birimi her raporda vardır; finansal durum yalnız bunları
   * kullanır (Kontrol Paneliyle aynı tutar), alacak raporu ödeme durumunu da alır.
   */
  projeVeArama: boolean;
  gelismis: boolean;
  odeme: boolean;
}

export const FINANS_RAPORLARI: readonly FinansRaporTanimi[] = [
  { tur: 'is', baslik: 'REPORT_WORK', aciklama: 'REPORT_WORK_DESC', ikon: 'ri-file-list-3-line', grup: 'ana', secim: 'kapsam', projeVeArama: true, gelismis: true, odeme: false },
  { tur: 'gider', baslik: 'REPORT_EXPENSE', aciklama: 'REPORT_EXPENSE_DESC', ikon: 'ri-wallet-3-line', grup: 'ana', secim: 'gruplama', projeVeArama: true, gelismis: true, odeme: false },
  { tur: 'finansal-durum', baslik: 'REPORT_FINANCIAL', aciklama: 'REPORT_FINANCIAL_DESC', ikon: 'ri-scales-3-line', grup: 'ana', projeVeArama: false, gelismis: false, odeme: false },
  { tur: 'alacak', baslik: 'REPORT_RECEIVABLES', aciklama: 'REPORT_RECEIVABLES_DESC', ikon: 'ri-hand-coin-line', grup: 'ana', projeVeArama: true, gelismis: true, odeme: true },
  { tur: 'genel', baslik: 'REPORT_SUMMARY', aciklama: 'REPORT_SUMMARY_DESC', ikon: 'ri-pie-chart-2-line', grup: 'ozet', projeVeArama: true, gelismis: true, odeme: false },
  { tur: 'gider-kategori', baslik: 'REPORT_CATEGORY', aciklama: 'REPORT_CATEGORY_DESC', ikon: 'ri-price-tag-3-line', grup: 'ozet', projeVeArama: true, gelismis: true, odeme: false },
  { tur: 'proje-maliyet', baslik: 'REPORT_COST', aciklama: 'REPORT_COST_DESC', ikon: 'ri-building-2-line', grup: 'ozet', projeVeArama: true, gelismis: true, odeme: false },
  { tur: 'siparis-bekleyen', baslik: 'REPORT_PENDING_ORDER', aciklama: 'REPORT_PENDING_ORDER_DESC', ikon: 'ri-time-line', grup: 'ozet', projeVeArama: true, gelismis: true, odeme: false },
  { tur: 'fatura-bekleyen', baslik: 'REPORT_PENDING_INVOICE', aciklama: 'REPORT_PENDING_INVOICE_DESC', ikon: 'ri-bill-line', grup: 'ozet', projeVeArama: true, gelismis: true, odeme: false },
];

export const FINANS_RAPOR_GRUPLARI = [
  { anahtar: 'ana', baslik: 'REPORT_GROUP_MAIN', raporlar: FINANS_RAPORLARI.filter((r) => r.grup === 'ana') },
  { anahtar: 'ozet', baslik: 'REPORT_GROUP_SUMMARY', raporlar: FINANS_RAPORLARI.filter((r) => r.grup === 'ozet') },
] as const;

export const IS_RAPORU_KAPSAMLARI: readonly { deger: FinansIsRaporuKapsami; etiket: string }[] = [
  { deger: FinansIsRaporuKapsami.Birlesik, etiket: 'REPORT_SCOPE_COMBINED' },
  { deger: FinansIsRaporuKapsami.SiparisiAcilan, etiket: 'REPORT_SCOPE_ORDERED' },
  { deger: FinansIsRaporuKapsami.SiparisiAcilmayan, etiket: 'REPORT_SCOPE_NOT_ORDERED' },
];

export const GIDER_RAPORU_GRUPLAMALARI: readonly { deger: FinansGiderRaporuGruplamasi; etiket: string }[] = [
  { deger: FinansGiderRaporuGruplamasi.Duz, etiket: 'REPORT_GROUPING_FLAT' },
  { deger: FinansGiderRaporuGruplamasi.Kategori, etiket: 'REPORT_GROUPING_CATEGORY' },
  { deger: FinansGiderRaporuGruplamasi.Proje, etiket: 'REPORT_GROUPING_PROJECT' },
];

/** Bilinmeyen tür işler raporuna düşer (sunucu da bilinmeyen özet türünü reddeder). */
export function raporTanimi(tur: string): FinansRaporTanimi {
  return FINANS_RAPORLARI.find((r) => r.tur === tur) ?? FINANS_RAPORLARI[0];
}
