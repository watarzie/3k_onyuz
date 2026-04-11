import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../../shared/i18n/i18n.service';
import { GridService } from '../../../core/services/grid.service';
import { AuthService } from '../../../core/auth/auth.service';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { BreadcrumbComponent } from '../../../shared/components/breadcrumb/breadcrumb.component';
import { StatCardComponent } from '../../../shared/components/stat-card/stat-card.component';
import { GridUrunDto, GridDurumGuncelleDto } from '../../../core/models/api-response.model';

@Component({
  selector: 'app-grid-urunler',
  standalone: true,
  imports: [RouterLink, NgClass, FormsModule, StatusBadgeComponent, BreadcrumbComponent, StatCardComponent],
  templateUrl: './grid-urunler.component.html',
  styleUrl: './grid-urunler.component.scss',
})
export class GridUrunlerComponent implements OnInit {
  i18n = inject(I18nService);
  private route = inject(ActivatedRoute);
  private gridService = inject(GridService);
  private auth = inject(AuthService);

  projeId = signal(0);
  urunler = signal<GridUrunDto[]>([]);
  filtered = signal<GridUrunDto[]>([]);
  loading = signal(true);
  selectedIds = signal<Set<number>>(new Set());
  filterDurum = signal('');
  searchTerm = signal('');

  // Side panel
  showPanel = signal(false);
  panelUrun = signal<GridUrunDto | null>(null);
  panelYeniDurum = signal('');
  panelSevkMiktari = signal<number | null>(null);
  panelNot = signal('');
  panelSaving = signal(false);

  // Toplu Sevk Modal
  showTopluSevkModal = signal(false);
  topluSevkNot = signal('');
  topluSevkSaving = signal(false);

  // Stats
  toplamUrun = computed(() => this.urunler().length);
  uretimde = computed(() => this.urunler().filter(u => u.gridDurumu === 'Uretimde').length);
  stokHazir = computed(() => this.urunler().filter(u => u.gridDurumu === 'StokHazir').length);
  sevkEdildi = computed(() => this.urunler().filter(u => u.gridDurumu === 'SevkEdildi').length);
  bekliyor = computed(() => this.urunler().filter(u => u.gridDurumu === 'Bekliyor').length);

  breadcrumb: { label: string; link?: string }[] = [];

  gridDurumlari = [
    { value: 'Bekliyor', label: 'Bekliyor', icon: '⚪' },
    { value: 'Uretimde', label: 'Üretimde', icon: '🔵' },
    { value: 'StokHazir', label: 'Stok Hazır', icon: '🟢' },
    { value: 'SevkEdildi', label: 'Sevk Edildi', icon: '🔵' },
    { value: 'KismiSevkEdildi', label: 'Kısmi Sevk', icon: '🟡' },
    { value: 'Bekletiliyor', label: 'Bekletiliyor', icon: '🟠' },
    { value: 'IptalEdildi', label: 'İptal Edildi', icon: '🔴' },
  ];

  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('projeId'));
    this.projeId.set(id);
    this.breadcrumb = [
      { label: 'Ana Kontrol Paneli', link: '/dashboard' },
      { label: 'Grid Modülü' },
    ];
    this.loadUrunler();
  }

  loadUrunler() {
    this.loading.set(true);
    this.gridService.getUrunler(this.projeId()).subscribe((res) => {
      this.loading.set(false);
      if (res.isSuccess && res.value) {
        this.urunler.set(res.value);
        this.applyFilter();
      }
    });
  }

  applyFilter() {
    let list = this.urunler();
    const durum = this.filterDurum();
    const term = this.searchTerm().toLowerCase();

    if (durum) list = list.filter(u => u.gridDurumu === durum);
    if (term) list = list.filter(u =>
      u.aciklama.toLowerCase().includes(term) ||
      u.barkodNo.toLowerCase().includes(term) ||
      u.sandikNo.toLowerCase().includes(term)
    );
    this.filtered.set(list);
  }

  onSearch(event: Event) {
    this.searchTerm.set((event.target as HTMLInputElement).value);
    this.applyFilter();
  }

  onFilterDurum(durum: string) {
    this.filterDurum.set(this.filterDurum() === durum ? '' : durum);
    this.applyFilter();
  }

  // ===== Checkbox =====

  toggleSelect(id: number) {
    const s = new Set(this.selectedIds());
    s.has(id) ? s.delete(id) : s.add(id);
    this.selectedIds.set(s);
  }

  toggleSelectAll() {
    if (this.selectedIds().size === this.filtered().length) {
      this.selectedIds.set(new Set());
    } else {
      this.selectedIds.set(new Set(this.filtered().map(u => u.cekiSatiriId)));
    }
  }

  isSelected(id: number): boolean { return this.selectedIds().has(id); }
  get allSelected(): boolean { return this.filtered().length > 0 && this.selectedIds().size === this.filtered().length; }
  get hasSelection(): boolean { return this.selectedIds().size > 0; }

  // ===== Grid Durum Label =====

  getDurumLabel(durum: string): string {
    return this.gridDurumlari.find(d => d.value === durum)?.label ?? durum;
  }

  getUcKDurumLabel(durum: string): string {
    const t = this.i18n.t().STATUS;
    const map: Record<string, string> = {
      TamGeldi: t.TAM_GELDI, EksikGeldi: t.EKSIK_GELDI, Gelmedi: t.GELMEDI,
      Paketlendi: t.PAKETLENDI, KontrolEdildi: t.KONTROL_EDILDI,
      IadeEdildi: t.IADE_EDILDI, Bekliyor: t.BEKLIYOR,
    };
    return map[durum] ?? durum;
  }

  // ===== Tekli Durum Güncelle (Side Panel) =====

  openPanel(urun: GridUrunDto) {
    this.panelUrun.set(urun);
    this.panelYeniDurum.set(urun.gridDurumu);
    this.panelSevkMiktari.set(urun.gridSevkMiktari ?? null);
    this.panelNot.set(urun.gridNotu ?? '');
    this.showPanel.set(true);
  }

  closePanel() {
    this.showPanel.set(false);
    this.panelUrun.set(null);
  }

  savePanel() {
    const urun = this.panelUrun();
    if (!urun) return;

    this.panelSaving.set(true);
    const dto: GridDurumGuncelleDto = {
      cekiSatiriId: urun.cekiSatiriId,
      projeId: this.projeId(),
      yeniDurum: this.panelYeniDurum(),
      sevkMiktari: this.panelSevkMiktari() ?? undefined,
      not: this.panelNot() || undefined,
    };

    this.gridService.durumGuncelle(dto).subscribe({
      next: (res) => {
        this.panelSaving.set(false);
        if (res.isSuccess) {
          this.closePanel();
          this.loadUrunler();
        }
      },
      error: () => this.panelSaving.set(false),
    });
  }

  // ===== Toplu Sevk =====

  openTopluSevk() {
    this.topluSevkNot.set('');
    this.showTopluSevkModal.set(true);
  }

  closeTopluSevk() { this.showTopluSevkModal.set(false); }

  confirmTopluSevk() {
    this.topluSevkSaving.set(true);
    this.gridService.topluSevk({
      projeId: this.projeId(),
      cekiSatiriIdler: Array.from(this.selectedIds()),
      not: this.topluSevkNot() || undefined,
    }).subscribe({
      next: (res) => {
        this.topluSevkSaving.set(false);
        if (res.isSuccess) {
          this.closeTopluSevk();
          this.selectedIds.set(new Set());
          this.loadUrunler();
        }
      },
      error: () => this.topluSevkSaving.set(false),
    });
  }

  // Sevk edilebilecek seçili ürün sayısı
  get sevkEdilebilirSecili(): number {
    return Array.from(this.selectedIds()).filter(id => {
      const u = this.urunler().find(u => u.cekiSatiriId === id);
      return u && (u.gridDurumu === 'StokHazir' || u.gridDurumu === 'KismiSevkEdildi');
    }).length;
  }
}
