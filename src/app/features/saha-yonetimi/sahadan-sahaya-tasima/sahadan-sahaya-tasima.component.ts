import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ProjeService } from '../../../core/services/proje.service';
import { SandikService } from '../../../core/services/sandik.service';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmService, duzMetin } from '../../../core/services/confirm.service';
import { TranslationService } from '../../../core/services/translation.service';
import { ProjeTipi, SandikDurum } from '../../../core/constants/enums';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import {
  ProjeDropdownDto,
  SahadanSahayaTasimaOnizlemeDto,
  SahadanSahayaTasimaSonucDto,
  SahadanSahayaTasimaTalebi,
  SandikDto,
  aktifSahaProjeleri,
} from '../../../shared/models/index';

/** Kaynak saha projesi: taşıma penceresinin açıldığı proje. */
export interface SahaTasimaKaynagi {
  id: number;
  projeNo: string;
}

/**
 * Saha satırlarını (ya da bir saha sandığının bütün içeriğini) başka bir saha projesine taşır. Satır kopyalanmaz:
 * sayaçlar ve ana proje bağı korunur, sunucu her taşımayı iz olarak yazar. Önce sunucu önizlemesi (engeller, hedef
 * sandık numarası, boşalacak sandık) gösterilir; işlem anahtarı pencere açık kaldıkça sabittir, ağ tekrarı ikinci
 * taşıma üretmez. Yanlış taşıma ters yönde yeni taşımayla düzeltilir.
 */
@Component({
  selector: 'app-sahadan-sahaya-tasima',
  standalone: true,
  imports: [DecimalPipe, FormsModule, TranslatePipe],
  templateUrl: './sahadan-sahaya-tasima.component.html',
  styleUrl: './sahadan-sahaya-tasima.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SahadanSahayaTasimaComponent {
  readonly kaynak = input.required<SahaTasimaKaynagi>();
  /** Satır modu: taşınacak saha satırları. */
  readonly satirIds = input<number[]>([]);
  /** Sandık modu: bütün içeriği taşınacak saha sandığı. */
  readonly sandikId = input<number | null>(null);
  readonly baslik = input('');
  readonly closed = output<void>();
  readonly tasindi = output<SahadanSahayaTasimaSonucDto>();

  private readonly projeService = inject(ProjeService);
  private readonly sandikService = inject(SandikService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly ts = inject(TranslationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly hedefProjeler = signal<ProjeDropdownDto[]>([]);
  readonly hedefProjeId = signal<number | null>(null);
  readonly hedefSandiklar = signal<SandikDto[]>([]);
  /** "yeni" ya da mevcut hedef sandığın kimliği. */
  readonly hedefSandik = signal<string>('yeni');
  readonly yeniSandikNo = signal('');
  readonly aciklama = signal('');
  readonly onizleme = signal<SahadanSahayaTasimaOnizlemeDto | null>(null);
  readonly engeller = signal<string[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly islemAnahtari = crypto.randomUUID();
  /** Hedef saha araması: liste sunucuda süzülür (en çok 100 kayıt), seçili saha listede kalır. */
  readonly hedefArama = signal('');
  private onizlemeSurumu = 0;
  /** Gösterilen önizlemenin talebi; seçim ya da numara değişince taşıma yeni önizleme gelene kadar kapalıdır. */
  private readonly onizlemeImzasi = signal('');
  private aramaZamanlayici?: ReturnType<typeof setTimeout>;
  private onizlemeZamanlayici?: ReturnType<typeof setTimeout>;

  readonly tasinabilir = computed(() =>
    !!this.onizleme()?.tasinabilirMi && this.engeller().length === 0 && !this.loading() && !this.saving() &&
    this.onizlemeImzasi() === JSON.stringify(this.talep()));

  constructor() {
    effect(() => {
      const kaynakId = this.kaynak().id;
      untracked(() => this.hedefProjeleriYukle(kaynakId));
    });
    this.destroyRef.onDestroy(() => {
      clearTimeout(this.aramaZamanlayici);
      clearTimeout(this.onizlemeZamanlayici);
    });
  }

  hedefAramaDegisti(deger: string): void {
    this.hedefArama.set(deger);
    clearTimeout(this.aramaZamanlayici);
    this.aramaZamanlayici = setTimeout(() => this.hedefProjeleriYukle(this.kaynak().id), 300);
  }

  /** Numara yazılırken önizleme beklemeli istenir; Enter hemen ister. Odak kaybında istenmez (düğme tıklaması kaybolmasın). */
  yeniSandikNoDegisti(deger: string): void {
    this.yeniSandikNo.set(deger);
    clearTimeout(this.onizlemeZamanlayici);
    this.onizlemeZamanlayici = setTimeout(() => this.onizle(), 400);
  }

  hedefProjeSecildi(deger: string): void {
    const id = deger ? Number(deger) : null;
    this.hedefProjeId.set(id);
    this.hedefSandik.set('yeni');
    this.hedefSandiklar.set([]);
    this.onizleme.set(null);
    this.engeller.set([]);
    if (!id) return;
    this.sandikService.getSandiklar(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(sonuc => {
      if (this.hedefProjeId() !== id) return;
      this.hedefSandiklar.set((sonuc.value ?? [])
        .filter(s => s.durumId !== SandikDurum.Sevkedildi && !s.sevkiyatDuzeltmeAcikMi)
        .sort((a, b) => a.sandikNo.localeCompare(b.sandikNo, 'tr-TR', { numeric: true })));
    });
    this.onizle();
  }

  hedefSandikSecildi(deger: string): void {
    this.hedefSandik.set(deger || 'yeni');
    this.onizle();
  }

  kapat(): void {
    if (this.saving()) return;
    this.closed.emit();
  }

  onizle(): void {
    clearTimeout(this.onizlemeZamanlayici);
    const talep = this.talep();
    if (!talep) return;
    const imza = JSON.stringify(talep);
    const surum = ++this.onizlemeSurumu;
    this.loading.set(true);
    this.error.set('');
    this.engeller.set([]);
    this.projeService.sahadanSahayaTasimaOnizle(talep).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(sonuc => {
      if (surum !== this.onizlemeSurumu) return;
      this.loading.set(false);
      if (!sonuc.isSuccess || !sonuc.value) {
        this.onizleme.set(null);
        this.error.set(sonuc.error || this.ts.translate('SAHA_TASIMA.ERROR'));
        return;
      }
      this.onizleme.set(sonuc.value);
      this.engeller.set(sonuc.value.engeller);
      this.onizlemeImzasi.set(imza);
    });
  }

  async tasi(): Promise<void> {
    const talep = this.talep();
    const onizleme = this.onizleme();
    if (!talep || !onizleme || !this.tasinabilir()) return;

    const onay = await this.confirm.ask({
      title: this.ts.translate('SAHA_TASIMA.TITLE'),
      message:
        `<strong>${duzMetin(onizleme.kaynakSahaProjeNo)}</strong> → <strong>${duzMetin(onizleme.hedefSahaProjeNo)}</strong> ` +
        `(${duzMetin(this.ts.translate('SAHA_TASIMA.CRATE'))} ${duzMetin(onizleme.hedefSandikNo)})<br>` +
        `${onizleme.satirlar.length} ${duzMetin(this.ts.translate('SAHA_TASIMA.ROWS'))}` +
        (onizleme.bosalacakSandikNolari.length
          ? `<br>${duzMetin(this.ts.translate('SAHA_TASIMA.WILL_EMPTY'))}: ${duzMetin(onizleme.bosalacakSandikNolari.join(', '))}`
          : ''),
      confirmText: this.ts.translate('SAHA_TASIMA.APPLY'),
      cancelText: this.ts.translate('SAHA_TASIMA.CANCEL'),
      type: 'warning',
    });
    if (!onay) return;

    this.saving.set(true);
    this.projeService.sahadanSahayaTasi({
      ...talep,
      islemAnahtari: this.islemAnahtari,
      aciklama: this.aciklama().trim() || null,
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(sonuc => {
      this.saving.set(false);
      if (sonuc.isSuccess && sonuc.value) {
        this.toast.success(
          `${sonuc.value.hedefSahaProjeNo} (${sonuc.value.hedefSandikNo}): ${sonuc.value.tasinanSatirSayisi} ${this.ts.translate('SAHA_TASIMA.ROWS')} ${this.ts.translate('SAHA_TASIMA.DONE')}`);
        this.tasindi.emit(sonuc.value);
        return;
      }
      // 409 gövdesindeki engeller pencerede listelenir; hiçbir kayıt değişmemiştir.
      const issues = (sonuc as { issues?: unknown }).issues;
      if (Array.isArray(issues)) this.engeller.set(issues.map(String));
      this.toast.error(sonuc.error || this.ts.translate('SAHA_TASIMA.ERROR'));
    });
  }

  private talep(): SahadanSahayaTasimaTalebi | null {
    const hedefProjeId = this.hedefProjeId();
    if (!hedefProjeId) return null;
    const hedefSandik = this.hedefSandik();
    const sandikId = this.sandikId();
    return {
      kaynakSahaProjeId: this.kaynak().id,
      sahaCekiSatiriIds: sandikId ? [] : this.satirIds(),
      kaynakSandikId: sandikId,
      hedefSahaProjeId: hedefProjeId,
      hedefSandikId: hedefSandik === 'yeni' ? null : Number(hedefSandik),
      yeniSandikNo: hedefSandik === 'yeni' ? this.yeniSandikNo().trim() || null : null,
    };
  }

  private hedefProjeleriYukle(kaynakId: number): void {
    const secili = this.hedefProjeId();
    this.projeService.getProjeDropdownListesi({
      projeTipiId: ProjeTipi.Saha,
      isSevkEdilen: false,
      take: 100,
      searchTerm: this.hedefArama().trim() || undefined,
      includeIds: secili ? [secili] : undefined,
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(sonuc => {
        this.hedefProjeler.set(aktifSahaProjeleri(sonuc.value ?? []).filter(p => p.id !== kaynakId));
      });
  }
}
