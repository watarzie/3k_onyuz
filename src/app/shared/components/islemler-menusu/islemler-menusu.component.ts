import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  ViewEncapsulation,
  afterEveryRender,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';

/**
 * Satır işlemlerini tek "İşlemler" düğmesinde toplayan açılır menü (G5). İşlemler içerik olarak verilir ve
 * her biri kendi izin kontrolünü (`*appCanWrite`, `@if (...)`) korur. Menü paneli `position: fixed` ile
 * tetikleyicinin yanına yerleşir; tablo kaydırma alanı paneli kesmez. Dışarı tıklama, Esc, kaydırma veya bir
 * işleme tıklama menüyü kapatır. İzinler yüzünden hiçbir işlem görünmüyorsa tetikleyici de gösterilmez.
 */
@Component({
  selector: 'app-islemler-menusu',
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  styleUrl: './islemler-menusu.component.scss',
  template: `
    <button
      #tetik
      type="button"
      class="islemler-tetik"
      [class.birincil]="birincil()"
      [class.d-none]="bos()"
      [disabled]="disabled()"
      aria-haspopup="menu"
      [attr.aria-expanded]="acik()"
      [attr.aria-label]="etiket()"
      (click)="degistir($event)"
    >
      <i [class]="ikon()" aria-hidden="true"></i><span>{{ etiket() }}</span
      ><i class="ri-arrow-down-s-line islemler-ok" [class.acik]="acik()" aria-hidden="true"></i>
    </button>
    <div
      #panel
      class="islemler-panel"
      role="menu"
      [class.acik]="acik()"
      [style.top.px]="konum()?.top"
      [style.left.px]="konum()?.left"
    >
      <ng-content />
    </div>
  `,
})
export class IslemlerMenusuComponent implements AfterViewInit {
  readonly etiket = input('İşlemler');
  readonly disabled = input(false);
  /** Tetikleyici simgesi; menü bir işlemin biçim seçimi olarak kullanıldığında işlemin kendi simgesi verilir. */
  readonly ikon = input('ri-more-2-fill');
  /** Sayfanın birincil işlemi (ör. üretim formu oluştur ve biçim seç) için dolu düğme görünümü. */
  readonly birincil = input(false);
  readonly acik = signal(false);
  readonly konum = signal<{ top: number; left: number } | null>(null);
  /** Projeksiyonla gelen bütün işlemler gizlendiyse tetikleyici de gizlenir. */
  readonly bos = signal(false);
  private readonly tetik = viewChild.required<ElementRef<HTMLButtonElement>>('tetik');
  private readonly panel = viewChild.required<ElementRef<HTMLDivElement>>('panel');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private static readonly PANEL_GENISLIGI = 240;

  constructor() {
    afterEveryRender(() => {
      const bos = !this.panel().nativeElement.querySelector('button, a');
      if (bos !== this.bos()) this.bos.set(bos);
    });
    // Sayfa veya herhangi bir kapsayıcı (çekmece, tablo) kaydırılınca sabit konumlu panel tetikleyiciden ayrılır;
    // panelin kendi kaydırması dışında menü kapanır. Kaydırma kabarcıklanmadığı için yakalama aşaması dinlenir.
    const kaydirildi = (event: Event) => {
      if (this.acik() && !this.panel().nativeElement.contains(event.target as Node)) this.acik.set(false);
    };
    document.addEventListener('scroll', kaydirildi, true);
    inject(DestroyRef).onDestroy(() => document.removeEventListener('scroll', kaydirildi, true));
  }

  ngAfterViewInit(): void {
    // İşleme tıklanınca menü kapanır; işlem kendi tıklamasını durdursa da yakalama aşamasında görülür.
    this.panel().nativeElement.addEventListener('click', () => this.acik.set(false), true);
  }

  degistir(event: MouseEvent): void {
    event.stopPropagation();
    if (this.acik()) {
      this.acik.set(false);
      return;
    }
    const kutu = this.tetik().nativeElement.getBoundingClientRect();
    const ogeSayisi = this.panel().nativeElement.querySelectorAll('button, a').length;
    const yukseklik = Math.min(ogeSayisi * 38 + 12, window.innerHeight - 16);
    const genislik = IslemlerMenusuComponent.PANEL_GENISLIGI;
    const left = Math.min(Math.max(8, kutu.right - genislik), window.innerWidth - genislik - 8);
    const asagi = kutu.bottom + 4 + yukseklik <= window.innerHeight - 8;
    const top = asagi ? kutu.bottom + 4 : Math.max(8, kutu.top - yukseklik - 4);
    this.konum.set({ top, left });
    this.acik.set(true);
  }

  @HostListener('document:click', ['$event'])
  disariTiklandi(event: MouseEvent): void {
    if (this.acik() && !this.host.nativeElement.contains(event.target as Node)) this.acik.set(false);
  }

  @HostListener('document:keydown.escape')
  escBasildi(): void {
    if (!this.acik()) return;
    this.acik.set(false);
    this.tetik().nativeElement.focus();
  }

  /** Pencere boyutu değişince sabit konumlu panel tetikleyiciden ayrılmasın diye kapanır. */
  @HostListener('window:resize')
  konumBozuldu(): void {
    if (this.acik()) this.acik.set(false);
  }
}
