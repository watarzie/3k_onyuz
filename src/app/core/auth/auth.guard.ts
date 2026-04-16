import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { SessionManager } from '../managers/session.manager';
import { AuthService } from './auth.service';
import { PermissionService } from '../services/permission.service';

/**
 * Auth Guard — Token varlığını VE süresinin dolup dolmadığını kontrol eder.
 * Token expired ise otomatik logout yapar.
 */
export const authGuard: CanActivateFn = () => {
  const session = inject(SessionManager);
  const auth = inject(AuthService);
  const permissions = inject(PermissionService);
  const router = inject(Router);

  if (!session.token) {
    return router.createUrlTree(['/auth/login']);
  }

  // Token süresi dolmuşsa logout
  if (session.isTokenExpired()) {
    auth.logout();
    permissions.clear();
    return router.createUrlTree(['/auth/login']);
  }

  return true;
};
