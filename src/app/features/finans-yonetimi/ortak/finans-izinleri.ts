import { FINANS_YETKI } from '../../../core/constants/yetki-kodlari';
import { PermissionService } from '../../../core/services/permission.service';

/**
 * Sunucudaki finans yetki kurallarının istemci aynası (3K.Core/Constants/FinansSekmeleri.cs): Finans'ta yalnız sekme
 * izni vardır. Sekmenin R izni sekmedeki bütün verileri gösterir (alan maskesi yoktur), W izni sekmedeki bütün işlemleri
 * yapar. Birden çok sekmede açılan ortak işlemler aşağıdaki sekme kümelerinden herhangi birinin izniyle yapılır.
 * Düğmeler yalnız sunucunun kabul edeceği işlemler için gösterilir; asıl kontrol her zaman sunucudadır.
 */
type Izinler = Pick<PermissionService, 'hasAccess' | 'canWrite'>;

/** Finans ana sekmeleri; dizi ekrandaki sıradır, varsayılan sekme erişilebilen ilk sekmedir. */
export type FinansSekme = 'panel' | 'akis' | 'munferit' | 'giderler' | 'ayarlar' | 'belgeler' | 'raporlar' | 'kategoriler';
export const FINANS_SEKME_SIRASI: readonly FinansSekme[] = ['panel', 'akis', 'munferit', 'giderler', 'ayarlar', 'belgeler', 'raporlar', 'kategoriler'];

/** Her sekmenin rol ağacındaki düğümü. */
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

/** İş kaydı, PO ve fatura detayını, hareketleri ve genel aramayı gösteren sekmeler (FinansSekmeleri.Kayit). */
export const FINANS_KAYIT_SEKMELERI: readonly FinansSekme[] = ['akis', 'panel', 'belgeler', 'munferit', 'raporlar'];
/** Kayıt sekmeleri ve Giderler: belgeler ve değişiklik geçmişi (FinansSekmeleri.KayitVeGider). */
export const FINANS_KAYIT_VE_GIDER_SEKMELERI: readonly FinansSekme[] = [...FINANS_KAYIT_SEKMELERI, 'giderler'];
/** İş kaydını değiştiren işlemler: fiyatlandırma, hacim, finans tarihi, iptal/geri alma (FinansSekmeleri.IsDuzenleme). */
export const FINANS_IS_DUZENLEME_SEKMELERI: readonly FinansSekme[] = ['akis', 'munferit'];
/** PO açma (FinansSekmeleri.SiparisAcma). */
export const FINANS_SIPARIS_ACMA_SEKMELERI: readonly FinansSekme[] = ['belgeler', 'akis', 'munferit'];
/** Gider kategori/kalem listesi (FinansSekmeleri.GiderTanimlari). */
export const FINANS_GIDER_TANIM_SEKMELERI: readonly FinansSekme[] = ['giderler', 'kategoriler', 'raporlar'];

/** Belge yükleme ve kalıcı silmede hedef kaydın sekmeleri (FinansSekmeleri.Varlik). */
export function finansVarlikSekmeleri(varlikTuru: string | null | undefined): readonly FinansSekme[] {
  switch (varlikTuru) {
    case 'Siparis':
    case 'Fatura':
      return ['belgeler'];
    case 'Gider':
      return ['giderler'];
    case 'IsKaydi':
      return FINANS_IS_DUZENLEME_SEKMELERI;
    default:
      return ['akis'];
  }
}

/** Sekme görünür mü (R): modül ve sekme düğümünün okuma izni. */
export function finansSekmeAcik(izinler: Izinler, sekme: FinansSekme): boolean {
  return izinler.hasAccess(FINANS_YETKI.Modul) && izinler.hasAccess(FINANS_SEKME_KODLARI[sekme]);
}

/** Sekmedeki işlemler yapılabilir mi (W). */
export function finansSekmeYazilabilir(izinler: Izinler, sekme: FinansSekme): boolean {
  return finansSekmeAcik(izinler, sekme) && izinler.canWrite(FINANS_SEKME_KODLARI[sekme]);
}

/** Sekmelerden herhangi biri görünür mü. */
export function finansHerhangiSekmeAcik(izinler: Izinler, sekmeler: readonly FinansSekme[]): boolean {
  return sekmeler.some((sekme) => finansSekmeAcik(izinler, sekme));
}

/** Sekmelerden herhangi birinde işlem yapılabilir mi. */
export function finansHerhangiSekmeYazilabilir(izinler: Izinler, sekmeler: readonly FinansSekme[]): boolean {
  return sekmeler.some((sekme) => finansSekmeYazilabilir(izinler, sekme));
}

/** İş kaydı / PO / fatura detayı, hareketler ve genel arama okunabilir mi. */
export function finansKayitOkunabilir(izinler: Izinler): boolean {
  return finansHerhangiSekmeAcik(izinler, FINANS_KAYIT_SEKMELERI);
}

/** Belgeler (listeleme/indirme) ve değişiklik geçmişi okunabilir mi. */
export function finansBelgeOkunabilir(izinler: Izinler): boolean {
  return finansHerhangiSekmeAcik(izinler, FINANS_KAYIT_VE_GIDER_SEKMELERI);
}

/** İş kaydı değiştirilebilir mi (fiyatlandırma, hacim, finans tarihi, iptal/geri alma). */
export function finansIsDuzenlenebilir(izinler: Izinler): boolean {
  return finansHerhangiSekmeYazilabilir(izinler, FINANS_IS_DUZENLEME_SEKMELERI);
}

/** PO açılabilir / PO'ya kalem eklenebilir mi. */
export function finansPoGirilebilir(izinler: Izinler): boolean {
  return finansHerhangiSekmeYazilabilir(izinler, FINANS_SIPARIS_ACMA_SEKMELERI);
}

/** PO düzeltme/iptal, fatura girişi/düzeltme/iptal ve ödeme işaretleme: PO/Fatura sekmesinin W izni. */
export function finansSiparisFaturaYazilabilir(izinler: Izinler): boolean {
  return finansSekmeYazilabilir(izinler, 'belgeler');
}

/** Hedef kayda belge yüklenebilir veya kayıt kalıcı silinebilir mi. */
export function finansVarlikYazilabilir(izinler: Izinler, varlikTuru: string | null | undefined): boolean {
  return finansHerhangiSekmeYazilabilir(izinler, finansVarlikSekmeleri(varlikTuru));
}

/** İş Takibi'nin üstündeki vade uyarısı görünür mü (ayrı izin). */
export function finansVadeUyarisiGorunur(izinler: Izinler): boolean {
  return izinler.hasAccess(FINANS_YETKI.Modul) && izinler.hasAccess(FINANS_YETKI.VadeUyarisi);
}

/** Açılışta gösterilecek sekme: ekran sırasıyla erişilebilen ilk sekme; hiçbiri yoksa null. */
export function finansIlkSekme(izinler: Izinler): FinansSekme | null {
  return FINANS_SEKME_SIRASI.find((sekme) => finansSekmeAcik(izinler, sekme)) ?? null;
}
