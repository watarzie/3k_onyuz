import {
  AciklikTarafi,
  DingilTuru,
  EngelTuru,
  EkipmanDogrulamaDurumu,
  EkipmanIceAktarimIslemi,
  EkipmanKaynakTuru,
  EkipmanKategorisi,
  PlanKaynakFarkTuru,
  PlanYukDurumu,
  YerlesimGirisYonu,
  YerlesimKontrolSonucu,
  YerlesimKontrolTuru,
  YuklemeYontemi,
} from '../../../shared/models/yukleme-planlama.model';
import { YuklemeOturumDurumu } from '../../../shared/models/arac-yukleme.model';

// Ekranda enum adı yazılmaz; görünen metinler burada tek yerde tutulur (sunucudaki aynası EkipmanKategoriKurali.Ad).

export const YUK_DURUMU: Record<PlanYukDurumu, { metin: string; ton: string }> = {
  [PlanYukDurumu.Bekliyor]: { metin: 'Yerleşim bekliyor', ton: 'info' },
  [PlanYukDurumu.EksikVeri]: { metin: 'Veri eksik', ton: 'warning' },
  [PlanYukDurumu.HaricTutuldu]: { metin: 'Hariç tutuldu', ton: 'muted' },
  [PlanYukDurumu.Yerlesti]: { metin: 'Yerleşti', ton: 'success' },
  [PlanYukDurumu.Yerlesemedi]: { metin: 'Yerleşemedi', ton: 'danger' },
};

export const KONTROL_SONUCU: Record<YerlesimKontrolSonucu, { metin: string; ton: string; ikon: string }> = {
  [YerlesimKontrolSonucu.Uygun]: { metin: 'Uygun', ton: 'success', ikon: 'ri-checkbox-circle-line' },
  [YerlesimKontrolSonucu.Uygunsuz]: { metin: 'Uygunsuz', ton: 'danger', ikon: 'ri-close-circle-line' },
  [YerlesimKontrolSonucu.TeyitEdilmedi]: { metin: 'Teyit edilmedi', ton: 'warning', ikon: 'ri-question-line' },
};

export const KONTROL_TURU: Record<YerlesimKontrolTuru, string> = {
  [YerlesimKontrolTuru.Agirlik]: 'Ağırlık / kapasite',
  [YerlesimKontrolTuru.KapidanGecis]: 'Kapıdan geçiş',
  [YerlesimKontrolTuru.IcYukseklik]: 'İç yükseklik',
  [YerlesimKontrolTuru.YasalYukseklik]: 'Yasal yükseklik',
  [YerlesimKontrolTuru.YasalGenislik]: 'Yasal genişlik',
  [YerlesimKontrolTuru.Tasma]: 'Kasa dışına taşma',
  [YerlesimKontrolTuru.Dingil]: 'Dingil yükü',
  [YerlesimKontrolTuru.BaglantiYuku]: 'Bağlantı (king-pin) yükü',
  [YerlesimKontrolTuru.Destek]: 'Destek',
  [YerlesimKontrolTuru.EkipmanVerisi]: 'Ekipman verisi',
  [YerlesimKontrolTuru.GuvenlikPayi]: 'Güvenlik payı',
  [YerlesimKontrolTuru.Mevzuat]: 'Mevzuat',
  [YerlesimKontrolTuru.Organizasyon]: 'Proje / lokasyon tercihi',
  [YerlesimKontrolTuru.ElleYerlesim]: 'Elle yerleşim',
  [YerlesimKontrolTuru.AgirlikDagilimi]: 'Ağırlık dağılımı',
};

export function girisYonuMetni(yon: YerlesimGirisYonu): string {
  if (yon & YerlesimGirisYonu.Ustten) return 'Üstten';
  if (yon & YerlesimGirisYonu.Arkadan) return 'Arkadan';
  if (yon & YerlesimGirisYonu.Yandan) return 'Yandan';
  return '—';
}

export const KAYNAK_FARKI: Record<PlanKaynakFarkTuru, string> = {
  [PlanKaynakFarkTuru.YeniSandik]: 'Yeni sandık',
  [PlanKaynakFarkTuru.SandikSilindi]: 'Sandık silindi',
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

/** Yükleme oturumu durumu: metin ve rozet tonu. */
export const OTURUM_DURUMU: Record<YuklemeOturumDurumu, { metin: string; ton: string }> = {
  [YuklemeOturumDurumu.Acik]: { metin: 'Yükleme sürüyor', ton: 'info' },
  [YuklemeOturumDurumu.Tamamlandi]: { metin: 'Tamamlandı', ton: 'success' },
  [YuklemeOturumDurumu.IptalEdildi]: { metin: 'İptal edildi', ton: 'muted' },
};

/** Yükleme ilerlemesi yüzdesi (0–100); yük yoksa 0. */
export function yuklemeYuzdesi(yuklenen: number, toplam: number): number {
  return toplam > 0 ? Math.min(100, Math.round((yuklenen * 100) / toplam)) : 0;
}

/**
 * 3B görünümde yükün üstüne yazılan ad (saha geri bildirimi 19.11.2026 madde 8): tek projeli planda yalnız sandık (koli)
 * numarası, çok projeli planda tam kod (ör. PA600-23-01). Kodu proje numarasıyla başlamayan yük (elle eklenen) tam
 * koduyla yazılır. Sunucudaki karşılığı `YuklemePlaniKurali.SandikEtiketi` (PDF çizimleri).
 */
export function sandikEtiketi(kod: string, projeNo: string | null | undefined, tekProje: boolean): string {
  const proje = projeNo?.trim();
  if (!tekProje || !proje) return kod;
  const onek = `${proje}-`;
  return kod.length > onek.length && kod.startsWith(onek) ? kod.slice(onek.length) : kod;
}

/** Projeleri ayıran renkler; kimlik yalnız renge bağlı değildir (kod ve proje no ayrıca yazılır). */
export const PROJE_RENKLERI = ['#0e7490', '#7c3aed', '#ea580c', '#16a34a', '#2563eb', '#be185d', '#a16207', '#0f766e', '#4f46e5', '#65a30d'];
