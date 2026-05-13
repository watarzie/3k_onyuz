import { Component, inject, signal, computed, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { TranslationService } from '../../../core/services/translation.service';
import { ToastService } from '../../../core/services/toast.service';
import { UcKService } from '../../../core/services/uck.service';
import { ProjeService } from '../../../core/services/proje.service';
import { GridService } from '../../../core/services/grid.service';
import { StokService } from '../../../core/services/stok.service';
import { SandikService } from '../../../core/services/sandik.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { PdfService } from '../../../core/services/pdf.service';

import { BreadcrumbComponent } from '../../../shared/components/breadcrumb/breadcrumb.component';
import { StatCardComponent } from '../../../shared/components/stat-card/stat-card.component';
import { CanWriteDirective } from '../../../shared/directives/can-write.directive';
import { ReadOnlyBannerComponent } from '../../../shared/components/readonly-banner/readonly-banner.component';
import { UcKUrunDto, UcKDurumGuncelleDto, TopluTamGeldiDto, ProjeDropdownDto, GridUrunDto, StokKaydiDto } from '../../../shared/models/index';
import { UcKDurum, GridSevkDurum, GridDurum } from '../../../core/constants/enums';

interface KarsilamaTipi { id: number; value: string; label: string; color: string; bgClass: string; }

const KARSILAMA_TIPLERI: KarsilamaTipi[] = [
  { id: UcKDurum.TamGeldi, value: 'Sevk Adeti Tam Geldi', label: 'SEVK ADETİ TAM GELDİ', color: '#25B003', bgClass: 'row-tam-geldi' },
  { id: UcKDurum.EksikGeldi, value: 'Sevk Adeti Eksik Geldi', label: 'SEVK ADETİ EKSİK GELDİ', color: '#FD5812', bgClass: 'row-eksik-geldi' },
  { id: UcKDurum.ProjedenKarsilandi, value: 'Projeden Karşılandı', label: 'PROJEDEN KARŞILANDI', color: '#3584FC', bgClass: 'row-projeden' },
  { id: UcKDurum.StoktanKarsilandi, value: 'Stoktan Karşılandı', label: 'STOKTAN KARŞILANDI', color: '#9C27B0', bgClass: 'row-stoktan' },
  { id: UcKDurum.TedarikcidenGeldi, value: 'Tedarikçiden Geldi', label: 'TEDARİKÇİDEN GELDİ', color: '#1B7D3A', bgClass: 'row-tedarikci' },
  { id: UcKDurum.Gelmedi, value: 'Gelmedi', label: 'GELMEDİ', color: '#FF4023', bgClass: 'row-gelmedi' },
  { id: UcKDurum.GeriGonderildi, value: 'Geri Gönderildi', label: 'GERİ GÖNDERİLDİ', color: '#D32F2F', bgClass: 'row-geri-gonderildi' },
];

import { OnayService } from '../../../core/services/onay.service';

@Component({
  selector: 'app-uck-urunler',
  standalone: true,
  imports: [RouterLink, NgClass, DatePipe, FormsModule, BreadcrumbComponent, StatCardComponent, CanWriteDirective, ReadOnlyBannerComponent],
  templateUrl: './uck-urunler.component.html',
  styleUrl: './uck-urunler.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UcKUrunlerComponent implements OnInit, OnDestroy {
  ts = inject(TranslationService);
  private route = inject(ActivatedRoute);
  private uckService = inject(UcKService);
  private toast = inject(ToastService);
  private projeService = inject(ProjeService);
  private gridService = inject(GridService);
  private stokService = inject(StokService);
  private onayService = inject(OnayService);
  private sandikService = inject(SandikService);
  private confirmService = inject(ConfirmService);
  private pdfService = inject(PdfService);

  private sub: Subscription = new Subscription();
  private pendingFocusCekiSatiriId: number | null = null;

  projeId = signal(0);
  sandikNo = signal('');
  urunler = signal<UcKUrunDto[]>([]);
  filtered = signal<UcKUrunDto[]>([]);
  loading = signal(true);
  filterTip = signal('');
  searchTerm = signal('');

  // Side panel
  showPanel = signal(false);
  panelUrun = signal<UcKUrunDto | null>(null);
  panelTip = signal('');
  panelGelenAdet = signal<number>(0);
  panelKaynakHedef = signal('');
  panelAciklama = signal('');
  panelGeriGonderilmeSebebi = signal('');
  panelSaving = signal(false);
  panelError = signal('');
  panelUyari = signal('');

  showTransferModal = signal(false);
  transferModalUrun = signal<UcKUrunDto | null>(null);

  // Checkbox + Toplu TamGeldi
  selectedIds = signal<Set<number>>(new Set());
  showTopluModal = signal(false);
  topluAciklama = signal('');
  topluSaving = signal(false);

  // Toplu Tedarikçi
  showTopluTedarikciModal = signal(false);
  topluTedarikciAciklama = signal('');
  topluTedarikciSaving = signal(false);

  // Toplu Geri Al
  showTopluGeriAlModal = signal(false);
  topluGeriAlAciklama = signal('');
  topluGeriAlSaving = signal(false);

  // Toplu İşlemler Dropdown Menü
  showTopluIslemlerMenu = signal(false);

  // Proje ve Kaynak Ürün Dropdown State
  projeler = signal<ProjeDropdownDto[]>([]);
  mevcutProje = computed(() => this.projeler().find(p => p.id === this.projeId()) ?? null);
  projeBaslik = computed(() => {
    const proje = this.mevcutProje();
    return proje ? `${proje.projeNo} - ${proje.musteri}` : `Proje #${this.projeId()}`;
  });
  kaynakUrunler = signal<GridUrunDto[]>([]);

  isProjeDropdownOpen = signal(false);
  isUrunDropdownOpen = signal(false);

  projeSearchTerm = signal('');
  urunSearchTerm = signal('');
  panelKaynakCekiSatiriId = signal<number | null>(null);

  // Stok Dropdown State
  stoklar = signal<StokKaydiDto[]>([]);
  isStokDropdownOpen = signal(false);
  stokSearchTerm = signal('');
  panelStokKaydiId = signal<number | null>(null);

  filteredProjeler = computed(() => {
    const term = this.projeSearchTerm().toLowerCase();
    const currentId = this.projeId();
    // Kendi projesi hariç — bir proje kendisinden ürün karşılayamaz
    let list = this.projeler().filter(p => p.id !== currentId);
    if (term) {
      list = list.filter(p =>
        p.projeNo?.toLowerCase().includes(term) ||
        p.musteri?.toLowerCase().includes(term)
      );
    }
    return list;
  });

  filteredKaynakUrunler = computed(() => {
    const term = this.urunSearchTerm().toLowerCase();
    const hedefUrun = this.panelUrun();
    let list = this.kaynakUrunler();

    // KURAL 1: İsim eşleşme — sadece hedef ürünle aynı isme sahip olanlar
    if (hedefUrun) {
      list = list.filter(u => this.aciklamaKelimeEslesiyor(hedefUrun.aciklama, u.aciklama));
    }

    // KURAL 2: 3K'ya gelmiş olma — gelenMiktar > 0
    list = list.filter(u => this.getKaynakNetKullanilabilir(u) > 0);

    // Arama filtresi
    if (term) {
      list = list.filter(u =>
        u.barkodNo.toLowerCase().includes(term) ||
        u.aciklama.toLowerCase().includes(term)
      );
    }
    return list;
  });

  filteredStoklar = computed(() => {
    const term = this.stokSearchTerm().toLowerCase();
    const list = this.stoklar();
    if (!term) return list;
    return list.filter(s =>
      (s.malzemeAdi && s.malzemeAdi.toLowerCase().includes(term)) ||
      (s.malzemeKodu && s.malzemeKodu.toLowerCase().includes(term)) ||
      (s.kaynakProje && s.kaynakProje.toLowerCase().includes(term))
    );
  });

  // Stats
  toplamUrun = computed(() => this.urunler().length);
  tamGeldi = computed(() => this.urunler().filter(u => u.ucKKarsilamaTipiMetni === 'Sevk Adeti Tam Geldi').length);
  eksikGeldi = computed(() => this.urunler().filter(u => u.ucKKarsilamaTipiMetni === 'Sevk Adeti Eksik Geldi').length);
  tamamlanan = computed(() => this.urunler().filter(u => u.kalan === 0).length);
  kalanlar = computed(() => this.urunler().filter(u => u.kalan > 0).length);
  get hasSelection(): boolean { return this.selectedIds().size > 0; }
  get selectionCount(): number { return this.selectedIds().size; }

  karsilamaTipleri = KARSILAMA_TIPLERI;
  breadcrumb: { label: string; link?: string }[] = [];

  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('projeId'));
    const sNo = this.route.snapshot.paramMap.get('sandikNo') ?? '';
    this.projeId.set(id);
    this.sandikNo.set(sNo);
    this.breadcrumb = [
      { label: 'Ana Kontrol Paneli', link: '/dashboard' },
      { label: 'Projeler', link: '/projeler' },
      { label: '3K Sandıklar', link: `/uck/${id}` },
      { label: sNo || '3K Ürünler' },
    ];

    // Stok cross-tab update dinleyicisi
    this.sub.add(
      this.stokService.stokListesiGuncellendi$.subscribe(() => {
        this.loadStokDropdownList();
      })
    );

    // Grid ve 3K çapraz-sekme ürün güncelleme dinleyicileri
    this.sub.add(
      this.gridService.gridGuncellendi$.subscribe(() => {
        this.loadUrunler(false);
      })
    );
    this.sub.add(
      this.uckService.uckGuncellendi$.subscribe(() => {
        this.loadUrunler(false, this.consumePendingFocusCekiSatiriId());
      })
    );

    // Projeler dropdown'ı için projeleri çek
    // Hafif dropdown endpoint — Include yok, sadece Id/ProjeNo/Musteri
    this.projeService.getProjeDropdownListesi().subscribe(res => {
      if (res.isSuccess && res.value) {
        this.projeler.set(res.value);
      }
    });

    // Stok dropdown'u için stokları çek
    this.loadStokDropdownList();

    this.loadUrunler();
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
  }

  loadStokDropdownList() {
    // 3K Dropdown'u için büyük bir sayfa boyutu ile aktif stokları çek
    this.stokService.getStokListesi(undefined, 1, 500).subscribe((res: any) => {
      if (res.isSuccess && res.value) {
        // value is PaginatedList due to recent changes
        const m = res.value.items || res.value;
        this.stoklar.set(m.filter((s: StokKaydiDto) => s.miktar > 0 && s.durumMetni === 'Aktif'));
      }
    });
  }

  loadUrunler(showLoader = true, focusCekiSatiriId: number | null = null) {
    if (showLoader) {
      this.loading.set(true);
    }
    const scrollSnapshot = showLoader ? null : this.captureTableScroll();
    this.uckService.getUrunler(this.projeId()).subscribe((res) => {
      if (showLoader) {
        this.loading.set(false);
      }
      if (res.isSuccess && res.value) {
        // Sadece bu sandıktaki ürünleri göster
        const sNo = this.sandikNo();
        const all = sNo ? res.value.filter(u => u.sandikNo === sNo) : res.value;
        this.urunler.set(all);
        this.applyFilter();
        this.restoreRowPosition(focusCekiSatiriId, scrollSnapshot);
      }
    });
  }

  getRowDomId(cekiSatiriId: number): string {
    return `uck-row-${cekiSatiriId}`;
  }

  private rememberFocus(cekiSatiriId?: number | null) {
    this.pendingFocusCekiSatiriId = cekiSatiriId ?? null;
  }

  private consumePendingFocusCekiSatiriId(): number | null {
    const id = this.pendingFocusCekiSatiriId;
    this.pendingFocusCekiSatiriId = null;
    return id;
  }

  private captureTableScroll(): { top: number; left: number } | null {
    const container = document.querySelector<HTMLElement>('.module-table-scroll');
    return container ? { top: container.scrollTop, left: container.scrollLeft } : null;
  }

  private restoreRowPosition(focusCekiSatiriId: number | null, scrollSnapshot: { top: number; left: number } | null) {
    window.requestAnimationFrame(() => {
      const row = focusCekiSatiriId ? document.getElementById(this.getRowDomId(focusCekiSatiriId)) : null;
      if (row) {
        row.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
        row.classList.add('row-focus-flash');
        window.setTimeout(() => row.classList.remove('row-focus-flash'), 1400);
        return;
      }

      const container = document.querySelector<HTMLElement>('.module-table-scroll');
      if (container && scrollSnapshot) {
        container.scrollTop = scrollSnapshot.top;
        container.scrollLeft = scrollSnapshot.left;
      }
    });
  }

  applyFilter() {
    let list = this.urunler();
    const tip = this.filterTip();
    const term = this.searchTerm().toLowerCase();
    if (tip) list = list.filter(u => u.ucKKarsilamaTipiMetni === tip);
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

  // Grid Durumu Renkleri
  getGridDurumColor(value: string): string {
    const GRID_RENKLERI: Record<string, string> = {
      'Tam Geldi': '#25B003',
      'Eksik Geldi': '#FD5812',
      'Gelmedi': '#FF4023',
      'Trafo Sevk': '#00BCD4',
      'İptal': '#FFB200',
      'Siparişte': '#9C27B0',
    };
    return GRID_RENKLERI[value] || '#64748B';
  }

  // Kalite Durumu Renkleri
  getKaliteDurumColor(value?: string): string {
    if (!value) return '#94a3b8';
    return value === 'Onaylandı' ? '#25B003' : '#E65100';
  }

  // Süreç Durumu Renkleri
  getSurecDurumColor(value?: string): string {
    const renkler: Record<string, string> = {
      'Ambar': '#607D8B',
      'İmalat': '#3584FC',
      'Tedarik': '#9C27B0',
      'Tedarik 3K Teslim': '#1B7D3A',
    };
    return value ? (renkler[value] || '#94a3b8') : '#94a3b8';
  }

  onFilterTip(tip: string) {
    this.filterTip.set(this.filterTip() === tip ? '' : tip);
    this.applyFilter();
  }

  getRowClass(u: UcKUrunDto): string {
    return KARSILAMA_TIPLERI.find(t => t.value === u.ucKKarsilamaTipiMetni)?.bgClass ?? '';
  }

  getTipLabel(value: string): string {
    return KARSILAMA_TIPLERI.find(t => t.value === value)?.label ?? value;
  }

  getTipColor(value: string): string {
    return KARSILAMA_TIPLERI.find(t => t.value === value)?.color ?? '#64748B';
  }

  // ===== Side Panel =====
  openPanel(urun: UcKUrunDto) {
    this.panelUrun.set(urun);
    this.panelTip.set(urun.ucKKarsilamaTipiMetni === 'Bekliyor' ? '' : urun.ucKKarsilamaTipiMetni);
    this.panelGelenAdet.set(urun.gelenMiktar);
    this.panelKaynakHedef.set(urun.kaynakHedefProjeNo ?? '');
    this.panelKaynakCekiSatiriId.set(null);
    this.panelAciklama.set(urun.ucKAciklama ?? '');
    this.panelGeriGonderilmeSebebi.set(urun.geriGonderilmeSebebiId ? urun.geriGonderilmeSebebiId.toString() : '');
    this.panelError.set('');

    // Eğer önceden girilmiş bir proje varsa, kaynak ürünleri yükle
    if (urun.kaynakHedefProjeNo) {
      const selectedProje = this.projeler().find(p => p.projeNo === urun.kaynakHedefProjeNo);
      if (selectedProje) {
        this.onKaynakProjeChange(selectedProje.id.toString());
      }
    }

    this.recalcPanel();
    this.showPanel.set(true);
  }

  closePanel() {
    this.showPanel.set(false);
    this.panelUrun.set(null);
    this.panelError.set('');
  }

  onTipChange(tip: string) {
    const u = this.panelUrun()!;
    this.panelTip.set(tip);

    switch (tip) {
      case 'Sevk Adeti Tam Geldi':
        // KURAL 1: Grid sevk miktarı kadar otomatik set et
        this.panelGelenAdet.set(u.gridSevkMiktari ?? u.istenenAdet);
        this.panelKaynakHedef.set('');
        break;
      case 'Gelmedi':
        this.panelGelenAdet.set(0);
        this.panelKaynakHedef.set('');
        break;
      case 'Sevk Adeti Eksik Geldi':
        this.panelGelenAdet.set(u.gelenMiktar > 0 ? u.gelenMiktar : 0);
        this.panelKaynakHedef.set('');
        break;
      case 'Projeden Karşılandı':
        this.panelGelenAdet.set(u.kalan > 0 ? u.kalan : 0);
        break;
      case 'Stoktan Karşılandı':
      case 'Tedarikçiden Geldi':
        this.panelGelenAdet.set(0);
        this.panelKaynakHedef.set('');
        break;
      case 'Geri Gönderildi':
        this.panelGelenAdet.set(u.gelenMiktar > 0 ? u.gelenMiktar : 0);
        this.panelKaynakHedef.set('');
        break;
    }
    this.recalcPanel();
  }

  onKaynakProjeChange(projeIdStr: string) {
    if (!projeIdStr) {
      this.kaynakUrunler.set([]);
      this.panelKaynakCekiSatiriId.set(null);
      return;
    }
    const pId = Number(projeIdStr);
    const proje = this.projeler().find(p => p.id === pId);
    if (proje) {
      this.panelKaynakHedef.set(proje.projeNo);
    }

    this.gridService.getUrunler(pId).subscribe(res => {
      if (res.isSuccess && res.value) {
        this.kaynakUrunler.set(res.value);
        this.panelKaynakCekiSatiriId.set(null);
      }
    });
  }

  get selectedKaynakProjeText(): string {
    const pNo = this.panelKaynakHedef();
    if (!pNo) return 'Proje Seçiniz...';
    const p = this.projeler().find(x => x.projeNo === pNo);
    return p ? `${p.projeNo} - ${p.musteri}` : 'Proje Seçiniz...';
  }

  get selectedKaynakUrunText(): string {
    const uId = this.panelKaynakCekiSatiriId();
    if (!uId) return 'Ürün Seçiniz...';
    const u = this.kaynakUrunler().find(x => x.cekiSatiriId === uId);
    if (!u) return 'Ürün Seçiniz...';
    return `${u.siraNo} - ${u.barkodNo} (${u.aciklama}) | Kullanilabilir: ${this.getKaynakNetKullanilabilir(u)}`;
  }

  getKaynakNetKullanilabilir(u: GridUrunDto): number {
    if (u.netKullanilabilir !== undefined && u.netKullanilabilir !== null) {
      return Math.max(u.netKullanilabilir, 0);
    }

    const net = (u.gelenMiktar ?? 0)
      + (u.stokKarsilanan ?? 0)
      + (u.projeKarsilanan ?? 0)
      + (u.tedarikciKarsilanan ?? 0)
      - (u.projeGonderilen ?? 0);
    return Math.max(net, 0);
  }

  openTransferModal(urun: UcKUrunDto) {
    this.transferModalUrun.set(urun);
    this.showTransferModal.set(true);
  }

  closeTransferModal() {
    this.showTransferModal.set(false);
    this.transferModalUrun.set(null);
  }

  getTransferYonClass(yon: string): string {
    return yon === 'Gelen' ? 'transfer-in' : 'transfer-out';
  }

  getTransferTipLabel(tip: string): string {
    return tip === 'Telafi' ? 'Telafi' : 'Karşılama';
  }

  getTransferZincirOzetleri(urun: UcKUrunDto): string[] {
    const transferler = urun.transferZinciri ?? [];
    const gelenler = transferler.filter(t => t.yon === 'Gelen');
    const gidenler = transferler.filter(t => t.yon !== 'Gelen');
    const ozetler: string[] = [];

    if (gelenler.length > 0) {
      const projeler = this.formatProjeListesi(gelenler.map(t => t.kaynakProjeNo));
      ozetler.push(`${projeler} projesinden bu ürün için toplam ${urun.projeKarsilanan} ${urun.birim} alındı.`);
    }

    if (gidenler.length > 0) {
      const projeler = this.formatProjeListesi(gidenler.map(t => t.hedefProjeNo));
      ozetler.push(`Bu üründen ${projeler} projesine toplam ${urun.projeGonderilen} ${urun.birim} verildi.`);
    }

    if (urun.netKullanilabilir > 0) {
      ozetler.push(`Şu an bu satırda kullanılabilir net miktar ${urun.netKullanilabilir} ${urun.birim}.`);
    } else if (urun.projeGonderilen > 0 && urun.kalan > 0) {
      ozetler.push(`Bu satırda kullanılabilir net miktar kalmadı; kalan ${urun.kalan} ${urun.birim} için Grid tarafı yeniden sevk etmelidir.`);
    } else if (urun.kalan <= 0) {
      ozetler.push(`Bu satırın ihtiyacı karşılanmış durumda; ek sevk gerekmiyor.`);
    } else {
      ozetler.push(`Bu satırda kullanılabilir net miktar bulunmuyor.`);
    }

    return ozetler;
  }

  private formatProjeListesi(projeler: string[]): string {
    const tekilProjeler = Array.from(new Set(projeler.filter(Boolean)));
    if (tekilProjeler.length <= 2) return tekilProjeler.join(' ve ');
    return `${tekilProjeler.slice(0, -1).join(', ')} ve ${tekilProjeler[tekilProjeler.length - 1]}`;
  }

  toggleProjeDropdown() {
    this.isProjeDropdownOpen.set(!this.isProjeDropdownOpen());
    if (this.isProjeDropdownOpen()) this.isUrunDropdownOpen.set(false);
  }

  toggleUrunDropdown() {
    this.isUrunDropdownOpen.set(!this.isUrunDropdownOpen());
    if (this.isUrunDropdownOpen()) this.isProjeDropdownOpen.set(false);
  }

  selectProjeItem(pId: string) {
    this.onKaynakProjeChange(pId);
    this.isProjeDropdownOpen.set(false);
  }

  toggleStokDropdown() {
    this.isStokDropdownOpen.set(!this.isStokDropdownOpen());
    if (this.isStokDropdownOpen()) {
      this.isProjeDropdownOpen.set(false);
      this.isUrunDropdownOpen.set(false);
    }
  }

  selectStokItem(stokId: number) {
    this.panelStokKaydiId.set(stokId);
    this.isStokDropdownOpen.set(false);
  }

  get selectedStokText(): string {
    const sId = this.panelStokKaydiId();
    if (!sId) return 'Stok Arayın veya Seçiniz...';
    const s = this.stoklar().find(x => x.id === sId);
    if (!s) return 'Stok Arayın veya Seçiniz...';
    return `${s.malzemeAdi} (Projeden Kalan: ${s.kaynakProje}) | Bakiye: ${s.miktar} ${s.birimMetni}`;
  }

  selectUrunItem(uId: number) {
    this.panelKaynakCekiSatiriId.set(uId);
    this.isUrunDropdownOpen.set(false);
  }

  /** Açıklama alanını normalize eder — ters slash temizler, fazla boşlukları kaldırır, küçük harfe çevirir */
  private normalizeAciklama(str: string): string {
    if (!str) return '';
    return str.replace(/\\/g, '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('tr-TR');
  }

  private aciklamaKelimeEslesiyor(hedefAciklama: string, kaynakAciklama: string): boolean {
    const hedef = this.normalizeAciklama(hedefAciklama);
    const kaynak = this.normalizeAciklama(kaynakAciklama);
    if (!hedef || !kaynak) return false;
    if (kaynak.includes(hedef)) return true;

    const kelimeler = hedef.match(/[a-zçğıöşü0-9]+/g) ?? [];
    const anlamliKelimeler = kelimeler.filter(k => k.length >= 3);
    const aranacakKelimeler = anlamliKelimeler.length > 0 ? anlamliKelimeler : kelimeler;

    return aranacakKelimeler.some(kelime => kaynak.includes(kelime));
  }

  getProjeIdByNo(projeNo: string): string {
    const p = this.projeler().find(x => x.projeNo === projeNo);
    return p ? p.id.toString() : '';
  }

  recalcPanel() {
    const tip = this.panelTip();
    let uyari = '';
    switch (tip) {
      case 'Sevk Adeti Tam Geldi': uyari = 'SANDIK İÇERİĞİ TAM — SEVK MİKTARI KADAR TESLİM ALINACAK'; break;
      case 'Sevk Adeti Eksik Geldi': uyari = 'EKSİK GELDİ MİKTAR GİRİN'; break;
      case 'Projeden Karşılandı': uyari = 'LÜTFEN BİR PROJE VE ÜRÜN SEÇİNİZ'; break;
      case 'Stoktan Karşılandı': uyari = 'DEPO STOĞUNDAN KARŞILANACAKTIR'; break;
      case 'Tedarikçiden Geldi': uyari = 'TEDARİKÇİDEN DİREKT GELDİ'; break;
      case 'Gelmedi': uyari = 'GELMEDİ OLARAK İŞARETLENECEK'; break;
      case 'Geri Gönderildi': uyari = 'GERİ GÖNDERİLECEK — SEBEP SEÇİN VE ADET GİRİN'; break;
    };
    this.panelUyari.set(uyari || 'BEKLİYOR');
    this.panelError.set('');
  }

  get isGelenAdetAktif(): boolean {
    const t = this.panelTip();
    return t !== 'Sevk Adeti Tam Geldi' && t !== 'Gelmedi' && t !== '';
  }

  private getTipId(tip: string): number {
    return KARSILAMA_TIPLERI.find(t => t.value === tip)?.id ?? 0;
  }

  private isKaynakKarsilamaTip(tip: string): boolean {
    const tipId = this.getTipId(tip);
    return tipId === UcKDurum.ProjedenKarsilandi ||
      tipId === UcKDurum.StoktanKarsilandi ||
      tipId === UcKDurum.TedarikcidenGeldi;
  }

  private isFizikselSevkTip(tip: string): boolean {
    const tipId = this.getTipId(tip);
    return tipId === UcKDurum.TamGeldi ||
      tipId === UcKDurum.EksikGeldi ||
      tipId === UcKDurum.Gelmedi;
  }

  private isGridKaynakKarsilamaAcik(u: UcKUrunDto): boolean {
    return u.gridDurumuId === GridDurum.EksikGeldi ||
      u.gridDurumuId === GridDurum.Gelmedi ||
      u.gridDurumuId === GridDurum.TrafoSevk;
  }

  private isGeriGonderimSonrasiKaynakAcik(u: UcKUrunDto): boolean {
    return u.kalan > 0 &&
      (u.ucKKarsilamaTipiId === UcKDurum.GeriGonderildi ||
        (u.geriGonderilenMiktar ?? 0) > 0 ||
        u.gridSevkDurumuId === GridSevkDurum.YenidenSevkGerekli);
  }

  private isProjeTransferTelafiAcik(u: UcKUrunDto, tip: string): boolean {
    return this.getTipId(tip) === UcKDurum.ProjedenKarsilandi &&
      u.kalan > 0 &&
      (u.projeGonderilen ?? 0) > 0;
  }

  isKarsilamaTipiDisabled(tip: string): boolean {
    const u = this.panelUrun();
    if (!u) return false;

    // Grid İptal → tüm seçenekler kapalı
    if (u.gridDurumuId === GridDurum.Iptal) return true;

    if (u.gridDurumuId === GridDurum.TrafoSevk) {
      const kismiSevkVar = u.gridSevkDurumuId === GridSevkDurum.SevkEdildi && (u.gridSevkMiktari ?? 0) > 0;
      const fizikselTip = this.isFizikselSevkTip(tip);
      const kaynakTip = this.isKaynakKarsilamaTip(tip);

      if (fizikselTip) return !kismiSevkVar;
      if (kaynakTip) return u.kalan <= 0;
      if (tip === 'Geri Gönderildi') return u.gelenMiktar <= 0;
      return true;
    }

    // Grid Gelmedi → yalnızca Projeden/Stoktan/Tedarikçi açık
    if (u.gridDurumuId === GridDurum.Gelmedi) {
      return !this.isKaynakKarsilamaTip(tip);
    }

    // Hatalı Ürün seçeneği kaldırıldı — GeriGonderilmeSebebi içine taşındı

    // Sevk Adeti Tam Geldi → Grid sevk edilmiş olmalı
    if (tip === 'Sevk Adeti Tam Geldi' && u.gridSevkDurumuId !== GridSevkDurum.SevkEdildi) return true;

    // Projeden/Stoktan/Tedarikçi → Grid eksik/gelmedi/trafo veya 3K geri gönderim sonrası kalan açık olmalı
    if (this.isKaynakKarsilamaTip(tip)) {
      return !this.isGridKaynakKarsilamaAcik(u) &&
        !this.isGeriGonderimSonrasiKaynakAcik(u) &&
        !this.isProjeTransferTelafiAcik(u, tip);
    }

    return false;
  }

  get isKaynakHedefZorunlu(): boolean {
    const t = this.panelTip();
    return t === 'Projeden Karşılandı';
  }

  get isAciklamaZorunlu(): boolean {
    return false;
  }

  // KURAL 3 (Dumb UI): Kalan miktar backend'den gelir, frontend hesaplama yapmaz.
  // Panel açıkken de backend'in son hesapladığı değer gösterilir.
  // Kayıt sonrası loadUrunler() ile güncel değer çekilir.
  get panelKalan(): number {
    const u = this.panelUrun();
    if (!u) return 0;
    return u.kalan;
  }

  validatePanel(): string | null {
    const u = this.panelUrun()!;
    const tip = this.panelTip();
    if (!tip) return 'Karşılama tipi seçilmelidir.';

    // Grid İptal blokajı
    if (u.gridDurumuId === GridDurum.Iptal) return 'Bu ürün Grid tarafından iptal edildiği için işlem yapılamaz.';

    if (u.gridDurumuId === GridDurum.TrafoSevk) {
      const kismiSevkVar = u.gridSevkDurumuId === GridSevkDurum.SevkEdildi && (u.gridSevkMiktari ?? 0) > 0;
      const fizikselTip = this.isFizikselSevkTip(tip);
      const kaynakTip = this.isKaynakKarsilamaTip(tip);

      if (fizikselTip && !kismiSevkVar) {
        return 'Trafo sevk satırında 3K işlemi için Grid gelen miktar önce 3K’ya sevk edilmelidir.';
      }
      if (kaynakTip && u.kalan <= 0) {
        return 'Bu trafo sevk satırında karşılanacak kalan miktar yok.';
      }
    }

    // Grid Gelmedi → sadece Projeden/Stoktan/Tedarikçi
    if (u.gridDurumuId === GridDurum.Gelmedi) {
      if (!this.isKaynakKarsilamaTip(tip)) {
        return 'Grid "Gelmedi" durumunda yalnızca Projeden, Stoktan veya Tedarikçiden karşılama yapılabilir.';
      }
    }

    // Sevk Adeti Tam Geldi → Grid sevk edilmiş olmalı
    if (tip === 'Sevk Adeti Tam Geldi' && u.gridSevkDurumuId !== GridSevkDurum.SevkEdildi) {
      return 'Grid tarafından eksiksiz sevk edilmeden "Sevk Adeti Tam Geldi" olarak işaretlenemez.';
    }

    // Hatalı Ürün → Grid sevk edilmiş olmalı
    if (tip === 'Hatalı Ürün' && u.gridSevkDurumuId !== GridSevkDurum.SevkEdildi) {
      return 'Grid tarafından sevk edilmeden "Hatalı Ürün" işaretlenemez.';
    }

    if (this.isKaynakKarsilamaTip(tip)) {
      if (!this.isGridKaynakKarsilamaAcik(u) &&
        !this.isGeriGonderimSonrasiKaynakAcik(u) &&
        !this.isProjeTransferTelafiAcik(u, tip)) {
        return 'Bu işlem yalnızca ürün Grid tarafında eksik/gelmedi olduğunda, kısmi trafo sevk olduğunda veya 3K geri gönderim sonrası kalan açık olduğunda yapılabilir. Proje transfer telafisi yalnızca Projeden Karşılandı için geçerlidir.';
      }
    }

    if (tip === 'Sevk Adeti Eksik Geldi') {
      if (this.panelGelenAdet() <= 0) return 'Gelen adet girilmelidir.';
      if (this.panelGelenAdet() >= u.istenenAdet) return 'Gelen adet miktardan küçük olmalıdır.';
    }
    if (tip === 'Projeden Karşılandı') {
      if (this.panelGelenAdet() <= 0) return 'Karşılanan adet girilmelidir.';
      if (!this.panelKaynakHedef()) return 'Kaynak proje girilmelidir.';
      if (!this.panelKaynakCekiSatiriId()) return 'Kaynak ürün girilmelidir.';
      // KURAL 3: Stok yeterliliği — karşılama adedi ≤ kaynak ürünün gelenMiktar'ı
      const kaynakUrun = this.kaynakUrunler().find(x => x.cekiSatiriId === this.panelKaynakCekiSatiriId());
      const kullanilabilir = kaynakUrun ? this.getKaynakNetKullanilabilir(kaynakUrun) : 0;
      if (kaynakUrun && this.panelGelenAdet() > kullanilabilir) {
        return `Kaynak üründe yeterli miktar yok. (Kullanılabilir: ${kullanilabilir})`;
      }
    }
    if (tip === 'Stoktan Karşılandı') {
      if (this.panelGelenAdet() <= 0) return 'Gelen adet girilmelidir.';
      if (!this.panelStokKaydiId()) return 'Kullanılacak stok seçilmelidir (Malzeme Adı veya Barkod arayın).';

      const s = this.stoklar().find(x => x.id === this.panelStokKaydiId());
      if (s) {
        const normalizeStr = (str: string) => {
          if (!str) return '';
          return str.replace(/[^\p{L}0-9\s]/gu, '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('tr-TR');
        };
        if (normalizeStr(s.malzemeAdi) !== normalizeStr(u.aciklama)) {
          return `Seçilen stok adı (${s.malzemeAdi}) ile proje ürün adı (${u.aciklama}) eşleşmelidir!`;
        }
        if (this.panelGelenAdet() > s.miktar) {
          return `Seçtiğiniz stokta yeterli miktar yok. (Stokta: ${s.miktar})`;
        }
      }
    }
    if (tip === 'Tedarikçiden Geldi') {
      if (this.panelGelenAdet() <= 0) return 'Gelen adet girilmelidir.';
    }
    if (tip === 'Geri Gönderildi') {
      if (!this.panelGeriGonderilmeSebebi()) return 'Geri gönderilme sebebi seçilmelidir.';
      if (this.panelGelenAdet() <= 0) return 'Geri gönderilen adet girilmelidir.';
      const u2 = this.panelUrun()!;
      if (this.panelGelenAdet() > u2.gelenMiktar) return `Geri gönderilen adet (${this.panelGelenAdet()}), 3K gelen miktardan (${u2.gelenMiktar}) büyük olamaz.`;
    }

    // KURAL 3 (Dumb UI): Overflow kontrolü backend'de yapılır.
    // Frontend sadece basit validasyonları (boş alan kontrolü) yapar.
    if (this.panelGelenAdet() > u.kalan && tip !== 'Sevk Adeti Tam Geldi' && tip !== 'Geri Gönderildi') return 'Gelen adet kalandan büyük olamaz.';

    return null;
  }

  savePanel() {
    const err = this.validatePanel();
    if (err) { this.panelError.set(err); return; }

    const u = this.panelUrun()!;
    const tip = this.panelTip();
    this.panelSaving.set(true);
    this.panelError.set('');

    const _aciklama = tip === 'Geri Gönderildi' ? this.panelAciklama() : this.panelAciklama();
    const dto: UcKDurumGuncelleDto = {
      cekiSatiriId: u.cekiSatiriId,
      projeId: this.projeId(),
      karsilamaTipiId: KARSILAMA_TIPLERI.find(t => t.value === tip)?.id ?? 0,
      gelenAdet: this.panelGelenAdet(),
      kaynakHedefProjeNo: this.panelKaynakHedef()?.trim(),
      kaynakCekiSatiriId: this.panelKaynakCekiSatiriId() || undefined,
      stokKaydiId: this.panelStokKaydiId() || undefined,
      aciklama: _aciklama ? _aciklama.trim() : '',
      geriGonderilmeSebebiId: tip === 'Geri Gönderildi' ? +this.panelGeriGonderilmeSebebi() : undefined,
      urunAdi: u.aciklama || u.barkodNo,
      mevcutProjeNo: this.projeler().find(p => p.id === this.projeId())?.projeNo || this.projeId().toString(),
      mevcutSandikNo: u.sandikNo || this.sandikNo(),
      kaynakUrunAdi: this.panelTip() === 'Projeden Karşılandı' && this.panelKaynakCekiSatiriId() ?
        this.kaynakUrunler().find(cu => cu.cekiSatiriId === this.panelKaynakCekiSatiriId())?.aciklama : undefined
    };

    this.uckService.durumGuncelle(dto).subscribe({
      next: (res) => {
        this.panelSaving.set(false);
        if (res.isSuccess) {
          // Some backend APIs wrap the 202 inside the returned JSON object body
          const returnedStatus = (res.value as any)?.statusCode;
          if (res.statusCode === 202 || returnedStatus === 202) {
            this.toast.info('İşleminiz yetkili onayına sunulmuştur.');
            // Header'a anlık bildir
            this.onayService.notifyHeaderForNewApproval();
          } else {
            this.toast.success('3K durumu başarıyla güncellendi.');
          }
          this.rememberFocus(u.cekiSatiriId);
          this.closePanel();
          this.uckService.notifyUckUpdated();
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

    if (!confirm(`"${u.aciklama}" ürününün 3K karşılama durumunu sıfırlamak istediğinize emin misiniz?\n\nGelenMiktar, StokKarsilanan, ProjeKarsilanan vb. tüm 3K alanları sıfırlanacak ve ürün "Bekliyor" durumuna dönecektir.\n\nBu işlem geri alınamaz.`))
      return;

    this.panelSaving.set(true);
    this.panelError.set('');

    this.uckService.durumSifirla({
      cekiSatiriId: u.cekiSatiriId,
      projeId: this.projeId(),
    }).subscribe({
      next: (res) => {
        this.panelSaving.set(false);
        if (res.isSuccess) {
          this.toast.success('3K durumu başarıyla sıfırlandı.');
          this.rememberFocus(u.cekiSatiriId);
          this.closePanel();
          this.uckService.notifyUckUpdated();
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

  // ===== Checkbox Selection =====
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

  // ===== Toplu Tam Geldi Modal =====
  openTopluTamGeldi() {
    this.topluAciklama.set('');
    this.showTopluModal.set(true);
  }
  closeTopluTamGeldi() { this.showTopluModal.set(false); }

  confirmTopluTamGeldi() {
    this.topluSaving.set(true);
    const dto: TopluTamGeldiDto = {
      projeId: this.projeId(),
      cekiSatiriIdler: Array.from(this.selectedIds()),
      aciklama: this.topluAciklama() || undefined,
    };
    this.uckService.topluTamGeldi(dto).subscribe({
      next: (res) => {
        this.topluSaving.set(false);
        if (res.isSuccess) {
          this.toast.success(`${dto.cekiSatiriIdler.length} ürün Sevk Adeti Tam Geldi olarak işaretlendi.`);
          this.rememberFocus(dto.cekiSatiriIdler[0]);
          this.closeTopluTamGeldi();
          this.selectedIds.set(new Set());
          this.uckService.notifyUckUpdated();
        } else {
          this.toast.error(res.error ?? 'Toplu güncelleme başarısız.');
        }
      },
      error: () => {
        this.topluSaving.set(false);
        this.toast.error('Sunucu ile iletişim kurulamadı.');
      },
    });
  }

  // ===== Toplu Tedarikçiden Karşıla Modal =====
  openTopluTedarikci() {
    this.topluTedarikciAciklama.set('');
    this.showTopluTedarikciModal.set(true);
  }
  closeTopluTedarikci() { this.showTopluTedarikciModal.set(false); }

  confirmTopluTedarikci() {
    this.topluTedarikciSaving.set(true);
    const dto: TopluTamGeldiDto = {
      projeId: this.projeId(),
      cekiSatiriIdler: Array.from(this.selectedIds()),
      aciklama: this.topluTedarikciAciklama() || undefined,
    };
    this.uckService.topluTedarikci(dto).subscribe({
      next: (res) => {
        this.topluTedarikciSaving.set(false);
        if (res.isSuccess) {
          this.toast.success(`${dto.cekiSatiriIdler.length} ürün Tedarikçiden Karşılandı olarak işaretlendi.`);
          this.rememberFocus(dto.cekiSatiriIdler[0]);
          this.closeTopluTedarikci();
          this.selectedIds.set(new Set());
          this.uckService.notifyUckUpdated();
        } else {
          this.toast.error(res.error ?? 'Toplu güncelleme başarısız.');
        }
      },
      error: () => {
        this.topluTedarikciSaving.set(false);
        this.toast.error('Sunucu ile iletişim kurulamadı.');
      },
    });
  }

  // ===== Checkbox [disabled] — sadece kesin blokaj durumları =====
  isEditDisabled(u: UcKUrunDto): boolean {
    if (u.gridDurumuId === GridDurum.Iptal || u.gridDurumuId === GridDurum.GridKapandi) return true;
    if (u.kaliteDurumMetni === 'Tadilatta') return true;

    if (u.gridDurumuId === GridDurum.TrafoSevk) {
      const gridSevkVar = u.gridSevkDurumuId === GridSevkDurum.SevkEdildi && (u.gridSevkMiktari ?? 0) > 0;
      const kaynaklaKarsilanacakKalanVar = u.kalan > 0;
      return !gridSevkVar && !kaynaklaKarsilanacakKalanVar;
    }

    return false;
  }

  getEditDisabledReason(u: UcKUrunDto): string {
    if (!this.isEditDisabled(u)) return '';
    if (u.kaliteDurumMetni === 'Tadilatta') return 'Kalite Tadilatta olduğu için işlem yapılamaz.';
    if (u.gridDurumuId === GridDurum.Iptal) return 'Grid iptal ettiği için işlem yapılamaz.';
    if (u.gridDurumuId === GridDurum.GridKapandi) return 'Grid kapandığı için işlem yapılamaz.';
    if (u.gridDurumuId === GridDurum.TrafoSevk) return 'Tamamı trafoda sevk edildiği için 3K fiziksel işlem yok.';
    return '';
  }

  isCheckboxDisabled(u: UcKUrunDto): boolean {
    // Grid İptal veya GridKapandı → hiçbir toplu işlem yapılamaz
    if (u.gridDurumuId === GridDurum.Iptal || u.gridDurumuId === GridDurum.GridKapandi) return true;
    return false;
  }

  // ===== Toplu Tam Geldi butonu aktif mi? =====
  // Seçili ürünlerin TÜMÜ Grid tarafından sevk edilmiş olmalı
  get isTopluTamGeldiAllowed(): boolean {
    if (this.selectedIds().size === 0) return false;
    const ids = this.selectedIds();
    return this.filtered().filter(u => ids.has(u.cekiSatiriId)).every(u =>
      u.gridSevkDurumuId === GridSevkDurum.SevkEdildi &&
      u.ucKKarsilamaTipiId !== UcKDurum.TamGeldi &&
      (u.gridDurumuId !== GridDurum.TrafoSevk || (u.gridSevkMiktari ?? 0) > 0)
    );
  }

  // ===== Eksik Ürünler Raporu İndirme =====
  eksikUrunlerRaporuIndir() {
    this.toast.info('Rapor hazırlanıyor...');
    this.pdfService.eksikUrunlerPdf(this.projeId()).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `EksikUrunlerRaporu_${this.projeId()}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
        this.toast.success('Rapor indirildi.');
      },
      error: () => this.toast.error('Rapor indirilemedi.')
    });
  }

  // ===== Manuel Ürün Silme =====
  async manuelUrunSil(u: UcKUrunDto) {
    const onay = await this.confirmService.ask({
      title: 'Manuel Ürün Sil',
      message: `<strong>${u.aciklama}</strong> ürününü silmek istediğinize emin misiniz?<br><br><small class="text-muted">Bu işlem geri alınamaz.</small>`,
      confirmText: 'Evet, Sil',
      cancelText: 'Vazgeç',
      type: 'danger'
    });

    if (onay) {
      this.sandikService.manuelUrunSil(this.projeId(), u.cekiSatiriId).subscribe({
        next: (res) => {
          if (res.isSuccess) {
            this.toast.success('Ürün başarıyla silindi.');
            this.loadUrunler(false);
          } else {
            this.toast.error(res.error ?? 'Ürün silinemedi.');
          }
        },
        error: () => this.toast.error('Silme sırasında hata oluştu.')
      });
    }
  }

  // ===== Toplu Geri Al =====
  openTopluGeriAl() {
    this.topluGeriAlAciklama.set('');
    this.showTopluGeriAlModal.set(true);
  }
  closeTopluGeriAl() { this.showTopluGeriAlModal.set(false); }

  confirmTopluGeriAl() {
    const ids = Array.from(this.selectedIds());
    if (ids.length === 0) return;

    this.topluGeriAlSaving.set(true);
    this.uckService.topluSifirla({
      projeId: this.projeId(),
      cekiSatiriIdler: ids,
      aciklama: this.topluGeriAlAciklama() || undefined,
    }).subscribe({
      next: (res) => {
        this.topluGeriAlSaving.set(false);
        if (res.isSuccess) {
          this.toast.success('Seçili ürünlerin 3K durumları başarıyla sıfırlandı.');
          this.rememberFocus(ids[0]);
          this.closeTopluGeriAl();
          this.selectedIds.set(new Set());
          this.uckService.notifyUckUpdated();
        } else {
          this.toast.error(res.error ?? 'Toplu geri alma başarısız.');
        }
      },
      error: () => {
        this.topluGeriAlSaving.set(false);
        this.toast.error('Sunucu ile iletişim kurulamadı.');
      },
    });
  }
}
