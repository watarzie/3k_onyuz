import {
  FinansIsKaydi,
  FinansSandikKirilimKalemi,
  FinansSandikKirilimSatiri,
} from '../../../shared/models/finans.model';

/** Kırılım tabloları ilk açılışta bu kadar satır gösterir; gerisi "Tümünü göster" ile açılır (panel detay kalıbı). */
export const KIRILIM_ILK_SATIR = 8;

/** Sandık no doğal sırası (1, 2, …, 10); sandık no'su olmayan satırlar en sonda. */
export function sandikNoKarsilastir(a: string | null | undefined, b: string | null | undefined): number {
  if (!a) return b ? 1 : 0;
  if (!b) return -1;
  return a.localeCompare(b, 'tr-TR', { numeric: true });
}

/** Uzun listelerde ilk satırlar; "Tümünü göster" açıksa liste olduğu gibi. */
export function ilkSatirlar<T>(liste: readonly T[], tumu: boolean, sinir = KIRILIM_ILK_SATIR): readonly T[] {
  return tumu || liste.length <= sinir ? liste : liste.slice(0, sinir);
}

/** Sunucudaki kırılım satırları ekranda doğal sandık sırasıyla. */
export function kirilimSandiklari(sandiklar: readonly FinansSandikKirilimSatiri[]): FinansSandikKirilimSatiri[] {
  return [...sandiklar].sort(
    (a, b) =>
      sandikNoKarsilastir(a.sandikNo, b.sandikNo) ||
      a.paraBirimi.localeCompare(b.paraBirimi) ||
      a.anahtar.localeCompare(b.anahtar),
  );
}

/** Kategori satırının (proje × kategori) sandık dökümü: kırılımdaki kayıtlar yalnız o satırın kayıtlarıyla daraltılır. */
export function kategoriKirilimKayitlari(
  sandiklar: readonly FinansSandikKirilimSatiri[],
  isKaydiIds: readonly number[],
): { sandik: FinansSandikKirilimSatiri; kayit: FinansSandikKirilimKalemi }[] {
  const ids = new Set(isKaydiIds);
  return kirilimSandiklari(sandiklar).flatMap((sandik) =>
    sandik.kayitlar.filter((kayit) => ids.has(kayit.id)).map((kayit) => ({ sandik, kayit })),
  );
}

/** Sarf kereste payı mı (sunucudaki FinansSandikKirilimiKurali.Sarf ile aynı). */
export function sarfKaydi(kayit: { isTuru?: number; kaynakBileseni?: string | null }): boolean {
  return kayit.isTuru === 9 || (kayit.kaynakBileseni ?? '').toUpperCase() === 'SARF';
}

export interface FinansParaAltToplami {
  paraBirimi: string;
  net: number;
}

/** Kayıt aramada bir sandığın sayfadaki kalemleri ve alt toplamı. */
export interface FinansAramaSandikGrubu {
  anahtar: string;
  sandikNo: string;
  sandikAdi: string;
  sandikTipi: string | null;
  kalemler: FinansIsKaydi[];
  toplamlar: FinansParaAltToplami[];
}

/** Kayıt aramada proje başlığı: altında sandık başlıkları ve alt toplamlar. */
export interface FinansAramaProjeGrubu {
  anahtar: string;
  projeNo: string;
  musteri: string;
  kalemler: FinansIsKaydi[];
  sandiklar: FinansAramaSandikGrubu[];
  toplamlar: FinansParaAltToplami[];
  ilkTarih: string;
  sonTarih: string;
  kategoriSayisi: number;
}

/** Proje kimliği varsa onunla, sisteme bağlı olmayan projede no + müşteri ile (sunucudaki proje birim anahtarı). */
export function projeAnahtari(kalem: Pick<FinansIsKaydi, 'projeId' | 'projeNo' | 'musteri'>): string {
  return kalem.projeId ? `P:${kalem.projeId}` : `M:${kalem.projeNo ?? ''}\u001f${kalem.musteri ?? ''}`;
}

/** Aynı sandığın NET ve SARF kayıtları aynı üretim kaynağından gelir; sandık no'suz kayıtlar tek grupta toplanır. */
function sandikAnahtari(kalem: FinansIsKaydi): string {
  return kalem.sandikNo ? `${kalem.sandikNo}\u001f${kalem.kaynakKayitId ?? ''}` : '';
}

function paraToplamlari(kalemler: readonly FinansIsKaydi[]): FinansParaAltToplami[] {
  const toplam = new Map<string, number>();
  for (const k of kalemler)
    if (k.netTutar != null && k.paraBirimi) toplam.set(k.paraBirimi, (toplam.get(k.paraBirimi) ?? 0) + k.netTutar);
  return [...toplam.entries()].map(([paraBirimi, net]) => ({ paraBirimi, net: Math.round(net * 100) / 100 }));
}

/**
 * Arama sonucunu proje → sandık başlıklarına ayırır. Projeler sunucunun döndürdüğü sırada; sandıklar doğal sırada,
 * aynı sandığın kalemleri NET önce, kategori sırasıyla. Tutar izni yoksa (net null) alt toplam boş kalır.
 */
export function aramaProjeGruplari(kalemler: readonly FinansIsKaydi[]): FinansAramaProjeGrubu[] {
  const projeler = new Map<string, FinansIsKaydi[]>();
  for (const kalem of kalemler) {
    const anahtar = projeAnahtari(kalem);
    projeler.set(anahtar, [...(projeler.get(anahtar) ?? []), kalem]);
  }
  const kalemSirasi = (a: FinansIsKaydi, b: FinansIsKaydi) =>
    Number(sarfKaydi(a)) - Number(sarfKaydi(b)) || (a.kategori ?? 99) - (b.kategori ?? 99) || a.id - b.id;
  return [...projeler.entries()].map(([anahtar, projeKalemleri]) => {
    const sandiklar = new Map<string, FinansIsKaydi[]>();
    for (const kalem of projeKalemleri) {
      const sandik = sandikAnahtari(kalem);
      sandiklar.set(sandik, [...(sandiklar.get(sandik) ?? []), kalem]);
    }
    const sandikGruplari = [...sandiklar.entries()]
      .map(([sandikAnahtar, sirasiz]): FinansAramaSandikGrubu => {
        const sirali = [...sirasiz].sort(kalemSirasi);
        const temsil = sirali.find((k) => !sarfKaydi(k)) ?? sirali[0];
        return {
          anahtar: `${anahtar}\u001e${sandikAnahtar}`,
          sandikNo: temsil.sandikNo ?? '',
          sandikAdi: temsil.sandikAdi ?? '',
          sandikTipi: temsil.sandikTipi ?? null,
          kalemler: sirali,
          toplamlar: paraToplamlari(sirali),
        };
      })
      .sort((a, b) => sandikNoKarsilastir(a.sandikNo, b.sandikNo) || a.anahtar.localeCompare(b.anahtar));
    const tarihler = projeKalemleri.map((k) => k.finansTarihi ?? '').filter(Boolean).sort();
    return {
      anahtar,
      projeNo: projeKalemleri[0].projeNo || '—',
      musteri: projeKalemleri[0].musteri,
      kalemler: sandikGruplari.flatMap((s) => s.kalemler),
      sandiklar: sandikGruplari,
      toplamlar: paraToplamlari(projeKalemleri),
      ilkTarih: tarihler[0] ?? '',
      sonTarih: tarihler[tarihler.length - 1] ?? '',
      kategoriSayisi: new Set(projeKalemleri.map((k) => k.kategori)).size,
    };
  });
}

/** Proje panelinin Sandıklar sekmesindeki durum süzgeci. */
export type FinansSandikDurumSuzgeci = 'hepsi' | 'fiyat' | 'siparis' | 'fatura' | 'tamam';

export const FINANS_SANDIK_DURUM_SUZGECLERI: readonly { deger: FinansSandikDurumSuzgeci; anahtar: string }[] = [
  { deger: 'hepsi', anahtar: 'DRAWER_FILTER_ALL' },
  { deger: 'fiyat', anahtar: 'DRAWER_FILTER_PRICE' },
  { deger: 'siparis', anahtar: 'DRAWER_FILTER_PO' },
  { deger: 'fatura', anahtar: 'DRAWER_FILTER_INVOICE' },
  { deger: 'tamam', anahtar: 'DRAWER_FILTER_DONE' },
];

/**
 * Sandık durumu, sandığın en geride kalan kaydıdır (FinansIsDurumu): 1–2 PO bekliyor, 3–4 fatura bekliyor,
 * 5 tamamlandı. Fiyat bekleyen sandık durumdan bağımsız, fiyatı girilmemiş kaydı olan sandıktır.
 */
export function sandikDurumSuzgeceUyar(
  sandik: { durum: number; fiyatBekleyenKayitSayisi: number },
  filtre: FinansSandikDurumSuzgeci,
): boolean {
  switch (filtre) {
    case 'fiyat': return sandik.fiyatBekleyenKayitSayisi > 0;
    case 'siparis': return sandik.durum === 1 || sandik.durum === 2;
    case 'fatura': return sandik.durum === 3 || sandik.durum === 4;
    case 'tamam': return sandik.durum === 5;
    default: return true;
  }
}

/** Arama metni (küçük harfe çevrilmiş) alanlardan birinde geçiyor mu; boş arama her şeye uyar. */
export function aramayaUyar(arama: string, alanlar: readonly (string | null | undefined)[]): boolean {
  return !arama || alanlar.some((alan) => (alan ?? '').toLocaleLowerCase('tr-TR').includes(arama));
}
