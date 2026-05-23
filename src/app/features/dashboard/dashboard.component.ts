import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgClass } from '@angular/common';
import { TranslationService } from '../../core/services/translation.service';
import { StatCardComponent } from '../../shared/components/stat-card/stat-card.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { BreadcrumbComponent } from '../../shared/components/breadcrumb/breadcrumb.component';
import { BaseApiService } from '../../core/services/base-api.service';
import { API } from '../../core/constants/api-endpoints';

interface DashboardOzetDto {
  toplamProje: number;
  hazirlananProje: number;
  beklemedeProje: number;
  tamamlananProje: number;
  sevkEdilenProje: number;
  toplamSandik: number;
  eksikUrunSayisi: number;
  toplamDepoSandik: number;
  depoUcKSandik: number;
  depoSeymenSandik: number;
  depoGridSandik: number;
  depoDigerSandik: number;
  normalSandik: number;
  sahaSandik: number;
  yedekSandik: number;
  sahaYuzde: number;
  yedekYuzde: number;
}

interface DashboardPagedResultDto<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

interface DashboardProjeItemDto {
  id: number;
  projeNo: string;
  musteri: string;
  durumId: number;
  durumMetni: string;
  projeTipiId: number;
  projeTipiMetni: string;
  baslamaTarihi?: string;
  calismaGunSayisi?: number;
  gerceklesenSevkTarihi?: string;
  lokasyon?: string;
  sandikSayisi: number;
  toplamUrunSayisi: number;
  tamamlananUrunSayisi: number;
  tamamlanmaYuzdesi: number;
}

interface DashboardKritikProjeDto {
  projeNo: string;
  eksik: number;
  toplam: number;
  sandik: number;
}

interface DashboardEksikSiralamaDto {
  projeNo: string;
  lokasyon?: string;
  eksikYuzde: number;
  eksikAdet: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [TranslatePipe, StatCardComponent, StatusBadgeComponent, BreadcrumbComponent, RouterLink, NgClass],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  ts = inject(TranslationService);
  private api = inject(BaseApiService);

  private readonly projelerPageSize = 20;
  private readonly kritikPageSize = 12;
  private readonly eksikPageSize = 12;

  ozet = signal<DashboardOzetDto | null>(null);
  projeler = signal<DashboardProjeItemDto[]>([]);
  kritikProjeler = signal<DashboardKritikProjeDto[]>([]);
  topEksikProje = signal<DashboardEksikSiralamaDto[]>([]);

  loadingOzet = signal(true);
  loadingProjeler = signal(false);
  loadingKritik = signal(false);
  loadingEksik = signal(false);

  projelerPage = signal(0);
  kritikPage = signal(0);
  eksikPage = signal(0);

  projelerTotal = signal(0);
  kritikTotal = signal(0);
  eksikTotal = signal(0);

  projelerHasMore = signal(true);
  kritikHasMore = signal(true);
  eksikHasMore = signal(true);

  loading = computed(() => this.loadingOzet() || this.loadingProjeler());

  breadcrumb = [
    { label: 'Ana Kontrol Paneli' },
  ];

  toplamProje = computed(() => this.ozet()?.toplamProje ?? 0);
  aktifProje = computed(() => this.ozet()?.hazirlananProje ?? 0);
  toplamSandik = computed(() => this.ozet()?.toplamSandik ?? 0);
  eksikUrun = computed(() => this.ozet()?.eksikUrunSayisi ?? 0);
  sevkEdilen = computed(() => this.ozet()?.sevkEdilenProje ?? 0);

  toplamDepoSandik = computed(() => this.ozet()?.toplamDepoSandik ?? 0);
  depo3K = computed(() => this.ozet()?.depoUcKSandik ?? 0);
  depoSeymen = computed(() => this.ozet()?.depoSeymenSandik ?? 0);
  depoGrid = computed(() => this.ozet()?.depoGridSandik ?? 0);
  depoDiger = computed(() => this.ozet()?.depoDigerSandik ?? 0);

  devamEden = computed(() => this.ozet()?.hazirlananProje ?? 0);
  tamamlanan = computed(() => this.ozet()?.tamamlananProje ?? 0);
  durumOzetToplam = computed(() => this.aktifProje() + this.sevkEdilen() + this.tamamlanan());

  yedekSandik = computed(() => this.ozet()?.yedekSandik ?? 0);
  sahaSandik = computed(() => this.ozet()?.sahaSandik ?? 0);
  normalSandik = computed(() => this.ozet()?.normalSandik ?? 0);
  yedekYuzde = computed(() => this.ozet()?.yedekYuzde ?? 0);
  sahaYuzde = computed(() => this.ozet()?.sahaYuzde ?? 0);

  ngOnInit() {
    this.loadOzet();
    this.loadProjeler(true);
    this.loadKritikEksikler(true);
  }

  loadOzet() {
    this.loadingOzet.set(true);
    this.api.get<DashboardOzetDto>(API.DASHBOARD.OZET).subscribe((res) => {
      this.loadingOzet.set(false);
      if (res.isSuccess && res.value) {
        this.ozet.set(res.value);
      }
    });
  }

  loadProjeler(reset = false) {
    if (this.loadingProjeler()) return;
    if (!reset && !this.projelerHasMore()) return;

    if (reset) {
      this.projeler.set([]);
      this.projelerPage.set(0);
      this.projelerHasMore.set(true);
    }

    const nextPage = this.projelerPage() + 1;
    this.loadingProjeler.set(true);
    this.api.get<DashboardPagedResultDto<DashboardProjeItemDto>>(API.DASHBOARD.PROJELER(nextPage, this.projelerPageSize)).subscribe((res) => {
      this.loadingProjeler.set(false);
      if (res.isSuccess && res.value) {
        this.projeler.update(items => reset ? res.value!.items : [...items, ...res.value!.items]);
        this.projelerPage.set(res.value.page);
        this.projelerTotal.set(res.value.totalCount);
        this.projelerHasMore.set(res.value.hasMore);
      }
    });
  }

  loadKritikEksikler(reset = false) {
    if (this.loadingKritik()) return;
    if (!reset && !this.kritikHasMore()) return;

    if (reset) {
      this.kritikProjeler.set([]);
      this.kritikPage.set(0);
      this.kritikHasMore.set(true);
    }

    const nextPage = this.kritikPage() + 1;
    this.loadingKritik.set(true);
    this.api.get<DashboardPagedResultDto<DashboardKritikProjeDto>>(API.DASHBOARD.KRITIK_EKSIKLER(nextPage, this.kritikPageSize)).subscribe((res) => {
      this.loadingKritik.set(false);
      if (res.isSuccess && res.value) {
        this.kritikProjeler.update(items => reset ? res.value!.items : [...items, ...res.value!.items]);
        this.kritikPage.set(res.value.page);
        this.kritikTotal.set(res.value.totalCount);
        this.kritikHasMore.set(res.value.hasMore);

        // On initial load, also populate eksik sıralaması from the same data
        if (reset) {
          const eksikItems: DashboardEksikSiralamaDto[] = res.value!.items.map(k => ({
            projeNo: k.projeNo,
            eksikYuzde: k.toplam > 0 ? Math.round((k.eksik / k.toplam) * 100) : 0,
            eksikAdet: k.eksik,
          }));
          this.topEksikProje.set(eksikItems);
          this.eksikPage.set(res.value.page);
          this.eksikTotal.set(res.value.totalCount);
          this.eksikHasMore.set(res.value.hasMore);
        }
      }
    });
  }

  loadEksikSiralama(reset = false) {
    if (this.loadingEksik()) return;
    if (!reset && !this.eksikHasMore()) return;

    if (reset) {
      this.topEksikProje.set([]);
      this.eksikPage.set(0);
      this.eksikHasMore.set(true);
    }

    const nextPage = this.eksikPage() + 1;
    this.loadingEksik.set(true);
    this.api.get<DashboardPagedResultDto<DashboardEksikSiralamaDto>>(API.DASHBOARD.EKSIK_SIRALAMA(nextPage, this.eksikPageSize)).subscribe((res) => {
      this.loadingEksik.set(false);
      if (res.isSuccess && res.value) {
        this.topEksikProje.update(items => reset ? res.value!.items : [...items, ...res.value!.items]);
        this.eksikPage.set(res.value.page);
        this.eksikTotal.set(res.value.totalCount);
        this.eksikHasMore.set(res.value.hasMore);
      }
    });
  }

  onProjelerScroll(event: Event) {
    this.loadWhenNearBottom(event, () => this.loadProjeler());
  }

  onKritikScroll(event: Event) {
    this.loadWhenNearBottom(event, () => this.loadKritikEksikler());
  }

  onEksikScroll(event: Event) {
    this.loadWhenNearBottom(event, () => this.loadEksikSiralama());
  }



  formatBaslamaTarihi(value?: string): string {
    if (!value) return '-';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';

    return date.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  getCalismaMetni(p: DashboardProjeItemDto): string {
    const gunSayisi = p.calismaGunSayisi ?? this.hesaplaCalismaGunu(p.baslamaTarihi, p.gerceklesenSevkTarihi);
    const sevkEdildi = !!p.gerceklesenSevkTarihi || p.durumMetni === 'Sevk Edildi' || p.durumMetni === 'Eksik Sevk Edildi';

    if (sevkEdildi) return `${gunSayisi} günde sevk edildi`;
    if (gunSayisi === 0) return 'Bugün başladı';

    return `${gunSayisi} gündür çalışma devam ediyor`;
  }

  getProgressColor(yuzde: number): string {
    if (yuzde >= 80) return '#22c55e';
    if (yuzde >= 50) return '#3b82f6';
    if (yuzde >= 25) return '#f59e0b';
    return '#ef4444';
  }

  private loadWhenNearBottom(event: Event, loadMore: () => void) {
    const target = event.target as HTMLElement;
    const threshold = 72;
    if (target.scrollTop + target.clientHeight >= target.scrollHeight - threshold) {
      loadMore();
    }
  }

  private hesaplaCalismaGunu(baslamaTarihi?: string, bitisTarihi?: string): number {
    if (!baslamaTarihi) return 0;

    const baslama = new Date(baslamaTarihi);
    const bitis = bitisTarihi ? new Date(bitisTarihi) : new Date();

    if (Number.isNaN(baslama.getTime()) || Number.isNaN(bitis.getTime())) return 0;

    baslama.setHours(0, 0, 0, 0);
    bitis.setHours(0, 0, 0, 0);

    return Math.max(0, Math.floor((bitis.getTime() - baslama.getTime()) / 86400000));
  }
}
