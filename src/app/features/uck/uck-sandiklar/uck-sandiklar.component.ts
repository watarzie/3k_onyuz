import { Component, inject, signal, computed, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslationService } from '../../../core/services/translation.service';
import { SandikService } from '../../../core/services/sandik.service';
import { ProjeService } from '../../../core/services/proje.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { ToastService } from '../../../core/services/toast.service';
import { PermissionService } from '../../../core/services/permission.service';
import { AuthService } from '../../../core/auth/auth.service';
import { LookupService } from '../../../core/services/lookup.service';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { BreadcrumbComponent } from '../../../shared/components/breadcrumb/breadcrumb.component';
import { StatCardComponent } from '../../../shared/components/stat-card/stat-card.component';
import { SandikDto, LookupResponse } from '../../../shared/models/index';

@Component({
  selector: 'app-uck-sandiklar',
  standalone: true,
  imports: [RouterLink, NgClass, FormsModule, StatusBadgeComponent, BreadcrumbComponent, StatCardComponent],
  templateUrl: './uck-sandiklar.component.html',
  styleUrl: './uck-sandiklar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UcKSandiklarComponent implements OnInit {
  ts = inject(TranslationService);
  private route = inject(ActivatedRoute);
  private sandikService = inject(SandikService);
  private projeService = inject(ProjeService);
  private confirmService = inject(ConfirmService);
  private toast = inject(ToastService);
  private permissionService = inject(PermissionService);
  private auth = inject(AuthService);
  private lookupService = inject(LookupService);

  // Instead of isAdmin, we check sandik-yonetimi write permission
  canWriteSandik = computed(() => this.permissionService.canWrite('sandik-yonetimi') || this.auth.hasRole('Admin'));

  projeId = signal(0);
  sandiklar = signal<SandikDto[]>([]);
  filtered = signal<SandikDto[]>([]);
  loading = signal(true);

  // Bulk Selection
  selectedSandikIds = signal<Set<number>>(new Set());
  
  // Filter & Search
  searchTerm = signal('');
  selectedLokasyonlar = signal<string[]>([]);
  
  // System defined DepoLocations via Lookup
  sistemLokasyonlar = signal<{id: number, deger: string}[]>([]);

  // Locations derived from current crates
  lokasyonlar = computed(() => {
    const locs = this.sandiklar().map(s => s.depoLokasyonMetni ?? 'Belirsiz');
    return Array.from(new Set(locs)).sort();
  });

  // Modal
  showLokasyonModal = signal(false);
  selectedSandikForLoc = signal<SandikDto | null>(null);
  yeniLokasyonId = signal<number>(0);
  isSavingLokasyon = signal(false);

  // Sandık Ekleme Modal
  showSandikEkleModal = signal(false);
  ekSandikNo = signal('');
  ekTipId = signal(1);
  ekLokasyonId = signal(2);
  ekSaving = signal(false);
  sandikTipleri = signal<{id: number, deger: string}[]>([]);

  breadcrumb: { label: string; link?: string }[] = [];

  // Stats
  get hazirCount(): number { return this.sandiklar().filter(s => s.durumMetni === 'Hazır').length; }
  get hazirlaniyorCount(): number { return this.sandiklar().filter(s => s.durumMetni === 'Hazırlanıyor').length; }
  get sevkedildiCount(): number { return this.sandiklar().filter(s => s.durumMetni === 'Sevk Edildi').length; }

  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('projeId'));
    this.projeId.set(id);
    this.breadcrumb = [
      { label: 'Ana Kontrol Paneli', link: '/dashboard' },
      { label: 'Projeler', link: '/projeler' },
      { label: '3K Modülü' },
    ];
    this.loadLookups();
    this.loadSandiklar();
  }

  loadLookups() {
    this.lookupService.getLookups(['LookupDepoLokasyon', 'LookupSandikTipi']).subscribe(data => {
      if (data['LookupDepoLokasyon']) {
        this.sistemLokasyonlar.set(data['LookupDepoLokasyon']);
      }
      if (data['LookupSandikTipi']) {
        this.sandikTipleri.set(data['LookupSandikTipi']);
      }
    });
  }

  loadSandiklar() {
    this.loading.set(true);
    this.sandikService.getSandiklar(this.projeId()).subscribe((res) => {
      this.loading.set(false);
      if (res.isSuccess && res.value) {
        const sorted = [...res.value].sort((a, b) => this.extractNumber(a.sandikNo) - this.extractNumber(b.sandikNo));
        this.sandiklar.set(sorted);
        this.applyFilters();
      }
    });
  }

  /** SandıkNo'dan numerik değer çıkar — "Sandik-3" → 3, "5" → 5 */
  private extractNumber(sandikNo: string): number {
    const match = sandikNo.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  /** Sadece numarayı göster */
  getDisplayNo(sandikNo: string): string {
    const match = sandikNo.match(/(\d+)/);
    return match ? match[1] : sandikNo;
  }

  onSearch(event: Event) {
    this.searchTerm.set((event.target as HTMLInputElement).value.toLowerCase());
    this.applyFilters();
  }

  toggleLokasyon(loc: string) {
    const current = this.selectedLokasyonlar();
    if (current.includes(loc)) {
      this.selectedLokasyonlar.set(current.filter(x => x !== loc));
    } else {
      this.selectedLokasyonlar.set([...current, loc]);
    }
    this.applyFilters();
  }

  applyFilters() {
    let list = this.sandiklar();
    const term = this.searchTerm();
    const locs = this.selectedLokasyonlar();

    if (term) {
      list = list.filter(s =>
        s.sandikNo.toLowerCase().includes(term) ||
        s.durumMetni.toLowerCase().includes(term)
      );
    }
    if (locs.length > 0) {
      list = list.filter(s => locs.includes(s.depoLokasyonMetni ?? 'Belirsiz'));
    }
    this.filtered.set(list);
  }

  // --- Lokasyon Güncelleme ---
  selectedSandikForLocIds = signal<number[]>([]);
  
  openLokasyonModal(event: Event, sandik: SandikDto) {
    event.preventDefault();
    event.stopPropagation();
    if (!this.canWriteSandik()) return;
    this.selectedSandikForLocIds.set([sandik.id]);
    this.yeniLokasyonId.set(sandik.depoLokasyonId ?? 0);
    this.showLokasyonModal.set(true);
  }

  topluLokasyonAtaModal() {
    if (this.selectedSandikIds().size === 0) return;
    if (!this.canWriteSandik()) return;
    this.selectedSandikForLocIds.set(Array.from(this.selectedSandikIds()));
    this.yeniLokasyonId.set(0);
    this.showLokasyonModal.set(true);
  }

  getLokasyonModalTitle(): string {
    const ids = this.selectedSandikForLocIds();
    if (ids.length === 1) {
      const sandik = this.filtered().find(s => s.id === ids[0]);
      return sandik ? this.getDisplayNo(sandik.sandikNo) : '';
    }
    return ids.length + ' Adet Seçili';
  }

  closeLokasyonModal() {
    this.showLokasyonModal.set(false);
    this.selectedSandikForLocIds.set([]);
    this.yeniLokasyonId.set(0);
  }

  saveLokasyon() {
    if (!this.yeniLokasyonId()) {
      this.toast.error('Lütfen bir lokasyon seçiniz.');
      return;
    }
    const ids = this.selectedSandikForLocIds();
    if (ids.length === 0) return;

    this.isSavingLokasyon.set(true);
    this.sandikService.lokasyonGuncelle(ids, this.yeniLokasyonId()).subscribe({
      next: (res) => {
        this.isSavingLokasyon.set(false);
        if (res.isSuccess) {
          this.toast.success('Lokasyon başarıyla güncellendi.');
          this.closeLokasyonModal();
          this.selectedSandikIds.set(new Set()); // Eğer toplu geldiyse checkboxları temizle
          this.loadSandiklar();
        } else {
          this.toast.error(res.error || 'İşlem başarısız oldu.');
        }
      },
      error: () => {
        this.isSavingLokasyon.set(false);
        this.toast.error('Sunucu ile iletişim kurulamadı.');
      }
    });
  }

  getDurumLabel(durum: string): string {
    const map: Record<string, string> = {
      Bos: 'BOŞ', Hazirlaniyor: 'HAZIRLANIYOR', Hazir: 'HAZIR', Sevkedildi: 'SEVK EDİLDİ',
    };
    return map[durum] ?? durum;
  }

  getDurumColor(durum: string): string {
    const map: Record<string, string> = {
      Bos: '#94A3B8', Hazirlaniyor: '#FD5812', Hazir: '#25B003', Sevkedildi: '#3584FC',
    };
    return map[durum] ?? '#94A3B8';
  }

  getDurumIcon(durum: string): string {
    const map: Record<string, string> = {
      Bos: 'ri-inbox-line', Hazirlaniyor: 'ri-loader-4-line', Hazir: 'ri-checkbox-circle-line', Sevkedildi: 'ri-truck-line',
    };
    return map[durum] ?? 'ri-inbox-line';
  }

  toggleSelection(sandikId: number) {
    const set = this.selectedSandikIds();
    if (set.has(sandikId)) set.delete(sandikId);
    else set.add(sandikId);
    this.selectedSandikIds.set(new Set(set));
  }

  isAllSelected(): boolean {
    const allIds = this.filtered().map(s => s.id);
    return allIds.length > 0 && allIds.every(id => this.selectedSandikIds().has(id));
  }

  toggleAll() {
    if (this.isAllSelected()) {
      this.selectedSandikIds.set(new Set());
    } else {
      this.selectedSandikIds.set(new Set(this.filtered().map(s => s.id)));
    }
  }

  topluHazirYap() {
    if (this.selectedSandikIds().size === 0) return;
    this.topluKapatConfirm(Array.from(this.selectedSandikIds()), false);
  }

  private generateMissingItemHtml(item: any): string {
    return `
      <div class="mb-3 border-bottom pb-2 ms-2 me-2">
        <div class="fw-bold fs-6 text-dark">${item.siraNo} - ${item.barkod}</div>
        <div class="text-secondary small mb-2">${item.aciklama}</div>
        <div>
          <span class="badge bg-primary text-white me-2 px-2 py-1">Kalan: ${item.kalan}</span>
          <span class="badge bg-danger text-white px-2 py-1">Durum: ${item.durumMetni}</span>
        </div>
      </div>`;
  }

  private topluKapatConfirm(ids: number[], forceClose: boolean) {
    this.sandikService.topluKapat(ids, forceClose).subscribe({
      next: async (apiRes) => {
        const res = apiRes.value ?? apiRes;
        
        if (res.isSuccess) {
          this.toast.success(res.message || 'Sandıklar başarıyla hazırlandı.');
          this.selectedSandikIds.set(new Set());
          this.loadSandiklar();
        } else if (res.hasMissingOrDefectiveItems) {
           const warningList = res.uyariDetaylari?.map((u:any) => `
             <div class="text-dark fw-bold mb-2">Sandık ${u.sandikNo}</div>
             <div class="mb-3">${u.urunHatalari.map((item: any) => this.generateMissingItemHtml(item)).join('')}</div>
           `).join('') || '';
           
           const warningConfirm = await this.confirmService.ask({
             title: 'Eksik / Hatalı Ürünler',
             message: `<div class="mb-3 text-dark">Seçili sandıklarda işlem bekleyen eksik veya hatalı ürünler bulundu. Onaylarsanız bu sandıklar <b>'Hazır'</b> konumuna alınacaktır:</div><div class="text-start mb-0">${warningList}</div>`,
             confirmText: 'Yine de Hazırla',
             cancelText: 'Vazgeç',
             type: 'info'
           });
           
           if (warningConfirm) {
             this.topluKapatConfirm(ids, true);
           }
        } else {
           this.toast.error(res.message || 'İşlem başarısız oldu.');
        }
      },
      error: async (err) => {
        const errorBody = err.error?.value ?? err.error;
        if (errorBody && errorBody.hasMissingOrDefectiveItems) {
           const warningList = errorBody.uyariDetaylari?.map((u:any) => `
             <div class="text-dark fw-bold mb-2">Sandık ${u.sandikNo}</div>
             <div class="mb-3">${u.urunHatalari.map((item: any) => this.generateMissingItemHtml(item)).join('')}</div>
           `).join('') || '';
           
           const warningConfirm = await this.confirmService.ask({
             title: 'Eksik / Hatalı Ürünler',
             message: `<div class="mb-3 text-dark">Seçili sandıklarda işlem bekleyen eksik veya hatalı ürünler bulundu. Onaylarsanız bu sandıklar <b>'Hazır'</b> konumuna alınacaktır:</div><div class="text-start mb-0">${warningList}</div>`,
             confirmText: 'Zorla Kapat',
             cancelText: 'İptal Et',
             type: 'info'
           });
           
           if (warningConfirm) {
             this.topluKapatConfirm(ids, true);
           }
        } else {
           this.toast.error('Beklenmeyen bir hata oluştu veya sunucuya ulaşılamıyor.');
        }
      }
    });
  }

  async toggleSandikDurum(event: Event, sandik: SandikDto) {
    event.preventDefault();
    event.stopPropagation();
    
    if (!this.canWriteSandik()) return;

    const isHazir = sandik.durumMetni === 'Hazır';
    const actionText = isHazir ? 'Sandığı tekrar "Hazırlanıyor" durumuna almak' : 'Sandığı "Hazır" olarak işaretlemek';
    
    const confirm = await this.confirmService.ask({
      title: 'Sandık Durumu',
      message: `${actionText} istediğinize emin misiniz?`,
      confirmText: 'Evet, Değiştir',
      cancelText: 'İptal',
      type: isHazir ? 'warning' : 'info'
    });

    if (confirm) {
      if (isHazir) {
        // Sandığı Aç ("Hazırlanıyor" yap)
        this.projeService.sandikKapat(sandik.id, false).subscribe({
          next: (res) => {
            if (res.isSuccess) {
              this.toast.success('Sandık tekrar hazırlanıyor konumuna alındı.');
              this.loadSandiklar();
            } else {
              this.toast.error(res.error || 'İşlem başarısız oldu.');
            }
          },
          error: () => this.toast.error('Beklenmeyen bir hata oluştu.')
        });
      } else {
        // Sandığı Kapat ("Hazır" yap)
        this.kapatSandikConfirm(sandik.id, false);
      }
    }
  }

  private kapatSandikConfirm(sandikId: number, forceClose: boolean) {
    this.sandikService.kapat(sandikId, forceClose).subscribe({
      next: async (apiRes) => {
        const res = apiRes.value ?? apiRes;
        
        if (res.isSuccess) {
           this.toast.success('Sandık başarıyla hazır olarak işaretlendi.');
           this.loadSandiklar();
        } else if (res.hasMissingOrDefectiveItems) {
           const warningList = res.missingItemDetails?.map((item:any) => this.generateMissingItemHtml(item)).join('') || '';
           const warningConfirm = await this.confirmService.ask({
             title: 'Eksik / Hatalı Ürün Var',
             message: `<div class="mb-3 text-dark">${res.message}</div><div class="text-start mb-0">${warningList}</div>`,
             confirmText: 'Yine de Hazırla',
             cancelText: 'Vazgeç',
             type: 'info'
           });
           
           if (warningConfirm) {
             this.kapatSandikConfirm(sandikId, true);
           }
        } else {
           this.toast.error(res.message || 'İşlem başarısız oldu.');
        }
      },
      error: async (err) => {
        const errorBody = err.error?.value ?? err.error;
        if (errorBody && errorBody.hasMissingOrDefectiveItems) {
           const warningList = (errorBody.missingItemDetails || []).map((item:any)=> this.generateMissingItemHtml(item)).join('');
           const warningConfirm = await this.confirmService.ask({
             title: 'Eksik / Hatalı Ürün Var',
             message: `<div class="mb-3 text-dark">${errorBody.message}</div><div class="text-start mb-0">${warningList}</div>`,
             confirmText: 'Yine de Hazırla',
             cancelText: 'Vazgeç',
             type: 'info'
           });
           
           if (warningConfirm) {
             this.kapatSandikConfirm(sandikId, true);
           }
        } else {
           this.toast.error('Beklenmeyen bir hata oluştu.');
        }
      }
    });
  }

  // ===== Sandık Ekleme =====

  openSandikEkleModal() {
    const maxNo = this.sandiklar().reduce((max, s) => {
      const num = parseInt(s.sandikNo.replace(/\D/g, ''), 10);
      return isNaN(num) ? max : Math.max(max, num);
    }, 0);
    this.ekSandikNo.set((maxNo + 1).toString());
    this.ekTipId.set(1);
    this.ekLokasyonId.set(2);
    this.showSandikEkleModal.set(true);
  }

  closeSandikEkleModal() {
    this.showSandikEkleModal.set(false);
  }

  sandikEkle() {
    const no = this.ekSandikNo().trim();
    if (!no) {
      this.toast.error('Sandık numarası girilmelidir.');
      return;
    }
    this.ekSaving.set(true);
    this.sandikService.sandikEkle({
      projeId: this.projeId(),
      sandikNo: no,
      tipId: this.ekTipId(),
      depoLokasyonId: this.ekLokasyonId(),
    }).subscribe({
      next: (res) => {
        this.ekSaving.set(false);
        if (res.isSuccess) {
          this.toast.success(`Sandık "${no}" başarıyla oluşturuldu.`);
          this.closeSandikEkleModal();
          this.loadSandiklar();
        } else {
          this.toast.error(res.error ?? 'Sandık eklenemedi.');
        }
      },
      error: () => {
        this.ekSaving.set(false);
        this.toast.error('Sandık eklenirken bir hata oluştu.');
      }
    });
  }
}
