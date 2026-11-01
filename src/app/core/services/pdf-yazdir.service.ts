import { Injectable } from '@angular/core';

/**
 * PDF'i indirmeden tarayıcının yazdırma penceresini açar: görünmez bir çerçevede yüklenir ve yazdırılır. Kullanıcı
 * pencerede yazıcıyı seçer (Chrome/Edge son seçileni hatırlar). Çerçeve bir sonraki yazdırmada ya da bir süre sonra
 * kaldırılır; yazdırma penceresi açıkken kaldırılırsa baskı iptal olur.
 */
@Injectable({ providedIn: 'root' })
export class PdfYazdirService {
  private cerceve: HTMLIFrameElement | null = null;
  private adres: string | null = null;
  private temizlik: ReturnType<typeof setTimeout> | null = null;

  /** Çerçeve yüklenip yazdırma penceresi açılınca çözülür; tarayıcı çerçevede yazdıramazsa PDF yeni sekmede açılır. */
  yazdir(pdf: Blob): Promise<void> {
    this.temizle();
    const adres = URL.createObjectURL(pdf.type ? pdf : new Blob([pdf], { type: 'application/pdf' }));
    const cerceve = document.createElement('iframe');
    // Sıfır boyutlu çerçevede bazı tarayıcılar PDF görüntüleyiciyi yüklemez; ekran dışında küçük bir alan verilir.
    cerceve.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none;';
    cerceve.setAttribute('aria-hidden', 'true');
    this.cerceve = cerceve;
    this.adres = adres;
    return new Promise(resolve => {
      cerceve.onload = () => {
        try {
          cerceve.contentWindow?.focus();
          cerceve.contentWindow?.print();
        } catch {
          window.open(adres, '_blank');
        }
        // Yazdırma penceresi kapanınca çerçeve gerekmez; bir sonraki yazdırma beklemeden temizler.
        this.temizlik = setTimeout(() => this.temizle(), 10 * 60 * 1000);
        resolve();
      };
      cerceve.src = adres;
      document.body.appendChild(cerceve);
    });
  }

  private temizle(): void {
    if (this.temizlik) clearTimeout(this.temizlik);
    this.cerceve?.remove();
    if (this.adres) URL.revokeObjectURL(this.adres);
    this.cerceve = null;
    this.adres = null;
    this.temizlik = null;
  }
}
