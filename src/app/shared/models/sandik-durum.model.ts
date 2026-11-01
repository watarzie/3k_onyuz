// ===== Sandık açılış/kapanış olayları ve istatistiği =====

/** Sunucudaki SandikDurumOlayTuru. */
export enum SandikDurumOlayTuru {
  Kapandi = 1,
  Acildi = 2,
}

/** Sunucudaki SandikDurumOlayKaynagi. */
export enum SandikDurumOlayKaynagi {
  Elle = 1,
  Toplu = 2,
  Otomatik = 3,
  GecmistenAktarildi = 4,
}

/** Sunucudaki SandikDurumOlayKurali.NotEnFazlaUzunluk ile aynı. */
export const SANDIK_ACMA_NOTU_EN_FAZLA = 500;

/** Tek açılış/kapanış olayı (sandık zaman çizelgesi ve istatistikteki son olaylar). */
export interface SandikDurumOlayi {
  id: number;
  projeId: number;
  projeNo: string;
  musteri: string;
  sandikId?: number | null;
  sandikNo: string;
  tur: SandikDurumOlayTuru;
  turMetni: string;
  kaynak: SandikDurumOlayKaynagi;
  kaynakMetni: string;
  eskiDurumMetni?: string | null;
  yeniDurumMetni: string;
  sebepId?: number | null;
  sebepMetni?: string | null;
  not?: string | null;
  kullaniciId?: number | null;
  kullaniciAdi?: string | null;
  tarih: string;
}

export interface SandikDurumIstatistikKriteri {
  baslangic?: string | null;
  bitis?: string | null;
  projeArama?: string | null;
  musteri?: string | null;
}

export interface SandikDurumIstatistikOzeti {
  kapanmaSayisi: number;
  topluKapanmaSayisi: number;
  otomatikKapanmaSayisi: number;
  acilmaSayisi: number;
  elleAcilmaSayisi: number;
  otomatikAcilmaSayisi: number;
  gecmistenAktarilanAcilmaSayisi: number;
  acilanSandikSayisi: number;
  projeSayisi: number;
  /** Sayfalı sekmelerin toplamları. */
  musteriSayisi: number;
  kisiSayisi: number;
  olaySayisi: number;
}

export interface SandikDurumSebepSatiri { sebepId?: number | null; sebep: string; sayi: number; }
export interface SandikDurumKisiSatiri { kullaniciId?: number | null; kullaniciAdi: string; kapatmaSayisi: number; geriAcmaSayisi: number; }
export interface SandikDurumProjeSatiri {
  projeId: number; projeNo: string; musteri: string;
  kapanmaSayisi: number; acilmaSayisi: number; elleAcilmaSayisi: number; acilanSandikSayisi: number;
}
export interface SandikDurumMusteriSatiri {
  musteri: string; projeSayisi: number; kapanmaSayisi: number; acilmaSayisi: number; elleAcilmaSayisi: number;
}
export interface SandikDurumSandikSatiri {
  sandikId?: number | null; projeId: number; projeNo: string; musteri: string; sandikNo: string;
  acilmaSayisi: number; elleAcilmaSayisi: number; kapanmaSayisi: number; sonAcilma: string;
}

/**
 * İstatistik özeti: sayılar, sebep dağılımı ve en çok geri açılan 20 sandık. Proje, müşteri, kişi ve olay tabloları
 * büyüyebildiği için ayrı uçlardan sunucuda sayfalı gelir (PaginatedList).
 */
export interface SandikDurumIstatistigi {
  kriter: SandikDurumIstatistikKriteri;
  olusturmaTarihi: string;
  ozet: SandikDurumIstatistikOzeti;
  sebepler: SandikDurumSebepSatiri[];
  enCokAcilanlar: SandikDurumSandikSatiri[];
}

/** Sunucunun Türkiye saatiyle yazdığı zaman (saat dilimsiz) → "24.10.2026 14:32"; boşsa null. */
export function sandikTarihMetni(tarih: string | null | undefined): string | null {
  if (!tarih) return null;
  const t = new Date(tarih);
  if (Number.isNaN(t.getTime())) return null;
  const iki = (n: number) => String(n).padStart(2, '0');
  return `${iki(t.getDate())}.${iki(t.getMonth() + 1)}.${t.getFullYear()} ${iki(t.getHours())}:${iki(t.getMinutes())}`;
}

/** Sandık kartındaki eksik uyarısı ("Eksik: 2 ürün / 5 adet"); eksik yoksa null. */
export function sandikEksikMetni(s: { eksikUrunSayisi?: number; eksikAdet?: number }): string | null {
  const urun = s.eksikUrunSayisi ?? 0;
  if (urun <= 0) return null;
  const adet = (s.eksikAdet ?? 0).toLocaleString('tr-TR', { maximumFractionDigits: 2 });
  return `Eksik: ${urun} ürün / ${adet} adet`;
}
