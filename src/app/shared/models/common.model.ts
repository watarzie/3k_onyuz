// ===== Ortak API Response Modeli =====

export interface ApiResult<T> {
  isSuccess: boolean;
  value?: T;
  error?: string;
  statusCode?: number;
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
