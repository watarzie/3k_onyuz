import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { Component, HostListener, inject, signal, OnInit } from '@angular/core';
import { NgClass } from '@angular/common';
import { TranslationService } from '../../core/services/translation.service';
import { ProjeService } from '../../core/services/proje.service';
import { SandikService } from '../../core/services/sandik.service';
import { PdfService } from '../../core/services/pdf.service';
import { ToastService } from '../../core/services/toast.service';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { BreadcrumbComponent } from '../../shared/components/breadcrumb/breadcrumb.component';
import { SandikDto } from '../../shared/models/index';

export interface DepoStats {
  toplam: number;
  ucK: number;
  seymen: number;
  grid: number;
}

export interface ProjectWarehouseStat {
  id: number;
  projeNo: string;
  projeTipiId: number;
  toplamSandik: number;
  ucKSandik: number;
  seymenSandik: number;
  gridSandik: number;
  sandiklar: SandikDto[];
  expanded: boolean;
}

@Component({
  selector: 'app-depo-durumu',
  standalone: true,
  imports: [TranslatePipe, NgClass, StatusBadgeComponent, BreadcrumbComponent],
  templateUrl: './depo-durumu.component.html',
  styleUrl: './depo-durumu.component.scss',
})
export class DepoDurumuComponent implements OnInit {
  ts = inject(TranslationService);
  private projeService = inject(ProjeService);
  private sandikService = inject(SandikService);
  private pdfService = inject(PdfService);
  private toastService = inject(ToastService);

  projectsList = signal<ProjectWarehouseStat[]>([]);
  filteredProjectsList = signal<ProjectWarehouseStat[]>([]);
  loading = signal(true);
  downloadingPdf = signal(false);
  searchTerm = signal('');
  reportMenuOpen = signal(false);

  // İstatistikler
  globalStats = signal<DepoStats>({ toplam: 0, ucK: 0, seymen: 0, grid: 0 });
  normalStats = signal<DepoStats>({ toplam: 0, ucK: 0, seymen: 0, grid: 0 });
  sahaStats = signal<DepoStats>({ toplam: 0, ucK: 0, seymen: 0, grid: 0 });
  yedekStats = signal<DepoStats>({ toplam: 0, ucK: 0, seymen: 0, grid: 0 });

  breadcrumb = [
    { label: 'Ana Kontrol Paneli', link: '/dashboard' },
    { label: 'Depo Durumu' },
  ];

  ngOnInit() {
    this.projeService.getProjeListesi().subscribe((res) => {
      if (res.isSuccess && res.value) {
        let completed = 0;
        const projects = res.value;
        const projectStats: ProjectWarehouseStat[] = [];

        if (projects.length === 0) {
          this.loading.set(false);
          return;
        }

        projects.forEach((p) => {
          this.sandikService.getSandiklar(p.id).subscribe((sRes) => {
            completed++;
            let sandiklar: SandikDto[] = [];
            if (sRes.isSuccess && sRes.value) {
              sandiklar = sRes.value.filter(s => this.isDepodaSayilacakSandik(s));
              // Sort crates
              sandiklar.sort((a, b) => this.extractNumber(a.sandikNo) - this.extractNumber(b.sandikNo));
            }

            const ucK = sandiklar.filter((s) => ['3K', '3k', 'Üçk'].includes(s.depoLokasyonMetni)).length;
            const seymen = sandiklar.filter((s) => s.depoLokasyonMetni === 'Seymen' || s.depoLokasyonMetni === 'SEYMEN').length;
            const grid = sandiklar.filter((s) => s.depoLokasyonMetni === 'Grid' || s.depoLokasyonMetni === 'GRID').length;

            if (sandiklar.length > 0) {
              projectStats.push({
                id: p.id,
                projeNo: p.projeNo,
                projeTipiId: p.projeTipiId,
                toplamSandik: sandiklar.length,
                ucKSandik: ucK,
                seymenSandik: seymen,
                gridSandik: grid,
                sandiklar: sandiklar,
                expanded: false
              });
            }

            if (completed === projects.length) {
              // Proje no'ya göre sırala
              projectStats.sort((a, b) => a.projeNo.localeCompare(b.projeNo));
              this.projectsList.set(projectStats);
              this.applyFilter();
              this.calculateAllStats(projectStats);
              this.loading.set(false);
            }
          });
        });
      } else {
        this.loading.set(false);
      }
    });
  }

  private extractNumber(sandikNo: string): number {
    if (!sandikNo) return 0;
    const match = sandikNo.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  private isDepodaSayilacakSandik(sandik: SandikDto): boolean {
    return sandik.durumId !== 4 && sandik.depodaSayilacakMi === true;
  }

  onSearch(event: Event) {
    this.searchTerm.set((event.target as HTMLInputElement).value.toLowerCase());
    this.applyFilter();
  }

  applyFilter() {
    const term = this.searchTerm();
    if (!term) {
      this.filteredProjectsList.set(this.projectsList());
      return;
    }
    
    // Hem proje adında hem de içindeki sandıkların herhangi birinde geçiyorsa projeyi göster
    const filtered = this.projectsList().filter(p => {
      const projeMatch = p.projeNo.toLowerCase().includes(term);
      const sandikMatch = p.sandiklar.some(s => 
        s.sandikNo.toLowerCase().includes(term) || 
        (s.depoLokasyonMetni && s.depoLokasyonMetni.toLowerCase().includes(term))
      );
      return projeMatch || sandikMatch;
    });
    this.filteredProjectsList.set(filtered);
  }

  calculateAllStats(projects: ProjectWarehouseStat[]) {
    const calcStats = (projs: ProjectWarehouseStat[]): DepoStats => {
      return {
        toplam: projs.reduce((sum, p) => sum + p.toplamSandik, 0),
        ucK: projs.reduce((sum, p) => sum + p.ucKSandik, 0),
        seymen: projs.reduce((sum, p) => sum + p.seymenSandik, 0),
        grid: projs.reduce((sum, p) => sum + p.gridSandik, 0),
      };
    };

    this.globalStats.set(calcStats(projects));
    this.normalStats.set(calcStats(projects.filter(p => p.projeTipiId === 1)));
    this.sahaStats.set(calcStats(projects.filter(p => p.projeTipiId === 2)));
    this.yedekStats.set(calcStats(projects.filter(p => p.projeTipiId === 3)));
  }

  toggleRow(project: ProjectWarehouseStat) {
    project.expanded = !project.expanded;
    // Signal güncellemesini tetikle
    this.filteredProjectsList.set([...this.filteredProjectsList()]);
  }

  getDonutPercentage(count: number, total: number): number {
    return total > 0 ? Math.round((count / total) * 100) : 0;
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
