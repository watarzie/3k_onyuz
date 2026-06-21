// ===== Grid =====
import { SahaTamamlamaIzDto } from './saha-iz.model';

export interface GridUrunDto {
  cekiSatiriId: number;
  sandikIcerikId?: number;
  isSahaManuelSandikIcerigi?: boolean;
  kaynakCekiSatiriId?: number;
  kaynakProjeNo?: string;
  kaynakSandikNo?: string;
  kaynakSiraNo?: number;
  sahaTamamlamalari: SahaTamamlamaIzDto[];
  siraNo: number;
  barkodNo: string;
  olcuResmiPozNo?: string;
  aciklama: string;
  istenenAdet: number;
  birimId: number;
  birim: string;
  sandikNo: string;
  sandikDurumId?: number;
  sandikDurumMetni?: string;
  sandikSevkEdildiMi: boolean;
  gridDurumuId: number;
  gridDurumuMetni: string;
  gridGelenAdet: number;
  trafoSevkAdet: number;
  gridSevkDurumuId: number;
  gridSevkDurumuMetni: string;
  gridSevkMiktari?: number;
  yenidenSevkGerekliAdet: number;
  gridSevkTarihi?: string;
  gridAciklama?: string;
  gridEksikMiktar: number;
  // Parçalı karşılama (Madde 2)
  stokKarsilanan: number;
  projeKarsilanan: number;
  projeGonderilen: number;
  netKullanilabilir: number;
  tedarikciKarsilanan: number;
  eksikMiktar: number;
  kalanMiktar: number;
  ucKDurumuId: number;
  ucKDurumuMetni: string;
  gelenMiktar: number;
  geriGonderilenMiktar: number;
  geriGonderilmeSebebiId?: number;
  geriGonderilmeSebebiMetni?: string;
  kaynakHedefProjeNo?: string;
  // Çapraz açıklama: 3K tarafının açıklaması (Grid tarafı görür)
  ucKAciklama?: string;
  genelDurumId: number;
  genelDurumMetni: string;
  // Kalite & Süreç
  kaliteDurumId?: number;
  kaliteDurumMetni?: string;
  surecDurumId?: number;
  surecDurumMetni?: string;
}

export interface GridDurumGuncelleDto {
  cekiSatiriId: number;
  projeId: number;
  yeniDurumId: number;
  gridGelenAdet?: number;
  trafoSevkAdet?: number;
  gridSevkDurumuId?: number;
  sevkMiktari?: number;
  aciklama?: string;
}

export interface GridTopluSevkDto {
  projeId: number;
  cekiSatiriIdler: number[];
  aciklama?: string;
}

export interface GridDurumSifirlaDto {
  cekiSatiriId: number;
  projeId: number;
  aciklama?: string;
}

export interface KaliteDurumGuncelleDto {
  projeId: number;
  cekiSatiriIdler: number[];
  kaliteDurumId: number;
}

export interface SurecDurumGuncelleDto {
  projeId: number;
  cekiSatiriIdler: number[];
  surecDurumId: number;
}
