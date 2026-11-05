import {
  AciklikTarafi,
  DingilTuru,
  EngelTuru,
  EkipmanDogrulamaDurumu,
  EkipmanIceAktarimIslemi,
  EkipmanKaynakTuru,
  EkipmanKategorisi,
  MevzuatKaynakTuru,
  MevzuatKuralSetiDurumu,
  PlanKaynakFarkTuru,
  PlanYukDurumu,
  YuklemeCalismaBicimi,
  YuklemeProjeKarisimi,
  YuklemeYontemi,
} from '../../../shared/models/yukleme-planlama.model';

// Ekranda enum adı yazılmaz; görünen metinler burada tek yerde tutulur (sunucudaki aynası EkipmanKategoriKurali.Ad).

export const CALISMA_BICIMI: Record<YuklemeCalismaBicimi, string> = {
  [YuklemeCalismaBicimi.IhtiyacaGoreArac]: 'İhtiyaca göre araç',
  [YuklemeCalismaBicimi.MevcutAraclaraYerlestirme]: 'Mevcut araçlara yerleştirme',
};

export const PROJE_KARISIMI: Record<YuklemeProjeKarisimi, string> = {
  [YuklemeProjeKarisimi.Karisik]: 'Projeler karışık yüklenebilir',
  [YuklemeProjeKarisimi.ProjeBazindaAyri]: 'Her proje ayrı araçta',
};

export const YUK_DURUMU: Record<PlanYukDurumu, { metin: string; ton: string }> = {
  [PlanYukDurumu.Bekliyor]: { metin: 'Yerleşim bekliyor', ton: 'info' },
  [PlanYukDurumu.EksikVeri]: { metin: 'Veri eksik', ton: 'warning' },
  [PlanYukDurumu.HaricTutuldu]: { metin: 'Hariç tutuldu', ton: 'muted' },
};

export const KAYNAK_FARKI: Record<PlanKaynakFarkTuru, string> = {
  [PlanKaynakFarkTuru.YeniSandik]: 'Yeni sandık',
  [PlanKaynakFarkTuru.SandikSilindi]: 'Sandık silindi',
  [PlanKaynakFarkTuru.SandikSevkEdildi]: 'Sandık sevk edildi',
  [PlanKaynakFarkTuru.OlcuDegisti]: 'Ölçü değişti',
  [PlanKaynakFarkTuru.AgirlikDegisti]: 'Ağırlık değişti',
  [PlanKaynakFarkTuru.LokasyonDegisti]: 'Lokasyon değişti',
  [PlanKaynakFarkTuru.YukTuruDegisti]: 'Yük türü değişti',
  [PlanKaynakFarkTuru.KodDegisti]: 'Sandık kodu değişti',
  [PlanKaynakFarkTuru.ProjedenCikti]: 'Projeden çıktı',
};

export const EKIPMAN_KATEGORISI: Record<EkipmanKategorisi, string> = {
  [EkipmanKategorisi.KapaliKonteyner]: 'Kapalı konteyner',
  [EkipmanKategorisi.HardtopKonteyner]: 'Hardtop konteyner',
  [EkipmanKategorisi.OpenTopKonteyner]: 'Open Top konteyner',
  [EkipmanKategorisi.FlatRack]: 'Flat Rack',
  [EkipmanKategorisi.PlatformKonteyner]: 'Platform konteyner',
  [EkipmanKategorisi.AcikKasa]: 'Açık kasa',
  [EkipmanKategorisi.Platform]: 'Platform',
  [EkipmanKategorisi.UzamaliPlatform]: 'Uzamalı platform',
  [EkipmanKategorisi.Tenteli]: 'Tenteli',
  [EkipmanKategorisi.KapaliKasa]: 'Kapalı kasa',
  [EkipmanKategorisi.Frigo]: 'Frigo',
  [EkipmanKategorisi.Lowbed]: 'Lowbed / low-loader',
  [EkipmanKategorisi.AgirYukDorsesi]: 'Ağır yük dorsesi',
  [EkipmanKategorisi.ModulerAgirYuk]: 'Modüler ağır yük',
  [EkipmanKategorisi.KonteynerSasisi]: 'Konteyner şasisi',
  [EkipmanKategorisi.Damper]: 'Damper',
  [EkipmanKategorisi.HareketliTaban]: 'Hareketli taban',
  [EkipmanKategorisi.Silobas]: 'Silobas',
  [EkipmanKategorisi.Tanker]: 'Tanker',
  [EkipmanKategorisi.Diger]: 'Diğer',
};

export function yuklemeYontemiMetni(yontem: YuklemeYontemi): string {
  const parcalar: string[] = [];
  if (yontem & YuklemeYontemi.Arkadan) parcalar.push('arkadan');
  if (yontem & YuklemeYontemi.Yandan) parcalar.push('yandan');
  if (yontem & YuklemeYontemi.Ustten) parcalar.push('üstten');
  if (!parcalar.length) return 'Tanımsız';
  const metin = parcalar.join(', ');
  return metin.charAt(0).toLocaleUpperCase('tr-TR') + metin.slice(1);
}

export const EKIPMAN_KAYNAK_TURU: Record<EkipmanKaynakTuru, string> = {
  [EkipmanKaynakTuru.IsoAsgari]: 'ISO asgari ölçü',
  [EkipmanKaynakTuru.TasiyiciFoyu]: 'Taşıyıcı föyü',
  [EkipmanKaynakTuru.UreticiFoyu]: 'Üretici föyü',
  [EkipmanKaynakTuru.SahadaOlculdu]: 'Sahada ölçüldü',
  [EkipmanKaynakTuru.Diger]: 'Diğer',
};

export const DOGRULAMA_DURUMU: Record<EkipmanDogrulamaDurumu, string> = {
  [EkipmanDogrulamaDurumu.Dogrulanmadi]: 'Doğrulanmadı',
  [EkipmanDogrulamaDurumu.Dogrulandi]: 'Doğrulandı',
};

export const ICE_AKTARIM_ISLEMI: Record<EkipmanIceAktarimIslemi, string> = {
  [EkipmanIceAktarimIslemi.Yeni]: 'Yeni',
  [EkipmanIceAktarimIslemi.YeniRevizyon]: 'Yeni revizyon',
  [EkipmanIceAktarimIslemi.Degismedi]: 'Değişmedi',
};

export const MEVZUAT_KAYNAK_TURU: Record<MevzuatKaynakTuru, string> = {
  [MevzuatKaynakTuru.Kanun]: 'Kanun',
  [MevzuatKaynakTuru.Yonetmelik]: 'Yönetmelik',
  [MevzuatKaynakTuru.YonetmelikTaslagi]: 'Yönetmelik taslağı',
  [MevzuatKaynakTuru.Genelge]: 'Genelge',
  [MevzuatKaynakTuru.Standart]: 'Standart',
  [MevzuatKaynakTuru.IcKural]: 'İç kural',
};

export const KURAL_SETI_DURUMU: Record<MevzuatKuralSetiDurumu, string> = {
  [MevzuatKuralSetiDurumu.Taslak]: 'Taslak',
  [MevzuatKuralSetiDurumu.Onayli]: 'Onaylı',
  [MevzuatKuralSetiDurumu.Kaldirildi]: 'Kaldırıldı',
};

/** Mevzuat kural tipleri (sunucu: MevzuatKuralTipi). */
export const MEVZUAT_KURAL_TIPI: Partial<Record<number, string>> = {
  1: 'Azami genişlik',
  2: 'Azami yükseklik',
  3: 'Azami uzunluk',
  4: 'Taşma sınırı',
  5: 'Tek dingil sınırı',
  6: 'Dingil grubu sınırı',
  7: 'Katar toplam ağırlığı',
  8: 'Ölçüm toleransı',
  9: 'Özel yük izin kategorisi',
  10: 'Destek aracı',
  11: 'Zabıta desteği',
  12: 'Özel yük yeterlilik belgesi',
  13: 'Gece yasağı',
  14: 'Otoyol kısıtı',
  15: 'İşaretleme',
};

export const ACIKLIK_TARAFI: Record<AciklikTarafi, string> = { arka: 'Arka', on: 'Ön', sol: 'Sol', sag: 'Sağ', ust: 'Üst' };

export const DINGIL_TURU: Record<DingilTuru, string> = { tahriksiz: 'Tahriksiz', tahrikli: 'Tahrikli', pandul: 'Pandül' };

export const ENGEL_TURU: Record<EngelTuru, string> = {
  dikme: 'Dikme',
  travers: 'Travers',
  tekerHavuzu: 'Teker havuzu',
  ucDuvar: 'Uç duvar',
  kapak: 'Kapak',
  diger: 'Diğer',
};

/** mm değerini binlik ayraçla yazar; boşsa tire. */
export function mm(deger: number | null | undefined): string {
  return deger == null ? '—' : deger.toLocaleString('tr-TR');
}
