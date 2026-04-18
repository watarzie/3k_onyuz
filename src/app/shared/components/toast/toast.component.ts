import { Component, inject } from '@angular/core';
import { NgClass } from '@angular/common';
import { ToastService } from '../../../core/services/toast.service';

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
          <button class="toast-close" (click)="toastService.dismiss(toast.id)">
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
      pointer-events: all;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      border-radius: 8px;
      min-width: 300px;
      max-width: 450px;
      color: #fff;
      box-shadow: 0 6px 20px rgba(0,0,0,0.15);
      animation: slideIn .3s ease;
      font-size: 14px;
    }
    .toast-icon i { font-size: 20px; }
    .toast-message { flex: 1; }
    .toast-close {
      background: transparent;
      border: none;
      color: rgba(255,255,255,0.7);
      font-size: 16px;
      cursor: pointer;
      padding: 0;
      &:hover { color: #fff; }
    }
    .toast-item.success { background: linear-gradient(135deg, #28a745, #20c997); }
    .toast-item.error   { background: linear-gradient(135deg, #dc3545, #e74c6f); }
    .toast-item.warning { background: linear-gradient(135deg, #ffc107, #fd7e14); color: #1a2035; }
    .toast-item.warning .toast-close { color: rgba(0,0,0,0.5); }
    .toast-item.info    { background: linear-gradient(135deg, #5a6acf, #7c8af5); }

    @keyframes slideIn {
      from { opacity: 0; transform: translateX(40px); }
      to   { opacity: 1; transform: translateX(0); }
    }
  `],
})
export class ToastComponent {
  toastService = inject(ToastService);
}
