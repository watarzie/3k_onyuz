import { Component, input } from '@angular/core';

/**
 * Trezo KPI kartı: beyaz zemin, solda etiket ve büyük sayı, sağda renkli yuvarlak ikon. Renk yalnız ikonda ve
 * alt çizgidedir; sayfanın bütün özet kartları aynı dili konuşur (finans paneli KPI kartlarıyla aynı).
 */
@Component({
  selector: 'app-stat-card',
  standalone: true,
  template: `
    <div class="trezo-card stat-card" [attr.data-ton]="color()">
      @if (loading()) {
        <div class="stat-skeleton" aria-hidden="true">
          <span class="stat-skeleton-label"></span>
          <span class="stat-skeleton-number"></span>
        </div>
      } @else {
        <div class="stat-text">
          <span class="stat-label">{{ label() }}@if (hint()) {
              <i class="ri-information-line stat-hint" [title]="hint()" [attr.aria-label]="hint()"></i>
            }</span>
          <h3 class="stat-value">{{ value() }}</h3>
        </div>
      }
      <span class="stat-icon" aria-hidden="true"><i [class]="icon()"></i></span>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      min-width: 0;
      height: 100%;
    }
    .stat-card {
      --ton: #605dff;
      --ton-soft: #ecf0ff;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      min-height: 100px;
      height: 100%;
      padding: 20px 22px;
      overflow: hidden;
      border: 1px solid var(--borderColor, #eceef2);
      border-radius: 12px;
      background: var(--whiteColor, #fff);
      transition: border-color .18s ease, box-shadow .18s ease;
      &::after {
        content: '';
        position: absolute;
        left: 22px;
        right: 22px;
        bottom: 0;
        height: 3px;
        border-radius: 3px 3px 0 0;
        background: var(--ton);
        opacity: .85;
      }
      &:hover {
        border-color: color-mix(in srgb, var(--ton) 30%, var(--borderColor, #eceef2));
        box-shadow: 0 10px 28px -18px rgba(23, 43, 77, .35);
      }
    }
    .stat-card[data-ton='success'] { --ton: #25b003; --ton-soft: #eeffe5; }
    .stat-card[data-ton='info'] { --ton: #3584fc; --ton-soft: #e9f3ff; }
    .stat-card[data-ton='danger'] { --ton: #ff4023; --ton-soft: #ffe8e4; }
    .stat-card[data-ton='warning'] { --ton: #fd5812; --ton-soft: #fff5ed; }
    .stat-card[data-ton='secondary'] { --ton: #64748b; --ton-soft: #f1f5f9; }
    .stat-text { min-width: 0; }
    .stat-label {
      display: block;
      color: var(--bodyColor, #64748b);
      font-size: 13px;
      font-weight: 500;
      line-height: 1.3;
      overflow-wrap: anywhere;
    }
    .stat-value {
      margin: 6px 0 0;
      color: var(--blackColor, #3a4252);
      font-size: clamp(22px, 2.2vw, 28px);
      font-weight: 700;
      line-height: 1.1;
      letter-spacing: -.02em;
      font-variant-numeric: tabular-nums;
      overflow-wrap: anywhere;
    }
    .stat-hint { margin-left: 4px; font-size: 13px; cursor: help; color: #94a3b8; }
    .stat-icon {
      display: grid;
      place-items: center;
      flex: 0 0 52px;
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: var(--ton-soft);
      color: var(--ton);
      font-size: 23px;
    }
    .stat-skeleton {
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-width: 110px;
    }
    .stat-skeleton-number,
    .stat-skeleton-label {
      display: block;
      border-radius: 999px;
      background: linear-gradient(90deg, #eef1f5, #f8f9fb, #eef1f5);
      background-size: 220% 100%;
      animation: stat-skeleton-shimmer 1.15s ease-in-out infinite;
    }
    .stat-skeleton-label { width: 96px; height: 11px; }
    .stat-skeleton-number { width: 56px; height: 24px; }
    @keyframes stat-skeleton-shimmer {
      0% { background-position: 120% 0; }
      100% { background-position: -120% 0; }
    }
    @media (max-width: 575.98px) {
      .stat-card { min-height: 86px; padding: 14px 16px; }
      .stat-card::after { left: 16px; right: 16px; }
      .stat-icon { flex-basis: 42px; width: 42px; height: 42px; font-size: 19px; }
      .stat-label { font-size: 12px; }
    }
    @media (prefers-reduced-motion: reduce) {
      .stat-skeleton-number, .stat-skeleton-label { animation: none; }
    }
  `],
})
export class StatCardComponent {
  value = input.required<string | number>();
  label = input.required<string>();
  icon = input<string>('ri-folder-line');
  color = input<'primary' | 'success' | 'info' | 'danger' | 'warning' | 'secondary'>('primary');
  loading = input(false);
  /** Kartın içinde bilgi simgesiyle gösterilen açıklama; kart boyutunu değiştirmez. */
  hint = input('');
}
