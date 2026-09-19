import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CekiRevizyonGecmisiService } from '../../../core/services/ceki-revizyon-gecmisi.service';
import { TranslationService } from '../../../core/services/translation.service';
import { CekiRevizyonGecmisiDetayi, CekiRevizyonGecmisiKaydi } from '../../models/ceki-revizyon-gecmisi.model';
import { CekiRevizyonOnizlemeComponent } from '../ceki-revizyon-onizleme/ceki-revizyon-onizleme.component';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-ceki-revizyon-gecmisi', standalone: true,
  imports: [DatePipe, TranslatePipe, CekiRevizyonOnizlemeComponent],
  templateUrl: './ceki-revizyon-gecmisi.component.html',
  styleUrl: './ceki-revizyon-gecmisi.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CekiRevizyonGecmisiComponent {
  readonly projeId = input.required<number>();
  readonly projeNo = input.required<string>();
  readonly closed = output<void>();
  readonly ts = inject(TranslationService);
  private readonly service = inject(CekiRevizyonGecmisiService);
  private readonly destroyRef = inject(DestroyRef);
  readonly rows = signal<CekiRevizyonGecmisiKaydi[]>([]);
  readonly page = signal(1);
  readonly pages = signal(0);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly detailLoading = signal(false);
  readonly downloading = signal(false);
  readonly error = signal('');
  readonly detail = signal<CekiRevizyonGecmisiDetayi | null>(null);
  private requestVersion = 0;
  private detailVersion = 0;

  constructor() { effect(() => this.load(this.projeId(), 1)); }

  load(projeId: number, page: number): void {
    const version = ++this.requestVersion;
    ++this.detailVersion;
    this.loading.set(true);
    this.page.set(page);
    this.pages.set(0);
    this.total.set(0);
    this.rows.set([]);
    this.detailLoading.set(false);
    this.detail.set(null);
    this.error.set('');
    this.service.listele(projeId, page).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(result => {
      if (version !== this.requestVersion) return;
      this.loading.set(false);
      if (!result.isSuccess || !result.value) {
        this.rows.set([]);
        this.error.set(result.error || this.ts.translate('REV_HISTORY.ERROR'));
        return;
      }
      this.rows.set(result.value.items);
      this.page.set(result.value.pageNumber);
      this.pages.set(result.value.totalPages);
      this.total.set(result.value.totalCount);
    });
  }

  openDetail(row: CekiRevizyonGecmisiKaydi): void {
    const version = ++this.detailVersion;
    this.detailLoading.set(true);
    this.detail.set(null);
    this.error.set('');
    this.service.detay(row).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(result => {
      if (version !== this.detailVersion) return;
      this.detailLoading.set(false);
      if (result.isSuccess && result.value) this.detail.set(result.value);
      else this.error.set(result.error || this.ts.translate('REV_HISTORY.ERROR'));
    });
  }

  download(row: CekiRevizyonGecmisiKaydi): void {
    if (this.downloading()) return;
    this.downloading.set(true);
    const projeId = this.projeId();
    this.error.set('');
    this.service.dosya(row).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = row.dosyaAdi;
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        this.downloading.set(false);
      },
      error: async (error: unknown) => {
        const message = await this.service.dosyaHatasi(error, this.ts.translate('REV_HISTORY.FILE_ERROR'));
        if (this.projeId() === projeId && !this.destroyRef.destroyed) this.error.set(message);
        this.downloading.set(false);
      },
    });
  }
}
