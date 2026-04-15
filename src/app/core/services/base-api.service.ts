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
  get<T>(url: string): Observable<ApiResult<T>> {
    return this.http.get<T>(url).pipe(
      map((data) => this.wrapSuccess(data)),
      catchError((err) => this.handleError<T>(err))
    );
  }

  post<T>(url: string, body: unknown): Observable<ApiResult<T>> {
    return this.http.post<T>(url, body).pipe(
      map((data) => this.wrapSuccess(data)),
      catchError((err) => this.handleError<T>(err))
    );
  }

  put<T>(url: string, body: unknown): Observable<ApiResult<T>> {
    return this.http.put<T>(url, body).pipe(
      map((data) => this.wrapSuccess(data)),
      catchError((err) => this.handleError<T>(err))
    );
  }

  delete<T>(url: string): Observable<ApiResult<T>> {
    return this.http.delete<T>(url).pipe(
      map((data) => this.wrapSuccess(data)),
      catchError((err) => this.handleError<T>(err))
    );
  }

  postFormData<T>(url: string, formData: FormData): Observable<ApiResult<T>> {
    return this.http.post<T>(url, formData).pipe(
      map((data) => this.wrapSuccess(data)),
      catchError((err) => this.handleError<T>(err))
    );
  }

  downloadFile(url: string): Observable<Blob> {
    return this.http.get(url, { responseType: 'blob' });
  }

  private wrapSuccess<T>(data: T): ApiResult<T> {
    return { isSuccess: true, value: data };
  }

  private handleError<T>(error: HttpErrorResponse): Observable<ApiResult<T>> {
    let message = 'Beklenmeyen bir hata oluştu.';
    if (error.error?.message) {
      message = error.error.message;
    } else if (error.error?.error) {
      message = error.error.error;
    } else if (error.message) {
      message = error.message;
    }
    return of({
      isSuccess: false,
      error: message,
      statusCode: error.status,
    });
  }
}
