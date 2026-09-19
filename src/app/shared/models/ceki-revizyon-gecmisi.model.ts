import { CekiRevizyonOnizlemeSonuc } from './ceki.model';

export interface CekiRevizyonGecmisiKaydi {
  kaynak: 'talep' | 'ceki';
  kayitId: number;
  projeId: number;
  revizyonCekiId: number | null;
  dosyaAdi: string;
  yukleyen: string | null;
  yuklemeTarihi: string;
  uygulamaTarihi: string | null;
  onaylayan: string | null;
  kararTarihi: string | null;
  durum: string;
  eklenenSatirSayisi: number | null;
  guncellenenSatirSayisi: number | null;
  silinenSatirSayisi: number | null;
  dosyaMevcut: boolean;
  detayMevcut: boolean;
  bilgi: string | null;
}

export interface CekiRevizyonGecmisiDetayi {
  kayit: CekiRevizyonGecmisiKaydi;
  onizleme: CekiRevizyonOnizlemeSonuc | null;
}
