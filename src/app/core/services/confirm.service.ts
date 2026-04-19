import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info' | 'success';
}

/**
 * Generic Onay Modal Servisi — confirm() yerine kullanılır.
 *
 * KULLANIM:
 *   const onay = await this.confirm.ask({
 *     message: '"Ömer Akkaya" kullanıcısını silmek istediğinize emin misiniz?',
 *     type: 'danger'
 *   });
 *   if (onay) { ... sil ... }
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly visible = signal(false);
  readonly options = signal<ConfirmOptions>({ message: '' });

  private resolveFn?: (value: boolean) => void;

  ask(opts: ConfirmOptions): Promise<boolean> {
    this.options.set({
      title: opts.title ?? 'Onay',
      message: opts.message,
      confirmText: opts.confirmText ?? 'Evet',
      cancelText: opts.cancelText ?? 'İptal',
      type: opts.type ?? 'danger',
    });
    this.visible.set(true);
    return new Promise<boolean>((resolve) => {
      this.resolveFn = resolve;
    });
  }

  confirm(): void {
    this.visible.set(false);
    this.resolveFn?.(true);
    this.resolveFn = undefined;
  }

  cancel(): void {
    this.visible.set(false);
    this.resolveFn?.(false);
    this.resolveFn = undefined;
  }
}
