import { Component, inject } from '@angular/core';
import { NgClass } from '@angular/common';
import { ToastService } from '../../../core/services/toast.service';

/**
 * Bildirim kartı: gradyan yerine beyaz kart, 1px sıcak kenar, solda 4px ton şeridi ve yumuşak zeminli ikon çipi.
 * Yüzen öğe olduğu için büyük gölgeyi taşır; tonlar global --k-* semantik token'larıdır.
 */
@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [NgClass],
  template: `
    <div class="toast-wrapper">
      @for (toast of toastService.toasts(); track toast.id) {
        <div class="toast-item" [ngClass]="toast.type">
          <div class="toast-icon">
            @switch (toast.type) {
              @case ('success') { <i class="ri-checkbox-circle-line"></i> }
              @case ('error') { <i class="ri-error-warning-line"></i> }
              @case ('warning') { <i class="ri-alert-line"></i> }
              @case ('info') { <i class="ri-information-line"></i> }
            }
          </div>
          <span class="toast-message">{{ toast.message }}</span>
          <button class="toast-close" (click)="toastService.dismiss(toast.id)" aria-label="Kapat">
            <i class="ri-close-line"></i>
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .toast-wrapper {
      position: fixed;
      bottom: 24px;
      right: 24px;
      display: flex;
      flex-direction: column-reverse;
      gap: 10px;
      z-index: 99999;
      pointer-events: none;
    }
    .toast-item {
      --ton: var(--k-info);
      pointer-events: all;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 12px 12px 14px;
      border: 1px solid var(--k-line);
      border-left: 4px solid var(--ton);
      border-radius: 12px;
      min-width: 300px;
      max-width: 450px;
      background: #fff;
      color: var(--k-ink);
      box-shadow: var(--k-shadow-lg);
      animation: slideIn .22s var(--k-ease);
      font-size: 13.5px;
      line-height: 1.45;
    }
    .toast-icon {
      display: grid;
      place-items: center;
      flex: 0 0 34px;
      width: 34px;
      height: 34px;
      border-radius: 10px;
      background: color-mix(in srgb, var(--ton) 10%, #fff);
      color: var(--ton);
      i { font-size: 19px; }
    }
    .toast-message { flex: 1; overflow-wrap: anywhere; }
    .toast-close {
      display: grid;
      place-items: center;
      width: 28px;
      height: 28px;
      background: transparent;
      border: none;
      border-radius: 8px;
      color: var(--k-faint);
      font-size: 17px;
      cursor: pointer;
      padding: 0;
      transition: background .15s var(--k-ease), color .15s var(--k-ease);
      &:hover { background: var(--k-paper); color: var(--k-ink-2); }
    }
    .toast-item.success { --ton: var(--k-success); }
    .toast-item.error   { --ton: var(--k-danger); }
    .toast-item.warning { --ton: var(--k-warning); }
    .toast-item.info    { --ton: var(--k-info); }

    @keyframes slideIn {
      from { opacity: 0; transform: translateX(40px); }
      to   { opacity: 1; transform: translateX(0); }
    }
    @media (prefers-reduced-motion: reduce) {
      .toast-item { animation: none; }
    }
    @media (max-width: 575.98px) {
      .toast-wrapper { left: 12px; right: 12px; bottom: 12px; }
      .toast-item { min-width: 0; max-width: none; }
    }
  `],
})
export class ToastComponent {
  toastService = inject(ToastService);
}
