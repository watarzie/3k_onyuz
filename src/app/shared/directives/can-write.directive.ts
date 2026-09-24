import { Directive, Input, effect, inject, signal, TemplateRef, ViewContainerRef } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { PermissionService } from '../../core/services/permission.service';

/** Yazma izni kaldırıldığında mevcut view da kaldırılır. Eksik bağlam erişim vermez. */
@Directive({ selector: '[appCanWrite]', standalone: true })
export class CanWriteDirective {
  private templateRef = inject(TemplateRef<unknown>);
  private viewContainer = inject(ViewContainerRef);
  private permissions = inject(PermissionService);
  private route = inject(ActivatedRoute);
  private routeData = toSignal(this.route.data, { initialValue: this.route.snapshot.data });
  private override = signal('');

  @Input('appCanWrite')
  set menuKodOverride(value: string | null | undefined) {
    this.override.set(value?.trim() ?? '');
  }

  private hasView = false;

  constructor() {
    // effect ve route aboneliği directive yok edildiğinde Angular tarafından temizlenir.
    effect(() => {
      const code = this.override() || this.routeData()?.['menuKod'];
      const allowed = this.permissions.loaded() && typeof code === 'string' &&
        code.trim().length > 0 && this.permissions.canWrite(code);
      if (allowed && !this.hasView) {
        this.viewContainer.createEmbeddedView(this.templateRef);
        this.hasView = true;
      } else if (!allowed && this.hasView) {
        this.viewContainer.clear();
        this.hasView = false;
      }
    });
  }
}
