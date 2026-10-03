import { Component, input, computed } from '@angular/core';
import { NgClass } from '@angular/common';
import { STATUS_BADGE_MAP } from '../../../core/constants/enums';

/**
 * Status Badge Component — Metni bazlı renklendirme.
 *
 * Kullanım:
 *   <app-status-badge [status]="item.durumMetni" [label]="item.durumMetni" />
 *
 * status → CSS class'ını belirler (enums.ts'deki STATUS_BADGE_MAP, Enum Name ile eşleşir)
 * label  → Kullanıcıya gösterilecek metin
 */
@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [NgClass],
  template: `<span class="badge" [ngClass]="badgeClass()">{{ label() }}</span>`,
  // Yuvarlak rozet: başta durum renginde nokta, ince tonlu kenar.
  styles: [`
    .badge {
      --ton: #64748B;
      display: inline-flex; align-items: center; gap: 6px;
      padding: 4px 10px 4px 8px; border: 1px solid color-mix(in srgb, var(--ton) 22%, transparent); border-radius: 999px;
      background: color-mix(in srgb, var(--ton) 9%, #fff); color: color-mix(in srgb, var(--ton) 88%, #000);
      font-size: 12px; font-weight: 650; line-height: 1.3; white-space: nowrap;
    }
    .badge::before {
      content: ''; width: 6px; height: 6px; border-radius: 50%; background: var(--ton);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--ton) 18%, transparent);
    }
    .badge-success { --ton: #1e9a3a; }
    .badge-danger { --ton: #e5372a; }
    .badge-warning { --ton: #d48806; }
    .badge-info { --ton: #2f74e0; }
    .badge-secondary { --ton: #64748B; }
    .badge-purple { --ton: #9b4fe8; }
  `],
})
export class StatusBadgeComponent {
  /** Durum adı (Enum adı, backend *Metni alanından gelir). CSS class'ını belirler. */
  status = input.required<string>();
  /** Gösterilecek etiket metni (backend'den gelir). */
  label = input.required<string>();

  badgeClass = computed(() => {
    return STATUS_BADGE_MAP[this.status()] ?? 'badge-secondary';
  });
}
