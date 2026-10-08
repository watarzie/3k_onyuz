import { AMBALAJ_YETKI, FINANS_YETKI } from '../../../core/constants/yetki-kodlari';
import { PermissionService } from '../../../core/services/permission.service';

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

/** Münferit iş tarifeden fiyatlanır: sekme ve iş ekleme yazma izni yeter, fiyat değiştirme izni gerekmez. */
export function finansMunferitIsEklenebilir(izinler: Izinler): boolean {
  return izinler.canWrite(FINANS_YETKI.SekmeMunferitIsler) && izinler.canWrite(FINANS_YETKI.ManuelIsEkle);
}

/** Tek seferlik iş her zaman elle fiyat taşır; sunucu fiyat değiştirme iznini de ister. */
export function finansOzelIsiEklenebilir(izinler: Izinler): boolean {
  return (
    izinler.canWrite(FINANS_YETKI.ManuelIsEkle) && izinler.canWrite(FINANS_YETKI.BirimFiyatDegistir)
  );
}

/** PO ve fatura kayıtlarını okumak: sunucu kayıt ve sipariş operasyonu görüntüleme izinlerini birlikte ister. */
export function finansSiparisFaturaOkunabilir(izinler: Izinler): boolean {
  return (
    izinler.hasAccess(FINANS_YETKI.KayitGoruntule) &&
    izinler.hasAccess(FINANS_YETKI.SiparisOperasyonGoruntule)
  );
}

/** PO girmek veya PO'ya kalem eklemek: yazma izni ile PO grup seçicisini okuma izinleri. */
export function finansPoGirilebilir(izinler: Izinler): boolean {
  return izinler.canWrite(FINANS_YETKI.PoGir) && finansSiparisFaturaOkunabilir(izinler);
}

/** Ödeme işaretlemek (D3): yazma izni ile faturaları okuma izinleri. */
export function finansOdemeKaydedilebilir(izinler: Izinler): boolean {
  return izinler.canWrite(FINANS_YETKI.OdemeKaydet) && finansSiparisFaturaOkunabilir(izinler);
}

/** Fatura girmek: yazma izni ile faturalanacak PO ve kalemlerini okuma izinleri. */
export function finansFaturaGirilebilir(izinler: Izinler): boolean {
  return izinler.canWrite(FINANS_YETKI.FaturaGir) && finansSiparisFaturaOkunabilir(izinler);
}

/** Finans ana sekmeleri; dizi ekrandaki sıradır, varsayılan sekme erişilebilen ilk sekmedir. */
export type FinansSekme = 'panel' | 'akis' | 'munferit' | 'giderler' | 'ayarlar' | 'belgeler' | 'raporlar' | 'kategoriler';
export const FINANS_SEKME_SIRASI: readonly FinansSekme[] = ['panel', 'akis', 'munferit', 'giderler', 'ayarlar', 'belgeler', 'raporlar', 'kategoriler'];

/** Her sekmenin rol ağacındaki düğümü (R sekmeyi gösterir, W sekmedeki işlemlerin tavanıdır). */
export const FINANS_SEKME_KODLARI: Readonly<Record<FinansSekme, string>> = {
  panel: FINANS_YETKI.SekmePanel,
  akis: FINANS_YETKI.SekmeIsTakibi,
  munferit: FINANS_YETKI.SekmeMunferitIsler,
  giderler: FINANS_YETKI.SekmeGiderler,
  ayarlar: FINANS_YETKI.SekmeTanimlar,
  belgeler: FINANS_YETKI.SekmePoFatura,
  raporlar: FINANS_YETKI.SekmeRaporlar,
  kategoriler: FINANS_YETKI.SekmeGiderKategorileri,
};

export type FinansTanimGorunumu = 'duzenli' | 'tarifeler' | 'parametreler';

/**
 * İş ve Tarife Tanımları alt görünümü: sunucudaki okuma izinleriyle aynı. Tarife listesi birim fiyat görmeyi de
 * ister; vade parametreleri iş kütüphanesi iznine bağlıdır.
 */
export function finansTanimOkunabilir(izinler: Izinler, gorunum: FinansTanimGorunumu): boolean {
  if (!izinler.hasAccess(FINANS_YETKI.Modul)) return false;
  if (gorunum === 'duzenli') return izinler.hasAccess(FINANS_YETKI.DuzenliIsYonet);
  if (gorunum === 'parametreler') return izinler.hasAccess(FINANS_YETKI.IsKutuphanesiYonet);
  return izinler.hasAccess(FINANS_YETKI.IsKutuphanesiYonet) && izinler.hasAccess(FINANS_YETKI.BirimFiyatGoruntule);
}

/**
 * Sekme görünür mü: modül, sekme düğümü ve sekmenin ekranındaki okuma izinleri birlikte (sunucu kapılarının
 * aynası). Gider kategorileri okuma izniyle açılır; ekleme/düzenleme düğmeleri yazma izni ister.
 */
export function finansSekmeAcik(izinler: Izinler, sekme: FinansSekme): boolean {
  if (!izinler.hasAccess(FINANS_YETKI.Modul) || !izinler.hasAccess(FINANS_SEKME_KODLARI[sekme])) return false;
  switch (sekme) {
    case 'panel':
      return true;
    case 'akis':
    case 'munferit':
      return izinler.hasAccess(FINANS_YETKI.KayitGoruntule);
    case 'giderler':
      return izinler.hasAccess(FINANS_YETKI.GiderGoruntule);
    case 'ayarlar':
      return (['duzenli', 'tarifeler', 'parametreler'] as const).some((g) => finansTanimOkunabilir(izinler, g));
    case 'belgeler':
      return finansSiparisFaturaOkunabilir(izinler);
    case 'raporlar':
      return izinler.hasAccess(FINANS_YETKI.RaporGoruntule);
    case 'kategoriler':
      return izinler.hasAccess(FINANS_YETKI.GiderKutuphanesiYonet);
  }
}

/** Açılışta gösterilecek sekme: ekran sırasıyla erişilebilen ilk sekme; hiçbiri yoksa null. */
export function finansIlkSekme(izinler: Izinler): FinansSekme | null {
  return FINANS_SEKME_SIRASI.find((sekme) => finansSekmeAcik(izinler, sekme)) ?? null;
}
