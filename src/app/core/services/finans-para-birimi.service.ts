import { Injectable, computed, inject, signal } from '@angular/core';
import { FinansParaBirimi } from '../../shared/models/finans-v2.model';
import { FinansService } from './finans.service';

/**
 * Para birimi tanımları (F1) için tek kaynak: seçim listeleri, kartlar ve filtreler kodda sabit liste yerine
 * sunucudaki FinansParaBirimleri tablosunu kullanır. Tanımlar bir kez yüklenir; yönetim ekranı kaydedince yenilenir.
 */
@Injectable({ providedIn: 'root' })
export class FinansParaBirimiService {
  private readonly finans = inject(FinansService);
  private readonly tanimlar = signal<FinansParaBirimi[]>([]);
  private yukleniyor = false;
  private yuklendi = false;

  readonly tumu = this.tanimlar.asReadonly();
  /** Aktif para birimi kodları, tanım sırasıyla. */
  readonly aktifKodlar = computed(() => this.tanimlar().filter((x) => x.aktif).map((x) => x.kod));

  yukle(zorla = false): void {
    if (this.yukleniyor || (this.yuklendi && !zorla)) return;
    this.yukleniyor = true;
    this.finans.paraBirimleri(false).subscribe({
      next: (sonuc) => {
        this.yukleniyor = false;
        if (!sonuc.isSuccess) return;
        this.yuklendi = true;
        this.tanimlar.set(sonuc.value ?? []);
      },
      error: () => (this.yukleniyor = false),
    });
  }

  /** Seçim listesi: aktif para birimleri; kaydın mevcut kodu pasif olsa da listede kalır. */
  secenekler(mevcut?: string | null): string[] {
    const kodlar = this.aktifKodlar();
    return mevcut && !kodlar.includes(mevcut) ? [...kodlar, mevcut] : kodlar;
  }

  /** Aktif ilk para birimi; tanımlar yüklenmeden önce boş kalır. */
  varsayilan(): string {
    return this.aktifKodlar()[0] ?? '';
  }

  ad(kod: string): string {
    const tanim = this.tanimlar().find((x) => x.kod === kod);
    return tanim ? `${tanim.kod} · ${tanim.ad}` : kod;
  }
}
