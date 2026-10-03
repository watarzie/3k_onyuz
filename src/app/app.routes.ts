import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { menuGuard } from './core/guards/menu.guard';
import { AMBALAJ_YETKI, FINANS_YETKI, YETKI } from './core/constants/yetki-kodlari';
import { ProjeTipi } from './core/constants/enums';

export const routes: Routes = [
  // ======= Landing Page (public) =======
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./features/landing/landing.component').then(m => m.LandingComponent),
  },
  {
    path: 'welcome',
    loadComponent: () =>
      import('./features/landing/landing.component').then(m => m.LandingComponent),
  },

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
      {
        path: 'cikis',
        loadComponent: () =>
          import('./features/auth/cikis/cikis.component').then(m => m.CikisComponent),
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
        data: { menuKod: YETKI.DASHBOARD },
      },

      // --- Proje Yönetimi ---
      {
        path: 'projeler',
        canActivate: [menuGuard],
        loadComponent: () =>
          import('./features/projeler/proje-listesi/proje-listesi.component').then(m => m.ProjeListesiComponent),
        data: { menuKod: YETKI.PROJE.AKTIF_PROJELER },
      },
      {
        path: 'projeler/sevk-edilen',
        canActivate: [menuGuard],
        loadComponent: () =>
          import('./features/projeler/proje-listesi/proje-listesi.component').then(m => m.ProjeListesiComponent),
        data: { menuKod: YETKI.PROJE.SEVK_EDILEN },
      },

      // --- Sandık Yönetimi ---
      {
        path: 'sandik-yonetimi',
        canActivate: [menuGuard],
        loadComponent: () =>
          import('./features/projeler/proje-listesi/proje-listesi.component').then(m => m.ProjeListesiComponent),
        data: { menuKod: YETKI.SANDIK.YONETIMI, projeTipi: ProjeTipi.Normal },
      },
      {
        path: 'sandik-yonetimi/:projeId',
        canActivate: [menuGuard],
        loadComponent: () =>
          import('./features/sandik-yonetimi/sandik-listesi/sandik-listesi.component').then(m => m.SandikListesiComponent),
        data: { menuKod: YETKI.SANDIK.YONETIMI, projeTipi: ProjeTipi.Normal },
      },
      {
        path: 'sandik-yonetimi/:projeId/:sandikId',
        canActivate: [menuGuard],
        loadComponent: () =>
          import('./features/sandik-yonetimi/sandik-detay/sandik-detay.component').then(m => m.SandikDetayComponent),
        data: { menuKod: YETKI.SANDIK.YONETIMI, projeTipi: ProjeTipi.Normal },
      },

      // --- Grid & ÜçK ---
      {
        path: 'uck-is-listesi',
        canActivate: [menuGuard],
        loadComponent: () =>
          import('./features/uck/uck-is-listesi/uck-is-listesi.component').then(m => m.UcKIsListesiComponent),
        data: { menuKod: YETKI.SANDIK.UCK_IS_LISTESI },
      },
      {
        path: 'grid-is-listesi',
        canActivate: [menuGuard],
        loadComponent: () =>
          import('./features/grid/grid-is-listesi/grid-is-listesi.component').then(m => m.GridIsListesiComponent),
        data: { menuKod: YETKI.SANDIK.GRID_IS_LISTESI },
      },
      {
        path: 'grid/:projeId',
        canActivate: [menuGuard],
        loadComponent: () =>
          import('./features/grid/grid-urunler/grid-urunler.component').then(m => m.GridUrunlerComponent),
        data: { menuKod: YETKI.SANDIK.GRID_MODULU, projeTipi: ProjeTipi.Normal },
      },
      {
        path: 'uck/:projeId',
        canActivate: [menuGuard],
        loadComponent: () =>
          import('./features/uck/uck-sandiklar/uck-sandiklar.component').then(m => m.UcKSandiklarComponent),
        data: { menuKod: YETKI.SANDIK.UCK_MODULU, projeTipi: ProjeTipi.Normal },
      },
      {
        path: 'uck/sandik/:projeId/:sandikId',
        canActivate: [menuGuard],
        loadComponent: () =>
          import('./features/sandik-yonetimi/sandik-detay/sandik-detay.component').then(m => m.SandikDetayComponent),
        data: { menuKod: YETKI.SANDIK.UCK_MODULU, projeTipi: ProjeTipi.Normal },
      },
      {
        path: 'uck/:projeId/:sandikNo',
        canActivate: [menuGuard],
        loadComponent: () =>
          import('./features/uck/uck-urunler/uck-urunler.component').then(m => m.UcKUrunlerComponent),
        data: { menuKod: YETKI.SANDIK.UCK_MODULU, projeTipi: ProjeTipi.Normal },
      },

      // --- Depo ---
      {
        path: 'depo-durumu',
        canActivate: [menuGuard],
        loadComponent: () =>
          import('./features/depo-durumu/depo-durumu.component').then(m => m.DepoDurumuComponent),
        data: { menuKod: YETKI.DEPO_DURUMU },
      },

      // --- İşlem Onay Merkezi ---
      {
        path: 'onay-merkezi',
        canActivate: [menuGuard],
        loadComponent: () =>
          import('./features/onay-yonetimi/onay-listesi.component').then(m => m.OnayListesiComponent),
        data: { menuKod: YETKI.ONAY.MERKEZI, title: 'İşlem Onay Merkezi' },
      },

      // --- Kullanıcı Bildirim Merkezi (oturum açan tüm kullanıcılar) ---
      {
        path: 'bildirimler/:id',
        loadComponent: () =>
          import('./features/bildirim-merkezi/bildirim-merkezi/bildirim-merkezi.component').then(m => m.BildirimMerkeziComponent),
      },
      {
        path: 'bildirimler',
        loadComponent: () =>
          import('./features/bildirim-merkezi/bildirim-merkezi/bildirim-merkezi.component').then(m => m.BildirimMerkeziComponent),
      },

      // --- Stok ---
      {
        path: 'stok',
        canActivate: [menuGuard],
        loadComponent: () =>
          import('./features/stok-yonetimi/stok-yonetimi.component').then(m => m.StokYonetimiComponent),
        data: { menuKod: YETKI.STOK.KOK },
      },

      // --- Saha Yönetimi ---
      {
        path: 'saha-yonetimi',
        canActivate: [menuGuard],
        loadComponent: () =>
          import('./features/projeler/proje-listesi/proje-listesi.component').then(m => m.ProjeListesiComponent),
        data: { menuKod: YETKI.SAHA.YONETIMI, projeTipi: ProjeTipi.Saha },
      },
      {
        path: 'saha-yonetimi/eksik-olustur',
        canActivate: [menuGuard],
        loadComponent: () =>
          import('./features/saha-yonetimi/eksik-saha-olustur/eksik-saha-olustur.component').then(m => m.EksikSahaOlusturComponent),
        data: { menuKod: YETKI.SAHA.SAHAYA_AKTAR, requiredYetki: 'W' },
      },
      {
        path: 'saha-yonetimi/eksik-olustur/:projeId',
        canActivate: [menuGuard],
        loadComponent: () =>
          import('./features/saha-yonetimi/eksik-saha-olustur/eksik-saha-olustur.component').then(m => m.EksikSahaOlusturComponent),
        data: { menuKod: YETKI.SAHA.SAHAYA_AKTAR, requiredYetki: 'W' },
      },
      {
        path: 'saha-yonetimi/grid/:projeId',
        canActivate: [menuGuard],
        loadComponent: () =>
          import('./features/grid/grid-urunler/grid-urunler.component').then(m => m.GridUrunlerComponent),
        data: { menuKod: YETKI.SAHA.GRID_MODULU, projeTipi: ProjeTipi.Saha },
      },
      {
        path: 'saha-yonetimi/uck/:projeId',
        canActivate: [menuGuard],
        loadComponent: () =>
          import('./features/uck/uck-sandiklar/uck-sandiklar.component').then(m => m.UcKSandiklarComponent),
        data: { menuKod: YETKI.SAHA.UCK_MODULU, projeTipi: ProjeTipi.Saha },
      },
      {
        path: 'saha-yonetimi/uck/sandik/:projeId/:sandikId',
        canActivate: [menuGuard],
        loadComponent: () =>
          import('./features/sandik-yonetimi/sandik-detay/sandik-detay.component').then(m => m.SandikDetayComponent),
        data: { menuKod: YETKI.SAHA.UCK_MODULU, projeTipi: ProjeTipi.Saha },
      },
      {
        path: 'saha-yonetimi/uck/:projeId/:sandikNo',
        canActivate: [menuGuard],
        loadComponent: () =>
          import('./features/uck/uck-urunler/uck-urunler.component').then(m => m.UcKUrunlerComponent),
        data: { menuKod: YETKI.SAHA.UCK_MODULU, projeTipi: ProjeTipi.Saha },
      },
      {
        path: 'saha-yonetimi/:projeId',
        canActivate: [menuGuard],
        loadComponent: () =>
          import('./features/sandik-yonetimi/sandik-listesi/sandik-listesi.component').then(m => m.SandikListesiComponent),
        data: { menuKod: YETKI.SAHA.SANDIKLAR, projeTipi: ProjeTipi.Saha },
      },
      {
        path: 'saha-yonetimi/:projeId/:sandikId',
        canActivate: [menuGuard],
        loadComponent: () =>
          import('./features/sandik-yonetimi/sandik-detay/sandik-detay.component').then(m => m.SandikDetayComponent),
        data: { menuKod: YETKI.SAHA.SANDIKLAR, projeTipi: ProjeTipi.Saha },
      },

      // --- Yedek Yönetimi ---
      {
        path: 'yedek-yonetimi',
        canActivate: [menuGuard],
        loadComponent: () =>
          import('./features/projeler/proje-listesi/proje-listesi.component').then(m => m.ProjeListesiComponent),
        data: { menuKod: YETKI.YEDEK.YONETIMI, projeTipi: ProjeTipi.Yedek },
      },
      {
        path: 'yedek-yonetimi/grid/:projeId',
        canActivate: [menuGuard],
        loadComponent: () =>
          import('./features/grid/grid-urunler/grid-urunler.component').then(m => m.GridUrunlerComponent),
        data: { menuKod: YETKI.YEDEK.GRID_MODULU, projeTipi: ProjeTipi.Yedek },
      },
      {
        path: 'yedek-yonetimi/uck/:projeId',
        canActivate: [menuGuard],
        loadComponent: () =>
          import('./features/uck/uck-sandiklar/uck-sandiklar.component').then(m => m.UcKSandiklarComponent),
        data: { menuKod: YETKI.YEDEK.UCK_MODULU, projeTipi: ProjeTipi.Yedek },
      },
      {
        path: 'yedek-yonetimi/uck/sandik/:projeId/:sandikId',
        canActivate: [menuGuard],
        loadComponent: () =>
          import('./features/sandik-yonetimi/sandik-detay/sandik-detay.component').then(m => m.SandikDetayComponent),
        data: { menuKod: YETKI.YEDEK.UCK_MODULU, projeTipi: ProjeTipi.Yedek },
      },
      {
        path: 'yedek-yonetimi/uck/:projeId/:sandikNo',
        canActivate: [menuGuard],
        loadComponent: () =>
          import('./features/uck/uck-urunler/uck-urunler.component').then(m => m.UcKUrunlerComponent),
        data: { menuKod: YETKI.YEDEK.UCK_MODULU, projeTipi: ProjeTipi.Yedek },
      },
      {
        path: 'yedek-yonetimi/:projeId',
        canActivate: [menuGuard],
        loadComponent: () =>
          import('./features/sandik-yonetimi/sandik-listesi/sandik-listesi.component').then(m => m.SandikListesiComponent),
        data: { menuKod: YETKI.YEDEK.SANDIKLAR, projeTipi: ProjeTipi.Yedek },
      },
      {
        path: 'yedek-yonetimi/:projeId/:sandikId',
        canActivate: [menuGuard],
        loadComponent: () =>
          import('./features/sandik-yonetimi/sandik-detay/sandik-detay.component').then(m => m.SandikDetayComponent),
        data: { menuKod: YETKI.YEDEK.SANDIKLAR, projeTipi: ProjeTipi.Yedek },
      },

      // --- Ambalaj Üretim ---
      {
        path: 'ambalaj-uretim-listesi',
        canActivate: [menuGuard],
        loadComponent: () =>
          import('./features/ambalaj-yonetimi/ambalaj-uretim-listesi/ambalaj-uretim-listesi.component').then(m => m.AmbalajUretimListesiComponent),
        data: { menuKod: AMBALAJ_YETKI.Listele, title: 'Ambalaj Üretim Listesi' },
      },

      // --- Finans ve Sipariş Takibi ---
      {
        path: 'finans-yonetimi',
        canActivate: [menuGuard],
        loadComponent: () =>
          import('./features/finans-yonetimi/finans-aylik/finans-aylik.component').then(m => m.FinansYonetimiComponent),
        data: { menuKod: FINANS_YETKI.Modul, title: 'Finans ve Sipariş Takibi' },
      },

      // --- Hareket Geçmişi ---
      {
        path: 'hareket-gecmisi',
        canActivate: [menuGuard],
        loadComponent: () =>
          import('./features/hareket-gecmisi/hareket-gecmisi.component').then(m => m.HareketGecmisiComponent),
        data: { menuKod: YETKI.HAREKET_GECMISI, title: 'Hareket Geçmişi (Log)' },
      },


      // --- Kullanıcı Yönetimi ---
      {
        path: 'kullanicilar',
        canActivate: [menuGuard],
        loadComponent: () =>
          import('./features/kullanici-yonetimi/kullanici-yonetimi/kullanici-yonetimi.component').then(m => m.KullaniciYonetimiComponent),
        data: { menuKod: YETKI.KULLANICILAR },
      },

      // --- Rol Yönetimi ---
      {
        path: 'rol-yonetimi',
        canActivate: [menuGuard],
        loadComponent: () =>
          import('./features/rol-yonetimi/rol-yonetimi/rol-yonetimi.component').then(m => m.RolYonetimiComponent),
        data: { menuKod: YETKI.ROL_YONETIMI },
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
