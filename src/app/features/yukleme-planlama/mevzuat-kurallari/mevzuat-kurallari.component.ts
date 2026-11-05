import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BreadcrumbComponent } from '../../../shared/components/breadcrumb/breadcrumb.component';
import { ToastService } from '../../../core/services/toast.service';
import { YuklemePlanlamaService } from '../../../core/services/yukleme-planlama.service';
import {
  MevzuatKaynagiModeli,
  MevzuatKaynakTuru,
  MevzuatKuralSetiDetayi,
  MevzuatKuralSetiDurumu,
  MevzuatKuralSetiOzeti,
} from '../../../shared/models/index';
import { KURAL_SETI_DURUMU, MEVZUAT_KAYNAK_TURU, MEVZUAT_KURAL_TIPI } from '../ortak/yukleme-etiketleri';

/**
 * Mevzuat kural setleri (salt okunur). Kurallar kapalı bir tip kümesindedir; parametreler veridir. Taslak set ve
 * taslak kaynaktan gelen kural yürürlükteymiş gibi gösterilmez; hesap yalnız onaylı setle yapılır (sonraki faz).
 */
@Component({
  selector: 'app-mevzuat-kurallari',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, BreadcrumbComponent],
  templateUrl: './mevzuat-kurallari.component.html',
  styleUrls: ['../ortak/yukleme.scss', './mevzuat-kurallari.component.scss'],
})
export class MevzuatKurallariComponent implements OnInit {
  private readonly api = inject(YuklemePlanlamaService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly breadcrumb = [{ label: 'Ana Kontrol Paneli', link: '/dashboard' }, { label: 'Mevzuat Kuralları' }];
  readonly DURUM = KURAL_SETI_DURUMU;
  readonly KAYNAK_TURU = MEVZUAT_KAYNAK_TURU;
  readonly KURAL_TIPI = MEVZUAT_KURAL_TIPI;
  readonly Durum = MevzuatKuralSetiDurumu;

  readonly setler = signal<MevzuatKuralSetiOzeti[]>([]);
  readonly seciliId = signal<number | null>(null);
  readonly detay = signal<MevzuatKuralSetiDetayi | null>(null);
  readonly yukleniyor = signal(true);

  ngOnInit(): void {
    this.api.kuralSetleri().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((r) => {
      this.yukleniyor.set(false);
      if (r.isSuccess && r.value) {
        this.setler.set(r.value);
        if (r.value.length) this.sec(r.value[0].id);
      } else {
        this.toast.error(r.error ?? 'Kural setleri yüklenemedi.');
      }
    });
  }

  sec(id: number): void {
    this.seciliId.set(id);
    this.detay.set(null);
    this.api.kuralSeti(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe((r) => {
      if (r.isSuccess && r.value) this.detay.set(r.value);
      else this.toast.error(r.error ?? 'Kural seti yüklenemedi.');
    });
  }

  kaynak(id: number | null): MevzuatKaynagiModeli | undefined {
    return id == null ? undefined : this.detay()?.kaynaklar.find((k) => k.id === id);
  }

  taslakKaynakMi(id: number | null): boolean {
    return this.kaynak(id)?.tur === MevzuatKaynakTuru.YonetmelikTaslagi;
  }

  /** Parametre JSON'unu "ad: değer" satırlarına çevirir (iç içe değer JSON olarak kalır). */
  parametreler(json: string): { ad: string; deger: string }[] {
    try {
      const nesne = JSON.parse(json) as Record<string, unknown>;
      return Object.entries(nesne).map(([ad, deger]) => ({
        ad,
        deger: typeof deger === 'object' && deger !== null ? JSON.stringify(deger) : String(deger),
      }));
    } catch {
      return [{ ad: 'parametreler', deger: json }];
    }
  }
}
