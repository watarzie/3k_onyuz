import { Directive, TemplateRef, ViewContainerRef, effect, inject, input } from '@angular/core';
import { PermissionService } from '../../core/services/permission.service';

/** Tüm istenen okuma izinleri varsa render eder; izin iptali mevcut görünümü kaldırır. */
@Directive({ selector: '[appCanAccess]', standalone: true })
export class CanAccessDirective {
  readonly appCanAccess = input.required<readonly string[]>();
  private readonly permissions = inject(PermissionService);
  private readonly template = inject(TemplateRef<unknown>);
  private readonly container = inject(ViewContainerRef);
  private rendered = false;
  constructor() {
    effect(() => {
      const codes = this.appCanAccess();
      const allowed = codes.length > 0 && codes.every(code => !!code && this.permissions.hasAccess(code));
      if (allowed && !this.rendered) { this.container.createEmbeddedView(this.template); this.rendered = true; }
      if (!allowed && this.rendered) { this.container.clear(); this.rendered = false; }
    });
  }
}
