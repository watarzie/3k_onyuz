import { ApiResult } from './common.model';
import { SandikDto } from './sandik.model';

// ===== Tır seferi (toplu sevk) ve sevkiyat istatistikleri =====
// Sunucu: 3K.Application/Features/SevkiyatIslemleri (SevkiyatController, api/sevkiyat).

/** Toplu sevk sınırları; sunucudaki SevkSeferiKurali ile aynı. */
export const TOPLU_SEVK_EN_FAZLA_PROJE = 25;
export const TOPLU_SEVK_EN_FAZLA_SANDIK = 250;
export const ARAC_PLAKA_EN_FAZLA = 30;
export const SOFOR_EN_FAZLA = 100;
export const SEFER_ACIKLAMA_EN_FAZLA = 500;

export interface TopluSevkProjesi {
  projeId: number;
  sandikIds: number[];
}

export interface TopluSevkIstegi {
  /** Aynı istek tekrarlanırsa (ağ hatası sonrası) sefer ikinci kez oluşmaz; farklı istek yeni anahtar alır. */
  islemAnahtari: string;
  sevkTarihi: string;
  aracPlaka: string;
  sofor?: string;
  dorsePlaka?: string;
  aciklama?: string;
  projeler: TopluSevkProjesi[];
}

export interface TopluSevkSonucu {
  seferId: number;
  seferNo: string;
  projeSayisi: number;
  sandikSayisi: number;
}

/** 409 reddinde proje bazında engel; sandikIds engele neden olan sandıklardır (boş olabilir). */
export interface TopluSevkSorunu {
  projeId: number;
  projeNo?: string | null;
  sandikIds: number[];
  mesaj: string;
}

export interface TopluSevkApiResult extends ApiResult<TopluSevkSonucu> {
  issues?: TopluSevkSorunu[];
}

/** Sefer listesi satırı. Sefere bağlı olmayan eski sevkiyatlar plaka + sevk günüyle "eski kayıt" olarak gruplanır. */
export interface SevkSeferiOzet {
  anahtar: string;
  seferId?: number | null;
  seferNo: string;
  eskiKayit: boolean;
  aracPlaka?: string | null;
  sofor?: string | null;
  dorsePlaka?: string | null;
  sevkTarihi: string;
  projeSayisi: number;
  sandikSayisi: number;
  brutKg?: number | null;
  duzeltmesiAcikSandikVar: boolean;
  projeNolari: string[];
}

export interface SevkSeferiSandik {
  sandikId: number;
  sandikNo: string;
  sandikAdi?: string | null;
  brutKg?: number | null;
  sevkiyatDuzeltmeAcikMi: boolean;
}

export interface SevkSeferiProje {
  projeId: number;
  projeNo: string;
  projeTipiId: number;
  sevkiyatNo: number;
  sandiklar: SevkSeferiSandik[];
}

export interface SevkSeferiDetay {
  sefer: SevkSeferiOzet;
  aciklama?: string | null;
  kullaniciAdSoyad?: string | null;
  projeler: SevkSeferiProje[];
}

export interface PlakaIstatistik {
  plaka: string;
  seferSayisi: number;
  sandikSayisi: number;
  projeSayisi: number;
  sonSevk: string;
}

export interface ProjeSevkIstatistik {
  projeId: number;
  projeNo: string;
  projeTipiId: number;
  seferSayisi: number;
  sandikSayisi: number;
  seferNolari: string[];
  plakalar: string[];
}

export interface AylikSevkIstatistik {
  yil: number;
  ay: number;
  seferSayisi: number;
  sandikSayisi: number;
}

export interface SevkiyatIstatistik {
  seferSayisi: number;
  sandikSayisi: number;
  projeSayisi: number;
  buAySeferSayisi: number;
  enCokKullanilanPlaka?: string | null;
  plakalar: PlakaIstatistik[];
  projeler: ProjeSevkIstatistik[];
  aylik: AylikSevkIstatistik[];
}

export interface SevkSeferiFiltre {
  /** yyyy-MM-dd; gün başından itibaren. */
  baslangic?: string;
  /** yyyy-MM-dd; gün sonuna kadar dahil. */
  bitis?: string;
  plaka?: string;
  projeNo?: string;
  projeTipiId?: number | null;
}

/** Sandık sevk edilmiş sayılır: sandık veya saha üzerinden sevk edildi durumu. */
export function sandikSevkEdildiMi(sandik: SandikDto): boolean {
  return sandik.sahaUzerindenSevkEdildiMi === true ||
    sandik.durumId === 4 ||
    sandik.durumMetni === 'SevkEdildi' ||
    sandik.durumMetni === 'Sevk Edildi';
}

/** Sevke hazır sandık: kapalı, sevk edilmemiş ve sahaya aktarılmamış (tekil ve toplu sevkte aynı kural). */
export function sandikSevkAdayiMi(sandik: SandikDto): boolean {
  return sandik.durumId === 3 && !sandikSevkEdildiMi(sandik) && sandik.sahayaAktarildiMi !== true;
}

/** Ekranda plaka gösterimi: "34abc123" / "34-ABC-123" → "34 ABC 123"; Türk plakası biçiminde değilse normalize hâli. */
export function aracPlakaBicimle(plaka: string | null | undefined): string {
  const normal = (plaka ?? '').replace(/[\s-]/g, '').toLocaleUpperCase('en-US').slice(0, ARAC_PLAKA_EN_FAZLA);
  const eslesme = /^([0-9]{2})([A-Z]{1,3})([0-9]{2,5})$/.exec(normal);
  return eslesme ? `${eslesme[1]} ${eslesme[2]} ${eslesme[3]}` : normal;
}
