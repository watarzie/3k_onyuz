import { AmbalajIcSandikSablonDto, SandikTipi } from '../../../shared/models';

/** Yalnız iç sandıkta (tür 3) seçilebilen sandık tipi; sunucu diğer türlerde reddeder. */
export const IC_SANDIK_KATLANIR: SandikTipi = 'İç Sandık Katlanır';

/** Sandık tipi seçenekleri: iç sandıkta "İç Sandık Katlanır" eklenir, diğer türlerde listede çıkmaz. */
export function turunSandikTipleri(temel: readonly SandikTipi[], tur: number): SandikTipi[] {
  const liste = temel.filter((tip) => tip !== IC_SANDIK_KATLANIR);
  return tur === 3 ? [...liste, IC_SANDIK_KATLANIR] : liste;
}

/**
 * İç sandık tipi formunun sandık tipi seçenekleri. Kullanımdaki tipin sandık tipi "İç Sandık Katlanır"a çevrilemez
 * ve ondan değiştirilemez (sunucu 409 döner); bu geçiş burada önden gizlenir, kural sunucudadır.
 */
export function icSandikTipiFormSecenekleri(
  temel: readonly SandikTipi[],
  duzenlenen?: Pick<AmbalajIcSandikSablonDto, 'sandikTipi' | 'kullanimSayisi'> | null,
): SandikTipi[] {
  if (!duzenlenen || duzenlenen.kullanimSayisi === 0) return turunSandikTipleri(temel, 3);
  return duzenlenen.sandikTipi === IC_SANDIK_KATLANIR
    ? [IC_SANDIK_KATLANIR]
    : turunSandikTipleri(temel, 0);
}

/** Yalnız aktif iç sandık tipleri (yeni kayıtta kullanılabilenler). */
export function aktifIcSandikTipleri(
  tipler: readonly AmbalajIcSandikSablonDto[],
): AmbalajIcSandikSablonDto[] {
  return tipler.filter((tip) => tip.aktif);
}

/**
 * Seçim listesi: aktif tipler; düzenlenen kaydın zaten bağlı olduğu tip pasifse seçili kalsın diye o da listede
 * tutulur. Pasif tipe yeni atama sunucuda reddedilir; burada gizlemek yalnız kullanıcı deneyimidir.
 */
export function secilebilirIcSandikTipleri(
  tipler: readonly AmbalajIcSandikSablonDto[],
  bagliTipId?: number | null,
): AmbalajIcSandikSablonDto[] {
  return tipler.filter((tip) => tip.aktif || (bagliTipId != null && tip.id === bagliTipId));
}
