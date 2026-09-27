import { AMBALAJ_YETKI, FINANS_YETKI } from '../../core/constants/yetki-kodlari';
import { PermissionService } from '../../core/services/permission.service';

/**
 * Sunucunun finans izin kurallarının istemci aynası: düğmeler yalnız sunucunun kabul
 * edeceği işlemler için gösterilir. Asıl kontrol her zaman sunucudadır.
 */
type Izinler = Pick<PermissionService, 'hasAccess' | 'canWrite'>;

/** Bütün mali ve ölçü alanlarını birlikte taşıyan rapor, belge ve fiyat verisi için gereken alan izinleri. */
export const FINANS_TUM_ALAN_IZINLERI: readonly string[] = [
  FINANS_YETKI.ParasalVeriGoruntule,
  FINANS_YETKI.BirimFiyatGoruntule,
  FINANS_YETKI.TutarGoruntule,
  FINANS_YETKI.GelirGoruntule,
  FINANS_YETKI.GiderGoruntule,
  FINANS_YETKI.KarlilikGoruntule,
  AMBALAJ_YETKI.OlcuGoruntule,
  AMBALAJ_YETKI.M3Goruntule,
  AMBALAJ_YETKI.SarfGoruntule,
];

export function tumFinansAlanlariGorunur(izinler: Izinler): boolean {
  return FINANS_TUM_ALAN_IZINLERI.every((kod) => izinler.hasAccess(kod));
}

/** Rapor dosyası: rapor görme, biçimin dışa aktarma izni ve bütün alan izinleri. Ayrı ZIP PDF iznine bağlıdır. */
export function finansRaporuIndirilebilir(izinler: Izinler, bicim: 'pdf' | 'excel'): boolean {
  return (
    izinler.hasAccess(FINANS_YETKI.RaporGoruntule) &&
    izinler.hasAccess(bicim === 'excel' ? FINANS_YETKI.ExcelAktar : FINANS_YETKI.PdfAktar) &&
    tumFinansAlanlariGorunur(izinler)
  );
}

/** Yüklenmiş PDF belgesi bütün alanları içerebileceği için rapor dosyasıyla aynı alan kuralına tabidir. */
export function finansBelgesiIndirilebilir(izinler: Izinler): boolean {
  return izinler.hasAccess(FINANS_YETKI.BelgeIndir) && tumFinansAlanlariGorunur(izinler);
}

/** Tek seferlik iş her zaman elle fiyat taşır; sunucu fiyat değiştirme iznini de ister. */
export function finansOzelIsiEklenebilir(izinler: Izinler): boolean {
  return (
    izinler.canWrite(FINANS_YETKI.ManuelIsEkle) && izinler.canWrite(FINANS_YETKI.BirimFiyatDegistir)
  );
}
