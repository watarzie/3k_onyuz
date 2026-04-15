import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-breadcrumb',
  standalone: true,
  imports: [RouterLink],
  template: `
    <nav aria-label="breadcrumb">
      <ol class="breadcrumb mb-0">
        @for (item of items(); track $index) {
          @if ($last) {
            <li class="breadcrumb-item active">{{ item.label }}</li>
          } @else {
            <li class="breadcrumb-item"><a [routerLink]="item.link">{{ item.label }}</a></li>
          }
        }
      </ol>
    </nav>
  `,
  styles: [`
    .breadcrumb { font-size: 13px; }
    .breadcrumb-item a { color: var(--bodyColor); text-decoration: none; }
    .breadcrumb-item a:hover { color: var(--primaryColor); }
    .breadcrumb-item.active { color: var(--bodyColor); opacity: .7; }
  `],
})
export class BreadcrumbComponent {
  items = input.required<{ label: string; link?: string }[]>();
}
