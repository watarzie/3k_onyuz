import { Component, input } from '@angular/core';

/**
 * KPI kartı ("Atölye" teması): beyaz zemin, solda etiket ve Sarabun 700 büyük sayı, sağda tonlu yuvarlak
 * ikon. Renk yalnız ikonda ve alt çizgidedir; sayfanın bütün özet kartları aynı dili konuşur (finans paneli KPI
 * kartlarıyla aynı). Tonlar global --k-* semantik token'larından gelir.
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
      --ton: var(--k-green);
      --ton-soft: color-mix(in srgb, var(--ton) 10%, #fff);
      position: relative;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      min-height: 100px;
      height: 100%;
      padding: 20px 22px;
      overflow: hidden;
      border: 1px solid var(--k-line);
      border-radius: var(--k-radius);
      background: var(--whiteColor, #fff);
      box-shadow: none;
      transition: border-color .15s var(--k-ease), box-shadow .15s var(--k-ease);
      &::after {
        content: '';
        position: absolute;
        left: 22px;
        right: 22px;
        bottom: 0;
        height: 3px;
        border-radius: 3px 3px 0 0;
        background: var(--ton);
        opacity: .9;
      }
      &:hover {
        border-color: color-mix(in srgb, var(--ton) 28%, var(--k-line));
        box-shadow: var(--k-shadow-sm);
      }
    }
    .stat-card[data-ton='success'] { --ton: var(--k-success); }
    .stat-card[data-ton='info'] { --ton: var(--k-info); }
    .stat-card[data-ton='danger'] { --ton: var(--k-danger); }
    .stat-card[data-ton='warning'] { --ton: var(--k-warning); }
    .stat-card[data-ton='secondary'] { --ton: var(--k-steel); }
    .stat-text { min-width: 0; }
    .stat-label {
      display: block;
      color: var(--k-muted);
      font-size: 12.5px;
      font-weight: 600;
      line-height: 1.3;
      overflow-wrap: anywhere;
    }
    // Sayı: Sarabun 700, eşit genişlikli rakam; sayı ortasından kırılmaz, dar kartta yazı küçülür.
    .stat-value {
      margin: 6px 0 0;
      color: var(--k-ink);
      font-family: var(--k-display);
      font-size: clamp(22px, 1.9vw, 28px);
      font-weight: 700;
      line-height: 1.1;
      letter-spacing: -.02em;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .stat-hint { margin-left: 4px; font-size: 13px; cursor: help; color: var(--k-faint); }
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
      background: linear-gradient(90deg, var(--k-paper-2), var(--k-paper), var(--k-paper-2));
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
      .stat-value { font-size: 24px; }
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
