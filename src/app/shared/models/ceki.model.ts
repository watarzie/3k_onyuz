import type { ApiResult } from './common.model';

// ===== Ceki =====

export interface CekiYuklemeResultDto {
  cekiId: number;
  projeId: number;
  projeNo: string;
  satirSayisi: number;
  sandikSayisi: number;
  mesaj: string;
}

export interface CekiRevizyonSonuc {
  projeId: number;
  projeNo: string;
  anaCekiId: number;
  revizyonCekiId: number;
  eklenenSatirSayisi: number;
  guncellenenSatirSayisi: number;
  silinenSatirSayisi: number;
  atlananSatirSayisi: number;
  islenenRevizyonSatiriSayisi: number;
  mesaj: string;
  uyarilar: string[];
}

export interface CekiRevizyonOnayTalebiSonuc {
  talepId: number;
  projeId: number;
  projeNo: string;
  anaCekiId: number;
  dosyaAdi: string;
  eklenenSatirSayisi: number;
  guncellenenSatirSayisi: number;
  silinenSatirSayisi: number;
  sonucTipi: 'OnayBekliyor' | 'Uygulandi';
  uygulananRevizyonCekiId: number | null;
  mesaj: string;
}

export interface CekiRevizyonOnayKuyruguYaniti {
  message: string;
  statusCode: 202;
  value: CekiRevizyonOnayTalebiSonuc;
}

/**
 * Onay kuralı açıkken API 202 sarmalayıcısı, kapalıyken doğrudan uygulama
 * sonucunu döndürür. `sonucTipi` alanı iş akışını HTTP gövdesinden güvenle ayırır.
 */
export type CekiRevizyonYuklemeYaniti =
  | CekiRevizyonOnayKuyruguYaniti
  | CekiRevizyonOnayTalebiSonuc;

export interface CekiRevizyonOnizlemeSonuc {
  projeId: number;
  projeNo: string;
  anaCekiId: number;
  dosyaAdi: string;
  toplamIsaretliSatirSayisi: number;
  eklenenSatirSayisi: number;
  guncellenenSatirSayisi: number;
  silinecekSatirSayisi: number;
  riskliSatirSayisi: number;
  engelliSatirSayisi: number;
  uygulanabilirMi: boolean;
  mesaj: string;
  uyarilar: string[];
  sandikEtkileri: CekiRevizyonSandikEtkisi[];
  satirlar: CekiRevizyonOnizlemeSatiri[];
}

/** Revizyon uygulandığında yeni oluşacak veya fiziksel bilgileri değişecek sandık. */
export interface CekiRevizyonSandikEtkisi {
  sandikNo: string;
  yeniSandikMi: boolean;
  durumYenidenHesaplanacakMi: boolean;
  bosKalirsaSilinecekMi: boolean;
  eskiDurumId?: number | null;
  mevcutIcerikSayisi: number;
  mevcutCekiIcerigiSayisi: number;
  tamamlanmisCekiIcerigiSayisi: number;
  eskiAd?: string | null;
  yeniAd?: string | null;
  eskiAdIngilizce?: string | null;
  yeniAdIngilizce?: string | null;
  eskiEn?: number | null;
  yeniEn?: number | null;
  eskiBoy?: number | null;
  yeniBoy?: number | null;
  eskiYukseklik?: number | null;
  yeniYukseklik?: number | null;
  eskiNetKg?: number | null;
  yeniNetKg?: number | null;
  eskiGrossKg?: number | null;
  yeniGrossKg?: number | null;
}

export interface CekiRevizyonOnizlemeSatiri {
  excelSatirNo: number;
  checkKodu: string;
  islemTipi: string;
  riskSeviyesi: string;
  uygulanabilirMi: boolean;
  mesaj: string;
  mevcutCekiSatiriId?: number | null;
  eskiSiraNo?: number | null;
  yeniSiraNo: number;
  barkodNo?: string | null;
  pozNo?: string | null;
  tanim?: string | null;
  eskiKoliNo?: string | null;
  yeniKoliNo?: string | null;
  eskiIstenenAdet?: number | null;
  yeniIstenenAdet?: number | null;
  islemGormusMu: boolean;
  islemGorenAdet: number;
  geriAlmaEtkisi?: CekiRevizyonGeriAlmaEtkisi | null;
  degisiklikler: string[];
  /** Satırın revizyonu neden engellediğini son kullanıcıya güvenli biçimde açıklar. */
  engeller?: string[];
  sorunlar?: CekiRevizyonSorunu[];
  uyarilar: string[];
}

/** U satırında sıfırlanacak, D satırında satırla birlikte kaldırılacak operasyon izleri. */
export interface CekiRevizyonGeriAlmaEtkisi {
  gridDurumuId: number;
  gridGelenAdet: number;
  trafoSevkAdet: number;
  gridSevkDurumuId: number;
  gridSevkMiktari: number;
  yenidenSevkGerekliAdet: number;
  gridSevkTarihi?: string | null;
  gridAciklama?: string | null;
  gridPersonelId?: number | null;

  ucKDurumuId: number;
  ucKKarsilamaTipiId: number;
  gelenMiktar: number;
  teslimTarihi?: string | null;
  kaynakHedefProjeNo?: string | null;
  ucKAciklama?: string | null;
  karsilananMiktar: number;
  stokKarsilanan: number;
  projeKarsilanan: number;
  projeGonderilen: number;
  tedarikciKarsilanan: number;
  hataliMiktar: number;
  geriGonderilenMiktar: number;
  geriGonderilmeSebebiId?: number | null;
  kaynakProjeId?: number | null;
  kaliteDurumId?: number | null;
  surecDurumId?: number | null;
  paketleyenId?: number | null;
  kontrolEdenId?: number | null;

  sandikIcerikSayisi: number;
  tahsisMiktari: number;
  konulanAdet: number;
  eksikAdet: number;
  sandikStokKarsilanan: number;
  sandikProjeKarsilanan: number;
  sandikTedarikciKarsilanan: number;

  stokHareketSayisi: number;
  stoktanKarsilananMiktar: number;
  fazlaTeslimStogaAktarilanMiktar: number;
  digerStokHareketMiktari: number;
  gelenAktifProjeTransferSayisi: number;
  gelenAktifProjeTransferMiktari: number;
  stokHareketleri: CekiRevizyonStokHareketEtkisi[];
  gelenAktifProjeTransferleri: CekiRevizyonGelenTransferEtkisi[];
}

export interface CekiRevizyonStokHareketEtkisi {
  stokHareketiId: number;
  stokKaydiId: number;
  islemTipiId: number;
  miktar: number;
}

export interface CekiRevizyonGelenTransferEtkisi {
  projeTransferiId: number;
  kaynakProjeId: number;
  kaynakCekiSatiriId: number;
  miktar: number;
}

export type CekiRevizyonSorunuKategorisi = 'Dogrulama' | 'DurumCakismasi';

/**
 * Revizyon uygulanırken oluşan beklenen iş kuralı/validasyon sorunlarının
 * kullanıcıya gösterilebilen, satır bağlamı içeren sözleşmesi.
 */
export interface CekiRevizyonSorunu {
  kod: string;
  mesaj: string;
  kategori: CekiRevizyonSorunuKategorisi;
  excelSatirNo?: number | null;
  checkKodu?: string | null;
  siraNo?: number | null;
  barkodNo?: string | null;
  pozNo?: string | null;
  tanim?: string | null;
  sandikNo?: string | null;
}

/** Başarısız revizyon çağrısındaki yapılandırılmış sorunları korur. */
export interface CekiRevizyonApiResult<T> extends ApiResult<T> {
  message?: string;
  issues?: CekiRevizyonSorunu[];
}

export interface CekiSatiriDto {
  id: number;
  siraNo: number;
  olcuResmiPozNo?: string;
  barkodNo: string;
  aciklama: string;
  istenenAdet: number;
  birim: string;
  cekideGecenSandikNo: string;
  fiiliSandikNo?: string;
  remarks?: string;
  durum: string;
  paketleyenBasHarf?: string;
  kontrolEdenBasHarf?: string;
  konulanAdet: number;
  eksikAdet: number;
}
