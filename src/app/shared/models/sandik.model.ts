// ===== Sandik =====

export interface SandikDto {
  id: number;
  sandikNo: string;
  ad?: string;
  durumId: number;
  durumMetni: string;
  /** Sandık tipi (SandikTipi); Ambalaj senkronunda sandık cinsini belirler. */
  tipId?: number;
  tipMetni?: string;
  sevkiyatDuzeltmeAcikMi?: boolean;
  depoLokasyonId: number;
  depoLokasyonMetni: string;
  urunSayisi: number;
  isManuelSandik: boolean;
  silinebilirMi: boolean;
  depodaSayilacakMi: boolean;
  sahayaAktarildiMi?: boolean;
  sahaUzerindenSevkEdildiMi?: boolean;
  sahayaAktarilanMiktar?: number;
  en?: number;
  boy?: number;
  yukseklik?: number;
  netKg?: number;
  grossKg?: number;
}

export interface SandikDetayDto {
  id: number;
  sandikNo: string;
  ad?: string;
  durumId: number;
  durumMetni: string;
  tipId?: number;
  tipMetni?: string;
  sevkiyatDuzeltmeAcikMi?: boolean;
  depoLokasyonId: number;
  depoLokasyonMetni: string;
  sahayaAktarildiMi?: boolean;
  sahaUzerindenSevkEdildiMi?: boolean;
  sahayaAktarilanMiktar?: number;
  en?: number;
  boy?: number;
  yukseklik?: number;
  netKg?: number;
  grossKg?: number;
  icerikler: SandikIcerikDto[];
}

export interface SandikIcerikDto {
  id: number;
  cekiSatiriId: number;
  olcuResmiPozNo?: string;
  barkodNo: string;
  aciklama: string;
  istenenAdet: number;
  /** Çeki satırındaki sandık dağılımından bağımsız toplam talep. */
  anaIstenenAdet?: number;
  /** Bu sandık içeriğine tahsis edilmiş güncel miktar. */
  sandikMiktari?: number;
  sandikAktarilanGiris?: number;
  sandikAktarilanCikis?: number;
  sandikTransferOzeti?: string;
  konulanAdet: number;
  eksikAdet: number;
  durumId: number;
  durumMetni: string;
  paketleyenBasHarf?: string;
  kontrolEdenBasHarf?: string;
  remarks?: string;
  isManuelEklenen: boolean;
  /** Backend'in aktarım, sevk ve işlem durumlarını birlikte değerlendirerek verdiği güvenli silme kararı. */
  manuelSilinebilirMi: boolean;
  // Saha/Yedek
  isim?: string;
  miktar: number;
  birimId?: number;
  birimMetni?: string;
  // Parçalı karşılama (Madde 2)
  stokKarsilanan: number;
  projeKarsilanan: number;
  tedarikciKarsilanan: number;
  kaynakProjeNo?: string;
  /** Kalıcı ürün bilgisi (seri no, SKT, lot); 3K işlem açıklamasından bağımsızdır. */
  urunBilgisi?: string | null;
}

/** Sandık satırının kalıcı ürün bilgisini günceller; boş değer bilgiyi siler. Grid ve 3K aynı ucu kullanır. */
export interface SandikIcerikBilgisiGuncelleDto {
  projeId: number;
  sandikId: number;
  sandikIcerikId: number;
  urunBilgisi: string | null;
  /** Düzenlemeye başlanırken ekranda görülen değer; başkası arada değiştirdiyse sunucu 409 döner. */
  oncekiUrunBilgisi: string | null;
}

export interface SandikEkleDto {
  projeId: number;
  sandikNo: string;
  sandikIsmi?: string;
  tipId: number;
  depoLokasyonId: number;
  en?: number;
  boy?: number;
  yukseklik?: number;
  netKg?: number;
  grossKg?: number;
}

export interface ManuelUrunEkleDto {
  projeId: number;
  sandikId: number;
  barkodNo: string;
  aciklama: string;
  istenenAdet: number;
  birimId: number;
  eklemeNedeni?: string;
}

export interface UrunGuncelleDto {
  cekiSatiriId?: number | null;
  sandikIcerikId?: number;
  sandikId: number;
  konulanAdet?: number;
  eksikAdet?: number;
  gridDurumuId?: number;
  ucKDurumuId?: number;
  paketleyenId?: number;
  kontrolEdenId?: number;
  aciklama?: string;
  kullaniciId: number;
  projeId: number;
}

export interface SandikOzellikGuncelleDto {
  sandikId: number;
  sandikIsmi?: string;
  /** Sandık tipi zorunludur (G2). */
  tipId: number;
  en?: number;
  boy?: number;
  yukseklik?: number;
  netKg?: number;
  grossKg?: number;
  depoLokasyonId?: number;
}

export interface UrunTasiDto {
  kaynakSandikIcerikId: number;
  hedefSandikId: number;
  tasinanAdet: number;
  projeId: number;
  /** Aynı taşıma isteğinin ağ tekrarlarında ikinci kez uygulanmasını engeller. */
  islemAnahtari: string;
}

export interface EksikUrunForSandikDto {
  cekiSatiriId: number;
  siraNo: number;
  barkodNo: string;
  aciklama: string;
  sandikNo: string;
  istenenAdet: number;
  gelenMiktar: number;
  kalanMiktar: number;
  tamamlamaPlanlananAdet?: number;
  birim: string;
  projeId: number;
  projeNo: string;
}

export interface CekiSatiriAnaVeriGuncelleDto {
  cekiSatiriId: number;
  siraNo: number;
  olcuResmiPozNo?: string | null;
  barkodNo: string;
  aciklama: string;
  istenenAdet: number;
  birimId: number;
  sandikNo: string;
}

export interface CekiSatirlariSilDto {
  cekiSatiriIds: number[];
}

export interface CekiSatirlariSilResultDto {
  silinenSatirSayisi: number;
  silinenSandikSayisi: number;
  silinenCekiSayisi: number;
  iadeEdilenStokHareketiSayisi: number;
  pasifeAlinanTransferSayisi: number;
}
