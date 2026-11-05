import {
  PlanManuelYukIstegi,
  PlanSandikYukuIstegi,
  PlanYukDurumu,
  PlanYukIzni,
  PlanYukKaynagi,
  PlanYukSatiri,
  PlanYukSayaclari,
  YukTuru,
} from '../../../shared/models/yukleme-planlama.model';

// Plan yük listesinin istemci kuralları. Sunucudaki aynası: YukIzinKurali (varsayılan izinler), YukVeriKurali (veri
// sorunları), YuklemePlaniKurali.Durum (satır durumu). Sunucu kaydederken aynı kuralları yeniden uygular; burada
// yalnız ekranın kaydetmeden önce doğru görünmesi için kullanılır.

export const ENFAZLA_OLCU_MM = 50_000;
export const ENFAZLA_AGIRLIK_KG = 1_000_000;
export const OLCU_GIRINIZ = 'Ölçü giriniz.';
export const AGIRLIK_GIRINIZ = 'Ağırlık giriniz.';
export const GECERLI_OLCU_GIRINIZ = 'Geçerli bir ölçü giriniz.';
export const GECERLI_AGIRLIK_GIRINIZ = 'Geçerli bir ağırlık giriniz.';

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

/** Tek tek değiştirilebilen izin alanları ve elle değişti bayrağı. */
export type IzinAlani = 'dondurulebilirMi' | 'usteKonabilirMi' | 'altaKalabilirMi';

const ALAN_BAYRAGI: Record<IzinAlani, PlanYukIzni> = {
  dondurulebilirMi: PlanYukIzni.Dondurme,
  usteKonabilirMi: PlanYukIzni.UsteKonma,
  altaKalabilirMi: PlanYukIzni.AltaKalma,
};

export function ozelYukMu(yukTuruId: number): boolean {
  return yukTuruId !== YukTuru.Sandik;
}

/**
 * Başlangıç izinleri: sandıkta döndürme pasif, üste konma ve altta kalma aktif, üst yük sınırı kendi brüt ağırlığı.
 * Özel yükte (trafo, diğer) bütün izinler kapalı ve sınır boştur.
 */
export function varsayilanIzinler(yukTuruId: number, brutKg: number | null): YukIzinleri {
  if (ozelYukMu(yukTuruId)) {
    return { dondurulebilirMi: false, usteKonabilirMi: false, altaKalabilirMi: false, ustYukSiniriKg: null };
  }
  return {
    dondurulebilirMi: false,
    usteKonabilirMi: true,
    altaKalabilirMi: true,
    ustYukSiniriKg: brutKg != null && brutKg > 0 ? brutKg : null,
  };
}

/** Hesaba engel veri sorunları: 0 veya boş ölçü/ağırlık eksik sayılır. */
export function veriSorunlari(boyMm: number | null, enMm: number | null, yukseklikMm: number | null, brutKg: number | null): string[] {
  const sorunlar: string[] = [];
  const olculer = [boyMm, enMm, yukseklikMm];
  if (olculer.some((o) => o == null || o === 0)) sorunlar.push(OLCU_GIRINIZ);
  else if (olculer.some((o) => o! < 0 || o! > ENFAZLA_OLCU_MM)) sorunlar.push(GECERLI_OLCU_GIRINIZ);
  if (brutKg == null || brutKg === 0) sorunlar.push(AGIRLIK_GIRINIZ);
  else if (brutKg < 0 || brutKg > ENFAZLA_AGIRLIK_KG) sorunlar.push(GECERLI_AGIRLIK_GIRINIZ);
  return sorunlar;
}

export function yukDurumu(dahil: boolean, sorunlar: readonly string[]): PlanYukDurumu {
  if (!dahil) return PlanYukDurumu.HaricTutuldu;
  return sorunlar.length ? PlanYukDurumu.EksikVeri : PlanYukDurumu.Bekliyor;
}

export function ustYukSiniriGecerli(kg: number | null): boolean {
  return kg == null || (kg >= 0 && kg <= ENFAZLA_AGIRLIK_KG);
}

/** Satırın listedeki kalıcı anahtarı: sandık kimliği ya da elle eklenen yükün grup ve birim numarası. */
export function satirAnahtari(s: Pick<PlanYukSatiri, 'kaynak' | 'sandikId' | 'manuelGrupNo' | 'birimNo'>): string {
  return s.kaynak === PlanYukKaynagi.Sandik ? `s:${s.sandikId}` : `m:${s.manuelGrupNo}:${s.birimNo}`;
}

function durumuYenile(s: PlanYukSatiri): PlanYukSatiri {
  return { ...s, durum: yukDurumu(s.dahil, s.veriSorunlari) };
}

/** Tek yükün planlamaya dahil olup olmadığını değiştirir. */
export function dahilDegistir(s: PlanYukSatiri, dahil: boolean): PlanYukSatiri {
  return durumuYenile({ ...s, dahil });
}

/** Tek izni değiştirir ve elle değişti olarak işaretler (kaynaktan güncellemede korunur). */
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
 * Toplu izin düzenlemesi (kabul senaryosu 3): yalnız seçili satırlara uygulanır; "koru" olan izin satırdaki değeri
 * bırakır. Açılan/kapatılan izin elle değişti olarak işaretlenir. Üst yükte "brüt" varsayılana dönüştür: değer
 * satırın brüt ağırlığı olur ve bayrak temizlenir (kaynakta brüt değişirse sınır da güncellenir).
 */
export function topluUygula(satirlar: readonly PlanYukSatiri[], secili: ReadonlySet<string>, d: TopluIzinDuzenlemesi): PlanYukSatiri[] {
  if (d.ustYuk.tur === 'deger' && !ustYukSiniriGecerli(d.ustYuk.kg)) {
    throw new Error('Üst yük sınırı sıfır veya pozitif olmalıdır.');
  }
  return satirlar.map((s) => {
    if (!secili.has(satirAnahtari(s))) return s;
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
        y = {
          ...y,
          ustYukSiniriKg: y.brutKg != null && y.brutKg > 0 ? y.brutKg : null,
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

export function sayaclariHesapla(satirlar: readonly PlanYukSatiri[], sevkEdilmisSandik: number): PlanYukSayaclari {
  return {
    toplam: satirlar.length,
    secilen: satirlar.filter((s) => s.dahil).length,
    hesaplanabilir: satirlar.filter((s) => s.durum === PlanYukDurumu.Bekliyor).length,
    veriEksik: satirlar.filter((s) => s.durum === PlanYukDurumu.EksikVeri).length,
    haricTutulan: satirlar.filter((s) => s.durum === PlanYukDurumu.HaricTutuldu).length,
    sevkEdilmisSandik,
  };
}

/** Elle eklenen yükün ortak bilgileri (birimler adet kadar çoğaltılır). */
export interface ManuelYukBilgisi {
  kod: string;
  aciklama: string | null;
  yukTuruId: number;
  yukTuruAdi: string;
  boyMm: number | null;
  enMm: number | null;
  yukseklikMm: number | null;
  brutKg: number | null;
  adet: number;
  projeId: number | null;
  projeNo: string | null;
  lokasyonId: number | null;
  lokasyonAdi: string | null;
  ozelTasimaNotu: string | null;
}

/**
 * Elle eklenen yükün birim satırları. Grup düzenlenirken var olan birimlerin seçimleri (dahil, elle değişen izinler)
 * birim numarasına göre korunur; elle değişmeyen izinler yeni bilgilerle varsayılana göre kurulur.
 */
export function manuelYukSatirlari(bilgi: ManuelYukBilgisi, grupNo: number, mevcut: readonly PlanYukSatiri[] = []): PlanYukSatiri[] {
  const sorunlar = veriSorunlari(bilgi.boyMm, bilgi.enMm, bilgi.yukseklikMm, bilgi.brutKg);
  const varsayilan = varsayilanIzinler(bilgi.yukTuruId, bilgi.brutKg);
  const satirlar: PlanYukSatiri[] = [];
  for (let birimNo = 1; birimNo <= bilgi.adet; birimNo++) {
    const eski = mevcut.find((m) => m.birimNo === birimNo);
    const elle = eski?.elleDegisenIzinler ?? PlanYukIzni.Yok;
    const dahil = eski?.dahil ?? true;
    satirlar.push({
      siraNo: 0,
      kaynak: PlanYukKaynagi.Manuel,
      sandikId: null,
      manuelGrupNo: grupNo,
      birimNo,
      birimSayisi: bilgi.adet,
      kod: bilgi.kod,
      aciklama: bilgi.aciklama,
      projeId: bilgi.projeId,
      projeNo: bilgi.projeNo,
      yukTuruId: bilgi.yukTuruId,
      yukTuruAdi: bilgi.yukTuruAdi,
      boyMm: bilgi.boyMm,
      enMm: bilgi.enMm,
      yukseklikMm: bilgi.yukseklikMm,
      brutKg: bilgi.brutKg,
      lokasyonId: bilgi.lokasyonId,
      lokasyonAdi: bilgi.lokasyonAdi,
      dahil,
      dondurulebilirMi: elle & PlanYukIzni.Dondurme ? eski!.dondurulebilirMi : varsayilan.dondurulebilirMi,
      usteKonabilirMi: elle & PlanYukIzni.UsteKonma ? eski!.usteKonabilirMi : varsayilan.usteKonabilirMi,
      altaKalabilirMi: elle & PlanYukIzni.AltaKalma ? eski!.altaKalabilirMi : varsayilan.altaKalabilirMi,
      ustYukSiniriKg: elle & PlanYukIzni.UstYukSiniri ? eski!.ustYukSiniriKg : varsayilan.ustYukSiniriKg,
      elleDegisenIzinler: elle,
      ozelTasimaNotu: bilgi.ozelTasimaNotu,
      durum: yukDurumu(dahil, sorunlar),
      veriSorunlari: sorunlar,
    });
  }
  return satirlar;
}

/** Kayıt isteğinin yük kısmı: sandık seçimleri ve elle eklenen yükler (grup başına ortak bilgi + birim seçimleri). */
export function yukIstekleri(satirlar: readonly PlanYukSatiri[]): { sandikYukleri: PlanSandikYukuIstegi[]; manuelYukler: PlanManuelYukIstegi[] } {
  const sandikYukleri: PlanSandikYukuIstegi[] = [];
  const gruplar = new Map<number, PlanYukSatiri[]>();
  for (const s of satirlar) {
    if (s.kaynak === PlanYukKaynagi.Sandik && s.sandikId != null) {
      sandikYukleri.push({
        sandikId: s.sandikId,
        dahil: s.dahil,
        dondurulebilirMi: s.dondurulebilirMi,
        usteKonabilirMi: s.usteKonabilirMi,
        altaKalabilirMi: s.altaKalabilirMi,
        ustYukSiniriKg: s.ustYukSiniriKg,
        elleDegisenIzinler: s.elleDegisenIzinler,
      });
    } else if (s.kaynak === PlanYukKaynagi.Manuel && s.manuelGrupNo != null) {
      const grup = gruplar.get(s.manuelGrupNo) ?? [];
      grup.push(s);
      gruplar.set(s.manuelGrupNo, grup);
    }
  }
  const manuelYukler = [...gruplar.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, birimler]) => {
      const ilk = birimler[0];
      return {
        kod: ilk.kod,
        aciklama: ilk.aciklama,
        yukTuruId: ilk.yukTuruId,
        boyMm: ilk.boyMm,
        enMm: ilk.enMm,
        yukseklikMm: ilk.yukseklikMm,
        brutKg: ilk.brutKg,
        adet: birimler.length,
        projeId: ilk.projeId,
        lokasyonId: ilk.lokasyonId,
        ozelTasimaNotu: ilk.ozelTasimaNotu,
        birimler: [...birimler]
          .sort((a, b) => a.birimNo - b.birimNo)
          .map((b) => ({
            birimNo: b.birimNo,
            dahil: b.dahil,
            dondurulebilirMi: b.dondurulebilirMi,
            usteKonabilirMi: b.usteKonabilirMi,
            altaKalabilirMi: b.altaKalabilirMi,
            ustYukSiniriKg: b.ustYukSiniriKg,
            elleDegisenIzinler: b.elleDegisenIzinler,
          })),
      };
    });
  return { sandikYukleri, manuelYukler };
}

/** Yeni elle eklenen yük grubunun numarası (var olanların en büyüğünden bir fazla). */
export function sonrakiGrupNo(satirlar: readonly PlanYukSatiri[]): number {
  return satirlar.reduce((enBuyuk, s) => Math.max(enBuyuk, s.manuelGrupNo ?? 0), 0) + 1;
}
