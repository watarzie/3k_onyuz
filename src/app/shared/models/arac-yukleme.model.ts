import type { PlanAraci, YerlesimKontrolSonucu } from './yukleme-planlama.model';

// Araç yükleme (saha) modelleri: sunucudaki YuklemeOturumuModelleri.cs ile birebir (camelCase; enum sayıları aynı).

export enum YuklemeOturumDurumu {
  Acik = 1,
  Tamamlandi = 2,
  IptalEdildi = 3,
}

export enum YuklemeIsaretKaynagi {
  Barkod = 1,
  Elle = 2,
}

/** Okutulan barkodun çözüm sonucu. */
export enum YukCozumSonucu {
  Yuklenebilir = 1,
  SiraDisi = 2,
  BaskaAracta = 3,
  ZatenYuklendi = 4,
  PlandaYok = 5,
  GecersizBarkod = 6,
}

/** Yükleme oturumunun başlığı ve ilerlemesi. */
export interface AracYuklemeOturumu {
  id: number;
  revizyonNo: number;
  durum: YuklemeOturumDurumu;
  baslatan: string | null;
  baslamaTarihi: string;
  kapatan: string | null;
  kapanisTarihi: string | null;
  kapanisGerekcesi: string | null;
  aracSayisi: number;
  toplamYuk: number;
  yuklenenYuk: number;
  /** Plan oturum başladıktan sonra revize edildi; oturum başladığı revizyonla sürer. */
  planDegisti: boolean;
}

export interface AracYuklemePlanOzeti {
  id: number;
  planNo: string;
  ad: string;
  yuklemeTarihi: string | null;
  revizyonNo: number;
  yerlesimVar: boolean;
  acikOturum: AracYuklemeOturumu | null;
}

export interface AracYuklemeAracOzeti {
  aracNo: number;
  ekipmanKodu: string;
  ekipmanAdi: string;
  tipAdi: string;
  projeNolari: string[];
  toplamKg: number;
  toplamYuk: number;
  yuklenenYuk: number;
  sonuc: YerlesimKontrolSonucu;
}

/** Planın yükleme durumu: süren (yoksa en son) oturum ve araçları. */
export interface AracYuklemeDurumu {
  planId: number;
  planNo: string;
  planAdi: string;
  yuklemeTarihi: string | null;
  sonRevizyonNo: number;
  yerlesimVar: boolean;
  yerlesimSonucu: YerlesimKontrolSonucu | null;
  baslatilabilir: boolean;
  oturum: AracYuklemeOturumu | null;
  araclar: AracYuklemeAracOzeti[];
}

/** Etkin (geri alınmamış) yükleme işareti. */
export interface YukIsareti {
  id: number;
  yukAnahtari: string;
  adimNo: number;
  kaynak: YuklemeIsaretKaynagi;
  siraDisi: boolean;
  yukleyen: string | null;
  yuklemeTarihi: string;
}

/** Araç yükleme ekranı: aracın yerleşimi, etkin işaretler ve sıradaki adım. */
export interface AracYuklemeAraci {
  planId: number;
  planNo: string;
  planAdi: string;
  oturum: AracYuklemeOturumu;
  arac: PlanAraci;
  isaretler: YukIsareti[];
  siradakiAdimNo: number | null;
}

export interface YukCozumu {
  sonuc: YukCozumSonucu;
  mesaj: string;
  yukAnahtari: string | null;
  kod: string | null;
  aracNo: number | null;
  ekipmanKodu: string | null;
  adimNo: number | null;
  no: number | null;
  isaret: YukIsareti | null;
}

export interface YukIsaretSonucu {
  zatenYuklendi: boolean;
  arac: AracYuklemeAraci;
}

export interface YukIsaretleIstegi {
  aracNo: number;
  yukAnahtari: string;
  kaynak: YuklemeIsaretKaynagi;
  siraDisiOnayi: boolean;
  /** Barkod kaynağında okutulan metin: sunucu çözer ve yükle eşleşmesini ister. Elle işarette null. */
  barkod: string | null;
}
