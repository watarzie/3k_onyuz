import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgClass } from '@angular/common';
import { TranslationService } from '../../core/services/translation.service';
import { StatCardComponent } from '../../shared/components/stat-card/stat-card.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { BreadcrumbComponent } from '../../shared/components/breadcrumb/breadcrumb.component';
import { BaseApiService } from '../../core/services/base-api.service';
import { LookupService } from '../../core/services/lookup.service';
import { API } from '../../core/constants/api-endpoints';
import { LookupItem } from '../../shared/models/lookup.model';

interface DashboardOzetDto {
  toplamProje: number;
  hazirlananProje: number;
  beklemedeProje: number;
  tamamlananProje: number;
  sevkEdilenProje: number;
  eksikSevkEdilenProje: number;
  toplamSandik: number;
  eksikUrunSayisi: number;
  toplamDepoSandik: number;
  depoUcKSandik: number;
  depoSeymenSandik: number;
  depoGridSandik: number;
  depoDigerSandik: number;
  depoDagilimlari?: DashboardDepoDagilimDto[];
  normalDepoDagilimlari?: DashboardDepoDagilimDto[];
  sahaDepoDagilimlari?: DashboardDepoDagilimDto[];
  yedekDepoDagilimlari?: DashboardDepoDagilimDto[];
  projeTipiOzetleri?: DashboardProjeTipiOzetDto[];
  normalSandik: number;
  sahaSandik: number;
  yedekSandik: number;
  sahaYuzde: number;
  yedekYuzde: number;
}

interface DashboardDepoDagilimDto {
  depoLokasyonId: number;
  depoLokasyonMetni: string;
  sandikSayisi: number;
}

interface DashboardProjeTipiOzetDto {
  projeTipiId: number;
  projeTipiMetni: string;
  toplamProje: number;
  hazirlananProje: number;
  sevkEdilenProje: number;
  eksikSevkEdilenProje: number;
  tamamlananProje: number;
  toplamSandik: number;
  eksikUrunSayisi: number;
  toplamDepoSandik: number;
  tamamlanmaYuzdesi: number;
  depoDagilimlari?: DashboardDepoDagilimDto[];
}

interface DashboardDepoSegment {
  id: number;
  label: string;
  count: number;
  color: string;
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
  private lookupService = inject(LookupService);

  private readonly projelerPageSize = 20;
  private readonly kritikPageSize = 12;
  private readonly eksikPageSize = 12;
  private projelerRequestSeq = 0;

  ozet = signal<DashboardOzetDto | null>(null);
  projeler = signal<DashboardProjeItemDto[]>([]);
  kritikProjeler = signal<DashboardKritikProjeDto[]>([]);
  topEksikProje = signal<DashboardEksikSiralamaDto[]>([]);
  depoLokasyonlari = signal<LookupItem[]>([]);
  selectedProjeTipiId = signal<number | null>(null);

  loadingOzet = signal(true);
  loadingProjeler = signal(false);
  loadingKritik = signal(false);
  loadingEksik = signal(false);
  loadingDepoLokasyonlari = signal(true);

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
  dashboardSummaryLoading = computed(() => this.loadingOzet());
  dashboardDepoChartLoading = computed(() => this.loadingOzet() || this.loadingDepoLokasyonlari());

  breadcrumb = [
    { label: 'Ana Kontrol Paneli' },
  ];

  toplamProje = computed(() => this.ozet()?.toplamProje ?? 0);
  aktifProje = computed(() => this.ozet()?.hazirlananProje ?? 0);
  toplamSandik = computed(() => this.ozet()?.toplamSandik ?? 0);
  eksikUrun = computed(() => this.ozet()?.eksikUrunSayisi ?? 0);
  sevkEdilen = computed(() => this.ozet()?.sevkEdilenProje ?? 0);
  eksikSevkEdilen = computed(() => this.ozet()?.eksikSevkEdilenProje ?? 0);

  projeTipiOzetleri = computed(() => {
    const ozet = this.ozet();
    const items = ozet?.projeTipiOzetleri ?? [];

    if (items.length > 0) {
      return items.slice().sort((a, b) => a.projeTipiId - b.projeTipiId);
    }

    return [
      {
        projeTipiId: 1,
        projeTipiMetni: 'Normal',
        toplamProje: 0,
        hazirlananProje: 0,
        sevkEdilenProje: 0,
        eksikSevkEdilenProje: 0,
        tamamlananProje: 0,
        toplamSandik: ozet?.normalSandik ?? 0,
        eksikUrunSayisi: 0,
        toplamDepoSandik: this.sumDagilim(ozet?.normalDepoDagilimlari),
        tamamlanmaYuzdesi: 0,
        depoDagilimlari: ozet?.normalDepoDagilimlari ?? [],
      },
      {
        projeTipiId: 2,
        projeTipiMetni: 'Saha',
        toplamProje: 0,
        hazirlananProje: 0,
        sevkEdilenProje: 0,
        eksikSevkEdilenProje: 0,
        tamamlananProje: 0,
        toplamSandik: ozet?.sahaSandik ?? 0,
        eksikUrunSayisi: 0,
        toplamDepoSandik: this.sumDagilim(ozet?.sahaDepoDagilimlari),
        tamamlanmaYuzdesi: ozet?.sahaYuzde ?? 0,
        depoDagilimlari: ozet?.sahaDepoDagilimlari ?? [],
      },
      {
        projeTipiId: 3,
        projeTipiMetni: 'Yedek',
        toplamProje: 0,
        hazirlananProje: 0,
        sevkEdilenProje: 0,
        eksikSevkEdilenProje: 0,
        tamamlananProje: 0,
        toplamSandik: ozet?.yedekSandik ?? 0,
        eksikUrunSayisi: 0,
        toplamDepoSandik: this.sumDagilim(ozet?.yedekDepoDagilimlari),
        tamamlanmaYuzdesi: ozet?.yedekYuzde ?? 0,
        depoDagilimlari: ozet?.yedekDepoDagilimlari ?? [],
      },
    ];
  });

  selectedProjeTipiOzet = computed(() => {
    const selectedId = this.selectedProjeTipiId();
    if (!selectedId) return null;
    return this.projeTipiOzetleri().find(item => item.projeTipiId === selectedId) ?? null;
  });

  selectedDepoDagilimlari = computed(() => {
    const selected = this.selectedProjeTipiOzet();
    if (selected) return selected.depoDagilimlari ?? [];
    return this.ozet()?.depoDagilimlari ?? [];
  });

  depoGrafikBaslik = computed(() => {
    const selected = this.selectedProjeTipiOzet();
    return selected ? `${selected.projeTipiMetni} Depo Dağılımı` : 'Depo Dağılım Grafiği';
  });

  projelerBaslik = computed(() => {
    const selected = this.selectedProjeTipiOzet();
    return selected ? `${selected.projeTipiMetni} Projeler` : 'Projeler';
  });

  projeOzetiBaslik = computed(() => {
    const selected = this.selectedProjeTipiOzet();
    return selected ? `${selected.projeTipiMetni} Proje Özeti` : 'Proje Özeti';
  });

  projeOzetiHazirlanan = computed(() => this.selectedProjeTipiOzet()?.hazirlananProje ?? this.aktifProje());
  projeOzetiSevkEdilen = computed(() => this.selectedProjeTipiOzet()?.sevkEdilenProje ?? this.sevkEdilen());
  projeOzetiEksikSevk = computed(() => this.selectedProjeTipiOzet()?.eksikSevkEdilenProje ?? this.eksikSevkEdilen());
  projeOzetiTamamlanan = computed(() => this.selectedProjeTipiOzet()?.tamamlananProje ?? this.tamamlanan());
  projeOzetiToplam = computed(() =>
    this.projeOzetiHazirlanan() + this.projeOzetiSevkEdilen() + this.projeOzetiEksikSevk() + this.projeOzetiTamamlanan()
  );

  depoSegments = computed(() => {
    const ozet = this.ozet();
    const selectedDagilimlari = this.selectedDepoDagilimlari();
    const byId = new Map<number, LookupItem>();
    const counts = new Map<number, number>();

    selectedDagilimlari.forEach(item => {
      byId.set(item.depoLokasyonId, {
        id: item.depoLokasyonId,
        anahtar: item.depoLokasyonId,
        deger: item.depoLokasyonMetni || `Depo ${item.depoLokasyonId}`,
      });
      counts.set(item.depoLokasyonId, (counts.get(item.depoLokasyonId) ?? 0) + item.sandikSayisi);
    });

    if (!this.selectedProjeTipiId() && ozet && selectedDagilimlari.length === 0) {
      [
        { id: 2, label: '3K', count: ozet.depoUcKSandik ?? 0 },
        { id: 4, label: 'Seymen', count: ozet.depoSeymenSandik ?? 0 },
        { id: 5, label: 'Grid', count: ozet.depoGridSandik ?? 0 },
      ].forEach(item => {
        byId.set(item.id, { id: item.id, anahtar: item.id, deger: item.label });
        counts.set(item.id, item.count);
      });
    }

    this.depoLokasyonlari().forEach(lokasyon => byId.set(lokasyon.id, lokasyon));

    return this.sortLokasyonlar(Array.from(byId.values()).filter(lokasyon => !this.isBelirsiz(lokasyon)))
      .map((lokasyon, index) => ({
        id: lokasyon.id,
        label: lokasyon.deger,
        count: counts.get(lokasyon.id) ?? 0,
        color: this.getLokasyonColor(lokasyon, index),
      }));
  });
  positiveDepoSegments = computed(() => this.depoSegments().filter(segment => segment.count > 0));
  toplamDepoSandik = computed(() => this.depoSegments().reduce((sum, segment) => sum + segment.count, 0));

  devamEden = computed(() => this.ozet()?.hazirlananProje ?? 0);
  tamamlanan = computed(() => this.ozet()?.tamamlananProje ?? 0);
  durumOzetToplam = computed(() => this.aktifProje() + this.sevkEdilen() + this.eksikSevkEdilen() + this.tamamlanan());

  yedekSandik = computed(() => this.ozet()?.yedekSandik ?? 0);
  sahaSandik = computed(() => this.ozet()?.sahaSandik ?? 0);
  normalSandik = computed(() => this.ozet()?.normalSandik ?? 0);
  yedekYuzde = computed(() => this.ozet()?.yedekYuzde ?? 0);
  sahaYuzde = computed(() => this.ozet()?.sahaYuzde ?? 0);

  selectProjeTipi(tipId: number | null) {
    if (this.selectedProjeTipiId() === tipId) return;

    this.selectedProjeTipiId.set(tipId);
    this.loadProjeler(true);
  }

  ngOnInit() {
    this.loadDepoLokasyonlari();
    this.loadOzet();
    this.loadProjeler(true);
    this.loadKritikEksikler(true);
  }

  loadOzet() {
    this.loadingOzet.set(true);
    this.api.get<DashboardOzetDto>(API.DASHBOARD.OZET).subscribe({
      next: (res) => {
        this.loadingOzet.set(false);
        if (res.isSuccess && res.value) {
          this.ozet.set(res.value);
        }
      },
      error: () => {
        this.loadingOzet.set(false);
      }
    });
  }

  loadDepoLokasyonlari() {
    this.loadingDepoLokasyonlari.set(true);
    this.lookupService.getLookups(['LookupDepoLokasyon']).subscribe({
      next: (lookupRes) => {
        this.depoLokasyonlari.set(this.sortLokasyonlar(lookupRes['LookupDepoLokasyon'] ?? []));
        this.loadingDepoLokasyonlari.set(false);
      },
      error: () => {
        this.loadingDepoLokasyonlari.set(false);
      }
    });
  }

  loadProjeler(reset = false) {
    if (!reset && this.loadingProjeler()) return;
    if (!reset && !this.projelerHasMore()) return;

    if (reset) {
      this.projeler.set([]);
      this.projelerPage.set(0);
      this.projelerTotal.set(0);
      this.projelerHasMore.set(true);
    }

    const nextPage = this.projelerPage() + 1;
    const requestSeq = ++this.projelerRequestSeq;
    const projeTipiId = this.selectedProjeTipiId();
    this.loadingProjeler.set(true);
    this.api.get<DashboardPagedResultDto<DashboardProjeItemDto>>(
      API.DASHBOARD.PROJELER(nextPage, this.projelerPageSize, projeTipiId)
    ).subscribe({
      next: (res) => {
        if (requestSeq !== this.projelerRequestSeq) return;

        this.loadingProjeler.set(false);
        if (res.isSuccess && res.value) {
          const pageItems = res.value.items ?? [];

          this.projeler.update(items => reset ? pageItems : [...items, ...pageItems]);
          this.projelerPage.set(res.value.page);
          this.projelerTotal.set(res.value.totalCount);
          this.projelerHasMore.set(res.value.hasMore);
        }
      },
      error: () => {
        if (requestSeq === this.projelerRequestSeq) {
          this.loadingProjeler.set(false);
        }
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

  getDonutPercentage(count: number, total: number): number {
    return total > 0 ? (count / total) * 100 : 0;
  }

  getDonutOffset(index: number): number {
    const total = this.toplamDepoSandik();
    const previousTotal = this.positiveDepoSegments()
      .slice(0, index)
      .reduce((sum, segment) => sum + this.getDonutPercentage(segment.count, total), 0);
    return 25 - previousTotal;
  }

  getProjeTipiIcon(tipId: number): string {
    if (tipId === 2) return 'ri-map-pin-line';
    if (tipId === 3) return 'ri-shield-star-line';
    return 'ri-folder-line';
  }

  getProjeTipiClass(tipId: number): string {
    if (tipId === 2) return 'type-saha';
    if (tipId === 3) return 'type-yedek';
    return 'type-normal';
  }

  private sortLokasyonlar(lokasyonlar: LookupItem[]): LookupItem[] {
    return lokasyonlar
      .slice()
      .sort((a, b) => a.anahtar - b.anahtar || a.deger.localeCompare(b.deger, 'tr-TR'));
  }

  private isBelirsiz(lokasyon: LookupItem): boolean {
    return lokasyon.id === 1 || lokasyon.deger.toLocaleLowerCase('tr-TR') === 'belirsiz';
  }

  private sumDagilim(dagilimlar?: DashboardDepoDagilimDto[]): number {
    return (dagilimlar ?? []).reduce((sum, item) => sum + item.sandikSayisi, 0);
  }

  private getLokasyonColor(lokasyon: LookupItem, index = 0): string {
    const key = lokasyon.deger.trim().toUpperCase();
    if (key === '3K') return '#0EA5E9';
    if (key === 'SEYMEN') return '#078A55';
    if (key === 'GRID') return '#F59E0B';
    const palette = ['#3584FC', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4', '#64748B', '#14B8A6'];
    return palette[index % palette.length];
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
