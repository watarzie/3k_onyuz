import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { Component, inject, signal, computed, OnInit, ChangeDetectionStrategy } from '@angular/core';
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

  /**
   * Grid/3K buton gösterimi — Rol Yetki ekranından yönetilir.
   * MenuTanimi'deki "grid-modulu" ve "3k-modulu" kayıtlarına göre kontrol edilir.
   */
  canSeeGrid = computed(() => this.permissions.hasAccess('grid-modulu'));
  canSee3K = computed(() => this.permissions.hasAccess('3k-modulu'));

  projeler = signal<ProjeDto[]>([]);
  filtered = signal<ProjeDto[]>([]);
  loading = signal(true);

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
  guncelSevkTarihi = signal('');
  sevkTarihiSaving = signal(false);

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
  }

  /** Sandık yönetimi moduna giren tüm modlar için ortak kontrol */
  isSandikMode = computed(() => this.isSandikYonetimi() || this.isSahaYonetimi() || this.isYedekYonetimi());

  loadProjeler() {
    this.loading.set(true);

    // Saha/Yedek modüllerinde sadece o tipteki projeleri çek
    let obs;
    if (this.isSahaYonetimi()) {
      obs = this.projeService.getProjeListesiByTip(2); // Saha
    } else if (this.isYedekYonetimi()) {
      obs = this.projeService.getProjeListesiByTip(3); // Yedek
    } else if (this.isSevkEdilen()) {
      obs = this.projeService.getProjeListesi(); // Tüm projeler
    } else {
      obs = this.projeService.getProjeListesiByTip(1); // Sadece Normal projeler
    }

    obs.subscribe((res) => {
      this.loading.set(false);
      if (res.isSuccess && res.value) {
        let data = res.value;

        // Sekmeye göre filtrele (normal projeler için)
        if (this.isSevkEdilen()) {
          data = data.filter(p => p.durumMetni === 'SevkEdildi' || p.durumMetni === 'Sevk Edildi');
        } else if (this.isAktifProjeler() || this.isSandikYonetimi()) {
          data = data.filter(p => p.durumMetni !== 'SevkEdildi' && p.durumMetni !== 'Sevk Edildi');
        }

        this.projeler.set(data);
        this.filtered.set(data);
      }
    });
  }

  onSearch(event: Event) {
    const term = (event.target as HTMLInputElement).value.toLowerCase();
    if (!term) {
      this.filtered.set(this.projeler());
    } else {
      this.filtered.set(
        this.projeler().filter(
          (p) => p.projeNo.toLowerCase().includes(term) || p.musteri?.toLowerCase().includes(term)
        )
      );
    }
  }

  getTamamlanmaYuzdesi(p: ProjeDto): number {
    if (p.sandikSayisi === 0) return 0;
    return Math.round((p.hazirSandikSayisi / p.sandikSayisi) * 100);
  }

  getDurumLabel(durum: string): string {
    const map: Record<string, string> = {
      Hazirlaniyor: 'Hazırlanıyor',
      DevamEdiyor: 'Devam Ediyor',
      Tamamlandi: 'Tamamlandı',
    };
    return map[durum] ?? durum;
  }

  indirSahaProjePdf(projeId: number) {
    this.downloadingPdf.set(projeId);
    this.pdfService.sahaProjePdf(projeId).subscribe({
      next: (blob) => {
        this.downloadingPdf.set(null);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `SahaProje_TopluRapor_${projeId}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
        this.toastService.success('Toplu rapor başarıyla indirildi.');
      },
      error: () => {
        this.downloadingPdf.set(null);
        this.toastService.error('Rapor indirilirken bir hata oluştu.');
      }
    });
  }

  // ===== Çeki Yükleme Modal =====

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
    this.guncelSevkTarihi.set(proje.planlananSevkTarihi ? proje.planlananSevkTarihi.substring(0, 10) : '');
    this.showSevkTarihiModal.set(true);
  }

  closeSevkTarihiModal() {
    this.showSevkTarihiModal.set(false);
    this.selectedProjeId.set(0);
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
    if (!form.projeNo.trim() || !form.musteri.trim() || !form.lokasyon.trim()) {
      this.toastService.error('Proje No, Müşteri ve Lokasyon alanları zorunludur.');
      return;
    }

    this.creatingProje.set(true);
    const tipId = this.isSahaYonetimi() ? 2 : 3;

    this.projeService.projeOlustur({
      projeNo: form.projeNo,
      musteri: form.musteri,
      projeTipiId: tipId,
      sorumluKisi: '',
      lokasyon: form.lokasyon
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

  async sevkEt(proje: ProjeDto) {
    const onay = await this.confirmService.ask({
      title: 'Projeyi Sevk Et / Kilitle',
      message: `<strong>${proje.projeNo}</strong> numaralı projeyi sevk etmek istediğinize emin misiniz?<br><br>
                <div class="alert alert-warning py-2 mb-0">
                  <i class="ri-alert-line me-1"></i> Bu işlem projeyi kilitler. Proje üzerinde hiçbir modülde değişiklik yapılamaz.
                </div>`,
      confirmText: 'Evet, Sevk Et',
      cancelText: 'Vazgeç',
      type: 'warning'
    });

    if (onay) {
      this.projeService.sevkEt(proje.id).subscribe({
        next: (res) => {
          if (res.isSuccess) {
            this.toastService.success('Proje başarıyla sevk edildi ve kilitlendi.');
            this.loadProjeler();
          } else {
            this.toastService.error(res.error || 'İşlem başarısız.');
          }
        },
        error: () => this.toastService.error('Sunucu hatası oluştu.')
      });
    }
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
}
