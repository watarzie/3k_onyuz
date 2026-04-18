import { Component, inject } from '@angular/core';
import { ConfirmService } from '../../../core/services/confirm.service';
import { NgClass } from '@angular/common';

/**
 * Generic Onay Modal — browser confirm() yerini alır.
 * MainLayout'ta tek sefer eklenir, ConfirmService ile tetiklenir.
 */
@Component({
  selector: 'app-confirm-modal',
  standalone: true,
  imports: [NgClass],
  template: `
    @if (confirm.visible()) {
      <div class="confirm-overlay" (click)="confirm.cancel()"></div>
      <div class="confirm-modal">
        <div class="confirm-header">
          <div class="d-flex align-items-center gap-2">
            <div class="confirm-icon" [ngClass]="confirm.options().type || 'danger'">
              @switch (confirm.options().type) {
                @case ('danger')  { <i class="ri-delete-bin-line"></i> }
                @case ('warning') { <i class="ri-alert-line"></i> }
                @default          { <i class="ri-question-line"></i> }
              }
            </div>
            <h5 class="mb-0 fw-semibold">{{ confirm.options().title }}</h5>
          </div>
          <button class="btn-close-confirm" (click)="confirm.cancel()">
            <i class="ri-close-line"></i>
          </button>
        </div>
        <div class="confirm-body">
          <div [innerHTML]="confirm.options().message"></div>
        </div>
        <div class="confirm-footer">
          <button class="btn-cancel" (click)="confirm.cancel()">
            {{ confirm.options().cancelText }}
          </button>
          <button class="btn-confirm" [ngClass]="confirm.options().type || 'danger'" (click)="confirm.confirm()">
            {{ confirm.options().confirmText }}
          </button>
        </div>
      </div>
    }
  `,
  styles: [`
    .confirm-overlay {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.45);
      z-index: 999998;
    }
    .confirm-modal {
      position: fixed;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      background: #fff;
      border-radius: 12px;
      width: 420px;
      max-width: 90vw;
      box-shadow: 0 16px 48px rgba(0,0,0,0.2);
      z-index: 999999;
      animation: fadeIn .2s ease;
    }
    .confirm-header {
      display: flex; align-items: center;
      justify-content: space-between;
      padding: 18px 24px;
      border-bottom: 1px solid #eef0f3;
    }
    .confirm-icon {
      width: 36px; height: 36px;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      background: rgba(var(--bs-primary-rgb), 0.1); 
      color: var(--bs-primary);
      i { font-size: 18px; }
    }
    .btn-close-confirm {
      border: none; background: transparent; cursor: pointer;
      i { font-size: 20px; color: #6c757d; }
      &:hover i { color: #1a2035; }
    }
    .confirm-body {
      padding: 20px 24px;
      max-height: 480px;
      overflow-y: auto;
      
      /* Webkit Custom Scrollbar for better UI */
      &::-webkit-scrollbar { width: 6px; }
      &::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 4px; }
      &::-webkit-scrollbar-thumb { background: #c1c1c1; border-radius: 4px; }
      &::-webkit-scrollbar-thumb:hover { background: #a8a8a8; }
      
      p { margin: 0; font-size: 15px; color: #495057; line-height: 1.6; }
    }
    .confirm-footer {
      display: flex; justify-content: flex-end; gap: 10px;
      padding: 16px 24px;
      border-top: 1px solid #eef0f3;
    }
    .btn-cancel {
      padding: 8px 20px;
      background: #f1f3f5; border: none; border-radius: 6px;
      color: #495057; font-size: 14px; cursor: pointer;
      &:hover { background: #e9ecef; }
    }
    .btn-confirm {
      padding: 8px 24px;
      background: var(--bs-primary);
      color: #fff; border: none; border-radius: 6px;
      font-size: 14px; font-weight: 500; cursor: pointer;
      &:hover { filter: brightness(0.9); }
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translate(-50%, -50%) scale(0.95); }
      to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    }
  `],
})
export class ConfirmModalComponent {
  confirm = inject(ConfirmService);
}
