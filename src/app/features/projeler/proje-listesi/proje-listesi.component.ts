import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { Component, inject, signal, computed, OnInit, ChangeDetectionStrategy, HostListener } from '@angular/core';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { NgClass, DatePipe } from '@angular/common';
import { TranslationService } from '../../../core/services/translation.service';
import { ProjeService } from '../../../core/services/proje.service';
import { SandikService } from '../../../core/services/sandik.service';
import { PermissionService } from '../../../core/services/permission.service';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { BreadcrumbComponent } from '../../../shared/components/breadcrumb/breadcrumb.component';
import { CekiRevizyonOnizlemeSonuc, ProjeDto, SahaAktarimDto, SandikDto, SevkiyatDto } from '../../../shared/models/index';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { PdfService } from '../../../core/services/pdf.service';
import { SevkiyatKilitAcmaTipi } from '../../../core/constants/enums';

interface SahaAktarimGrubu {
  sahaSandikId: number | null;
  sahaSandikNo: string;
  aktarimlar: SahaAktarimDto[];
  geriAlinabilirMi: boolean;
  geriAlinamamaNedeni: string | null;
}

@Component({
  selector: 'app-proje-listesi',
  standalone: true,
  imports: [TranslatePipe, RouterLink, NgClass, StatusBadgeComponent, BreadcrumbComponent, FormsModule, DatePipe],
  templateUrl: './proje-listesi.component.html',
  styleUrl: './proje-listesi.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjeListesiComponent implements OnInit {
  ts = inject(TranslationService);
  private projeService = inject(ProjeService);
  private sandikService = inject(SandikService);
  permissions = inject(PermissionService);
  toastService = inject(ToastService);
  confirmService = inject(ConfirmService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private pdfService = inject(PdfService);
  private readonly sandikNoCollator = new Intl.Collator('tr', { numeric: true, sensitivity: 'base' });

  isSandikYonetimi = signal(false);
  isSevkEdilen = signal(false);
  isAktifProjeler = signal(false);
  isSahaYonetimi = signal(false);
  isYedekYonetimi = signal(false);
  projeTipiFilter = signal<number | null>(null);
  readonly projeTipiFilterOptions: { label: string; value: number | null }[] = [
    { label: 'Tümü', value: null },
    { label: 'Normal', value: 1 },
    { label: 'Saha', value: 2 },
    { label: 'Yedek', value: 3 },
  ];

  downloadingPdf = signal<number | null>(null);
  downloadingEksikPdf = signal<number | null>(null);
  downloadingEksikExcel = signal<number | null>(null);
  downloadingGerceklesenPdf = signal<number | null>(null);
  downloadingGerceklesenExcel = signal<number | null>(null);
  reportMenuKey = signal<string | null>(null);
  reportMenuPosition = signal<{ top: number; left: number } | null>(null);
  reportMenuContext = signal<{ key: string; proje: ProjeDto; type: 'eksik' | 'gerceklesen' } | null>(null);

  /**
   * Grid/3K buton gösterimi — Rol Yetki ekranından yönetilir.
   * MenuTanimi'deki "grid-modulu" ve "3k-modulu" kayıtlarına göre kontrol edilir.
   */
  canSeeGrid = computed(() => this.permissions.hasAccess('grid-modulu'));
  canSee3K = computed(() => this.permissions.hasAccess('3k-modulu'));
  canSeeEksikRapor = computed(() => this.permissions.hasAccess('eksik-raporu'));
  canSeeGerceklesenRapor = computed(() => this.permissions.hasAccess('gerceklesen-ceki-raporu'));
  canSee3KIsListesi = computed(() => this.isSandikYonetimi() && this.permissions.hasAccess('3k-is-listesi'));
  canUseEksikTamamlama = computed(() => this.permissions.canWrite('sahaya-aktar'));
  canDeleteProject = computed(() => this.permissions.canWrite('proje-sil'));
  canSevkEt = computed(() => this.permissions.hasAccess('proje-sevk-et'));
  canUploadCeki = computed(() => this.permissions.canWrite('ceki-yukle'));
  canUpdatePlanlananSevkTarihi = computed(() => this.permissions.canWrite('planlanan-sevk-tarihi'));
  canSeeSahaGrid = computed(() => this.permissions.hasAccess('saha-grid-modulu'));
  canSeeSaha3K = computed(() => this.permissions.hasAccess('saha-3k-modulu'));
  canSeeSahaRapor = computed(() => this.permissions.hasAccess('saha-raporu'));
  canSeeSahaSevkSonrasiEksikRapor = computed(() => this.permissions.hasAccess('saha-sevk-sonrasi-eksik-raporu'));
  canSeeSahaGerceklesenRapor = computed(() => this.permissions.hasAccess('saha-gerceklesen-ceki-raporu'));
  canSeeSahaSandiklar = computed(() => this.permissions.hasAccess('saha-sandiklar'));
  canManageSahaAktarimGeriAl = computed(() => this.permissions.hasAccess('saha-aktarim-geri-al'));
  canWriteSahaAktarimGeriAl = computed(() => this.permissions.canWrite('saha-aktarim-geri-al'));
  canSevkEtCurrent = computed(() => this.isSahaYonetimi() ? this.permissions.hasAccess('saha-sevk-et') : this.canSevkEt());
  canDeleteProjectCurrent = computed(() => this.isSahaYonetimi() ? this.permissions.canWrite('saha-proje-sil') : this.canDeleteProject());
  hasSandikYonetimiActions = computed(() =>
    this.isSandikYonetimi() &&
    (this.canSeeGrid() || this.canSee3K() || this.canSeeEksikRapor() || this.canSevkEtCurrent() || this.canDeleteProjectCurrent())
  );
  hasSahaYonetimiActions = computed(() =>
    this.isSahaYonetimi() &&
    (this.canSeeSahaGrid() || this.canSeeSaha3K() || this.canSeeSahaRapor() || this.canSeeSahaSevkSonrasiEksikRapor() || this.canSeeSahaGerceklesenRapor() || this.canSeeSahaSandiklar() || this.canManageSahaAktarimGeriAl() || this.canSevkEtCurrent() || this.canUpdatePlanlananSevkTarihi() || this.canDeleteProjectCurrent())
  );
  hasYedekYonetimiActions = computed(() => this.isYedekYonetimi());
  hasActionColumn = computed(() =>
    this.hasSandikYonetimiActions() ||
    this.hasSahaYonetimiActions() ||
    this.hasYedekYonetimiActions() ||
    (this.isSevkEdilen() && this.canSeeGerceklesenRapor()) ||
    (this.isSahaYonetimi() && this.canSeeSahaGerceklesenRapor()) ||
    (!this.isSandikMode() && this.canSevkEt()) ||
    (!this.isSandikMode() && this.canUpdatePlanlananSevkTarihi()) ||
    (!this.isSandikMode() && this.hasAnySevkiyatGecmisi()) ||
    this.isSevkEdilen() ||
    (!this.isSandikMode() && this.canDeleteProjectCurrent())
  );
  canWriteCurrentMenu = computed(() => {
    const menuKod = this.route.snapshot.data['menuKod'];
    return typeof menuKod === 'string' && this.permissions.canWrite(menuKod);
  });
  canUploadRevision = computed(() =>
    !this.isSevkEdilen() &&
    !this.isSahaYonetimi() &&
    !this.isYedekYonetimi() &&
    this.permissions.canWrite('ceki-revizyon-yukle')
  );

  projeler = signal<ProjeDto[]>([]);
  loading = signal(true);

  // Server-side pagination
  searchTerm = signal('');
  currentPage = signal(1);
  pageSize = signal(15);
  pageSizeOptions = [15, 25, 50];
  totalCount = signal(0);
  totalPages = signal(0);

  private searchSubject = new Subject<string>();

  // Çeki yükleme
  showUploadModal = signal(false);
  uploadMode = signal<'normal' | 'revizyon'>('normal');
  selectedFile = signal<File | null>(null);
  uploading = signal(false);
  previewingRevision = signal(false);
  revisionPreview = signal<CekiRevizyonOnizlemeSonuc | null>(null);
  revisionFilter = signal<'all' | 'A' | 'U' | 'D'>('all');
  filteredRevisionRows = computed(() => {
    const preview = this.revisionPreview();
    if (!preview) return [];

    const filter = this.revisionFilter();
    if (filter === 'all') {
      return preview.satirlar;
    }

    return preview.satirlar.filter(row => row.checkKodu === filter);
  });
  uploadResult = signal<{ success: boolean; message: string } | null>(null);
  dragOver = signal(false);

  // Proje Oluştur (Saha/Yedek)
  showProjeOlusturModal = signal(false);
  creatingProje = signal(false);
  yeniProjeForm = signal({ projeNo: '', musteri: '', lokasyon: '' });

  // Sevk Tarihi Güncelle Modal
  showSevkTarihiModal = signal(false);
  selectedProjeId = signal(0);
  sevkTarihiProje = signal<ProjeDto | null>(null);
  guncelSevkTarihi = signal('');
  planlananSevkTarihiGecerli = computed(() => {
    const value = this.guncelSevkTarihi().trim();
    const dateTimeLocalPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/;

    return dateTimeLocalPattern.test(value) && !Number.isNaN(new Date(value).getTime());
  });
  sevkTarihiSaving = signal(false);

  // Sevk Et Modal
  showSevkEtModal = signal(false);
  sevkEtProje = signal<ProjeDto | null>(null);
  sevkEtTarihi = signal('');
  sevkEtAciklama = signal('');
  sevkEtAracPlaka = signal('');
  sevkEtSaving = signal(false);
  sevkEtSandiklar = signal<SandikDto[]>([]);
  sevkEtSandikLoading = signal(false);
  selectedSevkSandikIds = signal<number[]>([]);
  sevkGecmisi = signal<SevkiyatDto[]>([]);
  sevkGecmisiLoading = signal(false);
  showSevkGecmisiModal = signal(false);
  sevkGecmisiProje = signal<ProjeDto | null>(null);
  showKilitAcModal = signal(false);
  kilitAcProje = signal<ProjeDto | null>(null);
  kilitAcmaTipiId = signal<SevkiyatKilitAcmaTipi>(SevkiyatKilitAcmaTipi.SevkiyatKaydiKorunarakAc);
  kilitAcAciklama = signal('');
  kilitAcSaving = signal(false);
  showSahaAktarimModal = signal(false);
  sahaAktarimProje = signal<ProjeDto | null>(null);
  sahaAktarimlari = signal<SahaAktarimDto[]>([]);
  sahaAktarimLoading = signal(false);
  sahaAktarimGeriAlSaving = signal<number | null>(null);
  sahaSandikAktarimGeriAlSaving = signal<number | null>(null);
  sahaAktarimIslemVar = computed(() =>
    this.sahaAktarimGeriAlSaving() !== null || this.sahaSandikAktarimGeriAlSaving() !== null
  );
  sahaAktarimGruplari = computed<SahaAktarimGrubu[]>(() => {
    const gruplar = new Map<string, SahaAktarimGrubu>();

    for (const aktarim of this.sahaAktarimlari()) {
      const sahaSandikId = aktarim.sahaSandikId && aktarim.sahaSandikId > 0
        ? aktarim.sahaSandikId
        : null;
      const sahaSandikNo = (aktarim.sahaSandikNo ?? '').trim() || '-';
      const anahtar = sahaSandikId !== null ? `id:${sahaSandikId}` : `no:${sahaSandikNo}`;
      const mevcut = gruplar.get(anahtar);

      if (mevcut) {
        mevcut.aktarimlar.push(aktarim);
        continue;
      }

      gruplar.set(anahtar, {
        sahaSandikId,
        sahaSandikNo,
        aktarimlar: [aktarim],
        geriAlinabilirMi: false,
        geriAlinamamaNedeni: null
      });
    }

    return Array.from(gruplar.values())
      .map(grup => {
        const nedenler = Array.from(new Set(
          grup.aktarimlar
            .filter(aktarim => !aktarim.geriAlinabilirMi)
            .map(aktarim => aktarim.geriAlinamamaNedeni?.trim())
            .filter((neden): neden is string => !!neden)
        ));

        const sandikMevcutMu = grup.sahaSandikId !== null;
        const tumSatirlarGeriAlinabilirMi = grup.aktarimlar.every(aktarim => aktarim.geriAlinabilirMi);

        return {
          ...grup,
          geriAlinabilirMi: sandikMevcutMu && tumSatirlarGeriAlinabilirMi,
          geriAlinamamaNedeni: !sandikMevcutMu
            ? 'Saha sandığı kaydı bulunamadığı için toplu geri alma yapılamaz.'
            : nedenler.length > 0
              ? nedenler.join(' ')
              : tumSatirlarGeriAlinabilirMi
                ? null
                : 'Sandıktaki en az bir aktarım geri alınabilir durumda değil.'
        };
      })
      .sort((a, b) => this.sandikNoCollator.compare(a.sahaSandikNo, b.sahaSandikNo));
  });
  readonly kilitAcmaTipleri = SevkiyatKilitAcmaTipi;
  sevkGecmisiSevkiyatSayisi = computed(() => this.sevkGecmisi().filter(kayit => !kayit.isKilitAcma).length);
  sevkEtSelectableSandiklar = computed(() => this.sevkEtSandiklar().filter(s => !this.isSandikSevkEdildi(s)));
  allSevkSandikSelected = computed(() => {
    const selectable = this.sevkEtSelectableSandiklar();
    const selected = this.selectedSevkSandikIds();
    return selectable.length > 0 && selectable.every(s => selected.includes(s.id));
  });
  hasAnySevkiyatGecmisi = computed(() => this.projeler().some(p => this.hasSevkiyatGecmisi(p)));

  breadcrumb: { label: string; link?: string }[] = [
    { label: 'Ana Kontrol Paneli', link: '/dashboard' },
    { label: 'Projeler' },
  ];

  /** Saha/Yedek modülleri sandık yönetimine benzer akış kullanır ama farklı routePrefix */
  routePrefix = '';

  ngOnInit() {
    const menuKod = this.route.snapshot.data['menuKod'];
    this.isSandikYonetimi.set(menuKod === 'sandik-yonetimi');
    this.isSevkEdilen.set(menuKod === 'sevk-edilen');
    this.isAktifProjeler.set(menuKod === 'aktif-projeler');
    this.isSahaYonetimi.set(menuKod === 'saha-yonetimi');
    this.isYedekYonetimi.set(menuKod === 'yedek-yonetimi');
    
    if (this.isSandikYonetimi()) {
      this.breadcrumb = [
        { label: 'Ana Kontrol Paneli', link: '/dashboard' },
        { label: 'Sandık Yönetimi' },
      ];
      this.routePrefix = '/sandik-yonetimi';
    } else if (this.isSevkEdilen()) {
      this.breadcrumb = [
        { label: 'Ana Kontrol Paneli', link: '/dashboard' },
        { label: 'Sevk Edilen Projeler' },
      ];
    } else if (this.isSahaYonetimi()) {
      this.breadcrumb = [
        { label: 'Ana Kontrol Paneli', link: '/dashboard' },
        { label: 'Saha Yönetimi' },
      ];
      this.routePrefix = '/saha-yonetimi';
    } else if (this.isYedekYonetimi()) {
      this.breadcrumb = [
        { label: 'Ana Kontrol Paneli', link: '/dashboard' },
        { label: 'Yedek Yönetimi' },
      ];
      this.routePrefix = '/yedek-yonetimi';
    }
    
    this.loadProjeler();

    this.searchSubject.pipe(
      debounceTime(400),
      distinctUntilChanged()
    ).subscribe(term => {
      this.searchTerm.set(term);
      this.currentPage.set(1);
      this.loadProjeler();
    });
  }

  /** Sandık yönetimi moduna giren tüm modlar için ortak kontrol */
  isSandikMode = computed(() => this.isSandikYonetimi() || this.isSahaYonetimi() || this.isYedekYonetimi());
  showProjeTipiFilter = computed(() => this.isAktifProjeler() || this.isSevkEdilen());

  loadProjeler() {
    this.loading.set(true);

    // Mode'a gore parametreleri belirle
    let projeTipiId: number | undefined;
    let isSevkEdilen: boolean | undefined;

    if (this.showProjeTipiFilter()) {
      projeTipiId = this.projeTipiFilter() ?? undefined;
      isSevkEdilen = this.isSevkEdilen();
    } else if (this.isSahaYonetimi()) {
      projeTipiId = 2;
    } else if (this.isYedekYonetimi()) {
      projeTipiId = 3;
    } else if (this.isSevkEdilen()) {
      isSevkEdilen = true; // Tum tipler, sadece sevk edilmis
    } else {
      // Aktif Projeler veya Sandik Yonetimi — Normal projeler, sevk edilmemis
      projeTipiId = 1;
      isSevkEdilen = false;
    }

    this.projeService.getProjeListesi(
      this.currentPage(),
      this.pageSize(),
      projeTipiId,
      this.searchTerm() || undefined,
      isSevkEdilen
    ).subscribe(res => {
      this.loading.set(false);
      if (res.isSuccess && res.value) {
        this.projeler.set(res.value.items);
        this.totalCount.set(res.value.totalCount);
        this.totalPages.set(res.value.totalPages);
      }
    });
  }

  onSearch(event: Event) {
    const term = (event.target as HTMLInputElement).value;
    this.searchSubject.next(term);
  }

  setProjeTipiFilter(value: number | null) {
    if (this.projeTipiFilter() === value) return;
    this.projeTipiFilter.set(value);
    this.currentPage.set(1);
    this.loadProjeler();
  }

  // ===== Pagination Navigation =====
  goToPage(page: number | null) {
    if (page === null || page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
    this.loadProjeler();
  }
  prevPage() { this.goToPage(this.currentPage() - 1); }
  nextPage() { this.goToPage(this.currentPage() + 1); }

  onPageSizeChange(size: number) {
    this.pageSize.set(size);
    this.currentPage.set(1);
    this.loadProjeler();
  }

  mathMin(a: number, b: number): number {
    return Math.min(a, b);
  }

  private formatDateTimeLocal(date: Date): string {
    const pad = (value: number) => value.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  private toDateTimeLocalInputValue(value?: string | Date | null): string {
    if (!value) {
      return this.formatDateTimeLocal(new Date());
    }

    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? this.formatDateTimeLocal(new Date()) : this.formatDateTimeLocal(date);
  }

  private toApiDateTime(value: string): string | null {
    const normalizedValue = value.trim();
    if (!normalizedValue) return null;

    return normalizedValue.length === 16 ? `${normalizedValue}:00` : normalizedValue;
  }

  private compareSandikNo(a?: string | null, b?: string | null): number {
    const left = (a ?? '').trim();
    const right = (b ?? '').trim();
    const result = this.sandikNoCollator.compare(left, right);
    return result !== 0 ? result : left.localeCompare(right, 'tr');
  }

  private sortBySandikNo<T extends { sandikNo: string }>(items: T[]): T[] {
    return [...items].sort((a, b) => this.compareSandikNo(a.sandikNo, b.sandikNo));
  }

  private sortSevkiyatSandiklari(sevkiyatlar: SevkiyatDto[]): SevkiyatDto[] {
    return sevkiyatlar.map(sevkiyat => ({
      ...sevkiyat,
      sandiklar: this.sortBySandikNo(sevkiyat.sandiklar ?? [])
    }));
  }

  getTamamlanmaYuzdesi(p: ProjeDto): number {
    if (p.toplamUrunSayisi === 0) return 0;
    return Math.floor((p.tamamlananUrunSayisi / p.toplamUrunSayisi) * 100);
  }

  getDurumLabel(durum: string): string {
    const map: Record<string, string> = {
      Hazirlaniyor: 'Hazırlanıyor',
      DevamEdiyor: 'Devam Ediyor',
      Tamamlandi: 'Tamamlandı',
      EksikSevkEdildi: 'Kısmi Sevk',
      'Eksik Sevk Edildi': 'Kısmi Sevk',
    };
    return map[durum] ?? durum;
  }

  shouldShowActions(p: ProjeDto): boolean {
    if (this.isSahaYonetimi()) return this.hasSahaYonetimiActions();
    if (this.isYedekYonetimi()) return this.hasYedekYonetimiActions();
    if (this.isSandikYonetimi()) return this.hasSandikYonetimiActions();

    return this.canShowGerceklesenRapor(p) ||
      (!this.isSandikMode() && this.hasSevkiyatGecmisi(p)) ||
      (!this.isSandikMode() && this.canSevkEt()) ||
      this.canDeleteProjectCurrent();
  }

  canShowGerceklesenRapor(p: ProjeDto): boolean {
    if (this.isSahaYonetimi()) {
      return p.projeTipiId === 2 && this.canSeeSahaGerceklesenRapor() && this.hasSevkiyatGecmisi(p);
    }

    return this.isSevkEdilen() && p.projeTipiId === 1 && this.canSeeGerceklesenRapor();
  }
  @HostListener('document:click')
  closeReportMenu() {
    this.reportMenuKey.set(null);
    this.reportMenuPosition.set(null);
    this.reportMenuContext.set(null);
  }

  toggleReportMenu(event: MouseEvent, key: string, proje: ProjeDto, type: 'eksik' | 'gerceklesen') {
    event.stopPropagation();
    if (this.reportMenuKey() === key) {
      this.closeReportMenu();
      return;
    }

    const button = event.currentTarget as HTMLElement;
    const rect = button.getBoundingClientRect();
    const menuWidth = 210;
    const menuHeight = 118;
    const gap = 8;
    const left = Math.min(Math.max(8, rect.right - menuWidth), window.innerWidth - menuWidth - 8);
    const opensBelow = rect.bottom + gap + menuHeight <= window.innerHeight - 8;
    const top = opensBelow ? rect.bottom + gap : Math.max(8, rect.top - menuHeight - gap);

    this.reportMenuPosition.set({
      top,
      left,
    });
    this.reportMenuContext.set({ key, proje, type });
    this.reportMenuKey.set(key);
  }

  isReportMenuOpen(key: string): boolean {
    return this.reportMenuKey() === key;
  }

  isEksikDownloading(projeId: number): boolean {
    return this.downloadingEksikPdf() === projeId || this.downloadingEksikExcel() === projeId;
  }

  isGerceklesenDownloading(projeId: number): boolean {
    return this.downloadingGerceklesenPdf() === projeId || this.downloadingGerceklesenExcel() === projeId;
  }

  indirSahaProjePdf(proje: ProjeDto) {
    this.downloadingPdf.set(proje.id);
    const tipStr = this.isYedekYonetimi() ? 'YedekRaporu' : 'SahaRaporu';
    this.pdfService.sahaProjePdf(proje.id, this.isSahaYonetimi() ? 'saha-raporu' : undefined).subscribe({
      next: (blob) => {
        this.downloadingPdf.set(null);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${proje.projeNo}_${tipStr}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
        this.toastService.success(`${tipStr} başarıyla indirildi.`);
      },
      error: () => {
        this.downloadingPdf.set(null);
        this.toastService.error('Rapor indirilirken bir hata oluştu.');
      }
    });
  }

  indirEksikUrunlerPdf(proje: ProjeDto) {
    this.closeReportMenu();
    this.downloadingEksikPdf.set(proje.id);
    const raporAdi = this.isSahaYonetimi() ? 'SevkSonrasiEksikRaporu' : 'EksikRaporu';
    const menuKod = this.isSahaYonetimi() ? 'saha-sevk-sonrasi-eksik-raporu' : 'eksik-raporu';
    const basariMesaji = this.isSahaYonetimi()
      ? 'Sevk sonrası eksik raporu indirildi.'
      : 'Eksik ürünler raporu indirildi.';
    this.pdfService.eksikUrunlerPdf(proje.id, menuKod).subscribe({
      next: (blob) => {
        this.downloadingEksikPdf.set(null);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${proje.projeNo}_${raporAdi}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
        this.toastService.success(basariMesaji);
      },
      error: () => {
        this.downloadingEksikPdf.set(null);
        this.toastService.error('Rapor indirilirken bir hata oluştu.');
      }
    });
  }

  indirEksikUrunlerExcel(proje: ProjeDto) {
    this.closeReportMenu();
    this.downloadingEksikExcel.set(proje.id);
    const raporAdi = this.isSahaYonetimi() ? 'SevkSonrasiEksikRaporu' : 'EksikRaporu';
    const menuKod = this.isSahaYonetimi() ? 'saha-sevk-sonrasi-eksik-raporu' : 'eksik-raporu';
    const basariMesaji = this.isSahaYonetimi()
      ? 'Sevk sonrası eksik Excel raporu indirildi.'
      : 'Eksik ürünler Excel raporu indirildi.';
    this.pdfService.eksikUrunlerExcel(proje.id, menuKod).subscribe({
      next: (blob) => {
        this.downloadingEksikExcel.set(null);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${proje.projeNo}_${raporAdi}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
        this.toastService.success(basariMesaji);
      },
      error: () => {
        this.downloadingEksikExcel.set(null);
        this.toastService.error('Excel raporu indirilirken bir hata oluştu.');
      }
    });
  }

  // ===== Çeki Yükleme Modal =====

  indirGerceklesenCekiListesiPdf(proje: ProjeDto) {
    this.closeReportMenu();
    this.downloadingGerceklesenPdf.set(proje.id);
    const request$ = this.isSahaYonetimi()
      ? this.pdfService.sahaGerceklesenCekiListesiPdf(proje.id)
      : this.pdfService.gerceklesenCekiListesiPdf(proje.id);
    request$.subscribe({
      next: (blob) => {
        this.downloadingGerceklesenPdf.set(null);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${proje.projeNo}_GerceklesenCekiListesi.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
        this.toastService.success('Gerçekleşen çeki listesi raporu indirildi.');
      },
      error: () => {
        this.downloadingGerceklesenPdf.set(null);
        this.toastService.error('Rapor indirilirken bir hata oluştu.');
      }
    });
  }

  indirGerceklesenCekiListesiExcel(proje: ProjeDto) {
    this.closeReportMenu();
    this.downloadingGerceklesenExcel.set(proje.id);
    const request$ = this.isSahaYonetimi()
      ? this.pdfService.sahaGerceklesenCekiListesiExcel(proje.id)
      : this.pdfService.gerceklesenCekiListesiExcel(proje.id);
    request$.subscribe({
      next: (blob) => {
        this.downloadingGerceklesenExcel.set(null);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${proje.projeNo}_GerceklesenCekiListesi.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
        this.toastService.success('Gerçekleşen çeki listesi Excel raporu indirildi.');
      },
      error: () => {
        this.downloadingGerceklesenExcel.set(null);
        this.toastService.error('Excel raporu indirilirken bir hata oluştu.');
      }
    });
  }

  openUploadModal(mode: 'normal' | 'revizyon' = 'normal') {
    this.uploadMode.set(mode);
    this.showUploadModal.set(true);
    this.selectedFile.set(null);
    this.revisionPreview.set(null);
    this.revisionFilter.set('all');
    this.uploadResult.set(null);
  }

  closeUploadModal() {
    this.showUploadModal.set(false);
    this.selectedFile.set(null);
    this.revisionPreview.set(null);
    this.revisionFilter.set('all');
    this.uploadResult.set(null);
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile.set(input.files[0]);
      this.revisionPreview.set(null);
      this.revisionFilter.set('all');
      this.uploadResult.set(null);
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.dragOver.set(true);
  }

  onDragLeave() {
    this.dragOver.set(false);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.dragOver.set(false);
    if (event.dataTransfer?.files.length) {
      const file = event.dataTransfer.files[0];
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        this.selectedFile.set(file);
        this.revisionPreview.set(null);
        this.revisionFilter.set('all');
        this.uploadResult.set(null);
      } else {
        this.uploadResult.set({ success: false, message: 'Sadece .xlsx veya .xls dosyaları kabul edilir.' });
      }
    }
  }

  previewRevision() {
    const file = this.selectedFile();
    if (!file) return;

    this.previewingRevision.set(true);
    this.uploadResult.set(null);
    this.revisionPreview.set(null);
    this.revisionFilter.set('all');

    this.projeService.cekiRevizyonOnizle(file).subscribe({
      next: (res) => {
        this.previewingRevision.set(false);
        if (res.isSuccess && res.value) {
          this.revisionPreview.set(res.value);
          this.revisionFilter.set('all');
          if (res.value.uygulanabilirMi) {
            this.toastService.success(res.value.mesaj);
          } else {
            this.uploadResult.set({ success: false, message: res.value.mesaj });
            this.toastService.error(res.value.mesaj);
          }
        } else {
          this.uploadResult.set({ success: false, message: res.error ?? 'Revizyon ön izleme başarısız.' });
          this.toastService.error(res.error ?? 'Revizyon ön izleme başarısız. Lütfen dosyayı kontrol edin.');
        }
      },
      error: () => {
        this.previewingRevision.set(false);
        this.uploadResult.set({ success: false, message: 'Revizyon ön izleme sırasında hata oluştu.' });
        this.toastService.error('Sunucuyla bağlantı kurulurken hata oluştu.');
      },
    });
  }

  uploadCeki() {
    const file = this.selectedFile();
    if (!file) return;

    if (this.uploadMode() === 'revizyon' && !this.revisionPreview()) {
      this.previewRevision();
      return;
    }

    if (this.uploadMode() === 'revizyon' && this.revisionPreview() && !this.revisionPreview()!.uygulanabilirMi) {
      this.uploadResult.set({ success: false, message: 'Ön izlemede engelli satırlar var. Revizyon uygulanamaz.' });
      return;
    }

    this.uploading.set(true);
    this.uploadResult.set(null);

    const request$: any = this.uploadMode() === 'revizyon'
      ? this.projeService.cekiRevizyonYukle(file)
      : this.projeService.cekiYukle(file);

    request$.subscribe({
      next: (res: any) => {
        this.uploading.set(false);
        if (res.isSuccess && res.value) {
          const value = res.value as any;
          if (this.uploadMode() === 'revizyon') {
            this.toastService.success(
              value.mesaj ?? `Revizyon uygulandı. Eklenen: ${value.eklenenSatirSayisi}, Güncellenen: ${value.guncellenenSatirSayisi}, Silinen: ${value.silinenSatirSayisi}.`
            );
          } else {
            this.toastService.success(`Çeki başarıyla yüklendi! ${value.satirSayisi} satır, ${value.sandikSayisi} sandık oluşturuldu.`);
          }
          this.closeUploadModal();
          this.loadProjeler(); // Listeyi yenile
        } else {
          this.uploadResult.set({ success: false, message: res.error ?? 'Yükleme başarısız.' });
          this.toastService.error(res.error ?? 'Yükleme başarısız. Lütfen dosyayı kontrol edin.');
        }
      },
      error: () => {
        this.uploading.set(false);
        this.uploadResult.set({ success: false, message: 'Yükleme sırasında hata oluştu.' });
        this.toastService.error('Sunucuyla bağlantı kurulurken hata oluştu.');
      },
    });
  }

  removeFile() {
    this.selectedFile.set(null);
    this.revisionPreview.set(null);
    this.revisionFilter.set('all');
    this.uploadResult.set(null);
  }

  setRevisionFilter(filter: 'all' | 'A' | 'U' | 'D') {
    this.revisionFilter.set(filter);
  }

  revisionOperationClass(checkKodu: string): string {
    if (checkKodu === 'A') return 'is-add';
    if (checkKodu === 'U') return 'is-update';
    if (checkKodu === 'D') return 'is-delete';
    return '';
  }

  revisionOperationLabel(checkKodu: string): string {
    if (checkKodu === 'A') return 'Eklenecek';
    if (checkKodu === 'U') return 'Güncellenecek';
    if (checkKodu === 'D') return 'Silinecek';
    return checkKodu;
  }

  formatRevisionChange(change: string): string {
    if (!change) return '';

    const separatorIndex = change.indexOf(':');
    if (separatorIndex < 0) return change;

    const fieldName = change.slice(0, separatorIndex).trim();
    const rawValue = change.slice(separatorIndex + 1).trim();
    const arrow = rawValue.includes('→') ? '→' : rawValue.includes('->') ? '->' : '';

    if (!arrow) {
      return `${fieldName}: ${this.formatRevisionValue(fieldName, rawValue)}`;
    }

    const [oldValue, newValue] = rawValue.split(arrow).map(value => value.trim());
    return `${fieldName}: ${this.formatRevisionValue(fieldName, oldValue)} → ${this.formatRevisionValue(fieldName, newValue)}`;
  }

  private formatRevisionValue(fieldName: string, value: string): string {
    const normalized = (value ?? '').trim();
    if (!normalized || normalized === '-') return '-';

    const numericFields = ['miktar', 'sıra no', 'birim'];
    const isNumericField = numericFields.includes(fieldName.toLocaleLowerCase('tr-TR'));
    const numericValue = normalized.replace(',', '.');

    if (!isNumericField || !/^-?\d+(\.\d+)?$/.test(numericValue)) {
      return normalized;
    }

    const [integerPart, decimalPart] = numericValue.split('.');
    const cleanDecimal = (decimalPart ?? '').replace(/0+$/, '');
    return cleanDecimal ? `${integerPart}.${cleanDecimal}` : integerPart;
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  // ===== Sevk Tarihi Güncelle =====
  
  openSevkTarihiModal(proje: ProjeDto) {
    this.selectedProjeId.set(proje.id);
    this.sevkTarihiProje.set(proje);
    this.guncelSevkTarihi.set(proje.planlananSevkTarihi ? this.toDateTimeLocalInputValue(proje.planlananSevkTarihi) : '');
    this.showSevkTarihiModal.set(true);
  }

  closeSevkTarihiModal() {
    this.showSevkTarihiModal.set(false);
    this.selectedProjeId.set(0);
    this.sevkTarihiProje.set(null);
    this.guncelSevkTarihi.set('');
  }

  kaydetSevkTarihi() {
    const tarih = this.toApiDateTime(this.guncelSevkTarihi());

    if (!tarih || !this.planlananSevkTarihiGecerli()) {
      this.toastService.error('Lütfen geçerli bir planlanan sevk tarihi ve saati seçiniz.');
      return;
    }

    this.planlananSevkTarihiGuncelle(tarih, 'Planlanan sevk tarihi güncellendi.');
  }

  async planlananSevkTarihiKaldir(): Promise<void> {
    if (!this.sevkTarihiProje()?.planlananSevkTarihi || this.sevkTarihiSaving()) return;

    const onay = await this.confirmService.ask({
      title: 'Planlanan Sevk Tarihini Kaldır',
      message: 'Bu projedeki kayıtlı planlanan sevk tarihi kaldırılacaktır.',
      confirmText: 'Tarihi Kaldır',
      cancelText: 'Vazgeç',
      type: 'warning'
    });

    if (!onay) return;

    this.planlananSevkTarihiGuncelle(null, 'Planlanan sevk tarihi kaldırıldı.');
  }

  private planlananSevkTarihiGuncelle(tarih: string | null, basariMesaji: string): void {
    const projeId = this.selectedProjeId();
    if (projeId <= 0 || this.sevkTarihiSaving()) return;

    this.sevkTarihiSaving.set(true);

    this.projeService.sevkTarihiGuncelle(projeId, tarih).subscribe({
      next: (res) => {
        this.sevkTarihiSaving.set(false);
        if (res.isSuccess) {
          this.toastService.success(basariMesaji);
          this.closeSevkTarihiModal();
          this.loadProjeler();
        } else {
          this.toastService.error(res.error || 'İşlem başarısız.');
        }
      },
      error: () => {
        this.sevkTarihiSaving.set(false);
        this.toastService.error('Sunucu hatası oluştu.');
      }
    });
  }

  // ===== Proje Oluştur Modal (Saha/Yedek) =====

  openProjeOlusturModal() {
    this.yeniProjeForm.set({ projeNo: '', musteri: '', lokasyon: '' });
    this.showProjeOlusturModal.set(true);
  }

  closeProjeOlusturModal() {
    this.showProjeOlusturModal.set(false);
  }

  submitProjeOlustur() {
    const form = this.yeniProjeForm();
    if (!form.projeNo.trim()) {
      this.toastService.error('Proje No zorunludur.');
      return;
    }

    this.creatingProje.set(true);
    const tipId = this.isSahaYonetimi() ? 2 : 3;

    this.projeService.projeOlustur({
      projeNo: form.projeNo,
      musteri: form.musteri || '-',
      projeTipiId: tipId,
      sorumluKisi: '',
      lokasyon: form.lokasyon || '-'
    }).subscribe({
      next: (res) => {
        this.creatingProje.set(false);
        if (res.isSuccess) {
          const yeniProjeId = res.value?.id;
          this.toastService.success('Proje başarıyla oluşturuldu.');
          this.closeProjeOlusturModal();
          if (yeniProjeId) {
            this.router.navigate([this.routePrefix, yeniProjeId]);
          } else {
            this.loadProjeler();
          }
        } else {
          this.toastService.error(res.error || 'Proje oluşturulamadı.');
        }
      },
      error: () => {
        this.creatingProje.set(false);
        this.toastService.error('Sunucu hatası oluştu.');
      }
    });
  }

  openSahaAktarimModal(proje: ProjeDto) {
    if (!this.canManageSahaAktarimGeriAl()) return;

    this.sahaAktarimProje.set(proje);
    this.sahaAktarimlari.set([]);
    this.sahaAktarimLoading.set(false);
    this.sahaAktarimGeriAlSaving.set(null);
    this.sahaSandikAktarimGeriAlSaving.set(null);
    this.showSahaAktarimModal.set(true);
    this.loadSahaAktarimlari(proje.id);
  }

  closeSahaAktarimModal() {
    if (this.sahaAktarimIslemVar()) return;

    this.showSahaAktarimModal.set(false);
    this.sahaAktarimProje.set(null);
    this.sahaAktarimlari.set([]);
    this.sahaAktarimLoading.set(false);
  }

  private loadSahaAktarimlari(projeId: number) {
    this.sahaAktarimLoading.set(true);
    this.projeService.getSahaAktarimlari(projeId).subscribe({
      next: (res) => {
        this.sahaAktarimLoading.set(false);
        if (res.isSuccess && res.value) {
          this.sahaAktarimlari.set(res.value);
        } else {
          this.toastService.error(res.error || 'Saha aktarımları yüklenemedi.');
        }
      },
      error: () => {
        this.sahaAktarimLoading.set(false);
        this.toastService.error('Saha aktarımları yüklenirken sunucu hatası oluştu.');
      }
    });
  }

  formatAktarimMiktar(value: number): string {
    if (value == null) return '-';
    return Number.isInteger(value) ? value.toString() : value.toString().replace(/0+$/, '').replace(/\.$/, '');
  }

  formatAktarimBirim(value?: string | null): string {
    const normalized = (value ?? '').trim();
    return !normalized || normalized === '?' ? 'Adet' : normalized;
  }

  formatAktarimGrupMiktar(grup: SahaAktarimGrubu): string {
    const birimler = new Map<string, number>();

    for (const aktarim of grup.aktarimlar) {
      const birim = this.formatAktarimBirim(aktarim.birim);
      birimler.set(birim, (birimler.get(birim) ?? 0) + (Number(aktarim.miktar) || 0));
    }

    return Array.from(birimler.entries())
      .map(([birim, miktar]) => `${this.formatAktarimMiktar(miktar)} ${birim}`)
      .join(' + ');
  }

  async sahaAktarimGeriAl(aktarim: SahaAktarimDto): Promise<void> {
    const proje = this.sahaAktarimProje();
    if (!proje || !this.canWriteSahaAktarimGeriAl() || !aktarim.geriAlinabilirMi || this.sahaAktarimIslemVar()) return;

    const onay = await this.confirmService.ask({
      title: 'Saha Aktarımını Geri Al',
      message: `<strong>${aktarim.kaynakProjeNo}</strong> kaynak projesindeki <strong>#${aktarim.siraNo}</strong> satırının <strong>${this.formatAktarimMiktar(aktarim.miktar)} ${this.formatAktarimBirim(aktarim.birim)}</strong> saha aktarımı geri alınacak.<br>Ürün normal proje eksik takibine geri döner.`,
      confirmText: 'Geri Al',
      cancelText: 'Vazgeç',
      type: 'warning'
    });

    if (!onay) return;

    this.sahaAktarimGeriAlSaving.set(aktarim.sahaCekiSatiriId);
    this.projeService.sahaAktarimGeriAl(aktarim.sahaCekiSatiriId, 'Saha Yönetimi üzerinden aktarım geri alındı.').subscribe({
      next: (res) => {
        this.sahaAktarimGeriAlSaving.set(null);
        if (res.isSuccess) {
          this.toastService.success('Saha aktarımı geri alındı.');
          this.loadSahaAktarimlari(proje.id);
          this.loadProjeler();
        } else {
          this.toastService.error(res.error || 'Saha aktarımı geri alınamadı.');
        }
      },
      error: () => {
        this.sahaAktarimGeriAlSaving.set(null);
        this.toastService.error('Saha aktarımı geri alınırken sunucu hatası oluştu.');
      }
    });
  }

  async sahaSandikAktarimlariniGeriAl(grup: SahaAktarimGrubu): Promise<void> {
    const proje = this.sahaAktarimProje();
    if (
      !proje ||
      !this.canWriteSahaAktarimGeriAl() ||
      !grup.geriAlinabilirMi ||
      grup.sahaSandikId === null ||
      this.sahaAktarimIslemVar()
    ) {
      return;
    }

    const onay = await this.confirmService.ask({
      title: 'Sandıktaki Tüm Aktarımları Geri Al',
      message: `<strong>Saha Sandığı ${grup.sahaSandikNo}</strong> içindeki <strong>${grup.aktarimlar.length} aktarım satırı</strong> (${this.formatAktarimGrupMiktar(grup)}) tek işlemde geri alınacak.<br>Ürünler kaynak normal projelerinin eksik takibine geri döner. İşlem sırasında herhangi bir satır geri alınamazsa hiçbir kayıt değiştirilmez.`,
      confirmText: 'Tümünü Geri Al',
      cancelText: 'Vazgeç',
      type: 'warning'
    });

    if (!onay) return;

    this.sahaSandikAktarimGeriAlSaving.set(grup.sahaSandikId);
    this.projeService.sahaSandikAktarimlariGeriAl(
      grup.sahaSandikId,
      `Saha Yönetimi üzerinden Saha Sandığı ${grup.sahaSandikNo} içindeki tüm aktarımlar geri alındı.`
    ).subscribe({
      next: (res) => {
        this.sahaSandikAktarimGeriAlSaving.set(null);
        if (res.isSuccess) {
          const sonuc = res.value;
          const mesaj = sonuc
            ? `${sonuc.geriAlinanSatirSayisi} aktarım satırı (${this.formatAktarimGrupMiktar(grup)}) geri alındı${sonuc.sandikBosaldiMi ? '; saha sandığı boşaldı.' : '.'}`
            : 'Sandıktaki tüm saha aktarımları geri alındı.';
          this.toastService.success(mesaj);
          this.loadSahaAktarimlari(proje.id);
          this.loadProjeler();
        } else {
          this.toastService.error(res.error || 'Sandıktaki aktarımlar geri alınamadı.');
        }
      },
      error: () => {
        this.sahaSandikAktarimGeriAlSaving.set(null);
        this.toastService.error('Sandıktaki aktarımlar geri alınırken sunucu hatası oluştu.');
      }
    });
  }

  // ===== Proje Sevk (Kilitleme) İşlemleri =====

  private getSevkMenuKod(): string {
    return this.isSahaYonetimi() ? 'saha-sevk-et' : 'proje-sevk-et';
  }

  private getProjeSilMenuKod(): string {
    return this.isSahaYonetimi() ? 'saha-proje-sil' : 'proje-sil';
  }
  openSevkEtModal(proje: ProjeDto) {
    this.sevkEtProje.set(proje);
    this.sevkEtTarihi.set(this.toDateTimeLocalInputValue());
    this.sevkEtAciklama.set('');
    this.sevkEtAracPlaka.set('');
    this.sevkEtSandiklar.set([]);
    this.selectedSevkSandikIds.set([]);
    this.sevkGecmisi.set([]);
    this.sevkGecmisiLoading.set(false);
    this.showSevkEtModal.set(true);
    this.loadSevkEtSandiklar(proje.id);
    this.loadSevkiyatGecmisi(proje.id);
  }

  closeSevkEtModal() {
    this.showSevkEtModal.set(false);
    this.sevkEtProje.set(null);
    this.sevkEtTarihi.set('');
    this.sevkEtAciklama.set('');
    this.sevkEtAracPlaka.set('');
    this.sevkEtSandiklar.set([]);
    this.selectedSevkSandikIds.set([]);
    this.sevkEtSandikLoading.set(false);
    this.sevkGecmisi.set([]);
    this.sevkGecmisiLoading.set(false);
  }

  hasSevkiyatGecmisi(proje: ProjeDto): boolean {
    const durum = proje.durumMetni;
    return !!proje.gerceklesenSevkTarihi ||
      durum === 'SevkEdildi' ||
      durum === 'Sevk Edildi' ||
      durum === 'EksikSevkEdildi' ||
      durum === 'Eksik Sevk Edildi';
  }

  openSevkGecmisiModal(proje: ProjeDto) {
    this.sevkGecmisiProje.set(proje);
    this.sevkGecmisi.set([]);
    this.sevkGecmisiLoading.set(false);
    this.showSevkGecmisiModal.set(true);
    this.loadSevkiyatGecmisi(proje.id);
  }

  closeSevkGecmisiModal() {
    this.showSevkGecmisiModal.set(false);
    this.sevkGecmisiProje.set(null);
    this.sevkGecmisi.set([]);
    this.sevkGecmisiLoading.set(false);
  }

  private loadSevkiyatGecmisi(projeId: number) {
    this.sevkGecmisiLoading.set(true);
    this.projeService.getSevkiyatlar(projeId).subscribe({
      next: (res) => {
        this.sevkGecmisiLoading.set(false);
        if (res.isSuccess && res.value) {
          this.sevkGecmisi.set(this.sortSevkiyatSandiklari(res.value));
        }
      },
      error: () => {
        this.sevkGecmisiLoading.set(false);
        this.toastService.error('Sevkiyat geçmişi yüklenemedi.');
      }
    });
  }

  isSandikSevkEdildi(sandik: SandikDto): boolean {
    return sandik.durumId === 4 || sandik.durumMetni === 'SevkEdildi' || sandik.durumMetni === 'Sevk Edildi';
  }

  isSandikDuzeltmeyeAcik(sandik: SandikDto): boolean {
    return sandik.sevkiyatDuzeltmeAcikMi === true;
  }

  isSandikKilitli(sandik: SandikDto): boolean {
    return this.isSandikSevkEdildi(sandik) && !this.isSandikDuzeltmeyeAcik(sandik);
  }

  private loadSevkEtSandiklar(projeId: number) {
    this.sevkEtSandikLoading.set(true);
    this.sandikService.getSandiklar(projeId).subscribe({
      next: (res) => {
        this.sevkEtSandikLoading.set(false);
        if (res.isSuccess && res.value) {
          const sandiklar = this.sortBySandikNo(res.value);
          this.sevkEtSandiklar.set(sandiklar);
          this.selectedSevkSandikIds.set(sandiklar.filter(s => !this.isSandikSevkEdildi(s)).map(s => s.id));
        } else {
          this.toastService.error(res.error || 'Sandıklar yüklenemedi.');
        }
      },
      error: () => {
        this.sevkEtSandikLoading.set(false);
        this.toastService.error('Sandıklar yüklenirken sunucu hatası oluştu.');
      }
    });
  }

  toggleSevkSandik(sandikId: number, checked: boolean) {
    const selected = this.selectedSevkSandikIds();
    if (checked) {
      if (!selected.includes(sandikId)) {
        this.selectedSevkSandikIds.set([...selected, sandikId]);
      }
      return;
    }

    this.selectedSevkSandikIds.set(selected.filter(id => id !== sandikId));
  }

  toggleAllSevkSandiklar(checked: boolean) {
    if (!checked) {
      this.selectedSevkSandikIds.set([]);
      return;
    }

    this.selectedSevkSandikIds.set(this.sevkEtSelectableSandiklar().map(s => s.id));
  }

  sevkEtOnayla() {
    const proje = this.sevkEtProje();
    if (!proje) return;
    if (!this.sevkEtTarihi()) {
      this.toastService.error('Sevk tarihi girilmelidir.');
      return;
    }
    if (this.selectedSevkSandikIds().length === 0) {
      this.toastService.error('Sevk edilecek en az bir sandık seçilmelidir.');
      return;
    }
    this.sevkEtSaving.set(true);
    const tarih = this.toApiDateTime(this.sevkEtTarihi())!;
    const aciklama = this.sevkEtAciklama().trim() || undefined;
    const aracPlaka = this.sevkEtAracPlaka().trim() || undefined;
    this.projeService.sevkEt(proje.id, tarih, this.selectedSevkSandikIds(), aciklama, aracPlaka, this.getSevkMenuKod()).subscribe({
      next: (res) => {
        this.sevkEtSaving.set(false);
        if (res.isSuccess) {
          this.toastService.success('Seçili sandıklar başarıyla sevk edildi.');
          this.closeSevkEtModal();
          this.loadProjeler();
        } else {
          this.toastService.error(res.error || 'İşlem başarısız.');
        }
      },
      error: () => {
        this.sevkEtSaving.set(false);
        this.toastService.error('Sunucu hatası oluştu.');
      }
    });
  }

  openKilitAcModal(proje: ProjeDto) {
    this.kilitAcProje.set(proje);
    this.kilitAcmaTipiId.set(SevkiyatKilitAcmaTipi.SevkiyatKaydiKorunarakAc);
    this.kilitAcAciklama.set('');
    this.showKilitAcModal.set(true);
  }

  closeKilitAcModal() {
    if (this.kilitAcSaving()) return;
    this.showKilitAcModal.set(false);
    this.kilitAcProje.set(null);
    this.kilitAcAciklama.set('');
  }

  kilidiAcOnayla() {
    const proje = this.kilitAcProje();
    if (!proje) return;

    const aciklama = this.kilitAcAciklama().trim();
    if (!aciklama) {
      this.toastService.error('Kilit açma gerekçesi girilmelidir.');
      return;
    }

    this.kilitAcSaving.set(true);
    this.projeService.kilidiAc(
      proje.id,
      {
        kilitAcmaTipiId: this.kilitAcmaTipiId(),
        projeNo: proje.projeNo,
        aciklama
      },
      this.getSevkMenuKod()
    ).subscribe({
      next: (res) => {
        this.kilitAcSaving.set(false);
        if (res.isSuccess) {
          const queued = (res.value as any)?.statusCode === 202;
          this.toastService.success(queued ? 'Kilit açma talebi onaya gönderildi.' : 'Proje kilidi başarıyla açıldı.');
          this.closeKilitAcModal();
          this.loadProjeler();
        } else {
          this.toastService.error(res.error || 'İşlem başarısız.');
        }
      },
      error: () => {
        this.kilitAcSaving.set(false);
        this.toastService.error('Sunucu hatası oluştu.');
      }
    });
  }

  // ===== Proje Sil =====

  async projeSil(proje: ProjeDto) {
    const onay = await this.confirmService.ask({
      title: 'Projeyi Sil',
      message: `<strong>${proje.projeNo}</strong> numaralı projeyi silmek istediğinize emin misiniz?<br>
                <span class="text-danger">Bu işlem geri alınamaz! Projeye ait tüm sandıklar, ürünler ve veriler silinecektir.</span>`,
      confirmText: 'Evet, Sil',
      cancelText: 'Vazgeç',
      type: 'danger'
    });

    if (onay) {
      this.projeService.projeSil(proje.id, this.getProjeSilMenuKod()).subscribe({
        next: (res) => {
          if (res.isSuccess) {
            this.toastService.success(`${proje.projeNo} projesi ve tüm verileri başarıyla silindi.`);
            this.loadProjeler();
          } else {
            this.toastService.error(res.error || 'Proje silinemedi.');
          }
        },
        error: () => this.toastService.error('Sunucu hatası oluştu.')
      });
    }
  }
}

