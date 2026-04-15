// ===== Ortak API Response Modeli =====

export interface ApiResult<T> {
  isSuccess: boolean;
  value?: T;
  error?: string;
  statusCode?: number;
}
