/**
 * Üst çubuktaki genel arama (sunucu GenelAramaSonucuDto): projeler, ürünler (barkod) ve sandıklar. Her grup kullanıcının
 * iznine göre dolar; izni olmayan grubun `…Aranabilir` alanı false döner ve ekranda gösterilmez.
 */
export interface GenelAramaSonucu {
  q: string;
  projeAranabilir: boolean;
  sandikAranabilir: boolean;
  urunAranabilir: boolean;
  projeler: GenelAramaProje[];
  urunler: GenelAramaUrun[];
  sandiklar: GenelAramaSandik[];
}

export interface GenelAramaProje {
  id: number;
  projeNo: string;
  musteri: string;
  projeTipiId: number;
  durumMetni?: string | null;
  sandikSayisi: number;
}

export interface GenelAramaUrun {
  barkod: string;
  aciklama?: string | null;
  projeSayisi: number;
}

export interface GenelAramaSandik {
  id: number;
  sandikNo: string;
  ad?: string | null;
  projeId: number;
  projeNo: string;
  projeTipiId: number;
  durumMetni?: string | null;
}
