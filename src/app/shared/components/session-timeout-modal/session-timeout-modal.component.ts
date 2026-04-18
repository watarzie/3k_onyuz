import { Component, inject, computed } from '@angular/core';
import { SessionTimeoutService } from '../../../core/services/session-timeout.service';

/**
 * Session Timeout Modal — Geri sayım + progress bar ile oturum süresini gösterir.
 * MainLayout'ta gösterilir.
 */
@Component({
  selector: 'app-session-timeout-modal',
  standalone: true,
  template: `
    @if (timeout.showModal()) {
      <div class="session-overlay">
        <div class="session-modal">
          <div class="session-header">
            <h5>Oturum Süresi Doluyor</h5>
            <button class="btn-close-session" (click)="timeout.cancelSession()">
              <i class="ri-close-line"></i>
            </button>
          </div>
          <div class="session-body">
            <p class="session-text">
              Oturumunuzun otomatik sonlanmasına kalan süre:
              <strong class="countdown" [class.danger]="timeout.secondsRemaining() <= 10">
                {{ formattedTime() }}
              </strong>
            </p>
            <div class="progress-track">
              <div class="progress-fill"
                   [style.width.%]="progress()"
                   [class.danger]="timeout.secondsRemaining() <= 10">
              </div>
            </div>
          </div>
          <div class="session-footer">
            <button class="btn-session-cancel" (click)="timeout.cancelSession()">Oturumu Kapat</button>
            <button class="btn-session-continue" (click)="timeout.continueSession()">Oturuma Devam Et</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .session-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999999;
    }
    .session-modal {
      background: #fff;
      border-radius: 10px;
      width: 440px;
      box-shadow: 0 12px 40px rgba(0,0,0,0.25);
      overflow: hidden;
    }
    .session-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 18px 24px;
      border-bottom: 1px solid #eef0f3;
      h5 { margin: 0; font-weight: 600; font-size: 18px; color: #1a2035; }
    }
    .btn-close-session {
      border: none; background: transparent; cursor: pointer;
      i { font-size: 22px; color: #6c757d; }
      &:hover i { color: #1a2035; }
    }
    .session-body {
      padding: 28px 24px;
      text-align: center;
    }
    .session-text {
      font-size: 15px;
      color: #495057;
      margin-bottom: 20px;
    }
    .countdown {
      font-size: 20px;
      color: #dc3545;
      font-weight: 700;
      margin-left: 6px;
      &.danger { animation: pulse 1s ease infinite; }
    }
    .progress-track {
      height: 6px;
      background: #e9ecef;
      border-radius: 3px;
      overflow: hidden;
    }
    .progress-fill {
      height: 100%;
      background: #5a6acf;
      border-radius: 3px;
      transition: width 1s linear;
      &.danger { background: #dc3545; }
    }
    .session-footer {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding: 16px 24px;
      border-top: 1px solid #eef0f3;
    }
    .btn-session-cancel {
      padding: 8px 20px;
      background: #f1f3f5;
      border: none;
      border-radius: 6px;
      color: #495057;
      font-size: 14px;
      cursor: pointer;
      &:hover { background: #e9ecef; }
    }
    .btn-session-continue {
      padding: 8px 24px;
      background: #5a6acf;
      color: #fff;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      &:hover { background: #4a5ab8; }
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  `],
})
export class SessionTimeoutModalComponent {
  timeout = inject(SessionTimeoutService);

  formattedTime = computed(() => {
    const s = this.timeout.secondsRemaining();
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  });

  progress = computed(() => {
    return (this.timeout.secondsRemaining() / this.timeout.WARNING_SECONDS) * 100;
  });
}
