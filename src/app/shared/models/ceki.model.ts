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
  satirlar: CekiRevizyonOnizlemeSatiri[];
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
  degisiklikler: string[];
  uyarilar: string[];
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
