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
  styles: [`
    .badge { font-size: 12px; padding: 4px 10px; border-radius: 4px; font-weight: 500; }
    .badge-success { background: rgba(37,176,3,.15); color: #25B003; }
    .badge-danger { background: rgba(255,64,35,.15); color: #FF4023; }
    .badge-warning { background: rgba(255,193,7,.15); color: #e6a800; }
    .badge-info { background: rgba(53,132,252,.15); color: #3584FC; }
    .badge-secondary { background: rgba(100,116,139,.15); color: #64748B; }
    .badge-purple { background: rgba(173,99,246,.15); color: #AD63F6; }
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
