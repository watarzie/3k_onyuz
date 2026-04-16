import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { PermissionService } from '../services/permission.service';

/**
 * Route Guard — Backend'den gelen yetkili menü listesine göre erişimi kontrol eder.
 *
 * GÜVENLİK: Bu guard UX amaçlıdır. Asıl güvenlik backend'dedir.
 *
 * Mantık:
 * 1. Yetki henüz yüklenmediyse → geçiş izni ver (async yükleme devam ediyor)
 * 2. menuKod tanımlıysa → hasAccess() kontrolü yap
 * 3. Yetkisiz → dashboard'a yönlendir
 */
export const menuGuard: CanActivateFn = (route, state) => {
  const permissionService = inject(PermissionService);
  const router = inject(Router);

  // Yetki bilgisi henüz yüklenmediyse geçiş izni ver
  if (!permissionService.loaded()) {
    return true;
  }

  // Dashboard her zaman erişilebilir
  const menuKod = route.data?.['menuKod'] as string;
  if (menuKod === 'dashboard') {
    return true;
  }

  // menuKod tanımlıysa kontrol et
  if (menuKod && permissionService.hasAccess(menuKod)) {
    return true;
  }

  // Yetkisiz — dashboard'a yönlendir
  router.navigate(['/dashboard']);
  return false;
};
