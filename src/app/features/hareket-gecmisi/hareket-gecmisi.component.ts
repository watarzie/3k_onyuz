import { Component, HostListener, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { HareketGecmisiService } from '../../core/services/hareket-gecmisi.service';
import { ProjeService } from '../../core/services/proje.service';
import { LookupService } from '../../core/services/lookup.service';
import { HareketGecmisiDto, ProjeDropdownDto, LookupItem } from '../../shared/models/index';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmService, duzMetin } from '../../core/services/confirm.service';
import { BreadcrumbComponent } from '../../shared/components/breadcrumb/breadcrumb.component';
import { ServerPagerComponent } from '../../shared/components/server-pager/server-pager.component';

@Component({
  selector: 'app-hareket-gecmisi',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, BreadcrumbComponent, ServerPagerComponent],
  templateUrl: './hareket-gecmisi.component.html',
  styleUrls: ['./hareket-gecmisi.component.scss']
})
export class HareketGecmisiComponent implements OnInit {
  private hareketService = inject(HareketGecmisiService);
  private projeService = inject(ProjeService);
  private toast = inject(ToastService);
  private confirmService = inject(ConfirmService);
  private lookupService = inject(LookupService);

  breadcrumb = [
    { label: 'Ana Kontrol Paneli', link: '/dashboard' },
    { label: 'Hareket Geçmişi' }
  ];

  projeler = signal<ProjeDropdownDto[]>([]);
  selectedProjeId = signal<number | null>(null);
  projeSearchTerm = signal('');
  projeDropdownOpen = signal(false);

  // Data
  hareketler = signal<HareketGecmisiDto[]>([]);
  loading = signal(false);

  // Filters
  searchTerm = signal('');
  selectedIslemTipiId = signal<number | null>(null);
  islemTipleri = signal<LookupItem[]>([]);

  // Pagination (server-side)
  currentPage = signal(1);
  pageSize = signal(15);
  pageSizeOptions = [15, 25, 50];
  totalCount = signal(0);
  totalPages = signal(0);

  // Search debounce
  private searchSubject = new Subject<string>();

  filteredProjeler = computed(() => {
    const term = this.projeSearchTerm().trim().toLocaleLowerCase('tr-TR');
    const selectedId = this.selectedProjeId();
    return this.projeler().filter(p => {
      if (p.id === selectedId) return true;
      if (!term) return true;
      return [
        p.projeNo,
        p.musteri,
        p.lokasyon,
      ].some(value => (value ?? '').toLocaleLowerCase('tr-TR').includes(term));
    });
  });

  ngOnInit() {
    this.loadProjeler();
    this.loadIslemTipleri();

    // Debounce search input — wait 400ms after user stops typing
    this.searchSubject.pipe(
      debounceTime(400),
      distinctUntilChanged()
    ).subscribe(term => {
      this.searchTerm.set(term);
      this.currentPage.set(1);
      this.loadHareketler();
    });
  }

  @HostListener('document:click')
  closeProjectDropdownFromOutside(): void {
    this.closeProjeDropdown();
  }

  loadIslemTipleri() {
    this.lookupService.getLookups(['LookupIslemTipi']).subscribe(res => {
      const items = res['LookupIslemTipi'] ?? [];
      this.islemTipleri.set(items);
    });
  }

  loadProjeler() {
    this.projeService.getProjeDropdownListesi().subscribe({
      next: (res) => {
        if (!res.isSuccess || !res.value) {
          this.toast.error(res.error || 'Projeler yüklenemedi.');
          return;
        }

        const projeler = [...res.value].sort((a, b) => b.id - a.id);
        this.projeler.set(projeler);

        if (projeler.length > 0) {
          this.selectedProjeId.set(projeler[0].id);
          this.loadHareketler();
        }
      },
      error: () => {
        this.toast.error('Projeler yüklenirken bağlantı hatası oluştu.');
      }
    });
  }

  onProjeChange() {
    this.currentPage.set(1);
    this.loadHareketler();
  }

  toggleProjeDropdown(): void {
    this.projeDropdownOpen.update(open => !open);
  }

  closeProjeDropdown(): void {
    this.projeDropdownOpen.set(false);
  }

  selectProje(projeId: number): void {
    const currentId = this.selectedProjeId();
    this.selectedProjeId.set(projeId);
    this.projeSearchTerm.set('');
    this.closeProjeDropdown();

    if (currentId !== projeId) {
      this.onProjeChange();
    }
  }

  selectedProjeLabel(): string {
    const selectedId = this.selectedProjeId();
    const proje = this.projeler().find(p => p.id === selectedId);
    return proje ? `${proje.projeNo} - ${proje.musteri || '-'}` : 'Proje seçin';
  }

  onSearchInput(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.searchSubject.next(value);
  }

  onIslemTipiChange(value: any) {
    this.selectedIslemTipiId.set(value ? +value : null);
    this.currentPage.set(1);
    this.loadHareketler();
  }

  /** Süren liste isteği: yeni istek (sayfa, sayfa başı, arama) eskisini iptal eder; geç dönen eski yanıt yeni listeyi ezmez. */
  private listeIstegi?: Subscription;

  loadHareketler() {
    const pId = this.selectedProjeId();
    if (!pId) return;

    this.loading.set(true);
    this.listeIstegi?.unsubscribe();
    this.listeIstegi = this.hareketService.getByProje(
      pId,
      this.currentPage(),
      this.pageSize(),
      this.searchTerm() || undefined,
      this.selectedIslemTipiId() ?? undefined
    ).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.isSuccess && res.value) {
          const paginated = res.value;
          this.hareketler.set(paginated.items);
          this.totalCount.set(paginated.totalCount);
          this.totalPages.set(paginated.totalPages);
        } else {
          this.toast.error(res.error || 'Geçmiş yüklenemedi.');
          this.hareketler.set([]);
        }
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Bağlantı hatası.');
        this.hareketler.set([]);
      }
    });
  }

  changePage(page: number) {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
      this.loadHareketler();
    }
  }

  onPageSizeChange(size: number) {
    if (this.pageSizeOptions.includes(size)) {
      this.pageSize.set(size);
      this.currentPage.set(1);
      this.loadHareketler();
    }
  }

  /** İşlem hapının tonu: oluşturma mor, iptal kırmızı, güncelleme mavi, kapanış yeşil, taşıma turuncu. */
  getBadgeClass(islemTipiMetni: string): string {
    const text = (islemTipiMetni ?? '').toLocaleLowerCase('tr-TR');
    if (text.includes('oluşturuldu') || text.includes('yüklendi')) return 'primary';
    if (text.includes('iptal') || text.includes('silindi')) return 'danger';
    if (text.includes('güncellendi') || text.includes('değiştirildi')) return 'info';
    if (text.includes('kapatıldı') || text.includes('hazırlandı') || text.includes('karşılandı')) return 'success';
    if (text.includes('taşındı') || text.includes('eklendi')) return 'warning';
    return 'neutral';
  }

  showFullText(title: string, text: string) {
    this.confirmService.ask({
      title: title,
      message: `<div class="text-start text-dark" style="max-height: 400px; overflow-y: auto; white-space: pre-wrap; word-break: break-word;">${duzMetin(text)}</div>`,
      confirmText: 'Kapat',
      cancelText: '',
      type: 'info'
    });
  }
}
