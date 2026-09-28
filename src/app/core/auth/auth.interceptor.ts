import { HttpInterceptorFn, HttpErrorResponse, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, finalize, map, shareReplay, switchMap } from 'rxjs/operators';
import { SessionManager } from '../managers/session.manager';
import { AuthService } from './auth.service';
import { BaseApiService } from '../services/base-api.service';
import { API } from '../constants/api-endpoints';

/**
 * Auth Interceptor — Silent Refresh Token
 *
 * 1. Her isteğe Authorization header ekler (parola ve 2FA adımları hariç).
 * 2. 401 alan istek tek ve paylaşılan bir token yenilemesini bekler, yeni token ile tekrar gönderilir.
 *    Eşzamanlı 401'ler aynı yenilemeyi paylaşır; yenilemeyi başlatan isteğin iptali yenilemeyi durdurmaz.
 * 3. Yenilenemezse oturum bir kez kapatılır ve bekleyen bütün istekler hatayla sonlanır.
 * 4. Refresh endpoint'inin kendi 401'i yeni bir yenileme başlatmaz.
 */

/** Süren yenileme; tamamlanınca (başarı veya hata) sıfırlanır. */
let suregelenYenileme: Observable<string> | null = null;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const session = inject(SessionManager);
  const authService = inject(AuthService);
  const api = inject(BaseApiService);

  // Parola ve 2FA challenge istekleri tam oturum değildir. Eski bir oturum
  // bulunsa dahi bearer başlığını bu isteklere taşımıyoruz.
  const preAuthenticationRequest = isPreAuthenticationRequest(req.url);
  const cloned = preAuthenticationRequest
    ? removeAuthContext(req)
    : addAuthContext(req, session.token);

  return next(cloned).pipe(
    catchError((error) => {
      // Login/2FA hataları kendi ekranında, yenilemenin kendi hatası yenileme akışında ele alınır.
      const yenilenebilir = error instanceof HttpErrorResponse && error.status === 401 &&
        !preAuthenticationRequest && !isRefreshRequest(req.url);
      if (!yenilenebilir) return throwError(() => error);

      return tokenYenile(api, session, authService).pipe(
        switchMap((token) => next(addAuthContext(req, token)))
      );
    })
  );
};

/**
 * Aynı anda tek yenileme yapılır; bekleyenler sonucunu (token veya hata) paylaşır. Kaynağa abonelik
 * sayaçla bağlı değildir, böylece ilk bekleyenin iptali yenilemeyi iptal etmez.
 */
function tokenYenile(api: BaseApiService, session: SessionManager, authService: AuthService): Observable<string> {
  suregelenYenileme ??= api.post<{ token: string }>(API.AUTH.REFRESH_TOKEN, {}).pipe(
    map((result) => {
      if (!result.isSuccess || !result.value?.token) throw new Error('Token yenilenemedi.');
      session.setToken(result.value.token);
      authService.currentUser.set(session.getUser());
      return result.value.token;
    }),
    catchError((error) => {
      authService.logout();
      return throwError(() => error);
    }),
    finalize(() => (suregelenYenileme = null)),
    shareReplay({ bufferSize: 1, refCount: false })
  );
  return suregelenYenileme;
}

function isPreAuthenticationRequest(url: string): boolean {
  return /\/auth\/(?:login|2fa(?:\/|$))/i.test(url);
}

function isRefreshRequest(url: string): boolean {
  return url.includes('refresh-token');
}

function removeAuthContext(req: HttpRequest<unknown>): HttpRequest<unknown> {
  const headers = req.headers.delete('Authorization');
  return headers === req.headers ? req : req.clone({ headers });
}

/** Yetki sunucuda menü kodlarıyla belirlenir; istemci yalnız kimliğini (bearer) gönderir. */
function addAuthContext(req: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> {
  return token && !req.headers.has('Authorization')
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;
}
