import { Component, DestroyRef, OnInit, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, forkJoin } from 'rxjs';
import { FinansService } from '../../../core/services/finans.service';
import { ToastService } from '../../../core/services/toast.service';
import { TranslationService } from '../../../core/services/translation.service';
import { onayaAlindi } from '../../../shared/models';
import {
  FinansParaBirimi,
  FinansParaBirimiKaydet,
  FinansParametreler,
} from '../../../shared/models/finans-v2.model';

type ParaBirimiFormu = FinansParaBirimiKaydet & { id: number | null };

/**
 * Para birimi tanımları (F1) ve vade parametreleri (D3). Para birimi kodu finans kayıtlarında saklandığı için
 * değiştirilemez; pasifleştirilen para birimi yalnız yeni seçimlerden çıkar, geçmiş kayıtlar korunur.
 */
@Component({
  selector: 'app-finans-parametreler',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './finans-parametreler.component.html',
  styleUrl: '../ortak/finans-v2.scss',
})
export class FinansParametrelerComponent implements OnInit {
  private readonly service = inject(FinansService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translation = inject(TranslationService);
  t(key: string): string {
    return this.translation.translate(`FINANS_V2.${key}`);
  }
  readonly yazabilir = input(false);
  /** Para birimi listesi değişti; seçim listeleri yenilensin. */
  readonly degisti = output<void>();

  readonly paraBirimleri = signal<FinansParaBirimi[]>([]);
  readonly loading = signal(false);
  readonly kaydediliyor = signal(false);
  readonly hata = signal('');
  readonly form = signal<ParaBirimiFormu | null>(null);
  parametreForm: FinansParametreler = { varsayilanVadeGunu: 30, vadeUyariGunu: 7 };

  ngOnInit(): void {
    this.yukle();
  }

  yukle(): void {
    this.loading.set(true);
    this.hata.set('');
    forkJoin({ paraBirimleri: this.service.paraBirimleri(false), parametreler: this.service.parametreler() })
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ paraBirimleri, parametreler }) => {
        if (paraBirimleri.isSuccess) this.paraBirimleri.set(paraBirimleri.value ?? []);
        else this.hata.set(paraBirimleri.error ?? this.t('CURRENCY_LOAD_ERROR'));
        if (parametreler.isSuccess && parametreler.value) this.parametreForm = { ...parametreler.value };
      });
  }

  yeniParaBirimi(): void {
    const sira = Math.max(0, ...this.paraBirimleri().map((x) => x.sira)) + 1;
    this.form.set({ id: null, kod: '', ad: '', sembol: '', aktif: true, sira });
    this.hata.set('');
  }

  duzenle(paraBirimi: FinansParaBirimi): void {
    this.form.set({ ...paraBirimi, sembol: paraBirimi.sembol ?? '' });
    this.hata.set('');
  }

  paraBirimiKaydet(): void {
    const form = this.form();
    if (!form || !this.yazabilir() || this.kaydediliyor()) return;
    const kod = form.kod.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(kod) || !form.ad.trim()) {
      this.hata.set(this.t('CURRENCY_VALIDATION'));
      return;
    }
    this.kaydet(
      { kod, ad: form.ad.trim(), sembol: form.sembol?.trim() || null, aktif: form.aktif, sira: Number(form.sira) || 0 },
      form.id,
    );
  }

  aktiflikDegistir(paraBirimi: FinansParaBirimi): void {
    if (!this.yazabilir() || this.kaydediliyor()) return;
    const { id, ...tanim } = paraBirimi;
    this.kaydet({ ...tanim, aktif: !tanim.aktif }, id);
  }

  parametreleriKaydet(): void {
    if (!this.yazabilir() || this.kaydediliyor()) return;
    const vade = Number(this.parametreForm.varsayilanVadeGunu);
    const uyari = Number(this.parametreForm.vadeUyariGunu);
    if (!Number.isInteger(vade) || vade < 0 || vade > 365 || !Number.isInteger(uyari) || uyari < 0 || uyari > 90) {
      this.hata.set(this.t('DUE_SETTINGS_VALIDATION'));
      return;
    }
    this.kaydediliyor.set(true);
    this.hata.set('');
    this.service
      .parametreleriKaydet({ varsayilanVadeGunu: vade, vadeUyariGunu: uyari })
      .pipe(
        finalize(() => this.kaydediliyor.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((r) => {
        if (!r.isSuccess) {
          this.hata.set(r.error ?? this.t('DUE_SETTINGS_SAVE_ERROR'));
          return;
        }
        if (onayaAlindi(r)) this.toast.info(this.t('APPROVAL_QUEUED'));
        else this.toast.success(this.t('DUE_SETTINGS_SAVED'));
      });
  }

  private kaydet(request: FinansParaBirimiKaydet, id: number | null): void {
    this.kaydediliyor.set(true);
    this.hata.set('');
    this.service
      .paraBirimiKaydet(request, id ?? undefined)
      .pipe(
        finalize(() => this.kaydediliyor.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((r) => {
        if (!r.isSuccess) {
          this.hata.set(r.error ?? this.t('CURRENCY_SAVE_ERROR'));
          return;
        }
        if (onayaAlindi(r)) {
          this.toast.info(this.t('APPROVAL_QUEUED'));
          return;
        }
        this.form.set(null);
        this.toast.success(this.t('CURRENCY_SAVED'));
        this.degisti.emit();
        this.yukle();
      });
  }
}
