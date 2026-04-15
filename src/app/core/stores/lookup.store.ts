import { Injectable, inject, signal, computed } from '@angular/core';
import { LookupService } from '../services/lookup.service';
import { LookupItem } from '../../shared/models/lookup.model';

/**
 * Signal tabanlı Lookup cache store.
 * Bir kez yüklenen lookup tekrar API'ye çağrı yapmaz.
 *
 * Kullanım:
 *   constructor() {
 *     this.lookupStore.loadLookups(['LookupProjeDurum', 'LookupSandikDurum']);
 *   }
 *
 *   projeDurumlari = this.lookupStore.get('LookupProjeDurum');
 *   // template'de: projeDurumlari()
 *
 *   label = this.lookupStore.getDeger('LookupProjeDurum', 1);
 *   // → "Devam"
 */
@Injectable({
  providedIn: 'root'
})
export class LookupStore {
  private lookupService = inject(LookupService);

  /** Tüm lookup verileri — key: entity adı, value: signal */
  private cache = new Map<string, ReturnType<typeof signal<LookupItem[]>>>();

  /** Yükleniyor durumu */
  loading = signal(false);

  /**
   * İstenen lookup'ları yükler.
   * Zaten cache'de olanları atlar, sadece yenileri çeker.
   */
  loadLookups(entities: string[]): void {
    const toLoad = entities.filter(e => !this.cache.has(e));

    if (toLoad.length === 0) return;

    // Henüz yüklenmemişler için boş signal oluştur
    toLoad.forEach(e => {
      if (!this.cache.has(e)) {
        this.cache.set(e, signal<LookupItem[]>([]));
      }
    });

    this.loading.set(true);
    this.lookupService.getLookups(toLoad).subscribe({
      next: (data) => {
        Object.entries(data).forEach(([key, items]) => {
          const sig = this.cache.get(key);
          if (sig) {
            sig.set(items);
          }
        });
        this.loading.set(false);
      },
      error: (err) => {
        console.error('[LookupStore] Lookup yükleme hatası:', err);
        this.loading.set(false);
      }
    });
  }

  /**
   * Belirtilen lookup entity'sinin verilerini signal olarak döner.
   * Henüz yüklenmemişse boş array döner.
   */
  get(entity: string): LookupItem[] {
    const sig = this.cache.get(entity);
    return sig ? sig() : [];
  }

  /**
   * Belirtilen entity + anahtar kombinasyonunun deger'ini döner.
   * Bulunamazsa fallback döner.
   */
  getDeger(entity: string, anahtar: number, fallback = ''): string {
    const items = this.get(entity);
    const found = items.find(i => i.anahtar === anahtar);
    return found ? found.deger : fallback;
  }

  /**
   * Belirtilen entity + deger kombinasyonunun anahtar'ını döner.
   * Bulunamazsa -1 döner.
   */
  getAnahtar(entity: string, deger: string): number {
    const items = this.get(entity);
    const found = items.find(i => i.deger === deger);
    return found ? found.anahtar : -1;
  }

  /**
   * Cache'i temizler — dil değişikliği veya logout sonrası kullanılabilir.
   */
  clearCache(): void {
    this.cache.clear();
  }
}
