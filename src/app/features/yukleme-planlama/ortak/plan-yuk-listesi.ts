import {
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

/** Üst yük sınırının üst sınırı (YukVeriKurali.EnFazlaAgirlikKg). */
export const ENFAZLA_AGIRLIK_KG = 1_000_000;

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

/** Seçimleri hesap isteğiyle gönderilebilen satır: sandık yükü (eski kayıtlardaki elle eklenmiş yük düzenlenmez). */
export function duzenlenebilir(s: Pick<PlanYukSatiri, 'kaynak' | 'sandikId'>): boolean {
  return s.kaynak === PlanYukKaynagi.Sandik && s.sandikId != null;
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
 * değişmemiş izinler yeni satırdandır. Listeye yeni giren sandık sunucunun varsayılan seçimleriyle kalır.
 */
export function secimleriKoru(yeni: readonly PlanYukSatiri[], eski: readonly PlanYukSatiri[]): PlanYukSatiri[] {
  const eskiler = new Map<number, PlanYukSatiri>();
  for (const s of eski) if (duzenlenebilir(s)) eskiler.set(s.sandikId!, s);
  return yeni.map((s) => {
    const e = duzenlenebilir(s) ? eskiler.get(s.sandikId!) : undefined;
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
}

/** Hesap isteğinin yük kısmı: listedeki bütün sandık satırlarının seçimleri. */
export function sandikYukleri(satirlar: readonly PlanYukSatiri[]): PlanSandikYukuKaydi[] {
  return satirlar.filter(duzenlenebilir).map((s) => ({
    sandikId: s.sandikId!,
    dahil: s.dahil,
    dondurulebilirMi: s.dondurulebilirMi,
    usteKonabilirMi: s.usteKonabilirMi,
    altaKalabilirMi: s.altaKalabilirMi,
    ustYukSiniriKg: s.ustYukSiniriKg,
    elleDegisenIzinler: s.elleDegisenIzinler,
  }));
}
