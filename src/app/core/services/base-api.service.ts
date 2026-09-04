import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';
import { ApiResult } from '../../shared/models/index';

@Injectable({ providedIn: 'root' })
export class BaseApiService {
  protected http = inject(HttpClient);

  /**
   * Backend başarılı response'larda doğrudan data döner (wrapper yok).
   * Hata durumlarında { message: "..." } döner.
   * Bu yüzden response'u ApiResult<T> formatına map ediyoruz.
   */
  get<T>(url: string, options?: any): Observable<ApiResult<T>> {
    return (this.http.get(url, options) as Observable<T>).pipe(
      map((data) => this.wrapSuccess(data)),
      catchError((err) => this.handleError<T>(err))
    );
  }

  post<T>(url: string, body: unknown, options?: any): Observable<ApiResult<T>> {
    return (this.http.post<T>(url, body, options) as Observable<T>).pipe(
      map((data) => this.wrapSuccess(data)),
      catchError((err) => this.handleError<T>(err))
    );
  }

  put<T>(url: string, body: unknown, options?: any): Observable<ApiResult<T>> {
    return (this.http.put<T>(url, body, options) as Observable<T>).pipe(
      map((data) => this.wrapSuccess(data)),
      catchError((err) => this.handleError<T>(err))
    );
  }

  delete<T>(url: string, options?: any): Observable<ApiResult<T>> {
    return (this.http.delete<T>(url, options) as Observable<T>).pipe(
      map((data) => this.wrapSuccess(data)),
      catchError((err) => this.handleError<T>(err))
    );
  }

  postFormData<T>(url: string, formData: FormData, options?: any): Observable<ApiResult<T>> {
    return (this.http.post<T>(url, formData, options) as Observable<T>).pipe(
      map((data) => this.wrapSuccess(data)),
      catchError((err) => this.handleError<T>(err))
    );
  }

  downloadFile(url: string, options?: any): Observable<Blob> {
    return this.http.get(url, { ...(options ?? {}), responseType: 'blob' as const }) as unknown as Observable<Blob>;
  }

  downloadPostFile(url: string, body: unknown, options?: any): Observable<Blob> {
    return this.http.post(url, body, { ...(options ?? {}), responseType: 'blob' as const }) as unknown as Observable<Blob>;
  }

  /**
   * responseType=blob isteklerinde API'nin JSON hata gövdesi de Blob olarak gelir.
   * İndirme ekranlarının gerçek backend mesajını gösterebilmesi için güvenli şekilde ayrıştırır.
   */
  async downloadErrorMessage(error: unknown, fallback: string): Promise<string> {
    if (!(error instanceof HttpErrorResponse)) return fallback;
    const body = error.error;
    if (body instanceof Blob) {
      try {
        const text = (await body.text()).trim();
        if (!text) return fallback;
        try {
          const json = JSON.parse(text) as { message?: string; error?: string; title?: string };
          return json.message || json.error || json.title || fallback;
        } catch {
          return text;
        }
      } catch {
        return fallback;
      }
    }
    if (typeof body === 'string' && body.trim()) return body.trim();
    if (body && typeof body === 'object') {
      const response = body as { message?: string; error?: string; title?: string };
      return response.message || response.error || response.title || fallback;
    }
    return error.status === 0 ? 'Sunucuya bağlanılamıyor.' : fallback;
  }

  private wrapSuccess<T>(data: T): ApiResult<T> {
    return { isSuccess: true, value: data };
  }

  private handleError<T>(error: HttpErrorResponse): Observable<ApiResult<T>> {
    let message = 'Beklenmeyen bir hata oluştu.';

    // 401 → Email veya şifre hatalı (login isteği)
    if (error.status === 401) {
      message = error.error?.message || 'Email veya şifre hatalı.';
    } else if (error.error?.message) {
      message = error.error.message;
    } else if (error.error?.error) {
      message = error.error.error;
    } else if (error.status === 0) {
      message = 'Sunucuya bağlanılamıyor.';
    }

    const extraProps = typeof error.error === 'object' && error.error !== null ? error.error : {};

    return of({
      ...extraProps,
      isSuccess: false,
      error: message,
      message: message, // component'ler bazen error bazen message property arayabiliyor
      statusCode: error.status,
    } as any);
  }
}
