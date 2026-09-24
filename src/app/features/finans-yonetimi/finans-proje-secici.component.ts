import { Component, DestroyRef, OnInit, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, finalize, switchMap, timer } from 'rxjs';
import { FinansService } from '../../core/services/finans.service';
import { FinansSayfaliSonuc } from '../../shared/models/finans.model';

@Component({
  selector: 'app-finans-proje-secici',
  standalone: true,
  imports: [FormsModule],
  template: ` <div class="project-picker">
    <button
      type="button"
      class="form-select text-start"
      [attr.aria-expanded]="acik()"
      (click)="ac()"
    >
      {{ etiket() || (projeId() ? 'Seçili proje #' + projeId() : 'Proje seçin (isteğe bağlı)') }}
    </button>
    @if (acik()) {
      <div class="project-dropdown">
        <input
          type="search"
          class="form-control"
          placeholder="Proje no veya müşteri ara…"
          [(ngModel)]="arama"
          (ngModelChange)="ara()"
          aria-label="Proje ara"
        />
        @if (loading()) {
          <p role="status">Yükleniyor…</p>
        }
        @if (hata()) {
          <p role="alert">{{ hata() }}</p>
        }
        <button type="button" (click)="sec(null)">Projeye bağlama</button>
        @for (p of sonuc()?.items; track p.projeId) {
          <button type="button" (click)="sec(p)">
            <strong>{{ p.projeNo }}</strong> · {{ p.musteri }}
          </button>
        }
        <div class="project-pages">
          <button
            type="button"
            [disabled]="loading() || !sonuc()?.hasPreviousPage"
            (click)="sayfa(-1)"
          >
            Önceki</button
          ><span>{{ page }} / {{ sonuc()?.totalPages || 1 }}</span
          ><button type="button" [disabled]="loading() || !sonuc()?.hasNextPage" (click)="sayfa(1)">
            Sonraki</button
          ><button type="button" (click)="acik.set(false)">Kapat</button>
        </div>
      </div>
    }
  </div>`,
  styles: [
    `
      :host {
        display: block;
      }
      .project-picker {
        position: relative;
      }
      .project-dropdown {
        position: absolute;
        z-index: 30;
        inset: 46px 0 auto;
        padding: 12px;
        background: white;
        border: 1px solid #e6e9ef;
        border-radius: 10px;
        box-shadow: 0 8px 24px #2020401c;
        max-height: 340px;
        overflow-y: auto;
      }
      .project-dropdown > button {
        display: block;
        width: 100%;
        text-align: left;
        border: 0;
        background: transparent;
        padding: 9px 7px;
        color: #44516b;
      }
      .project-dropdown > button:hover {
        background: #f3f2ff;
      }
      .project-pages {
        display: flex;
        gap: 7px;
        align-items: center;
        font-size: 12px;
        margin-top: 8px;
      }
      .project-pages button {
        border: 1px solid #e6e9ef;
        border-radius: 5px;
        background: white;
        padding: 5px;
      }
    `,
  ],
})
export class FinansProjeSeciciComponent implements OnInit {
  readonly projeId = input<number | null | undefined>(null);
  readonly etiket = input('');
  readonly secildi = output<{ projeId: number; projeNo: string; musteri: string } | null>();
  private readonly service = inject(FinansService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly istek = new Subject<void>();
  readonly acik = signal(false);
  readonly loading = signal(false);
  readonly hata = signal('');
  readonly sonuc = signal<FinansSayfaliSonuc<{
    projeId: number;
    projeNo: string;
    musteri: string;
  }> | null>(null);
  arama = '';
  page = 1;
  ngOnInit(): void {
    this.istek
      .pipe(
        switchMap(() => {
          this.loading.set(true);
          this.hata.set('');
          this.sonuc.set(null);
          // Yeni arama başlar başlamaz önceki isteği iptal et; debounce süresinde
          // dönen eski cevabın yeni aramanın listesini doldurmasına izin verme.
          const arama = this.arama;
          const page = this.page;
          return timer(250).pipe(
            switchMap(() => this.service.projeSecenekleri(arama, page)),
            finalize(() => this.loading.set(false)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((r) => {
        if (r.isSuccess) this.sonuc.set(r.value ?? null);
        else {
          this.sonuc.set(null);
          this.hata.set(r.error ?? 'Projeler yüklenemedi.');
        }
      });
  }
  ac(): void {
    this.acik.update((x) => !x);
    if (this.acik()) this.istek.next();
  }
  ara(): void {
    this.page = 1;
    this.istek.next();
  }
  sayfa(delta: number): void {
    if (this.loading() || (delta < 0 && !this.sonuc()?.hasPreviousPage) || (delta > 0 && !this.sonuc()?.hasNextPage)) return;
    this.page += delta;
    this.istek.next();
  }
  sec(proje: { projeId: number; projeNo: string; musteri: string } | null): void {
    this.secildi.emit(proje);
    this.acik.set(false);
  }
}
