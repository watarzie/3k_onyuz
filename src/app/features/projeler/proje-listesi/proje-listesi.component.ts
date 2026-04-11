import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgClass } from '@angular/common';
import { I18nService } from '../../../shared/i18n/i18n.service';
import { ProjeService } from '../../../core/services/proje.service';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { BreadcrumbComponent } from '../../../shared/components/breadcrumb/breadcrumb.component';
import { ProjeDto } from '../../../core/models/api-response.model';

@Component({
  selector: 'app-proje-listesi',
  standalone: true,
  imports: [RouterLink, NgClass, StatusBadgeComponent, BreadcrumbComponent],
  templateUrl: './proje-listesi.component.html',
  styleUrl: './proje-listesi.component.scss',
})
export class ProjeListesiComponent implements OnInit {
  i18n = inject(I18nService);
  private projeService = inject(ProjeService);

  projeler = signal<ProjeDto[]>([]);
  filtered = signal<ProjeDto[]>([]);
  loading = signal(true);

  // Çeki yükleme
  showUploadModal = signal(false);
  selectedFile = signal<File | null>(null);
  uploading = signal(false);
  uploadResult = signal<{ success: boolean; message: string } | null>(null);
  dragOver = signal(false);

  breadcrumb = [
    { label: 'Ana Kontrol Paneli', link: '/dashboard' },
    { label: 'Projeler' },
  ];

  ngOnInit() {
    this.loadProjeler();
  }

  loadProjeler() {
    this.loading.set(true);
    this.projeService.getProjeListesi().subscribe((res) => {
      this.loading.set(false);
      if (res.isSuccess && res.value) {
        this.projeler.set(res.value);
        this.filtered.set(res.value);
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
    if (p.toplamUrunSayisi === 0) return 0;
    return Math.round((p.tamamlananUrunSayisi / p.toplamUrunSayisi) * 100);
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
          this.uploadResult.set({
            success: true,
            message: `Çeki başarıyla yüklendi! ${res.value.satirSayisi} satır, ${res.value.sandikSayisi} sandık oluşturuldu.`,
          });
          this.loadProjeler(); // Listeyi yenile
        } else {
          this.uploadResult.set({ success: false, message: res.error ?? 'Yükleme başarısız.' });
        }
      },
      error: () => {
        this.uploading.set(false);
        this.uploadResult.set({ success: false, message: 'Yükleme sırasında hata oluştu.' });
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
}
