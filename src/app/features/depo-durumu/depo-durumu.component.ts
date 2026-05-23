import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { Component, HostListener, computed, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { ActivatedRoute } from '@angular/router';
import { TranslationService } from '../../core/services/translation.service';
import { ProjeService } from '../../core/services/proje.service';
import { SandikService } from '../../core/services/sandik.service';
import { PdfService } from '../../core/services/pdf.service';
import { ToastService } from '../../core/services/toast.service';
import { LookupService } from '../../core/services/lookup.service';
import { PermissionService } from '../../core/services/permission.service';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { BreadcrumbComponent } from '../../shared/components/breadcrumb/breadcrumb.component';
import { ProjeDepoDagilimDto, ProjeDto, SandikDto, LookupItem } from '../../shared/models/index';

type DepoSummaryScope = 'global' | 'normal' | 'saha' | 'yedek';

interface DepoSegment {
  id: number;
  label: string;
  count: number;
  color: string;
  softColor: string;
  icon: string;
}

@Component({
  selector: 'app-depo-durumu',
  standalone: true,
  imports: [TranslatePipe, NgClass, FormsModule, StatusBadgeComponent, BreadcrumbComponent],
  templateUrl: './depo-durumu.component.html',
  styleUrl: './depo-durumu.component.scss',
})
export class DepoDurumuComponent implements OnInit, OnDestroy {
  ts = inject(TranslationService);
  private route = inject(ActivatedRoute);
  private projeService = inject(ProjeService);
  private sandikService = inject(SandikService);
  private pdfService = inject(PdfService);
  private toastService = inject(ToastService);
  private lookupService = inject(LookupService);
  private permissionService = inject(PermissionService);

  // --- Project list (from server-side paginated ProjeDto) ---
  projeler = signal<ProjeDto[]>([]);
  loading = signal(true);
  searchTerm = signal('');

  // --- Server-side pagination ---
  pageSizeOptions = [15, 25, 50];
  pageSize = signal(15);
  currentPage = signal(1);
  totalCount = signal(0);
  totalPages = signal(1);

  paginationStart = computed(() => {
    const total = this.totalCount();
    return total === 0 ? 0 : (this.currentPage() - 1) * this.pageSize() + 1;
  });
  paginationEnd = computed(() => Math.min(this.currentPage() * this.pageSize(), this.totalCount()));

  // --- Expanded sandık detail (lazy-loaded) ---
  expandedProjeId = signal<number | null>(null);
  expandedSandiklar = signal<SandikDto[]>([]);
  expandedLoading = signal(false);

  // --- Summary stats (computed from current page's ProjeDto list) ---
  // We compute global stats from ALL projects — for that we do a separate unpaginated call
  globalDepoUcK = signal(0);
  globalDepoSeymen = signal(0);
  globalDepoGrid = signal(0);
  globalDepoToplam = signal(0);
  normalDepoUcK = signal(0);
  normalDepoSeymen = signal(0);
  normalDepoGrid = signal(0);
  normalDepoToplam = signal(0);
  sahaDepoUcK = signal(0);
  sahaDepoSeymen = signal(0);
  sahaDepoGrid = signal(0);
  sahaDepoToplam = signal(0);
  yedekDepoUcK = signal(0);
  yedekDepoSeymen = signal(0);
  yedekDepoGrid = signal(0);
  yedekDepoToplam = signal(0);
  globalDepoDagilim = signal<Record<number, number>>({});
  normalDepoDagilim = signal<Record<number, number>>({});
  sahaDepoDagilim = signal<Record<number, number>>({});
  yedekDepoDagilim = signal<Record<number, number>>({});

  // --- Depo management modal ---
  depoLokasyonlari = signal<LookupItem[]>([]);
  visibleDepoLokasyonlari = computed(() => {
    const lokasyonlar = this.depoLokasyonlari();
    const knownIds = new Set<number>();
    const allMaps = [
      this.globalDepoDagilim(),
      this.normalDepoDagilim(),
      this.sahaDepoDagilim(),
      this.yedekDepoDagilim(),
      ...this.projeler().map(p => this.projectDepoCountMap(p)),
    ];

    allMaps.forEach(map => Object.keys(map).forEach(key => knownIds.add(Number(key))));

    const byId = new Map<number, LookupItem>();
    lokasyonlar.forEach(l => byId.set(l.id, l));
    knownIds.forEach(id => {
      if (!byId.has(id)) {
        byId.set(id, { id, anahtar: id, deger: `Depo ${id}` });
      }
    });

    return this.sortLokasyonlar(Array.from(byId.values()).filter(l => !this.isBelirsiz(l)));
  });
  downloadingPdf = signal(false);
  reportMenuOpen = signal(false);
  depoModalOpen = signal(false);
  yeniDepoAdi = signal('');
  savingDepo = signal(false);

  canWriteCurrentMenu = computed(() => {
    const menuKod = this.route.snapshot.data?.['menuKod'] || 'depo-durumu';
    return typeof menuKod === 'string' && this.permissionService.canWrite(menuKod);
  });

  breadcrumb = [
    { label: 'Ana Kontrol Paneli', link: '/dashboard' },
    { label: 'Depo Durumu' },
  ];

  private readonly systemLokasyonIds = new Set([1, 2, 4, 5]);
  private readonly palette = ['#3584FC', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4', '#64748B', '#14B8A6'];

  // --- Debounced search ---
  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  ngOnInit() {
    this.searchSubject.pipe(
      debounceTime(400),
      distinctUntilChanged(),
    ).subscribe(term => {
      this.searchTerm.set(term);
      this.currentPage.set(1);
      this.loadProjeler();
    });

    this.loadSummaryStats();
    this.loadLokasyonlar();
    this.loadProjeler();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.searchSubject.complete();
  }

  // --- Load summary stats (unpaginated, all projects) ---
  private loadSummaryStats() {
    // Get a large page to compute summary stats across ALL projects
    this.projeService.getProjeListesi(1, 10000).subscribe(res => {
      if (res.isSuccess && res.value) {
        const all = res.value.items;
        const normal = all.filter(p => p.projeTipiId === 1);
        const saha = all.filter(p => p.projeTipiId === 2);
        const yedek = all.filter(p => p.projeTipiId === 3);

        const globalDagilim = this.calculateDepoDagilim(all);
        const normalDagilim = this.calculateDepoDagilim(normal);
        const sahaDagilim = this.calculateDepoDagilim(saha);
        const yedekDagilim = this.calculateDepoDagilim(yedek);

        this.globalDepoDagilim.set(globalDagilim);
        this.normalDepoDagilim.set(normalDagilim);
        this.sahaDepoDagilim.set(sahaDagilim);
        this.yedekDepoDagilim.set(yedekDagilim);

        this.globalDepoUcK.set(globalDagilim[2] ?? 0);
        this.globalDepoSeymen.set(globalDagilim[4] ?? 0);
        this.globalDepoGrid.set(globalDagilim[5] ?? 0);
        this.globalDepoToplam.set(this.sumDagilim(globalDagilim));

        this.normalDepoUcK.set(normalDagilim[2] ?? 0);
        this.normalDepoSeymen.set(normalDagilim[4] ?? 0);
        this.normalDepoGrid.set(normalDagilim[5] ?? 0);
        this.normalDepoToplam.set(this.sumDagilim(normalDagilim));

        this.sahaDepoUcK.set(sahaDagilim[2] ?? 0);
        this.sahaDepoSeymen.set(sahaDagilim[4] ?? 0);
        this.sahaDepoGrid.set(sahaDagilim[5] ?? 0);
        this.sahaDepoToplam.set(this.sumDagilim(sahaDagilim));

        this.yedekDepoUcK.set(yedekDagilim[2] ?? 0);
        this.yedekDepoSeymen.set(yedekDagilim[4] ?? 0);
        this.yedekDepoGrid.set(yedekDagilim[5] ?? 0);
        this.yedekDepoToplam.set(this.sumDagilim(yedekDagilim));
      }
    });
  }

  // --- Load lokasyonlar for depo management modal ---
  private loadLokasyonlar() {
    this.lookupService.getLookups(['LookupDepoLokasyon']).subscribe(lookupRes => {
      const lokasyonlar = this.sortLokasyonlar(lookupRes['LookupDepoLokasyon'] ?? []);
      this.depoLokasyonlari.set(lokasyonlar);
    });
  }

  // --- Load paginated project list ---
  loadProjeler() {
    this.loading.set(true);
    this.projeService.getProjeListesi(
      this.currentPage(),
      this.pageSize(),
      undefined,
      this.searchTerm() || undefined,
      false
    ).subscribe({
      next: (res) => {
        if (res.isSuccess && res.value) {
          this.projeler.set(res.value.items);
          this.totalCount.set(res.value.totalCount);
          this.totalPages.set(res.value.totalPages);
        } else {
          this.projeler.set([]);
          this.totalCount.set(0);
          this.totalPages.set(1);
        }
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toastService.error('Depo durumu yüklenirken bir hata oluştu.');
      }
    });
  }

  // --- Search ---
  onSearch(event: Event) {
    const value = (event.target as HTMLInputElement).value.trim();
    this.searchSubject.next(value);
  }

  // --- Pagination ---
  onPageSizeChange(size: number | string) {
    const parsedSize = Number(size);
    if (!this.pageSizeOptions.includes(parsedSize)) return;
    this.pageSize.set(parsedSize);
    this.currentPage.set(1);
    this.loadProjeler();
  }

  previousPage() {
    this.goToPage(this.currentPage() - 1);
  }

  nextPage() {
    this.goToPage(this.currentPage() + 1);
  }

  goToPage(page: number) {
    const safePage = Math.min(Math.max(page, 1), this.totalPages());
    if (safePage === this.currentPage()) return;
    this.currentPage.set(safePage);
    this.loadProjeler();
  }

  visiblePageNumbers(): number[] {
    const total = this.totalPages();
    const current = this.currentPage();
    const visibleCount = Math.min(5, total);
    const start = Math.max(1, Math.min(current - 2, total - visibleCount + 1));
    return Array.from({ length: visibleCount }, (_, index) => start + index);
  }

  // --- Expand / Collapse row (lazy load sandıklar) ---
  toggleExpand(projeId: number) {
    if (this.expandedProjeId() === projeId) {
      this.expandedProjeId.set(null);
      this.expandedSandiklar.set([]);
      return;
    }
    this.expandedProjeId.set(projeId);
    this.expandedLoading.set(true);
    this.expandedSandiklar.set([]);
    this.sandikService.getSandiklar(projeId).subscribe({
      next: (res) => {
        this.expandedLoading.set(false);
        if (res.isSuccess && res.value) {
          this.expandedSandiklar.set(
            res.value
              .filter(s => s.depodaSayilacakMi)
              .sort((a, b) => this.extractNumber(a.sandikNo) - this.extractNumber(b.sandikNo))
          );
        }
      },
      error: () => {
        this.expandedLoading.set(false);
        this.toastService.error('Sandık detayları yüklenirken bir hata oluştu.');
      }
    });
  }

  private extractNumber(sandikNo: string): number {
    if (!sandikNo) return 0;
    const match = sandikNo.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  // --- Utilities ---
  private projectDepoDagilimlari(proje: ProjeDto): ProjeDepoDagilimDto[] {
    if (proje.depoDagilimlari?.length) {
      return proje.depoDagilimlari.filter(d => d.sandikSayisi > 0);
    }

    const fallback: ProjeDepoDagilimDto[] = [
      { depoLokasyonId: 2, depoLokasyonMetni: '3K', sandikSayisi: proje.depoUcKSandikSayisi ?? 0 },
      { depoLokasyonId: 4, depoLokasyonMetni: 'Seymen', sandikSayisi: proje.depoSeymenSandikSayisi ?? 0 },
      { depoLokasyonId: 5, depoLokasyonMetni: 'Grid', sandikSayisi: proje.depoGridSandikSayisi ?? 0 },
    ];

    return fallback.filter(d => d.sandikSayisi > 0);
  }

  private projectDepoCountMap(proje: ProjeDto): Record<number, number> {
    return this.projectDepoDagilimlari(proje).reduce<Record<number, number>>((acc, item) => {
      acc[item.depoLokasyonId] = (acc[item.depoLokasyonId] ?? 0) + item.sandikSayisi;
      return acc;
    }, {});
  }

  private calculateDepoDagilim(projeler: ProjeDto[]): Record<number, number> {
    return projeler.reduce<Record<number, number>>((acc, proje) => {
      const map = this.projectDepoCountMap(proje);
      Object.entries(map).forEach(([id, count]) => {
        acc[Number(id)] = (acc[Number(id)] ?? 0) + count;
      });
      return acc;
    }, {});
  }

  private sumDagilim(map: Record<number, number>): number {
    return Object.values(map).reduce((sum, count) => sum + count, 0);
  }

  private getSummaryMap(scope: DepoSummaryScope): Record<number, number> {
    switch (scope) {
      case 'normal':
        return this.normalDepoDagilim();
      case 'saha':
        return this.sahaDepoDagilim();
      case 'yedek':
        return this.yedekDepoDagilim();
      default:
        return this.globalDepoDagilim();
    }
  }

  getSummaryTotal(scope: DepoSummaryScope): number {
    return this.visibleDepoLokasyonlari()
      .reduce((sum, lokasyon) => sum + this.getSummaryDepoCount(scope, lokasyon), 0);
  }

  getSummaryDepoCount(scope: DepoSummaryScope, lokasyon: LookupItem): number {
    return this.getSummaryMap(scope)[lokasyon.id] ?? 0;
  }

  getProjectDepoCount(proje: ProjeDto, lokasyon: LookupItem): number {
    return this.projectDepoCountMap(proje)[lokasyon.id] ?? 0;
  }

  getSummaryDepoSegments(scope: DepoSummaryScope): DepoSegment[] {
    return this.visibleDepoLokasyonlari().map((lokasyon, index) => {
      const color = this.getLokasyonColor(lokasyon, index);
      return {
        id: lokasyon.id,
        label: lokasyon.deger,
        count: this.getSummaryDepoCount(scope, lokasyon),
        color,
        softColor: this.getLokasyonSoftColor(lokasyon, index),
        icon: this.getLokasyonIcon(lokasyon),
      };
    });
  }

  getProjectTableColspan(): number {
    return 4 + this.visibleDepoLokasyonlari().length;
  }

  private sortLokasyonlar(lokasyonlar: LookupItem[]): LookupItem[] {
    return lokasyonlar
      .slice()
      .sort((a, b) => a.anahtar - b.anahtar || a.deger.localeCompare(b.deger, 'tr-TR'));
  }

  projeTipiMetni(projeTipiId: number): string {
    return projeTipiId === 2 ? 'Saha' : projeTipiId === 3 ? 'Yedek' : 'Normal';
  }

  // --- Donut chart helpers ---
  getDonutPercentage(count: number, total: number): number {
    return total > 0 ? Math.round((count / total) * 100) : 0;
  }

  getDonutSegments(): DepoSegment[] {
    return this.getSummaryDepoSegments('global');
  }

  getDonutOffset(index: number): number {
    const segments = this.getDonutSegments();
    const total = this.getSummaryTotal('global');
    const previousTotal = segments
      .slice(0, index)
      .reduce((sum, s) => sum + this.getDonutPercentage(s.count, total), 0);
    return 25 - previousTotal;
  }

  // --- Report menu ---
  @HostListener('document:click')
  closeReportMenu() {
    this.reportMenuOpen.set(false);
  }

  toggleReportMenu(event: MouseEvent) {
    event.stopPropagation();
    if (this.downloadingPdf()) return;
    this.reportMenuOpen.update(open => !open);
  }

  // --- Depo modal management ---
  getYonetilebilirDepoLokasyonlari(): LookupItem[] {
    return this.depoLokasyonlari().filter(l => !this.isBelirsiz(l));
  }

  private isBelirsiz(lokasyon: LookupItem): boolean {
    return lokasyon.id === 1 || lokasyon.deger.toLocaleLowerCase('tr-TR') === 'belirsiz';
  }

  getLokasyonColor(lokasyon: LookupItem, index = 0): string {
    const key = lokasyon.deger.trim().toUpperCase();
    if (key === '3K') return '#0EA5E9';
    if (key === 'SEYMEN') return '#078A55';
    if (key === 'GRID') return '#F59E0B';
    if (this.isBelirsiz(lokasyon)) return '#64748B';
    return this.palette[index % this.palette.length];
  }

  getLokasyonSoftColor(lokasyon: LookupItem, index = 0): string {
    return `${this.getLokasyonColor(lokasyon, index)}22`;
  }

  getLokasyonIcon(lokasyon: LookupItem): string {
    const key = lokasyon.deger.trim().toUpperCase();
    if (this.isBelirsiz(lokasyon)) return 'ri-map-pin-line';
    if (key === 'GRID') return 'ri-building-line';
    return 'ri-home-4-line';
  }

  openDepoModal() {
    this.depoModalOpen.set(true);
  }

  closeDepoModal() {
    if (this.savingDepo()) return;
    this.depoModalOpen.set(false);
    this.yeniDepoAdi.set('');
  }

  depoSistemKaydiMi(lokasyon: LookupItem): boolean {
    return this.systemLokasyonIds.has(lokasyon.id);
  }

  depoSilinebilirMi(lokasyon: LookupItem): boolean {
    return !this.depoSistemKaydiMi(lokasyon);
  }

  depoEkle() {
    const ad = this.yeniDepoAdi().trim();
    if (!ad) {
      this.toastService.error('Depo adı giriniz.');
      return;
    }

    this.savingDepo.set(true);
    this.lookupService.depoLokasyonOlustur(ad).subscribe({
      next: (lokasyon) => {
        this.savingDepo.set(false);
        this.toastService.success('Depo başarıyla eklendi.');
        this.yeniDepoAdi.set('');
        this.depoLokasyonlari.set(this.sortLokasyonlar([...this.depoLokasyonlari(), lokasyon]));
        this.loadSummaryStats();
        this.loadProjeler();
      },
      error: (err) => {
        this.savingDepo.set(false);
        this.toastService.error(this.getApiError(err?.error) || 'Depo eklenirken bir hata oluştu.');
      }
    });
  }

  depoSil(lokasyon: LookupItem) {
    if (!this.depoSilinebilirMi(lokasyon)) {
      this.toastService.error('Bu depo silinemez.');
      return;
    }

    this.savingDepo.set(true);
    this.lookupService.depoLokasyonSil(lokasyon.id).subscribe({
      next: () => {
        this.savingDepo.set(false);
        this.toastService.success('Depo silindi.');
        this.depoLokasyonlari.set(this.depoLokasyonlari().filter(l => l.id !== lokasyon.id));
        this.loadSummaryStats();
        this.loadProjeler();
      },
      error: (err) => {
        this.savingDepo.set(false);
        this.toastService.error(this.getApiError(err?.error) || 'Depo silinirken bir hata oluştu.');
      }
    });
  }

  private getApiError(error: unknown): string {
    if (!error) return '';
    if (typeof error === 'string') return error;
    const obj = error as { error?: { message?: string } | string; message?: string };
    if (typeof obj.error === 'string') return obj.error;
    return obj.error?.message || obj.message || '';
  }

  // --- PDF report ---
  private getReportTypeLabel(projeTipiId: number | null): string {
    switch (projeTipiId) {
      case 1: return 'Normal';
      case 2: return 'Saha';
      case 3: return 'Yedek';
      default: return 'TumProjeler';
    }
  }

  indirDepoSandikPdf(projeTipiId: number | null = null) {
    this.reportMenuOpen.set(false);
    this.downloadingPdf.set(true);
    this.pdfService.depoSandikPdf(projeTipiId).subscribe({
      next: (blob) => {
        this.downloadingPdf.set(false);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const tarih = new Date().toISOString().split('T')[0].replace(/-/g, '');
        a.download = `DepoSandikRaporu_${this.getReportTypeLabel(projeTipiId)}_${tarih}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: () => {
        this.downloadingPdf.set(false);
        this.toastService.error('Depo sandık raporu indirilirken bir hata oluştu.');
      }
    });
  }
}
