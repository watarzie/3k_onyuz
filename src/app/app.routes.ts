import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { menuGuard } from './core/guards/menu.guard';

export const routes: Routes = [
  // ======= Auth Layout (sidebar/header yok) =======
  {
    path: 'auth',
    loadComponent: () =>
      import('./layout/auth-layout/auth-layout.component').then(m => m.AuthLayoutComponent),
    children: [
      {
        path: 'login',
        loadComponent: () =>
          import('./features/auth/login/login.component').then(m => m.LoginComponent),
      },
      { path: '', redirectTo: 'login', pathMatch: 'full' },
    ],
  },

  // ======= Main Layout (sidebar + header) — Auth korumalı =======
  {
    path: '',
    loadComponent: () =>
      import('./layout/main-layout/main-layout.component').then(m => m.MainLayoutComponent),
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

      // --- Dashboard (herkes erişebilir) ---
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
        data: { menuKod: 'dashboard' },
      },

      // --- Proje Yönetimi ---
      {
        path: 'projeler',
        canActivate: [menuGuard],
        loadComponent: () =>
          import('./features/projeler/proje-listesi/proje-listesi.component').then(m => m.ProjeListesiComponent),
        data: { menuKod: 'aktif-projeler' },
      },
      {
        path: 'projeler/sevk-edilen',
        canActivate: [menuGuard],
        loadComponent: () =>
          import('./features/projeler/proje-listesi/proje-listesi.component').then(m => m.ProjeListesiComponent),
        data: { menuKod: 'sevk-edilen' },
      },

      // --- Sandık Yönetimi ---
      {
        path: 'sandik-yonetimi',
        canActivate: [menuGuard],
        loadComponent: () =>
          import('./features/projeler/proje-listesi/proje-listesi.component').then(m => m.ProjeListesiComponent),
        data: { menuKod: 'sandik-yonetimi' },
      },
      {
        path: 'sandik-yonetimi/:projeId',
        canActivate: [menuGuard],
        loadComponent: () =>
          import('./features/sandik-yonetimi/sandik-listesi/sandik-listesi.component').then(m => m.SandikListesiComponent),
        data: { menuKod: 'sandik-yonetimi' },
      },
      {
        path: 'sandik-yonetimi/:projeId/:sandikId',
        canActivate: [menuGuard],
        loadComponent: () =>
          import('./features/sandik-yonetimi/sandik-detay/sandik-detay.component').then(m => m.SandikDetayComponent),
        data: { menuKod: 'sandik-yonetimi' },
      },

      // --- Grid & ÜçK ---
      {
        path: 'grid/:projeId',
        canActivate: [menuGuard],
        loadComponent: () =>
          import('./features/grid/grid-urunler/grid-urunler.component').then(m => m.GridUrunlerComponent),
        data: { menuKod: 'grid-modulu' },
      },
      {
        path: 'uck/:projeId',
        canActivate: [menuGuard],
        loadComponent: () =>
          import('./features/uck/uck-sandiklar/uck-sandiklar.component').then(m => m.UcKSandiklarComponent),
        data: { menuKod: '3k-modulu' },
      },
      {
        path: 'uck/:projeId/:sandikNo',
        canActivate: [menuGuard],
        loadComponent: () =>
          import('./features/uck/uck-urunler/uck-urunler.component').then(m => m.UcKUrunlerComponent),
        data: { menuKod: '3k-modulu' },
      },

      // --- Depo ---
      {
        path: 'depo-durumu',
        canActivate: [menuGuard],
        loadComponent: () =>
          import('./features/depo-durumu/depo-durumu.component').then(m => m.DepoDurumuComponent),
        data: { menuKod: 'depo-durumu' },
      },

      // --- İşlem Onay Merkezi ---
      {
        path: 'onay-merkezi',
        canActivate: [menuGuard],
        loadComponent: () =>
          import('./features/onay-yonetimi/onay-listesi.component').then(m => m.OnayListesiComponent),
        data: { menuKod: 'islem-onay-merkezi', title: 'İşlem Onay Merkezi' },
      },

      // --- Stok ---
      {
        path: 'stok',
        canActivate: [menuGuard],
        loadComponent: () =>
          import('./features/stok-yonetimi/stok-yonetimi').then(m => m.StokYonetimi),
        data: { menuKod: 'stok' },
      },

      // --- Saha Yönetimi ---
      {
        path: 'saha-yonetimi',
        canActivate: [menuGuard],
        loadComponent: () =>
          import('./features/projeler/proje-listesi/proje-listesi.component').then(m => m.ProjeListesiComponent),
        data: { menuKod: 'saha-yonetimi' },
      },
      {
        path: 'saha-yonetimi/:projeId',
        canActivate: [menuGuard],
        loadComponent: () =>
          import('./features/sandik-yonetimi/sandik-listesi/sandik-listesi.component').then(m => m.SandikListesiComponent),
        data: { menuKod: 'saha-yonetimi' },
      },
      {
        path: 'saha-yonetimi/:projeId/:sandikId',
        canActivate: [menuGuard],
        loadComponent: () =>
          import('./features/sandik-yonetimi/sandik-detay/sandik-detay.component').then(m => m.SandikDetayComponent),
        data: { menuKod: 'saha-yonetimi' },
      },

      // --- Yedek Yönetimi ---
      {
        path: 'yedek-yonetimi',
        canActivate: [menuGuard],
        loadComponent: () =>
          import('./features/projeler/proje-listesi/proje-listesi.component').then(m => m.ProjeListesiComponent),
        data: { menuKod: 'yedek-yonetimi' },
      },
      {
        path: 'yedek-yonetimi/:projeId',
        canActivate: [menuGuard],
        loadComponent: () =>
          import('./features/sandik-yonetimi/sandik-listesi/sandik-listesi.component').then(m => m.SandikListesiComponent),
        data: { menuKod: 'yedek-yonetimi' },
      },
      {
        path: 'yedek-yonetimi/:projeId/:sandikId',
        canActivate: [menuGuard],
        loadComponent: () =>
          import('./features/sandik-yonetimi/sandik-detay/sandik-detay.component').then(m => m.SandikDetayComponent),
        data: { menuKod: 'yedek-yonetimi' },
      },

      // --- Hareket Geçmişi ---
      {
        path: 'hareket-gecmisi',
        canActivate: [menuGuard],
        loadComponent: () =>
          import('./features/hareket-gecmisi/hareket-gecmisi.component').then(m => m.HareketGecmisiComponent),
        data: { menuKod: 'hareket-gecmisi', title: 'Hareket Geçmişi (Log)' },
      },

      // --- Kullanıcı Yönetimi ---
      {
        path: 'kullanicilar',
        canActivate: [menuGuard],
        loadComponent: () =>
          import('./features/kullanici-yonetimi/kullanici-yonetimi.component').then(m => m.KullaniciYonetimiComponent),
        data: { menuKod: 'kullanicilar' },
      },

      // --- Rol Yönetimi ---
      {
        path: 'rol-yonetimi',
        canActivate: [menuGuard],
        loadComponent: () =>
          import('./features/rol-yonetimi/rol-yonetimi.component').then(m => m.RolYonetimiComponent),
        data: { menuKod: 'rol-yonetimi' },
      },

      // --- Not Authorized View ---
      {
        path: 'not-authorized',
        loadComponent: () =>
          import('./shared/components/not-authorized/not-authorized.component').then(m => m.NotAuthorizedComponent),
      },

      // --- Wildcard → Dashboard ---
      { path: '**', redirectTo: 'dashboard' },
    ],
  },

  // ======= Global Wildcard → Login =======
  { path: '**', redirectTo: 'auth/login' },
];
