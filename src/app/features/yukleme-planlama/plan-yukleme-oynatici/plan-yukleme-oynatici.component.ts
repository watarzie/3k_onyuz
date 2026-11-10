import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { girisYonuMetni, mm } from '../ortak/yukleme-etiketleri';
import { YuklemeAdimi, adimSinirla } from '../ortak/yukleme-adimlari';

/** Bir adımın ekranda kalma süresi (1× hızda, ms). */
export const ADIM_SURESI_MS = 1200;

/**
 * Yükleme sırası oynatıcısı (isterler 14, 16): aracın yükleme adımlarında ileri, geri, başa/sona ve otomatik oynatma.
 * Durum tutmaz: geçerli adım üst bileşendedir, oynatıcı yalnız istenen adımı bildirir. Veri değiştirmez, istek atmaz.
 * Adımlar değişince (başka araç, yeni yerleşim) ya da adım oynatıcının istemediği bir değere geçince (tablodan satır
 * seçimi) oynatma durur.
 */
@Component({
  selector: 'app-plan-yukleme-oynatici',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe],
  templateUrl: './plan-yukleme-oynatici.component.html',
  styleUrls: ['../ortak/yukleme.scss', './plan-yukleme-oynatici.component.scss'],
})
export class PlanYuklemeOynaticiComponent {
  private readonly destroyRef = inject(DestroyRef);

  readonly adimlar = input.required<YuklemeAdimi[]>();
  /** Geçerli adım (1…adım sayısı). */
  readonly adim = input.required<number>();
  readonly adimDegisti = output<number>();

  readonly HIZLAR = [0.5, 1, 2];
  readonly girisYonu = girisYonuMetni;
  readonly mm = mm;

  readonly oynuyor = signal(false);
  readonly hiz = signal(1);
  readonly toplam = computed(() => this.adimlar().length);
  readonly gecerli = computed<YuklemeAdimi | null>(() => this.adimlar()[this.adim() - 1] ?? null);

  private zamanlayici: ReturnType<typeof setInterval> | null = null;
  /** Oynatmanın son istediği adım; oynatma yokken null. */
  private beklenenAdim: number | null = null;

  constructor() {
    // Adımlar değişince süren oynatma eski aracın zamanlayıcısıyla devam etmesin.
    effect(() => {
      this.adimlar();
      this.durdur();
    });
    // Adım dışarıdan değişti (ör. tablodan satır seçildi): elle gezinme sayılır.
    effect(() => {
      const adim = this.adim();
      if (this.beklenenAdim !== null && adim !== this.beklenenAdim) this.durdur();
    });
    this.destroyRef.onDestroy(() => this.durdur());
  }

  git(adimNo: number): void {
    const hedef = adimSinirla(adimNo, this.toplam());
    if (hedef !== this.adim()) this.adimDegisti.emit(hedef);
  }

  /** Elle gezinme oynatmayı durdurur. */
  elleGit(adimNo: number): void {
    this.durdur();
    this.git(adimNo);
  }

  oynatDuraklat(): void {
    if (this.oynuyor()) {
      this.durdur();
      return;
    }
    if (this.toplam() < 2) return;
    this.oynuyor.set(true);
    // Sondayken oynat baştan başlatır.
    if (this.adim() >= this.toplam()) this.iste(1);
    else this.beklenenAdim = this.adim();
    this.zamanla();
  }

  hizSec(hiz: number): void {
    this.hiz.set(hiz);
    if (this.oynuyor()) this.zamanla();
  }

  /** Klavye: oklar önceki/sonraki adım, Home/End baş/son, boşluk oynat/duraklat. */
  tus(e: KeyboardEvent): void {
    // Sürgü, hız seçimi ve düğmeler kendi tuşlarını işler.
    const hedefOge = e.target as HTMLElement;
    if (hedefOge.tagName === 'INPUT' || hedefOge.closest('[role="radiogroup"]')) return;
    const hedef: Record<string, number> = { ArrowLeft: this.adim() - 1, ArrowRight: this.adim() + 1, Home: 1, End: this.toplam() };
    if (e.key in hedef) {
      e.preventDefault();
      this.elleGit(hedef[e.key]);
    } else if (e.key === ' ' && hedefOge.tagName !== 'BUTTON') {
      e.preventDefault();
      this.oynatDuraklat();
    }
  }

  private zamanla(): void {
    if (this.zamanlayici !== null) clearInterval(this.zamanlayici);
    this.zamanlayici = setInterval(() => {
      if (this.adim() >= this.toplam()) this.durdur();
      else this.iste(this.adim() + 1);
    }, ADIM_SURESI_MS / this.hiz());
  }

  private iste(adimNo: number): void {
    this.beklenenAdim = adimNo;
    this.adimDegisti.emit(adimNo);
  }

  private durdur(): void {
    if (this.zamanlayici !== null) clearInterval(this.zamanlayici);
    this.zamanlayici = null;
    this.beklenenAdim = null;
    this.oynuyor.set(false);
  }
}
