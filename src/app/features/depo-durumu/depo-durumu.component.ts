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

  projeler = signal<ProjeDto[]>([]);
  allSandiklar = signal<any[]>([]);
  filteredSandiklar = signal<any[]>([]);
  loading = signal(true);
  searchTerm = signal('');

  // Depo lokasyonları bazında sandık sayıları
  ucKSandik = signal(0);
  seymenSandik = signal(0);
  gridSandik = signal(0);
  AblokSandik = signal(0);
  BblokSandik = signal(0);
  toplamSandik = signal(0);

  breadcrumb = [
    { label: 'Ana Kontrol Paneli', link: '/dashboard' },
    { label: 'Depo Durumu' },
  ];

  ngOnInit() {
    this.projeService.getProjeListesi().subscribe((res) => {
      if (res.isSuccess && res.value) {
        this.projeler.set(res.value);
        let total: any[] = [];
        let completed = 0;
        const projects = res.value;

        if (projects.length === 0) {
          this.loading.set(false);
          return;
        }

        projects.forEach((p) => {
          this.sandikService.getSandiklar(p.id).subscribe((sRes) => {
            completed++;
            if (sRes.isSuccess && sRes.value) {
              const mapped = sRes.value.map(s => ({ ...s, projeAdi: p.projeNo }));
              total = [...total, ...mapped];
            }
            if (completed === projects.length) {
              // Ascending sort by extracting numbers
              total.sort((a, b) => this.extractNumber(a.sandikNo) - this.extractNumber(b.sandikNo));
              this.allSandiklar.set(total);
              this.applyFilter();
              this.calculateStats(total);
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
      this.filteredSandiklar.set(this.allSandiklar());
      return;
    }
    const filtered = this.allSandiklar().filter(s => 
       s.sandikNo.toLowerCase().includes(term) ||
       s.projeAdi?.toLowerCase().includes(term) ||
       (s.depoLokasyonu && s.depoLokasyonu.toLowerCase().includes(term))
    );
    this.filteredSandiklar.set(filtered);
  }

  calculateStats(sandiklar: any[]) {
    this.toplamSandik.set(sandiklar.length);
    this.ucKSandik.set(sandiklar.filter((s) => ['3K', '3k', 'Üçk'].includes(s.depoLokasyonu)).length);
    this.seymenSandik.set(sandiklar.filter((s) => s.depoLokasyonu === 'Seymen' || s.depoLokasyonu === 'SEYMEN').length);
    this.gridSandik.set(sandiklar.filter((s) => s.depoLokasyonu === 'Grid' || s.depoLokasyonu === 'GRID').length);
    this.AblokSandik.set(sandiklar.filter((s) => s.depoLokasyonu === 'A-Blok').length);
    this.BblokSandik.set(sandiklar.filter((s) => s.depoLokasyonu === 'B-Blok').length);
  }

  // Donut chart yüzdeleri
  getDonutPercentage(count: number): number {
    const total = this.toplamSandik();
    return total > 0 ? Math.round((count / total) * 100) : 0;
  }
}
