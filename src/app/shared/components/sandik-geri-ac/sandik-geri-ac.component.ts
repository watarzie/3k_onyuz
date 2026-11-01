import { ChangeDetectionStrategy, Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LookupService } from '../../../core/services/lookup.service';
import { ProjeService } from '../../../core/services/proje.service';
import { ToastService } from '../../../core/services/toast.service';
import { LookupItem } from '../../models/lookup.model';
import { SANDIK_ACMA_NOTU_EN_FAZLA } from '../../models/sandik-durum.model';

/**
 * Kapalı sandığı "Hazırlanıyor"a geri alma penceresi. Sebep zorunludur (sunucudaki LookupSandikAcilmaSebepleri:
 * Trafo kurulum, Tadilat…), not isteğe bağlıdır; sunucu aynı kuralı ayrıca uygular. Başarıda `tamamlandi` yayılır.
 */
@Component({
  selector: 'app-sandik-geri-ac',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tz-modal-backdrop" (click)="vazgec()"></div>
    <div class="tz-modal tz-modal--sm" data-ton="warning" role="dialog" aria-modal="true" aria-labelledby="sandik-geri-ac-baslik">
      <div class="tz-modal__header">
        <span class="tz-modal__icon" aria-hidden="true"><i class="ri-arrow-go-back-line"></i></span>
        <div class="tz-modal__title">
          <h5 id="sandik-geri-ac-baslik">Sandığı Geri Aç</h5>
          <p>Sandık {{ sandikNo() }} "Hazırlanıyor" durumuna alınacak.</p>
        </div>
        <button type="button" class="tz-modal__close" (click)="vazgec()" [disabled]="kaydediliyor()" aria-label="Kapat">
          <i class="ri-close-line"></i>
        </button>
      </div>
      <div class="tz-modal__body">
        <label class="tz-field">
          <span>Geri açma sebebi <b>*</b></span>
          <select class="form-select sga-sebep" [ngModel]="sebepId()" (ngModelChange)="sebepId.set(+$event || null)">
            <option [ngValue]="null" disabled>Sebep seçin</option>
            @for (s of sebepler(); track s.id) {
              <option [ngValue]="s.id">{{ s.deger }}</option>
            }
          </select>
        </label>
        <label class="tz-field mt-3">
          <span>Not <small class="text-muted">(isteğe bağlı)</small></span>
          <textarea class="form-control sga-not" rows="3" [maxlength]="NOT_EN_FAZLA" [ngModel]="not()"
            (ngModelChange)="not.set($event)" placeholder="Ör. trafo sahada kuruldu, kapak değişti"></textarea>
          <small class="text-muted">{{ not().length }} / {{ NOT_EN_FAZLA }}</small>
        </label>
      </div>
      <div class="tz-modal__footer">
        <button type="button" class="tz-btn" (click)="vazgec()" [disabled]="kaydediliyor()">Vazgeç</button>
        <button type="button" class="tz-btn tz-btn--primary sga-onayla" (click)="onayla()" [disabled]="kaydediliyor() || !sebepId()">
          @if (kaydediliyor()) { <span class="spinner-border spinner-border-sm"></span> } @else { <i class="ri-arrow-go-back-line"></i> }
          Geri Aç
        </button>
      </div>
    </div>
  `,
})
export class SandikGeriAcComponent implements OnInit {
  private readonly lookupService = inject(LookupService);
  private readonly projeService = inject(ProjeService);
  private readonly toast = inject(ToastService);

  readonly NOT_EN_FAZLA = SANDIK_ACMA_NOTU_EN_FAZLA;
  readonly sandikId = input.required<number>();
  readonly sandikNo = input('');
  readonly kapat = output<void>();
  readonly tamamlandi = output<void>();

  readonly sebepler = signal<LookupItem[]>([]);
  readonly sebepId = signal<number | null>(null);
  readonly not = signal('');
  readonly kaydediliyor = signal(false);

  ngOnInit(): void {
    this.lookupService.getLookups(['LookupSandikAcilmaSebebi']).subscribe({
      next: data => this.sebepler.set(data['LookupSandikAcilmaSebebi'] ?? []),
      error: () => this.toast.error('Geri açma sebepleri yüklenemedi.'),
    });
  }

  vazgec(): void {
    if (!this.kaydediliyor()) this.kapat.emit();
  }

  onayla(): void {
    const sebepId = this.sebepId();
    if (!sebepId || this.kaydediliyor()) return;
    this.kaydediliyor.set(true);
    this.projeService.sandikKapat(this.sandikId(), false, sebepId, this.not().trim() || null).subscribe({
      next: res => {
        this.kaydediliyor.set(false);
        if (res.isSuccess) {
          this.toast.success('Sandık tekrar hazırlanıyor konumuna alındı.');
          this.tamamlandi.emit();
        } else {
          this.toast.error(res.error || 'İşlem başarısız oldu.');
        }
      },
      error: () => {
        this.kaydediliyor.set(false);
        this.toast.error('Beklenmeyen bir hata oluştu.');
      },
    });
  }
}
