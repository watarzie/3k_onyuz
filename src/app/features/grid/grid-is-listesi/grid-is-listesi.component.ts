import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { GridService } from '../../../core/services/grid.service';
import { BreadcrumbComponent } from '../../../shared/components/breadcrumb/breadcrumb.component';
import { ReadOnlyBannerComponent } from '../../../shared/components/readonly-banner/readonly-banner.component';
import { GridIsListesiDto, GridIsListesiItemDto } from '../../../shared/models';

type IsTipi = 'all' | 'yeniden' | 'eksik';

interface GridIsProjectGroup {
  key: number;
  projeId: number;
  projeTipiId: number;
  projeNo: string;
  musteri: string;
  items: GridIsListesiItemDto[];
  latestTimestamp: number;
  resendCount: number;
  missingCount: number;
  sandikCount: number;
  priority: number;
}

@Component({
  selector: 'app-grid-is-listesi',
  standalone: true,
  imports: [DatePipe, NgClass, RouterLink, FormsModule, BreadcrumbComponent, ReadOnlyBannerComponent],
  templateUrl: './grid-is-listesi.component.html',
  styleUrls: ['./grid-is-listesi.component.scss'],
})
export class GridIsListesiComponent implements OnInit {
  private gridService = inject(GridService);
  private router = inject(Router);

  loading = signal(true);
  errorMessage = signal('');
  data = signal<GridIsListesiDto | null>(null);
  activeTip = signal<IsTipi>('all');
  searchTerm = signal('');
  page = signal(1);
  pageSize = signal(25);
  todayOnly = signal(false);
  expandedProjects = signal<Set<number>>(new Set());

  breadcrumb = [
    { label: 'Ana Kontrol Paneli', link: '/dashboard' },
    { label: 'Sandık Yönetimi' },
    { label: 'Grid İş Listesi' },
  ];

  tipler: Array<{ key: IsTipi; label: string; count: () => number; icon: string }> = [
    { key: 'all', label: 'Tümü', count: () => this.data()?.toplam ?? 0, icon: 'ri-list-check-3-line' },
    { key: 'yeniden', label: 'Yeniden Sevk Gerekli', count: () => this.data()?.yenidenSevkGerekli ?? 0, icon: 'ri-loop-right-line' },
    { key: 'eksik', label: 'Eksik Geldi', count: () => this.data()?.eksikGelen ?? 0, icon: 'ri-error-warning-line' },
  ];

  items = computed(() => {
    const rows = this.data()?.liste.items ?? [];
    const term = this.searchTerm().trim().toLocaleLowerCase('tr-TR');

    if (!term) return rows;

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

  projectGroups = computed(() => {
    const groups = new Map<number, GridIsProjectGroup>();

    for (const item of this.items()) {
      const operationDate = item.sonIslemTarihi ?? item.gridSevkTarihi ?? null;
      const timestamp = operationDate ? new Date(operationDate).getTime() : 0;
      const existing = groups.get(item.projeId);

      if (!existing) {
        groups.set(item.projeId, {
          key: item.projeId,
          projeId: item.projeId,
          projeTipiId: item.projeTipiId,
          projeNo: item.projeNo,
          musteri: item.musteri,
          items: [item],
          latestTimestamp: timestamp,
          resendCount: item.isTipi === 'yeniden' ? 1 : 0,
          missingCount: item.isTipi === 'eksik' ? 1 : 0,
          sandikCount: item.sandikNo ? 1 : 0,
          priority: item.oncelik ?? 99,
        });
        continue;
      }

      existing.items.push(item);
      existing.resendCount += item.isTipi === 'yeniden' ? 1 : 0;
      existing.missingCount += item.isTipi === 'eksik' ? 1 : 0;
      existing.priority = Math.min(existing.priority, item.oncelik ?? 99);
      existing.latestTimestamp = Math.max(existing.latestTimestamp, timestamp);
    }

    return Array.from(groups.values())
      .map(group => ({
        ...group,
        sandikCount: new Set(group.items.map(item => item.sandikNo).filter(Boolean)).size,
        items: [...group.items].sort((a, b) => {
          const aTime = new Date(a.sonIslemTarihi ?? a.gridSevkTarihi ?? 0).getTime();
          const bTime = new Date(b.sonIslemTarihi ?? b.gridSevkTarihi ?? 0).getTime();
          return bTime - aTime || (a.oncelik ?? 99) - (b.oncelik ?? 99) || a.siraNo - b.siraNo;
        }),
      }))
      .sort((a, b) =>
        b.latestTimestamp - a.latestTimestamp ||
        a.priority - b.priority ||
        a.projeNo.localeCompare(b.projeNo, 'tr-TR')
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

    this.gridService.getIsListesi({
      page: this.page(),
      pageSize: this.pageSize(),
      isTipi: this.activeTip(),
      sadeceBugun: this.todayOnly(),
    }).subscribe(res => {
      this.loading.set(false);

      if (res.isSuccess && res.value) {
        this.data.set(res.value);
        this.syncExpandedProjects();
        return;
      }

      this.errorMessage.set(res.error || 'Grid iş listesi yüklenemedi.');
      this.data.set(null);
      this.expandedProjects.set(new Set());
    });
  }

  toggleTodayFilter(): void {
    this.todayOnly.update(value => !value);
    this.page.set(1);
    this.load();
  }

  setTip(tip: IsTipi): void {
    if (this.activeTip() === tip) return;
    this.activeTip.set(tip);
    this.page.set(1);
    this.load();
  }

  previousPage(): void {
    if (this.page() <= 1) return;
    this.page.update(value => value - 1);
    this.load();
  }

  nextPage(): void {
    if (!this.data()?.liste.hasMore) return;
    this.page.update(value => value + 1);
    this.load();
  }

  onPageSizeChange(value: string): void {
    this.pageSize.set(Number(value));
    this.page.set(1);
    this.load();
  }

  toggleProject(group: GridIsProjectGroup): void {
    const next = new Set(this.expandedProjects());
    next.has(group.key) ? next.delete(group.key) : next.add(group.key);
    this.expandedProjects.set(next);
  }

  isProjectExpanded(group: GridIsProjectGroup): boolean {
    return this.expandedProjects().has(group.key);
  }

  goToLink(item: GridIsListesiItemDto): any[] {
    if (item.projeTipiId === 2) return ['/saha-yonetimi/grid', item.projeId];
    if (item.projeTipiId === 3) return ['/yedek-yonetimi/grid', item.projeId];
    return ['/grid', item.projeId];
  }

  goToQueryParams(item: GridIsListesiItemDto): { focusCekiSatiriId: number } {
    return { focusCekiSatiriId: item.cekiSatiriId };
  }

  goToItem(item: GridIsListesiItemDto): void {
    this.router.navigate(this.goToLink(item), { queryParams: this.goToQueryParams(item) });
  }

  actionQuantity(item: GridIsListesiItemDto): number {
    if (item.isTipi === 'yeniden' && item.yenidenSevkGerekliAdet > 0) {
      return Number(item.yenidenSevkGerekliAdet);
    }

    if (item.isTipi === 'eksik' && item.gridEksikMiktar > 0) {
      return Number(item.gridEksikMiktar);
    }

    return Number(item.kalanMiktar ?? 0);
  }

  formatQuantity(value: number | null | undefined): string {
    const numeric = Number(value ?? 0);
    if (Number.isInteger(numeric)) return numeric.toString();
    return numeric.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
  }

  priorityClass(item: GridIsListesiItemDto): string {
    return `priority-${item.isTipi || 'default'}`;
  }

  projeTipiLabel(projeTipiId: number): string {
    if (projeTipiId === 2) return 'Saha';
    if (projeTipiId === 3) return 'Yedek';
    return 'Normal';
  }

  private syncExpandedProjects(): void {
    const validKeys = new Set(this.projectGroups().map(group => group.key));
    const next = new Set(Array.from(this.expandedProjects()).filter(key => validKeys.has(key)));
    this.expandedProjects.set(next);
  }
}
