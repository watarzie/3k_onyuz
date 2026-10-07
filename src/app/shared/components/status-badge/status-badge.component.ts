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
  // Yuvarlak rozet: başta durum renginde nokta, yumuşak zemin/rozet kalıbı (zemin %10, kenar %22, metin %85 ton).
  // Tonlar global --k-* semantik token'larıdır; hepsi beyaz üstünde AA kontrastı geçer.
  styles: [`
    .badge {
      --ton: var(--k-muted);
      display: inline-flex; align-items: center; gap: 6px;
      padding: 4px 10px 4px 8px; border: 1px solid color-mix(in srgb, var(--ton) 22%, transparent); border-radius: 999px;
      background: color-mix(in srgb, var(--ton) 10%, #fff); color: color-mix(in srgb, var(--ton) 85%, #000);
      font-size: 12px; font-weight: 650; line-height: 1.3; white-space: nowrap;
    }
    .badge::before {
      content: ''; width: 6px; height: 6px; border-radius: 50%; background: var(--ton);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--ton) 18%, transparent);
    }
    .badge-success { --ton: var(--k-success); }   /* tamamlandı, hazır, kapandı */
    .badge-danger { --ton: var(--k-danger); }     /* gelmedi, kayıp, iptal */
    .badge-warning { --ton: var(--k-warning); }   /* eksik geldi, hatalı */
    .badge-orange { --ton: var(--k-orange); }     /* kısmi / eksik sevk */
    .badge-info { --ton: var(--k-info); }         /* sevk edildi, devam ediyor */
    .badge-steel { --ton: var(--k-steel); }       /* bekliyor, rezerve */
    .badge-wood { --ton: var(--k-wood-3); }       /* atölyede hazırlanıyor, üretimde */
    .badge-purple { --ton: var(--k-purple); }     /* başka yere yönlendi, siparişte */
    .badge-dark { --ton: var(--k-ink-2); }        /* grid kapandı */
    .badge-secondary { --ton: var(--k-muted); }   /* boş, bilinmeyen */
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
