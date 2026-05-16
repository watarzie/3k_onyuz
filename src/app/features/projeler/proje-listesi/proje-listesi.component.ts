import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { Component, inject, signal, computed, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { NgClass, DatePipe } from '@angular/common';
import { TranslationService } from '../../../core/services/translation.service';
import { ProjeService } from '../../../core/services/proje.service';
import { PermissionService } from '../../../core/services/permission.service';
import { AuthService } from '../../../core/auth/auth.service';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { BreadcrumbComponent } from '../../../shared/components/breadcrumb/breadcrumb.component';
import { ManuelCekiOlusturDto, ManuelCekiSandikDto, ManuelCekiSatiriDto, ProjeDto } from '../../../shared/models/index';
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
  private authService = inject(AuthService);

  isSandikYonetimi = signal(false);
  isSevkEdilen = signal(false);
  isAktifProjeler = signal(false);
  isSahaYonetimi = signal(false);
  isYedekYonetimi = signal(false);

  downloadingPdf = signal<number | null>(null);
  downloadingEksikPdf = signal<number | null>(null);
  downloadingGerceklesenPdf = signal<number | null>(null);

  /**
   * Grid/3K buton gösterimi — Rol Yetki ekranından yönetilir.
   * MenuTanimi'deki "grid-modulu" ve "3k-modulu" kayıtlarına göre kontrol edilir.
   */
  canSeeGrid = computed(() => this.permissions.hasAccess('grid-modulu'));
  canSee3K = computed(() => this.permissions.hasAccess('3k-modulu'));
  isAdmin = computed(() => this.authService.hasRole('Admin'));

  projeler = signal<ProjeDto[]>([]);
  filtered = signal<ProjeDto[]>([]);
  loading = signal(true);

  // Çeki yükleme
  showUploadModal = signal(false);
  selectedFile = signal<File | null>(null);
  uploading = signal(false);
  uploadResult = signal<{ success: boolean; message: string } | null>(null);
  dragOver = signal(false);

  // Manuel çeki oluşturma
  showManuelCekiModal = signal(false);
  creatingManuelCeki = signal(false);
  manuelCekiForm = signal<ManuelCekiOlusturDto>(this.createEmptyManuelCekiForm());
  birimSecenekleri = [
    { id: 1, label: 'Adet' },
    { id: 2, label: 'Set' },
    { id: 3, label: 'Metre' },
    { id: 4, label: 'Kg' },
    { id: 5, label: 'Litre' },
    { id: 6, label: 'Takım' },
    { id: 7, label: 'Paket' },
    { id: 8, label: 'Ton' },
    { id: 9, label: 'm²' },
    { id: 10, label: 'm³' },
  ];

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

  // ===== Çeki Yükleme Modal =====

  indirGerceklesenCekiListesiPdf(proje: ProjeDto) {
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

  // ===== Manuel Çeki Oluştur =====

  private createEmptyManuelCekiForm(): ManuelCekiOlusturDto {
    return {
      projeNo: '',
      fbNo: '',
      musteri: '',
      lokasyon: '',
      guc: '',
      gerilim: '',
      projeMuduru: '',
      sorumluKisi: '',
      olcuResmiNo: '',
      nakilOlcuResmiNo: '',
      sonMontajResmiNo: '',
      planlananSevkTarihi: null,
      projeTipiId: 1,
      sandiklar: [this.createEmptyManuelSandik()],
      satirlar: [this.createEmptyManuelSatir(1, '')],
    };
  }

  private createEmptyManuelSandik(): ManuelCekiSandikDto {
    return {
      sandikNo: '',
      ad: '',
      en: null,
      boy: null,
      yukseklik: null,
      netKg: null,
      grossKg: null,
    };
  }

  private createEmptyManuelSatir(siraNo: number, sandikNo: string): ManuelCekiSatiriDto {
    return {
      siraNo,
      barkodNo: '',
      aciklama: '',
      sandikNo,
      istenenAdet: 1,
      birimId: 1,
      birim: 'Adet',
      remarks: '',
    };
  }

  openManuelCekiModal() {
    this.manuelCekiForm.set(this.createEmptyManuelCekiForm());
    this.showManuelCekiModal.set(true);
  }

  closeManuelCekiModal() {
    if (this.creatingManuelCeki()) return;
    this.showManuelCekiModal.set(false);
  }

  addManuelSandik() {
    this.manuelCekiForm.update(form => ({
      ...form,
      sandiklar: [...form.sandiklar, this.createEmptyManuelSandik()],
    }));
  }

  removeManuelSandik(index: number) {
    const form = this.manuelCekiForm();
    if (form.sandiklar.length <= 1) {
      this.toastService.error('En az bir sandık kalmalıdır.');
      return;
    }

    const silinecekNo = form.sandiklar[index]?.sandikNo?.trim();
    if (silinecekNo && form.satirlar.some(s => s.sandikNo === silinecekNo)) {
      this.toastService.error('Bu sandığa bağlı ürün var. Önce ürün satırındaki sandığı değiştirin.');
      return;
    }

    this.manuelCekiForm.update(current => ({
      ...current,
      sandiklar: current.sandiklar.filter((_, i) => i !== index),
    }));
  }

  addManuelSatir() {
    const form = this.manuelCekiForm();
    const ilkSandikNo = form.sandiklar.find(s => s.sandikNo?.trim())?.sandikNo?.trim() ?? '';
    this.manuelCekiForm.update(current => ({
      ...current,
      satirlar: [...current.satirlar, this.createEmptyManuelSatir(current.satirlar.length + 1, ilkSandikNo)],
    }));
  }

  removeManuelSatir(index: number) {
    const form = this.manuelCekiForm();
    if (form.satirlar.length <= 1) {
      this.toastService.error('En az bir ürün satırı kalmalıdır.');
      return;
    }

    this.manuelCekiForm.update(current => ({
      ...current,
      satirlar: current.satirlar
        .filter((_, i) => i !== index)
        .map((satir, i) => ({ ...satir, siraNo: i + 1 })),
    }));
  }

  onManuelSatirBirimChange(satir: ManuelCekiSatiriDto, birimId: number | string) {
    const id = Number(birimId);
    satir.birimId = id;
    satir.birim = this.birimSecenekleri.find(b => b.id === id)?.label ?? 'Adet';
  }

  submitManuelCeki() {
    const form = this.manuelCekiForm();
    const projeNo = form.projeNo.trim();
    if (!projeNo) {
      this.toastService.error('Proje No zorunludur.');
      return;
    }

    const sandiklar = form.sandiklar
      .map(s => ({
        ...s,
        sandikNo: s.sandikNo?.trim() ?? '',
        ad: s.ad?.trim() || undefined,
        en: this.toNullableNumber(s.en),
        boy: this.toNullableNumber(s.boy),
        yukseklik: this.toNullableNumber(s.yukseklik),
        netKg: this.toNullableNumber(s.netKg),
        grossKg: this.toNullableNumber(s.grossKg),
      }))
      .filter(s => !!s.sandikNo);

    if (sandiklar.length === 0) {
      this.toastService.error('En az bir sandık girilmelidir.');
      return;
    }

    const sandikNoSet = new Set(sandiklar.map(s => s.sandikNo));
    if (sandikNoSet.size !== sandiklar.length) {
      this.toastService.error('Aynı sandık numarası birden fazla girilemez.');
      return;
    }

    const satirlar = form.satirlar.map((satir, index) => ({
      ...satir,
      siraNo: satir.siraNo ?? index + 1,
      barkodNo: satir.barkodNo?.trim() || undefined,
      aciklama: satir.aciklama?.trim() ?? '',
      sandikNo: satir.sandikNo?.trim() ?? '',
      istenenAdet: Number(satir.istenenAdet),
      birimId: Number(satir.birimId || 1),
      birim: this.birimSecenekleri.find(b => b.id === Number(satir.birimId || 1))?.label ?? 'Adet',
      remarks: satir.remarks?.trim() || undefined,
    }));

    const hataliSatir = satirlar.find(s => !s.aciklama || !s.sandikNo || !s.istenenAdet || s.istenenAdet <= 0);
    if (hataliSatir) {
      this.toastService.error('Ürün satırlarında açıklama, sandık ve pozitif miktar zorunludur.');
      return;
    }

    const bilinmeyenSandik = satirlar.find(s => !sandikNoSet.has(s.sandikNo));
    if (bilinmeyenSandik) {
      this.toastService.error(`"${bilinmeyenSandik.sandikNo}" numaralı sandık, sandık listesinde yok.`);
      return;
    }

    const payload: ManuelCekiOlusturDto = {
      ...form,
      projeNo,
      fbNo: form.fbNo?.trim() || projeNo,
      musteri: form.musteri?.trim() || undefined,
      lokasyon: form.lokasyon?.trim() || undefined,
      guc: form.guc?.trim() || undefined,
      gerilim: form.gerilim?.trim() || undefined,
      projeMuduru: form.projeMuduru?.trim() || undefined,
      sorumluKisi: form.sorumluKisi?.trim() || undefined,
      olcuResmiNo: form.olcuResmiNo?.trim() || undefined,
      nakilOlcuResmiNo: form.nakilOlcuResmiNo?.trim() || undefined,
      sonMontajResmiNo: form.sonMontajResmiNo?.trim() || undefined,
      planlananSevkTarihi: form.planlananSevkTarihi ? new Date(form.planlananSevkTarihi).toISOString() : null,
      projeTipiId: 1,
      sandiklar,
      satirlar,
    };

    this.creatingManuelCeki.set(true);
    this.projeService.cekiManuelOlustur(payload).subscribe({
      next: (res) => {
        this.creatingManuelCeki.set(false);
        if (res.isSuccess && res.value) {
          this.toastService.success(`Manuel çeki oluşturuldu: ${res.value.satirSayisi} satır, ${res.value.sandikSayisi} sandık.`);
          this.showManuelCekiModal.set(false);
          this.loadProjeler();
        } else {
          this.toastService.error(res.error || 'Manuel çeki oluşturulamadı.');
        }
      },
      error: () => {
        this.creatingManuelCeki.set(false);
        this.toastService.error('Sunucu hatası oluştu.');
      }
    });
  }

  private toNullableNumber(value: number | string | null | undefined): number | null {
    if (value === null || value === undefined || value === '') return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
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

  // ===== Proje Sil (Admin) =====

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
