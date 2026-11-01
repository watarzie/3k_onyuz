/**
 * Blob'u tarayıcıda dosya olarak kaydeder. Geçici bağlantı sayfaya eklenip tıklanır; nesne adresi bir
 * sonraki turda serbest bırakılır, çünkü bazı tarayıcılar hemen serbest bırakılan adresin indirmesini
 * iptal eder.
 */
/**
 * `Content-Disposition` başlığındaki dosya adı (önce RFC 5987 `filename*`, sonra `filename`); başlık yoksa ya da ad
 * güvenli değilse (yol ayıracı, boş) verilen ad kullanılır. Sunucu Türkçe karakterli adı `filename*` ile gönderir.
 */
export function dosyaAdiBasliktan(baslik: string | null | undefined, varsayilan: string): string {
  if (!baslik) return varsayilan;
  let ad: string | undefined;
  const yildizli = /filename\*\s*=\s*(?:UTF-8|utf-8)?''([^;]+)/.exec(baslik);
  if (yildizli) {
    try {
      ad = decodeURIComponent(yildizli[1].trim().replace(/^"|"$/g, ''));
    } catch {
      ad = undefined;
    }
  }
  if (!ad) {
    const duz = /filename\s*=\s*("([^"]*)"|[^;]+)/.exec(baslik);
    ad = (duz?.[2] ?? duz?.[1])?.trim();
  }
  return ad && !/[\\/]/.test(ad) ? ad : varsayilan;
}

export function dosyayiKaydet(icerik: Blob, dosyaAdi: string): void {
  const url = URL.createObjectURL(icerik);
  const baglanti = document.createElement('a');
  baglanti.href = url;
  baglanti.download = dosyaAdi;
  baglanti.style.display = 'none';
  document.body.appendChild(baglanti);
  baglanti.click();
  baglanti.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
