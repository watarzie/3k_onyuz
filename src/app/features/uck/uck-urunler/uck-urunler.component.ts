import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslationService } from '../../../core/services/translation.service';
import { ToastService } from '../../../core/services/toast.service';
import { UcKService } from '../../../core/services/uck.service';

import { BreadcrumbComponent } from '../../../shared/components/breadcrumb/breadcrumb.component';
import { StatCardComponent } from '../../../shared/components/stat-card/stat-card.component';
import { CanWriteDirective } from '../../../shared/directives/can-write.directive';
import { ReadOnlyBannerComponent } from '../../../shared/components/readonly-banner/readonly-banner.component';
import { UcKUrunDto, UcKDurumGuncelleDto } from '../../../shared/models/index';

interface KarsilamaTipi { value: string; label: string; color: string; bgClass: string; }

const KARSILAMA_TIPLERI: KarsilamaTipi[] = [
  { value: 'TamGeldi',            label: 'TAM GELDİ',            color: '#25B003', bgClass: 'row-tam-geldi' },
  { value: 'EksikGeldi',          label: 'EKSİK GELDİ',          color: '#FD5812', bgClass: 'row-eksik-geldi' },
  { value: 'ProjedenKarsilandi',  label: 'PROJEDEN KARŞILANDI',   color: '#3584FC', bgClass: 'row-projeden' },
  { value: 'StoktanKarsilandi',   label: 'STOKTAN KARŞILANDI',    color: '#9C27B0', bgClass: 'row-stoktan' },
  { value: 'TedarikcidenGeldi',   label: 'TEDARİKÇİDEN GELDİ',   color: '#1B7D3A', bgClass: 'row-tedarikci' },
  { value: 'BaskaProyeVerildi',   label: 'BAŞKA PROJEYE VERİLDİ', color: '#FF4023', bgClass: 'row-baska-proje' },
  { value: 'HataliUrun',          label: 'HATALI ÜRÜN GELDİ',     color: '#E65100', bgClass: 'row-hatali' },
];

@Component({
  selector: 'app-uck-urunler',
  standalone: true,
  imports: [RouterLink, NgClass, FormsModule, BreadcrumbComponent, StatCardComponent, CanWriteDirective, ReadOnlyBannerComponent],
  templateUrl: './uck-urunler.component.html',
  styleUrl: './uck-urunler.component.scss',
})
export class UcKUrunlerComponent implements OnInit {
  ts = inject(TranslationService);
  private route = inject(ActivatedRoute);
  private uckService = inject(UcKService);
  private toast = inject(ToastService);

  projeId = signal(0);
  sandikNo = signal('');
  urunler = signal<UcKUrunDto[]>([]);
  filtered = signal<UcKUrunDto[]>([]);
  loading = signal(true);
  filterTip = signal('');
  searchTerm = signal('');

  // Side panel
  showPanel = signal(false);
  panelUrun = signal<UcKUrunDto | null>(null);
  panelTip = signal('');
  panelGelenAdet = signal<number>(0);
  panelKaynakHedef = signal('');
  panelAciklama = signal('');
  panelNot = signal('');
  panelSaving = signal(false);
  panelError = signal('');
  panelUyari = signal('');

  // Stats
  toplamUrun = computed(() => this.urunler().length);
  tamGeldi = computed(() => this.urunler().filter(u => u.ucKKarsilamaTipi === 'TamGeldi').length);
  eksikGeldi = computed(() => this.urunler().filter(u => u.ucKKarsilamaTipi === 'EksikGeldi').length);
  tamamlanan = computed(() => this.urunler().filter(u => u.kalan === 0 && u.ucKKarsilamaTipi !== 'Bekliyor').length);
  kalanlar = computed(() => this.urunler().filter(u => u.kalan > 0).length);

  karsilamaTipleri = KARSILAMA_TIPLERI;
  breadcrumb: { label: string; link?: string }[] = [];

  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('projeId'));
    const sNo = this.route.snapshot.paramMap.get('sandikNo') ?? '';
    this.projeId.set(id);
    this.sandikNo.set(sNo);
    this.breadcrumb = [
      { label: 'Ana Kontrol Paneli', link: '/dashboard' },
      { label: 'Projeler', link: '/projeler' },
      { label: '3K Sandıklar', link: `/uck/${id}` },
      { label: sNo || '3K Ürünler' },
    ];
    this.loadUrunler();
  }

  loadUrunler() {
    this.loading.set(true);
    this.uckService.getUrunler(this.projeId()).subscribe((res) => {
      this.loading.set(false);
      if (res.isSuccess && res.value) {
        // Sadece bu sandıktaki ürünleri göster
        const sNo = this.sandikNo();
        const all = sNo ? res.value.filter(u => u.sandikNo === sNo) : res.value;
        this.urunler.set(all);
        this.applyFilter();
      }
    });
  }

  applyFilter() {
    let list = this.urunler();
    const tip = this.filterTip();
    const term = this.searchTerm().toLowerCase();
    if (tip) list = list.filter(u => u.ucKKarsilamaTipi === tip);
    if (term) list = list.filter(u =>
      u.aciklama.toLowerCase().includes(term) ||
      u.barkodNo.toLowerCase().includes(term) ||
      u.sandikNo.toLowerCase().includes(term)
    );
    this.filtered.set(list);
  }

  onSearch(event: Event) {
    this.searchTerm.set((event.target as HTMLInputElement).value);
    this.applyFilter();
  }

  onFilterTip(tip: string) {
    this.filterTip.set(this.filterTip() === tip ? '' : tip);
    this.applyFilter();
  }

  getRowClass(u: UcKUrunDto): string {
    return KARSILAMA_TIPLERI.find(t => t.value === u.ucKKarsilamaTipi)?.bgClass ?? '';
  }

  getTipLabel(value: string): string {
    return KARSILAMA_TIPLERI.find(t => t.value === value)?.label ?? value;
  }

  getTipColor(value: string): string {
    return KARSILAMA_TIPLERI.find(t => t.value === value)?.color ?? '#64748B';
  }

  // ===== Side Panel =====
  openPanel(urun: UcKUrunDto) {
    this.panelUrun.set(urun);
    this.panelTip.set(urun.ucKKarsilamaTipi === 'Bekliyor' ? '' : urun.ucKKarsilamaTipi);
    this.panelGelenAdet.set(urun.gelenMiktar);
    this.panelKaynakHedef.set(urun.kaynakHedefProjeNo ?? '');
    this.panelAciklama.set(urun.ucKAciklama ?? '');
    this.panelNot.set(urun.ucKNotu ?? '');
    this.panelError.set('');
    this.recalcPanel();
    this.showPanel.set(true);
  }

  closePanel() {
    this.showPanel.set(false);
    this.panelUrun.set(null);
    this.panelError.set('');
  }

  onTipChange(tip: string) {
    const u = this.panelUrun()!;
    this.panelTip.set(tip);

    switch (tip) {
      case 'TamGeldi':
        this.panelGelenAdet.set(u.istenenAdet);
        break;
      case 'EksikGeldi':
      case 'ProjedenKarsilandi':
      case 'StoktanKarsilandi':
      case 'TedarikcidenGeldi':
      case 'HataliUrun':
        this.panelGelenAdet.set(u.gelenMiktar > 0 ? u.gelenMiktar : 0);
        break;
      case 'BaskaProyeVerildi':
        this.panelGelenAdet.set(0);
        break;
    }
    this.recalcPanel();
  }

  recalcPanel() {
    const tip = this.panelTip();
    const labels: Record<string, string> = {
      TamGeldi: 'TAM GELDİ',
      EksikGeldi: 'EKSİK GELDİ',
      ProjedenKarsilandi: 'PROJEDEN KARŞILANDI',
      StoktanKarsilandi: 'STOKTAN KARŞILANDI',
      TedarikcidenGeldi: 'TEDARİKÇİDEN GELDİ',
      BaskaProyeVerildi: 'BAŞKA PROJEYE VERİLDİ',
      HataliUrun: 'HATALI ÜRÜN GELDİ',
    };
    this.panelUyari.set(labels[tip] ?? 'BEKLİYOR');
    this.panelError.set('');
  }

  get isGelenAdetAktif(): boolean {
    const t = this.panelTip();
    return t !== 'TamGeldi' && t !== 'BaskaProyeVerildi' && t !== '';
  }

  get isKaynakHedefZorunlu(): boolean {
    const t = this.panelTip();
    return t === 'ProjedenKarsilandi' || t === 'BaskaProyeVerildi';
  }

  get isAciklamaZorunlu(): boolean {
    return this.panelTip() === 'HataliUrun';
  }

  get panelKalan(): number {
    const u = this.panelUrun();
    if (!u) return 0;
    if (this.panelTip() === 'BaskaProyeVerildi') return 0;
    return Math.max(0, u.istenenAdet - this.panelGelenAdet() - u.trafoSevkAdet);
  }

  validatePanel(): string | null {
    const u = this.panelUrun()!;
    const tip = this.panelTip();
    if (!tip) return 'Karşılama tipi seçilmelidir.';

    if (tip === 'EksikGeldi') {
      if (this.panelGelenAdet() <= 0) return 'Gelen adet girilmelidir.';
      if (this.panelGelenAdet() >= u.istenenAdet) return 'Gelen adet miktardan küçük olmalıdır.';
    }
    if (tip === 'ProjedenKarsilandi') {
      if (this.panelGelenAdet() <= 0) return 'Karşılanan adet girilmelidir.';
      if (!this.panelKaynakHedef()) return 'Kaynak proje girilmelidir.';
    }
    if (tip === 'StoktanKarsilandi' || tip === 'TedarikcidenGeldi') {
      if (this.panelGelenAdet() <= 0) return 'Gelen adet girilmelidir.';
    }
    if (tip === 'BaskaProyeVerildi') {
      if (!this.panelKaynakHedef()) return 'Hangi projeye verildiği yazılmalıdır.';
    }
    if (tip === 'HataliUrun') {
      if (this.panelGelenAdet() <= 0) return 'Gelen adet girilmelidir.';
      if (!this.panelAciklama()) return 'Hatalı ürün açıklaması girilmelidir.';
    }
    if (this.panelGelenAdet() > u.istenenAdet) return 'Gelen adet miktardan büyük olamaz.';
    if (this.panelGelenAdet() + u.trafoSevkAdet > u.istenenAdet)
      return 'Toplam tamamlanan adet, çeki miktarını aşamaz.';

    return null;
  }

  savePanel() {
    const err = this.validatePanel();
    if (err) { this.panelError.set(err); return; }

    const u = this.panelUrun()!;
    this.panelSaving.set(true);
    this.panelError.set('');

    const dto: UcKDurumGuncelleDto = {
      cekiSatiriId: u.cekiSatiriId,
      projeId: this.projeId(),
      karsilamaTipi: this.panelTip(),
      gelenAdet: this.panelTip() === 'BaskaProyeVerildi' ? undefined : this.panelGelenAdet(),
      kaynakHedefProjeNo: this.panelKaynakHedef() || undefined,
      aciklama: this.panelAciklama() || undefined,
      not: this.panelNot() || undefined,
    };

    this.uckService.durumGuncelle(dto).subscribe({
      next: (res) => {
        this.panelSaving.set(false);
        if (res.isSuccess) {
          this.toast.success('3K durumu başarıyla güncellendi.');
          this.closePanel();
          this.loadUrunler();
        } else {
          const msg = res.error ?? 'Kayıt başarısız.';
          this.panelError.set(msg);
          this.toast.error(msg);
        }
      },
      error: () => {
        this.panelSaving.set(false);
        this.panelError.set('Bir hata oluştu.');
        this.toast.error('Sunucu ile iletişim kurulamadı.');
      },
    });
  }
}
