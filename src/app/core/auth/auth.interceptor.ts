import { HttpInterceptorFn, HttpErrorResponse, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, filter, switchMap, take } from 'rxjs/operators';
import { SessionManager } from '../managers/session.manager';
import { AuthService } from './auth.service';
import { BaseApiService } from '../services/base-api.service';
import { API } from '../constants/api-endpoints';

/**
 * Auth Interceptor — Silent Refresh Token & Request Queue
 *
 * 1. Her isteğe Authorization header ekler.
 * 2. 401 hatası alınırsa:
 *    - İlk 401'de refresh-token isteği atar.
 *    - Eşzamanlı diğer 401'leri BehaviorSubject kuyruğunda bekletir.
 *    - Token yenilenirse bekleyen istekleri yeni token ile tekrar gönderir.
 *    - Yenilenemezse kullanıcıyı logout yapar.
 * 3. Refresh endpoint'inin kendisi 401 alırsa sonsuz döngüye girmez.
 */

let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const session = inject(SessionManager);
  const authService = inject(AuthService);
  const api = inject(BaseApiService);
  const router = inject(Router);

  // Parola ve 2FA challenge istekleri tam oturum değildir. Eski bir oturum
  // bulunsa dahi bearer/menu header'larını bu isteklere taşımıyoruz.
  const preAuthenticationRequest = isPreAuthenticationRequest(req.url);
  const cloned = preAuthenticationRequest
    ? removeAuthContext(req)
    : addAuthContext(req, session.token, getActiveMenuKod(router));

  return next(cloned).pipe(
    catchError((error) => {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        // Login/2FA hataları kendi ekranında ele alınır; silent refresh veya
        // logout yan etkisi challenge akışını bozmasın.
        if (preAuthenticationRequest) {
          return throwError(() => error);
        }

        // Refresh endpoint'i 401 dönerse sonsuz döngüye girme
        if (req.url.includes('refresh-token')) {
          authService.logout();
          return throwError(() => error);
        }
        return handle401(req, next, session, authService, api, router);
      }
      return throwError(() => error);
    })
  );
};

function isPreAuthenticationRequest(url: string): boolean {
  return /\/auth\/(?:login|2fa(?:\/|$))/i.test(url);
}

function removeAuthContext(req: HttpRequest<unknown>): HttpRequest<unknown> {
  const headers = req.headers.delete('Authorization').delete('X-Menu-Kod');
  return headers === req.headers ? req : req.clone({ headers });
}

function addAuthContext(req: HttpRequest<unknown>, token: string | null, menuKod: string | null): HttpRequest<unknown> {
  const headers: Record<string, string> = {};

  if (token && !req.headers.has('Authorization')) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (token && menuKod && !req.headers.has('X-Menu-Kod')) {
    headers['X-Menu-Kod'] = menuKod;
  }

  return Object.keys(headers).length > 0 ? req.clone({ setHeaders: headers }) : req;
}

function getActiveMenuKod(router: Router): string | null {
  let snapshot = router.routerState.snapshot.root;
  let menuKod = snapshot.data?.['menuKod'];

  while (snapshot.firstChild) {
    snapshot = snapshot.firstChild;
    if (snapshot.data?.['menuKod']) {
      menuKod = snapshot.data['menuKod'];
    }
  }

  return typeof menuKod === 'string' && menuKod.trim() ? menuKod : null;
}

function handle401(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  session: SessionManager,
  authService: AuthService,
  api: BaseApiService,
  router: Router
): Observable<any> {
  if (!isRefreshing) {
    // İlk 401 — refresh başlat
    isRefreshing = true;
    refreshTokenSubject.next(null); // Bekleyen istekleri dondur

    return api.post<{ token: string }>(API.AUTH.REFRESH_TOKEN, {}).pipe(
      switchMap((result) => {
        isRefreshing = false;

        if (result.isSuccess && result.value?.token) {
          // Yeni token'ı kaydet
          session.setToken(result.value.token);
          authService.currentUser.set(session.getUser());

          // Bekleyen istekleri serbest bırak
          refreshTokenSubject.next(result.value.token);

          // Orijinal isteği yeni token ile tekrar gönder
          return next(addAuthContext(req, result.value.token, getActiveMenuKod(router)));
        } else {
          // Refresh başarısız — logout
          authService.logout();
          return throwError(() => new Error('Token yenilenemedi.'));
        }
      }),
      catchError((err) => {
        isRefreshing = false;
        authService.logout();
        return throwError(() => err);
      })
    );
  } else {
    // Refresh zaten devam ediyor — kuyruğa ekle, yeni token gelince devam et
    return refreshTokenSubject.pipe(
      filter((token) => token !== null),
      take(1),
      switchMap((token) => next(addAuthContext(req, token, getActiveMenuKod(router))))
    );
  }
}
