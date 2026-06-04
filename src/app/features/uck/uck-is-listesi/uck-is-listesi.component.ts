import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, NgClass } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BreadcrumbComponent } from '../../../shared/components/breadcrumb/breadcrumb.component';
import { ReadOnlyBannerComponent } from '../../../shared/components/readonly-banner/readonly-banner.component';
import { UcKService } from '../../../core/services/uck.service';
import { UcKIsListesiDto, UcKIsListesiItemDto } from '../../../shared/models';

type IsTipi = 'all' | 'teslim' | 'yeniden' | 'eksik' | 'trafo' | 'kapandi';

@Component({
  selector: 'app-uck-is-listesi',
  standalone: true,
  imports: [DatePipe, NgClass, RouterLink, FormsModule, BreadcrumbComponent, ReadOnlyBannerComponent],
  templateUrl: './uck-is-listesi.component.html',
  styleUrls: ['./uck-is-listesi.component.scss'],
})
export class UcKIsListesiComponent implements OnInit {
  private uckService = inject(UcKService);

  loading = signal(true);
  errorMessage = signal('');
  data = signal<UcKIsListesiDto | null>(null);
  activeTip = signal<IsTipi>('all');
  searchTerm = signal('');
  page = signal(1);
  pageSize = signal(25);

  breadcrumb = [
    { label: 'Ana Kontrol Paneli', link: '/dashboard' },
    { label: 'Sandık Yönetimi' },
    { label: '3K İş Listesi' },
  ];

  tipler: Array<{ key: IsTipi; label: string; count: () => number; icon: string }> = [
    { key: 'all', label: 'Tümü', count: () => this.data()?.toplam ?? 0, icon: 'ri-list-check-3-line' },
    { key: 'teslim', label: '3K Teslim Bekleyen', count: () => this.data()?.teslimBekleyen ?? 0, icon: 'ri-inbox-archive-line' },
    { key: 'yeniden', label: 'Yeniden Sevk Gerekli', count: () => this.data()?.yenidenSevkGerekli ?? 0, icon: 'ri-loop-right-line' },
    { key: 'eksik', label: 'Eksik Gelen', count: () => this.data()?.eksikGelen ?? 0, icon: 'ri-error-warning-line' },
    { key: 'trafo', label: 'Trafo Sevk', count: () => this.data()?.trafoSevk ?? 0, icon: 'ri-flashlight-line' },
    { key: 'kapandi', label: 'Grid Kapandı', count: () => this.data()?.gridKapandi ?? 0, icon: 'ri-archive-line' },
  ];

  items = computed(() => {
    const rows = this.data()?.liste.items ?? [];
    const term = this.searchTerm().trim().toLocaleLowerCase('tr-TR');

    if (!term) {
      return rows;
    }

    return rows.filter(item =>
      [
        item.projeNo,
        item.musteri,
        item.sandikNo,
        item.barkodNo,
        item.olcuResmiPozNo,
        item.aciklama,
        item.gridDurumuMetni,
        item.gridSevkDurumuMetni,
        item.isTipiMetni,
      ]
        .filter(Boolean)
        .some(value => String(value).toLocaleLowerCase('tr-TR').includes(term))
    );
  });

  totalCount = computed(() => this.data()?.liste.totalCount ?? 0);
  totalPages = computed(() => Math.max(1, Math.ceil(this.totalCount() / this.pageSize())));

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.errorMessage.set('');

    this.uckService.getIsListesi({
      page: this.page(),
      pageSize: this.pageSize(),
      isTipi: this.activeTip(),
    }).subscribe(res => {
      this.loading.set(false);

      if (res.isSuccess && res.value) {
        this.data.set(res.value);
        return;
      }

      this.errorMessage.set(res.error || '3K iş listesi yüklenemedi.');
      this.data.set(null);
    });
  }

  setTip(tip: IsTipi): void {
    if (this.activeTip() === tip) {
      return;
    }

    this.activeTip.set(tip);
    this.page.set(1);
    this.load();
  }

  previousPage(): void {
    if (this.page() <= 1) {
      return;
    }

    this.page.update(value => value - 1);
    this.load();
  }

  nextPage(): void {
    if (!this.data()?.liste.hasMore) {
      return;
    }

    this.page.update(value => value + 1);
    this.load();
  }

  onPageSizeChange(value: string): void {
    this.pageSize.set(Number(value));
    this.page.set(1);
    this.load();
  }

  goToLink(item: UcKIsListesiItemDto): any[] {
    return item.sandikNo
      ? ['/uck', item.projeId, item.sandikNo]
      : ['/uck', item.projeId];
  }

  formatQuantity(value: number | null | undefined): string {
    const numeric = Number(value ?? 0);

    if (Number.isInteger(numeric)) {
      return numeric.toString();
    }

    return numeric.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
  }

  priorityClass(item: UcKIsListesiItemDto): string {
    return `priority-${item.isTipi || 'default'}`;
  }

  trackById(_index: number, item: UcKIsListesiItemDto): number {
    return item.cekiSatiriId;
  }
}
