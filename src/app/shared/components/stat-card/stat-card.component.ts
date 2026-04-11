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
        <div>
          <h3 class="mb-0 fw-bold">{{ value() }}</h3>
          <span class="stat-label">{{ label() }}</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .stat-card {
      padding: 20px 24px;
      border-radius: 10px;
      transition: transform .2s ease;
      &:hover { transform: translateY(-2px); }
    }
    .stat-icon {
      width: 50px; height: 50px; border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      font-size: 22px;
    }
    .stat-label { font-size: 13px; opacity: .8; margin-top: 2px; }
    h3 { font-size: 28px; }
    .card-primary { background: linear-gradient(135deg, #605DFF 0%, #8B5CF6 100%); color: #fff; .stat-icon { background: rgba(255,255,255,.2); } }
    .card-success { background: linear-gradient(135deg, #25B003 0%, #34D399 100%); color: #fff; .stat-icon { background: rgba(255,255,255,.2); } }
    .card-info { background: linear-gradient(135deg, #3584FC 0%, #60A5FA 100%); color: #fff; .stat-icon { background: rgba(255,255,255,.2); } }
    .card-danger { background: linear-gradient(135deg, #FF4023 0%, #F87171 100%); color: #fff; .stat-icon { background: rgba(255,255,255,.2); } }
    .card-warning { background: linear-gradient(135deg, #FD5812 0%, #FBBF24 100%); color: #fff; .stat-icon { background: rgba(255,255,255,.2); } }
    .card-secondary { background: linear-gradient(135deg, #64748B 0%, #94A3B8 100%); color: #fff; .stat-icon { background: rgba(255,255,255,.2); } }
  `],
})
export class StatCardComponent {
  value = input.required<string | number>();
  label = input.required<string>();
  icon = input<string>('ri-folder-line');
  color = input<'primary' | 'success' | 'info' | 'danger' | 'warning' | 'secondary'>('primary');

  colorClass = () => `card-${this.color()}`;
}
