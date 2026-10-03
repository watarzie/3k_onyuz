import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  title?: string;
  /** HTML olarak işlenir; kullanıcıdan ya da sunucudan gelen metin duzMetin() ile eklenir. */
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info' | 'success';
  /** Verilirse pencerede gerekçe alanı gösterilir (askWithReason). */
  reason?: { label: string; hint?: string };
}

const HTML_KARSILIKLARI: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Değeri onay mesajına düz metin olarak ekler: HTML özel karakterleri kaçışlanır, metin yazıldığı gibi görünür. */
export function duzMetin(deger: string | number | null | undefined): string {
  return String(deger ?? '').replace(/[&<>"']/g, karakter => HTML_KARSILIKLARI[karakter]);
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
  /** Gerekçe alanının değeri (askWithReason). */
  readonly reasonValue = signal('');

  private resolveFn?: (value: boolean) => void;

  /**
   * Onay ve gerekçeyi birlikte ister: onaylanırsa kırpılmış gerekçe (boş olabilir), vazgeçilirse null döner.
   * Gerekçenin zorunlu olup olmadığına sunucu karar verir (ör. formlu kayıtta kritik değişiklik).
   */
  async askWithReason(opts: ConfirmOptions & { reason: { label: string; hint?: string } }): Promise<string | null> {
    this.reasonValue.set('');
    const onay = await this.ask(opts);
    return onay ? this.reasonValue().trim() : null;
  }

  ask(opts: ConfirmOptions): Promise<boolean> {
    if (!opts.reason) this.reasonValue.set('');
    this.options.set({
      title: opts.title ?? 'Onay',
      message: opts.message,
      confirmText: opts.confirmText ?? 'Evet',
      cancelText: opts.cancelText ?? 'İptal',
      type: opts.type ?? 'danger',
      reason: opts.reason,
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
