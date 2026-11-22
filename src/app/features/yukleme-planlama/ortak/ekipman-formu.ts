import {
  AciklikTarafi,
  DingilTuru,
  EKIPMAN_TEKNIK_VERI_SEMA_SURUMU,
  EkipmanKaynakTuru,
  EkipmanKonfigurasyonDetayi,
  EkipmanKonfigurasyonKaydi,
  EkipmanTeknikVerisi,
  EngelTuru,
  TeknikAciklik,
  TeknikBaglamaNoktasi,
  TeknikDingil,
  TeknikEngel,
  TeknikYukYuzeyi,
} from '../../../shared/models/yukleme-planlama.model';

// Ekipman düzenleme formunun saf mantığı: ayrıntıdan formu doldurur, formu teknik veri JSON'una ve kayıt gövdesine
// çevirir. Boş sayı "bilinmiyor" demektir; sıfıra çevrilmez, JSON'a yazılmaz. Alanlar Excel şablonunun sütunlarıdır.

/** Metin alanlarının en fazla uzunluğu (sunucu: `EkipmanKitapligiKurali`). */
export const EKIPMAN_ALAN_SINIRI = { kod: 50, ad: 200, uretici: 100, model: 100, kaynakAciklama: 500, aciklama: 1000 } as const;

type Sayi = number | null;

export interface YuzeySatiri {
  satirId: number;
  kod: string;
  ad: string;
  baslangicXMm: Sayi;
  uzunlukMm: Sayi;
  genislikMm: Sayi;
  yerdenYukseklikMm: Sayi;
  kullanilabilirYukseklikMm: Sayi;
  tabanYukuKgM2: Sayi;
  noktasalYukKg: Sayi;
}

export interface AciklikSatiri {
  satirId: number;
  taraf: AciklikTarafi | null;
  baslangicXMm: Sayi;
  uzunlukMm: Sayi;
  genislikMm: Sayi;
  yukseklikMm: Sayi;
}

export interface EngelSatiri {
  satirId: number;
  tur: EngelTuru | null;
  xMm: Sayi;
  yMm: Sayi;
  zMm: Sayi;
  uzunlukMm: Sayi;
  genislikMm: Sayi;
  yukseklikMm: Sayi;
  sokulebilir: boolean;
  aciklama: string;
}

export interface DingilSatiri {
  satirId: number;
  xMm: Sayi;
  tur: DingilTuru | null;
  grupNo: Sayi;
  kapasiteKg: Sayi;
}

export interface BaglamaSatiri {
  satirId: number;
  xMm: Sayi;
  yMm: Sayi;
  zMm: Sayi;
  kapasiteDaN: Sayi;
}

interface SatirTipleri {
  yuzeyler: YuzeySatiri;
  acikliklar: AciklikSatiri;
  engeller: EngelSatiri;
  dingiller: DingilSatiri;
  baglamaNoktalari: BaglamaSatiri;
}

/** Formun satır eklenip silinen listeleri. */
export type SatirListesi = keyof SatirTipleri;

/** Satırın düzenlenebilir alanları (satır kimliği değişmez). */
export type SatirDegisikligi<K extends SatirListesi> = Partial<Omit<SatirTipleri[K], 'satirId'>>;

export interface EkipmanFormu {
  kod: string;
  ad: string;
  /** Yalnız yeni kayıtta ekran seçimi (aile → tip); gövdeye gitmez. */
  aileId: number | null;
  tipId: number | null;
  uretici: string;
  modelAdi: string;
  kaynakTuru: EkipmanKaynakTuru | null;
  kaynakAciklama: string;
  /** `yyyy-MM-dd`; boşsa tarih yok. */
  kaynakTarihi: string;
  aciklama: string;
  disUzunlukMm: Sayi;
  disGenislikMm: Sayi;
  disYukseklikMm: Sayi;
  daraKg: Sayi;
  teknikKapasiteKg: Sayi;
  azamiBrutKg: Sayi;
  uzamaEnFazlaMm: Sayi;
  kingPinXMm: Sayi;
  azamiBaglantiYukuKg: Sayi;
  yuzeyler: YuzeySatiri[];
  acikliklar: AciklikSatiri[];
  engeller: EngelSatiri[];
  dingiller: DingilSatiri[];
  baglamaNoktalari: BaglamaSatiri[];
}

// Satır kimliği yalnız ekranda satırı izlemek içindir (`track`); sunucuya gitmez.
let sonSatirId = 0;
const yeniSatirId = (): number => ++sonSatirId;

const BOS_SATIR: { [K in SatirListesi]: () => Omit<SatirTipleri[K], 'satirId'> } = {
  yuzeyler: () => ({
    kod: '', ad: '', baslangicXMm: null, uzunlukMm: null, genislikMm: null, yerdenYukseklikMm: null,
    kullanilabilirYukseklikMm: null, tabanYukuKgM2: null, noktasalYukKg: null,
  }),
  acikliklar: () => ({ taraf: null, baslangicXMm: null, uzunlukMm: null, genislikMm: null, yukseklikMm: null }),
  engeller: () => ({
    tur: null, xMm: null, yMm: null, zMm: null, uzunlukMm: null, genislikMm: null, yukseklikMm: null, sokulebilir: false, aciklama: '',
  }),
  dingiller: () => ({ xMm: null, tur: null, grupNo: null, kapasiteKg: null }),
  baglamaNoktalari: () => ({ xMm: null, yMm: null, zMm: null, kapasiteDaN: null }),
};

export function bosEkipmanFormu(): EkipmanFormu {
  return {
    kod: '', ad: '', aileId: null, tipId: null, uretici: '', modelAdi: '',
    kaynakTuru: null, kaynakAciklama: '', kaynakTarihi: '', aciklama: '',
    disUzunlukMm: null, disGenislikMm: null, disYukseklikMm: null,
    daraKg: null, teknikKapasiteKg: null, azamiBrutKg: null, uzamaEnFazlaMm: null,
    kingPinXMm: null, azamiBaglantiYukuKg: null,
    yuzeyler: [], acikliklar: [], engeller: [], dingiller: [], baglamaNoktalari: [],
  };
}

/**
 * Ayrıntı yanıtından formu doldurur. Düzenlemede kod, tip, üretici ve model değiştirilemez (sunucu reddeder); aile
 * seçimi yalnız yeni kayıtta kullanılır. Form yalnız bildiği alanları taşır: okunamayan ya da formun taşıyamadığı
 * teknik veride alanlar eksik dolar; böyle bir kayıt kaydedilmemelidir (`teknikVeriDuzenlemeEngeli`).
 */
export function ekipmanFormuDoldur(detay: EkipmanKonfigurasyonDetayi): EkipmanFormu {
  const v = teknikVeriCoz(detay.teknikVeriJson) ?? {};
  const r = detay.revizyon;
  return {
    kod: detay.kod,
    ad: detay.ad,
    aileId: null,
    tipId: detay.tipId ?? null,
    uretici: detay.uretici,
    modelAdi: detay.modelAdi,
    kaynakTuru: r.kaynakTuru,
    kaynakAciklama: r.kaynakAciklama ?? '',
    kaynakTarihi: r.kaynakTarihi?.slice(0, 10) ?? '',
    aciklama: r.aciklama ?? '',
    disUzunlukMm: v.disOlcu?.uzunlukMm ?? null,
    disGenislikMm: v.disOlcu?.genislikMm ?? null,
    disYukseklikMm: v.disOlcu?.yukseklikMm ?? null,
    daraKg: v.daraKg ?? null,
    teknikKapasiteKg: v.teknikKapasiteKg ?? null,
    azamiBrutKg: v.azamiBrutKg ?? null,
    uzamaEnFazlaMm: v.uzamaEnFazlaMm ?? null,
    kingPinXMm: v.kingPin?.xMm ?? null,
    azamiBaglantiYukuKg: v.kingPin?.azamiBaglantiYukuKg ?? null,
    yuzeyler: (v.yuzeyler ?? []).map((y) => ({
      satirId: yeniSatirId(), kod: metinAl(y.kod), ad: metinAl(y.ad), baslangicXMm: y.baslangicXMm, uzunlukMm: y.uzunlukMm,
      genislikMm: y.genislikMm, yerdenYukseklikMm: y.yerdenYukseklikMm,
      kullanilabilirYukseklikMm: y.kullanilabilirYukseklikMm ?? null, tabanYukuKgM2: y.tabanYukuKgM2 ?? null,
      noktasalYukKg: y.noktasalYukKg ?? null,
    })),
    acikliklar: (v.acikliklar ?? []).map((a) => ({
      satirId: yeniSatirId(), taraf: a.taraf, baslangicXMm: a.baslangicXMm ?? null, uzunlukMm: a.uzunlukMm ?? null,
      genislikMm: a.genislikMm ?? null, yukseklikMm: a.yukseklikMm ?? null,
    })),
    engeller: (v.engeller ?? []).map((e) => ({
      satirId: yeniSatirId(), tur: e.tur, xMm: e.xMm, yMm: e.yMm, zMm: e.zMm, uzunlukMm: e.uzunlukMm, genislikMm: e.genislikMm,
      yukseklikMm: e.yukseklikMm, sokulebilir: e.sokulebilir, aciklama: metinAl(e.aciklama),
    })),
    dingiller: (v.dingiller ?? []).map((d) => ({
      satirId: yeniSatirId(), xMm: d.xMm, tur: d.tur, grupNo: d.grupNo, kapasiteKg: d.kapasiteKg ?? null,
    })),
    baglamaNoktalari: (v.baglamaNoktalari ?? []).map((b) => ({
      satirId: yeniSatirId(), xMm: b.xMm, yMm: b.yMm, zMm: b.zMm, kapasiteDaN: b.kapasiteDaN ?? null,
    })),
  };
}

const OKUNAMADI = 'Kayıtlı teknik veri okunamadı.';

/**
 * Kayıtlı teknik veri bu formla kayıpsız düzenlenemiyorsa nedenini, düzenlenebiliyorsa null döner. Form yalnız bildiği
 * alanları yazar; bu yüzden kayıtlı veri formdan geçirilip geri yazıldığında aynı kalmıyorsa (bilinmeyen alan, eksik
 * zorunlu alanı olan satır, okunamayan JSON, başka şema sürümü) ekrandan kayıt eski veriyi sessizce silerdi. Alan
 * sırası ile boş/eksik liste ve boş değer farkı sayılmaz.
 */
export function teknikVeriDuzenlemeEngeli(detay: EkipmanKonfigurasyonDetayi): string | null {
  let asil: unknown;
  try {
    asil = JSON.parse(detay.teknikVeriJson);
  } catch {
    return OKUNAMADI;
  }
  if (!duzNesne(asil)) return OKUNAMADI;
  // Sürümü yazılmamış veri sunucuda güncel sürüm sayılır.
  const surum = asil['semaSurumu'] ?? EKIPMAN_TEKNIK_VERI_SEMA_SURUMU;
  if (surum !== EKIPMAN_TEKNIK_VERI_SEMA_SURUMU)
    return `Kayıtlı teknik verinin şema sürümü (${kisalt(String(surum))}) bu ekranda desteklenmiyor.`;

  const onceki = sade({ ...asil, semaSurumu: surum }) as Record<string, unknown>;
  const sonraki = sade(formdanTeknikVeri(ekipmanFormuDoldur(detay))) as Record<string, unknown>;
  const farkli = [...new Set([...Object.keys(onceki), ...Object.keys(sonraki)])]
    .filter((alan) => JSON.stringify(onceki[alan]) !== JSON.stringify(sonraki[alan]));
  if (!farkli.length) return null;
  const alanlar = farkli.slice(0, 5).map(kisalt).join(', ') + (farkli.length > 5 ? '…' : '');
  return `Kayıtlı teknik veride bu formun taşıyamadığı alan ya da değer var (${alanlar}); ekrandan kaydedilirse kaybolur.`;
}

export function satirEkle<K extends SatirListesi>(form: EkipmanFormu, liste: K): EkipmanFormu {
  return { ...form, [liste]: [...form[liste], { ...BOS_SATIR[liste](), satirId: yeniSatirId() }] };
}

export function satirSil(form: EkipmanFormu, liste: SatirListesi, satirId: number): EkipmanFormu {
  return { ...form, [liste]: form[liste].filter((s) => s.satirId !== satirId) };
}

export function satirGuncelle<K extends SatirListesi>(
  form: EkipmanFormu, liste: K, satirId: number, degisiklik: SatirDegisikligi<K>,
): EkipmanFormu {
  return { ...form, [liste]: form[liste].map((s) => (s.satirId === satirId ? { ...s, ...degisiklik } : s)) };
}

/**
 * Formun teknik verisi, sunucu şemasında: bilinmeyen (boş) değer yazılmaz. Zorunlu alanı eksik satır atlanır; canlı
 * önizleme yarım satırı çizmez, kayıttan önce `ekipmanFormuDenetle` yarım satırı zaten bildirir.
 */
export function formdanTeknikVeri(form: EkipmanFormu): EkipmanTeknikVerisi {
  const { disUzunlukMm: u, disGenislikMm: g, disYukseklikMm: y } = form;
  return dolular<EkipmanTeknikVerisi>({
    semaSurumu: EKIPMAN_TEKNIK_VERI_SEMA_SURUMU,
    disOlcu: u != null && g != null && y != null ? { uzunlukMm: u, genislikMm: g, yukseklikMm: y } : null,
    daraKg: form.daraKg,
    teknikKapasiteKg: form.teknikKapasiteKg,
    azamiBrutKg: form.azamiBrutKg,
    uzamaEnFazlaMm: form.uzamaEnFazlaMm,
    kingPin: form.kingPinXMm != null ? dolular({ xMm: form.kingPinXMm, azamiBaglantiYukuKg: form.azamiBaglantiYukuKg }) : null,
    yuzeyler: form.yuzeyler.map(yuzeyVerisi).filter(varMi),
    acikliklar: form.acikliklar.map(aciklikVerisi).filter(varMi),
    engeller: form.engeller.map(engelVerisi).filter(varMi),
    dingiller: form.dingiller.map(dingilVerisi).filter(varMi),
    baglamaNoktalari: form.baglamaNoktalari.map(baglamaVerisi).filter(varMi),
  });
}

/**
 * Kayıttan önce formun yapısal eksikleri (zorunlu alan, tamsayı, birlikte girilmesi gereken ölçüler). Değerlerin
 * geçerliliğine (aralık, çakışma, kategoriye göre beklenen veri) sunucu karar verir.
 */
export function ekipmanFormuDenetle(form: EkipmanFormu, yeni: boolean): string[] {
  const sorunlar: string[] = [];
  const zorunlu = (dolu: boolean, ad: string): void => {
    if (!dolu) sorunlar.push(`${ad} zorunludur.`);
  };
  if (yeni) zorunlu(!!form.kod.trim(), 'Kod');
  zorunlu(!!form.ad.trim(), 'Ad');
  zorunlu(form.tipId != null, 'Tip');
  zorunlu(!!form.uretici.trim(), 'Üretici');
  zorunlu(!!form.modelAdi.trim(), 'Model');
  zorunlu(form.kaynakTuru != null, 'Kaynak türü');

  const disOlculer = [form.disUzunlukMm, form.disGenislikMm, form.disYukseklikMm];
  if (disOlculer.some((d) => d != null) && disOlculer.some((d) => d == null))
    sorunlar.push('Dış ölçünün uzunluk, genişlik ve yüksekliği birlikte girilmelidir.');
  if (form.kingPinXMm == null && form.azamiBaglantiYukuKg != null)
    sorunlar.push('Bağlantı yükü girildiyse king pin konumu (X) da girilmelidir.');
  tamsayiDenetle(sorunlar, 'Ölçü ve ağırlık', [
    ...disOlculer, form.daraKg, form.teknikKapasiteKg, form.azamiBrutKg, form.uzamaEnFazlaMm, form.kingPinXMm, form.azamiBaglantiYukuKg,
  ]);

  form.yuzeyler.forEach((s, i) => {
    const ad = `Yükleme yüzeyi ${i + 1}`;
    if (!yuzeyVerisi(s)) sorunlar.push(`${ad}: kod, başlangıç X, uzunluk, genişlik ve yerden yükseklik zorunludur.`);
    tamsayiDenetle(sorunlar, ad, [
      s.baslangicXMm, s.uzunlukMm, s.genislikMm, s.yerdenYukseklikMm, s.kullanilabilirYukseklikMm, s.tabanYukuKgM2, s.noktasalYukKg,
    ]);
  });
  form.acikliklar.forEach((s, i) => {
    const ad = `Açıklık ${i + 1}`;
    if (!aciklikVerisi(s)) sorunlar.push(`${ad}: taraf zorunludur.`);
    tamsayiDenetle(sorunlar, ad, [s.baslangicXMm, s.uzunlukMm, s.genislikMm, s.yukseklikMm]);
  });
  form.engeller.forEach((s, i) => {
    const ad = `Engel ${i + 1}`;
    if (!engelVerisi(s)) sorunlar.push(`${ad}: tür, X, Y, Z, uzunluk, genişlik ve yükseklik zorunludur.`);
    tamsayiDenetle(sorunlar, ad, [s.xMm, s.yMm, s.zMm, s.uzunlukMm, s.genislikMm, s.yukseklikMm]);
  });
  form.dingiller.forEach((s, i) => {
    const ad = `Dingil ${i + 1}`;
    if (!dingilVerisi(s)) sorunlar.push(`${ad}: X, tür ve grup no zorunludur.`);
    tamsayiDenetle(sorunlar, ad, [s.xMm, s.grupNo, s.kapasiteKg]);
  });
  form.baglamaNoktalari.forEach((s, i) => {
    const ad = `Bağlama noktası ${i + 1}`;
    if (!baglamaVerisi(s)) sorunlar.push(`${ad}: X, Y ve Z zorunludur.`);
    tamsayiDenetle(sorunlar, ad, [s.xMm, s.yMm, s.zMm, s.kapasiteDaN]);
  });
  return sorunlar;
}

/** Ekleme/güncelleme gövdesi; zorunlu seçim (tip, kaynak türü) yoksa null. Boş metin `null` gider. */
export function ekipmanKaydi(form: EkipmanFormu): EkipmanKonfigurasyonKaydi | null {
  if (form.tipId == null || form.kaynakTuru == null) return null;
  return {
    kod: form.kod.trim(),
    ad: form.ad.trim(),
    tipId: form.tipId,
    uretici: form.uretici.trim(),
    modelAdi: form.modelAdi.trim(),
    kaynakTuru: form.kaynakTuru,
    kaynakAciklama: metin(form.kaynakAciklama),
    kaynakTarihi: form.kaynakTarihi || null,
    aciklama: metin(form.aciklama),
    teknikVeriJson: JSON.stringify(formdanTeknikVeri(form)),
  };
}

/**
 * Hata yanıtındaki `issues` madde metinleri. Kural sorununda metin listesidir; model bağlama hatasında nesnedir
 * (alan → mesajlar) ve değerleri düzleştirilir. Yoksa boş.
 */
export function sorunMetinleri(yanit: unknown): string[] {
  const issues = (yanit as { issues?: unknown } | null)?.issues;
  const ogeler: unknown[] = Array.isArray(issues) ? issues : issues && typeof issues === 'object' ? Object.values(issues).flat() : [];
  return ogeler.filter((s): s is string => typeof s === 'string' && !!s.trim());
}

/**
 * Teknik veri JSON'unu okur; okunamazsa null. Nesne olmayan alt kayıt ve liste ögesi atılır (form doldurulurken hata
 * vermesin); atılan değer `teknikVeriDuzenlemeEngeli` ile yakalanır.
 */
function teknikVeriCoz(json: string): EkipmanTeknikVerisi | null {
  let veri: unknown;
  try {
    veri = JSON.parse(json);
  } catch {
    return null;
  }
  if (!duzNesne(veri)) return null;
  const nesne = <T>(deger: unknown): T | undefined => (duzNesne(deger) ? (deger as T) : undefined);
  const liste = <T>(deger: unknown): T[] => (Array.isArray(deger) ? (deger.filter(duzNesne) as T[]) : []);
  return {
    ...(veri as EkipmanTeknikVerisi),
    disOlcu: nesne(veri['disOlcu']),
    kingPin: nesne(veri['kingPin']),
    yuzeyler: liste(veri['yuzeyler']),
    acikliklar: liste(veri['acikliklar']),
    engeller: liste(veri['engeller']),
    dingiller: liste(veri['dingiller']),
    baglamaNoktalari: liste(veri['baglamaNoktalari']),
  };
}

function duzNesne(deger: unknown): deger is Record<string, unknown> {
  return !!deger && typeof deger === 'object' && !Array.isArray(deger);
}

/** Karşılaştırma için sadeleştirir: alanlar sıralanır, metin kırpılır; null, boş metin ve boş liste "yok" sayılır. */
function sade(deger: unknown): unknown {
  if (Array.isArray(deger)) return deger.map(sade);
  if (duzNesne(deger)) {
    return Object.fromEntries(
      Object.entries(deger)
        .map(([alan, d]): [string, unknown] => [alan, sade(d)])
        .filter(([, d]) => d != null && d !== '' && !(Array.isArray(d) && d.length === 0))
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
    );
  }
  return typeof deger === 'string' ? deger.trim() : deger;
}

/** Kayıtlı veriden gelen metin alanı; metin değilse boş (form alanı metin bekler). */
function metinAl(deger: unknown): string {
  return typeof deger === 'string' ? deger : '';
}

/** Kayıtlı veriden gelen ad ya da değer uyarıya sınırlı uzunlukta yazılır. */
function kisalt(metinDegeri: string): string {
  return metinDegeri.length > 40 ? metinDegeri.slice(0, 40) + '…' : metinDegeri;
}

function yuzeyVerisi(s: YuzeySatiri): TeknikYukYuzeyi | null {
  const kod = s.kod.trim();
  if (!kod || s.baslangicXMm == null || s.uzunlukMm == null || s.genislikMm == null || s.yerdenYukseklikMm == null) return null;
  return dolular<TeknikYukYuzeyi>({
    kod, ad: metin(s.ad), baslangicXMm: s.baslangicXMm, uzunlukMm: s.uzunlukMm, genislikMm: s.genislikMm,
    yerdenYukseklikMm: s.yerdenYukseklikMm, kullanilabilirYukseklikMm: s.kullanilabilirYukseklikMm,
    tabanYukuKgM2: s.tabanYukuKgM2, noktasalYukKg: s.noktasalYukKg,
  });
}

function aciklikVerisi(s: AciklikSatiri): TeknikAciklik | null {
  if (s.taraf == null) return null;
  return dolular<TeknikAciklik>({
    taraf: s.taraf, baslangicXMm: s.baslangicXMm, uzunlukMm: s.uzunlukMm, genislikMm: s.genislikMm, yukseklikMm: s.yukseklikMm,
  });
}

function engelVerisi(s: EngelSatiri): TeknikEngel | null {
  if (s.tur == null || s.xMm == null || s.yMm == null || s.zMm == null || s.uzunlukMm == null || s.genislikMm == null ||
    s.yukseklikMm == null) return null;
  return dolular<TeknikEngel>({
    tur: s.tur, xMm: s.xMm, yMm: s.yMm, zMm: s.zMm, uzunlukMm: s.uzunlukMm, genislikMm: s.genislikMm,
    yukseklikMm: s.yukseklikMm, sokulebilir: s.sokulebilir, aciklama: metin(s.aciklama),
  });
}

function dingilVerisi(s: DingilSatiri): TeknikDingil | null {
  if (s.xMm == null || s.tur == null || s.grupNo == null) return null;
  return dolular<TeknikDingil>({ xMm: s.xMm, tur: s.tur, grupNo: s.grupNo, kapasiteKg: s.kapasiteKg });
}

function baglamaVerisi(s: BaglamaSatiri): TeknikBaglamaNoktasi | null {
  if (s.xMm == null || s.yMm == null || s.zMm == null) return null;
  return dolular<TeknikBaglamaNoktasi>({ xMm: s.xMm, yMm: s.yMm, zMm: s.zMm, kapasiteDaN: s.kapasiteDaN });
}

function tamsayiDenetle(sorunlar: string[], ad: string, degerler: Sayi[]): void {
  if (degerler.some((d) => d != null && !Number.isInteger(d))) sorunlar.push(`${ad}: sayılar tamsayı olmalıdır (mm, kg).`);
}

/** Kırpılmış metin; boşsa null ("bilinmiyor"). */
function metin(deger: string): string | null {
  return deger.trim() || null;
}

/** Boş (null) alanları atar: sunucu şemasında bilinmeyen değer yazılmaz. */
function dolular<T extends object>(nesne: T): T {
  return Object.fromEntries(Object.entries(nesne).filter(([, deger]) => deger != null)) as T;
}

function varMi<T>(deger: T | null): deger is T {
  return deger !== null;
}
