import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { SessionManager } from '../managers/session.manager';

/**
 * Auth interceptor: Token varsa request header'a ekler.
 * SessionManager üzerinden token alır.
 * Hata yönetimi ErrorInterceptor'a bırakıldı (SRP).
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const session = inject(SessionManager);
  const token = session.token;

  const cloned = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(cloned);
};
