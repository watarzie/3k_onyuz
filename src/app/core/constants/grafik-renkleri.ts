/**
 * Grafik ve durum renkleri ("Atölye" teması). Apex grafikleri, SVG halkalar ve PDF çıktıları CSS değişkeni
 * okuyamadığı için palet burada hex olarak tek kaynaktan tanımlanır; SCSS tarafındaki --k-* token'larıyla aynı
 * değerlerdir. Ambalaj ve finans grafikleri aynı diziyi kullanır.
 */

/** Seri paleti: çam, ahşap, çelik mavisi, sage, hardal, mürdüm, tuğla, nötr gri. */
export const GRAFIK_RENKLERI = [
  '#2d5f47',
  '#c48f55',
  '#4f6276',
  '#7fa98f',
  '#d4a24c',
  '#7c5aa6',
  '#c2402f',
  '#69736d',
] as const;

/** Anlam taşıyan renkler (ilerleme, durum, uyarı); hepsi beyaz üstünde AA. */
export const GRAFIK_SEMANTIK = {
  basari: '#1f7a44',
  uyari: '#9a6b22',
  hata: '#c2402f',
  bilgi: '#3b6d9a',
  notr: '#69736d',
} as const;

/** Durum haritalarında kullanılan marka ve yardımcı tonlar (SCSS --k-* karşılıkları). */
export const GRAFIK_TONLAR = {
  yesil: '#2d5f47',
  yesilKoyu: '#1f4535',
  ahsap: '#c48f55',
  celik: '#4f6276',
  mor: '#6d4fa3',
  turuncu: '#b4531f',
  soluk: '#9aa39d',
  murekkep: '#141c17',
  murekkep2: '#36423a',
  cizgi: '#e8e4da',
  kagit: '#f3f1ea',
  kagit2: '#ebe7dc',
} as const;

/** Apex grafiklerinin ortak görünümü: kâğıt tonlu kılavuz, sessiz etiketler, Sarabun 12px. */
export const APEX_ORTAK = {
  gridBorderColor: '#e8e4da',
  etiketRengi: '#69736d',
  fontFamily: 'Sarabun, Inter, sans-serif',
  fontSize: '12px',
  strokeDashArray: 4,
} as const;
