import { TranslationService } from '../../../core/services/translation.service';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { FINANS_YETKI } from '../../../core/constants/yetki-kodlari';
import { FinansService } from '../../../core/services/finans.service';
import { FinansParaBirimiService } from '../../../core/services/finans-para-birimi.service';
import { FinansOdemeFiltresi } from '../../../core/constants/enums';
import { PermissionService } from '../../../core/services/permission.service';
import { ToastService } from '../../../core/services/toast.service';
import { FinansGiderKategori, FinansListelemeRequest } from '../../../shared/models/finans.model';
import { FinansRaporOnizleme } from '../../../shared/models/finans-v2.model';
import { finansRaporuIndirilebilir, finansSiparisFaturaOkunabilir, tumFinansAlanlariGorunur } from '../ortak/finans-izinleri';
import { dosyayiKaydet } from '../../../core/services/dosya-kaydet';

@Component({
  selector: 'app-finans-raporlar',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './finans-raporlar.component.html',
  styleUrl: '../ortak/finans-v2.scss',
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
  readonly paraBirimleri = inject(FinansParaBirimiService);
  readonly izin = FINANS_YETKI;
  readonly odemeFiltreleri = FinansOdemeFiltresi;
  readonly loading = signal(false);
  readonly kategoriler = signal<FinansGiderKategori[]>([]);
  tur = 'is';
  filtre: FinansListelemeRequest = { pageNumber: 1, pageSize: 25 };
  indirilebilir(bicim: 'pdf' | 'excel'): boolean {
    return finansRaporuIndirilebilir(this.permissions, bicim) && (this.tur !== 'alacak' || this.alacakRaporuGorunur());
  }
  /** Alacak raporu faturalardan üretilir; fatura okuma izni de gerekir (RR Q6). */
  alacakRaporuGorunur(): boolean {
    return finansSiparisFaturaOkunabilir(this.permissions);
  }
  filtreleriTemizle(): void {
    this.filtre = { pageNumber: 1, pageSize: 25 };
  }

  /** Önizleme: seçili rapor türü ve filtrelerle dosyada yer alacak satırlar (ilk 50). */
  readonly onizleme = signal<FinansRaporOnizleme | null>(null);
  readonly onizlemeYukleniyor = signal(false);
  private onizlemeImzasi = '';
  /** Rapor dosyasının okuma izinleri (biçim izni hariç). */
  onizlemeGorulebilir(): boolean {
    return this.permissions.hasAccess(this.izin.RaporGoruntule) && tumFinansAlanlariGorunur(this.permissions) &&
      (this.tur !== 'alacak' || this.alacakRaporuGorunur());
  }
  /** Önizlemeden sonra rapor türü veya filtre değiştiyse gösterilen satırlar indirilecek dosyayı yansıtmaz. */
  onizlemeEski(): boolean {
    return !!this.onizleme() && this.onizlemeImzasi !== this.imza();
  }
  private imza(): string {
    return JSON.stringify([this.tur, this.filtre]);
  }
  onizle(): void {
    if (this.onizlemeYukleniyor() || !this.onizlemeGorulebilir()) return;
    if (this.filtre.baslangic && this.filtre.bitis && this.filtre.baslangic > this.filtre.bitis) {
      this.toast.error(this.t('REPORT_DATES_ERROR'));
      return;
    }
    const imza = this.imza();
    this.onizlemeYukleniyor.set(true);
    this.service
      .raporOnizleme(this.tur, this.filtre)
      .pipe(
        finalize(() => this.onizlemeYukleniyor.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((r) => {
        if (!r.isSuccess || !r.value) {
          this.toast.error(r.error ?? this.t('REPORT_PREVIEW_ERROR'));
          return;
        }
        this.onizlemeImzasi = imza;
        this.onizleme.set(r.value);
      });
  }

  ngOnInit(): void {
    this.paraBirimleri.yukle();
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
        : this.tur === 'alacak'
          ? this.service.alacakRaporu(format, this.filtre)
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
          dosyayiKaydet(blob, `Finans_${this.tur}_Raporu.${format === 'pdf' ? 'pdf' : 'xlsx'}`);
        },
        error: async (error: unknown) =>
          this.toast.error(await this.service.downloadErrorMessage(error, this.t('REPORT_ERROR'))),
      });
  }
}
