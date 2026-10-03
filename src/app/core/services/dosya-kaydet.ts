/**
 * Blob'u tarayıcıda dosya olarak kaydeder. Geçici bağlantı sayfaya eklenip tıklanır; nesne adresi bir
 * sonraki turda serbest bırakılır, çünkü bazı tarayıcılar hemen serbest bırakılan adresin indirmesini
 * iptal eder.
 */
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
