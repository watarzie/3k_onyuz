import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ToggleService {
  isSidebarToggled = signal(false);

  toggle(): void {
    this.isSidebarToggled.update((v) => !v);
  }
}
