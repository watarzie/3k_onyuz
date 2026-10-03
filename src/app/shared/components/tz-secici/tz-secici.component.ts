import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  NgZone,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

/** Seçicide bir seçenek: değer, görünen ad ve isteğe bağlı sayaç (ör. sandıktaki ürün sayısı). */
export interface TzSecenek {
  deger: string;
  etiket: string;
  sayi?: number;
}

/**
 * Trezo temasında açılır seçici (yerel select yerine). Tetikleyici etiket + seçili değer gösterir;
 * panel animasyonla açılır, seçenekler sayaçla listelenir, çok seçenekte arama çıkar. Klavye: ↑/↓, Home/End,
 * Enter seçer, Esc kapatır. Panel `position: fixed` ile yerleşir; kart/tablo taşması paneli kesmez.
 * Boş değer ("") "tümü" seçeneğidir.
 */
@Component({
  selector: 'app-tz-secici',
  standalone: true,
  templateUrl: './tz-secici.component.html',
  styleUrl: './tz-secici.component.scss',
})
export class TzSeciciComponent {
  readonly secenekler = input.required<TzSecenek[]>();
  readonly deger = input('');
  readonly etiket = input('Seçim');
  readonly tumuEtiketi = input('Tümü');
  readonly tumuSayi = input<number | null>(null);
  readonly ikon = input('ri-filter-3-line');
  readonly sayiBirimi = input('');
  readonly aramaEsigi = input(8);
  readonly degisti = output<string>();

  readonly acik = signal(false);
  readonly arama = signal('');
  readonly aktifIndex = signal(0);
  readonly konum = signal<{ top: number; left: number; width: number } | null>(null);

  private readonly tetik = viewChild.required<ElementRef<HTMLButtonElement>>('tetik');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly seciliEtiket = computed(() => {
    const d = this.deger();
    return d ? (this.secenekler().find(s => s.deger === d)?.etiket ?? d) : this.tumuEtiketi();
  });

  /** "Tümü" en başta; arama metni etikette geçen seçenekleri bırakır. */
  readonly gorunenler = computed<TzSecenek[]>(() => {
    const aranan = this.arama().trim().toLocaleLowerCase('tr');
    const liste = this.secenekler().filter(s => !aranan || s.etiket.toLocaleLowerCase('tr').includes(aranan));
    const tumu: TzSecenek = { deger: '', etiket: this.tumuEtiketi(), sayi: this.tumuSayi() ?? undefined };
    return aranan ? liste : [tumu, ...liste];
  });

  readonly aramaVar = computed(() => this.secenekler().length > this.aramaEsigi());

  constructor() {
    // Sayfa veya kapsayıcı kayınca sabit konumlu panel tetikleyiciden ayrılır; panel içi kaydırma hariç kapanır.
    const kaydirildi = (olay: Event) => {
      if (!this.acik()) return;
      const panel = this.host.nativeElement.querySelector('.tz-secici__panel');
      if (panel && panel.contains(olay.target as Node)) return;
      this.acik.set(false);
    };
    inject(NgZone).runOutsideAngular(() => document.addEventListener('scroll', kaydirildi, { capture: true, passive: true }));
    inject(DestroyRef).onDestroy(() => document.removeEventListener('scroll', kaydirildi, true));
  }

  degistir(): void {
    if (this.acik()) {
      this.kapat();
      return;
    }
    const kutu = this.tetik().nativeElement.getBoundingClientRect();
    const genislik = Math.min(Math.max(kutu.width, 270), window.innerWidth - 16);
    this.konum.set({
      top: kutu.bottom + 6,
      left: Math.min(Math.max(8, kutu.right - genislik), window.innerWidth - genislik - 8),
      width: genislik,
    });
    this.arama.set('');
    const secili = this.gorunenler().findIndex(s => s.deger === this.deger());
    this.aktifIndex.set(Math.max(secili, 0));
    this.acik.set(true);
  }

  sec(secenek: TzSecenek): void {
    if (secenek.deger !== this.deger()) this.degisti.emit(secenek.deger);
    this.kapat();
    this.tetik().nativeElement.focus();
  }

  temizle(olay: MouseEvent): void {
    olay.stopPropagation();
    if (this.deger()) this.degisti.emit('');
  }

  aramaDegisti(metin: string): void {
    this.arama.set(metin);
    this.aktifIndex.set(0);
  }

  tusBasildi(olay: KeyboardEvent): void {
    const liste = this.gorunenler();
    if (!this.acik()) {
      if (olay.key === 'ArrowDown' || olay.key === 'Enter' || olay.key === ' ') {
        olay.preventDefault();
        this.degistir();
      }
      return;
    }
    switch (olay.key) {
      case 'ArrowDown':
        olay.preventDefault();
        this.aktifIndex.set(Math.min(this.aktifIndex() + 1, liste.length - 1));
        break;
      case 'ArrowUp':
        olay.preventDefault();
        this.aktifIndex.set(Math.max(this.aktifIndex() - 1, 0));
        break;
      case 'Home':
        olay.preventDefault();
        this.aktifIndex.set(0);
        break;
      case 'End':
        olay.preventDefault();
        this.aktifIndex.set(liste.length - 1);
        break;
      case 'Enter': {
        olay.preventDefault();
        const secenek = liste[this.aktifIndex()];
        if (secenek) this.sec(secenek);
        break;
      }
      case 'Escape':
        olay.preventDefault();
        this.kapat();
        this.tetik().nativeElement.focus();
        break;
      case 'Tab':
        this.kapat();
        break;
    }
  }

  @HostListener('document:click', ['$event'])
  disariTiklandi(olay: MouseEvent): void {
    if (this.acik() && !this.host.nativeElement.contains(olay.target as Node)) this.kapat();
  }

  @HostListener('window:resize')
  pencereDegisti(): void {
    if (this.acik()) this.kapat();
  }

  private kapat(): void {
    this.acik.set(false);
  }
}
