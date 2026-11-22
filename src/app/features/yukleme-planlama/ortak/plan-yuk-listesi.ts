import {
  PlanManuelYukKaydi,
  PlanSandikYukuKaydi,
  PlanYukDurumu,
  PlanYukIzni,
  PlanYukKaynagi,
  PlanYukSatiri,
  YukTuru,
} from '../../../shared/models/index';

// Yük listesinin istemci kuralları. Sunucudaki aynası: YukIzinKurali (varsayılan izinler, üst yük sınırı) ve
// YuklemePlaniKurali.Durum (satır durumu). Sunucu hesaplarken aynı kuralları yeniden uygular; burada yalnız ekranın
// hesaptan önce doğru görünmesi için kullanılır.

/** Üst yük sınırının ve elle girilen ağırlığın üst sınırı (YukVeriKurali.EnFazlaAgirlikKg). */
export const ENFAZLA_AGIRLIK_KG = 1_000_000;
/** Elle girilen bir kenarın üst sınırı (YukVeriKurali.EnFazlaOlcuMm). */
export const ENFAZLA_OLCU_MM = 50_000;
/** Bir hesapta en fazla yük (sandık + elle eklenen birimler; YuklemePlaniKurali.EnFazlaYuk). */
export const ENFAZLA_YUK = 2000;
/** Elle eklenen yükün sınırları (YuklemePlaniKurali.ManuelKodEnFazla, ManuelAciklamaEnFazla, ManuelAdetEnFazla). */
export const ELLE_KOD_ENFAZLA = 100;
export const ELLE_ACIKLAMA_ENFAZLA = 500;
export const ELLE_ADET_ENFAZLA = 500;

/** Toplu düzenlemede bir iznin üç durumu: aç, kapat ya da seçili yüklerdeki değeri koru. */
export type UcDurum = 'koru' | 'aktif' | 'pasif';

/** Toplu üst yük sınırı: koru, boşalt (bilinmiyor), kendi brüt ağırlığı (varsayılan) ya da sabit değer. */
export type UstYukSecimi = { tur: 'koru' } | { tur: 'bos' } | { tur: 'brut' } | { tur: 'deger'; kg: number };

export interface TopluIzinDuzenlemesi {
  dahil: UcDurum;
  dondurme: UcDurum;
  usteKonma: UcDurum;
  altaKalma: UcDurum;
  ustYuk: UstYukSecimi;
}

export const BOS_TOPLU_DUZENLEME: TopluIzinDuzenlemesi = {
  dahil: 'koru',
  dondurme: 'koru',
  usteKonma: 'koru',
  altaKalma: 'koru',
  ustYuk: { tur: 'koru' },
};

export interface YukIzinleri {
  dondurulebilirMi: boolean;
  usteKonabilirMi: boolean;
  altaKalabilirMi: boolean;
  ustYukSiniriKg: number | null;
}

/** Tek tek değiştirilebilen izin alanları. */
export type IzinAlani = 'dondurulebilirMi' | 'usteKonabilirMi' | 'altaKalabilirMi';

const ALAN_BAYRAGI: Record<IzinAlani, PlanYukIzni> = {
  dondurulebilirMi: PlanYukIzni.Dondurme,
  usteKonabilirMi: PlanYukIzni.UsteKonma,
  altaKalabilirMi: PlanYukIzni.AltaKalma,
};

/** Listedeki sayaçlar; satırlardan hesaplanır (hesaptan önce de görünür). */
export interface YukListesiSayaclari {
  toplam: number;
  dahil: number;
  hesaplanabilir: number;
  veriEksik: number;
  haricTutulan: number;
}

/**
 * Yük listesinde satırın kimliği: sandık yükünde sandık, elle eklenen yükte grup ve birim. Sunucudaki yük anahtarıyla
 * ("s:{sandıkId}", "m:{grupNo}:{birimNo}") aynıdır; yerleşim sonucu satırla bu anahtarla eşlenir.
 */
export function satirAnahtari(s: Pick<PlanYukSatiri, 'kaynak' | 'sandikId' | 'manuelGrupNo' | 'birimNo'>): string {
  return s.kaynak === PlanYukKaynagi.Sandik ? `s:${s.sandikId}` : `m:${s.manuelGrupNo}:${s.birimNo}`;
}

type SatirKimligi = Pick<PlanYukSatiri, 'kaynak' | 'sandikId' | 'manuelGrupNo'>;

/** Sistemdeki sandıktan gelen satır. */
export function sandikSatiriMi(s: SatirKimligi): boolean {
  return s.kaynak === PlanYukKaynagi.Sandik && s.sandikId != null;
}

/** Elle eklenen yükün bir birimi (grup numarasıyla). */
export function elleSatiriMi(s: SatirKimligi): boolean {
  return s.kaynak === PlanYukKaynagi.Manuel && s.manuelGrupNo != null;
}

/** Seçimleri hesap isteğiyle gönderilebilen satır: sandık yükü ya da elle eklenen yükün birimi. */
export function duzenlenebilir(s: SatirKimligi): boolean {
  return sandikSatiriMi(s) || elleSatiriMi(s);
}

/**
 * Başlangıç izinleri: sandıkta döndürme pasif, üste konma ve altta kalma aktif, üst yük sınırı kendi brüt ağırlığı.
 * Özel yükte (trafo, diğer) bütün izinler kapalı ve sınır boştur.
 */
export function varsayilanIzinler(yukTuruId: number, brutKg: number | null): YukIzinleri {
  if (yukTuruId !== YukTuru.Sandik) {
    return { dondurulebilirMi: false, usteKonabilirMi: false, altaKalabilirMi: false, ustYukSiniriKg: null };
  }
  return {
    dondurulebilirMi: false,
    usteKonabilirMi: true,
    altaKalabilirMi: true,
    ustYukSiniriKg: brutKg != null && brutKg > 0 ? brutKg : null,
  };
}

export function ustYukSiniriGecerli(kg: number | null): boolean {
  return kg == null || (Number.isFinite(kg) && kg >= 0 && kg <= ENFAZLA_AGIRLIK_KG);
}

/**
 * Yükün hesaba girip girmeyeceğini değiştirir. Hariç tutulan yük "Hariç tutuldu", verisi eksik yük "Veri eksik" olur;
 * yeniden dahil edilen yük hesaplanana kadar yerleşim bekler (önceki hesaptaki araç bilgisi artık geçerli değildir).
 */
export function dahilDegistir(s: PlanYukSatiri, dahil: boolean): PlanYukSatiri {
  if (s.dahil === dahil) return s;
  const durum = !dahil ? PlanYukDurumu.HaricTutuldu : s.veriSorunlari.length ? PlanYukDurumu.EksikVeri : PlanYukDurumu.Bekliyor;
  return { ...s, dahil, durum, aracNo: null, yerlesimNotu: null };
}

/** Tek izni değiştirir ve elle değişti olarak işaretler (hesapta korunur). */
export function izinDegistir(s: PlanYukSatiri, alan: IzinAlani, deger: boolean): PlanYukSatiri {
  return { ...s, [alan]: deger, elleDegisenIzinler: s.elleDegisenIzinler | ALAN_BAYRAGI[alan] };
}

/** Üst yük sınırını elle değiştirir; boş değer "bilinmiyor" demektir. */
export function ustYukDegistir(s: PlanYukSatiri, kg: number | null): PlanYukSatiri {
  return { ...s, ustYukSiniriKg: kg, elleDegisenIzinler: s.elleDegisenIzinler | PlanYukIzni.UstYukSiniri };
}

/** Yükün izinlerini varsayılana döndürür ve elle değişti bayraklarını temizler. */
export function varsayilanaDondur(s: PlanYukSatiri): PlanYukSatiri {
  return { ...s, ...varsayilanIzinler(s.yukTuruId, s.brutKg), elleDegisenIzinler: PlanYukIzni.Yok };
}

/**
 * Toplu izin düzenlemesi: yalnız seçili satırlara uygulanır; "koru" olan izin satırdaki değeri bırakır. Açılan/kapatılan
 * izin elle değişti olarak işaretlenir. Üst yükte "brüt" varsayılana dönüştür: değer satırın brüt ağırlığı olur ve
 * bayrak temizlenir (kaynakta brüt değişirse sınır da güncellenir).
 */
export function topluUygula(satirlar: readonly PlanYukSatiri[], secili: ReadonlySet<string>, d: TopluIzinDuzenlemesi): PlanYukSatiri[] {
  if (d.ustYuk.tur === 'deger' && !ustYukSiniriGecerli(d.ustYuk.kg)) {
    throw new Error('Üst yük sınırı sıfır veya pozitif olmalıdır.');
  }
  return satirlar.map((s) => {
    if (!duzenlenebilir(s) || !secili.has(satirAnahtari(s))) return s;
    let y = s;
    if (d.dahil !== 'koru') y = dahilDegistir(y, d.dahil === 'aktif');
    if (d.dondurme !== 'koru') y = izinDegistir(y, 'dondurulebilirMi', d.dondurme === 'aktif');
    if (d.usteKonma !== 'koru') y = izinDegistir(y, 'usteKonabilirMi', d.usteKonma === 'aktif');
    if (d.altaKalma !== 'koru') y = izinDegistir(y, 'altaKalabilirMi', d.altaKalma === 'aktif');
    switch (d.ustYuk.tur) {
      case 'bos':
        y = ustYukDegistir(y, null);
        break;
      case 'deger':
        y = ustYukDegistir(y, d.ustYuk.kg);
        break;
      case 'brut':
        // Varsayılana döner (sunucudaki YukIzinKurali.Varsayilan): özel yükte (trafo) sınır boştur, sandıkta brüt.
        y = {
          ...y,
          ustYukSiniriKg: varsayilanIzinler(y.yukTuruId, y.brutKg).ustYukSiniriKg,
          elleDegisenIzinler: y.elleDegisenIzinler & ~PlanYukIzni.UstYukSiniri,
        };
        break;
    }
    return y;
  });
}

/** Seçili satırlarda bir iznin ortak değeri: hepsi açık, hepsi kapalı ya da karışık (toplu pencerede gösterilir). */
export function ortakDeger(
  satirlar: readonly PlanYukSatiri[],
  secili: ReadonlySet<string>,
  alan: IzinAlani | 'dahil',
): 'aktif' | 'pasif' | 'karisik' | null {
  let acik = 0;
  let kapali = 0;
  for (const s of satirlar) {
    if (!secili.has(satirAnahtari(s))) continue;
    if (s[alan]) acik++;
    else kapali++;
  }
  if (acik + kapali === 0) return null;
  if (acik && kapali) return 'karisik';
  return acik ? 'aktif' : 'pasif';
}

export function sayaclariHesapla(satirlar: readonly PlanYukSatiri[]): YukListesiSayaclari {
  return {
    toplam: satirlar.length,
    dahil: satirlar.filter((s) => s.dahil).length,
    hesaplanabilir: satirlar.filter((s) => s.dahil && s.durum !== PlanYukDurumu.EksikVeri && s.durum !== PlanYukDurumu.HaricTutuldu).length,
    veriEksik: satirlar.filter((s) => s.durum === PlanYukDurumu.EksikVeri).length,
    haricTutulan: satirlar.filter((s) => s.durum === PlanYukDurumu.HaricTutuldu).length,
  };
}

/**
 * Proje seçimi değişip liste sunucudan yeniden geldiğinde kullanıcının seçimlerini korur: hâlâ listede olan sandık
 * hesaba dahil olup olmadığını ve elle değiştirdiği izinleri eski satırdan alır; ölçü, ağırlık, lokasyon ve elle
 * değişmemiş izinler yeni satırdandır. Listeye yeni giren sandık sunucunun varsayılan seçimleriyle kalır. Önizleme
 * yalnız sandık getirir: elle eklenen yükler eski listeden olduğu gibi sona eklenir (proje seçimi değişince kaybolmaz).
 */
export function secimleriKoru(yeni: readonly PlanYukSatiri[], eski: readonly PlanYukSatiri[]): PlanYukSatiri[] {
  const eskiler = new Map<number, PlanYukSatiri>();
  for (const s of eski) if (sandikSatiriMi(s)) eskiler.set(s.sandikId!, s);
  const sandiklar = yeni.filter(sandikSatiriMi).map((s) => {
    const e = eskiler.get(s.sandikId!);
    if (!e) return s;
    const elle = e.elleDegisenIzinler;
    return dahilDegistir(
      {
        ...s,
        dondurulebilirMi: elle & PlanYukIzni.Dondurme ? e.dondurulebilirMi : s.dondurulebilirMi,
        usteKonabilirMi: elle & PlanYukIzni.UsteKonma ? e.usteKonabilirMi : s.usteKonabilirMi,
        altaKalabilirMi: elle & PlanYukIzni.AltaKalma ? e.altaKalabilirMi : s.altaKalabilirMi,
        ustYukSiniriKg: elle & PlanYukIzni.UstYukSiniri ? e.ustYukSiniriKg : s.ustYukSiniriKg,
        elleDegisenIzinler: elle,
      },
      e.dahil,
    );
  });
  return [...sandiklar, ...eski.filter(elleSatiriMi)];
}

/** Hesap isteğinin sandık kısmı: listedeki bütün sandık satırlarının seçimleri. */
export function sandikYukleri(satirlar: readonly PlanYukSatiri[]): PlanSandikYukuKaydi[] {
  return satirlar.filter(sandikSatiriMi).map((s) => ({
    sandikId: s.sandikId!,
    dahil: s.dahil,
    dondurulebilirMi: s.dondurulebilirMi,
    usteKonabilirMi: s.usteKonabilirMi,
    altaKalabilirMi: s.altaKalabilirMi,
    ustYukSiniriKg: s.ustYukSiniriKg,
    elleDegisenIzinler: s.elleDegisenIzinler,
  }));
}

// ----- Elle eklenen yük (sistemde olmayan sandık ya da özel yük) -----

/** Elle yük penceresinin alanları; `grupNo` boşsa yeni yük, doluysa o grubun düzenlenmesidir. */
export interface ElleYukFormu {
  grupNo: number | null;
  kod: string;
  aciklama: string;
  boyMm: number | null;
  enMm: number | null;
  yukseklikMm: number | null;
  brutKg: number | null;
  adet: number | null;
  yukTuruId: number;
  projeId: number | null;
  lokasyonId: number | null;
  /** Pencerede alan yok; eski kayıttan gelen not düzenlemede korunur. */
  ozelTasimaNotu: string | null;
}

/** Pencerede doğrulanan alanlar. */
export type ElleYukAlani = 'kod' | 'aciklama' | 'boyMm' | 'enMm' | 'yukseklikMm' | 'brutKg' | 'adet';
export type ElleYukHatalari = Partial<Record<ElleYukAlani, string>>;

/** Satırların ortak bilgisi: formdaki değerler ve ekranda gösterilecek adlar. */
export interface ElleYukBilgisi {
  kod: string;
  aciklama: string | null;
  yukTuruId: number;
  yukTuruAdi: string;
  boyMm: number;
  enMm: number;
  yukseklikMm: number;
  brutKg: number;
  adet: number;
  projeId: number | null;
  projeNo: string | null;
  lokasyonId: number | null;
  lokasyonAdi: string | null;
  ozelTasimaNotu: string | null;
}

export function bosElleYukFormu(): ElleYukFormu {
  return {
    grupNo: null, kod: '', aciklama: '', boyMm: null, enMm: null, yukseklikMm: null, brutKg: null, adet: 1,
    yukTuruId: YukTuru.Sandik, projeId: null, lokasyonId: null, ozelTasimaNotu: null,
  };
}

function olcuHatasi(mm: number | null): string | undefined {
  if (mm === null) return 'Zorunlu.';
  if (!Number.isFinite(mm)) return 'Sayı girin.';
  if (!Number.isInteger(mm)) return 'Tam sayı (mm) girin.';
  if (mm <= 0) return 'Sıfırdan büyük olmalı.';
  if (mm > ENFAZLA_OLCU_MM) return `En fazla ${ENFAZLA_OLCU_MM.toLocaleString('tr-TR')} mm.`;
  return undefined;
}

/**
 * Elle yük penceresinin doğrulaması (sunucudaki PlanManuelYukDtoValidator'ın aynası; ekranda ölçü ve ağırlık da
 * zorunludur, çünkü hesap ağırlıksız ve ölçüsüz yükü dizemez). `digerYukSayisi`: bu grup dışında listedeki yük sayısı.
 */
export function elleYukHatalari(f: ElleYukFormu, digerYukSayisi: number): ElleYukHatalari {
  const h: ElleYukHatalari = {};
  const kod = f.kod.trim();
  if (!kod) h.kod = 'Kod / ad zorunludur.';
  else if (kod.length > ELLE_KOD_ENFAZLA) h.kod = `En fazla ${ELLE_KOD_ENFAZLA} karakter.`;
  if (f.aciklama.trim().length > ELLE_ACIKLAMA_ENFAZLA) h.aciklama = `En fazla ${ELLE_ACIKLAMA_ENFAZLA} karakter.`;
  const boy = olcuHatasi(f.boyMm);
  const en = olcuHatasi(f.enMm);
  const yukseklik = olcuHatasi(f.yukseklikMm);
  if (boy) h.boyMm = boy;
  if (en) h.enMm = en;
  if (yukseklik) h.yukseklikMm = yukseklik;
  if (f.brutKg === null) h.brutKg = 'Zorunlu.';
  else if (!Number.isFinite(f.brutKg)) h.brutKg = 'Sayı girin.';
  else if (f.brutKg <= 0) h.brutKg = 'Sıfırdan büyük olmalı.';
  else if (f.brutKg > ENFAZLA_AGIRLIK_KG) h.brutKg = `En fazla ${ENFAZLA_AGIRLIK_KG.toLocaleString('tr-TR')} kg.`;
  if (f.adet === null) h.adet = 'Zorunlu.';
  else if (!Number.isInteger(f.adet)) h.adet = 'Tam sayı girin.';
  else if (f.adet < 1) h.adet = 'En az 1.';
  else if (f.adet > ELLE_ADET_ENFAZLA) h.adet = `En fazla ${ELLE_ADET_ENFAZLA}.`;
  else if (digerYukSayisi + f.adet > ENFAZLA_YUK) {
    h.adet = `Listede en fazla ${ENFAZLA_YUK} yük olabilir; bu yük için en fazla ${Math.max(ENFAZLA_YUK - digerYukSayisi, 0)}.`;
  }
  return h;
}

/** Listedeki elle yük grubunu pencereye geri kurar (kalem ikonu); grup yoksa `null`. */
export function elleYukFormu(satirlar: readonly PlanYukSatiri[], grupNo: number): ElleYukFormu | null {
  const grup = satirlar.filter((s) => elleSatiriMi(s) && s.manuelGrupNo === grupNo);
  if (!grup.length) return null;
  const s = grup[0];
  return {
    grupNo, kod: s.kod, aciklama: s.aciklama ?? '', boyMm: s.boyMm, enMm: s.enMm, yukseklikMm: s.yukseklikMm,
    brutKg: s.brutKg, adet: grup.length, yukTuruId: s.yukTuruId, projeId: s.projeId, lokasyonId: s.lokasyonId,
    ozelTasimaNotu: s.ozelTasimaNotu,
  };
}

/**
 * Elle yükün birim satırları: adet kadar, birim numarası 1'den. Grup düzenlenirken var olan birimin seçimleri (dahil,
 * elle değişen izinler) birim numarasına göre korunur; elle değişmeyen izinler yük türü ve ağırlığa göre sandık
 * varsayılanından kurulur (`varsayilanIzinler`). Önceki hesaptaki araç bilgisi artık geçerli değildir.
 */
export function elleYukSatirlari(b: ElleYukBilgisi, grupNo: number, mevcut: readonly PlanYukSatiri[] = []): PlanYukSatiri[] {
  const varsayilan = varsayilanIzinler(b.yukTuruId, b.brutKg);
  return Array.from({ length: b.adet }, (_, i) => {
    const birimNo = i + 1;
    const eski = mevcut.find((m) => m.birimNo === birimNo);
    const elle = eski?.elleDegisenIzinler ?? PlanYukIzni.Yok;
    const dahil = eski?.dahil ?? true;
    return {
      siraNo: 0,
      kaynak: PlanYukKaynagi.Manuel,
      sandikId: null,
      manuelGrupNo: grupNo,
      birimNo,
      birimSayisi: b.adet,
      kod: b.kod,
      aciklama: b.aciklama,
      projeId: b.projeId,
      projeNo: b.projeNo,
      yukTuruId: b.yukTuruId,
      yukTuruAdi: b.yukTuruAdi,
      boyMm: b.boyMm,
      enMm: b.enMm,
      yukseklikMm: b.yukseklikMm,
      brutKg: b.brutKg,
      lokasyonId: b.lokasyonId,
      lokasyonAdi: b.lokasyonAdi,
      dahil,
      dondurulebilirMi: elle & PlanYukIzni.Dondurme ? eski!.dondurulebilirMi : varsayilan.dondurulebilirMi,
      usteKonabilirMi: elle & PlanYukIzni.UsteKonma ? eski!.usteKonabilirMi : varsayilan.usteKonabilirMi,
      altaKalabilirMi: elle & PlanYukIzni.AltaKalma ? eski!.altaKalabilirMi : varsayilan.altaKalabilirMi,
      ustYukSiniriKg: elle & PlanYukIzni.UstYukSiniri ? eski!.ustYukSiniriKg : varsayilan.ustYukSiniriKg,
      elleDegisenIzinler: elle,
      ozelTasimaNotu: b.ozelTasimaNotu,
      durum: dahil ? PlanYukDurumu.Bekliyor : PlanYukDurumu.HaricTutuldu,
      veriSorunlari: [],
      aracNo: null,
      yerlesimNotu: null,
    };
  });
}

/**
 * Elle yükü listeye yazar: `grupNo` boşsa yeni grup (en büyük grup numarasının bir fazlası) listenin sonuna eklenir,
 * doluysa o grubun satırları aynı yerde yenileriyle değişir.
 */
export function elleYukuYaz(satirlar: readonly PlanYukSatiri[], b: ElleYukBilgisi, grupNo: number | null): PlanYukSatiri[] {
  const grubunda = (s: PlanYukSatiri) => elleSatiriMi(s) && s.manuelGrupNo === grupNo;
  if (grupNo === null) {
    const sonraki = Math.max(0, ...satirlar.filter(elleSatiriMi).map((s) => s.manuelGrupNo!)) + 1;
    return [...satirlar, ...elleYukSatirlari(b, sonraki)];
  }
  const yeni = elleYukSatirlari(b, grupNo, satirlar.filter(grubunda));
  const ilk = satirlar.findIndex(grubunda);
  const kalan = satirlar.filter((s) => !grubunda(s));
  kalan.splice(ilk < 0 ? kalan.length : ilk, 0, ...yeni);
  return kalan;
}

export function elleYukuSil(satirlar: readonly PlanYukSatiri[], grupNo: number): PlanYukSatiri[] {
  return satirlar.filter((s) => !(elleSatiriMi(s) && s.manuelGrupNo === grupNo));
}

/**
 * Proje seçimden çıkınca o projeye bağlı elle yükler silinmez, "Projesiz" olur (sunucu seçili olmayan projeyi kabul
 * etmez). Dönen `grupSayisi` kullanıcıya bilgi vermek içindir.
 */
export function elleYukProjeleriniBirak(
  satirlar: readonly PlanYukSatiri[],
  projeIdleri: readonly number[],
): { satirlar: PlanYukSatiri[]; grupSayisi: number } {
  const secili = new Set(projeIdleri);
  const gruplar = new Set<number>();
  const yeni = satirlar.map((s) => {
    if (!elleSatiriMi(s) || s.projeId == null || secili.has(s.projeId)) return s;
    gruplar.add(s.manuelGrupNo!);
    return { ...s, projeId: null, projeNo: null };
  });
  return { satirlar: gruplar.size ? yeni : [...satirlar], grupSayisi: gruplar.size };
}

/**
 * Hesap isteğinin elle yük kısmı: grup başına ortak bilgi ve birim seçimleri, listedeki sırayla (sunucu grup
 * numaralarını bu sırayla 1'den verir). Elle yük yoksa boş dizi gider; sunucu boş diziyi "elle yük yok" sayar.
 */
export function manuelYukler(satirlar: readonly PlanYukSatiri[]): PlanManuelYukKaydi[] {
  const gruplar = new Map<number, PlanYukSatiri[]>();
  for (const s of satirlar) {
    if (!elleSatiriMi(s)) continue;
    const grup = gruplar.get(s.manuelGrupNo!) ?? [];
    grup.push(s);
    gruplar.set(s.manuelGrupNo!, grup);
  }
  return [...gruplar.values()].map((grup) => {
    const s = grup[0];
    return {
      kod: s.kod,
      aciklama: s.aciklama,
      yukTuruId: s.yukTuruId,
      boyMm: s.boyMm,
      enMm: s.enMm,
      yukseklikMm: s.yukseklikMm,
      brutKg: s.brutKg,
      adet: grup.length,
      projeId: s.projeId,
      lokasyonId: s.lokasyonId,
      ozelTasimaNotu: s.ozelTasimaNotu,
      birimler: [...grup]
        .sort((a, b) => a.birimNo - b.birimNo)
        .map((b, i) => ({
          birimNo: i + 1,
          dahil: b.dahil,
          dondurulebilirMi: b.dondurulebilirMi,
          usteKonabilirMi: b.usteKonabilirMi,
          altaKalabilirMi: b.altaKalabilirMi,
          ustYukSiniriKg: b.ustYukSiniriKg,
          elleDegisenIzinler: b.elleDegisenIzinler,
        })),
    };
  });
}
