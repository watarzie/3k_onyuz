import { Component, inject, signal, computed, OnInit, OnDestroy, ChangeDetectionStrategy, WritableSignal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { TranslationService } from '../../../core/services/translation.service';
import { GridService } from '../../../core/services/grid.service';
import { SandikService } from '../../../core/services/sandik.service';
import { ProjeService } from '../../../core/services/proje.service';
import { ToastService } from '../../../core/services/toast.service';

import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { BreadcrumbComponent } from '../../../shared/components/breadcrumb/breadcrumb.component';
import { StatCardComponent } from '../../../shared/components/stat-card/stat-card.component';
import { CanWriteDirective } from '../../../shared/directives/can-write.directive';
import { ReadOnlyBannerComponent } from '../../../shared/components/readonly-banner/readonly-banner.component';
import { GridUrunDto, GridDurumGuncelleDto, ProjeDropdownDto } from '../../../shared/models/index';
import { GridDurum, GridSevkDurum, UcKDurum } from '../../../core/constants/enums';
import { PermissionService } from '../../../core/services/permission.service';

declare const pdfMake: any;

interface AmbarTalepItem {
  cekiSatiriId: number;
  barkodNo: string;
  aciklama: string;
  istenenMiktar: number;
  birim: string;
}

// ===== Durum tanımları =====
interface DurumSecenegi { id: number; value: string; label: string; color: string; bgClass: string; }

const GRID_DURUMLARI: DurumSecenegi[] = [
  { id: GridDurum.TamGeldi, value: 'Tam Geldi', label: 'TAM GELDİ', color: '#25B003', bgClass: 'row-tam-geldi' },
  { id: GridDurum.EksikGeldi, value: 'Eksik Geldi', label: 'EKSİK GELDİ', color: '#FD5812', bgClass: 'row-eksik-geldi' },
  { id: GridDurum.Gelmedi, value: 'Gelmedi', label: 'GELMEDİ', color: '#FF4023', bgClass: 'row-gelmedi' },
  { id: GridDurum.TrafoSevk, value: 'Trafo Sevk', label: 'TRAFO SEVK', color: '#00BCD4', bgClass: 'row-trafo-sevk' },
  { id: GridDurum.Iptal, value: 'İptal', label: 'İPTAL', color: '#FFB200', bgClass: 'row-iptal' },
  { id: GridDurum.GridKapandi, value: 'Grid Kapandı', label: 'GRİD KAPANDI', color: '#37474F', bgClass: 'row-grid-kapandi' },
];

const SEVK_DURUMLARI: DurumSecenegi[] = [
  { id: GridSevkDurum.SevkEdildi, value: 'Sevk Edildi', label: 'SEVK EDİLDİ', color: '#25B003', bgClass: '' },
  { id: GridSevkDurum.Bekliyor, value: 'Bekliyor', label: 'BEKLİYOR', color: '#FD5812', bgClass: '' },
  { id: GridSevkDurum.SevkEdilmedi, value: 'Sevk Edilmedi', label: 'SEVK EDİLMEDİ', color: '#FF4023', bgClass: '' },
  { id: GridSevkDurum.YenidenSevkGerekli, value: 'Yeniden Sevk Gerekli', label: 'YENİDEN SEVK GEREKLİ', color: '#D97706', bgClass: '' },
];

@Component({
  selector: 'app-grid-urunler',
  standalone: true,
  imports: [RouterLink, NgClass, FormsModule, StatusBadgeComponent, BreadcrumbComponent, StatCardComponent, CanWriteDirective, ReadOnlyBannerComponent],
  templateUrl: './grid-urunler.component.html',
  styleUrl: './grid-urunler.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GridUrunlerComponent implements OnInit, OnDestroy {
  ts = inject(TranslationService);
  private route = inject(ActivatedRoute);
  private gridService = inject(GridService);
  private sandikService = inject(SandikService);
  private projeService = inject(ProjeService);
  private toast = inject(ToastService);
  permissions = inject(PermissionService);

  projeId = signal(0);
  mevcutProje = signal<ProjeDropdownDto | null>(null);
  urunler = signal<GridUrunDto[]>([]);
  filtered = signal<GridUrunDto[]>([]);
  mevcutSandikNolari = signal<string[]>([]);
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
  panelAciklama = signal('');
  panelSaving = signal(false);
  panelError = signal('');
  panelUyari = signal('');

  // Toplu Sevk Modal
  showTopluSevkModal = signal(false);
  topluSevkAciklama = signal('');
  topluSevkSaving = signal(false);

  // Kalite & Süreç toplu atama
  showKaliteModal = signal(false);
  kaliteDurumSecim = signal(0);
  kaliteSaving = signal(false);
  showSurecModal = signal(false);
  surecDurumSecim = signal(0);
  surecSaving = signal(false);

  // Toplu İşlemler Dropdown Menü
  showTopluIslemlerMenu = signal(false);

  // Toplu İşlem Modal (Tam Geldi / Grid Kapandı / İptal / Geri Al)
  showTopluIslemModal = signal(false);
  topluIslemTipi = signal<'tamGeldi' | 'gridKapandi' | 'iptal' | 'geriAl'>('tamGeldi');
  topluIslemAciklama = signal('');
  topluIslemSaving = signal(false);

  // Talep Formu
  showAmbarTalepModal = signal(false);
  ambarTalepItems: WritableSignal<AmbarTalepItem[]> = signal([]);
  ambarTalepGenerating = signal(false);
  talepKaynakSecim = signal(1);

  // Manuel Ürün Ekle
  showManuelEkleModal = signal(false);
  yeniBarkod = signal('');
  yeniSandikNo = signal('');
  yeniAciklama = signal('');
  yeniAdet = signal(1);
  yeniBirim = signal(1); // Birim enum
  yeniNeden = signal('');
  yeniSandikIsmi = signal('');
  manuelSaving = signal(false);

  mevcutManuelSandikNo = computed(() => {
    const sandikNo = this.normalizeSandikNo(this.yeniSandikNo());
    if (!sandikNo) return null;

    const sandikNolari = [
      ...this.mevcutSandikNolari(),
      ...this.urunler().map(u => u.sandikNo),
    ];

    return sandikNolari.find(no => this.normalizeSandikNo(no) === sandikNo) ?? null;
  });

  sandikIsmiKilitli = computed(() => this.mevcutManuelSandikNo() !== null);

  // Stats
  toplamUrun = computed(() => this.urunler().length);
  tamGeldi = computed(() => this.urunler().filter(u => u.gridDurumuMetni === 'Tam Geldi').length);
  eksikGeldi = computed(() => this.urunler().filter(u => u.gridDurumuMetni === 'Eksik Geldi').length);
  gelmedi = computed(() => this.urunler().filter(u => u.gridDurumuMetni === 'Gelmedi').length);
  trafoSevk = computed(() => this.urunler().filter(u => u.gridDurumuMetni === 'Trafo Sevk').length);
  iptal = computed(() => this.urunler().filter(u => u.gridDurumuMetni === 'İptal').length);

  bekliyor = computed(() => this.urunler().filter(u => u.gridDurumuMetni === 'Bekliyor').length);
  projeBaslik = computed(() => {
    const proje = this.mevcutProje();
    return proje ? `${proje.projeNo} - ${proje.musteri}` : `Proje #${this.projeId()}`;
  });

  selectedUrunler = computed(() => this.urunler().filter(u => this.selectedIds().has(u.cekiSatiriId)));
  selectedTadilattaCount = computed(() => this.selectedUrunler().filter(u => this.isTadilatta(u)).length);
  topluSevkKilitMesaji = computed(() => {
    const count = this.selectedTadilattaCount();
    return count > 0 ? `${count} ürün Kalite: Tadilatta durumunda. Tadilattaki ürünler toplu sevk edilemez.` : '';
  });

  gridDurumlari = GRID_DURUMLARI;
  sevkDurumlari = SEVK_DURUMLARI.filter(d => d.id !== GridSevkDurum.YenidenSevkGerekli);

  breadcrumb: { label: string; link?: string }[] = [];

  private syncSub?: Subscription;

  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('projeId'));
    this.projeId.set(id);
    this.breadcrumb = [
      { label: 'Ana Kontrol Paneli', link: '/dashboard' },
      { label: 'Projeler', link: '/projeler' },
      { label: 'Grid Modülü' },
    ];
    this.loadProjeBilgisi();
    this.loadUrunler();
    this.loadSandiklar();

    // Diğer sekmelerden gelen grid güncelleme sinyallerini dinle
    this.syncSub = this.gridService.gridGuncellendi$.subscribe(() => {
      this.loadUrunler(false);
    });
  }

  ngOnDestroy() {
    if (this.syncSub) {
      this.syncSub.unsubscribe();
    }
  }

  loadUrunler(showLoader = true) {
    if (showLoader) {
      this.loading.set(true);
    }
    this.gridService.getUrunler(this.projeId()).subscribe((res) => {
      if (showLoader) {
        this.loading.set(false);
      }
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
    if (durum) list = list.filter(u => u.gridDurumuMetni === durum);
    if (term) list = list.filter(u =>
      u.aciklama.toLowerCase().includes(term) ||
      u.barkodNo.toLowerCase().includes(term) ||
      u.sandikNo.toLowerCase().includes(term)
    );
    this.filtered.set(list);
  }

  loadSandiklar() {
    this.sandikService.getSandiklar(this.projeId()).subscribe((res) => {
      if (res.isSuccess && res.value) {
        this.mevcutSandikNolari.set(res.value.map(s => s.sandikNo));
      }
    });
  }

  loadProjeBilgisi() {
    this.projeService.getProjeDropdownListesi().subscribe((res) => {
      if (res.isSuccess && res.value) {
        this.mevcutProje.set(res.value.find(p => p.id === this.projeId()) ?? null);
      }
    });
  }

  private normalizeSandikNo(value: string | null | undefined): string {
    return (value ?? '').trim().toLocaleLowerCase('tr-TR');
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
    if (!this.canSelectRows) return;

    const s = new Set(this.selectedIds());
    s.has(id) ? s.delete(id) : s.add(id);
    this.selectedIds.set(s);
  }
  toggleSelectAll() {
    if (!this.canSelectRows) return;

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
    return GRID_DURUMLARI.find(d => d.value === u.gridDurumuMetni)?.bgClass ?? '';
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
      'Sevk Adeti Tam Geldi': '#25B003',
      'Sevk Adeti Eksik Geldi': '#FD5812',
      'Projeden Karşılandı': '#3584FC',
      'Stoktan Karşılandı': '#9C27B0',
      'Tedarikçiden Geldi': '#1B7D3A',
      'Gelmedi': '#FF4023',
      'Geri Gönderildi': '#D32F2F',
      'Hatalı Ürün': '#E65100',
      'Bekliyor': '#64748B',
    };
    return KARSILAMA_RENKLERI[value] || '#64748B';
  }

  // ===== Side Panel — Durum Güncelle =====
  openPanel(urun: GridUrunDto) {
    this.panelUrun.set(urun);
    if (this.isParcaliEksikYenidenSevkUrun(urun)) {
      this.panelDurum.set('Tam Geldi');
      this.panelGelenAdet.set(urun.istenenAdet);
      this.panelTrafoSevkAdet.set(0);
    } else {
      this.panelDurum.set(urun.gridDurumuMetni);
      this.panelGelenAdet.set(urun.gridGelenAdet);
      this.panelTrafoSevkAdet.set(urun.trafoSevkAdet);
    }
    if (this.isGridYenidenSevkAcikUrun(urun)) {
      this.panelSevkDurumu.set('Sevk Edildi');
      this.panelSevkAdet.set(this.getYenidenSevkLimit(urun));
    } else {
      this.panelSevkDurumu.set(urun.gridSevkDurumuMetni);
      this.panelSevkAdet.set(urun.gridSevkMiktari ?? 0);
    }
    this.panelAciklama.set(urun.gridAciklama ?? '');
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

    if (this.isGridYenidenSevkAcik) {
      const mesaj = this.isParcaliEksikYenidenSevk
        ? `KALAN SEVK EDİLEBİLİR: ${this.maxSevkAdet} ${u.birim}`
        : `YENİDEN SEVK GEREKLİ: ${this.maxSevkAdet} ${u.birim}`;
      this.panelUyari.set(mesaj);
      this.panelError.set('');
      return;
    }

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
    }
    this.panelUyari.set(uyari);
    this.panelError.set('');
  }

  // Alan aktiflik kontrolleri
  get isGelenAdetAktif(): boolean {
    const d = this.panelDurum();
    return d === 'Eksik Geldi' || d === 'Trafo Sevk';
  }

  get isTrafoAktif(): boolean {
    return this.panelDurum() === 'Trafo Sevk';
  }

  get isSevkAktif(): boolean {
    if (this.isGridYenidenSevkAcik) return true;
    const d = this.panelDurum();
    return d === 'Tam Geldi' || d === 'Eksik Geldi' || (d === 'Trafo Sevk' && this.panelGelenAdet() > 0);
  }

  get maxSevkAdet(): number {
    const u = this.panelUrun();
    if (this.isGridYenidenSevkAcik && u) {
      return this.getYenidenSevkLimit(u);
    }
    return Math.max(this.panelGelenAdet(), 0);
  }

  onSevkDurumChange(durum: string) {
    this.panelSevkDurumu.set(durum);
    if (durum === 'Sevk Edildi' && this.panelSevkAdet() <= 0) {
      this.panelSevkAdet.set(this.maxSevkAdet);
    }
  }

  get panelEksik(): number {
    const u = this.panelUrun();
    if (!u) return 0;
    if (this.panelDurum() === 'İptal') return 0;
    return u.istenenAdet - this.panelGelenAdet() - this.panelTrafoSevkAdet();
  }

  // Validasyon
  validatePanel(): string | null {
    const u = this.panelUrun()!;
    const d = this.panelDurum();

    if (d === 'Eksik Geldi') {
      if (this.panelGelenAdet() <= 0) return 'Gelen adet girilmelidir.';
      if (this.panelGelenAdet() >= u.istenenAdet) return 'Gelen adet, toplam miktardan küçük olmalıdır.';
    }

    if (d === 'Trafo Sevk') {
      if (this.panelTrafoSevkAdet() <= 0) return 'Trafo sevk adeti girilmelidir.';
      if (this.panelTrafoSevkAdet() > u.istenenAdet) return 'Trafo sevk adeti miktardan büyük olamaz.';
      const toplam = this.panelGelenAdet() + this.panelTrafoSevkAdet();
      if (toplam > u.istenenAdet) return 'Toplam adet, çeki miktarını aşamaz.';
    }

    if (this.panelSevkDurumu() === 'Sevk Edildi') {
      if (d !== 'Tam Geldi' && d !== 'Eksik Geldi' && !(d === 'Trafo Sevk' && this.panelGelenAdet() > 0)) return 'Sevk için durum Tam Geldi, Eksik Geldi veya Grid gelen adedi olan Trafo Sevk olmalıdır.';
      if (this.panelSevkAdet() <= 0) return 'Sevk edilen miktar girilmelidir.';
      if (this.panelSevkAdet() > this.maxSevkAdet) {
        return this.isGridYenidenSevkAcik
          ? 'Sevk edilen miktar yeniden sevk gerekli adetten büyük olamaz.'
          : 'Sevk edilen miktar Grid gelen adetten büyük olamaz.';
      }
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
      yeniDurumId: GRID_DURUMLARI.find(d => d.value === this.panelDurum())?.id ?? 0,
      gridGelenAdet: this.panelGelenAdet(),
      trafoSevkAdet: this.panelTrafoSevkAdet(),
      gridSevkDurumuId: SEVK_DURUMLARI.find(d => d.value === this.panelSevkDurumu())?.id,
      sevkMiktari: this.isSevkAktif ? this.panelSevkAdet() : undefined,
      aciklama: this.panelAciklama() || undefined,
    };

    this.gridService.durumGuncelle(dto).subscribe({
      next: (res) => {
        this.panelSaving.set(false);
        if (res.isSuccess) {
          this.toast.success('Ürün durumu başarıyla güncellendi.');
          this.gridService.notifyGridUpdated();
          this.closePanel();
          this.loadUrunler(false);
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

  // ===== Durum Sıfırlama (Geri Alma) =====
  durumSifirla() {
    const u = this.panelUrun();
    if (!u) return;

    if (!confirm(`"${u.aciklama}" ürününün Grid durumunu sıfırlamak istediğinize emin misiniz?\n\nGridDurum, GelenAdet, TrafoSevkAdet, SevkDurumu vb. tüm Grid alanları sıfırlanacak ve ürün çeki yüklendiğindeki ham durumuna dönecektir.\n\nBu işlem geri alınamaz.`))
      return;

    this.panelSaving.set(true);
    this.panelError.set('');

    this.gridService.durumSifirla({
      cekiSatiriId: u.cekiSatiriId,
      projeId: this.projeId(),
    }).subscribe({
      next: (res) => {
        this.panelSaving.set(false);
        if (res.isSuccess) {
          this.toast.success('Grid durumu başarıyla sıfırlandı.');
          this.gridService.notifyGridUpdated();
          this.closePanel();
          this.loadUrunler(false);
        } else {
          const msg = res.error ?? 'Sıfırlama başarısız.';
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
    if (this.selectedTadilattaCount() > 0) {
      this.toast.error(this.topluSevkKilitMesaji());
      return;
    }

    this.topluSevkAciklama.set('');
    this.showTopluSevkModal.set(true);
  }
  closeTopluSevk() { this.showTopluSevkModal.set(false); }

  confirmTopluSevk() {
    if (this.selectedTadilattaCount() > 0) {
      this.toast.error(this.topluSevkKilitMesaji());
      return;
    }

    this.topluSevkSaving.set(true);
    this.gridService.topluSevk({
      projeId: this.projeId(),
      cekiSatiriIdler: Array.from(this.selectedIds()),
      aciklama: this.topluSevkAciklama() || undefined,
    }).subscribe({
      next: (res) => {
        this.topluSevkSaving.set(false);
        if (res.isSuccess) {
          this.toast.success('Seçili ürünler başarıyla sevk edildi.');
          this.gridService.notifyGridUpdated();
          this.closeTopluSevk();
          this.selectedIds.set(new Set());
          this.loadUrunler(false);
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
  // ===== Manuel Ürün Ekle =====
  openManuelEkleModal() {
    this.yeniBarkod.set('');
    this.yeniSandikNo.set('');
    this.yeniSandikIsmi.set('');
    this.yeniAciklama.set('');
    this.yeniAdet.set(1);
    this.yeniBirim.set(1);
    this.yeniNeden.set('');
    this.showManuelEkleModal.set(true);
  }

  closeManuelEkleModal() {
    this.showManuelEkleModal.set(false);
  }

  onYeniSandikNoChange(value: string) {
    this.yeniSandikNo.set(value);
    if (this.sandikIsmiKilitli()) {
      this.yeniSandikIsmi.set('');
    }
  }

  kaydetManuelUrun() {
    if (!this.yeniSandikNo().trim()) {
      this.toast.error('Sandık numarası zorunludur.');
      return;
    }
    if (!this.yeniAciklama().trim()) {
      this.toast.error('Açıklama alanı zorunludur.');
      return;
    }
    if (this.yeniAdet() <= 0) {
      this.toast.error('Adet 0\'dan büyük olmalıdır.');
      return;
    }

    this.manuelSaving.set(true);
    this.gridService.manuelUrunEkle({
      projeId: this.projeId(),
      sandikNo: this.yeniSandikNo().trim(),
      sandikIsmi: this.sandikIsmiKilitli() ? undefined : (this.yeniSandikIsmi().trim() || undefined),
      barkodNo: this.yeniBarkod().trim() || 'MANUEL',
      aciklama: this.yeniAciklama().trim(),
      istenenAdet: this.yeniAdet(),
      birimId: this.yeniBirim(),
      eklemeNedeni: this.yeniNeden().trim() || undefined
    }).subscribe({
      next: (res) => {
        this.manuelSaving.set(false);
        if (res.isSuccess) {
          this.toast.success('Manuel ürün başarıyla eklendi.');
          this.gridService.notifyGridUpdated();
          this.closeManuelEkleModal();
          this.loadUrunler(false);
          this.loadSandiklar();
        } else {
          this.toast.error(res.error ?? 'Ürün eklenemedi.');
        }
      },
      error: () => {
        this.manuelSaving.set(false);
        this.toast.error('Sunucu hatası oluştu.');
      }
    });
  }

  // ===== 3K İşlem Blokajı =====
  /** 3K tarafında işlem yapılmışsa Grid düzenleme yapamaz */
  isUcKIslemYapilmis(u: GridUrunDto): boolean {
    if (this.isTamamlanmisParcaliEksikSevkUrun(u)) return false;
    if (this.isGridYenidenSevkAcikUrun(u)) return false;
    return u.ucKDurumuId !== UcKDurum.Bekliyor || u.gelenMiktar > 0;
  }

  isYenidenSevkGerekliUrun(u: GridUrunDto | null | undefined): boolean {
    return !!u && u.gridSevkDurumuId === GridSevkDurum.YenidenSevkGerekli && (u.yenidenSevkGerekliAdet ?? 0) > 0;
  }

  isProjeGonderilenYenidenSevkUrun(u: GridUrunDto | null | undefined): boolean {
    return !!u &&
      u.gridSevkDurumuId === GridSevkDurum.SevkEdildi &&
      (u.gridSevkMiktari ?? 0) > 0 &&
      (u.projeGonderilen ?? 0) > 0 &&
      (u.kalanMiktar ?? 0) > 0;
  }

  isParcaliEksikYenidenSevkUrun(u: GridUrunDto | null | undefined): boolean {
    return !!u &&
      u.gridDurumuId === GridDurum.EksikGeldi &&
      u.gridSevkDurumuId === GridSevkDurum.SevkEdildi &&
      (u.gridSevkMiktari ?? 0) > 0 &&
      (u.kalanMiktar ?? 0) > 0;
  }

  isTamamlanmisParcaliEksikSevkUrun(u: GridUrunDto | null | undefined): boolean {
    return !!u &&
      u.gridDurumuId === GridDurum.TamGeldi &&
      u.gridSevkDurumuId === GridSevkDurum.SevkEdildi &&
      (u.gridSevkMiktari ?? 0) > 0 &&
      (u.gelenMiktar ?? 0) > (u.gridSevkMiktari ?? 0) &&
      (u.kalanMiktar ?? 0) === 0;
  }

  isGridYenidenSevkAcikUrun(u: GridUrunDto | null | undefined): boolean {
    return this.isYenidenSevkGerekliUrun(u) ||
      this.isProjeGonderilenYenidenSevkUrun(u) ||
      this.isParcaliEksikYenidenSevkUrun(u);
  }

  getYenidenSevkLimit(u: GridUrunDto): number {
    if (this.isYenidenSevkGerekliUrun(u)) {
      return Math.max(u.yenidenSevkGerekliAdet ?? 0, 0);
    }
    if (this.isProjeGonderilenYenidenSevkUrun(u)) {
      return Math.max(Math.min(u.projeGonderilen ?? 0, u.kalanMiktar ?? 0), 0);
    }
    if (this.isParcaliEksikYenidenSevkUrun(u)) {
      return Math.max(u.kalanMiktar ?? 0, 0);
    }
    return 0;
  }

  getGridSevkGorunum(u: GridUrunDto): number {
    const aktifSevk = Math.max(u.gridSevkMiktari ?? 0, 0);
    const gelen = Math.max(u.gelenMiktar ?? 0, 0);

    if (aktifSevk <= 0) return 0;

    if (u.ucKDurumuId === UcKDurum.Bekliyor && u.gridSevkDurumuId === GridSevkDurum.SevkEdildi) {
      return gelen + aktifSevk;
    }

    return Math.max(gelen, aktifSevk);
  }

  get isYenidenSevkGerekli(): boolean {
    return this.isYenidenSevkGerekliUrun(this.panelUrun());
  }

  get isParcaliEksikYenidenSevk(): boolean {
    return this.isParcaliEksikYenidenSevkUrun(this.panelUrun());
  }

  get isGridYenidenSevkAcik(): boolean {
    return this.isGridYenidenSevkAcikUrun(this.panelUrun());
  }

  getUcKBlokajMesaji(u: GridUrunDto): string {
    if (this.isTadilatta(u)) {
      return 'Kalite: Tadilatta — düzenleme kilitli';
    }
    if (this.isUcKIslemYapilmis(u)) {
      return '3K tarafında işlem yapılmış. Grid durumu değiştirilemez.';
    }
    return '';
  }

  /** Kalite = Tadilatta ise Grid düzenleme kilitlenir */
  isTadilatta(u: GridUrunDto): boolean {
    return u.kaliteDurumMetni === 'Tadilatta';
  }

  /** Menü bazlı kontrol - Kalite butonlarını görme yetkisi */
  get canKalite(): boolean {
    return this.permissions.canWrite('kalite-modulu');
  }

  /** Menü bazlı kontrol - Süreç butonlarını görme yetkisi */
  get canSurec(): boolean {
    return this.permissions.canWrite('surec-modulu');
  }

  get canGridWrite(): boolean {
    return this.permissions.canWrite('grid-modulu');
  }

  get canSelectRows(): boolean {
    return this.canGridWrite || this.canKalite || this.canSurec;
  }

  /** Kalite durumu rengi */
  getKaliteDurumColor(value?: string): string {
    if (!value) return '#94a3b8';
    return value === 'Onaylandı' ? '#25B003' : '#E65100';
  }

  /** Süreç durumu rengi */
  getSurecDurumColor(value?: string): string {
    const renkler: Record<string, string> = {
      'Ambar': '#607D8B',
      'İmalat': '#3584FC',
      'Tedarik': '#9C27B0',
      'Tedarik 3K Teslim': '#1B7D3A',
    };
    return value ? (renkler[value] || '#94a3b8') : '#94a3b8';
  }

  // ===== Toplu Kalite Atama =====
  openKaliteModal() {
    this.kaliteDurumSecim.set(0);
    this.showKaliteModal.set(true);
  }
  closeKaliteModal() { this.showKaliteModal.set(false); }

  confirmKalite() {
    if (!this.kaliteDurumSecim()) { this.toast.error('Kalite durumu seçiniz.'); return; }
    this.kaliteSaving.set(true);
    this.gridService.kaliteDurumGuncelle({
      projeId: this.projeId(),
      cekiSatiriIdler: Array.from(this.selectedIds()),
      kaliteDurumId: this.kaliteDurumSecim(),
    }).subscribe({
      next: (res) => {
        this.kaliteSaving.set(false);
        if (res.isSuccess) {
          this.toast.success('Kalite durumu başarıyla güncellendi.');
          this.gridService.notifyGridUpdated();
          this.closeKaliteModal();
          this.selectedIds.set(new Set());
          this.loadUrunler(false);
        } else {
          this.toast.error(res.error ?? 'Kalite güncelleme başarısız.');
        }
      },
      error: () => {
        this.kaliteSaving.set(false);
        this.toast.error('Sunucu hatası oluştu.');
      },
    });
  }

  // ===== Toplu Süreç Atama =====
  openSurecModal() {
    this.surecDurumSecim.set(0);
    this.showSurecModal.set(true);
  }
  closeSurecModal() { this.showSurecModal.set(false); }

  confirmSurec() {
    if (!this.surecDurumSecim()) { this.toast.error('Süreç durumu seçiniz.'); return; }
    this.surecSaving.set(true);
    this.gridService.surecDurumGuncelle({
      projeId: this.projeId(),
      cekiSatiriIdler: Array.from(this.selectedIds()),
      surecDurumId: this.surecDurumSecim(),
    }).subscribe({
      next: (res) => {
        this.surecSaving.set(false);
        if (res.isSuccess) {
          this.toast.success('Süreç durumu başarıyla güncellendi.');
          this.gridService.notifyGridUpdated();
          this.closeSurecModal();
          this.selectedIds.set(new Set());
          this.loadUrunler(false);
        } else {
          this.toast.error(res.error ?? 'Süreç güncelleme başarısız.');
        }
      },
      error: () => {
        this.surecSaving.set(false);
        this.toast.error('Sunucu hatası oluştu.');
      },
    });
  }

  // ===== Talep Formu =====
  openAmbarTalepModal() {
    const selected = this.selectedUrunler();
    if (selected.length === 0) {
      this.toast.error('Lütfen en az bir ürün seçiniz.');
      return;
    }
    const items: AmbarTalepItem[] = selected.map(u => ({
      cekiSatiriId: u.cekiSatiriId,
      barkodNo: u.barkodNo,
      aciklama: u.aciklama,
      istenenMiktar: u.istenenAdet,
      birim: u.birim,
    }));
    this.ambarTalepItems.set(items);
    this.talepKaynakSecim.set(1);
    this.showAmbarTalepModal.set(true);
  }

  closeAmbarTalepModal() {
    this.showAmbarTalepModal.set(false);
  }

  updateTalepMiktar(index: number, value: number) {
    const items = [...this.ambarTalepItems()];
    items[index] = { ...items[index], istenenMiktar: value };
    this.ambarTalepItems.set(items);
  }

  removeTalepItem(index: number) {
    const items = [...this.ambarTalepItems()];
    items.splice(index, 1);
    this.ambarTalepItems.set(items);
    if (items.length === 0) this.closeAmbarTalepModal();
  }

  generateAmbarTalepPdf() {
    const items = this.ambarTalepItems();
    if (items.length === 0) return;
    this.ambarTalepGenerating.set(true);

    try {
      const now = new Date();
      const dateStr = now.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const timeStr = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      const talepKaynak = this.getTalepKaynakLabel(this.talepKaynakSecim());
      const projeText = this.projeBaslik();

      const tableBody: any[][] = items.map((item, i) => [
        { text: (i + 1).toString(), alignment: 'center' },
        { text: item.barkodNo, alignment: 'center', bold: true },
        { text: item.aciklama },
        { text: `${item.istenenMiktar} ${item.birim}`, alignment: 'center' },
      ]);

      const docDefinition: any = {
        pageSize: 'A4',
        pageMargins: [30, 100, 30, 60],
        header: () => ({
          stack: [
            {
              canvas: [
                { type: 'rect', x: 0, y: 0, w: 595.28, h: 85, color: '#1e3a5f' },
                { type: 'rect', x: 0, y: 85, w: 595.28, h: 4, color: '#3b82f6' },
              ],
            },
            {
              text: 'TALEP FORMU',
              fontSize: 22,
              bold: true,
              color: '#ffffff',
              alignment: 'center',
              margin: [0, -75, 0, 0],
            },
            {
              text: `Tarih: ${dateStr}  |  Saat: ${timeStr}`,
              fontSize: 10,
              color: '#cbd5e1',
              alignment: 'center',
              margin: [0, 6, 0, 0],
            },
            {
              text: `Toplam ${items.length} kalem`,
              fontSize: 9,
              color: '#94a3b8',
              alignment: 'center',
              margin: [0, 4, 0, 0],
            },
          ],
        }),
        content: [
          {
            table: {
              widths: ['*', '*'],
              body: [
                [
                  { text: 'Talep Kaynağı', style: 'infoLabel' },
                  { text: talepKaynak, style: 'infoValue' },
                ],
                [
                  { text: 'Proje', style: 'infoLabel' },
                  { text: projeText, style: 'infoValue' },
                ],
              ],
            },
            layout: {
              hLineWidth: () => 0.5,
              vLineWidth: () => 0.5,
              hLineColor: () => '#dbeafe',
              vLineColor: () => '#dbeafe',
              fillColor: () => '#f8fafc',
              paddingLeft: () => 8,
              paddingRight: () => 8,
              paddingTop: () => 6,
              paddingBottom: () => 6,
            },
            margin: [0, 0, 0, 14],
          },
          {
            table: {
              headerRows: 1,
              widths: [25, 80, '*', 70],
              body: [
                [
                  { text: '#', style: 'tableHeader', alignment: 'center' },
                  { text: 'BARKOD', style: 'tableHeader', alignment: 'center' },
                  { text: '\u00dcR\u00dcN A\u00c7IKLAMASI', style: 'tableHeader' },
                  { text: '\u0130STENEN M\u0130KTAR', style: 'tableHeader', alignment: 'center' },
                ],
                ...tableBody,
              ],
            },
            layout: {
              hLineWidth: () => 0.5,
              vLineWidth: () => 0.5,
              hLineColor: (i: number) => i === 1 ? '#3b82f6' : '#e2e8f0',
              vLineColor: () => '#e2e8f0',
              fillColor: (rowIndex: number) => {
                if (rowIndex === 0) return '#1e3a5f';
                return rowIndex % 2 === 0 ? '#f5f7fa' : null;
              },
              paddingLeft: () => 8,
              paddingRight: () => 8,
              paddingTop: () => 6,
              paddingBottom: () => 6,
            },
          },
        ],
        footer: (currentPage: number, pageCount: number) => ({
          columns: [
            { text: 'Bu form sistem taraf\u0131ndan otomatik olu\u015fturulmu\u015ftur.', fontSize: 7, color: '#9ca3af', margin: [30, 0, 0, 0] },
            { text: `Sayfa ${currentPage} / ${pageCount}`, fontSize: 7, color: '#9ca3af', alignment: 'right', margin: [0, 0, 30, 0] },
          ],
        }),
        styles: {
          tableHeader: {
            bold: true,
            fontSize: 9,
            color: '#ffffff',
          },
          infoLabel: {
            bold: true,
            fontSize: 9,
            color: '#64748b',
          },
          infoValue: {
            bold: true,
            fontSize: 9,
            color: '#111827',
          },
        },
        defaultStyle: {
          fontSize: 9,
          color: '#1e1e1e',
        },
      };

      const fileName = `Talep_Formu_${dateStr.replace(/\./g, '-')}_${timeStr.replace(':', '')}`;
      pdfMake.createPdf(docDefinition).download(`${fileName}.pdf`);
      this.toast.success('Talep Formu PDF olarak indirildi.');

      // Seçili ürünlerin süreç durumunu talep kaynağına göre güncelle
      const cekiIdler = items.map(i => i.cekiSatiriId);
      this.gridService.surecDurumGuncelle({
        projeId: this.projeId(),
        cekiSatiriIdler: cekiIdler,
        surecDurumId: this.talepKaynakSecim(),
      }).subscribe({
        next: (res) => {
          if (res.isSuccess) {
            this.toast.success(`Seçili ürünlerin süreç durumu "${talepKaynak}" olarak güncellendi.`);
            this.gridService.notifyGridUpdated();
            this.selectedIds.set(new Set());
            this.loadUrunler(false);
          } else {
            this.toast.error(res.error ?? 'S\u00fcre\u00e7 durumu g\u00fcncellenemedi.');
          }
        },
        error: () => this.toast.error('S\u00fcre\u00e7 durumu g\u00fcncellenirken hata olu\u015ftu.'),
      });

      this.closeAmbarTalepModal();
    } catch (e) {
      console.error('PDF olu\u015fturma hatas\u0131:', e);
      this.toast.error('PDF olu\u015fturulurken bir hata olu\u015ftu.');
    } finally {
      this.ambarTalepGenerating.set(false);
    }
  }

  // ===== Toplu İşlem Modal Yönetimi =====
  getTalepKaynakLabel(value: number): string {
    switch (Number(value)) {
      case 2:
        return 'Üretim';
      case 3:
        return 'Tedarikçi';
      default:
        return 'Ambar';
    }
  }

  // ===== Toplu İşlem Modal Yönetimi =====
  private readonly topluIslemConfig: Record<string, { baslik: string; icon: string; renk: string; aciklama: string; onay: string }> = {
    tamGeldi: { baslik: 'Toplu Tam Geldi', icon: 'ri-checkbox-circle-line', renk: '#25B003', aciklama: 'Seçili ürünler Tam Geldi olarak işaretlenecek.', onay: 'Tam Geldi Yap' },
    gridKapandi: { baslik: 'Toplu Grid Kapandı', icon: 'ri-lock-line', renk: '#37474F', aciklama: 'Seçili ürünler Grid Kapandı olarak işaretlenecek.', onay: 'Grid Kapandı Yap' },
    iptal: { baslik: 'Toplu İptal', icon: 'ri-close-circle-line', renk: '#FFB200', aciklama: 'Seçili ürünler İptal olarak işaretlenecek.', onay: 'İptal Et' },
    geriAl: { baslik: 'Toplu Geri Al', icon: 'ri-arrow-go-back-line', renk: '#D32F2F', aciklama: 'Seçili ürünlerin Grid durumları sıfırlanacak. 3K işlem yapılmış ürünler atlanacaktır.', onay: 'Geri Al' },
  };

  topluIslemBaslik = computed(() => this.topluIslemConfig[this.topluIslemTipi()]?.baslik ?? '');
  topluIslemIcon = computed(() => this.topluIslemConfig[this.topluIslemTipi()]?.icon ?? '');
  topluIslemRenk = computed(() => this.topluIslemConfig[this.topluIslemTipi()]?.renk ?? '#333');
  topluIslemAciklamaMetni = computed(() => this.topluIslemConfig[this.topluIslemTipi()]?.aciklama ?? '');
  topluIslemOnayMetni = computed(() => this.topluIslemConfig[this.topluIslemTipi()]?.onay ?? '');

  openTopluIslemModal(tip: 'tamGeldi' | 'gridKapandi' | 'iptal' | 'geriAl') {
    this.topluIslemTipi.set(tip);
    this.topluIslemAciklama.set('');
    this.showTopluIslemModal.set(true);
  }
  closeTopluIslemModal() { this.showTopluIslemModal.set(false); }

  confirmTopluIslem() {
    const tip = this.topluIslemTipi();
    const ids = Array.from(this.selectedIds());
    if (ids.length === 0) return;

    this.topluIslemSaving.set(true);

    if (tip === 'geriAl') {
      this.gridService.topluSifirla({
        projeId: this.projeId(),
        cekiSatiriIdler: ids,
        aciklama: this.topluIslemAciklama() || undefined,
      }).subscribe({
        next: (res) => this.handleTopluIslemResult(res),
        error: () => this.handleTopluIslemError(),
      });
    } else {
      const durumMap: Record<string, number> = {
        tamGeldi: GridDurum.TamGeldi,
        gridKapandi: GridDurum.GridKapandi,
        iptal: GridDurum.Iptal,
      };
      this.gridService.topluDurumGuncelle({
        projeId: this.projeId(),
        cekiSatiriIdler: ids,
        hedefDurumId: durumMap[tip],
        aciklama: this.topluIslemAciklama() || undefined,
      }).subscribe({
        next: (res) => this.handleTopluIslemResult(res),
        error: () => this.handleTopluIslemError(),
      });
    }
  }

  private handleTopluIslemResult(res: any) {
    this.topluIslemSaving.set(false);
    if (res.isSuccess) {
      this.toast.success(`${this.topluIslemBaslik()} işlemi başarıyla tamamlandı.`);
      this.gridService.notifyGridUpdated();
      this.closeTopluIslemModal();
      this.selectedIds.set(new Set());
      this.loadUrunler(false);
    } else {
      this.toast.error(res.error ?? 'Toplu işlem başarısız.');
    }
  }

  private handleTopluIslemError() {
    this.topluIslemSaving.set(false);
    this.toast.error('Sunucu ile iletişim kurulamadı.');
  }
}
