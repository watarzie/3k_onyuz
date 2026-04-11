import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgClass } from '@angular/common';
import { I18nService } from '../../shared/i18n/i18n.service';
import { BaseApiService } from '../../core/services/base-api.service';
import { API } from '../../core/constants/api-endpoints';
import { StatCardComponent } from '../../shared/components/stat-card/stat-card.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { BreadcrumbComponent } from '../../shared/components/breadcrumb/breadcrumb.component';
import { ProjeDto, SandikDto, ApiResult } from '../../core/models/api-response.model';

@Component({
  selector: 'app-depo-durumu',
  standalone: true,
  imports: [RouterLink, NgClass, StatCardComponent, StatusBadgeComponent, BreadcrumbComponent],
  templateUrl: './depo-durumu.component.html',
  styleUrl: './depo-durumu.component.scss',
})
export class DepoDurumuComponent implements OnInit {
  i18n = inject(I18nService);
  private api = inject(BaseApiService);

  projeler = signal<ProjeDto[]>([]);
  allSandiklar = signal<SandikDto[]>([]);
  loading = signal(true);

  // Depo lokasyonları bazında sandık sayıları
  ucKSandik = signal(0);
  seymenSandik = signal(0);
  gridSandik = signal(0);
  toplamSandik = signal(0);

  breadcrumb = [
    { label: 'Ana Kontrol Paneli', link: '/dashboard' },
    { label: 'Depo Durumu' },
  ];

  ngOnInit() {
    this.api.get<ProjeDto[]>(API.PROJE.LIST).subscribe((res) => {
      if (res.isSuccess && res.value) {
        this.projeler.set(res.value);
        // Her proje için sandıkları çek
        let total: SandikDto[] = [];
        let completed = 0;
        const projects = res.value;

        if (projects.length === 0) {
          this.loading.set(false);
          return;
        }

        projects.forEach((p) => {
          this.api.get<SandikDto[]>(API.SANDIK.BY_PROJE(p.id)).subscribe((sRes) => {
            completed++;
            if (sRes.isSuccess && sRes.value) {
              total = [...total, ...sRes.value];
            }
            if (completed === projects.length) {
              this.allSandiklar.set(total);
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

  calculateStats(sandiklar: SandikDto[]) {
    this.toplamSandik.set(sandiklar.length);
    this.ucKSandik.set(sandiklar.filter((s) => s.depoLokasyonu === '3K' || s.depoLokasyonu === 'Üçk').length);
    this.seymenSandik.set(sandiklar.filter((s) => s.depoLokasyonu === 'Seymen' || s.depoLokasyonu === 'SEYMEN').length);
    this.gridSandik.set(sandiklar.filter((s) => s.depoLokasyonu === 'Grid' || s.depoLokasyonu === 'GRID').length);
  }

  // Donut chart yüzdeleri
  getDonutPercentage(count: number): number {
    const total = this.toplamSandik();
    return total > 0 ? Math.round((count / total) * 100) : 0;
  }
}
