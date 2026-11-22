/**
 * Ekipman Kitaplığı Kılavuzu'nun bölümleri. Çapalar (`id`) tek yerde durur: kılavuz sayfası bölümlerini bu kimliklerle
 * çizer, düzenleme formundaki yardım bağlantıları aynı kimliğe gider; biri değişince öteki kırılmaz.
 */
export interface KilavuzBolumu {
  /** Sayfadaki bölüm çapası (`/ekipman-kitapligi/kilavuz#<id>`). */
  id: string;
  /** Kitapçıktaki bölüm numarası. */
  no: number;
  baslik: string;
}

/** Kılavuz sayfasının rotası (`app.routes.ts` ile aynı). */
export const EKIPMAN_KILAVUZU_YOLU = '/ekipman-kitapligi/kilavuz';

const bolum = (no: number, id: string, baslik: string): KilavuzBolumu => ({ id, no, baslik });

export const KILAVUZ_BOLUMU = {
  amac: bolum(1, 'amac', 'Bu ekran ne işe yarar?'),
  temelKurallar: bolum(2, 'temel-kurallar', 'Temel kurallar'),
  yonler: bolum(3, 'yonler', 'Yönler ve eksenler'),
  genel: bolum(4, 'genel', 'Genel'),
  kaynak: bolum(5, 'kaynak', 'Kaynak'),
  olcuAgirlik: bolum(6, 'olcu-agirlik', 'Ölçü ve ağırlık'),
  kingPin: bolum(7, 'king-pin', 'King pin'),
  yuzeyler: bolum(8, 'yuzeyler', 'Yükleme yüzeyleri'),
  acikliklar: bolum(9, 'acikliklar', 'Açıklıklar'),
  engeller: bolum(10, 'engeller', 'Engeller'),
  dingiller: bolum(11, 'dingiller', 'Dingiller'),
  baglamaNoktalari: bolum(12, 'baglama-noktalari', 'Bağlama noktaları'),
  ornekKonteyner: bolum(13, 'ornek-konteyner', 'Örnek: 40\' standart konteyner'),
  ornekLowbed: bolum(14, 'ornek-lowbed', 'Örnek: lowbed'),
  bosBirakilirsa: bolum(15, 'bos-birakilirsa', 'Boş bırakılırsa ne olur?'),
  kontrolListesi: bolum(16, 'kontrol-listesi', 'Kaydetmeden önce kontrol listesi'),
} as const satisfies Record<string, KilavuzBolumu>;

/** Bölümler kitapçık sırasıyla (içindekiler). */
export const KILAVUZ_BOLUMLERI: readonly KilavuzBolumu[] = Object.values(KILAVUZ_BOLUMU);
