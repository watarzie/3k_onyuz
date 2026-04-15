import { Directive, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { Router, NavigationEnd, Event } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { TranslationService } from '../../../core/services/translation.service';

/**
 * Tüm sayfa component'lerinin türetileceği abstract base directive.
 * Ortak lifecycle yönetimi, loading/error state'i, i18n ve navigation tracking sağlar.
 * befasoft-app referans mimarisinden adapte edildi.
 */
@Directive({
  standalone: true
})
export abstract class BasePageComponent implements OnInit, OnDestroy {

  protected destroyed$ = new Subject<void>();
  protected ts = inject(TranslationService);
  protected router = inject(Router);

  loading = signal<boolean>(false);
  error = signal<string | null>(null);

  constructor() {
    this.router.events
      .pipe(takeUntil(this.destroyed$))
      .subscribe((event: Event) => {
        if (event instanceof NavigationEnd) {
          this.onPageNavigation(event.urlAfterRedirects);
        }
      });
  }

  ngOnInit(): void {
    this.onInit();
  }

  ngOnDestroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();
    this.onDestroy();
  }

  /** Override edilebilir lifecycle hook'ları */
  protected onInit(): void { }
  protected onDestroy(): void { }
  protected onPageNavigation(_url: string): void { }

  protected setLoading(state: boolean): void {
    this.loading.set(state);
  }

  protected log(message: string): void {
    console.log(`[${this.constructor.name}] ${message}`);
  }

  protected handleError(error: unknown, userMessage?: string): void {
    console.error(`[${this.constructor.name}] Error:`, error);
    this.error.set(userMessage || 'Beklenmeyen bir hata oluştu.');
  }
}
