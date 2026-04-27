import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgClass } from '@angular/common';
import { TranslationService } from '../../core/services/translation.service';
import { ProjeService } from '../../core/services/proje.service';
import { SandikService } from '../../core/services/sandik.service';
import { StatCardComponent } from '../../shared/components/stat-card/stat-card.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { BreadcrumbComponent } from '../../shared/components/breadcrumb/breadcrumb.component';
import { ProjeDto, SandikDto } from '../../shared/models/index';

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
  sandiklar: any[];
  expanded: boolean;
}

@Component({
  selector: 'app-depo-durumu',
  standalone: true,
  imports: [TranslatePipe, RouterLink, NgClass, StatCardComponent, StatusBadgeComponent, BreadcrumbComponent],
  templateUrl: './depo-durumu.component.html',
  styleUrl: './depo-durumu.component.scss',
})
export class DepoDurumuComponent implements OnInit {
  ts = inject(TranslationService);
  private projeService = inject(ProjeService);
  private sandikService = inject(SandikService);

  projectsList = signal<ProjectWarehouseStat[]>([]);
  filteredProjectsList = signal<ProjectWarehouseStat[]>([]);
  loading = signal(true);
  searchTerm = signal('');

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
            let sandiklar: any[] = [];
            if (sRes.isSuccess && sRes.value) {
              sandiklar = sRes.value.map(s => ({ ...s, projeAdi: p.projeNo }));
              // Sort crates
              sandiklar.sort((a, b) => this.extractNumber(a.sandikNo) - this.extractNumber(b.sandikNo));
            }

            const ucK = sandiklar.filter((s) => ['3K', '3k', 'Üçk'].includes(s.depoLokasyonMetni)).length;
            const seymen = sandiklar.filter((s) => s.depoLokasyonMetni === 'Seymen' || s.depoLokasyonMetni === 'SEYMEN').length;
            const grid = sandiklar.filter((s) => s.depoLokasyonMetni === 'Grid' || s.depoLokasyonMetni === 'GRID').length;

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
}
