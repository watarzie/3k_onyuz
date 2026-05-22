import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { Component, HostListener, computed, inject, signal, OnInit } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
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
import { LookupItem, SandikDto } from '../../shared/models/index';

export interface DepoStats {
  toplam: number;
  lokasyonCounts: Record<number, number>;
}

export interface ProjectWarehouseStat {
  id: number;
  projeNo: string;
  projeTipiId: number;
  toplamSandik: number;
  lokasyonCounts: Record<number, number>;
  sandiklar: SandikDto[];
  expanded: boolean;
}

@Component({
  selector: 'app-depo-durumu',
  standalone: true,
  imports: [TranslatePipe, NgClass, FormsModule, StatusBadgeComponent, BreadcrumbComponent],
  templateUrl: './depo-durumu.component.html',
  styleUrl: './depo-durumu.component.scss',
})
export class DepoDurumuComponent implements OnInit {
  ts = inject(TranslationService);
  private route = inject(ActivatedRoute);
  private projeService = inject(ProjeService);
  private sandikService = inject(SandikService);
  private pdfService = inject(PdfService);
  private toastService = inject(ToastService);
  private lookupService = inject(LookupService);
  private permissionService = inject(PermissionService);

  projectsList = signal<ProjectWarehouseStat[]>([]);
  filteredProjectsList = signal<ProjectWarehouseStat[]>([]);
  depoLokasyonlari = signal<LookupItem[]>([]);
  loading = signal(true);
  downloadingPdf = signal(false);
  searchTerm = signal('');
  reportMenuOpen = signal(false);
  depoModalOpen = signal(false);
  yeniDepoAdi = signal('');
  savingDepo = signal(false);
  pageSizeOptions = [10, 25, 50];
  pageSize = signal(10);
  currentPage = signal(1);

  globalStats = signal<DepoStats>({ toplam: 0, lokasyonCounts: {} });
  normalStats = signal<DepoStats>({ toplam: 0, lokasyonCounts: {} });
  sahaStats = signal<DepoStats>({ toplam: 0, lokasyonCounts: {} });
  yedekStats = signal<DepoStats>({ toplam: 0, lokasyonCounts: {} });

  totalPages = computed(() => Math.max(1, Math.ceil(this.filteredProjectsList().length / this.pageSize())));
  paginatedProjectsList = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.filteredProjectsList().slice(start, start + this.pageSize());
  });
  paginationStart = computed(() => {
    const total = this.filteredProjectsList().length;
    return total === 0 ? 0 : (this.currentPage() - 1) * this.pageSize() + 1;
  });
  paginationEnd = computed(() => Math.min(this.currentPage() * this.pageSize(), this.filteredProjectsList().length));

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

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.loading.set(true);

    this.lookupService.getLookups(['LookupDepoLokasyon']).pipe(
      switchMap((lookupRes) => {
        const lokasyonlar = this.sortLokasyonlar(lookupRes['LookupDepoLokasyon'] ?? []);
        this.depoLokasyonlari.set(lokasyonlar);

        return this.projeService.getProjeListesi();
      }),
      switchMap((res) => {
        if (!res.isSuccess || !res.value || res.value.length === 0) {
          return of([] as ProjectWarehouseStat[]);
        }

        const requests = res.value.map((p) =>
          this.sandikService.getSandiklar(p.id).pipe(
            map((sRes) => {
              let sandiklar: SandikDto[] = [];
              if (sRes.isSuccess && sRes.value) {
                sandiklar = sRes.value
                  .filter(s => this.isDepodaSayilacakSandik(s))
                  .sort((a, b) => this.extractNumber(a.sandikNo) - this.extractNumber(b.sandikNo));
              }

              if (sandiklar.length === 0) {
                return null;
              }

              return {
                id: p.id,
                projeNo: p.projeNo,
                projeTipiId: p.projeTipiId,
                toplamSandik: sandiklar.length,
                lokasyonCounts: this.countLokasyonlar(sandiklar),
                sandiklar,
                expanded: false
              } as ProjectWarehouseStat;
            })
          )
        );

        return forkJoin(requests).pipe(
          map(items => items.filter((item): item is ProjectWarehouseStat => item !== null))
        );
      })
    ).subscribe({
      next: (projectStats) => {
        projectStats.sort((a, b) => a.projeNo.localeCompare(b.projeNo));
        this.projectsList.set(projectStats);
        this.applyFilter(true);
        this.calculateAllStats(projectStats);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toastService.error('Depo durumu yüklenirken bir hata oluştu.');
      }
    });
  }

  private extractNumber(sandikNo: string): number {
    if (!sandikNo) return 0;
    const match = sandikNo.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  private sortLokasyonlar(lokasyonlar: LookupItem[]): LookupItem[] {
    return lokasyonlar
      .slice()
      .sort((a, b) => a.anahtar - b.anahtar || a.deger.localeCompare(b.deger, 'tr-TR'));
  }

  private isDepodaSayilacakSandik(sandik: SandikDto): boolean {
    const lokasyonId = sandik.depoLokasyonId || this.belirsizLokasyonId();
    return sandik.durumId !== 4 && sandik.depodaSayilacakMi === true && lokasyonId !== this.belirsizLokasyonId();
  }

  private countLokasyonlar(sandiklar: SandikDto[]): Record<number, number> {
    const counts: Record<number, number> = {};
    for (const sandik of sandiklar) {
      const lokasyonId = sandik.depoLokasyonId || this.belirsizLokasyonId();
      counts[lokasyonId] = (counts[lokasyonId] ?? 0) + 1;
    }
    return counts;
  }

  private belirsizLokasyonId(): number {
    return this.depoLokasyonlari().find(l => this.isBelirsiz(l))?.id ?? 1;
  }

  private isBelirsiz(lokasyon: LookupItem): boolean {
    return lokasyon.id === 1 || lokasyon.deger.toLocaleLowerCase('tr-TR') === 'belirsiz';
  }

  onSearch(event: Event) {
    this.searchTerm.set((event.target as HTMLInputElement).value.toLowerCase());
    this.applyFilter(true);
  }

  applyFilter(resetPage = false) {
    const term = this.searchTerm();
    if (!term) {
      this.filteredProjectsList.set(this.projectsList());
      this.syncPagination(resetPage);
      return;
    }

    const filtered = this.projectsList().filter(p => {
      const projeMatch = p.projeNo.toLowerCase().includes(term);
      const sandikMatch = p.sandiklar.some(s =>
        s.sandikNo.toLowerCase().includes(term) ||
        (s.depoLokasyonMetni && s.depoLokasyonMetni.toLowerCase().includes(term))
      );
      return projeMatch || sandikMatch;
    });
    this.filteredProjectsList.set(filtered);
    this.syncPagination(resetPage);
  }

  private syncPagination(resetPage: boolean) {
    if (resetPage) {
      this.currentPage.set(1);
      return;
    }

    if (this.currentPage() > this.totalPages()) {
      this.currentPage.set(this.totalPages());
    }
  }

  onPageSizeChange(size: number | string) {
    const parsedSize = Number(size);
    if (!this.pageSizeOptions.includes(parsedSize)) return;

    this.pageSize.set(parsedSize);
    this.currentPage.set(1);
  }

  previousPage() {
    this.goToPage(this.currentPage() - 1);
  }

  nextPage() {
    this.goToPage(this.currentPage() + 1);
  }

  goToPage(page: number) {
    const safePage = Math.min(Math.max(page, 1), this.totalPages());
    this.currentPage.set(safePage);
  }

  visiblePageNumbers(): number[] {
    const total = this.totalPages();
    const current = this.currentPage();
    const visibleCount = Math.min(5, total);
    const start = Math.max(1, Math.min(current - 2, total - visibleCount + 1));
    return Array.from({ length: visibleCount }, (_, index) => start + index);
  }

  calculateAllStats(projects: ProjectWarehouseStat[]) {
    const calcStats = (projs: ProjectWarehouseStat[]): DepoStats => {
      const lokasyonCounts: Record<number, number> = {};
      for (const proje of projs) {
        for (const [lokasyonId, count] of Object.entries(proje.lokasyonCounts)) {
          const id = Number(lokasyonId);
          lokasyonCounts[id] = (lokasyonCounts[id] ?? 0) + count;
        }
      }

      return {
        toplam: projs.reduce((sum, p) => sum + p.toplamSandik, 0),
        lokasyonCounts
      };
    };

    this.globalStats.set(calcStats(projects));
    this.normalStats.set(calcStats(projects.filter(p => p.projeTipiId === 1)));
    this.sahaStats.set(calcStats(projects.filter(p => p.projeTipiId === 2)));
    this.yedekStats.set(calcStats(projects.filter(p => p.projeTipiId === 3)));
  }

  toggleRow(project: ProjectWarehouseStat) {
    project.expanded = !project.expanded;
    this.filteredProjectsList.set([...this.filteredProjectsList()]);
  }

  getVisibleLokasyonlar(stats?: DepoStats | ProjectWarehouseStat): LookupItem[] {
    return this.depoLokasyonlari().filter(l => !this.isBelirsiz(l));
  }

  getYonetilebilirDepoLokasyonlari(): LookupItem[] {
    return this.depoLokasyonlari().filter(l => !this.isBelirsiz(l));
  }

  getLokasyonCount(stats: DepoStats | ProjectWarehouseStat, lokasyonId: number): number {
    return stats.lokasyonCounts[lokasyonId] ?? 0;
  }

  getLokasyonColor(lokasyon: LookupItem, index = 0): string {
    const key = lokasyon.deger.trim().toLocaleUpperCase('tr-TR');
    if (key === '3K') return '#0EA5E9';
    if (key === 'SEYMEN') return '#078A55';
    if (key === 'GRID') return '#F59E0B';
    if (this.isBelirsiz(lokasyon)) return '#64748B';
    return this.palette[index % this.palette.length];
  }

  getLokasyonBadgeBg(lokasyon: LookupItem, index = 0): string {
    return `${this.getLokasyonColor(lokasyon, index)}22`;
  }

  getLokasyonIcon(lokasyon: LookupItem): string {
    const key = lokasyon.deger.trim().toLocaleUpperCase('tr-TR');
    if (key === 'GRID') return 'ri-building-line';
    if (this.isBelirsiz(lokasyon)) return 'ri-map-pin-line';
    return 'ri-home-4-line';
  }

  getDonutPercentage(count: number, total: number): number {
    return total > 0 ? Math.round((count / total) * 100) : 0;
  }

  getDonutOffset(index: number, stats: DepoStats): number {
    const lokasyonlar = this.getVisibleLokasyonlar(stats);
    const previousTotal = lokasyonlar
      .slice(0, index)
      .reduce((sum, l) => sum + this.getDonutPercentage(this.getLokasyonCount(stats, l.id), stats.toplam), 0);
    return 25 - previousTotal;
  }

  projectTableColspan(): number {
    return 4 + this.getVisibleLokasyonlar(this.globalStats()).length;
  }

  projeTipiMetni(projeTipiId: number): string {
    return projeTipiId === 2 ? 'Saha' : projeTipiId === 3 ? 'Yedek' : 'Normal';
  }

  @HostListener('document:click')
  closeReportMenu() {
    this.reportMenuOpen.set(false);
  }

  toggleReportMenu(event: MouseEvent) {
    event.stopPropagation();
    if (this.downloadingPdf()) return;
    this.reportMenuOpen.update(open => !open);
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
    return !this.depoSistemKaydiMi(lokasyon) && this.getLokasyonCount(this.globalStats(), lokasyon.id) === 0;
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
        this.calculateAllStats(this.projectsList());
        this.applyFilter();
      },
      error: (err) => {
        this.savingDepo.set(false);
        this.toastService.error(this.getApiError(err?.error) || 'Depo eklenirken bir hata oluştu.');
      }
    });
  }

  depoSil(lokasyon: LookupItem) {
    if (!this.depoSilinebilirMi(lokasyon)) {
      this.toastService.error('Bu depo silinemez. Önce bağlı sandıkların lokasyonunu değiştirin.');
      return;
    }

    this.savingDepo.set(true);
    this.lookupService.depoLokasyonSil(lokasyon.id).subscribe({
      next: () => {
        this.savingDepo.set(false);
        this.toastService.success('Depo silindi.');
        this.depoLokasyonlari.set(this.depoLokasyonlari().filter(l => l.id !== lokasyon.id));
        this.calculateAllStats(this.projectsList());
        this.applyFilter();
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

  private getReportTypeLabel(projeTipiId: number | null): string {
    switch (projeTipiId) {
      case 1:
        return 'Normal';
      case 2:
        return 'Saha';
      case 3:
        return 'Yedek';
      default:
        return 'TumProjeler';
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
