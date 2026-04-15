import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgClass } from '@angular/common';
import { TranslationService } from '../../../core/services/translation.service';
import { SandikService } from '../../../core/services/sandik.service';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { BreadcrumbComponent } from '../../../shared/components/breadcrumb/breadcrumb.component';
import { SandikDto } from '../../../shared/models/index';

@Component({
  selector: 'app-sandik-listesi',
  standalone: true,
  imports: [TranslatePipe, RouterLink, NgClass, StatusBadgeComponent, BreadcrumbComponent],
  templateUrl: './sandik-listesi.component.html',
  styleUrl: './sandik-listesi.component.scss',
})
export class SandikListesiComponent implements OnInit {
  ts = inject(TranslationService);
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
      { label: this.ts.translate('MENU.DASHBOARD'), link: '/dashboard' },
      { label: this.ts.translate('MENU.SANDIK_YONETIMI') },
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
      Aktif: this.ts.translate('STATUS.AKTIF'),
      Bekliyor: this.ts.translate('STATUS.BEKLIYOR'),
      Tamamlandi: this.ts.translate('STATUS.TAMAMLANDI'),
    };
    return map[durum] ?? durum;
  }
}
