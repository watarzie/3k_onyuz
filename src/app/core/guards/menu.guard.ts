
import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { PermissionService } from '../services/permission.service';

/**
 * Route Guard — Backend'den gelen yetkili menü listesine göre erişimi kontrol eder.
 *
 * Mantık:
 * 1. Yetki henüz yüklenmediyse → yüklenmesini bekle (Promise)
 * 2. menuKod tanımlıysa → hasAccess() kontrolü yap
 * 3. Yetkisiz → not-authorized'a yönlendir
 */
export const menuGuard: CanActivateFn = async (route, state): Promise<boolean | UrlTree> => {
  const permissionService = inject(PermissionService);
  const router = inject(Router);

  // Yetki ağacının API'den gelmesini bekle!
  await permissionService.ensurePermissionsLoaded();

  // Dashboard her zaman erişilebilir
  const menuKod = route.data?.['menuKod'] as string;
  if (menuKod === 'dashboard') {
    return true;
  }

  // menuKod tanımlıysa kontrol et
  if (menuKod && permissionService.hasAccess(menuKod)) {
    return true;
  }

  // Yetkisiz — 403 sayfasına yönlendir
  return router.createUrlTree(['/not-authorized']);
};
