import { Component, inject, signal, computed, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslationService } from '../../../core/services/translation.service';
import { ToastService } from '../../../core/services/toast.service';
import { UcKService } from '../../../core/services/uck.service';
import { ProjeService } from '../../../core/services/proje.service';
import { GridService } from '../../../core/services/grid.service';

import { BreadcrumbComponent } from '../../../shared/components/breadcrumb/breadcrumb.component';
import { StatCardComponent } from '../../../shared/components/stat-card/stat-card.component';
import { CanWriteDirective } from '../../../shared/directives/can-write.directive';
import { ReadOnlyBannerComponent } from '../../../shared/components/readonly-banner/readonly-banner.component';
import { UcKUrunDto, UcKDurumGuncelleDto, ProjeDto, GridUrunDto } from '../../../shared/models/index';

interface KarsilamaTipi { value: string; label: string; color: string; bgClass: string; }

const KARSILAMA_TIPLERI: KarsilamaTipi[] = [
  { value: 'Tam Geldi',            label: 'TAM GELDİ',            color: '#25B003', bgClass: 'row-tam-geldi' },
  { value: 'Eksik Geldi',          label: 'EKSİK GELDİ',          color: '#FD5812', bgClass: 'row-eksik-geldi' },
  { value: 'Projeden Karşılandı',  label: 'PROJEDEN KARŞILANDI',   color: '#3584FC', bgClass: 'row-projeden' },
  { value: 'Stoktan Karşılandı',   label: 'STOKTAN KARŞILANDI',    color: '#9C27B0', bgClass: 'row-stoktan' },
  { value: 'Tedarikçiden Geldi',   label: 'TEDARİKÇİDEN GELDİ',   color: '#1B7D3A', bgClass: 'row-tedarikci' },
  { value: 'Gelmedi',             label: 'GELMEDİ',              color: '#808080', bgClass: 'row-gelmedi' },
  { value: 'Geri Gönderildi',      label: 'GERİ GÖNDERİLDİ',      color: '#D32F2F', bgClass: 'row-geri-gonderildi' },
  { value: 'Hatalı Ürün',          label: 'HATALI ÜRÜN GELDİ',     color: '#E65100', bgClass: 'row-hatali' },
];

@Component({
  selector: 'app-uck-urunler',
  standalone: true,
  imports: [RouterLink, NgClass, FormsModule, BreadcrumbComponent, StatCardComponent, CanWriteDirective, ReadOnlyBannerComponent],
  templateUrl: './uck-urunler.component.html',
  styleUrl: './uck-urunler.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UcKUrunlerComponent implements OnInit {
  ts = inject(TranslationService);
  private route = inject(ActivatedRoute);
  private uckService = inject(UcKService);
  private toast = inject(ToastService);
  private projeService = inject(ProjeService);
  private gridService = inject(GridService);

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
  panelGeriGonderilmeSebebi = signal('');
  panelNot = signal('');
  panelSaving = signal(false);
  panelError = signal('');
  panelUyari = signal('');

  // Dropdown states
  projeler = signal<ProjeDto[]>([]);
  kaynakUrunler = signal<GridUrunDto[]>([]);
  panelKaynakCekiSatiriId = signal<number | null>(null);

  projeSearchTerm = signal('');
  urunSearchTerm = signal('');
  
  isProjeDropdownOpen = signal(false);
  isUrunDropdownOpen = signal(false);

  filteredProjeler = computed(() => {
    const term = this.projeSearchTerm().toLowerCase();
    if (!term) return this.projeler();
    return this.projeler().filter(p => 
      p.projeNo?.toLowerCase().includes(term) || 
      p.musteri?.toLowerCase().includes(term)
    );
  });

  filteredKaynakUrunler = computed(() => {
    const term = this.urunSearchTerm().toLowerCase();
    if (!term) return this.kaynakUrunler();
    return this.kaynakUrunler().filter(u => 
      u.barkodNo?.toLowerCase().includes(term) || 
      u.aciklama?.toLowerCase().includes(term)
    );
  });

  // Stats
  toplamUrun = computed(() => this.urunler().length);
  tamGeldi = computed(() => this.urunler().filter(u => u.ucKKarsilamaTipi === 'Tam Geldi').length);
  eksikGeldi = computed(() => this.urunler().filter(u => u.ucKKarsilamaTipi === 'Eksik Geldi').length);
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
    
    // Projeler dropdown'ı için projeleri çek
    this.projeService.getProjeListesi().subscribe(res => {
      if (res.isSuccess && res.value) {
        this.projeler.set(res.value); // Kendi projemiz dahil tüm projeleri listele
      }
    });

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

  // Grid Durumu Renkleri
  getGridDurumColor(value: string): string {
    const GRID_RENKLERI: Record<string, string> = {
      'Tam Geldi': '#25B003',
      'Eksik Geldi': '#FD5812',
      'Gelmedi': '#FF4023',
      'Trafo Sevk': '#00BCD4',
      'İptal': '#FFB200',
      'Siparişte': '#9C27B0',
    };
    return GRID_RENKLERI[value] || '#64748B';
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
    this.panelKaynakCekiSatiriId.set(null);
    this.panelAciklama.set(urun.ucKAciklama ?? '');
    this.panelGeriGonderilmeSebebi.set(urun.geriGonderilmeSebebi ?? '');
    this.panelNot.set(urun.ucKNotu ?? '');
    this.panelError.set('');
    
    // Eğer önceden girilmiş bir proje varsa, kaynak ürünleri yükle
    if (urun.kaynakHedefProjeNo) {
      const selectedProje = this.projeler().find(p => p.projeNo === urun.kaynakHedefProjeNo);
      if (selectedProje) {
        this.onKaynakProjeChange(selectedProje.id.toString());
      }
    }

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
      case 'Tam Geldi':
      case 'Gelmedi':
        this.panelGelenAdet.set(0); // backend handles it
        this.panelKaynakHedef.set('');
        break;
      case 'Eksik Geldi':
        this.panelGelenAdet.set(u.gelenMiktar > 0 ? u.gelenMiktar : 0);
        this.panelKaynakHedef.set('');
        break;
      case 'Projeden Karşılandı':
        this.panelGelenAdet.set(u.gelenMiktar > 0 ? u.gelenMiktar : u.kalan);
        break;
      case 'Stoktan Karşılandı':
      case 'Tedarikçiden Geldi':
      case 'Hatalı Ürün':
        this.panelGelenAdet.set(0); 
        this.panelKaynakHedef.set('');
        break;
      case 'Geri Gönderildi':
        this.panelGelenAdet.set(u.gelenMiktar > 0 ? u.gelenMiktar : 0);
        this.panelKaynakHedef.set('');
        break;
    }
    this.recalcPanel();
  }

  onKaynakProjeChange(projeIdStr: string) {
    if (!projeIdStr) {
      this.kaynakUrunler.set([]);
      this.panelKaynakCekiSatiriId.set(null);
      return;
    }
    const pId = Number(projeIdStr);
    const proje = this.projeler().find(p => p.id === pId);
    if(proje) {
      this.panelKaynakHedef.set(proje.projeNo);
    }
    
    this.gridService.getUrunler(pId).subscribe(res => {
      if (res.isSuccess && res.value) {
        this.kaynakUrunler.set(res.value);
        this.panelKaynakCekiSatiriId.set(null);
      }
    });
  }

  get selectedKaynakProjeText(): string {
    const pNo = this.panelKaynakHedef();
    if (!pNo) return 'Proje Seçiniz...';
    const p = this.projeler().find(x => x.projeNo === pNo);
    return p ? `${p.projeNo} - ${p.musteri}` : 'Proje Seçiniz...';
  }

  get selectedKaynakUrunText(): string {
    const uId = this.panelKaynakCekiSatiriId();
    if (!uId) return 'Ürün Seçiniz...';
    const u = this.kaynakUrunler().find(x => x.cekiSatiriId === uId);
    if (!u) return 'Ürün Seçiniz...';
    return `${u.siraNo} - ${u.barkodNo} (${u.aciklama}) | Stok: ${u.gelenMiktar}`;
  }

  toggleProjeDropdown() {
    this.isProjeDropdownOpen.set(!this.isProjeDropdownOpen());
    if (this.isProjeDropdownOpen()) this.isUrunDropdownOpen.set(false);
  }

  toggleUrunDropdown() {
    this.isUrunDropdownOpen.set(!this.isUrunDropdownOpen());
    if (this.isUrunDropdownOpen()) this.isProjeDropdownOpen.set(false);
  }

  selectProjeItem(pId: string) {
    this.onKaynakProjeChange(pId);
    this.isProjeDropdownOpen.set(false);
  }

  selectUrunItem(uId: number) {
    this.panelKaynakCekiSatiriId.set(uId);
    this.isUrunDropdownOpen.set(false);
  }

  getProjeIdByNo(projeNo: string): string {
    const p = this.projeler().find(x => x.projeNo === projeNo);
    return p ? p.id.toString() : '';
  }

  recalcPanel() {
    const tip = this.panelTip();
    let uyari = '';
    switch (tip) {
      case 'Tam Geldi': uyari = 'EKSİKSİZ TAM GELDİ'; break;
      case 'Eksik Geldi': uyari = 'EKSİK GELDİ MİKTAR GİRİN'; break;
      case 'Projeden Karşılandı': uyari = 'LÜTFEN BİR PROJE VE ÜRÜN SEÇİNİZ'; break;
      case 'Stoktan Karşılandı': uyari = 'DEPO STOĞUNDAN KARŞILANACAKTIR'; break;
      case 'Tedarikçiden Geldi': uyari = 'TEDARİKÇİDEN DİREKT GELDİ'; break;
      case 'Gelmedi': uyari = 'GELMEDİ OLARAK İŞARETLENECEK'; break;
      case 'Geri Gönderildi': uyari = 'ÜRETİME GERİ GÖNDERİLECEK, GEREKÇE SEÇİN'; break;
      case 'Hatalı Ürün': uyari = 'ÜRÜN HATALI, TUTANAK/NOT GİRİNİZ'; break;
    };
    this.panelUyari.set(uyari || 'BEKLİYOR');
    this.panelError.set('');
  }

  get isGelenAdetAktif(): boolean {
    const t = this.panelTip();
    return t !== 'Tam Geldi' && t !== 'Gelmedi' && t !== 'Geri Gönderildi' && t !== '';
  }

  get isKaynakHedefZorunlu(): boolean {
    const t = this.panelTip();
    return t === 'Projeden Karşılandı';
  }

  get isAciklamaZorunlu(): boolean {
    return this.panelTip() === 'Hatalı Ürün';
  }

  get panelKalan(): number {
    const u = this.panelUrun();
    if (!u) return 0;
    const tip = this.panelTip();
    if (tip === 'Gelmedi' || tip === 'Geri Gönderildi') return u.kalan;
    if (tip === 'Tam Geldi') return 0;

    // Dinamik hesap (Mevcut kalan - bu ekranda girilen adet)
    // HataliUrun kalan'dan düşürülür mü? Normalde "hatalı ürün geldiğinde kalan 0 ASLA yapılmamalı". Ancak dinamik textbox için.
    // Şimdilik kümülatif kalandan düşelim, zaten backend'de Kalan=0 olursa bile HataliMiktar > 0 ise KalanMiktar=1 yapılıyor.
    return Math.max(0, u.kalan - this.panelGelenAdet());
  }

  validatePanel(): string | null {
    const u = this.panelUrun()!;
    const tip = this.panelTip();
    if (!tip) return 'Karşılama tipi seçilmelidir.';

    if (tip === 'Tam Geldi' && u.gridDurumu !== 'Sevk Edildi') {
       return 'Grid tarafından eksiksiz sevk edilmeden "Tam Geldi" olarak işaretlenemez.';
    }

    if (tip === 'Eksik Geldi') {
      if (this.panelGelenAdet() <= 0) return 'Gelen adet girilmelidir.';
      if (this.panelGelenAdet() >= u.istenenAdet) return 'Gelen adet miktardan küçük olmalıdır.';
    }
    if (tip === 'Projeden Karşılandı') {
      if (this.panelGelenAdet() <= 0) return 'Karşılanan adet girilmelidir.';
      if (!this.panelKaynakHedef()) return 'Kaynak proje girilmelidir.';
      if (!this.panelKaynakCekiSatiriId()) return 'Kaynak ürün girilmelidir.';
    }
    if (tip === 'Stoktan Karşılandı' || tip === 'Tedarikçiden Geldi') {
      if (this.panelGelenAdet() <= 0) return 'Gelen adet girilmelidir.';
    }
    if (tip === 'Hatalı Ürün') {
      if (this.panelGelenAdet() <= 0) return 'Gelen adet girilmelidir.';
      if (!this.panelAciklama()) return 'Hatalı ürün açıklaması girilmelidir.';
    }
    if (tip === 'Geri Gönderildi') {
      if (!this.panelGeriGonderilmeSebebi()) return 'Geri gönderilme sebebi seçilmelidir.';
      if (!this.panelAciklama()) return 'Açıklama (opsiyonel/detay) girilebilir ama sebep zorunludur.'; // Actually requirement said "Aciklama" as GeriGonderilmeSebebi back in step 1, but we added a dedicated one. Wait, in backend request.Aciklama is mapped to GeriGonderilmeSebebi if not mapped correctly? Ah I added GeriGonderilmeSebebi to the DTO.
    }
    if (tip === 'Geri Gönderildi' && !this.panelGeriGonderilmeSebebi()) return 'Geri gönderilme sebebi seçilmelidir.';

    if (this.panelGelenAdet() > u.kalan && tip !== 'Tam Geldi') return 'Gelen adet kalandan büyük olamaz.';
    if (this.panelGelenAdet() + u.gelenMiktar + (u.karsilananMiktar || 0) > u.istenenAdet && tip !== 'Tam Geldi')
      return 'Toplam tamamlanan adet, çeki miktarını aşamaz.';

    return null;
  }

  savePanel() {
    const err = this.validatePanel();
    if (err) { this.panelError.set(err); return; }

    const u = this.panelUrun()!;
    const tip = this.panelTip();
    this.panelSaving.set(true);
    this.panelError.set('');

    const dto: UcKDurumGuncelleDto = {
      cekiSatiriId: u.cekiSatiriId,
      projeId: this.projeId(),
      karsilamaTipi: tip,
      gelenAdet: this.isGelenAdetAktif ? this.panelGelenAdet() : undefined,
      kaynakHedefProjeNo: this.isKaynakHedefZorunlu ? this.panelKaynakHedef() : undefined,
      kaynakCekiSatiriId: this.panelKaynakCekiSatiriId() || undefined,
      aciklama: this.panelAciklama() || undefined,
      geriGonderilmeSebebi: this.panelGeriGonderilmeSebebi() || undefined,
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
