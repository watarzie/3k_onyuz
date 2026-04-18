import { Component, inject, signal, computed, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslationService } from '../../../core/services/translation.service';
import { GridService } from '../../../core/services/grid.service';
import { ToastService } from '../../../core/services/toast.service';

import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { BreadcrumbComponent } from '../../../shared/components/breadcrumb/breadcrumb.component';
import { StatCardComponent } from '../../../shared/components/stat-card/stat-card.component';
import { CanWriteDirective } from '../../../shared/directives/can-write.directive';
import { ReadOnlyBannerComponent } from '../../../shared/components/readonly-banner/readonly-banner.component';
import { GridUrunDto, GridDurumGuncelleDto } from '../../../shared/models/index';

// ===== Durum tanımları =====
interface DurumSecenegi { value: string; label: string; color: string; bgClass: string; }

const GRID_DURUMLARI: DurumSecenegi[] = [
  { value: 'Tam Geldi',   label: 'TAM GELDİ',   color: '#25B003', bgClass: 'row-tam-geldi' },
  { value: 'Eksik Geldi', label: 'EKSİK GELDİ', color: '#FD5812', bgClass: 'row-eksik-geldi' },
  { value: 'Gelmedi',    label: 'GELMEDİ',      color: '#FF4023', bgClass: 'row-gelmedi' },
  { value: 'Trafo Sevk',  label: 'TRAFO SEVK',   color: '#00BCD4', bgClass: 'row-trafo-sevk' },
  { value: 'İptal',      label: 'İPTAL',        color: '#FFB200', bgClass: 'row-iptal' },
  { value: 'Siparişte',  label: 'SİPARİŞTE',    color: '#9C27B0', bgClass: 'row-sipariste' },
];

const SEVK_DURUMLARI: DurumSecenegi[] = [
  { value: 'Sevk Edildi',   label: 'SEVK EDİLDİ',    color: '#25B003', bgClass: '' },
  { value: 'Bekliyor',     label: 'BEKLİYOR',        color: '#FD5812', bgClass: '' },
  { value: 'Sevk Edilmedi', label: 'SEVK EDİLMEDİ',   color: '#FF4023', bgClass: '' },
];

@Component({
  selector: 'app-grid-urunler',
  standalone: true,
  imports: [RouterLink, NgClass, FormsModule, StatusBadgeComponent, BreadcrumbComponent, StatCardComponent, CanWriteDirective, ReadOnlyBannerComponent],
  templateUrl: './grid-urunler.component.html',
  styleUrl: './grid-urunler.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GridUrunlerComponent implements OnInit {
  ts = inject(TranslationService);
  private route = inject(ActivatedRoute);
  private gridService = inject(GridService);
  private toast = inject(ToastService);

  projeId = signal(0);
  urunler = signal<GridUrunDto[]>([]);
  filtered = signal<GridUrunDto[]>([]);
  loading = signal(true);
  selectedIds = signal<Set<number>>(new Set());
  filterDurum = signal('');
  searchTerm = signal('');

  // Side panel state
  showPanel = signal(false);
  panelUrun = signal<GridUrunDto | null>(null);
  panelDurum = signal('');
  panelGelenAdet = signal<number>(0);
  panelTrafoSevkAdet = signal<number>(0);
  panelSevkDurumu = signal('Sevk Edilmedi');
  panelSevkAdet = signal<number>(0);
  panelNot = signal('');
  panelSaving = signal(false);
  panelError = signal('');
  panelUyari = signal('');

  // Toplu Sevk Modal
  showTopluSevkModal = signal(false);
  topluSevkNot = signal('');
  topluSevkSaving = signal(false);

  // Stats
  toplamUrun = computed(() => this.urunler().length);
  tamGeldi = computed(() => this.urunler().filter(u => u.gridDurumu === 'Tam Geldi').length);
  eksikGeldi = computed(() => this.urunler().filter(u => u.gridDurumu === 'Eksik Geldi').length);
  gelmedi = computed(() => this.urunler().filter(u => u.gridDurumu === 'Gelmedi').length);
  trafoSevk = computed(() => this.urunler().filter(u => u.gridDurumu === 'Trafo Sevk').length);
  iptal = computed(() => this.urunler().filter(u => u.gridDurumu === 'İptal').length);
  sipariste = computed(() => this.urunler().filter(u => u.gridDurumu === 'Siparişte').length);
  bekliyor = computed(() => this.urunler().filter(u => u.gridDurumu === 'Bekliyor').length);

  gridDurumlari = GRID_DURUMLARI;
  sevkDurumlari = SEVK_DURUMLARI;

  breadcrumb: { label: string; link?: string }[] = [];

  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('projeId'));
    this.projeId.set(id);
    this.breadcrumb = [
      { label: 'Ana Kontrol Paneli', link: '/dashboard' },
      { label: 'Projeler', link: '/projeler' },
      { label: 'Grid Modülü' },
    ];
    this.loadUrunler();
  }

  loadUrunler() {
    this.loading.set(true);
    this.gridService.getUrunler(this.projeId()).subscribe((res) => {
      this.loading.set(false);
      if (res.isSuccess && res.value) {
        const sorted = [...res.value].sort((a, b) => {
          const na = parseInt(a.sandikNo.replace(/\D/g, '') || '0', 10);
          const nb = parseInt(b.sandikNo.replace(/\D/g, '') || '0', 10);
          return na - nb || a.siraNo - b.siraNo;
        });
        this.urunler.set(sorted);
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

  // ===== Satır rengi =====
  getRowClass(u: GridUrunDto): string {
    return GRID_DURUMLARI.find(d => d.value === u.gridDurumu)?.bgClass ?? '';
  }

  getDurumLabel(value: string): string {
    return GRID_DURUMLARI.find(d => d.value === value)?.label ?? value;
  }

  getSevkDurumLabel(value: string): string {
    return SEVK_DURUMLARI.find(d => d.value === value)?.label ?? value;
  }

  getDurumColor(value: string): string {
    return GRID_DURUMLARI.find(d => d.value === value)?.color ?? '#64748B';
  }

  getSevkDurumColor(value: string): string {
    return SEVK_DURUMLARI.find(d => d.value === value)?.color ?? '#64748B';
  }

  // 3K Karşılama Tipi Renkleri
  getUckDurumColor(value: string): string {
    const KARSILAMA_RENKLERI: Record<string, string> = {
      'Tam Geldi': '#25B003',
      'Eksik Geldi': '#FD5812',
      'Projeden Karşılandı': '#3584FC',
      'Stoktan Karşılandı': '#9C27B0',
      'Tedarikçiden Geldi': '#1B7D3A',
      'Gelmedi': '#808080',
      'Geri Gönderildi': '#D32F2F',
      'Hatalı Ürün': '#E65100',
    };
    return KARSILAMA_RENKLERI[value] || '#64748B';
  }

  // ===== Side Panel — Durum Güncelle =====
  openPanel(urun: GridUrunDto) {
    this.panelUrun.set(urun);
    this.panelDurum.set(urun.gridDurumu);
    this.panelGelenAdet.set(urun.gridGelenAdet);
    this.panelTrafoSevkAdet.set(urun.trafoSevkAdet);
    this.panelSevkDurumu.set(urun.gridSevkDurumu);
    this.panelSevkAdet.set(urun.gridSevkMiktari ?? 0);
    this.panelNot.set(urun.gridNotu ?? '');
    this.panelError.set('');
    this.recalcPanel();
    this.showPanel.set(true);
  }

  closePanel() {
    this.showPanel.set(false);
    this.panelUrun.set(null);
    this.panelError.set('');
  }

  onDurumChange(durum: string) {
    const u = this.panelUrun()!;
    this.panelDurum.set(durum);

    switch (durum) {
      case 'Tam Geldi':
        this.panelGelenAdet.set(u.istenenAdet);
        this.panelTrafoSevkAdet.set(0);
        break;
      case 'Eksik Geldi':
        this.panelGelenAdet.set(u.gridGelenAdet > 0 ? u.gridGelenAdet : 0);
        this.panelTrafoSevkAdet.set(0);
        break;
      case 'Gelmedi':
        this.panelGelenAdet.set(0);
        this.panelTrafoSevkAdet.set(0);
        this.panelSevkDurumu.set('Sevk Edilmedi');
        this.panelSevkAdet.set(0);
        break;
      case 'Trafo Sevk':
        this.panelTrafoSevkAdet.set(u.trafoSevkAdet > 0 ? u.trafoSevkAdet : 0);
        break;
      case 'İptal':
      case 'Siparişte':
        this.panelGelenAdet.set(0);
        this.panelTrafoSevkAdet.set(0);
        this.panelSevkDurumu.set('Sevk Edilmedi');
        this.panelSevkAdet.set(0);
        break;
    }
    this.recalcPanel();
  }

  recalcPanel() {
    const u = this.panelUrun();
    if (!u) return;
    const durum = this.panelDurum();
    let uyari = '';

    switch (durum) {
      case 'Tam Geldi': uyari = 'TAM GELDİ'; break;
      case 'Eksik Geldi': uyari = 'EKSİK GELDİ'; break;
      case 'Gelmedi': uyari = 'GELMEDİ'; break;
      case 'Trafo Sevk':
        const ta = this.panelTrafoSevkAdet();
        const ga = this.panelGelenAdet();
        if (ta > 0 && ga > 0) uyari = `KISMİ TRAFO SEVK + KISMİ GELİŞ`;
        else if (ta > 0) uyari = `TRAFODA SEVK: ${ta} ADET`;
        else uyari = 'TRAFO SEVK';
        break;
      case 'İptal': uyari = 'İPTAL'; break;
      case 'Siparişte': uyari = 'SİPARİŞTE'; break;
    }
    this.panelUyari.set(uyari);
    this.panelError.set('');
  }

  // Alan aktiflik kontrolleri
  get isGelenAdetAktif(): boolean {
    const d = this.panelDurum();
    return d === 'EksikGeldi' || d === 'TrafoSevk';
  }

  get isTrafoAktif(): boolean {
    return this.panelDurum() === 'TrafoSevk';
  }

  get isSevkAktif(): boolean {
    const d = this.panelDurum();
    return d === 'TamGeldi' || d === 'EksikGeldi';
  }

  get panelEksik(): number {
    const u = this.panelUrun();
    if (!u) return 0;
    if (this.panelDurum() === 'Iptal') return 0;
    return u.istenenAdet - this.panelGelenAdet() - this.panelTrafoSevkAdet();
  }

  // Validasyon
  validatePanel(): string | null {
    const u = this.panelUrun()!;
    const d = this.panelDurum();

    if (d === 'EksikGeldi') {
      if (this.panelGelenAdet() <= 0) return 'Gelen adet girilmelidir.';
      if (this.panelGelenAdet() >= u.istenenAdet) return 'Gelen adet miktardan küçük olmalıdır.';
    }

    if (d === 'TrafoSevk') {
      if (this.panelTrafoSevkAdet() <= 0) return 'Trafo sevk adeti girilmelidir.';
      if (this.panelTrafoSevkAdet() > u.istenenAdet) return 'Trafo sevk adeti miktardan büyük olamaz.';
      const toplam = this.panelGelenAdet() + this.panelTrafoSevkAdet();
      if (toplam > u.istenenAdet) return 'Toplam adet, çeki miktarını aşamaz.';
    }

    if (this.panelSevkDurumu() === 'SevkEdildi') {
      if (d !== 'TamGeldi' && d !== 'EksikGeldi') return 'Sevk için durum TamGeldi veya EksikGeldi olmalıdır.';
      if (this.panelSevkAdet() <= 0) return 'Sevk miktarı girilmelidir.';
    }

    return null;
  }

  savePanel() {
    const err = this.validatePanel();
    if (err) { this.panelError.set(err); return; }

    const u = this.panelUrun()!;
    this.panelSaving.set(true);
    this.panelError.set('');

    const dto: GridDurumGuncelleDto = {
      cekiSatiriId: u.cekiSatiriId,
      projeId: this.projeId(),
      yeniDurum: this.panelDurum(),
      gridGelenAdet: this.panelGelenAdet(),
      trafoSevkAdet: this.panelTrafoSevkAdet(),
      gridSevkDurumu: this.panelSevkDurumu(),
      sevkMiktari: this.isSevkAktif ? this.panelSevkAdet() : undefined,
      not: this.panelNot() || undefined,
    };

    this.gridService.durumGuncelle(dto).subscribe({
      next: (res) => {
        this.panelSaving.set(false);
        if (res.isSuccess) {
          this.toast.success('Ürün durumu başarıyla güncellendi.');
          this.closePanel();
          this.loadUrunler();
        } else {
          const msg = res.error ?? 'Kayıt başarısız.';
          this.panelError.set(msg);
          this.toast.error(msg);
        }
      },
      error: () => {
        this.panelSaving.set(false);
        this.panelError.set('Bir hata oluştu.');
        this.toast.error('Sunucu ile iletişim kurulamadı.');
      },
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
          this.toast.success('Seçili ürünler başarıyla sevk edildi.');
          this.closeTopluSevk();
          this.selectedIds.set(new Set());
          this.loadUrunler();
        } else {
          this.toast.error(res.error ?? 'Toplu sevk işlemi başarısız.');
        }
      },
      error: () => {
        this.topluSevkSaving.set(false);
        this.toast.error('Gelen hata nedeniyle toplu sevk yapılamadı.');
      },
    });
  }
}
