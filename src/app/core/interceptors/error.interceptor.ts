import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { TranslationService } from '../services/translation.service';

/**
 * Merkezi HTTP hata yakalayıcı interceptor.
 * Backend'den gelen hataları yakalar, kullanıcıya anlamlı mesajlar gösterir.
 * befasoft-app referans mimarisinden adapte edildi.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const ts = inject(TranslationService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      let errorMessage = '';

      // 1. Backend'den gelen Result pattern formatındaki hataları yakala
      if (error.error && typeof error.error === 'object' && 'message' in error.error) {
        errorMessage = error.error.message;
      }
      // 2. İnternet bağlantısı veya sunucuya ulaşılamama hatası
      else if (error.status === 0) {
        errorMessage = ts.translate('MESSAGES.SERVER_CONNECTION_ERROR');
      }
      // 3. Genel HTTP hataları
      else {
        errorMessage = `HTTP ${error.status}: ${error.statusText}`;
      }

      // Hatayı konsola logla
      console.error(`[ErrorInterceptor] ${error.status} - ${errorMessage}`, error);

      // Hatayı, onu yakalamak isteyebilecek diğer servislere yeniden fırlat
      return throwError(() => error);
    })
  );
};
