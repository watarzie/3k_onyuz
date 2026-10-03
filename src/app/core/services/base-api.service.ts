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
          return (json.message || json.error || json.title || fallback) + this.takipEki(error);
        } catch {
          return text + this.takipEki(error);
        }
      } catch {
        return fallback + this.takipEki(error);
      }
    }
    if (typeof body === 'string' && body.trim()) return body.trim() + this.takipEki(error);
    if (body && typeof body === 'object') {
      const response = body as { message?: string; error?: string; title?: string };
      return (response.message || response.error || response.title || fallback) + this.takipEki(error);
    }
    return error.status === 0 ? 'Sunucuya bağlanılamıyor.' : fallback + this.takipEki(error);
  }

  /**
   * Sunucunun her yanıta koyduğu takip kodu (X-Correlation-ID). Hata bildiriminde gösterilir; kullanıcı
   * bu kodu ilettiğinde sunucu logundaki iş hatası satırı doğrudan bulunur. Giriş/oturum (401) ve
   * bağlantı hatalarında gösterilmez.
   */
  private takipKodu(error: HttpErrorResponse): string | null {
    if (error.status < 400 || error.status === 401) return null;
    const kod = error.headers?.get('X-Correlation-ID')?.trim();
    return kod && /^[A-Za-z0-9-]{4,64}$/.test(kod) ? kod : null;
  }

  private takipEki(error: HttpErrorResponse): string {
    const kod = this.takipKodu(error);
    return kod ? ` · Takip: ${kod}` : '';
  }

  private wrapSuccess<T>(data: T): ApiResult<T> {
    // Onay kuyruğuna kabul, işin uygulanmış sonucu değildir. HTTP 202 gövdesi
    // mevcut API sözleşmesinde bu alanı taşır; çağıran ekran bunu ayırabilmelidir.
    if (data && typeof data === 'object' && 'statusCode' in data && data.statusCode === 202) {
      return { isSuccess: true, value: data, statusCode: 202 };
    }
    if (data && typeof data === 'object' && 'isSuccess' in data && data.isSuccess === false) {
      return data as unknown as ApiResult<T>;
    }
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
    const takipKodu = this.takipKodu(error);
    if (takipKodu) message += ` · Takip: ${takipKodu}`;

    return of({
      ...extraProps,
      isSuccess: false,
      error: message,
      message: message, // component'ler bazen error bazen message property arayabiliyor
      statusCode: error.status,
      ...(takipKodu ? { takipKodu } : {}),
    } as any);
  }
}
