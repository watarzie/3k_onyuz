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
import { LookupService } from '../../../core/services/lookup.service';
import { PdfService } from '../../../core/services/pdf.service';
import { SevkiyatKilitAcmaTipi } from '../../../core/constants/enums';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { BreadcrumbComponent } from '../../../shared/components/breadcrumb/breadcrumb.component';
import { StatCardComponent } from '../../../shared/components/stat-card/stat-card.component';
import { SandikDto, LookupResponse, ProjeDropdownDto } from '../../../shared/models/index';

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
  private lookupService = inject(LookupService);
  private pdfService = inject(PdfService);
  private readonly sevkEdilmisSandikMesaji = 'Bu sandık sevk edildiği için üzerinde işlem yapılamaz.';

  private get activeMenuKod(): string {
    return this.route.snapshot.data?.['menuKod'] || '3k-modulu';
  }

  isSahaContext = computed(() => this.activeMenuKod === 'saha-3k-modulu');
  uckRoutePrefix = computed(() => this.isSahaContext() ? '/saha-yonetimi/uck' : '/uck');
  uckSandikRoutePrefix = computed(() => this.isSahaContext() ? '/saha-yonetimi/uck/sandik' : '/uck/sandik');
  canWriteSandik = computed(() => this.permissionService.canWrite(this.activeMenuKod));
  canSeeSandikDurumRaporu = computed(() => this.permissionService.hasAccess(this.sandikDurumRaporMenuKod()));

  projeId = signal(0);
  mevcutProje = signal<ProjeDropdownDto | null>(null);
  sandiklar = signal<SandikDto[]>([]);
  filtered = signal<SandikDto[]>([]);
  loading = signal(true);
  downloadingSandikDurumRaporu = signal(false);

  // Bulk Selection
  selectedSandikIds = signal<Set<number>>(new Set());

  // Filter & Search
  searchTerm = signal('');
  selectedLokasyonlar = signal<string[]>([]);

  // System defined DepoLocations via Lookup
  sistemLokasyonlar = signal<{ id: number, deger: string }[]>([]);

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
  ekSandikIsmi = signal('');
  ekTipId = signal(1);
  ekLokasyonId = signal(2);
  ekSaving = signal(false);
  ekBoy = signal<number | null>(null);
  ekEn = signal<number | null>(null);
  ekYukseklik = signal<number | null>(null);
  ekNetKg = signal<number | null>(null);
  ekGrossKg = signal<number | null>(null);
  sandikTipleri = signal<{ id: number, deger: string }[]>([]);
  showKilitAcModal = signal(false);
  kilitAcSandik = signal<SandikDto | null>(null);
  kilitAcmaTipiId = signal<SevkiyatKilitAcmaTipi>(SevkiyatKilitAcmaTipi.SevkiyatKaydiKorunarakAc);
  kilitAcAciklama = signal('');
  kilitAcSaving = signal(false);
  duzeltmeTamamlaSavingId = signal<number | null>(null);
  readonly kilitAcmaTipleri = SevkiyatKilitAcmaTipi;

  breadcrumb: { label: string; link?: string }[] = [];

  // Stats
  get hazirCount(): number { return this.sandiklar().filter(s => s.durumMetni === 'Kapandı').length; }
  get hazirlaniyorCount(): number { return this.sandiklar().filter(s => s.durumMetni === 'Hazırlanıyor').length; }
  get sevkedildiCount(): number { return this.sandiklar().filter(s => s.durumMetni === 'Sevk Edildi').length; }
  projeBaslik = computed(() => {
    const proje = this.mevcutProje();
    return proje ? `${proje.projeNo} - ${proje.musteri}` : `Proje #${this.projeId()}`;
  });

  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('projeId'));
    this.projeId.set(id);
    const isSaha = this.isSahaContext();
    this.breadcrumb = [
      { label: 'Ana Kontrol Paneli', link: '/dashboard' },
      { label: isSaha ? 'Saha Yönetimi' : 'Projeler', link: isSaha ? '/saha-yonetimi' : '/projeler' },
      { label: isSaha ? 'Saha 3K Modülü' : '3K Modülü' },
    ];
    this.loadProjeBilgisi();
    this.loadLookups();
    this.loadSandiklar();
  }

  loadProjeBilgisi() {
    this.projeService.getProjeDropdownListesi().subscribe((res) => {
      if (res.isSuccess && res.value) {
        this.mevcutProje.set(res.value.find(p => p.id === this.projeId()) ?? null);
      }
    });
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

  /**
   * Listeyi yerinde günceller — scroll pozisyonu korunur.
   * Mevcut sandıkların verilerini API'den taze veriyle değiştirir
   * ama dizi referansını ve sıralamayı korur.
   */
  refreshSandiklar() {
    this.sandikService.getSandiklar(this.projeId()).subscribe((res) => {
      if (res.isSuccess && res.value) {
        const freshMap = new Map(res.value.map(s => [s.id, s]));
        // Mevcut listeyi yerinde güncelle
        const updated = this.sandiklar().map(s => freshMap.get(s.id) ?? s);
        this.sandiklar.set(updated);
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
    this.temizleSevkEdilmisSecimler();
  }

  // --- Lokasyon Güncelleme ---
  selectedSandikForLocIds = signal<number[]>([]);

  openLokasyonModal(event: Event, sandik: SandikDto) {
    event.preventDefault();
    event.stopPropagation();
    if (!this.canWriteSandik()) return;
    if (this.isSandikSevkEdildi(sandik)) {
      this.toast.error(this.sevkEdilmisSandikMesaji);
      return;
    }
    this.selectedSandikForLocIds.set([sandik.id]);
    this.yeniLokasyonId.set(sandik.depoLokasyonId ?? 0);
    this.showLokasyonModal.set(true);
  }

  topluLokasyonAtaModal() {
    if (this.selectedSandikIds().size === 0) return;
    if (!this.canWriteSandik()) return;
    const ids = this.secilenSevkEdilmemisSandikIdleri();
    if (ids.length === 0) {
      this.toast.error(this.sevkEdilmisSandikMesaji);
      return;
    }
    this.selectedSandikForLocIds.set(ids);
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
    if (this.sandiklar().some(s => ids.includes(s.id) && this.isSandikSevkEdildi(s))) {
      this.toast.error(this.sevkEdilmisSandikMesaji);
      return;
    }

    this.isSavingLokasyon.set(true);
    this.sandikService.lokasyonGuncelle(ids, this.yeniLokasyonId()).subscribe({
      next: (res) => {
        this.isSavingLokasyon.set(false);
        if (res.isSuccess) {
          this.toast.success('Lokasyon başarıyla güncellendi.');
          this.closeLokasyonModal();
          this.selectedSandikIds.set(new Set());
          this.refreshSandiklar();
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
      Bos: 'BOŞ', Hazirlaniyor: 'HAZIRLANIYOR', 'Kapandı': 'KAPANDI', Sevkedildi: 'SEVK EDİLDİ',
    };
    return map[durum] ?? durum;
  }

  getDurumColor(durum: string): string {
    const map: Record<string, string> = {
      Bos: '#94A3B8', Hazirlaniyor: '#FD5812', 'Kapandı': '#25B003', Sevkedildi: '#3584FC',
    };
    return map[durum] ?? '#94A3B8';
  }

  getDurumIcon(durum: string): string {
    const map: Record<string, string> = {
      Bos: 'ri-inbox-line', Hazirlaniyor: 'ri-loader-4-line', 'Kapandı': 'ri-lock-line', Sevkedildi: 'ri-truck-line',
    };
    return map[durum] ?? 'ri-inbox-line';
  }

  isSandikKapandi(sandik: SandikDto): boolean {
    const durumMetni = (sandik.durumMetni ?? '').trim();
    return sandik.durumId === 3 ||
      durumMetni === 'Kapandı' ||
      durumMetni === 'Kapandi';
  }

  isSandikSevkEdildi(sandik: SandikDto): boolean {
    const durumMetni = (sandik.durumMetni ?? '').trim();
    return sandik.durumId === 4 ||
      durumMetni === 'SevkEdildi' ||
      durumMetni === 'Sevk Edildi' ||
      durumMetni === 'Sevkedildi';
  }

  isSandikDuzeltmeyeAcik(sandik: SandikDto): boolean {
    return sandik.sevkiyatDuzeltmeAcikMi === true;
  }

  isSandikKilitli(sandik: SandikDto): boolean {
    return this.isSandikSevkEdildi(sandik) && !this.isSandikDuzeltmeyeAcik(sandik);
  }

  indirSandikDurumRaporu() {
    if (this.downloadingSandikDurumRaporu()) return;

    this.downloadingSandikDurumRaporu.set(true);
    this.pdfService.uckSandikDurumPdf(this.projeId(), this.sandikDurumRaporMenuKod()).subscribe({
      next: (blob) => {
        this.downloadingSandikDurumRaporu.set(false);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        const projeNo = this.mevcutProje()?.projeNo ?? `Proje_${this.projeId()}`;
        a.href = url;
        a.download = `${projeNo}_SandikDurumRaporu.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
        this.toast.success('Sandık durum raporu indirildi.');
      },
      error: () => {
        this.downloadingSandikDurumRaporu.set(false);
        this.toast.error('Sandık durum raporu indirilirken hata oluştu.');
      }
    });
  }

  private sandikDurumRaporMenuKod(): string {
    return this.isSahaContext() ? 'saha-3k-sandik-durum-raporu' : '3k-sandik-durum-raporu';
  }

  onSandikCardClick(event: Event, sandik: SandikDto) {
    if (!this.isSandikKilitli(sandik)) return;

    event.preventDefault();
    event.stopPropagation();
    this.toast.info('Bu sandık sevk edildiği için 3K işlemine kapalıdır.');
  }

  async sandikKilidiAc(event: Event, sandik: SandikDto) {
    event.preventDefault();
    event.stopPropagation();

    if (!this.canWriteSandik()) return;
    if (!this.isSandikKilitli(sandik)) return;

    this.kilitAcSandik.set(sandik);
    this.kilitAcmaTipiId.set(SevkiyatKilitAcmaTipi.SevkiyatKaydiKorunarakAc);
    this.kilitAcAciklama.set('');
    this.showKilitAcModal.set(true);
  }

  closeKilitAcModal() {
    if (this.kilitAcSaving()) return;
    this.showKilitAcModal.set(false);
    this.kilitAcSandik.set(null);
    this.kilitAcAciklama.set('');
  }

  sandikKilidiAcOnayla() {
    const sandik = this.kilitAcSandik();
    if (!sandik) return;

    const aciklama = this.kilitAcAciklama().trim();
    if (!aciklama) {
      this.toast.error('Kilit açma gerekçesi girilmelidir.');
      return;
    }

    this.kilitAcSaving.set(true);
    this.sandikService.sandikKilidiAc(
      this.projeId(),
      sandik.id,
      this.kilitAcmaTipiId(),
      aciklama,
      this.mevcutProje()?.projeNo,
      sandik.sandikNo
    ).subscribe({
      next: (res) => {
        this.kilitAcSaving.set(false);
        if (res.isSuccess) {
          const queued = (res.value as any)?.statusCode === 202;
          this.toast.success(queued ? `Sandık "${sandik.sandikNo}" kilit açma talebi onaya gönderildi.` : `Sandık "${sandik.sandikNo}" kilidi açıldı.`);
          this.closeKilitAcModal();
          this.selectedSandikIds.set(new Set());
          this.refreshSandiklar();
        } else {
          this.toast.error(res.error ?? 'Sandık kilidi açılamadı.');
        }
      },
      error: () => {
        this.kilitAcSaving.set(false);
        this.toast.error('Sandık kilidi açılırken sunucu ile iletişim kurulamadı.');
      }
    });
  }

  isDuzeltmeTamamlaSaving(sandik: SandikDto): boolean {
    return this.duzeltmeTamamlaSavingId() === sandik.id;
  }

  async sandikDuzeltmeyiTamamla(event: Event, sandik: SandikDto) {
    event.preventDefault();
    event.stopPropagation();

    if (!this.canWriteSandik() || !this.isSandikDuzeltmeyeAcik(sandik) || this.isDuzeltmeTamamlaSaving(sandik)) {
      return;
    }

    const onay = await this.confirmService.ask({
      title: 'Düzeltmeyi Tamamla',
      message: `<strong>${sandik.sandikNo}</strong> numaralı sandık tekrar kilitlenecek. Sevkiyat kaydı korunmaya devam edecek ve yeni sevkiyat oluşturulmayacak. Onaylıyor musunuz?`,
      confirmText: 'Evet, Tamamla',
      cancelText: 'Vazgeç',
      type: 'success'
    });

    if (!onay) return;

    this.duzeltmeTamamlaSavingId.set(sandik.id);
    this.sandikService.sandikSevkiyatDuzeltmeTamamla(this.projeId(), sandik.id).subscribe({
      next: (res) => {
        this.duzeltmeTamamlaSavingId.set(null);
        if (res.isSuccess) {
          this.toast.success(`Sandık "${sandik.sandikNo}" düzeltmesi tamamlandı ve kilitlendi.`);
          this.selectedSandikIds.set(new Set());
          this.refreshSandiklar();
        } else {
          this.toast.error(res.error ?? 'Düzeltme tamamlanamadı.');
        }
      },
      error: () => {
        this.duzeltmeTamamlaSavingId.set(null);
        this.toast.error('Düzeltme tamamlanırken sunucu ile iletişim kurulamadı.');
      }
    });
  }

  private getSecilebilirSandiklar(): SandikDto[] {
    return this.filtered().filter(s => !this.isSandikSevkEdildi(s));
  }

  private secilenSevkEdilmemisSandikIdleri(): number[] {
    const selected = this.selectedSandikIds();
    return this.sandiklar()
      .filter(s => selected.has(s.id) && !this.isSandikSevkEdildi(s))
      .map(s => s.id);
  }

  private temizleSevkEdilmisSecimler() {
    const kilitliIds = new Set(this.sandiklar().filter(s => this.isSandikSevkEdildi(s)).map(s => s.id));
    if (kilitliIds.size === 0) return;

    const temizSecim = Array.from(this.selectedSandikIds()).filter(id => !kilitliIds.has(id));
    if (temizSecim.length !== this.selectedSandikIds().size) {
      this.selectedSandikIds.set(new Set(temizSecim));
    }
  }

  toggleSelection(sandikId: number) {
    const sandik = this.sandiklar().find(s => s.id === sandikId);
    if (sandik && this.isSandikSevkEdildi(sandik)) return;

    const set = this.selectedSandikIds();
    if (set.has(sandikId)) set.delete(sandikId);
    else set.add(sandikId);
    this.selectedSandikIds.set(new Set(set));
  }

  isAllSelected(): boolean {
    const allIds = this.getSecilebilirSandiklar().map(s => s.id);
    return allIds.length > 0 && allIds.every(id => this.selectedSandikIds().has(id));
  }

  toggleAll() {
    if (this.isAllSelected()) {
      const set = new Set(this.selectedSandikIds());
      this.getSecilebilirSandiklar().forEach(s => set.delete(s.id));
      this.selectedSandikIds.set(set);
    } else {
      const set = new Set(this.selectedSandikIds());
      this.getSecilebilirSandiklar().forEach(s => set.add(s.id));
      this.selectedSandikIds.set(set);
    }
  }

  topluHazirYap() {
    if (this.selectedSandikIds().size === 0) return;
    const ids = this.secilenSevkEdilmemisSandikIdleri();
    if (ids.length === 0) {
      this.toast.error(this.sevkEdilmisSandikMesaji);
      return;
    }
    this.topluKapatConfirm(ids, false);
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
          this.toast.success(res.message || 'Sandıklar başarıyla kapatıldı.');
          this.selectedSandikIds.set(new Set());
          this.refreshSandiklar();
        } else if (res.hasMissingOrDefectiveItems) {
          const warningList = res.uyariDetaylari?.map((u: any) => `
             <div class="text-dark fw-bold mb-2">Sandık ${u.sandikNo}</div>
             <div class="mb-3">${u.urunHatalari.map((item: any) => this.generateMissingItemHtml(item)).join('')}</div>
           `).join('') || '';

          const warningConfirm = await this.confirmService.ask({
            title: 'Eksik / Hatalı Ürünler',
            message: `<div class="mb-3 text-dark">Seçili sandıklarda işlem bekleyen eksik veya hatalı ürünler bulundu. Onaylarsanız bu sandıklar <b>'Kapandı'</b> konumuna alınacaktır:</div><div class="text-start mb-0">${warningList}</div>`,
            confirmText: 'Yine de Kapat',
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
          const warningList = errorBody.uyariDetaylari?.map((u: any) => `
             <div class="text-dark fw-bold mb-2">Sandık ${u.sandikNo}</div>
             <div class="mb-3">${u.urunHatalari.map((item: any) => this.generateMissingItemHtml(item)).join('')}</div>
           `).join('') || '';

          const warningConfirm = await this.confirmService.ask({
            title: 'Eksik / Hatalı Ürünler',
            message: `<div class="mb-3 text-dark">Seçili sandıklarda işlem bekleyen eksik veya hatalı ürünler bulundu. Onaylarsanız bu sandıklar <b>'Kapandı'</b> konumuna alınacaktır:</div><div class="text-start mb-0">${warningList}</div>`,
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
    if (this.isSandikSevkEdildi(sandik)) {
      this.toast.error(this.sevkEdilmisSandikMesaji);
      return;
    }

    const isKapandi = sandik.durumMetni === 'Kapandı';
    const actionText = isKapandi ? 'Sandığı tekrar "Hazırlanıyor" durumuna almak' : 'Sandığı kapatmak';

    const confirm = await this.confirmService.ask({
      title: 'Sandık Durumu',
      message: `${actionText} istediğinize emin misiniz?`,
      confirmText: 'Evet, Değiştir',
      cancelText: 'İptal',
      type: isKapandi ? 'warning' : 'info'
    });

    if (confirm) {
      if (isKapandi) {
        // Sandığı Aç ("Hazırlanıyor" yap)
        this.projeService.sandikKapat(sandik.id, false).subscribe({
          next: (res) => {
            if (res.isSuccess) {
              this.toast.success('Sandık tekrar hazırlanıyor konumuna alındı.');
              this.refreshSandiklar();
            } else {
              this.toast.error(res.error || 'İşlem başarısız oldu.');
            }
          },
          error: () => this.toast.error('Beklenmeyen bir hata oluştu.')
        });
      } else {
        // Sandığı Kapat ("Kapandı" yap)
        this.kapatSandikConfirm(sandik.id, false);
      }
    }
  }

  private kapatSandikConfirm(sandikId: number, forceClose: boolean) {
    this.sandikService.kapat(sandikId, forceClose).subscribe({
      next: async (apiRes) => {
        const res = apiRes.value ?? apiRes;

        if (res.isSuccess) {
          this.toast.success('Sandık başarıyla kapatıldı.');
          this.refreshSandiklar();
        } else if (res.hasMissingOrDefectiveItems) {
          const warningList = res.missingItemDetails?.map((item: any) => this.generateMissingItemHtml(item)).join('') || '';
          const warningConfirm = await this.confirmService.ask({
            title: 'Eksik / Hatalı Ürün Var',
            message: `<div class="mb-3 text-dark">${res.message}</div><div class="text-start mb-0">${warningList}</div>`,
            confirmText: 'Yine de Kapat',
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
          const warningList = (errorBody.missingItemDetails || []).map((item: any) => this.generateMissingItemHtml(item)).join('');
          const warningConfirm = await this.confirmService.ask({
            title: 'Eksik / Hatalı Ürün Var',
            message: `<div class="mb-3 text-dark">${errorBody.message}</div><div class="text-start mb-0">${warningList}</div>`,
            confirmText: 'Yine de Kapat',
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
    this.ekSandikIsmi.set('');
    this.ekTipId.set(1);
    this.ekLokasyonId.set(2);
    this.ekBoy.set(null);
    this.ekEn.set(null);
    this.ekYukseklik.set(null);
    this.ekNetKg.set(null);
    this.ekGrossKg.set(null);
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
      sandikIsmi: this.ekSandikIsmi().trim() || undefined,
      tipId: this.ekTipId(),
      depoLokasyonId: this.ekLokasyonId(),
      boy: this.ekBoy() || undefined,
      en: this.ekEn() || undefined,
      yukseklik: this.ekYukseklik() || undefined,
      netKg: this.ekNetKg() || undefined,
      grossKg: this.ekGrossKg() || undefined,
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

  // ===== Sandık Silme =====
  async sandikSil(event: Event, sandik: SandikDto) {
    event.preventDefault();
    event.stopPropagation();
    if (!this.canWriteSandik()) return;
    if (this.isSandikSevkEdildi(sandik)) {
      this.toast.error(this.sevkEdilmisSandikMesaji);
      return;
    }

    const silmeDetayi = sandik.isManuelSandik && sandik.urunSayisi > 0
      ? `<br><br><small class="text-muted">Bu manuel sandığın içindeki ${sandik.urunSayisi} manuel ürün de silinecek.</small>`
      : '';

    const confirm = await this.confirmService.ask({
      title: 'Sandık Sil',
      message: `<strong>${sandik.sandikNo}</strong> numaralı sandığı silmek istediğinize emin misiniz?${silmeDetayi}<br><br>
                <div class="alert alert-danger py-2 mb-0">
                  <i class="ri-alert-line me-1"></i> Bu işlem geri alınamaz.
                </div>`,
      confirmText: 'Evet, Sil',
      cancelText: 'Vazgeç',
      type: 'warning'
    });

    if (confirm) {
      this.sandikService.sandikSil(sandik.id, this.projeId()).subscribe({
        next: (res) => {
          if (res.isSuccess) {
            this.toast.success(`Sandık "${sandik.sandikNo}" başarıyla silindi.`);
            this.loadSandiklar();
          } else {
            this.toast.error(res.error || 'Sandık silinemedi. İçinde silinemeyen ürün olabilir.');
          }
        },
        error: (err) => {
          const msg = err.error?.error || err.error?.message || 'Sandık silinirken hata oluştu.';
          this.toast.error(msg);
        }
      });
    }
  }
}
