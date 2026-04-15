/**
 * Lookup tabloları için ortak model.
 * Backend'deki LookupBase → LookupItemDto ile birebir eşleşir.
 */
export interface LookupItem {
  id: number;
  anahtar: number;
  deger: string;
}

/**
 * Lookup API response formatı.
 * Key: entity adı (örn: "LookupProjeDurum")
 * Value: LookupItem listesi
 */
export type LookupResponse = Record<string, LookupItem[]>;
