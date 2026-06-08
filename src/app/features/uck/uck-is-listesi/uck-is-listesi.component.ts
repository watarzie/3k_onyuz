import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, NgClass } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BreadcrumbComponent } from '../../../shared/components/breadcrumb/breadcrumb.component';
import { ReadOnlyBannerComponent } from '../../../shared/components/readonly-banner/readonly-banner.component';
import { UcKService } from '../../../core/services/uck.service';
import { UcKIsListesiDto, UcKIsListesiItemDto } from '../../../shared/models';

type IsTipi = 'all' | 'teslim' | 'yeniden' | 'eksik' | 'trafo' | 'kapandi';

interface UcKIsProjectGroup {
  key: number;
  projeId: number;
  projeNo: string;
  musteri: string;
  items: UcKIsListesiItemDto[];
  latestTimestamp: number;
  totalKalan: number;
  sandikCount: number;
  priority: number;
}

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
  todayOnly = signal(false);
  expandedProjects = signal<Set<number>>(new Set());

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

  projectGroups = computed(() => {
    const groups = new Map<number, UcKIsProjectGroup>();

    for (const item of this.items()) {
      const key = item.projeId;
      const operationDate = item.sonIslemTarihi ?? item.gridSevkTarihi ?? null;
      const timestamp = operationDate ? new Date(operationDate).getTime() : 0;
      const existing = groups.get(key);

      if (!existing) {
        groups.set(key, {
          key,
          projeId: item.projeId,
          projeNo: item.projeNo,
          musteri: item.musteri,
          items: [item],
          latestTimestamp: timestamp,
          totalKalan: Number(item.kalanMiktar ?? 0),
          sandikCount: item.sandikNo ? 1 : 0,
          priority: item.oncelik ?? 99,
        });
        continue;
      }

      existing.items.push(item);
      existing.totalKalan += Number(item.kalanMiktar ?? 0);
      existing.priority = Math.min(existing.priority, item.oncelik ?? 99);

      if (timestamp > existing.latestTimestamp) {
        existing.latestTimestamp = timestamp;
      }
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

    this.uckService.getIsListesi({
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

      this.errorMessage.set(res.error || '3K iş listesi yüklenemedi.');
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

  toggleProject(group: UcKIsProjectGroup): void {
    const next = new Set(this.expandedProjects());
    next.has(group.key) ? next.delete(group.key) : next.add(group.key);
    this.expandedProjects.set(next);
  }

  isProjectExpanded(group: UcKIsProjectGroup): boolean {
    return this.expandedProjects().has(group.key);
  }

  goToLink(item: UcKIsListesiItemDto): any[] {
    return item.sandikNo
      ? ['/uck', item.projeId, item.sandikNo]
      : ['/uck', item.projeId];
  }

  goToQueryParams(item: UcKIsListesiItemDto): { focusCekiSatiriId: number } {
    return { focusCekiSatiriId: item.cekiSatiriId };
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

  trackByProject(_index: number, group: UcKIsProjectGroup): number {
    return group.key;
  }

  private syncExpandedProjects(): void {
    const groups = this.projectGroups();
    const validKeys = new Set(groups.map(group => group.key));
    const next = new Set(Array.from(this.expandedProjects()).filter(key => validKeys.has(key)));

    this.expandedProjects.set(next);
  }
}