import { Component, inject, computed, Input } from '@angular/core';
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
      background: #FFF3E0;
      color: #E65100;
      font-size: 13px;
      font-weight: 600;
      border: 1px solid #FFE0B2;
      i { font-size: 16px; }
    }
  `],
})
export class ReadOnlyBannerComponent {
  private permissions = inject(PermissionService);
  private route = inject(ActivatedRoute);

  /** Opsiyonel: kontrol edilecek menuKod. Verilmezse route'tan alınır. */
  @Input() menuKod: string = '';

  isReadOnly = computed(() => {
    const kod = this.menuKod || this.route.snapshot.data?.['menuKod'] || '';
    if (!kod) return false;
    return this.permissions.isReadOnly(kod);
  });
}
