import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { ComingSoonComponent } from './shared/components/coming-soon/coming-soon.component';

export const routes: Routes = [
  // Auth layout (sidebar yok)
  {
    path: 'auth',
    loadComponent: () =>
      import('./layout/auth-layout/auth-layout.component').then((m) => m.AuthLayoutComponent),
    children: [
      {
        path: 'login',
        loadComponent: () =>
          import('./features/auth/login/login.component').then((m) => m.LoginComponent),
      },
      { path: '', redirectTo: 'login', pathMatch: 'full' },
    ],
  },
  // Main layout (sidebar + header)
  {
    path: '',
    loadComponent: () =>
      import('./layout/main-layout/main-layout.component').then((m) => m.MainLayoutComponent),
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'projeler',
        loadComponent: () =>
          import('./features/projeler/proje-listesi/proje-listesi.component').then((m) => m.ProjeListesiComponent),
      },
      {
        path: 'projeler/sevk-edilen',
        loadComponent: () =>
          import('./features/projeler/proje-listesi/proje-listesi.component').then((m) => m.ProjeListesiComponent),
      },
      {
        path: 'sandik-yonetimi',
        loadComponent: () =>
          import('./features/projeler/proje-listesi/proje-listesi.component').then((m) => m.ProjeListesiComponent),
      },
      {
        path: 'sandik-yonetimi/:projeId',
        loadComponent: () =>
          import('./features/sandik-yonetimi/sandik-listesi/sandik-listesi.component').then((m) => m.SandikListesiComponent),
      },
      {
        path: 'sandik-yonetimi/:projeId/:sandikId',
        loadComponent: () =>
          import('./features/sandik-yonetimi/sandik-detay/sandik-detay.component').then((m) => m.SandikDetayComponent),
      },
      {
        path: 'depo-durumu',
        loadComponent: () =>
          import('./features/depo-durumu/depo-durumu.component').then((m) => m.DepoDurumuComponent),
      },
      // Henüz geliştirilmemiş modüller — placeholder
      { path: 'eksik-listesi', component: ComingSoonComponent, data: { title: 'Eksik Listesi' } },
      { path: 'fb-transfer', component: ComingSoonComponent, data: { title: 'FB Transfer' } },
      { path: 'stok', component: ComingSoonComponent, data: { title: 'Stok Modülü' } },
      { path: 'saha-malzeme', component: ComingSoonComponent, data: { title: 'Saha Malzemesi' } },
      { path: 'hareket-gecmisi', component: ComingSoonComponent, data: { title: 'Hareket Geçmişi (Log)' } },
      { path: 'kullanicilar', component: ComingSoonComponent, data: { title: 'Kullanıcı / Yetki' } },
      {
        path: 'grid/:projeId',
        loadComponent: () =>
          import('./features/grid/grid-urunler/grid-urunler.component').then((m) => m.GridUrunlerComponent),
      },
      // Bilinmeyen route → dashboard'a yönlendir (login'e değil)
      { path: '**', redirectTo: 'dashboard' },
    ],
  },
  { path: '**', redirectTo: 'auth/login' },
];
