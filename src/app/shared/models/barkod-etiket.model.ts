/**
 * Barkod etiketi (sunucu BarkodEtiketKurali): Grid etiketleri — sandık 100×75 mm (12 haneli sandık barkodu), ürün
 * 60×40 mm (16 haneye sıfırla doldurulmuş ürün barkodu). Etikette Türkçe harfler ASCII'ye çevrilir.
 */

/** Sunucudaki BarkodEtiketBicimi (sayı olarak gider). */
export enum BarkodEtiketBicimi {
  Pdf = 1,
  Ezpl = 2,
}

/** Sunucudaki BarkodEtiketUrunKaynagi: çeki satırı ya da saha/yedek sandığına elle eklenen malzeme. */
export enum BarkodEtiketUrunKaynagi {
  CekiSatiri = 1,
  SandikIcerik = 2,
}

export interface BarkodEtiketProjesi {
  projeId: number;
  projeNo: string;
  projeTipiId: number;
  /** Etiketteki FB NO (projenin FB numarası, yoksa proje no). */
  seriNo: string;
  musteri: string;
  lokasyon: string;
}

export interface BarkodEtiketSandikSatiri {
  sandikId: number;
  sandikNo: string;
  ad: string | null;
  adIngilizce: string | null;
  durum: string;
  /** Etikete basılacak 12 haneli sandık barkodu. */
  barkod: string;
  urunSayisi: number;
}

export interface BarkodEtiketUrunSatiri {
  kaynak: BarkodEtiketUrunKaynagi;
  id: number;
  barkodNo: string;
  /** Etikete basılacak 16 haneli barkod; null ise barkod basılamaz (boş, 16 karakterden uzun ya da Türkçe harfli). */
  etiketBarkodu: string | null;
  tanim: string;
  aciklama: string;
  remarks: string | null;
  sandikNolari: string;
  /** Çeki satırında istenen adet (bütün sandıklar); elle eklenen malzemede kendi miktarı. */
  miktar: number;
  /** Liste sandıkla süzülünce o sandığa tahsis edilen miktar; süzgeçsiz listede null. */
  sandiktakiMiktar: number | null;
  birim: string;
}

export interface BarkodEtiketSandikSecimi {
  sandikId: number;
  adet: number;
}

export interface BarkodEtiketUrunSecimi {
  kaynak: BarkodEtiketUrunKaynagi;
  id: number;
  adet: number;
  remarks: string | null;
}
