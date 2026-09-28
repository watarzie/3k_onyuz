// ===== Ortak API Response Modeli =====

export interface ApiResult<T> {
  isSuccess: boolean;
  value?: T;
  error?: string;
  statusCode?: number;
}

/**
 * HTTP 202: istek onay kuyruğuna alındı, işlem henüz uygulanmadı. Ekran uygulanmış sonucun akışını
 * (başarı mesajı, listeyi yenileme, sonraki adım) çalıştırmamalıdır. BaseApiService 202'yi hem
 * sonucun statusCode alanına hem yanıt gövdesine (value.statusCode) yansıtır.
 */
export function onayaAlindi(sonuc: { statusCode?: number; value?: unknown } | null | undefined): boolean {
  if (!sonuc) return false;
  if (sonuc.statusCode === 202) return true;
  const govde = sonuc.value;
  return typeof govde === 'object' && govde !== null && (govde as { statusCode?: unknown }).statusCode === 202;
}

export interface PaginatedList<T> {
  items: T[];
  pageNumber: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}
