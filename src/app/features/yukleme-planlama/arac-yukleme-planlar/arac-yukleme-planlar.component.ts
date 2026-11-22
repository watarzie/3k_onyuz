import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, switchMap, tap } from 'rxjs';
import { BreadcrumbComponent } from '../../../shared/components/breadcrumb/breadcrumb.component';
import { ServerPagerComponent } from '../../../shared/components/server-pager/server-pager.component';
import { ToastService } from '../../../core/services/toast.service';
import { AracYuklemeService } from '../../../core/services/arac-yukleme.service';
import { AracYuklemePlanOzeti, PaginatedList } from '../../../shared/models/index';
import { yuklemeYuzdesi } from '../ortak/yukleme-etiketleri';

/**
 * Araç yükleme (saha): yüklenebilecek planlar, yüklemesi sürenler önce (sunucuda sayfalı). Satır, planın yükleme
 * oturumu ekranını açar.
 */
@Component({
  selector: 'app-arac-yukleme-planlar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, FormsModule, BreadcrumbComponent, ServerPagerComponent],
  templateUrl: './arac-yukleme-planlar.component.html',
  styleUrls: ['../ortak/yukleme.scss', '../ortak/arac-yukleme.scss'],
})
export class AracYuklemePlanlarComponent implements OnInit {
  private readonly api = inject(AracYuklemeService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly breadcrumb = [{ label: 'Ana Kontrol Paneli', link: '/dashboard' }, { label: 'Araç Yükleme' }];
  readonly SAYFA_BOYUTLARI = [25, 50, 100];
  readonly yuzde = yuklemeYuzdesi;

  readonly arama = signal('');
  readonly sayfa = signal(1);
  readonly boyut = signal(25);
  readonly liste = signal<PaginatedList<AracYuklemePlanOzeti> | null>(null);
  readonly yukleniyor = signal(false);
  /** Liste istekleri tek akıştan geçer: eski yanıt yeni aramanın sonucunu ezmez. */
  private readonly istekler = new Subject<void>();
  private readonly aramaAkisi = new Subject<void>();

  ngOnInit(): void {
    this.istekler
      .pipe(
        tap(() => this.yukleniyor.set(true)),
        switchMap(() => this.api.planlar(this.arama(), this.sayfa(), this.boyut())),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((r) => {
        this.yukleniyor.set(false);
        if (r.isSuccess && r.value) this.liste.set(r.value);
        else this.toast.error(r.error ?? 'Planlar yüklenemedi.');
      });
    this.aramaAkisi.pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.sayfa.set(1);
      this.istekler.next();
    });
    this.istekler.next();
  }

  aramaDegisti(metin: string): void {
    this.arama.set(metin);
    this.aramaAkisi.next();
  }

  sayfaDegisti(sayfa: number): void {
    this.sayfa.set(sayfa);
    this.istekler.next();
  }

  boyutDegisti(boyut: number): void {
    this.boyut.set(boyut);
    this.sayfa.set(1);
    this.istekler.next();
  }

  ac(plan: AracYuklemePlanOzeti): void {
    this.router.navigate(['/arac-yukleme', plan.id]);
  }
}
