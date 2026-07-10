import { DatePipe, NgClass } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, PRIMARY_OUTLET, Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, Subject, Subscription } from 'rxjs';
import { BildirimService } from '../../core/services/bildirim.service';
import { PermissionService } from '../../core/services/permission.service';
import { ToastService } from '../../core/services/toast.service';
import {
  BildirimDto,
  BildirimDurumu,
  BildirimListeFiltre,
  BildirimTipi,
} from '../../shared/models';
import { BreadcrumbComponent } from '../../shared/components/breadcrumb/breadcrumb.component';

type TarihFiltresi = 'tumu' | 'bugun' | 'son7Gun' | 'son30Gun' | 'ozel';

@Component({
  selector: 'app-bildirim-merkezi',
  standalone: true,
  imports: [DatePipe, NgClass, BreadcrumbComponent],
  templateUrl: './bildirim-merkezi.component.html',
  styleUrl: './bildirim-merkezi.component.scss',
})
export class BildirimMerkeziComponent implements OnInit, OnDestroy {
  private readonly bildirimService = inject(BildirimService);
  private readonly permissions = inject(PermissionService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly searchChanges = new Subject<string>();

  private listRequest?: Subscription;
  private detailRequest?: Subscription;

  readonly BildirimTipi = BildirimTipi;
  readonly pageSizeOptions = [10, 20, 50];
  readonly breadcrumb = [
    { label: 'Ana Kontrol Paneli', link: '/dashboard' },
    { label: 'Bildirim Merkezi' },
  ];

  readonly bildirimler = signal<BildirimDto[]>([]);
  readonly loading = signal(false);
  readonly loadError = signal('');
  readonly toplamKayit = signal(0);
  readonly toplamOkunmamis = signal(0);
  readonly sayfa = signal(1);
  readonly sayfaBoyutu = signal(20);
  readonly toplamSayfa = signal(1);

  readonly durum = signal<BildirimDurumu>('tumu');
  readonly tipId = signal<BildirimTipi | null>(null);
  readonly tarihFiltresi = signal<TarihFiltresi>('tumu');
  readonly baslangicTarihi = signal('');
  readonly bitisTarihi = signal('');
  readonly arama = signal('');

  readonly seciliBildirim = signal<BildirimDto | null>(null);
  readonly seciliBildirimId = signal<number | null>(null);
  readonly detailLoading = signal(false);
  readonly detailError = signal('');
  readonly markingAllRead = signal(false);

  readonly paginationStart = computed(() =>
    this.toplamKayit() === 0 ? 0 : (this.sayfa() - 1) * this.sayfaBoyutu() + 1
  );
  readonly paginationEnd = computed(() =>
    Math.min(this.sayfa() * this.sayfaBoyutu(), this.toplamKayit())
  );
  readonly pageNumbers = computed(() => {
    const total = Math.max(this.toplamSayfa(), 1);
    const current = Math.min(Math.max(this.sayfa(), 1), total);
    const start = Math.max(1, Math.min(current - 2, total - 4));
    const end = Math.min(total, start + 4);
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  });
  readonly filtreAktif = computed(() =>
    this.durum() !== 'tumu' ||
    this.tipId() !== null ||
    this.tarihFiltresi() !== 'tumu' ||
    this.arama().trim().length > 0
  );
  readonly guvenliHedefUrl = computed(() => this.resolveSafeTarget(this.seciliBildirim()?.hedefUrl));

  ngOnInit(): void {
    this.restoreFiltersFromUrl();

    this.searchChanges
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.sayfa.set(1);
        this.loadBildirimler();
      });

    this.bildirimService.bildirimGuncellendi$
      .pipe(debounceTime(150), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadBildirimler(false));

    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        const rawId = params.get('id');
        if (!rawId) {
          this.seciliBildirimId.set(null);
          this.seciliBildirim.set(null);
          this.detailError.set('');
          return;
        }

        const id = Number(rawId);
        if (!Number.isInteger(id) || id <= 0) {
          this.seciliBildirimId.set(null);
          this.seciliBildirim.set(null);
          this.detailError.set('Geçersiz bildirim numarası.');
          return;
        }

        this.loadBildirimDetayi(id);
      });

    this.loadBildirimler(false);
  }

  ngOnDestroy(): void {
    this.listRequest?.unsubscribe();
    this.detailRequest?.unsubscribe();
  }

  setDurum(value: BildirimDurumu): void {
    if (this.durum() === value) return;
    this.durum.set(value);
    this.sayfa.set(1);
    this.loadBildirimler();
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.arama.set(value);
    this.searchChanges.next(value.trim());
  }

  clearSearch(): void {
    if (!this.arama()) return;
    this.arama.set('');
    this.searchChanges.next('');
  }

  onTipChange(event: Event): void {
    const value = Number((event.target as HTMLSelectElement).value);
    this.tipId.set(value === BildirimTipi.CekiYuklendi || value === BildirimTipi.CekiRevizyonuYuklendi
      ? value
      : null);
    this.sayfa.set(1);
    this.loadBildirimler();
  }

  onTarihFiltresiChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as TarihFiltresi;
    this.tarihFiltresi.set(value);
    this.applyDatePreset(value);
    this.sayfa.set(1);
    this.loadBildirimler();
  }

  onBaslangicTarihiChange(event: Event): void {
    this.baslangicTarihi.set((event.target as HTMLInputElement).value);
  }

  onBitisTarihiChange(event: Event): void {
    this.bitisTarihi.set((event.target as HTMLInputElement).value);
  }

  applyCustomDateRange(): void {
    if (!this.isDateRangeValid()) return;
    this.sayfa.set(1);
    this.loadBildirimler();
  }

  resetFilters(): void {
    this.durum.set('tumu');
    this.tipId.set(null);
    this.tarihFiltresi.set('tumu');
    this.baslangicTarihi.set('');
    this.bitisTarihi.set('');
    this.arama.set('');
    this.sayfa.set(1);
    this.loadBildirimler();
  }

  onPageSizeChange(event: Event): void {
    const value = Number((event.target as HTMLSelectElement).value);
    if (!this.pageSizeOptions.includes(value)) return;
    this.sayfaBoyutu.set(value);
    this.sayfa.set(1);
    this.loadBildirimler();
  }

  goToPage(page: number): void {
    const safePage = Math.min(Math.max(page, 1), Math.max(this.toplamSayfa(), 1));
    if (safePage === this.sayfa()) return;
    this.sayfa.set(safePage);
    this.loadBildirimler();
  }

  openDetail(bildirim: BildirimDto): void {
    void this.router.navigate(['/bildirimler', bildirim.id], {
      queryParams: this.getRouteQueryParams(),
    });
  }

  closeDetail(): void {
    void this.router.navigate(['/bildirimler'], {
      queryParams: this.getRouteQueryParams(),
    });
  }

  markAllAsRead(): void {
    if (this.markingAllRead() || this.toplamOkunmamis() === 0) return;

    this.markingAllRead.set(true);
    this.bildirimService.markAllAsRead().subscribe(res => {
      this.markingAllRead.set(false);
      if (!res.isSuccess) {
        this.toast.error(res.error || 'Bildirimler okundu olarak işaretlenemedi.');
        return;
      }

      const readAt = new Date().toISOString();
      this.seciliBildirim.update(item => item ? { ...item, okunduMu: true, okunmaTarihi: readAt } : item);
      this.toast.success('Tüm bildirimler okundu olarak işaretlendi.');
      this.loadBildirimler(false);
    });
  }

  goToRelatedRecord(): void {
    const target = this.guvenliHedefUrl();
    if (!target) return;
    void this.router.navigateByUrl(target);
  }

  getBildirimIcon(tipId: BildirimTipi): string {
    return tipId === BildirimTipi.CekiRevizyonuYuklendi
      ? 'ri-file-edit-line'
      : 'ri-file-excel-2-line';
  }

  getBildirimClass(tipId: BildirimTipi): string {
    return tipId === BildirimTipi.CekiRevizyonuYuklendi ? 'revision' : 'upload';
  }

  getBildirimTipiAdi(tipId: BildirimTipi): string {
    return tipId === BildirimTipi.CekiRevizyonuYuklendi
      ? 'Revizyon Çekisi'
      : 'Yeni Çeki';
  }

  loadBildirimler(syncUrl = true): void {
    if (!this.isDateRangeValid(false)) return;

    if (syncUrl) this.syncUrl();
    this.listRequest?.unsubscribe();
    this.loading.set(true);
    this.loadError.set('');

    const filtre: BildirimListeFiltre = {
      durum: this.durum(),
      baslangicTarihi: this.baslangicTarihi() || undefined,
      bitisTarihi: this.bitisTarihi() || undefined,
      tipId: this.tipId() ?? undefined,
      arama: this.arama().trim() || undefined,
      sayfa: this.sayfa(),
      sayfaBoyutu: this.sayfaBoyutu(),
    };

    this.listRequest = this.bildirimService.getBildirimler(filtre).subscribe(res => {
      this.loading.set(false);
      if (!res.isSuccess || !res.value) {
        this.bildirimler.set([]);
        this.loadError.set(res.error || 'Bildirimler yüklenemedi.');
        return;
      }

      const value = res.value;
      const totalPages = Math.max(value.toplamSayfa ?? 0, 1);
      if (value.toplamKayit > 0 && this.sayfa() > totalPages) {
        this.sayfa.set(totalPages);
        this.loadBildirimler();
        return;
      }

      this.bildirimler.set(value.bildirimler ?? []);
      this.toplamKayit.set(value.toplamKayit ?? 0);
      this.toplamOkunmamis.set(value.toplamOkunmamis ?? 0);
      this.sayfa.set(value.sayfa ?? this.sayfa());
      this.sayfaBoyutu.set(value.sayfaBoyutu ?? this.sayfaBoyutu());
      this.toplamSayfa.set(totalPages);
    });
  }

  private loadBildirimDetayi(id: number): void {
    this.detailRequest?.unsubscribe();
    this.seciliBildirimId.set(id);
    this.seciliBildirim.set(null);
    this.detailLoading.set(true);
    this.detailError.set('');

    this.detailRequest = this.bildirimService.getBildirimDetayi(id).subscribe(res => {
      this.detailLoading.set(false);
      if (!res.isSuccess || !res.value) {
        this.detailError.set(res.statusCode === 404
          ? 'Bu bildirim bulunamadı veya size ait değil.'
          : res.error || 'Bildirim detayı yüklenemedi.');
        return;
      }

      const bildirim = res.value;
      this.seciliBildirim.set(bildirim);
      if (!bildirim.okunduMu) this.markDetailAsRead(bildirim.id);
    });
  }

  private markDetailAsRead(id: number): void {
    this.bildirimService.markAsRead(id).subscribe(res => {
      if (!res.isSuccess) return;

      const readAt = new Date().toISOString();
      this.seciliBildirim.update(item =>
        item?.id === id ? { ...item, okunduMu: true, okunmaTarihi: readAt } : item
      );
      this.bildirimler.update(items =>
        items.map(item => item.id === id ? { ...item, okunduMu: true, okunmaTarihi: readAt } : item)
      );
      this.loadBildirimler(false);
    });
  }

  private applyDatePreset(value: TarihFiltresi): void {
    if (value === 'tumu') {
      this.baslangicTarihi.set('');
      this.bitisTarihi.set('');
      return;
    }

    const today = new Date();
    if (value === 'ozel') {
      if (!this.baslangicTarihi()) this.baslangicTarihi.set(this.formatInputDate(today));
      if (!this.bitisTarihi()) this.bitisTarihi.set(this.formatInputDate(today));
      return;
    }

    const start = new Date(today);
    if (value === 'son7Gun') start.setDate(today.getDate() - 6);
    if (value === 'son30Gun') start.setDate(today.getDate() - 29);

    this.baslangicTarihi.set(this.formatInputDate(start));
    this.bitisTarihi.set(this.formatInputDate(today));
  }

  private isDateRangeValid(showMessage = true): boolean {
    const start = this.baslangicTarihi();
    const end = this.bitisTarihi();
    if (!start || !end || start <= end) return true;

    if (showMessage) this.toast.warning('Başlangıç tarihi bitiş tarihinden sonra olamaz.');
    return false;
  }

  private formatInputDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private syncUrl(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: this.getRouteQueryParams(),
      replaceUrl: true,
    });
  }

  private getRouteQueryParams(): Record<string, string | number | null> {
    return {
      durum: this.durum() === 'tumu' ? null : this.durum(),
      tarih: this.tarihFiltresi() === 'tumu' ? null : this.tarihFiltresi(),
      baslangic: this.baslangicTarihi() || null,
      bitis: this.bitisTarihi() || null,
      tipId: this.tipId(),
      arama: this.arama().trim() || null,
      sayfa: this.sayfa() === 1 ? null : this.sayfa(),
      sayfaBoyutu: this.sayfaBoyutu() === 20 ? null : this.sayfaBoyutu(),
    };
  }

  private restoreFiltersFromUrl(): void {
    const params = this.route.snapshot.queryParamMap;
    const durum = params.get('durum');
    if (durum === 'okunmamis' || durum === 'okunmus') this.durum.set(durum);

    const tarih = params.get('tarih');
    if (tarih === 'bugun' || tarih === 'son7Gun' || tarih === 'son30Gun' || tarih === 'ozel') {
      this.tarihFiltresi.set(tarih);
    }

    this.baslangicTarihi.set(params.get('baslangic') ?? '');
    this.bitisTarihi.set(params.get('bitis') ?? '');
    this.arama.set(params.get('arama') ?? '');

    const tipId = Number(params.get('tipId'));
    if (tipId === BildirimTipi.CekiYuklendi || tipId === BildirimTipi.CekiRevizyonuYuklendi) {
      this.tipId.set(tipId);
    }

    const page = Number(params.get('sayfa'));
    if (Number.isInteger(page) && page > 0) this.sayfa.set(page);

    const pageSize = Number(params.get('sayfaBoyutu'));
    if (this.pageSizeOptions.includes(pageSize)) this.sayfaBoyutu.set(pageSize);
  }

  private resolveSafeTarget(rawUrl?: string | null): string | null {
    const value = rawUrl?.trim();
    if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null;

    try {
      const tree = this.router.parseUrl(value);
      const outlets = Object.keys(tree.root.children);
      if (outlets.some(outlet => outlet !== PRIMARY_OUTLET)) return null;

      const segments = tree.root.children[PRIMARY_OUTLET]?.segments.map(segment => segment.path) ?? [];
      if (segments.length === 0) return null;
      const path = `/${segments.join('/')}`;
      const menuKod = this.getTargetMenuKod(path);

      if (path === '/dashboard') return value;
      if (!menuKod || !this.permissions.hasAccess(menuKod)) return null;
      return value;
    } catch {
      return null;
    }
  }

  private getTargetMenuKod(path: string): string | null {
    if (path === '/projeler/sevk-edilen' || path.startsWith('/projeler/sevk-edilen/')) return 'sevk-edilen';
    if (path === '/projeler' || path.startsWith('/projeler/')) return 'aktif-projeler';
    if (path === '/sandik-yonetimi' || path.startsWith('/sandik-yonetimi/')) return 'sandik-yonetimi';
    if (path === '/grid' || path.startsWith('/grid/')) return 'grid-modulu';
    if (path === '/uck-is-listesi' || path.startsWith('/uck-is-listesi/')) return '3k-is-listesi';
    if (path === '/uck' || path.startsWith('/uck/')) return '3k-modulu';
    if (path === '/depo-durumu' || path.startsWith('/depo-durumu/')) return 'depo-durumu';
    if (path === '/onay-merkezi' || path.startsWith('/onay-merkezi/')) return 'islem-onay-merkezi';
    if (path === '/stok' || path.startsWith('/stok/')) return 'stok';
    if (path.startsWith('/saha-yonetimi/grid/')) return 'saha-grid-modulu';
    if (path.startsWith('/saha-yonetimi/uck/')) return 'saha-3k-modulu';
    if (path === '/saha-yonetimi' || path.startsWith('/saha-yonetimi/')) return 'saha-yonetimi';
    if (path === '/yedek-yonetimi' || path.startsWith('/yedek-yonetimi/')) return 'yedek-yonetimi';
    if (path === '/hareket-gecmisi' || path.startsWith('/hareket-gecmisi/')) return 'hareket-gecmisi';
    return null;
  }
}
