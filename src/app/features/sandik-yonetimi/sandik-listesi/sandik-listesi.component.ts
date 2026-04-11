import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgClass } from '@angular/common';
import { I18nService } from '../../../shared/i18n/i18n.service';
import { SandikService } from '../sandik.service';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { BreadcrumbComponent } from '../../../shared/components/breadcrumb/breadcrumb.component';
import { SandikDto } from '../../../core/models/api-response.model';

@Component({
  selector: 'app-sandik-listesi',
  standalone: true,
  imports: [RouterLink, NgClass, StatusBadgeComponent, BreadcrumbComponent],
  templateUrl: './sandik-listesi.component.html',
  styleUrl: './sandik-listesi.component.scss',
})
export class SandikListesiComponent implements OnInit {
  i18n = inject(I18nService);
  private route = inject(ActivatedRoute);
  private sandikService = inject(SandikService);

  projeId = signal(0);
  sandiklar = signal<SandikDto[]>([]);
  filteredSandiklar = signal<SandikDto[]>([]);
  loading = signal(true);
  searchTerm = signal('');

  breadcrumb: { label: string; link?: string }[] = [];

  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('projeId'));
    this.projeId.set(id);
    this.breadcrumb = [
      { label: this.i18n.t().MENU.DASHBOARD, link: '/dashboard' },
      { label: this.i18n.t().MENU.SANDIK_YONETIMI },
    ];
    this.loadSandiklar();
  }

  loadSandiklar() {
    this.loading.set(true);
    this.sandikService.getSandiklar(this.projeId()).subscribe((res) => {
      this.loading.set(false);
      if (res.isSuccess && res.value) {
        this.sandiklar.set(res.value);
        this.filteredSandiklar.set(res.value);
      }
    });
  }

  onSearch(event: Event) {
    const term = (event.target as HTMLInputElement).value.toLowerCase();
    this.searchTerm.set(term);
    if (!term) {
      this.filteredSandiklar.set(this.sandiklar());
    } else {
      this.filteredSandiklar.set(
        this.sandiklar().filter(
          (s) =>
            s.sandikNo.toLowerCase().includes(term) ||
            s.durum.toLowerCase().includes(term)
        )
      );
    }
  }

  getDurumLabel(durum: string): string {
    const map: Record<string, string> = {
      Aktif: this.i18n.t().STATUS.AKTIF,
      Bekliyor: this.i18n.t().STATUS.BEKLIYOR,
      Tamamlandi: this.i18n.t().STATUS.TAMAMLANDI,
    };
    return map[durum] ?? durum;
  }
}
