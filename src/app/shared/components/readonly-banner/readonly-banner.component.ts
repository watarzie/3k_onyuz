import { Component, inject, computed, input } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { PermissionService } from '../../../core/services/permission.service';

/**
 * Otomatik Read-Only Banner — R yetkisi varsa gösterir.
 *
 * KULLANIM:
 *   <app-readonly-banner />                     ← route'tan menuKod alır
 *   <app-readonly-banner menuKod="grid-modulu" /> ← explicit menuKod
 */
@Component({
  selector: 'app-readonly-banner',
  standalone: true,
  template: `
    @if (isReadOnly()) {
      <span class="readonly-badge">
        <i class="ri-eye-line"></i>Sadece Okuma
      </span>
    }
  `,
  styles: [`
    .readonly-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 16px;
      border-radius: 6px;
      background: color-mix(in srgb, var(--k-orange) 10%, #fff);
      color: var(--k-orange);
      font-size: 13px;
      font-weight: 600;
      border: 1px solid color-mix(in srgb, var(--k-orange) 22%, #fff);
      i { font-size: 16px; }
    }
  `],
})
export class ReadOnlyBannerComponent {
  private permissions = inject(PermissionService);
  private route = inject(ActivatedRoute);

  /** Opsiyonel: kontrol edilecek menuKod. Verilmezse route'tan alınır. */
  readonly menuKod = input('');

  readonly isReadOnly = computed(() => {
    const kod = this.menuKod() || this.route.snapshot.data?.['menuKod'] || '';
    return !!kod && this.permissions.isReadOnly(kod);
  });
}
