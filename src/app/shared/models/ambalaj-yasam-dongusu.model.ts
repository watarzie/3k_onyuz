export interface AmbalajFormOlusturRequest {
  kayitIdleri: number[];
  kaynakSandikIdleri: number[];
  projeId?: number;
  idempotencyAnahtari: string;
  yenidenOlustur: boolean;
  aciklama?: string;
}
export interface AmbalajFormSurumu {
  id: number;
  formKimligi: string;
  surum: number;
  olusturmaTarihi: string;
  olusturanKullaniciId: number;
  aciklama?: string;
  form: {
    projeNo: string;
    netM3: number | null;
    sarfM3: number | null;
    toplamM3: number | null;
    kalemler: { kayitId: number; sandikNo: string; adet: number; m3HesaplanabilirMi: boolean; netM3: number | null }[];
  };
}
export interface AmbalajGerceklesme {
  id: number;
  gerceklesmeKimligi: string;
  surum: number;
  kayitId: number;
  tarih: string;
  projeId: number | null;
  projeNo: string;
  sandikNo: string;
  sandikCinsi: number;
  tur: number;
  adet: number;
  m3HesaplanabilirMi: boolean;
  netM3: number | null;
  sarfM3: number | null;
  sarfDahilM3: number | null;
}
export interface AmbalajGerceklesmeOzeti {
  anahtar: string;
  adet: number;
  netM3: number | null;
  sarfM3: number | null;
  sarfDahilM3: number | null;
}
export interface AmbalajGerceklesenRapor {
  baslangic: string;
  bitis: string;
  m3Tanimi: string;
  m3Gorunur: boolean;
  sarfGorunur: boolean;
  tarihiBelirsizEskiKayitSayisi: number;
  kayitlar: AmbalajGerceklesme[];
  toplam: AmbalajGerceklesmeOzeti;
  projeler: AmbalajGerceklesmeOzeti[];
  gunler: AmbalajGerceklesmeOzeti[];
  aylar: AmbalajGerceklesmeOzeti[];
  cinsler: AmbalajGerceklesmeOzeti[];
}
