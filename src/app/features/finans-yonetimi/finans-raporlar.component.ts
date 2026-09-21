import { TranslationService } from '../../core/services/translation.service';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { FINANS_YETKI } from '../../core/constants/yetki-kodlari';
import { FinansService } from '../../core/services/finans.service';
import { PermissionService } from '../../core/services/permission.service';
import { ToastService } from '../../core/services/toast.service';
import { FinansGiderKategori, FinansListelemeRequest } from '../../shared/models/finans.model';

@Component({
  selector: 'app-finans-raporlar',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './finans-raporlar.component.html',
  styleUrl: './finans-v2.scss',
})
export class FinansRaporlarComponent implements OnInit {
  private readonly translation = inject(TranslationService);
  t(key: string): string {
    return this.translation.translate(`FINANS_V2.${key}`);
  }
  private readonly service = inject(FinansService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);
  readonly permissions = inject(PermissionService);
  readonly izin = FINANS_YETKI;
  readonly loading = signal(false);
  readonly kategoriler = signal<FinansGiderKategori[]>([]);
  tur = 'is';
  filtre: FinansListelemeRequest = { pageNumber: 1, pageSize: 25 };
  filtreleriTemizle(): void {
    this.filtre = { pageNumber: 1, pageSize: 25 };
  }

  ngOnInit(): void {
    if (!this.permissions.hasAccess(this.izin.GiderGoruntule)) return;
    this.service
      .giderKategorileri()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((r) => {
        if (r.isSuccess) this.kategoriler.set(r.value ?? []);
        else this.toast.error(r.error ?? this.t('REPORT_CATEGORY_ERROR'));
      });
  }

  indir(format: 'pdf' | 'excel'): void {
    if (this.loading()) return;
    if (this.filtre.baslangic && this.filtre.bitis && this.filtre.baslangic > this.filtre.bitis) {
      this.toast.error(this.t('REPORT_DATES_ERROR'));
      return;
    }
    this.loading.set(true);
    const call =
      this.tur === 'gider'
        ? this.service.giderRaporu(format, this.filtre)
        : this.tur === 'is'
          ? this.service.isRaporu(format, this.filtre)
          : this.service.ozetRaporu(this.tur, format, this.filtre);
    call
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `Finans_${this.tur}_Raporu.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
          link.click();
          URL.revokeObjectURL(url);
        },
        error: async (error: unknown) =>
          this.toast.error(await this.service.downloadErrorMessage(error, this.t('REPORT_ERROR'))),
      });
  }
}
