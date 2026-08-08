import { Component, inject, signal, computed, OnInit, OnDestroy, ChangeDetectionStrategy, WritableSignal, HostListener } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DatePipe, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { TranslationService } from '../../../core/services/translation.service';
import { GridService } from '../../../core/services/grid.service';
import { SandikService } from '../../../core/services/sandik.service';
import { ProjeService } from '../../../core/services/proje.service';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { PdfService } from '../../../core/services/pdf.service';

import { BreadcrumbComponent } from '../../../shared/components/breadcrumb/breadcrumb.component';
import { StatCardComponent } from '../../../shared/components/stat-card/stat-card.component';
import { CanWriteDirective } from '../../../shared/directives/can-write.directive';
import { ReadOnlyBannerComponent } from '../../../shared/components/readonly-banner/readonly-banner.component';
import { GridUrunDto, GridDurumGuncelleDto, ProjeDropdownDto, CekiSatiriAnaVeriGuncelleDto, SahaTamamlamaIzDto } from '../../../shared/models/index';
import { GridDurum, GridSevkDurum, SurecDurum, UcKDurum } from '../../../core/constants/enums';
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
  imports: [NgClass, DatePipe, FormsModule, BreadcrumbComponent, StatCardComponent, CanWriteDirective, ReadOnlyBannerComponent],
  templateUrl: './grid-urunler.component.html',
  styleUrl: './grid-urunler.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GridUrunlerComponent implements OnInit, OnDestroy {
  readonly GridDurum = GridDurum;

  ts = inject(TranslationService);
  private route = inject(ActivatedRoute);
  private gridService = inject(GridService);
  private sandikService = inject(SandikService);
  private projeService = inject(ProjeService);
  private toast = inject(ToastService);
  private confirmService = inject(ConfirmService);
  private pdfService = inject(PdfService);
  permissions = inject(PermissionService);
  private readonly sevkEdilmisSandikMesaji = 'Bu ürün sevk edilmiş sandıkta olduğu için Grid işlemi yapılamaz.';
  private readonly tamamlanmisSurecMesaji = 'Süreci tamamlanan ürünlerin süreç durumu değiştirilemez.';

  projeId = signal(0);
  mevcutProje = signal<ProjeDropdownDto | null>(null);
  urunler = signal<GridUrunDto[]>([]);
  filtered = signal<GridUrunDto[]>([]);
  mevcutSandikNolari = signal<string[]>([]);
  loading = signal(true);
  selectedRowKeys = signal<Set<string>>(new Set());
  filterDurum = signal('');
  searchTerm = signal('');
  selectedSandikNo = signal('');

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

  canEditCekiVerisi = computed(() => this.permissions.canWrite('ceki-verisi-duzenle'));
  canDeleteCekiVerisi = computed(() => this.permissions.canWrite('ceki-verisi-sil'));
  canSahaAktarimGeriAl = computed(() => this.permissions.canWrite('saha-aktarim-geri-al'));
  canSeeEksikRapor = computed(() =>
    this.activeMenuKod === 'grid-modulu' &&
    this.mevcutProje()?.projeTipiId === 1 &&
    this.permissions.hasAccess('eksik-raporu')
  );
  showEksikRaporMenu = signal(false);
  eksikRaporDownloading = signal<'pdf' | 'excel' | null>(null);

  readonly birimSecenekleri = [
    { id: 1, label: 'Adet' },
    { id: 2, label: 'Set' },
    { id: 3, label: 'Metre' },
    { id: 4, label: 'Kg' },
    { id: 5, label: 'Litre' },
    { id: 6, label: 'Takim' },
    { id: 7, label: 'Paket' },
    { id: 8, label: 'Ton' },
    { id: 9, label: 'Metrekare' },
    { id: 10, label: 'Metrekup' },
  ];

  showAnaVeriPanel = signal(false);
  anaVeriUrun = signal<GridUrunDto | null>(null);
  anaSiraNo = signal(0);
  anaBarkodNo = signal('');
  anaOlcuResmiPozNo = signal('');
  anaAciklama = signal('');
  anaIstenenAdet = signal(0);
  anaBirimId = signal(1);
  anaSandikNo = signal('');
  anaSaving = signal(false);
  anaError = signal('');

  showSahaIzModal = signal(false);
  sahaIzModalUrun = signal<GridUrunDto | null>(null);
  sahaAktarimGeriAlSaving = signal<number | null>(null);

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
  sandikFilterOptions = computed(() => {
    const byKey = new Map<string, string>();

    for (const urun of this.urunler()) {
      const sandikNo = (urun.sandikNo ?? '').trim();
      if (!sandikNo) continue;

      const key = this.normalizeSandikNo(sandikNo);
      if (!byKey.has(key)) {
        byKey.set(key, sandikNo);
      }
    }

    return Array.from(byKey.values()).sort((a, b) => this.compareSandikNo(a, b));
  });
  projeBaslik = computed(() => {
    const proje = this.mevcutProje();
    return proje ? `${proje.projeNo} - ${proje.musteri}` : `Proje #${this.projeId()}`;
  });

  selectedUrunler = computed(() => {
    const keys = this.selectedRowKeys();
    return this.urunler().filter(u => keys.has(this.getRowKey(u)));
  });
  selectedSurecTamamlandiCount = computed(() =>
    this.selectedUrunler().filter(u => this.isSurecTamamlandi(u)).length
  );
  selectedTadilattaCount = computed(() => this.selectedUrunler().filter(u => this.isTadilatta(u)).length);
  topluSevkKilitMesaji = computed(() => {
    const count = this.selectedTadilattaCount();
    return count > 0 ? `${count} ürün Kalite: Tadilatta durumunda. Tadilattaki ürünler toplu sevk edilemez.` : '';
  });

  gridDurumlari = GRID_DURUMLARI;
  sevkDurumlari = SEVK_DURUMLARI.filter(d => d.id !== GridSevkDurum.YenidenSevkGerekli);

  breadcrumb: { label: string; link?: string }[] = [];

  private get activeMenuKod(): string {
    return this.route.snapshot.data?.['menuKod'] || 'grid-modulu';
  }

  get manuelIcerikTekilAdi(): string {
    return this.activeMenuKod === 'yedek-grid-modulu'
      ? 'manuel yedek malzemesi'
      : 'manuel saha ürünü';
  }

  private get manuelIcerikCogulAdi(): string {
    return this.activeMenuKod === 'yedek-grid-modulu'
      ? 'Manuel yedek malzemeleri'
      : 'Manuel saha ürünleri';
  }

  private getManuelIcerikGridMesaji(): string {
    return `${this.manuelIcerikCogulAdi} sandık içeriğidir; Grid işlemi gerektirmez.`;
  }

  private getManuelIcerikYonetimMesaji(): string {
    return `${this.manuelIcerikCogulAdi} sandık detayı üzerinden yönetilir.`;
  }

  private syncSub?: Subscription;

  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('projeId'));
    this.projeId.set(id);
    const isSaha = this.activeMenuKod === 'saha-grid-modulu';
    const isYedek = this.activeMenuKod === 'yedek-grid-modulu';
    const parentLabel = isSaha ? 'Saha Yönetimi' : isYedek ? 'Yedek Yönetimi' : 'Sandık Yönetimi';
    const parentLink = isSaha ? '/saha-yonetimi' : isYedek ? '/yedek-yonetimi' : '/sandik-yonetimi';
    this.breadcrumb = [
      { label: 'Ana Kontrol Paneli', link: '/dashboard' },
      { label: parentLabel, link: parentLink },
      { label: isSaha ? 'Saha Grid Modülü' : isYedek ? 'Yedek Grid Modülü' : 'Grid Modülü' },
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

  @HostListener('document:click')
  closeEksikRaporMenu() {
    this.showEksikRaporMenu.set(false);
  }

  toggleEksikRaporMenu() {
    if (this.eksikRaporDownloading() !== null) return;
    this.showEksikRaporMenu.update(value => !value);
  }

  indirEksikRapor(format: 'pdf' | 'excel') {
    if (!this.canSeeEksikRapor() || this.eksikRaporDownloading() !== null || this.projeId() <= 0) return;

    this.showEksikRaporMenu.set(false);
    this.eksikRaporDownloading.set(format);

    const request$ = format === 'pdf'
      ? this.pdfService.eksikUrunlerPdf(this.projeId())
      : this.pdfService.eksikUrunlerExcel(this.projeId());

    request$.subscribe({
      next: (blob) => {
        this.eksikRaporDownloading.set(null);
        const projeNo = this.safeFileName(this.mevcutProje()?.projeNo || `Proje_${this.projeId()}`);
        this.downloadBlob(blob, `${projeNo}_EksikRaporu.${format === 'pdf' ? 'pdf' : 'xlsx'}`);
        this.toast.success(`Eksik ürünler ${format === 'pdf' ? 'PDF' : 'Excel'} raporu indirildi.`);
      },
      error: () => {
        this.eksikRaporDownloading.set(null);
        this.toast.error('Eksik ürünler raporu indirilirken bir hata oluştu.');
      },
    });
  }

  private downloadBlob(blob: Blob, fileName: string) {
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => window.URL.revokeObjectURL(url), 0);
  }

  private safeFileName(value: string): string {
    return value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').trim() || 'Proje';
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
        this.temizleSevkKilitliSecimler();
        this.applyFilter();
      }
    });
  }

  applyFilter() {
    let list = this.urunler();
    const durum = this.filterDurum();
    const term = this.searchTerm().toLowerCase();
    const sandikNo = this.selectedSandikNo();
    if (durum) list = list.filter(u => u.gridDurumuMetni === durum);
    if (sandikNo) list = list.filter(u => this.normalizeSandikNo(u.sandikNo) === this.normalizeSandikNo(sandikNo));
    if (term) list = list.filter(u =>
      u.aciklama.toLowerCase().includes(term) ||
      u.barkodNo.toLowerCase().includes(term) ||
      (u.olcuResmiPozNo ?? '').toLowerCase().includes(term) ||
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

  private compareSandikNo(a: string, b: string): number {
    const numberA = this.extractSandikNumber(a);
    const numberB = this.extractSandikNumber(b);

    if (numberA !== numberB) {
      return numberA - numberB;
    }

    return a.localeCompare(b, 'tr-TR', { numeric: true, sensitivity: 'base' });
  }

  private extractSandikNumber(value: string): number {
    const match = value.match(/\d+/);
    return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER;
  }

  onSearch(event: Event) {
    this.searchTerm.set((event.target as HTMLInputElement).value);
    this.applyFilter();
  }

  onSandikFilterChange(sandikNo: string) {
    this.selectedSandikNo.set(sandikNo);
    this.applyFilter();
  }

  onFilterDurum(durum: string) {
    this.filterDurum.set(this.filterDurum() === durum ? '' : durum);
    this.applyFilter();
  }

  // ===== Checkbox =====
  getRowKey(urun: GridUrunDto): string {
    return urun.sandikIcerikId
      ? `sandik-icerik-${urun.sandikIcerikId}`
      : `ceki-satiri-${urun.cekiSatiriId}`;
  }

  toggleSelect(urun: GridUrunDto) {
    if (!this.canSelectRows) return;
    if (this.isSahaManuelIcerik(urun)) return;
    if (this.isSatirSevkKilidi(urun)) {
      this.toast.error(this.sevkEdilmisSandikMesaji);
      return;
    }

    const key = this.getRowKey(urun);
    const s = new Set(this.selectedRowKeys());
    s.has(key) ? s.delete(key) : s.add(key);
    this.selectedRowKeys.set(s);
  }
  toggleSelectAll() {
    if (!this.canSelectRows) return;

    const selectable = this.filtered().filter(u => !this.isCheckboxDisabled(u));
    const current = new Set(this.selectedRowKeys());

    if (selectable.length === 0) {
      this.selectedRowKeys.set(new Set());
      return;
    }

    if (selectable.every(u => current.has(this.getRowKey(u)))) {
      selectable.forEach(u => current.delete(this.getRowKey(u)));
    } else {
      selectable.forEach(u => current.add(this.getRowKey(u)));
    }

    this.selectedRowKeys.set(current);
  }
  isSelected(urun: GridUrunDto): boolean { return this.selectedRowKeys().has(this.getRowKey(urun)); }
  get allSelected(): boolean {
    const selectable = this.filtered().filter(u => !this.isCheckboxDisabled(u));
    return selectable.length > 0 && selectable.every(u => this.selectedRowKeys().has(this.getRowKey(u)));
  }
  get hasSelection(): boolean { return this.selectedRowKeys().size > 0; }
  get hasSelectableRows(): boolean { return this.filtered().some(u => !this.isCheckboxDisabled(u)); }

  private getSelectedCekiSatiriIds(): number[] {
    return Array.from(new Set(
      this.selectedUrunler()
        .map(u => u.cekiSatiriId)
        .filter(id => id > 0)
    ));
  }

  // ===== Satır rengi =====
  getRowClass(u: GridUrunDto): string {
    const kalanClass = (u.kalanMiktar ?? 0) > 0 ? 'row-kalan-var' : 'row-kalan-yok';
    const manuelClass = this.isSahaManuelIcerik(u) ? ' row-saha-manuel' : '';
    return this.isSatirSevkKilidi(u) ? `${kalanClass} row-sevk-kilitli${manuelClass}` : `${kalanClass}${manuelClass}`;
  }

  isSahaManuelIcerik(u: GridUrunDto): boolean {
    return u.isSahaManuelSandikIcerigi === true || (!!u.sandikIcerikId && u.cekiSatiriId <= 0);
  }

  hasSahaTamamlama(u: GridUrunDto | null | undefined): boolean {
    return !!u?.sahaTamamlamalari?.length;
  }

  isSahayaAktarilmis(u: GridUrunDto | null | undefined): boolean {
    return this.hasSahaTamamlama(u);
  }

  hasKaynakSahaIz(u: GridUrunDto | null | undefined): boolean {
    return !!u?.kaynakCekiSatiriId && !!u?.kaynakProjeNo;
  }

  getKaynakSahaLabel(u: GridUrunDto): string {
    const parts = [u.kaynakProjeNo ?? 'Kaynak proje'];
    if (u.kaynakSandikNo) parts.push(`Sandik ${u.kaynakSandikNo}`);
    if (u.kaynakSiraNo) parts.push(`#${u.kaynakSiraNo}`);
    return parts.join(' / ');
  }

  getSahaTamamlamaToplam(u: GridUrunDto | null | undefined): number {
    return (u?.sahaTamamlamalari ?? []).reduce((sum, iz) => sum + (Number(iz.miktar) || 0), 0);
  }

  formatMiktar(value: number | null | undefined): string {
    const numericValue = Number(value ?? 0);
    const fractionDigits = Number.isInteger(numericValue) ? 0 : 3;
    return numericValue.toLocaleString('tr-TR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: fractionDigits
    });
  }

  openSahaIzModal(urun: GridUrunDto, event?: MouseEvent): void {
    event?.stopPropagation();
    if (!this.hasSahaTamamlama(urun)) return;
    this.sahaIzModalUrun.set(urun);
    this.showSahaIzModal.set(true);
  }

  closeSahaIzModal(): void {
    this.showSahaIzModal.set(false);
    this.sahaIzModalUrun.set(null);
  }

  async sahaAktarimGeriAl(iz: SahaTamamlamaIzDto, event?: MouseEvent): Promise<void> {
    event?.stopPropagation();

    if (iz.sevkEdildiMi) {
      this.toast.error('Sevk edilmiş saha aktarımı geri alınamaz.');
      return;
    }

    const onay = await this.confirmService.ask({
      title: 'Saha Aktarımını Geri Al',
      message: `${iz.sahaProjeNo} / Sandık ${iz.sahaSandikNo} içindeki ${this.formatMiktar(iz.miktar)} ${iz.birim} aktarım kaynak projeye geri dönecek. Devam edilsin mi?`,
      confirmText: 'Geri Al',
      cancelText: 'Vazgeç',
      type: 'warning'
    });

    if (!onay) return;

    this.sahaAktarimGeriAlSaving.set(iz.sahaCekiSatiriId);
    this.projeService.sahaAktarimGeriAl(iz.sahaCekiSatiriId, 'Saha aktarımı kullanıcı tarafından geri alındı.').subscribe({
      next: (res) => {
        this.sahaAktarimGeriAlSaving.set(null);
        if (res.isSuccess) {
          this.toast.success('Saha aktarımı geri alındı.');
          this.closeSahaIzModal();
          this.gridService.notifyGridUpdated();
          this.loadUrunler(false);
          this.loadSandiklar();
        } else {
          this.toast.error(res.error ?? 'Saha aktarımı geri alınamadı.');
        }
      },
      error: () => {
        this.sahaAktarimGeriAlSaving.set(null);
        this.toast.error('Saha aktarımı geri alınırken sunucu hatası oluştu.');
      }
    });
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
  /** Satır tıklaması: checkbox/buton/input hariç tüm alanlarda düzenle panelini açar */
  onRowClick(urun: GridUrunDto, event: MouseEvent) {
    const el = event.target as HTMLElement;
    // Checkbox, buton veya input elemanlarına tıklanmışsa yoksay
    if (el.closest('button, input, a, .form-check-input')) return;
    // Yazma yetkisi yoksa açma
    if (!this.canGridWrite) return;
    // Kilitli satır kontrolü
    if (this.isSahaManuelIcerik(urun) || this.isSahayaAktarilmis(urun) || this.isSatirSevkKilidi(urun) || this.isUcKIslemYapilmis(urun) || this.isTadilatta(urun)) return;
    this.openPanel(urun);
  }

  openPanel(urun: GridUrunDto) {
    if (this.isSahaManuelIcerik(urun)) {
      this.toast.info(this.getManuelIcerikGridMesaji());
      return;
    }

    if (this.isSahayaAktarilmis(urun)) {
      this.toast.info('Bu ürün sahaya aktarıldığı için işlem saha projesinde yürütülmelidir.');
      return;
    }

    if (this.isSatirSevkKilidi(urun)) {
      this.toast.error(this.sevkEdilmisSandikMesaji);
      return;
    }

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

    if (this.panelSevkAdet() > 0 && this.panelSevkDurumu() !== 'Sevk Edildi') {
      return 'Sevk adeti girildiyse Grid sevk durumu Sevk Edildi seçilmelidir.';
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
    const u = this.panelUrun();
    if (!u) return;
    if (this.isSatirSevkKilidi(u)) {
      this.panelError.set(this.sevkEdilmisSandikMesaji);
      this.toast.error(this.sevkEdilmisSandikMesaji);
      return;
    }

    const err = this.validatePanel();
    if (err) { this.panelError.set(err); return; }

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
  hasGridResetState(u?: GridUrunDto | null): boolean {
    if (!u) return false;

    return (u.gridDurumuMetni !== 'Bekliyor' && u.gridDurumuMetni !== 'Gelmedi')
      || u.kaliteDurumId != null
      || u.surecDurumId != null;
  }

  durumSifirla(urun?: GridUrunDto) {
    const u = urun ?? this.panelUrun();
    if (!u) return;
    if (this.isSatirSevkKilidi(u)) {
      this.panelError.set(this.sevkEdilmisSandikMesaji);
      this.toast.error(this.sevkEdilmisSandikMesaji);
      return;
    }

    if (!confirm(`"${u.aciklama}" ürününün Grid durumunu sıfırlamak istediğinize emin misiniz?\n\nGrid alanlarıyla birlikte Kalite ve Süreç durumları da temizlenecek; ürün çeki yüklendiğindeki ham durumuna dönecektir.\n\nBu işlem geri alınamaz.`))
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
    if (this.hasSevkKilitliSecim()) return;

    if (this.selectedTadilattaCount() > 0) {
      this.toast.error(this.topluSevkKilitMesaji());
      return;
    }

    this.topluSevkAciklama.set('');
    this.showTopluSevkModal.set(true);
  }
  closeTopluSevk() { this.showTopluSevkModal.set(false); }

  confirmTopluSevk() {
    if (this.hasSevkKilitliSecim()) return;

    if (this.selectedTadilattaCount() > 0) {
      this.toast.error(this.topluSevkKilitMesaji());
      return;
    }

    this.topluSevkSaving.set(true);
    this.gridService.topluSevk({
      projeId: this.projeId(),
      cekiSatiriIdler: this.getSelectedCekiSatiriIds(),
      aciklama: this.topluSevkAciklama() || undefined,
    }).subscribe({
      next: (res) => {
        this.topluSevkSaving.set(false);
        if (res.isSuccess) {
          this.toast.success('Seçili ürünler başarıyla sevk edildi.');
          this.gridService.notifyGridUpdated();
          this.closeTopluSevk();
          this.selectedRowKeys.set(new Set());
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
  isSatirSevkKilidi(u: GridUrunDto): boolean {
    return u.sandikSevkEdildiMi === true;
  }

  isCheckboxDisabled(u: GridUrunDto): boolean {
    if (this.isSahaManuelIcerik(u)) return true;
    if (this.isSahayaAktarilmis(u)) return true;
    return this.isSatirSevkKilidi(u);
  }

  private temizleSevkKilitliSecimler() {
    const secilebilirSatirlar = new Set(this.urunler()
      .filter(u => !this.isCheckboxDisabled(u))
      .map(u => this.getRowKey(u)));
    const temizSecim = Array.from(this.selectedRowKeys()).filter(key => secilebilirSatirlar.has(key));
    if (temizSecim.length !== this.selectedRowKeys().size) {
      this.selectedRowKeys.set(new Set(temizSecim));
    }
  }

  private hasSevkKilitliSecim(): boolean {
    const kilitliSayisi = this.selectedUrunler().filter(u => this.isSatirSevkKilidi(u)).length;
    if (kilitliSayisi === 0) return false;

    this.toast.error(`${kilitliSayisi} seçili ürün sevk edilmiş sandıkta olduğu için Grid işlemi yapılamaz.`);
    return true;
  }

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
    if (this.isSahaManuelIcerik(u)) {
      return this.getManuelIcerikGridMesaji();
    }
    if (this.isSatirSevkKilidi(u)) {
      return this.sevkEdilmisSandikMesaji;
    }
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

  isGridResetBlocked(u: GridUrunDto): boolean {
    return this.isSahaManuelIcerik(u)
      || this.isSahayaAktarilmis(u)
      || this.isSatirSevkKilidi(u)
      || this.isUcKIslemYapilmis(u);
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
    return this.permissions.canWrite(this.activeMenuKod);
  }

  get canSelectRows(): boolean {
    return this.canGridWrite || this.canKalite || this.canSurec || this.canDeleteCekiVerisi();
  }

  openAnaVeriPanel(urun: GridUrunDto) {
    if (!this.canEditCekiVerisi()) return;
    if (this.isSahaManuelIcerik(urun)) {
      this.toast.info(this.getManuelIcerikYonetimMesaji());
      return;
    }
    if (this.isSatirSevkKilidi(urun)) {
      this.toast.error(this.sevkEdilmisSandikMesaji);
      return;
    }

    this.anaVeriUrun.set(urun);
    this.anaSiraNo.set(urun.siraNo);
    this.anaBarkodNo.set(urun.barkodNo ?? '');
    this.anaOlcuResmiPozNo.set(urun.olcuResmiPozNo ?? '');
    this.anaAciklama.set(urun.aciklama ?? '');
    this.anaIstenenAdet.set(this.getAnaIstenenAdet(urun));
    this.anaBirimId.set(urun.birimId ?? this.mapBirimId(urun.birim));
    this.anaSandikNo.set(urun.sandikNo ?? '');
    this.anaError.set('');
    this.showAnaVeriPanel.set(true);
  }

  closeAnaVeriPanel() {
    this.showAnaVeriPanel.set(false);
    this.anaVeriUrun.set(null);
    this.anaError.set('');
    this.anaSaving.set(false);
  }

  saveAnaVeriPanel() {
    const urun = this.anaVeriUrun();
    if (!urun || this.anaSaving()) return;
    if (this.isSahaManuelIcerik(urun)) {
      this.anaError.set(this.getManuelIcerikYonetimMesaji());
      return;
    }
    if (this.isSatirSevkKilidi(urun)) {
      this.anaError.set(this.sevkEdilmisSandikMesaji);
      this.toast.error(this.sevkEdilmisSandikMesaji);
      return;
    }

    const dto: CekiSatiriAnaVeriGuncelleDto = {
      cekiSatiriId: urun.cekiSatiriId,
      siraNo: this.toNumber(this.anaSiraNo()),
      olcuResmiPozNo: this.anaOlcuResmiPozNo().trim() || null,
      barkodNo: this.anaBarkodNo().trim(),
      aciklama: this.anaAciklama().trim(),
      istenenAdet: this.toNumber(this.anaIstenenAdet()),
      birimId: this.toNumber(this.anaBirimId()),
      sandikNo: this.anaSandikNo().trim(),
    };

    const validation = this.validateAnaVeri(dto);
    if (validation) {
      this.anaError.set(validation);
      return;
    }

    this.anaSaving.set(true);
    this.sandikService.cekiSatiriAnaVeriGuncelle(dto).subscribe({
      next: (res) => {
        this.anaSaving.set(false);
        if (res.isSuccess) {
          this.toast.success('Ceki verisi guncellendi.');
          this.closeAnaVeriPanel();
          this.gridService.notifyGridUpdated();
          this.loadUrunler(false);
          this.loadSandiklar();
        } else {
          const message = res.error ?? 'Ceki verisi guncellenemedi.';
          this.anaError.set(message);
          this.toast.error(message);
        }
      },
      error: () => {
        this.anaSaving.set(false);
        const message = 'Sunucu ile iletisim kurulamadi.';
        this.anaError.set(message);
        this.toast.error(message);
      },
    });
  }

  async deleteSelectedCekiSatirlari() {
    const ids = this.getSelectedCekiSatiriIds();
    if (!this.canDeleteCekiVerisi() || ids.length === 0) return;
    if (this.hasSevkKilitliSecim()) return;

    const onay = await this.confirmService.ask({
      title: 'Çeki Satırlarını Sil',
      message: `<strong>${ids.length}</strong> seçili çeki satırı silinecek.<br><br><small class="text-muted">İlgili sandık içeriği, stok hareketi ve uygun transfer bağlantıları da temizlenir. Bu işlem geri alınamaz.</small>`,
      confirmText: 'Evet, Sil',
      cancelText: 'Vazgeç',
      type: 'danger'
    });

    if (!onay) return;

    this.sandikService.cekiSatirlariSil(ids).subscribe({
      next: (res) => {
        if (res.isSuccess) {
          const silinen = res.value?.silinenSatirSayisi ?? ids.length;
          this.toast.success(`${silinen} çeki satırı silindi.`);
          this.selectedRowKeys.set(new Set());
          this.gridService.notifyGridUpdated();
          this.loadUrunler(false);
          this.loadSandiklar();
        } else {
          this.toast.error(res.error ?? 'Çeki satırları silinemedi.');
        }
      },
      error: () => this.toast.error('Silme sırasında sunucu ile iletişim kurulamadı.'),
    });
  }

  private validateAnaVeri(dto: CekiSatiriAnaVeriGuncelleDto): string | null {
    if (dto.siraNo <= 0) return 'Sira no sifirdan buyuk olmalidir.';
    if (!dto.barkodNo) return 'Barkod zorunludur.';
    if (!dto.aciklama) return 'Tanim zorunludur.';
    if (dto.istenenAdet <= 0) return 'Miktar sifirdan buyuk olmalidir.';
    if (!dto.sandikNo) return 'Sandik no zorunludur.';
    return null;
  }

  private toNumber(value: unknown): number {
    const parsed = typeof value === 'number' ? value : Number(String(value ?? '').replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private mapBirimId(birim?: string | null): number {
    const value = (birim ?? '').trim().toLocaleLowerCase('tr-TR');
    const item = this.birimSecenekleri.find(x => x.label.toLocaleLowerCase('tr-TR') === value);
    return item?.id ?? 1;
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
      'Siparişte': '#D97706',
      'Tamamlandı': '#25B003',
    };
    return value ? (renkler[value] || '#94a3b8') : '#94a3b8';
  }

  /**
   * Süreç durumu gösterimi — Grid eksik miktarı 0 ise (ürünler tam geldiyse)
   * otomatik olarak "Tamamlandı" gösterilir; iptal satırlarında süreç atanmaz.
   */
  getEffectiveSurecDurum(u: GridUrunDto): string | undefined {
    if (u.gridDurumuId !== GridDurum.Iptal && u.gridEksikMiktar === 0) {
      return 'Tamamlandı';
    }
    return u.surecDurumMetni ?? undefined;
  }

  getSandikMiktari(urun: GridUrunDto): number {
    return Math.max(Number(urun.sandikMiktari ?? urun.istenenAdet ?? 0), 0);
  }

  getAnaIstenenAdet(urun: GridUrunDto): number {
    return Math.max(Number(urun.anaIstenenAdet ?? urun.istenenAdet ?? 0), 0);
  }

  hasAnaToplamFarki(urun: GridUrunDto): boolean {
    return Math.abs(this.getAnaIstenenAdet(urun) - this.getSandikMiktari(urun)) > 0.0001;
  }

  getSandikTransferOzeti(urun: GridUrunDto): string {
    const apiOzeti = urun.sandikTransferOzeti?.trim();
    if (apiOzeti) return apiOzeti;

    const giris = Math.max(Number(urun.sandikAktarilanGiris ?? 0), 0);
    const cikis = Math.max(Number(urun.sandikAktarilanCikis ?? 0), 0);
    const ozetler: string[] = [];
    if (giris > 0) ozetler.push(`${this.formatMiktar(giris)} giriş`);
    if (cikis > 0) ozetler.push(`${this.formatMiktar(cikis)} çıkış`);
    return ozetler.join(' · ');
  }

  isSurecTamamlandi(u: GridUrunDto): boolean {
    return u.surecDurumId === SurecDurum.Tamamlandi || this.getEffectiveSurecDurum(u) === 'Tamamlandı';
  }

  hasSurecTamamlandiSecim(): boolean {
    const count = this.selectedSurecTamamlandiCount();
    if (count === 0) return false;

    this.toast.warning(`${count} ürünün süreci tamamlandı. ${this.tamamlanmisSurecMesaji}`);
    return true;
  }

  // ===== Toplu Kalite Atama =====
  openKaliteModal() {
    if (this.hasSevkKilitliSecim()) return;

    this.kaliteDurumSecim.set(0);
    this.showKaliteModal.set(true);
  }
  closeKaliteModal() { this.showKaliteModal.set(false); }

  confirmKalite() {
    if (this.hasSevkKilitliSecim()) return;

    if (!this.kaliteDurumSecim()) { this.toast.error('Kalite durumu seçiniz.'); return; }
    this.kaliteSaving.set(true);
    this.gridService.kaliteDurumGuncelle({
      projeId: this.projeId(),
      cekiSatiriIdler: this.getSelectedCekiSatiriIds(),
      kaliteDurumId: this.kaliteDurumSecim(),
    }).subscribe({
      next: (res) => {
        this.kaliteSaving.set(false);
        if (res.isSuccess) {
          this.toast.success('Kalite durumu başarıyla güncellendi.');
          this.gridService.notifyGridUpdated();
          this.closeKaliteModal();
          this.selectedRowKeys.set(new Set());
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
    if (this.hasSevkKilitliSecim()) return;
    if (this.hasSurecTamamlandiSecim()) return;

    this.surecDurumSecim.set(0);
    this.showSurecModal.set(true);
  }
  closeSurecModal() { this.showSurecModal.set(false); }

  confirmSurec() {
    if (this.hasSevkKilitliSecim()) return;
    if (this.hasSurecTamamlandiSecim()) return;

    if (!this.surecDurumSecim()) { this.toast.error('Süreç durumu seçiniz.'); return; }
    this.surecSaving.set(true);
    this.gridService.surecDurumGuncelle({
      projeId: this.projeId(),
      cekiSatiriIdler: this.getSelectedCekiSatiriIds(),
      surecDurumId: this.surecDurumSecim(),
    }).subscribe({
      next: (res) => {
        this.surecSaving.set(false);
        if (res.isSuccess) {
          this.toast.success('Süreç durumu başarıyla güncellendi.');
          this.gridService.notifyGridUpdated();
          this.closeSurecModal();
          this.selectedRowKeys.set(new Set());
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
    if (this.hasSevkKilitliSecim()) return;
    if (this.hasSurecTamamlandiSecim()) return;

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
      const cekiIdler = Array.from(new Set(items.map(i => i.cekiSatiriId)));
      this.gridService.surecDurumGuncelle({
        projeId: this.projeId(),
        cekiSatiriIdler: cekiIdler,
        surecDurumId: this.talepKaynakSecim(),
      }).subscribe({
        next: (res) => {
          if (res.isSuccess) {
            this.toast.success(`Seçili ürünlerin süreç durumu "${talepKaynak}" olarak güncellendi.`);
            this.gridService.notifyGridUpdated();
            this.selectedRowKeys.set(new Set());
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
    geriAl: { baslik: 'Toplu Geri Al', icon: 'ri-arrow-go-back-line', renk: '#D32F2F', aciklama: 'Seçili ürünlerin Grid, Kalite ve Süreç durumları sıfırlanacak. 3K işlem yapılmış ürünler atlanacaktır.', onay: 'Geri Al' },
  };

  topluIslemBaslik = computed(() => this.topluIslemConfig[this.topluIslemTipi()]?.baslik ?? '');
  topluIslemIcon = computed(() => this.topluIslemConfig[this.topluIslemTipi()]?.icon ?? '');
  topluIslemRenk = computed(() => this.topluIslemConfig[this.topluIslemTipi()]?.renk ?? '#333');
  topluIslemAciklamaMetni = computed(() => this.topluIslemConfig[this.topluIslemTipi()]?.aciklama ?? '');
  topluIslemOnayMetni = computed(() => this.topluIslemConfig[this.topluIslemTipi()]?.onay ?? '');

  openTopluIslemModal(tip: 'tamGeldi' | 'gridKapandi' | 'iptal' | 'geriAl') {
    if (this.hasSevkKilitliSecim()) return;

    this.topluIslemTipi.set(tip);
    this.topluIslemAciklama.set('');
    this.showTopluIslemModal.set(true);
  }
  closeTopluIslemModal() { this.showTopluIslemModal.set(false); }

  confirmTopluIslem() {
    if (this.hasSevkKilitliSecim()) return;

    const tip = this.topluIslemTipi();
    const ids = this.getSelectedCekiSatiriIds();
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
      this.selectedRowKeys.set(new Set());
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
