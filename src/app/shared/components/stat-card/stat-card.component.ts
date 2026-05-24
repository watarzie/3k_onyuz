import { Component, input } from '@angular/core';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [NgClass],
  template: `
    <div class="trezo-card stat-card border-0 shadow-none" [ngClass]="colorClass()">
      <div class="d-flex align-items-center gap-3">
        <div class="stat-icon">
          <i [class]="icon()"></i>
        </div>
        @if (loading()) {
          <div class="stat-skeleton" aria-hidden="true">
            <span class="stat-skeleton-number"></span>
            <span class="stat-skeleton-label"></span>
          </div>
        } @else {
          <div>
            <h3 class="mb-0 fw-bold">{{ value() }}</h3>
            <span class="stat-label">{{ label() }}</span>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      min-width: 0;
      height: 100%;
    }
    .stat-card {
      padding: 20px 24px;
      border-radius: 10px;
      transition: transform .2s ease;
      min-height: 96px;
      height: 100%;
      &:hover { transform: translateY(-2px); }
      > .d-flex { min-width: 0; }
    }
    .stat-icon {
      width: 50px; height: 50px; border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      font-size: 22px;
      flex: 0 0 50px;
    }
    .stat-label {
      display: block;
      font-size: 13px;
      line-height: 1.25;
      opacity: .8;
      margin-top: 2px;
      overflow-wrap: anywhere;
    }
    h3 { font-size: clamp(22px, 2.4vw, 28px); line-height: 1.1; overflow-wrap: anywhere; }
    .stat-skeleton {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 120px;
    }
    .stat-skeleton-number,
    .stat-skeleton-label {
      display: block;
      border-radius: 999px;
      background: linear-gradient(90deg, rgba(255,255,255,.22), rgba(255,255,255,.48), rgba(255,255,255,.22));
      background-size: 220% 100%;
      animation: stat-skeleton-shimmer 1.15s ease-in-out infinite;
    }
    .stat-skeleton-number {
      width: 58px;
      height: 26px;
    }
    .stat-skeleton-label {
      width: 112px;
      height: 12px;
    }
    @keyframes stat-skeleton-shimmer {
      0% { background-position: 120% 0; }
      100% { background-position: -120% 0; }
    }
    .card-primary { background: linear-gradient(135deg, #605DFF 0%, #8B5CF6 100%); color: #fff; .stat-icon { background: rgba(255,255,255,.2); } }
    .card-success { background: linear-gradient(135deg, #25B003 0%, #34D399 100%); color: #fff; .stat-icon { background: rgba(255,255,255,.2); } }
    .card-info { background: linear-gradient(135deg, #3584FC 0%, #60A5FA 100%); color: #fff; .stat-icon { background: rgba(255,255,255,.2); } }
    .card-danger { background: linear-gradient(135deg, #FF4023 0%, #F87171 100%); color: #fff; .stat-icon { background: rgba(255,255,255,.2); } }
    .card-warning { background: linear-gradient(135deg, #FD5812 0%, #FBBF24 100%); color: #fff; .stat-icon { background: rgba(255,255,255,.2); } }
    .card-secondary { background: linear-gradient(135deg, #64748B 0%, #94A3B8 100%); color: #fff; .stat-icon { background: rgba(255,255,255,.2); } }
    @media (max-width: 575.98px) {
      .stat-card {
        padding: 14px 16px;
        min-height: 84px;
      }
      .stat-icon {
        width: 42px;
        height: 42px;
        flex-basis: 42px;
        font-size: 19px;
      }
      .stat-label { font-size: 12px; }
    }
  `],
})
export class StatCardComponent {
  value = input.required<string | number>();
  label = input.required<string>();
  icon = input<string>('ri-folder-line');
  color = input<'primary' | 'success' | 'info' | 'danger' | 'warning' | 'secondary'>('primary');
  loading = input(false);

  colorClass = () => `card-${this.color()}`;
}
