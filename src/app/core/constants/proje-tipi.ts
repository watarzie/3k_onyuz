import { ActivatedRouteSnapshot } from '@angular/router';
import { ProjeTipi } from './enums';
import { YETKI } from './yetki-kodlari';

/**
 * Aynı ekranın Normal/Saha/Yedek projedeki rota kökleri, başlıkları ve yetki kodları.
 * Arka uçtaki ProjeTipiYetkiKodlari'nın ön yüz karşılığıdır. Ekranın proje tipi route verisindeki
 * `projeTipi` alanından okunur; menü kodundan tahmin edilmez.
 */
export interface ProjeTipiBaglami {
  readonly tip: ProjeTipi;
  /** Kullanıcıya gösterilen tip adı. */
  readonly ad: string;
  readonly yonetimRotasi: string;
  readonly gridRotasi: string;
  readonly ucKRotasi: string;
  /** Ekran başlıklarının çeviri anahtarları; sol menüdeki adlarla aynıdır. */
  readonly baslik: { readonly yonetim: string; readonly grid: string; readonly ucK: string };
  readonly yetki: {
    readonly projeYonetimi: string;
    readonly ucKModulu: string;
    readonly sevkEt: string;
    readonly projeSil: string;
    readonly planlananSevkTarihi: string;
    readonly ucKSandikDurumRaporu: string;
    readonly gridModulu: string;
    readonly gerceklesenCekiRaporu: string;
  };
}

export const PROJE_TIPI_BAGLAMLARI: Readonly<Record<ProjeTipi, ProjeTipiBaglami>> = {
  [ProjeTipi.Normal]: {
    tip: ProjeTipi.Normal,
    ad: 'Normal',
    yonetimRotasi: '/sandik-yonetimi',
    gridRotasi: '/grid',
    ucKRotasi: '/uck',
    baslik: { yonetim: 'MENU.SANDIK_YONETIMI', grid: 'MENU.GRID_MODULU', ucK: 'MENU.3K_MODULU' },
    yetki: {
      projeYonetimi: YETKI.SANDIK.YONETIMI,
      ucKModulu: YETKI.SANDIK.UCK_MODULU,
      sevkEt: YETKI.PROJE.SEVK_ET,
      projeSil: YETKI.PROJE.SIL,
      planlananSevkTarihi: YETKI.PROJE.PLANLANAN_SEVK_TARIHI,
      ucKSandikDurumRaporu: YETKI.SANDIK.UCK_SANDIK_DURUM_RAPORU,
      gridModulu: YETKI.SANDIK.GRID_MODULU,
      gerceklesenCekiRaporu: YETKI.SANDIK.GERCEKLESEN_CEKI_RAPORU,
    },
  },
  [ProjeTipi.Saha]: {
    tip: ProjeTipi.Saha,
    ad: 'Saha',
    yonetimRotasi: '/saha-yonetimi',
    gridRotasi: '/saha-yonetimi/grid',
    ucKRotasi: '/saha-yonetimi/uck',
    baslik: { yonetim: 'MENU.SAHA_YONETIMI', grid: 'MENU.SAHA_GRID_MODULU', ucK: 'MENU.SAHA_3K_MODULU' },
    yetki: {
      projeYonetimi: YETKI.SAHA.YONETIMI,
      ucKModulu: YETKI.SAHA.UCK_MODULU,
      sevkEt: YETKI.SAHA.SEVK_ET,
      projeSil: YETKI.SAHA.PROJE_SIL,
      // Saha projeleri planlanan sevk tarihini normal projelerle aynı izinle değiştirir.
      planlananSevkTarihi: YETKI.PROJE.PLANLANAN_SEVK_TARIHI,
      ucKSandikDurumRaporu: YETKI.SAHA.UCK_SANDIK_DURUM_RAPORU,
      gridModulu: YETKI.SAHA.GRID_MODULU,
      gerceklesenCekiRaporu: YETKI.SAHA.GERCEKLESEN_CEKI_RAPORU,
    },
  },
  [ProjeTipi.Yedek]: {
    tip: ProjeTipi.Yedek,
    ad: 'Yedek',
    yonetimRotasi: '/yedek-yonetimi',
    gridRotasi: '/yedek-yonetimi/grid',
    ucKRotasi: '/yedek-yonetimi/uck',
    baslik: { yonetim: 'MENU.YEDEK_YONETIMI', grid: 'MENU.YEDEK_GRID_MODULU', ucK: 'MENU.YEDEK_3K_MODULU' },
    yetki: {
      projeYonetimi: YETKI.YEDEK.YONETIMI,
      ucKModulu: YETKI.YEDEK.UCK_MODULU,
      sevkEt: YETKI.YEDEK.SEVK_ET,
      projeSil: YETKI.YEDEK.PROJE_SIL,
      planlananSevkTarihi: YETKI.YEDEK.PLANLANAN_SEVK_TARIHI,
      ucKSandikDurumRaporu: YETKI.YEDEK.UCK_SANDIK_DURUM_RAPORU,
      gridModulu: YETKI.YEDEK.GRID_MODULU,
      gerceklesenCekiRaporu: YETKI.YEDEK.GERCEKLESEN_CEKI_RAPORU,
    },
  },
};

/** Proje tipinin bağlamı; tanımsız tip normal proje sayılır. */
export function projeTipiBaglami(projeTipiId: number | null | undefined): ProjeTipiBaglami {
  return PROJE_TIPI_BAGLAMLARI[projeTipiId as ProjeTipi] ?? PROJE_TIPI_BAGLAMLARI[ProjeTipi.Normal];
}

/** Ekranın route verisinde bildirdiği proje tipi; tüm tipleri listeleyen ekranlarda null. */
export function rotaProjeTipi(rota: ActivatedRouteSnapshot): ProjeTipi | null {
  return PROJE_TIPI_BAGLAMLARI[rota.data['projeTipi'] as ProjeTipi]?.tip ?? null;
}
