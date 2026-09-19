import { Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { SandikService } from '../../../core/services/sandik.service';
import { TranslationService } from '../../../core/services/translation.service';
import { SandikDto, SandikIcerikDto } from '../../../shared/models/sandik.model';
import { SandikUrunleriTopluTasiDto } from '../../../shared/models/sandik-toplu-tasima.model';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-sandik-toplu-tasi',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  templateUrl: './sandik-toplu-tasi.component.html',
  styleUrl: './sandik-toplu-tasi.component.scss',
})
export class SandikTopluTasiComponent implements OnInit {
  private readonly service = inject(SandikService);
  private readonly ts = inject(TranslationService);
  private readonly destroyRef = inject(DestroyRef);

  projeId = input.required<number>();
  kaynakSandikId = input.required<number>();
  kaynakSandikNo = input.required<string>();
  urunler = input.required<readonly SandikIcerikDto[]>();
  hedefSandiklar = input.required<readonly SandikDto[]>();
  canWrite = input.required<boolean>();
  closed = output<void>();
  moved = output<void>();

  hedefSandikId = signal(0);
  miktarlar = signal<Record<number, number>>({});
  saving = signal(false);
  error = signal('');
  private sonIstek: { parmakIzi: string; anahtar: string } | null = null;

  seciliHedef = computed(() => this.hedefSandiklar().find(x => x.id === this.hedefSandikId()));

  ngOnInit(): void {
    this.miktarlar.set(Object.fromEntries(this.urunler().map(x => [x.id, this.tahsis(x)])));
  }

  tahsis(urun: SandikIcerikDto): number {
    return Math.max(Number(urun.sandikMiktari ?? urun.istenenAdet ?? urun.miktar ?? 0), 0);
  }

  miktarDegistir(id: number, value: number): void {
    if (!this.saving()) this.miktarlar.update(current => ({ ...current, [id]: Number(value) }));
  }

  fiziksel(urun: SandikIcerikDto): number {
    return Math.max(Math.min(this.miktarlar()[urun.id] || 0, urun.konulanAdet), 0);
  }

  format(value: number): string {
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 }).format(value);
  }

  close(): void {
    if (!this.saving()) this.closed.emit();
  }

  submit(): void {
    if (this.saving() || !this.canWrite()) return;
    this.error.set('');
    if (!this.seciliHedef() || this.hedefSandikId() === this.kaynakSandikId()) {
      this.error.set(this.ts.translate('BULK_CRATE_MOVE.CHOOSE_TARGET'));
      return;
    }
    if (!this.urunler().length || this.urunler().length > 250) {
      this.error.set(this.ts.translate('BULK_CRATE_MOVE.LIMIT'));
      return;
    }
    const satirlar = this.urunler().map(urun => ({
      kaynakSandikIcerikId: urun.id,
      tasinanAdet: Number(this.miktarlar()[urun.id]),
    }));
    const gecersiz = satirlar.find(satir => {
      const urun = this.urunler().find(x => x.id === satir.kaynakSandikIcerikId)!;
      return !Number.isFinite(satir.tasinanAdet) || satir.tasinanAdet <= 0 ||
        satir.tasinanAdet > this.tahsis(urun) ||
        Math.abs(satir.tasinanAdet * 10_000 - Math.round(satir.tasinanAdet * 10_000)) > 1e-8;
    });
    if (gecersiz) {
      this.error.set(`#${gecersiz.kaynakSandikIcerikId}: ${this.ts.translate('BULK_CRATE_MOVE.INVALID_AMOUNT')}`);
      return;
    }

    const payload = {
      projeId: this.projeId(), kaynakSandikId: this.kaynakSandikId(),
      hedefSandikId: this.hedefSandikId(),
      satirlar: satirlar.sort((a, b) => a.kaynakSandikIcerikId - b.kaynakSandikIcerikId),
    };
    const parmakIzi = JSON.stringify(payload);
    // Başarısız/ağ yanıtından sonraki aynı isteğin anahtarı korunur; değişen miktar/hedef yeni iştir.
    if (this.sonIstek?.parmakIzi !== parmakIzi) {
      this.sonIstek = { parmakIzi, anahtar: crypto.randomUUID() };
    }
    const request: SandikUrunleriTopluTasiDto = { ...payload, islemAnahtari: this.sonIstek.anahtar };
    this.saving.set(true);
    this.service.urunleriTopluTasi(request).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.saving.set(false)),
    ).subscribe({
      next: result => {
        if (result.isSuccess) this.moved.emit();
        else this.error.set(result.error || this.ts.translate('BULK_CRATE_MOVE.FAILED'));
      },
      error: () => this.error.set(this.ts.translate('BULK_CRATE_MOVE.NETWORK_ERROR')),
    });
  }
}
