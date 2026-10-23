import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ProjeService } from '../../../core/services/proje.service';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmService, duzMetin } from '../../../core/services/confirm.service';
import { TranslationService } from '../../../core/services/translation.service';
import { StatCardComponent } from '../../../shared/components/stat-card/stat-card.component';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import {
  OtomatikSahaAktarimOnizlemeDto,
  OtomatikSahaAktarimParametreleri,
  OtomatikSahaAktarimSonucDto,
  ProjeDto
} from '../../../shared/models/index';

/** Sunucu, önizlemeden sonra değişen planı bu kodla bildirir (409). */
export const PLAN_DEGISTI_KODU = 'PLAN_DEGISTI';

/** Hedef seçimi: mevcut saha projesi kimliği ya da yeni saha projesi. */
type HedefSecimi = { tur: 'mevcut'; id: number } | { tur: 'yeni' } | null;

/**
 * Sevk sonrası kalanları tek düğmeyle sahaya aktarır: elle yapılan "Sandıkları sahaya aktar" ve "Eksiklerden
 * oluştur" ile aynı kurallar. Önce sunucu önizlemesi gösterilir; onaylanınca önizlemenin plan özetiyle uygulanır.
 * Plan arada değiştiyse sunucu 409 döner ve önizleme yenilenir.
 */
@Component({
  selector: 'app-otomatik-saha-aktarim',
  standalone: true,
  imports: [DecimalPipe, FormsModule, StatCardComponent, TranslatePipe],
  templateUrl: './otomatik-saha-aktarim.component.html',
  styleUrl: './otomatik-saha-aktarim.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OtomatikSahaAktarimComponent {
  readonly proje = input.required<ProjeDto>();
  readonly closed = output<void>();
  readonly aktarildi = output<OtomatikSahaAktarimSonucDto>();

  private readonly projeService = inject(ProjeService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly ts = inject(TranslationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly onizleme = signal<OtomatikSahaAktarimOnizlemeDto | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly planDegisti = signal(false);
  readonly hedef = signal<HedefSecimi>(null);
  readonly yeniProjeNo = signal('');
  readonly aciklama = signal('');
  private istekSurumu = 0;

  /** Seçim kutusunun değeri: "yeni" ya da mevcut saha projesinin kimliği. */
  readonly hedefDegeri = computed(() => {
    const hedef = this.hedef();
    return hedef?.tur === 'yeni' ? 'yeni' : hedef?.tur === 'mevcut' ? String(hedef.id) : '';
  });

  readonly uygulanabilir = computed(() => {
    const onizleme = this.onizleme();
    return !!onizleme &&
      onizleme.aktarilacakVarMi &&
      !onizleme.hedefSecimiGerekli &&
      !this.planDegisti() &&
      !this.loading() &&
      !this.saving();
  });

  constructor() {
    effect(() => {
      const projeId = this.proje().id;
      untracked(() => this.yukle(projeId, {}));
    });
  }

  yenile(): void {
    this.yukle(this.proje().id, this.secimParametreleri());
  }

  hedefDegisti(deger: string): void {
    if (this.saving()) return;
    const secim: HedefSecimi = deger === 'yeni' ? { tur: 'yeni' } : deger ? { tur: 'mevcut', id: Number(deger) } : null;
    this.hedef.set(secim);
    this.yukle(this.proje().id, this.secimParametreleri());
  }

  kapat(): void {
    if (this.saving()) return;
    this.closed.emit();
  }

  async uygula(): Promise<void> {
    const onizleme = this.onizleme();
    if (!onizleme || !this.uygulanabilir()) return;

    const hedefNo = onizleme.yeniSahaProjesi
      ? (this.yeniProjeNo().trim() || onizleme.yeniSahaProjeNoOnerisi)
      : onizleme.hedefSahaProjeNo ?? '';
    const onay = await this.confirm.ask({
      title: this.ts.translate('SAHA_OTOMATIK.CONFIRM_TITLE'),
      message:
        `<strong>${duzMetin(onizleme.projeNo)}</strong> → <strong>${duzMetin(hedefNo)}</strong><br>` +
        `${onizleme.aktarilacakSandikSayisi} ${duzMetin(this.ts.translate('SAHA_OTOMATIK.CONFIRM_CRATES'))}, ` +
        `${onizleme.eksikSatirSayisi} ${duzMetin(this.ts.translate('SAHA_OTOMATIK.CONFIRM_ROWS'))}`,
      confirmText: this.ts.translate('SAHA_OTOMATIK.APPLY'),
      cancelText: this.ts.translate('SAHA_OTOMATIK.CANCEL'),
      type: 'warning',
    });
    if (!onay) return;

    this.saving.set(true);
    this.projeService.otomatikSahayaAktar(this.proje().id, {
      hedefSahaProjeId: onizleme.yeniSahaProjesi ? null : onizleme.hedefSahaProjeId ?? null,
      yeniProje: this.hedef()?.tur === 'yeni',
      yeniProjeNo: onizleme.yeniSahaProjesi ? this.yeniProjeNo().trim() || null : null,
      aciklama: this.aciklama().trim() || null,
      planOzeti: onizleme.planOzeti,
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(sonuc => {
      this.saving.set(false);
      if (sonuc.isSuccess && sonuc.value) {
        this.toast.success(
          `${sonuc.value.sahaProjeNo}: ${sonuc.value.aktarilanSandikSayisi} ${this.ts.translate('SAHA_OTOMATIK.CONFIRM_CRATES')}, ` +
          `${sonuc.value.eksikSatirSayisi} ${this.ts.translate('SAHA_OTOMATIK.CONFIRM_ROWS')} ${this.ts.translate('SAHA_OTOMATIK.DONE')}`);
        this.aktarildi.emit(sonuc.value);
        return;
      }
      if (planDegistiMi(sonuc)) {
        this.planDegisti.set(true);
        this.toast.warning(sonuc.error || this.ts.translate('SAHA_OTOMATIK.PLAN_CHANGED'));
        return;
      }
      this.toast.error(sonuc.error || this.ts.translate('SAHA_OTOMATIK.ERROR'));
    });
  }

  private secimParametreleri(): OtomatikSahaAktarimParametreleri {
    const hedef = this.hedef();
    return hedef?.tur === 'yeni'
      ? { yeniProje: true }
      : hedef?.tur === 'mevcut' ? { hedefSahaProjeId: hedef.id } : {};
  }

  private yukle(projeId: number, secim: OtomatikSahaAktarimParametreleri): void {
    const surum = ++this.istekSurumu;
    this.loading.set(true);
    this.error.set('');
    this.planDegisti.set(false);
    this.projeService.otomatikSahaAktarimOnizle(projeId, secim)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(sonuc => {
        if (surum !== this.istekSurumu) return;
        this.loading.set(false);
        if (!sonuc.isSuccess || !sonuc.value) {
          this.onizleme.set(null);
          this.error.set(sonuc.error || this.ts.translate('SAHA_OTOMATIK.ERROR'));
          return;
        }
        const onizleme = sonuc.value;
        this.onizleme.set(onizleme);
        // Sunucunun seçtiği hedef ekrana yansır; kullanıcı seçimi değiştirirse yeni önizleme istenir.
        if (onizleme.yeniSahaProjesi) {
          this.hedef.set({ tur: 'yeni' });
          if (!this.yeniProjeNo()) this.yeniProjeNo.set(onizleme.yeniSahaProjeNoOnerisi);
        } else if (onizleme.hedefSahaProjeId) {
          this.hedef.set({ tur: 'mevcut', id: onizleme.hedefSahaProjeId });
        } else {
          this.hedef.set(null);
        }
      });
  }
}

/** 409 gövdesindeki issues.kod plan değişikliğini bildirir. */
function planDegistiMi(sonuc: { statusCode?: number; issues?: unknown }): boolean {
  const issues = sonuc.issues as { kod?: string } | undefined;
  return sonuc.statusCode === 409 && issues?.kod === PLAN_DEGISTI_KODU;
}
