import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { Component, inject, signal, computed, OnInit, ChangeDetectionStrategy, HostListener } from '@angular/core';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { NgClass, DatePipe } from '@angular/common';
import { TranslationService } from '../../../core/services/translation.service';
import { ProjeService } from '../../../core/services/proje.service';
import { PermissionService } from '../../../core/services/permission.service';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { BreadcrumbComponent } from '../../../shared/components/breadcrumb/breadcrumb.component';
import { ProjeDto } from '../../../shared/models/index';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { PdfService } from '../../../core/services/pdf.service';

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
  permissions = inject(PermissionService);
  toastService = inject(ToastService);
  confirmService = inject(ConfirmService);
  private route = inject(ActivatedRoute);
  private pdfService = inject(PdfService);

  isSandikYonetimi = signal(false);
  isSevkEdilen = signal(false);
  isAktifProjeler = signal(false);
  isSahaYonetimi = signal(false);
  isYedekYonetimi = signal(false);

  downloadingPdf = signal<number | null>(null);
  downloadingEksikPdf = signal<number | null>(null);
  downloadingEksikExcel = signal<number | null>(null);
  downloadingGerceklesenPdf = signal<number | null>(null);
  downloadingGerceklesenExcel = signal<number | null>(null);
  reportMenuKey = signal<string | null>(null);
  reportMenuPosition = signal<{ top: number; left: number } | null>(null);

  /**
   * Grid/3K buton gösterimi — Rol Yetki ekranından yönetilir.
   * MenuTanimi'deki "grid-modulu" ve "3k-modulu" kayıtlarına göre kontrol edilir.
   */
  canSeeGrid = computed(() => this.permissions.hasAccess('grid-modulu'));
  canSee3K = computed(() => this.permissions.hasAccess('3k-modulu'));
  canWriteCurrentMenu = computed(() => {
    const menuKod = this.route.snapshot.data['menuKod'];
    return typeof menuKod === 'string' && this.permissions.canWrite(menuKod);
  });

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
  selectedFile = signal<File | null>(null);
  uploading = signal(false);
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
  sevkTarihiSaving = signal(false);

  // Sevk Et Modal
  showSevkEtModal = signal(false);
  sevkEtProje = signal<ProjeDto | null>(null);
  sevkEtTarihi = signal('');
  sevkEtSaving = signal(false);

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

  loadProjeler() {
    this.loading.set(true);

    // Mode'a gore parametreleri belirle
    let projeTipiId: number | undefined;
    let isSevkEdilen: boolean | undefined;

    if (this.isSahaYonetimi()) {
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

  getTamamlanmaYuzdesi(p: ProjeDto): number {
    if (p.toplamUrunSayisi === 0) return 0;
    return Math.floor((p.tamamlananUrunSayisi / p.toplamUrunSayisi) * 100);
  }

  getDurumLabel(durum: string): string {
    const map: Record<string, string> = {
      Hazirlaniyor: 'Hazırlanıyor',
      DevamEdiyor: 'Devam Ediyor',
      Tamamlandi: 'Tamamlandı',
    };
    return map[durum] ?? durum;
  }

  @HostListener('document:click')
  closeReportMenu() {
    this.reportMenuKey.set(null);
    this.reportMenuPosition.set(null);
  }

  toggleReportMenu(event: MouseEvent, key: string) {
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
    this.pdfService.sahaProjePdf(proje.id).subscribe({
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
    this.reportMenuKey.set(null);
    this.downloadingEksikPdf.set(proje.id);
    this.pdfService.eksikUrunlerPdf(proje.id).subscribe({
      next: (blob) => {
        this.downloadingEksikPdf.set(null);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${proje.projeNo}_EksikRaporu.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
        this.toastService.success('Eksik ürünler raporu indirildi.');
      },
      error: () => {
        this.downloadingEksikPdf.set(null);
        this.toastService.error('Rapor indirilirken bir hata oluştu.');
      }
    });
  }

  indirEksikUrunlerExcel(proje: ProjeDto) {
    this.reportMenuKey.set(null);
    this.downloadingEksikExcel.set(proje.id);
    this.pdfService.eksikUrunlerExcel(proje.id).subscribe({
      next: (blob) => {
        this.downloadingEksikExcel.set(null);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${proje.projeNo}_EksikRaporu.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
        this.toastService.success('Eksik ürünler Excel raporu indirildi.');
      },
      error: () => {
        this.downloadingEksikExcel.set(null);
        this.toastService.error('Excel raporu indirilirken bir hata oluştu.');
      }
    });
  }

  // ===== Çeki Yükleme Modal =====

  indirGerceklesenCekiListesiPdf(proje: ProjeDto) {
    this.reportMenuKey.set(null);
    this.downloadingGerceklesenPdf.set(proje.id);
    this.pdfService.gerceklesenCekiListesiPdf(proje.id).subscribe({
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
    this.reportMenuKey.set(null);
    this.downloadingGerceklesenExcel.set(proje.id);
    this.pdfService.gerceklesenCekiListesiExcel(proje.id).subscribe({
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

  openUploadModal() {
    this.showUploadModal.set(true);
    this.selectedFile.set(null);
    this.uploadResult.set(null);
  }

  closeUploadModal() {
    this.showUploadModal.set(false);
    this.selectedFile.set(null);
    this.uploadResult.set(null);
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile.set(input.files[0]);
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
        this.uploadResult.set(null);
      } else {
        this.uploadResult.set({ success: false, message: 'Sadece .xlsx veya .xls dosyaları kabul edilir.' });
      }
    }
  }

  uploadCeki() {
    const file = this.selectedFile();
    if (!file) return;

    this.uploading.set(true);
    this.uploadResult.set(null);

    this.projeService.cekiYukle(file).subscribe({
      next: (res) => {
        this.uploading.set(false);
        if (res.isSuccess && res.value) {
          this.toastService.success(`Çeki başarıyla yüklendi! ${res.value.satirSayisi} satır, ${res.value.sandikSayisi} sandık oluşturuldu.`);
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
    this.uploadResult.set(null);
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
    this.guncelSevkTarihi.set(proje.planlananSevkTarihi ? proje.planlananSevkTarihi.substring(0, 10) : '');
    this.showSevkTarihiModal.set(true);
  }

  closeSevkTarihiModal() {
    this.showSevkTarihiModal.set(false);
    this.selectedProjeId.set(0);
    this.sevkTarihiProje.set(null);
    this.guncelSevkTarihi.set('');
  }

  kaydetSevkTarihi() {
    this.sevkTarihiSaving.set(true);
    // string to YYYY-MM-DD
    const tarih = this.guncelSevkTarihi() ? new Date(this.guncelSevkTarihi()).toISOString() : null;
    
    this.projeService.sevkTarihiGuncelle(this.selectedProjeId(), tarih).subscribe({
      next: (res) => {
        this.sevkTarihiSaving.set(false);
        if (res.isSuccess) {
          this.toastService.success('Sevk tarihi güncellendi.');
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
          this.toastService.success('Proje başarıyla oluşturuldu.');
          this.closeProjeOlusturModal();
          this.loadProjeler();
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

  // ===== Proje Sevk (Kilitleme) İşlemleri =====

  canSevkEt = computed(() => this.permissions.hasAccess('proje-sevk-et'));

  openSevkEtModal(proje: ProjeDto) {
    this.sevkEtProje.set(proje);
    this.sevkEtTarihi.set(new Date().toISOString().substring(0, 10));
    this.showSevkEtModal.set(true);
  }

  closeSevkEtModal() {
    this.showSevkEtModal.set(false);
    this.sevkEtProje.set(null);
    this.sevkEtTarihi.set('');
  }

  sevkEtOnayla() {
    const proje = this.sevkEtProje();
    if (!proje) return;
    if (!this.sevkEtTarihi()) {
      this.toastService.error('Sevk tarihi girilmelidir.');
      return;
    }
    this.sevkEtSaving.set(true);
    const tarih = new Date(this.sevkEtTarihi()).toISOString();
    this.projeService.sevkEt(proje.id, tarih).subscribe({
      next: (res) => {
        this.sevkEtSaving.set(false);
        if (res.isSuccess) {
          this.toastService.success('Proje başarıyla sevk edildi ve kilitlendi.');
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

  async kilidiAc(proje: ProjeDto) {
    const onay = await this.confirmService.ask({
      title: 'Proje Kilidini Aç',
      message: `<strong>${proje.projeNo}</strong> numaralı projenin kilidini açmak istediğinize emin misiniz?<br>
                Proje yeniden "Devam" durumuna geçecek ve işlemlere izin verilecektir.`,
      confirmText: 'Evet, Kilidi Aç',
      cancelText: 'Vazgeç',
      type: 'info'
    });

    if (onay) {
      this.projeService.kilidiAc(proje.id).subscribe({
        next: (res) => {
          if (res.isSuccess) {
            this.toastService.success('Proje kilidi başarıyla açıldı.');
            this.loadProjeler();
          } else {
            this.toastService.error(res.error || 'İşlem başarısız.');
          }
        },
        error: () => this.toastService.error('Sunucu hatası oluştu.')
      });
    }
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
      this.projeService.projeSil(proje.id).subscribe({
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

