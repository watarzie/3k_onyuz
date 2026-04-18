import { Directive, inject, TemplateRef, ViewContainerRef, OnInit, OnDestroy, Input } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { PermissionService } from '../../core/services/permission.service';
import { effect, DestroyRef } from '@angular/core';

/**
 * Structural directive — Sadece W (yazma) yetkisi varken elementi gösterir.
 *
 * KULLANIM:
 *   <button *appCanWrite>Kaydet</button>
 *   <button *appCanWrite="'grid-modulu'">Özel kontrol</button>
 *
 * menuKod belirtilmezse → route data'dan otomatik alır.
 * menuKod belirtilirse → o menuKod'u kontrol eder.
 *
 * R (Read) yetkisinde element GÖRÜNMEz.
 * N (No access) sayfa zaten guard'da engellenir.
 */
@Directive({
  selector: '[appCanWrite]',
  standalone: true,
})
export class CanWriteDirective implements OnInit {
  private templateRef = inject(TemplateRef<any>);
  private viewContainer = inject(ViewContainerRef);
  private permissions = inject(PermissionService);
  private route = inject(ActivatedRoute);

  /** Opsiyonel: kontrol edilecek menuKod. Verilmezse route'tan alınır. */
  @Input('appCanWrite') menuKodOverride: string = '';

  private hasView = false;

  ngOnInit(): void {
    // Reactive check — permissions yüklendiğinde güncellenir
    const checkInterval = setInterval(() => {
      this.updateView();
      if (this.permissions.loaded()) {
        clearInterval(checkInterval);
      }
    }, 100);

    // İlk kontrol
    this.updateView();

    // 2 saniye sonra temizle (güvenlik için)
    setTimeout(() => clearInterval(checkInterval), 5000);
  }

  private updateView(): void {
    const menuKod = this.menuKodOverride || this.route.snapshot.data?.['menuKod'];
    if (!menuKod) {
      // menuKod yoksa her zaman göster
      if (!this.hasView) {
        this.viewContainer.createEmbeddedView(this.templateRef);
        this.hasView = true;
      }
      return;
    }

    const canWrite = this.permissions.canWrite(menuKod);

    if (canWrite && !this.hasView) {
      this.viewContainer.createEmbeddedView(this.templateRef);
      this.hasView = true;
    } else if (!canWrite && this.hasView) {
      this.viewContainer.clear();
      this.hasView = false;
    }
  }
}
