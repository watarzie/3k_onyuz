import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  NgZone,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { DurumSecenegi } from '../ortak/grid-durumlari';

/**
 * Grid ürün satırındaki durum hücresinden (Kalite, Süreç) seçim. Değer atanmışsa rozet (aynı renk ve biçim) açılır
 * menünün tetikleyicisidir; atanmamışsa kesikli "Seç" düğmesi gösterilir. Seçim yalnız `secildi` olarak
 * bildirilir: kayıt, yetki ve kilit kararları satırın sahibindedir ve toplu atamayla aynı sunucu ucuna gider.
 * Menü paneli `position: fixed` ile yerleşir; tablo kaydırma alanı paneli kesmez. Dışarı tıklama, Esc,
 * kaydırma veya pencere boyutu değişimi menüyü kapatır.
 */
@Component({
  selector: 'app-grid-durum-secici',
  standalone: true,
  templateUrl: './grid-durum-secici.component.html',
  styleUrl: './grid-durum-secici.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GridDurumSeciciComponent {
  readonly secenekler = input.required<readonly DurumSecenegi[]>();
  /** Menü başlığı ve tetikleyici ipucundaki alan adı (ör. "Süreç Durumu"). */
  readonly baslik = input.required<string>();
  /** Satırda görünen değer; atanmamışsa boş. */
  readonly metin = input<string | null | undefined>(null);
  /** Rozet rengi; satırın sahibi tablodaki rozetle aynı kuralla verir. */
  readonly renk = input('#94a3b8');
  /** Satırın kayıtlı değeri; menüde işaretlenir ve yeniden seçilemez. */
  readonly seciliId = input<number | null | undefined>(null);
  readonly kaydediliyor = input(false);
  readonly secildi = output<number>();

  readonly acik = signal(false);
  readonly konum = signal<{ top: number; left: number } | null>(null);

  private readonly tetik = viewChild.required<ElementRef<HTMLButtonElement>>('tetik');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private static readonly PANEL_GENISLIGI = 210;
  private static readonly OGE_YUKSEKLIGI = 36;

  constructor() {
    // Sayfa veya tablo kaydırılınca sabit konumlu panel tetikleyiciden ayrılır; panel içi kaydırma hariç kapanır.
    // Dinleyici zone dışındadır: tablodaki her satırın seçicisi her kaydırmada sayfa denetimi başlatmaz.
    const kaydirildi = (olay: Event) => {
      if (!this.acik()) return;
      const panel = this.host.nativeElement.querySelector('.durum-panel');
      if (panel && panel.contains(olay.target as Node)) return;
      this.acik.set(false);
    };
    inject(NgZone).runOutsideAngular(() =>
      document.addEventListener('scroll', kaydirildi, { capture: true, passive: true }),
    );
    inject(DestroyRef).onDestroy(() => document.removeEventListener('scroll', kaydirildi, true));
  }

  degistir(olay: MouseEvent): void {
    // Satır tıklaması Grid düzenleme panelini açar; seçici tıklaması satıra ulaşmaz.
    olay.stopPropagation();
    if (this.kaydediliyor()) return;
    if (this.acik()) {
      this.acik.set(false);
      return;
    }
    const kutu = this.tetik().nativeElement.getBoundingClientRect();
    const yukseklik = Math.min(
      this.secenekler().length * GridDurumSeciciComponent.OGE_YUKSEKLIGI + 40,
      window.innerHeight - 16,
    );
    const genislik = GridDurumSeciciComponent.PANEL_GENISLIGI;
    const left = Math.min(Math.max(8, kutu.left), window.innerWidth - genislik - 8);
    const asagi = kutu.bottom + 4 + yukseklik <= window.innerHeight - 8;
    const top = asagi ? kutu.bottom + 4 : Math.max(8, kutu.top - yukseklik - 4);
    this.konum.set({ top, left });
    this.acik.set(true);
  }

  sec(secenek: DurumSecenegi, olay: MouseEvent): void {
    olay.stopPropagation();
    this.acik.set(false);
    if (secenek.id === this.seciliId()) return;
    this.secildi.emit(secenek.id);
  }

  @HostListener('document:click', ['$event'])
  disariTiklandi(olay: MouseEvent): void {
    if (this.acik() && !this.host.nativeElement.contains(olay.target as Node)) this.acik.set(false);
  }

  @HostListener('document:keydown.escape')
  escBasildi(): void {
    if (!this.acik()) return;
    this.acik.set(false);
    this.tetik().nativeElement.focus();
  }

  @HostListener('window:resize')
  konumBozuldu(): void {
    if (this.acik()) this.acik.set(false);
  }
}
