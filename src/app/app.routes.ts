import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

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

      // --- Dashboard ---
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
      },

      // --- Proje Yönetimi ---
      {
        path: 'projeler',
        loadComponent: () =>
          import('./features/projeler/proje-listesi/proje-listesi.component').then(m => m.ProjeListesiComponent),
      },
      {
        path: 'projeler/sevk-edilen',
        loadComponent: () =>
          import('./features/projeler/proje-listesi/proje-listesi.component').then(m => m.ProjeListesiComponent),
      },

      // --- Sandık Yönetimi ---
      {
        path: 'sandik-yonetimi',
        loadComponent: () =>
          import('./features/projeler/proje-listesi/proje-listesi.component').then(m => m.ProjeListesiComponent),
      },
      {
        path: 'sandik-yonetimi/:projeId',
        loadComponent: () =>
          import('./features/sandik-yonetimi/sandik-listesi/sandik-listesi.component').then(m => m.SandikListesiComponent),
      },
      {
        path: 'sandik-yonetimi/:projeId/:sandikId',
        loadComponent: () =>
          import('./features/sandik-yonetimi/sandik-detay/sandik-detay.component').then(m => m.SandikDetayComponent),
      },

      // --- Grid & ÜçK ---
      {
        path: 'grid/:projeId',
        loadComponent: () =>
          import('./features/grid/grid-urunler/grid-urunler.component').then(m => m.GridUrunlerComponent),
      },
      {
        path: 'uck/:projeId',
        loadComponent: () =>
          import('./features/uck/uck-sandiklar/uck-sandiklar.component').then(m => m.UcKSandiklarComponent),
      },
      {
        path: 'uck/:projeId/:sandikNo',
        loadComponent: () =>
          import('./features/uck/uck-urunler/uck-urunler.component').then(m => m.UcKUrunlerComponent),
      },

      // --- Depo ---
      {
        path: 'depo-durumu',
        loadComponent: () =>
          import('./features/depo-durumu/depo-durumu.component').then(m => m.DepoDurumuComponent),
      },

      // --- Eksik Liste ---
      {
        path: 'eksik-listesi',
        loadComponent: () =>
          import('./shared/components/coming-soon/coming-soon.component').then(m => m.ComingSoonComponent),
        data: { title: 'Eksik Listesi' },
      },

      // --- FB Transfer ---
      {
        path: 'fb-transfer',
        loadComponent: () =>
          import('./shared/components/coming-soon/coming-soon.component').then(m => m.ComingSoonComponent),
        data: { title: 'FB Transfer' },
      },

      // --- Stok ---
      {
        path: 'stok',
        loadComponent: () =>
          import('./shared/components/coming-soon/coming-soon.component').then(m => m.ComingSoonComponent),
        data: { title: 'Stok Modülü' },
      },

      // --- Saha Malzeme ---
      {
        path: 'saha-malzeme',
        loadComponent: () =>
          import('./shared/components/coming-soon/coming-soon.component').then(m => m.ComingSoonComponent),
        data: { title: 'Saha Malzemesi' },
      },

      // --- Hareket Geçmişi ---
      {
        path: 'hareket-gecmisi',
        loadComponent: () =>
          import('./shared/components/coming-soon/coming-soon.component').then(m => m.ComingSoonComponent),
        data: { title: 'Hareket Geçmişi (Log)' },
      },

      // --- Kullanıcı / Yetki ---
      {
        path: 'kullanicilar',
        loadComponent: () =>
          import('./shared/components/coming-soon/coming-soon.component').then(m => m.ComingSoonComponent),
        data: { title: 'Kullanıcı / Yetki' },
      },

      // --- Wildcard → Dashboard ---
      { path: '**', redirectTo: 'dashboard' },
    ],
  },

  // ======= Global Wildcard → Login =======
  { path: '**', redirectTo: 'auth/login' },
];
