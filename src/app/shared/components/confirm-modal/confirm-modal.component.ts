import { Component, inject } from '@angular/core';
import { ConfirmService } from '../../../core/services/confirm.service';

/**
 * Generic Onay Modal — browser confirm() yerini alır.
 * MainLayout'ta tek sefer eklenir, ConfirmService ile tetiklenir.
 * Trezo diyalog dili: ortada türüne göre renkli halkalı ikon, başlık ve mesaj; onay düğmesi türün rengini taşır.
 */
@Component({
  selector: 'app-confirm-modal',
  standalone: true,
  template: `
    @if (confirm.visible()) {
      <div class="confirm-overlay" (click)="confirm.cancel()"></div>
      <div class="confirm-modal" role="dialog" aria-modal="true" [attr.aria-label]="confirm.options().title" [attr.data-type]="tur()">
        <button type="button" class="btn-close-confirm" (click)="confirm.cancel()" aria-label="Kapat">
          <i class="ri-close-line"></i>
        </button>
        <div class="confirm-head">
          <span class="confirm-icon" aria-hidden="true">
            @switch (tur()) {
              @case ('danger') { <i class="ri-delete-bin-6-line"></i> }
              @case ('warning') { <i class="ri-error-warning-line"></i> }
              @case ('success') { <i class="ri-checkbox-circle-line"></i> }
              @default { <i class="ri-question-line"></i> }
            }
          </span>
          <h5>{{ confirm.options().title }}</h5>
        </div>
        <div class="confirm-body">
          <div class="confirm-message" [innerHTML]="confirm.options().message"></div>
          @if (confirm.options().reason; as reason) {
            <label class="confirm-reason">
              <span>{{ reason.label }}</span>
              <textarea rows="3" maxlength="1000" [value]="confirm.reasonValue()"
                (input)="confirm.reasonValue.set($any($event.target).value)"></textarea>
              @if (reason.hint) { <small>{{ reason.hint }}</small> }
            </label>
          }
        </div>
        <div class="confirm-footer">
          @if (confirm.options().cancelText) {
            <button type="button" class="btn-cancel" (click)="confirm.cancel()">
              {{ confirm.options().cancelText }}
            </button>
          }
          <button type="button" class="btn-confirm" (click)="confirm.confirm()">
            {{ confirm.options().confirmText }}
          </button>
        </div>
      </div>
    }
  `,
  styles: [`
    .confirm-overlay {
      position: fixed; inset: 0;
      background: rgba(15, 23, 42, .48);
      backdrop-filter: blur(3px);
      z-index: 999998;
      animation: confirmFade .18s ease;
    }
    .confirm-modal {
      --ton: var(--primaryColor, #605dff);
      --ton-soft: color-mix(in srgb, var(--ton) 12%, #fff);
      position: fixed;
      top: 50%; left: 50%;
      width: 440px;
      max-width: calc(100vw - 32px);
      max-height: calc(100vh - 32px);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transform: translate(-50%, -50%);
      border-radius: 18px;
      background: #fff;
      box-shadow: 0 30px 80px -20px rgba(15, 23, 42, .45), 0 0 0 1px rgba(15, 23, 42, .04);
      z-index: 999999;
      animation: confirmIn .22s cubic-bezier(.2, .7, .2, 1);
    }
    .confirm-modal[data-type='danger'] { --ton: #e5372a; }
    .confirm-modal[data-type='warning'] { --ton: #e8890c; }
    .confirm-modal[data-type='success'] { --ton: #1e9a3a; }
    .btn-close-confirm {
      position: absolute; top: 14px; right: 14px;
      display: grid; place-items: center;
      width: 32px; height: 32px;
      border: 0; border-radius: 9px;
      background: transparent; color: #94a3b8;
      cursor: pointer;
      transition: background .15s ease, color .15s ease;
      i { font-size: 19px; }
      &:hover { background: #f1f5f9; color: #334155; }
    }
    .confirm-head {
      display: flex; flex-direction: column; align-items: center;
      gap: 14px;
      padding: 30px 28px 6px;
      text-align: center;
      h5 { margin: 0; color: var(--blackColor, #1e293b); font-size: 18px; font-weight: 700; letter-spacing: -.01em; }
    }
    .confirm-icon {
      display: grid; place-items: center;
      width: 56px; height: 56px;
      border-radius: 50%;
      background: var(--ton-soft);
      color: var(--ton);
      font-size: 26px;
      box-shadow: 0 0 0 8px color-mix(in srgb, var(--ton) 6%, #fff);
    }
    .confirm-body {
      padding: 10px 28px 22px;
      overflow-y: auto;
      text-align: center;
      &::-webkit-scrollbar { width: 6px; }
      &::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
    }
    .confirm-message {
      color: #64748b; font-size: 14.5px; line-height: 1.6;
      ::ng-deep p { margin: 0; color: #64748b; font-size: 14.5px; line-height: 1.6; }
      ::ng-deep strong, ::ng-deep b { color: #334155; }
    }
    .confirm-reason {
      display: flex; flex-direction: column; gap: 6px;
      margin-top: 18px;
      text-align: left;
      color: #475569; font-size: 12.5px; font-weight: 600;
      textarea {
        width: 100%; padding: 10px 12px;
        border: 1px solid var(--borderColor, #e2e8f0); border-radius: 10px;
        background: #f8fafc;
        font-size: 13.5px; font-weight: 400; resize: vertical;
        outline: 0;
        transition: border-color .15s ease, box-shadow .15s ease, background .15s ease;
        &:focus { border-color: var(--ton); background: #fff; box-shadow: 0 0 0 3px color-mix(in srgb, var(--ton) 14%, transparent); }
      }
      small { font-weight: 400; color: #94a3b8; }
    }
    .confirm-footer {
      display: flex; gap: 10px;
      padding: 16px 24px 22px;
      > button { flex: 1 1 0; }
    }
    .btn-cancel,
    .btn-confirm {
      min-height: 44px;
      padding: 0 18px;
      border-radius: 11px;
      font-size: 14px; font-weight: 600;
      cursor: pointer;
      transition: background .15s ease, border-color .15s ease, box-shadow .15s ease, filter .15s ease;
    }
    .btn-cancel {
      border: 1px solid var(--borderColor, #e2e8f0);
      background: #fff; color: #334155;
      &:hover { background: #f8fafc; border-color: #cbd5e1; }
    }
    .btn-confirm {
      border: 1px solid var(--ton);
      background: var(--ton); color: #fff;
      box-shadow: 0 10px 22px -12px var(--ton);
      &:hover { filter: brightness(.94); }
    }
    @keyframes confirmFade { from { opacity: 0; } to { opacity: 1; } }
    @keyframes confirmIn {
      from { opacity: 0; transform: translate(-50%, -48%) scale(.96); }
      to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    }
    @media (prefers-reduced-motion: reduce) {
      .confirm-overlay, .confirm-modal { animation: none; }
    }
  `],
})
export class ConfirmModalComponent {
  confirm = inject(ConfirmService);
  /** Tür verilmezse eski davranışla "danger" kabul edilir. */
  tur(): string {
    return this.confirm.options().type || 'danger';
  }
}
