import { FINANS_YETKI } from '../../../core/constants/yetki-kodlari';
import { PermissionService } from '../../../core/services/permission.service';

/**
 * Sunucudaki finans yetki kurallarının istemci aynası (3K.Core/Constants/FinansSekmeleri.cs): Finans'ta yalnız sekme ve
 * alt sekme izni vardır. R görünen verilerin tamamını gösterir (alan maskesi yoktur), W o sekmedeki bütün işlemleri yapar.
 * İş Takibi, Tanımlar ve PO/Fatura sekmelerinin alt sekmeleri vardır; sekme alt sekmenin tavanıdır (alt sekmenin R/W
 * izni sekmenin aynı izni olmadan geçmez). Birden çok sekmede açılan ortak işlemler aşağıdaki kümelerden herhangi bir
 * düğümün izniyle yapılır. Düğmeler yalnız sunucunun kabul edeceği işlemler için gösterilir; asıl kontrol sunucudadır.
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

/**
 * Alt sekmeler (kimlikler ekrandaki görünüm adlarıdır): İş Takibi → aylık görünüm, tüm dönemlerde ara, bekleyen işler;
 * Tanımlar → düzenli işler, ürün ve tarifeler, para birimi ve vade (parametreler); PO/Fatura → PO'lar, faturalar.
 */
export type FinansAltSekme = 'aylik' | 'arama' | 'bekleyen' | 'duzenli' | 'tarifeler' | 'parametreler' | 'po' | 'fatura';

/** Alt sekmesi olan sekmelerin alt sekmeleri; dizi ekrandaki sıradır, varsayılan görünüm okunabilen ilk alt sekmedir. */
export const FINANS_ALT_SEKMELER: Readonly<Partial<Record<FinansSekme, readonly FinansAltSekme[]>>> = {
  akis: ['aylik', 'arama', 'bekleyen'],
  ayarlar: ['duzenli', 'tarifeler', 'parametreler'],
  belgeler: ['po', 'fatura'],
};

/** Her alt sekmenin rol ağacındaki düğümü (üst sekme düğümünün çocuğu). */
export const FINANS_ALT_SEKME_KODLARI: Readonly<Record<FinansAltSekme, string>> = {
  aylik: FINANS_YETKI.SekmeIsTakibiAylik,
  arama: FINANS_YETKI.SekmeIsTakibiArama,
  bekleyen: FINANS_YETKI.SekmeIsTakibiBekleyen,
  duzenli: FINANS_YETKI.SekmeTanimlarDuzenli,
  tarifeler: FINANS_YETKI.SekmeTanimlarTarifeler,
  parametreler: FINANS_YETKI.SekmeTanimlarParaBirimi,
  po: FINANS_YETKI.SekmePoFaturaPo,
  fatura: FINANS_YETKI.SekmePoFaturaFatura,
};

/** Alt sekmenin üst sekmesi (izin tavanı). */
export const FINANS_ALT_SEKME_USTU: Readonly<Record<FinansAltSekme, FinansSekme>> = {
  aylik: 'akis',
  arama: 'akis',
  bekleyen: 'akis',
  duzenli: 'ayarlar',
  tarifeler: 'ayarlar',
  parametreler: 'ayarlar',
  po: 'belgeler',
  fatura: 'belgeler',
};

/** Sunucu izin kümelerinin elemanı: sekme veya alt sekme düğümü. */
export type FinansYetkiDugumu = FinansSekme | FinansAltSekme;

function altSekmeMi(dugum: FinansYetkiDugumu): dugum is FinansAltSekme {
  return dugum in FINANS_ALT_SEKME_KODLARI;
}

/** İş kaydı, PO ve fatura detayını, hareketleri ve genel aramayı gösteren sekmeler (FinansSekmeleri.Kayit). */
export const FINANS_KAYIT_SEKMELERI: readonly FinansYetkiDugumu[] = ['akis', 'panel', 'belgeler', 'munferit', 'raporlar'];
/** Kayıt sekmeleri ve Giderler: belgeler ve değişiklik geçmişi (FinansSekmeleri.KayitVeGider). */
export const FINANS_KAYIT_VE_GIDER_SEKMELERI: readonly FinansYetkiDugumu[] = [...FINANS_KAYIT_SEKMELERI, 'giderler'];
/** İş kaydını değiştiren işlemler: fiyatlandırma, hacim, finans tarihi, iptal/geri alma (FinansSekmeleri.IsDuzenleme). */
export const FINANS_IS_DUZENLEME_SEKMELERI: readonly FinansYetkiDugumu[] = ['akis', 'munferit'];
/** PO açma ve PO'ya kalem ekleme (FinansSekmeleri.SiparisAcma): PO'lar alt sekmesi, İş Takibi veya Münferit İşler. */
export const FINANS_SIPARIS_ACMA_SEKMELERI: readonly FinansYetkiDugumu[] = ['po', 'akis', 'munferit'];
/** Gider kategori/kalem listesi (FinansSekmeleri.GiderTanimlari). */
export const FINANS_GIDER_TANIM_SEKMELERI: readonly FinansYetkiDugumu[] = ['giderler', 'kategoriler', 'raporlar'];

/** Belge yükleme ve kalıcı silmede hedef kaydın düğümü (FinansSekmeleri.Varlik). */
export function finansVarlikSekmeleri(varlikTuru: string | null | undefined): readonly FinansYetkiDugumu[] {
  switch (varlikTuru) {
    case 'Siparis':
      return ['po'];
    case 'Fatura':
      return ['fatura'];
    case 'Gider':
      return ['giderler'];
    case 'IsKaydi':
      return FINANS_IS_DUZENLEME_SEKMELERI;
    default:
      return ['akis'];
  }
}

/**
 * Düğümün R izni, sunucunun değerlendirdiği gibi: modül ve sekme düğümü; alt sekmede ayrıca alt sekme düğümü.
 * Sekme düğümünün kendisi için alt sekme aranmaz (sunucu ortak işlemlerde sekme düğümünü yeterli sayar).
 */
export function finansDugumAcik(izinler: Izinler, dugum: FinansYetkiDugumu): boolean {
  if (!izinler.hasAccess(FINANS_YETKI.Modul)) return false;
  if (!altSekmeMi(dugum)) return izinler.hasAccess(FINANS_SEKME_KODLARI[dugum]);
  return izinler.hasAccess(FINANS_SEKME_KODLARI[FINANS_ALT_SEKME_USTU[dugum]]) && izinler.hasAccess(FINANS_ALT_SEKME_KODLARI[dugum]);
}

/** Düğümün W izni: alt sekmede üst sekmenin W izni de gerekir (tavan). */
export function finansDugumYazilabilir(izinler: Izinler, dugum: FinansYetkiDugumu): boolean {
  if (!finansDugumAcik(izinler, dugum)) return false;
  if (!altSekmeMi(dugum)) return izinler.canWrite(FINANS_SEKME_KODLARI[dugum]);
  return izinler.canWrite(FINANS_SEKME_KODLARI[FINANS_ALT_SEKME_USTU[dugum]]) && izinler.canWrite(FINANS_ALT_SEKME_KODLARI[dugum]);
}

/** Alt sekme görünür mü (R): modül, üst sekme ve alt sekme düğümünün okuma izni. */
export function finansAltSekmeAcik(izinler: Izinler, altSekme: FinansAltSekme): boolean {
  return finansDugumAcik(izinler, altSekme);
}

/** Alt sekmedeki işlemler yapılabilir mi (W): üst sekme ve alt sekme düğümünün yazma izni. */
export function finansAltSekmeYazilabilir(izinler: Izinler, altSekme: FinansAltSekme): boolean {
  return finansDugumYazilabilir(izinler, altSekme);
}

/** Sekmenin alt sekmeleri (yoksa boş). */
export function finansAltSekmeleri(sekme: FinansSekme): readonly FinansAltSekme[] {
  return FINANS_ALT_SEKMELER[sekme] ?? [];
}

/** Sekme görünür mü (R): modül ve sekme düğümü; alt sekmeli sekmede ayrıca en az bir alt sekme okunabilmeli. */
export function finansSekmeAcik(izinler: Izinler, sekme: FinansSekme): boolean {
  if (!finansDugumAcik(izinler, sekme)) return false;
  const altSekmeler = finansAltSekmeleri(sekme);
  return altSekmeler.length === 0 || altSekmeler.some((alt) => finansAltSekmeAcik(izinler, alt));
}

/** Sekmedeki işlemler yapılabilir mi (W). Alt sekmeli sekmede işlemler ayrıca alt sekmenin W iznine bağlıdır. */
export function finansSekmeYazilabilir(izinler: Izinler, sekme: FinansSekme): boolean {
  return finansSekmeAcik(izinler, sekme) && izinler.canWrite(FINANS_SEKME_KODLARI[sekme]);
}

/** Kümedeki düğümlerden (sekme veya alt sekme) herhangi biri okunabilir mi (sunucu kümesi değerlendirmesi). */
export function finansHerhangiSekmeAcik(izinler: Izinler, dugumler: readonly FinansYetkiDugumu[]): boolean {
  return dugumler.some((dugum) => finansDugumAcik(izinler, dugum));
}

/** Kümedeki düğümlerden herhangi birinde işlem yapılabilir mi. */
export function finansHerhangiSekmeYazilabilir(izinler: Izinler, dugumler: readonly FinansYetkiDugumu[]): boolean {
  return dugumler.some((dugum) => finansDugumYazilabilir(izinler, dugum));
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

/** PO düzeltme ve iptali: PO'lar alt sekmesinin W izni. */
export function finansPoDuzeltilebilir(izinler: Izinler): boolean {
  return finansAltSekmeYazilabilir(izinler, 'po');
}

/** Fatura düzeltme, iptal ve ödeme işaretleme: Faturalar alt sekmesinin W izni. */
export function finansFaturaYazilabilir(izinler: Izinler): boolean {
  return finansAltSekmeYazilabilir(izinler, 'fatura');
}

/**
 * Yeni fatura girişi: Faturalar alt sekmesinin W izni. Faturalanacak PO'nun seçildiği PO listesi sunucuda Faturalar alt
 * sekmesine de açıktır; ayrıca PO'lar izni gerekmez.
 */
export function finansFaturaGirilebilir(izinler: Izinler): boolean {
  return finansFaturaYazilabilir(izinler);
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

/** Sekmenin açılış alt sekmesi: ekran sırasıyla okunabilen ilk alt sekme; hiçbiri yoksa null. */
export function finansIlkAltSekme(izinler: Izinler, sekme: FinansSekme): FinansAltSekme | null {
  return finansAltSekmeleri(sekme).find((alt) => finansAltSekmeAcik(izinler, alt)) ?? null;
}
