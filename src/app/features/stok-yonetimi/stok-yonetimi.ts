import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../core/services/toast.service';
import { StokService } from '../../core/services/stok.service';
import { PdfService } from '../../core/services/pdf.service';
import { StokKaydiDto, StokKaydiOlusturDto, ProjeDropdownDto } from '../../shared/models/index';
import { BreadcrumbComponent } from '../../shared/components/breadcrumb/breadcrumb.component';
import { ProjeService } from '../../core/services/proje.service';

@Component({
  selector: 'app-stok-yonetimi',
  standalone: true,
  imports: [CommonModule, FormsModule, BreadcrumbComponent],
  templateUrl: './stok-yonetimi.html',
  styleUrls: ['./stok-yonetimi.scss']
})
export class StokYonetimi implements OnInit {
  private stokService = inject(StokService);
  private toastService = inject(ToastService);
  private pdfService = inject(PdfService);
  private projeService = inject(ProjeService);

  // Veriler
  projeler = signal<ProjeDropdownDto[]>([]);
  stoklar = signal<StokKaydiDto[]>([]);
  filteredStoklar = signal<StokKaydiDto[]>([]);
  loading = signal<boolean>(false);
  downloadingPdf = signal<boolean>(false);
  searchTerm = signal<string>('');

  // Pagination State
  currentPage = signal<number>(1);
  pageSize = signal<number>(15);
  totalCount = signal<number>(0);
  totalPages = signal<number>(0);

  // Modal State
  isAddModalOpen = signal<boolean>(false);
  isEditMode = signal<boolean>(false);
  editId = signal<number | null>(null);
  
  // Form State
  yeniStok: any = {
    malzemeKodu: '',
    malzemeAdi: '',
    miktar: 1,
    birimId: 1,
    kaynakProje: '',
    lokasyon: ''
  };

  breadcrumb = [
    { label: 'Ana Menu', link: '/dashboard' },
    { label: 'Stok Modülü' },
  ];

  ngOnInit(): void {
    this.loadStoklar();
    this.loadProjeler();
  }

  loadProjeler() {
    this.projeService.getProjeDropdownListesi().subscribe({
      next: (res) => {
        if (res.isSuccess && res.value) {
          this.projeler.set(res.value);
        }
      }
    });
  }

  loadStoklar() {
    this.loading.set(true);
    this.stokService.getStokListesi(this.searchTerm(), this.currentPage(), this.pageSize()).subscribe({
      next: (res: any) => {
        if (res.isSuccess && res.value) {
          // Pagination data binding
          const paginated = res.value;
          this.stoklar.set(paginated.items);
          this.filteredStoklar.set(paginated.items); // Backend already filters
          this.totalCount.set(paginated.totalCount);
          this.totalPages.set(paginated.totalPages);
        } else {
          this.toastService.error('Stok listesi alınırken hata oluştu');
        }
        this.loading.set(false);
      },
      error: () => {
        this.toastService.error('Stok listesi alınamadı (Sunucu Hatası)');
        this.loading.set(false);
      }
    });
  }

  onSearchChange() {
    this.currentPage.set(1);
    this.loadStoklar();
  }

  onPageChange(page: number) {
    if (page >= 1 && page <= this.totalPages()) {
        this.currentPage.set(page);
        this.loadStoklar();
    }
  }

  onPageSizeChange(event: Event) {
    const newSize = parseInt((event.target as HTMLSelectElement).value, 10);
    this.pageSize.set(newSize);
    this.currentPage.set(1);
    this.loadStoklar();
  }

  openAddModal() {
    this.isEditMode.set(false);
    this.editId.set(null);
    this.yeniStok = {
      malzemeKodu: '',
      malzemeAdi: '',
      miktar: 1,
      birimId: 1,
      kaynakProje: '',
      lokasyon: '',
      stokGirisNedeni: ''
    };
    this.isAddModalOpen.set(true);
  }

  openEditModal(stok: StokKaydiDto) {
    this.isEditMode.set(true);
    this.editId.set(stok.id);
    this.yeniStok = {
      id: stok.id,
      malzemeKodu: stok.malzemeKodu,
      malzemeAdi: stok.malzemeAdi,
      miktar: stok.miktar,
      birimId: stok.birimId || 1,
      kaynakProje: stok.kaynakProje,
      lokasyon: stok.lokasyon,
      stokGirisNedeni: stok.stokGirisNedeni
    };
    this.isAddModalOpen.set(true);
  }

  closeAddModal() {
    this.isAddModalOpen.set(false);
  }

  saveStock() {
    const payload = { ...this.yeniStok };

    // Bütün string girdileri baştan ve sondan trimliyoruz!
    if (typeof payload.malzemeAdi === 'string') payload.malzemeAdi = payload.malzemeAdi.trim();
    if (typeof payload.malzemeKodu === 'string') payload.malzemeKodu = payload.malzemeKodu.trim();
    if (typeof payload.kaynakProje === 'string') payload.kaynakProje = payload.kaynakProje.trim();
    if (typeof payload.lokasyon === 'string') payload.lokasyon = payload.lokasyon.trim();
    if (typeof payload.stokGirisNedeni === 'string') payload.stokGirisNedeni = payload.stokGirisNedeni.trim();

    if (!payload.malzemeAdi || payload.malzemeAdi === '') {
      this.toastService.error('Malzeme Adı zorunludur.');
      return;
    }
    if (!payload.stokGirisNedeni || payload.stokGirisNedeni === '') {
      this.toastService.error('Stok giriş nedeni zorunludur.');
      return;
    }
    // kaynakProje artık opsiyonel — zorunluluk kaldırıldı
    if (payload.miktar < 0) {
      this.toastService.error('Miktar negatif olamaz.');
      return;
    }

    if (this.isEditMode()) {
       payload.depoLokasyonMetni = payload.lokasyon; 
       this.stokService.stokGuncelle(this.editId()!, payload).subscribe({
          next: (res) => {
            if (res.isSuccess) {
              this.toastService.success('Stok başarıyla güncellendi.');
              this.closeAddModal();
              this.loadStoklar();
              this.stokService.notifyStokUpdated();
            } else {
              this.toastService.error(res.error || 'Stok güncellenemedi.');
            }
          },
          error: () => this.toastService.error('Stok güncellenirken bir ağ hatası oluştu.')
       });
    } else {
       // Insert
       this.stokService.stokOlustur(payload).subscribe({
         next: (res) => {
           if (res.isSuccess) {
             this.toastService.success('Stok başarıyla eklendi.');
             this.closeAddModal();
             this.loadStoklar();
             this.stokService.notifyStokUpdated();
           } else {
             this.toastService.error(res.error || 'Stok eklenemedi.');
           }
         },
         error: () => this.toastService.error('Stok eklenirken bir ağ hatası oluştu.')
       });
    }
  }

  // ===== Stok PDF Raporu =====
  indirStokPdf() {
    this.downloadingPdf.set(true);
    this.pdfService.stokPdf().subscribe({
      next: (blob) => {
        this.downloadingPdf.set(false);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const tarih = new Date().toISOString().split('T')[0].replace(/-/g, '');
        a.download = `StokRaporu_${tarih}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
        this.toastService.success('Stok raporu indirildi.');
      },
      error: () => {
        this.downloadingPdf.set(false);
        this.toastService.error('Stok raporu indirilirken bir hata oluştu.');
      }
    });
  }
}
