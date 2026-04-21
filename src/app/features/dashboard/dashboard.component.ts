import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslationService } from '../../core/services/translation.service';
import { StatCardComponent } from '../../shared/components/stat-card/stat-card.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { BreadcrumbComponent } from '../../shared/components/breadcrumb/breadcrumb.component';
import { BaseApiService } from '../../core/services/base-api.service';
import { API } from '../../core/constants/api-endpoints';
import { ProjeDto, ApiResult } from '../../shared/models/index';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [TranslatePipe, StatCardComponent, StatusBadgeComponent, BreadcrumbComponent, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  ts = inject(TranslationService);
  private api = inject(BaseApiService);

  projeler = signal<ProjeDto[]>([]);
  loading = signal(true);

  breadcrumb = [
    { label: 'Ana Kontrol Paneli' },
  ];

  // Stats (computed from projeler)
  toplamProje = signal(0);
  aktifProje = signal(0);
  toplamSandik = signal(0);
  eksikUrun = signal(0);
  sevkEdilen = signal(0);

  ngOnInit() {
    this.api.get<ProjeDto[]>(API.PROJE.LIST).subscribe((res) => {
      this.loading.set(false);
      if (res.isSuccess && res.value) {
        this.projeler.set(res.value);
        this.toplamProje.set(res.value.length);
        this.aktifProje.set(res.value.filter(p => p.durumMetni === 'Aktif').length);
        this.toplamSandik.set(res.value.reduce((sum, p) => sum + p.sandikSayisi, 0));
        this.eksikUrun.set(res.value.reduce((sum, p) => sum + (p.toplamUrunSayisi - p.tamamlananUrunSayisi), 0));
        this.sevkEdilen.set(res.value.filter(p => p.durumMetni === 'SevkEdildi' || p.durumMetni === 'Sevkedildi' || p.durumMetni === 'Sevk Edildi').length);
      }
    });
  }

  getTamamlanmaYuzdesi(p: ProjeDto): number {
    if (p.toplamUrunSayisi === 0) return 0;
    return Math.round((p.tamamlananUrunSayisi / p.toplamUrunSayisi) * 100);
  }
}
