import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HareketGecmisiService } from '../../core/services/hareket-gecmisi.service';
import { ProjeService } from '../../core/services/proje.service';
import { HareketGecmisiDto, ProjeDto } from '../../shared/models/index';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmService } from '../../core/services/confirm.service';

@Component({
  selector: 'app-hareket-gecmisi',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './hareket-gecmisi.component.html',
  styleUrls: ['./hareket-gecmisi.component.scss']
})
export class HareketGecmisiComponent implements OnInit {
  private hareketService = inject(HareketGecmisiService);
  private projeService = inject(ProjeService);
  private toast = inject(ToastService);
  private confirmService = inject(ConfirmService);

  projeler = signal<ProjeDto[]>([]);
  selectedProjeId = signal<number | null>(null);

  hareketler = signal<HareketGecmisiDto[]>([]);
  loading = signal(false);
  searchTerm = signal('');
  selectedIslemTipi = signal('');
  
  // Pagination
  currentPage = signal(1);
  pageSize = signal(15);

  islemTipleri = computed(() => {
    const tipler = this.hareketler().map(h => h.islemTipiMetni || h.islem);
    return [...new Set(tipler)].sort();
  });

  filteredHareketler = computed(() => {
    let result = this.hareketler();
    
    const tip = this.selectedIslemTipi();
    if (tip) {
      result = result.filter(h => (h.islemTipiMetni || h.islem) === tip);
    }

    const term = this.searchTerm().toLowerCase();
    if (term) {
      result = result.filter(h => 
        h.islem.toLowerCase().includes(term) ||
        h.islemTipiMetni.toLowerCase().includes(term) ||
        (h.referansId && h.referansId.toLowerCase().includes(term)) ||
        (h.kullaniciAdi && h.kullaniciAdi.toLowerCase().includes(term)) ||
        (h.aciklama && h.aciklama.toLowerCase().includes(term)) ||
        (h.eskiDeger && h.eskiDeger.toLowerCase().includes(term)) ||
        (h.yeniDeger && h.yeniDeger.toLowerCase().includes(term))
      );
    }
    return result;
  });

  paginatedHareketler = computed(() => {
    const list = this.filteredHareketler();
    const startIndex = (this.currentPage() - 1) * this.pageSize();
    return list.slice(startIndex, startIndex + this.pageSize());
  });
  
  totalPages = computed(() => Math.ceil(this.filteredHareketler().length / this.pageSize()) || 1);

  changePage(page: number) {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  mathMin(a: number, b: number): number {
    return Math.min(a, b);
  }

  ngOnInit() {
    this.loadProjeler();
  }

  loadProjeler() {
    this.projeService.getProjeListesi().subscribe(res => {
      if (res.isSuccess && res.value) {
        this.projeler.set(res.value);
        if (this.projeler().length > 0) {
          this.selectedProjeId.set(this.projeler()[0].id);
          this.loadHareketler();
        }
      }
    });
  }

  onProjeChange() {
    this.loadHareketler();
  }

  loadHareketler() {
    const pId = this.selectedProjeId();
    if (!pId) return;

    this.loading.set(true);
    this.hareketService.getByProje(pId).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.isSuccess && res.value) {
          this.hareketler.set(res.value);
        } else {
          this.toast.error(res.error || 'Geçmiş yüklenemedi.');
          this.hareketler.set([]);
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error('Bağlantı hatası.');
        this.hareketler.set([]);
      }
    });
  }

  // Renkli badge'ler için yardımcı metot
  getBadgeClass(islemTipiMetni: string): string {
    const text = islemTipiMetni.toLowerCase();
    if (text.includes('oluşturuldu') || text.includes('yüklendi')) return 'bg-primary-transparent text-primary';
    if (text.includes('iptal')) return 'bg-danger-transparent text-danger';
    if (text.includes('güncellendi') || text.includes('değiştirildi')) return 'bg-info-transparent text-info';
    if (text.includes('kapatıldı') || text.includes('hazırlandı')) return 'bg-success-transparent text-success';
    if (text.includes('taşındı') || text.includes('eklendi')) return 'bg-warning-transparent text-warning';
    if (text.includes('karşılandı')) return 'bg-success-transparent text-success';
    return 'bg-secondary-transparent text-secondary';
  }

  showFullText(title: string, text: string) {
    this.confirmService.ask({
      title: title,
      message: `<div class="text-start text-dark" style="max-height: 400px; overflow-y: auto; white-space: pre-wrap; word-break: break-word;">${text}</div>`,
      confirmText: 'Kapat',
      cancelText: '', // Hide cancel button
      type: 'info'
    });
  }
}
