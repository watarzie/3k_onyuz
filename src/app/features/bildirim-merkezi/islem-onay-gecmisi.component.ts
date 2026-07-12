import { DatePipe, NgClass } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, Subject, Subscription } from 'rxjs';
import { BildirimService } from '../../core/services/bildirim.service';
import { OnayService } from '../../core/services/onay.service';
import { PermissionService } from '../../core/services/permission.service';
import { ToastService } from '../../core/services/toast.service';
import {
  OnayCalistirmaDurumu,
  OnayGecmisiDto,
  OnayGecmisiDurumu,
  OnayGecmisiKapsami,
  OnayGecmisiListeFiltre,
} from '../../shared/models';

type TarihFiltresi = 'tumu' | 'bugun' | 'son7Gun' | 'son30Gun' | 'ozel';

@Component({
  selector: 'app-islem-onay-gecmisi',
  standalone: true,
  imports: [DatePipe, NgClass],
  templateUrl: './islem-onay-gecmisi.component.html',
  styleUrl: './islem-onay-gecmisi.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IslemOnayGecmisiComponent implements OnInit, OnDestroy {
  private readonly onayService = inject(OnayService);
  private readonly bildirimService = inject(BildirimService);
  private readonly permissions = inject(PermissionService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly searchChanges = new Subject<string>();

  private listRequest?: Subscription;
  private detailRequest?: Subscription;

  readonly pageSizeOptions = [10, 20, 50];

  readonly kayitlar = signal<OnayGecmisiDto[]>([]);
  readonly loading = signal(false);
  readonly loadError = signal('');
  readonly toplamKayit = signal(0);
  readonly sayfa = signal(1);
  readonly sayfaBoyutu = signal(20);
  readonly toplamSayfa = signal(1);

  readonly kapsam = signal<OnayGecmisiKapsami>('tumu');
  readonly durum = signal<OnayGecmisiDurumu>('tumu');
  readonly calistirmaDurumu = signal<OnayCalistirmaDurumu>('tumu');
  readonly tarihFiltresi = signal<TarihFiltresi>('tumu');
  readonly baslangicTarihi = signal('');
  readonly bitisTarihi = signal('');
  readonly arama = signal('');

  readonly seciliKayit = signal<OnayGecmisiDto | null>(null);
  readonly seciliKayitId = signal<number | null>(null);
  readonly detailLoading = signal(false);
  readonly detailError = signal('');

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
    this.kapsam() !== 'tumu' ||
    this.durum() !== 'tumu' ||
    this.calistirmaDurumu() !== 'tumu' ||
    this.tarihFiltresi() !== 'tumu' ||
    this.arama().trim().length > 0
  );
  readonly canOpenApprovalCenter = computed(() =>
    this.permissions.hasAccess('islem-onay-merkezi') &&
    this.seciliKayit()?.aksiyonAktifMi === true
  );

  ngOnInit(): void {
    this.searchChanges
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.sayfa.set(1);
        this.loadGecmis();
      });

    this.bildirimService.onayGuncellendi$
      .pipe(debounceTime(150), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.loadGecmis(false);
        const selectedId = this.seciliKayitId();
        if (selectedId) this.loadDetay(selectedId);
      });

    this.loadGecmis(false);
  }

  ngOnDestroy(): void {
    this.listRequest?.unsubscribe();
    this.detailRequest?.unsubscribe();
  }

  setKapsam(value: OnayGecmisiKapsami): void {
    if (this.kapsam() === value) return;
    this.kapsam.set(value);
    this.reloadFromFirstPage();
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

  onDurumChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as OnayGecmisiDurumu;
    this.durum.set(
      value === 'bekliyor' || value === 'onaylandi' || value === 'reddedildi' ? value : 'tumu'
    );
    this.reloadFromFirstPage();
  }

  onCalistirmaDurumuChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as OnayCalistirmaDurumu;
    this.calistirmaDurumu.set(
      value === 'bilinmiyor' || value === 'bekliyor' || value === 'calisiyor' || value === 'basarili' ||
      value === 'basarisiz' || value === 'atlandi'
        ? value
        : 'tumu'
    );
    this.reloadFromFirstPage();
  }

  onTarihFiltresiChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as TarihFiltresi;
    this.tarihFiltresi.set(value);
    this.applyDatePreset(value);
    this.reloadFromFirstPage();
  }

  onBaslangicTarihiChange(event: Event): void {
    this.baslangicTarihi.set((event.target as HTMLInputElement).value);
  }

  onBitisTarihiChange(event: Event): void {
    this.bitisTarihi.set((event.target as HTMLInputElement).value);
  }

  applyCustomDateRange(): void {
    if (!this.isDateRangeValid()) return;
    this.reloadFromFirstPage();
  }

  resetFilters(): void {
    this.kapsam.set('tumu');
    this.durum.set('tumu');
    this.calistirmaDurumu.set('tumu');
    this.tarihFiltresi.set('tumu');
    this.baslangicTarihi.set('');
    this.bitisTarihi.set('');
    this.arama.set('');
    this.reloadFromFirstPage();
  }

  onPageSizeChange(event: Event): void {
    const value = Number((event.target as HTMLSelectElement).value);
    if (!this.pageSizeOptions.includes(value)) return;
    this.sayfaBoyutu.set(value);
    this.reloadFromFirstPage();
  }

  goToPage(page: number): void {
    const safePage = Math.min(Math.max(page, 1), Math.max(this.toplamSayfa(), 1));
    if (safePage === this.sayfa()) return;
    this.sayfa.set(safePage);
    this.loadGecmis();
  }

  openDetail(kayit: OnayGecmisiDto): void {
    this.loadDetay(kayit.id);
  }

  closeDetail(): void {
    this.detailRequest?.unsubscribe();
    this.seciliKayitId.set(null);
    this.seciliKayit.set(null);
    this.detailLoading.set(false);
    this.detailError.set('');
  }

  goToApprovalCenter(): void {
    if (!this.canOpenApprovalCenter()) return;
    void this.router.navigate(['/onay-merkezi']);
  }

  getDurumClass(durumId: number): string {
    if (durumId === 2) return 'approved';
    if (durumId === 3) return 'rejected';
    return 'pending';
  }

  getDurumIcon(durumId: number): string {
    if (durumId === 2) return 'ri-checkbox-circle-line';
    if (durumId === 3) return 'ri-close-circle-line';
    return 'ri-time-line';
  }

  getCalistirmaClass(kayit: OnayGecmisiDto): string {
    if (kayit.calistirmaDurumuId === 2) return 'running';
    if (kayit.calistirmaDurumuId === 3) return 'succeeded';
    if (kayit.calistirmaDurumuId === 4) return 'failed';
    if (kayit.calistirmaDurumuId === 5) return 'skipped';
    if (kayit.calistirmaDurumuId === 0) return 'unknown';
    return 'waiting';
  }

  loadGecmis(closeDetail = true): void {
    if (!this.isDateRangeValid(false)) return;
    if (closeDetail) this.closeDetail();

    this.listRequest?.unsubscribe();
    this.loading.set(true);
    this.loadError.set('');

    const filtre: OnayGecmisiListeFiltre = {
      kapsam: this.kapsam(),
      durum: this.durum(),
      calistirmaDurumu: this.calistirmaDurumu(),
      baslangicTarihi: this.baslangicTarihi() || undefined,
      bitisTarihi: this.bitisTarihi() || undefined,
      arama: this.arama().trim() || undefined,
      sayfa: this.sayfa(),
      sayfaBoyutu: this.sayfaBoyutu(),
    };

    this.listRequest = this.onayService.getGecmis(filtre).subscribe(res => {
      this.loading.set(false);
      if (!res.isSuccess || !res.value) {
        this.kayitlar.set([]);
        this.toplamKayit.set(0);
        this.toplamSayfa.set(1);
        this.loadError.set(res.error || 'İşlem onayı geçmişi yüklenemedi.');
        return;
      }

      const value = res.value;
      const totalPages = Math.max(value.toplamSayfa ?? 0, 1);
      if (value.toplamKayit > 0 && this.sayfa() > totalPages) {
        this.sayfa.set(totalPages);
        this.loadGecmis(closeDetail);
        return;
      }

      this.kayitlar.set(value.kayitlar ?? []);
      this.toplamKayit.set(value.toplamKayit ?? 0);
      this.sayfa.set(value.sayfa ?? this.sayfa());
      this.sayfaBoyutu.set(value.sayfaBoyutu ?? this.sayfaBoyutu());
      this.toplamSayfa.set(totalPages);
    });
  }

  private loadDetay(id: number): void {
    this.detailRequest?.unsubscribe();
    this.seciliKayitId.set(id);
    this.seciliKayit.set(null);
    this.detailLoading.set(true);
    this.detailError.set('');

    this.detailRequest = this.onayService.getGecmisDetayi(id).subscribe(res => {
      this.detailLoading.set(false);
      if (!res.isSuccess || !res.value) {
        this.detailError.set(res.statusCode === 404
          ? 'Bu işlem onayı kaydı bulunamadı veya görüntüleme kapsamınızda değil.'
          : res.error || 'İşlem onayı detayı yüklenemedi.');
        return;
      }

      this.seciliKayit.set(res.value);
    });
  }

  private reloadFromFirstPage(): void {
    this.sayfa.set(1);
    this.loadGecmis();
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
}
