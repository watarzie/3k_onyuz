import { EkipmanTeknikVerisi, ElleAracIstegi, ElleEkipmanSecenegi, PlanAraci, PlanYerlesimi, YuklemePlaniDetayi } from '../../../shared/models/index';
import { satirAnahtari } from './plan-yuk-listesi';

/**
 * Elle yerleşim düzenleyicisinin saf mantığı (Simülasyon isterleri 20–22). Koordinatlar ekipmanınkidir: X önden arkaya,
 * Y soldan sağa, Z yerden yukarı (mm). Burada yalnız konum hesaplanır ve hızlı yerel kontrol yapılır; asıl kontrol
 * sunucudadır (denetle) ve hiçbir kontrol istemcide atlanmış sayılmaz.
 */

/** Düzenleyicideki yük. <c>boyMm</c>/<c>enMm</c> yükün kendi (döndürülmemiş) ölçüleridir. */
export interface ElleYuk {
  anahtar: string;
  kod: string;
  projeNo: string | null;
  brutKg: number;
  boyMm: number;
  enMm: number;
  yukseklikMm: number;
  xMm: number;
  yMm: number;
  zMm: number;
  donduruldu: boolean;
}

export interface ElleArac {
  /** Düzenleyici içindeki kalıcı kimlik (araç numarası sıra değişince kayar). */
  kimlik: number;
  konfigurasyonId: number;
  ekipmanKodu: string;
  ekipmanAdi: string;
  tipAdi: string;
  teknikVeriJson: string;
  veri: EkipmanTeknikVerisi | null;
  yukler: ElleYuk[];
}

export interface ElleTaslak {
  araclar: ElleArac[];
  /** Hiçbir araca konmamış yükler (isterler 20: bekleyenler listesi). */
  bekleyenler: ElleYuk[];
}

export interface ElleYuzey {
  kod: string;
  xBas: number;
  uzunluk: number;
  yBas: number;
  genislik: number;
  z: number;
}

/** Sunucudaki elle tolerans (AracYerlesimi.ElleTolerans) ile aynı: yükseklik/konum eşleşmesinde kabul edilen sapma. */
export const ELLE_TOLERANS = 2;
/** Sürüklemede kenara/eksene yapışma mesafesi (mm). */
export const YAPISMA_MM = 120;
/** Yapışma yoksa konumun yuvarlandığı adım (mm). */
export const IZGARA_MM = 10;

function teknikVeri(json: string): EkipmanTeknikVerisi | null {
  try {
    return JSON.parse(json) as EkipmanTeknikVerisi;
  } catch {
    return null;
  }
}

/** Yerleştirilmiş (döndürmeyle) taban ölçüsü. */
export function olcu(y: ElleYuk): { boy: number; en: number } {
  return y.donduruldu ? { boy: y.enMm, en: y.boyMm } : { boy: y.boyMm, en: y.enMm };
}

/** Aracın dış genişliği; bilinmiyorsa en geniş yüzey (motorla aynı). */
export function disGenislik(v: EkipmanTeknikVerisi | null): number {
  return v?.disOlcu?.genislikMm ?? Math.max(0, ...(v?.yuzeyler ?? []).map((y) => y.genislikMm));
}

/** Aracın dış uzunluğu; bilinmiyorsa yüzeylerin bittiği yer. */
export function disUzunluk(v: EkipmanTeknikVerisi | null): number {
  return v?.disOlcu?.uzunlukMm ?? Math.max(0, ...(v?.yuzeyler ?? []).map((y) => y.baslangicXMm + y.uzunlukMm));
}

/** Yükleme yüzeyleri; Y başlangıcı motordaki gibi dış genişlikte ortalanır. */
export function yuzeyler(v: EkipmanTeknikVerisi | null): ElleYuzey[] {
  const g = disGenislik(v);
  return (v?.yuzeyler ?? []).map((y) => ({
    kod: y.kod,
    xBas: y.baslangicXMm,
    uzunluk: y.uzunlukMm,
    yBas: Math.max(0, Math.trunc((g - y.genislikMm) / 2)),
    genislik: y.genislikMm,
    z: y.yerdenYukseklikMm,
  }));
}

/**
 * Yerleşimden düzenleme taslağı (varsayılan: son hesaplanan ya da elle kaydedilen; "kalanı otomatik diz" sonucu da
 * verilebilir). Yerleşim yoksa araç yoktur ve bütün hesaplanabilir yükler bekler (sıfırdan elle dizim).
 */
export function taslakKur(plan: YuklemePlaniDetayi, yerlesim: PlanYerlesimi | null = plan.yerlesim): ElleTaslak {
  const araclar = (yerlesim?.araclar ?? []).map((a, i) => aracTaslagi(a, i + 1));
  const yerlesen = new Set(araclar.flatMap((a) => a.yukler.map((y) => y.anahtar)));
  const bekleyenler: ElleYuk[] = [];
  for (const s of plan.yukler) {
    const anahtar = satirAnahtari(s);
    if (!s.dahil || yerlesen.has(anahtar) || s.boyMm == null || s.enMm == null || s.yukseklikMm == null || s.brutKg == null) continue;
    if (s.boyMm <= 0 || s.enMm <= 0 || s.yukseklikMm <= 0 || s.brutKg <= 0) continue;
    bekleyenler.push({
      anahtar,
      kod: s.birimSayisi > 1 ? `${s.kod} (${s.birimNo}/${s.birimSayisi})` : s.kod,
      projeNo: s.projeNo,
      brutKg: s.brutKg,
      boyMm: Math.ceil(s.boyMm),
      enMm: Math.ceil(s.enMm),
      yukseklikMm: Math.ceil(s.yukseklikMm),
      xMm: 0,
      yMm: 0,
      zMm: 0,
      donduruldu: false,
    });
  }
  return { araclar, bekleyenler };
}

function aracTaslagi(a: PlanAraci, kimlik: number): ElleArac {
  return {
    kimlik,
    konfigurasyonId: a.konfigurasyonId,
    ekipmanKodu: a.ekipmanKodu,
    ekipmanAdi: a.ekipmanAdi,
    tipAdi: a.tipAdi,
    teknikVeriJson: a.teknikVeriJson,
    veri: teknikVeri(a.teknikVeriJson),
    yukler: a.konumlar.map((k) => ({
      anahtar: k.yukAnahtari,
      kod: k.kod,
      projeNo: k.projeNo,
      brutKg: k.brutKg,
      // Konumdaki ölçü yerleşmiş ölçüdür; yükün kendi ölçüsü döndürmeyle geri çevrilir.
      boyMm: k.donduruldu ? k.enMm : k.boyMm,
      enMm: k.donduruldu ? k.boyMm : k.enMm,
      yukseklikMm: k.yukseklikMm,
      xMm: k.xMm,
      yMm: k.yMm,
      zMm: k.zMm,
      donduruldu: k.donduruldu,
    })),
  };
}

/** Sunucuya giden istek: araç sırası araç numarasıdır. */
export function istek(t: ElleTaslak): ElleAracIstegi[] {
  return t.araclar.map((a) => ({
    konfigurasyonId: a.konfigurasyonId,
    konumlar: a.yukler.map((y) => ({ yukAnahtari: y.anahtar, xMm: y.xMm, yMm: y.yMm, zMm: y.zMm, donduruldu: y.donduruldu })),
  }));
}

function ortusur(ax: number, ay: number, ab: number, ae: number, bx: number, by: number, bb: number, be: number): boolean {
  return ax < bx + bb && bx < ax + ab && ay < by + be && by < ay + ae;
}

function tabanOrtusur(a: ElleYuk, b: ElleYuk): boolean {
  const oa = olcu(a);
  const ob = olcu(b);
  return ortusur(a.xMm, a.yMm, oa.boy, oa.en, b.xMm, b.yMm, ob.boy, ob.en);
}

/** Yük ve üstüne (doğrudan ya da dolaylı) oturan yükler: sürüklemede birlikte taşınır. */
export function istif(arac: ElleArac, anahtar: string): ElleYuk[] {
  const kok = arac.yukler.find((y) => y.anahtar === anahtar);
  if (!kok) return [];
  const sonuc = [kok];
  for (let i = 0; i < sonuc.length; i++) {
    const alt = sonuc[i];
    for (const y of arac.yukler) {
      if (sonuc.includes(y)) continue;
      if (y.zMm >= alt.zMm + alt.yukseklikMm - ELLE_TOLERANS && tabanOrtusur(alt, y)) sonuc.push(y);
    }
  }
  return sonuc;
}

export function ustundeYukVar(arac: ElleArac, anahtar: string): boolean {
  return istif(arac, anahtar).length > 1;
}

/** Yükün altındaki yüzeyin yüksekliği: X'in düştüğü yüzey, yoksa en yakın yüzey; yüzey yoksa 0. */
function yuzeyYuksekligi(arac: ElleArac, x: number, boy: number): number {
  const ys = yuzeyler(arac.veri);
  if (ys.length === 0) return 0;
  const orta = x + boy / 2;
  const icinde = ys.find((s) => orta >= s.xBas && orta <= s.xBas + s.uzunluk);
  if (icinde) return icinde.z;
  return [...ys].sort((a, b) => Math.min(Math.abs(orta - a.xBas), Math.abs(orta - a.xBas - a.uzunluk))
    - Math.min(Math.abs(orta - b.xBas), Math.abs(orta - b.xBas - b.uzunluk)))[0].z;
}

/** Bırakılan yükün oturacağı yükseklik: altındaki en yüksek yükün üstü, yük yoksa yüzey (yerçekimi). */
export function oturmaYuksekligi(arac: ElleArac, x: number, y: number, boy: number, en: number, haric: ReadonlySet<string>): number {
  let z = yuzeyYuksekligi(arac, x, boy);
  for (const d of arac.yukler) {
    if (haric.has(d.anahtar)) continue;
    const o = olcu(d);
    if (ortusur(x, y, boy, en, d.xMm, d.yMm, o.boy, o.en)) z = Math.max(z, d.zMm + d.yukseklikMm);
  }
  return z;
}

/**
 * Sürüklenen konumu yakın kenara yapıştırır: yüzey ve kasa kenarları, orta eksen ve komşu yükün kenarları (yerleşim
 * boşluğu bırakarak). Yapışma yoksa ızgaraya yuvarlar.
 */
export function yapistir(arac: ElleArac, x: number, y: number, boy: number, en: number, bosluk: number, haric: ReadonlySet<string>): { x: number; y: number } {
  const g = disGenislik(arac.veri);
  const xAdaylari: number[] = [];
  const yAdaylari: number[] = [Math.trunc(g / 2 - en / 2), 0, g - en];
  for (const s of yuzeyler(arac.veri)) {
    xAdaylari.push(s.xBas, s.xBas + s.uzunluk - boy);
    yAdaylari.push(s.yBas, s.yBas + s.genislik - en);
  }
  for (const d of arac.yukler) {
    if (haric.has(d.anahtar)) continue;
    const o = olcu(d);
    xAdaylari.push(d.xMm + o.boy + bosluk, d.xMm - boy - bosluk, d.xMm, d.xMm + o.boy - boy, Math.round(d.xMm + o.boy / 2 - boy / 2));
    yAdaylari.push(d.yMm + o.en + bosluk, d.yMm - en - bosluk, d.yMm, d.yMm + o.en - en, Math.round(d.yMm + o.en / 2 - en / 2));
  }
  const sec = (deger: number, adaylar: number[]): number => {
    let enIyi: number | null = null;
    for (const a of adaylar) if (Math.abs(a - deger) <= YAPISMA_MM && (enIyi === null || Math.abs(a - deger) < Math.abs(enIyi - deger))) enIyi = a;
    return enIyi ?? Math.round(deger / IZGARA_MM) * IZGARA_MM;
  };
  return { x: sec(x, xAdaylari), y: sec(y, yAdaylari) };
}

function aracGuncelle(t: ElleTaslak, kimlik: number, fn: (a: ElleArac) => ElleArac): ElleTaslak {
  return { ...t, araclar: t.araclar.map((a) => (a.kimlik === kimlik ? fn(a) : a)) };
}

/**
 * İstifi (yük ve üstündekiler) hedef araçta verilen tabana taşır; taban yük altındaki yüke ya da yüzeye oturur.
 * Hedef araç aynı da olabilir.
 */
export function tasi(t: ElleTaslak, kaynakKimlik: number, anahtar: string, x: number, y: number, hedefKimlik = kaynakKimlik): ElleTaslak {
  const kaynak = t.araclar.find((a) => a.kimlik === kaynakKimlik);
  const hedef = t.araclar.find((a) => a.kimlik === hedefKimlik);
  if (!kaynak || !hedef) return t;
  const grup = istif(kaynak, anahtar);
  if (grup.length === 0) return t;
  const kok = grup[0];
  const o = olcu(kok);
  const haric = new Set(grup.map((g) => g.anahtar));
  const z = oturmaYuksekligi(hedef, x, y, o.boy, o.en, haric);
  const [dx, dy, dz] = [x - kok.xMm, y - kok.yMm, z - kok.zMm];
  const tasinan = grup.map((g) => ({ ...g, xMm: g.xMm + dx, yMm: g.yMm + dy, zMm: g.zMm + dz }));
  if (kaynakKimlik === hedefKimlik)
    return aracGuncelle(t, kaynakKimlik, (a) => ({ ...a, yukler: a.yukler.map((d) => tasinan.find((g) => g.anahtar === d.anahtar) ?? d) }));
  return {
    ...t,
    araclar: t.araclar.map((a) =>
      a.kimlik === kaynakKimlik ? { ...a, yukler: a.yukler.filter((d) => !haric.has(d.anahtar)) }
        : a.kimlik === hedefKimlik ? { ...a, yukler: [...a.yukler, ...tasinan] } : a),
  };
}

/** Tabandaki boş yer: yüzeyler önden arkaya taranır (sol kenar, orta, sağ kenar); yoksa yüklerin arkası. */
export function bosYerBul(arac: ElleArac, boy: number, en: number, bosluk: number, haric: ReadonlySet<string> = new Set()): { x: number; y: number } {
  const ys = [...yuzeyler(arac.veri)].sort((a, b) => a.xBas - b.xBas);
  const digerleri = arac.yukler.filter((d) => !haric.has(d.anahtar));
  const bos = (x: number, y: number) => digerleri.every((d) => {
    const o = olcu(d);
    return !ortusur(x - bosluk, y - bosluk, boy + 2 * bosluk, en + 2 * bosluk, d.xMm, d.yMm, o.boy, o.en);
  });
  for (const s of ys) {
    const yAdaylari = [s.yBas, Math.trunc(s.yBas + s.genislik / 2 - en / 2), s.yBas + s.genislik - en].filter((y) => y >= s.yBas);
    for (let x = s.xBas; x + boy <= s.xBas + s.uzunluk; x += 50)
      for (const y of yAdaylari) if (bos(x, y)) return { x, y };
  }
  const g = disGenislik(arac.veri);
  const son = Math.max(ys[0]?.xBas ?? 0, ...digerleri.map((d) => d.xMm + olcu(d).boy + bosluk));
  return { x: son, y: Math.trunc(g / 2 - en / 2) };
}

/** Yükü yerinde 90° döndürür (merkez korunur); üstünde yük varsa döndürülmez. */
export function dondur(t: ElleTaslak, kimlik: number, anahtar: string): ElleTaslak | string {
  const arac = t.araclar.find((a) => a.kimlik === kimlik);
  const yuk = arac?.yukler.find((y) => y.anahtar === anahtar);
  if (!arac || !yuk) return t;
  if (ustundeYukVar(arac, anahtar)) return 'Üstünde yük olan yük döndürülemez; önce üstteki yükleri kaldırın.';
  const o = olcu(yuk);
  const x = Math.round(yuk.xMm + o.boy / 2 - o.en / 2);
  const y = Math.round(yuk.yMm + o.en / 2 - o.boy / 2);
  return aracGuncelle(t, kimlik, (a) => ({ ...a, yukler: a.yukler.map((d) => (d === yuk ? { ...d, xMm: x, yMm: y, donduruldu: !d.donduruldu } : d)) }));
}

/** Yükü bekleyenler listesine gönderir; üstünde yük varsa önce onlar kaldırılmalıdır. */
export function bekleyeneGonder(t: ElleTaslak, kimlik: number, anahtar: string): ElleTaslak | string {
  const arac = t.araclar.find((a) => a.kimlik === kimlik);
  const yuk = arac?.yukler.find((y) => y.anahtar === anahtar);
  if (!arac || !yuk) return t;
  if (ustundeYukVar(arac, anahtar)) return 'Üstünde yük olan yük bekleyenlere gönderilemez; önce üstteki yükleri kaldırın.';
  return {
    araclar: t.araclar.map((a) => (a.kimlik === kimlik ? { ...a, yukler: a.yukler.filter((d) => d !== yuk) } : a)),
    bekleyenler: [...t.bekleyenler, { ...yuk, xMm: 0, yMm: 0, zMm: 0, donduruldu: false }],
  };
}

/** Bekleyen yükü aracın ilk boş taban yerine koyar. */
export function aracaYerlestir(t: ElleTaslak, anahtar: string, kimlik: number, bosluk: number): ElleTaslak {
  const yuk = t.bekleyenler.find((y) => y.anahtar === anahtar);
  const arac = t.araclar.find((a) => a.kimlik === kimlik);
  if (!yuk || !arac) return t;
  const yer = bosYerBul(arac, yuk.boyMm, yuk.enMm, bosluk);
  const z = oturmaYuksekligi(arac, yer.x, yer.y, yuk.boyMm, yuk.enMm, new Set());
  return {
    araclar: t.araclar.map((a) => (a.kimlik === kimlik ? { ...a, yukler: [...a.yukler, { ...yuk, xMm: yer.x, yMm: yer.y, zMm: z, donduruldu: false }] } : a)),
    bekleyenler: t.bekleyenler.filter((y) => y !== yuk),
  };
}

/** İstifi başka aracın ilk boş taban yerine taşır. */
export function aracaTasi(t: ElleTaslak, kaynakKimlik: number, anahtar: string, hedefKimlik: number, bosluk: number): ElleTaslak {
  const kaynak = t.araclar.find((a) => a.kimlik === kaynakKimlik);
  const hedef = t.araclar.find((a) => a.kimlik === hedefKimlik);
  const yuk = kaynak?.yukler.find((y) => y.anahtar === anahtar);
  if (!kaynak || !hedef || !yuk || kaynakKimlik === hedefKimlik) return t;
  const o = olcu(yuk);
  const yer = bosYerBul(hedef, o.boy, o.en, bosluk);
  return tasi(t, kaynakKimlik, anahtar, yer.x, yer.y, hedefKimlik);
}

/** Aynı ekipmandan boş araç ekler (isterler 21); kimlik taslakta benzersizdir. */
export function ayniTiptenEkle(t: ElleTaslak, kimlik: number): ElleTaslak {
  const ornek = t.araclar.find((a) => a.kimlik === kimlik);
  if (!ornek) return t;
  const yeni = Math.max(0, ...t.araclar.map((a) => a.kimlik)) + 1;
  return { ...t, araclar: [...t.araclar, { ...ornek, kimlik: yeni, yukler: [] }] };
}

/** Seçilen ekipmandan boş araç ekler (aile içi ya da izinli herhangi bir tip). */
export function aracEkle(t: ElleTaslak, e: ElleEkipmanSecenegi): ElleTaslak {
  const kimlik = Math.max(0, ...t.araclar.map((a) => a.kimlik)) + 1;
  const arac: ElleArac = {
    kimlik,
    konfigurasyonId: e.konfigurasyonId,
    ekipmanKodu: e.kod,
    ekipmanAdi: e.ad,
    tipAdi: e.tipAdi,
    teknikVeriJson: e.teknikVeriJson,
    veri: teknikVeri(e.teknikVeriJson),
    yukler: [],
  };
  return { ...t, araclar: [...t.araclar, arac] };
}

/** Aracın bütün yüklerini bekleyenlere gönderir (araç boş kalır); "kalanı otomatik diz" onları yeniden yerleştirebilir. */
export function araciBosalt(t: ElleTaslak, kimlik: number): ElleTaslak {
  const arac = t.araclar.find((a) => a.kimlik === kimlik);
  if (!arac || arac.yukler.length === 0) return t;
  const geri = arac.yukler.map((y) => ({ ...y, xMm: 0, yMm: 0, zMm: 0, donduruldu: false }));
  return {
    araclar: t.araclar.map((a) => (a.kimlik === kimlik ? { ...a, yukler: [] } : a)),
    bekleyenler: [...t.bekleyenler, ...geri],
  };
}

/** Yalnız boş araç kaldırılır (yükler kaybolmasın). */
export function bosAraciKaldir(t: ElleTaslak, kimlik: number): ElleTaslak {
  return { ...t, araclar: t.araclar.filter((a) => a.kimlik !== kimlik || a.yukler.length > 0) };
}

/**
 * Hızlı yerel kontrol (sunucu yanıtını beklemeden): kasa dışına çıkan ve başka yükle hacim kesişen yükler. Ayrıntılı
 * ve bağlayıcı kontrol sunucudadır.
 */
export function yerelSorunlar(arac: ElleArac): Set<string> {
  const sorunlu = new Set<string>();
  const g = disGenislik(arac.veri);
  const u = disUzunluk(arac.veri);
  for (const y of arac.yukler) {
    const o = olcu(y);
    if ((g > 0 && (y.yMm < 0 || y.yMm + o.en > g)) || (u > 0 && (y.xMm < 0 || y.xMm + o.boy > u))) sorunlu.add(y.anahtar);
  }
  for (let i = 0; i < arac.yukler.length; i++)
    for (let j = i + 1; j < arac.yukler.length; j++) {
      const a = arac.yukler[i];
      const b = arac.yukler[j];
      if (tabanOrtusur(a, b) && a.zMm < b.zMm + b.yukseklikMm - ELLE_TOLERANS && b.zMm < a.zMm + a.yukseklikMm - ELLE_TOLERANS) {
        sorunlu.add(a.anahtar);
        sorunlu.add(b.anahtar);
      }
    }
  return sorunlu;
}
