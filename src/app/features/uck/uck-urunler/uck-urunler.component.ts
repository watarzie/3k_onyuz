import { Component, inject, signal, computed, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { TranslationService } from '../../../core/services/translation.service';
import { ToastService } from '../../../core/services/toast.service';
import { UcKService } from '../../../core/services/uck.service';
import { ProjeService } from '../../../core/services/proje.service';
import { GridService } from '../../../core/services/grid.service';
import { StokService } from '../../../core/services/stok.service';

import { BreadcrumbComponent } from '../../../shared/components/breadcrumb/breadcrumb.component';
import { StatCardComponent } from '../../../shared/components/stat-card/stat-card.component';
import { CanWriteDirective } from '../../../shared/directives/can-write.directive';
import { ReadOnlyBannerComponent } from '../../../shared/components/readonly-banner/readonly-banner.component';
import { UcKUrunDto, UcKDurumGuncelleDto, TopluTamGeldiDto, ProjeDto, GridUrunDto, StokKaydiDto } from '../../../shared/models/index';
import { UcKDurum, GridSevkDurum, GridDurum } from '../../../core/constants/enums';

interface KarsilamaTipi { id: number; value: string; label: string; color: string; bgClass: string; }

const KARSILAMA_TIPLERI: KarsilamaTipi[] = [
  { id: UcKDurum.TamGeldi, value: 'Tam Geldi', label: 'TAM GELDİ', color: '#25B003', bgClass: 'row-tam-geldi' },
  { id: UcKDurum.EksikGeldi, value: 'Eksik Geldi', label: 'EKSİK GELDİ', color: '#FD5812', bgClass: 'row-eksik-geldi' },
  { id: UcKDurum.ProjedenKarsilandi, value: 'Projeden Karşılandı', label: 'PROJEDEN KARŞILANDI', color: '#3584FC', bgClass: 'row-projeden' },
  { id: UcKDurum.StoktanKarsilandi, value: 'Stoktan Karşılandı', label: 'STOKTAN KARŞILANDI', color: '#9C27B0', bgClass: 'row-stoktan' },
  { id: UcKDurum.TedarikcidenGeldi, value: 'Tedarikçiden Geldi', label: 'TEDARİKÇİDEN GELDİ', color: '#1B7D3A', bgClass: 'row-tedarikci' },
  { id: UcKDurum.Gelmedi, value: 'Gelmedi', label: 'GELMEDİ', color: '#808080', bgClass: 'row-gelmedi' },
  { id: UcKDurum.GeriGonderildi, value: 'Geri Gönderildi', label: 'GERİ GÖNDERİLDİ', color: '#D32F2F', bgClass: 'row-geri-gonderildi' },
  { id: UcKDurum.HataliUrun, value: 'Hatalı Ürün', label: 'HATALI ÜRÜN GELDİ', color: '#E65100', bgClass: 'row-hatali' },
];

import { OnayService } from '../../../core/services/onay.service';

@Component({
  selector: 'app-uck-urunler',
  standalone: true,
  imports: [RouterLink, NgClass, FormsModule, BreadcrumbComponent, StatCardComponent, CanWriteDirective, ReadOnlyBannerComponent],
  templateUrl: './uck-urunler.component.html',
  styleUrl: './uck-urunler.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UcKUrunlerComponent implements OnInit, OnDestroy {
  ts = inject(TranslationService);
  private route = inject(ActivatedRoute);
  private uckService = inject(UcKService);
  private toast = inject(ToastService);
  private projeService = inject(ProjeService);
  private gridService = inject(GridService);
  private stokService = inject(StokService);
  private onayService = inject(OnayService);

  private sub: Subscription = new Subscription();

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
  panelSaving = signal(false);
  panelError = signal('');
  panelUyari = signal('');

  // Checkbox + Toplu TamGeldi
  selectedIds = signal<Set<number>>(new Set());
  showTopluModal = signal(false);
  topluAciklama = signal('');
  topluSaving = signal(false);



  // Proje ve Kaynak Ürün Dropdown State
  projeler = signal<ProjeDto[]>([]);
  kaynakUrunler = signal<GridUrunDto[]>([]);

  isProjeDropdownOpen = signal(false);
  isUrunDropdownOpen = signal(false);

  projeSearchTerm = signal('');
  urunSearchTerm = signal('');
  panelKaynakCekiSatiriId = signal<number | null>(null);

  // Stok Dropdown State
  stoklar = signal<StokKaydiDto[]>([]);
  isStokDropdownOpen = signal(false);
  stokSearchTerm = signal('');
  panelStokKaydiId = signal<number | null>(null);

  filteredProjeler = computed(() => {
    const term = this.projeSearchTerm().toLowerCase();
    const currentId = this.projeId();
    // Kendi projesi hariç — bir proje kendisinden ürün karşılayamaz
    let list = this.projeler().filter(p => p.id !== currentId);
    if (term) {
      list = list.filter(p =>
        p.projeNo?.toLowerCase().includes(term) ||
        p.musteri?.toLowerCase().includes(term)
      );
    }
    return list;
  });

  filteredKaynakUrunler = computed(() => {
    const term = this.urunSearchTerm().toLowerCase();
    const list = this.kaynakUrunler();
    if (!term) return list;
    return list.filter(u =>
      u.barkodNo.toLowerCase().includes(term) ||
      u.aciklama.toLowerCase().includes(term)
    );
  });

  filteredStoklar = computed(() => {
    const term = this.stokSearchTerm().toLowerCase();
    const list = this.stoklar();
    if (!term) return list;
    return list.filter(s =>
      (s.malzemeAdi && s.malzemeAdi.toLowerCase().includes(term)) ||
      (s.malzemeKodu && s.malzemeKodu.toLowerCase().includes(term)) ||
      (s.kaynakProje && s.kaynakProje.toLowerCase().includes(term))
    );
  });

  // Stats
  toplamUrun = computed(() => this.urunler().length);
  tamGeldi = computed(() => this.urunler().filter(u => u.ucKKarsilamaTipiMetni === 'Tam Geldi').length);
  eksikGeldi = computed(() => this.urunler().filter(u => u.ucKKarsilamaTipiMetni === 'Eksik Geldi').length);
  tamamlanan = computed(() => this.urunler().filter(u => u.kalan === 0 && u.ucKKarsilamaTipiMetni !== 'Bekliyor').length);
  kalanlar = computed(() => this.urunler().filter(u => u.kalan > 0).length);
  get hasSelection(): boolean { return this.selectedIds().size > 0; }
  get selectionCount(): number { return this.selectedIds().size; }

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

    // Stok cross-tab update dinleyicisi
    this.sub.add(
      this.stokService.stokListesiGuncellendi$.subscribe(() => {
        this.loadStokDropdownList();
      })
    );

    // Grid ve 3K çapraz-sekme ürün güncelleme dinleyicileri
    this.sub.add(
      this.gridService.gridGuncellendi$.subscribe(() => {
        this.loadUrunler();
      })
    );
    this.sub.add(
      this.uckService.uckGuncellendi$.subscribe(() => {
        this.loadUrunler();
      })
    );

    // Projeler dropdown'ı için projeleri çek
    this.projeService.getProjeListesi().subscribe(res => {
      if (res.isSuccess && res.value) {
        this.projeler.set(res.value);
      }
    });

    // Stok dropdown'u için stokları çek
    this.loadStokDropdownList();

    this.loadUrunler();
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
  }

  loadStokDropdownList() {
    // 3K Dropdown'u için büyük bir sayfa boyutu ile aktif stokları çek
    this.stokService.getStokListesi(undefined, 1, 10000).subscribe((res: any) => {
      if (res.isSuccess && res.value) {
        // value is PaginatedList due to recent changes
        const m = res.value.items || res.value;
        this.stoklar.set(m.filter((s: StokKaydiDto) => s.miktar > 0 && s.durumMetni === 'Aktif'));
      }
    });
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
    if (tip) list = list.filter(u => u.ucKKarsilamaTipiMetni === tip);
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
    return KARSILAMA_TIPLERI.find(t => t.value === u.ucKKarsilamaTipiMetni)?.bgClass ?? '';
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
    this.panelTip.set(urun.ucKKarsilamaTipiMetni === 'Bekliyor' ? '' : urun.ucKKarsilamaTipiMetni);
    this.panelGelenAdet.set(urun.gelenMiktar);
    this.panelKaynakHedef.set(urun.kaynakHedefProjeNo ?? '');
    this.panelKaynakCekiSatiriId.set(null);
    this.panelAciklama.set(urun.ucKAciklama ?? '');
    this.panelGeriGonderilmeSebebi.set(urun.geriGonderilmeSebebiMetni ?? '');
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
    if (proje) {
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

  toggleStokDropdown() {
    this.isStokDropdownOpen.set(!this.isStokDropdownOpen());
    if (this.isStokDropdownOpen()) {
      this.isProjeDropdownOpen.set(false);
      this.isUrunDropdownOpen.set(false);
    }
  }

  selectStokItem(stokId: number) {
    this.panelStokKaydiId.set(stokId);
    this.isStokDropdownOpen.set(false);
  }

  get selectedStokText(): string {
    const sId = this.panelStokKaydiId();
    if (!sId) return 'Stok Arayın veya Seçiniz...';
    const s = this.stoklar().find(x => x.id === sId);
    if (!s) return 'Stok Arayın veya Seçiniz...';
    return `${s.malzemeAdi} (Projeden Kalan: ${s.kaynakProje}) | Bakiye: ${s.miktar} ${s.birim}`;
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

  isKarsilamaTipiDisabled(tip: string): boolean {
    const u = this.panelUrun();
    if (!u) return false;

    // Grid İptal → tüm seçenekler kapalı
    if (u.gridDurumuId === GridDurum.Iptal) return true;

    // Grid Trafo Sevk → tüm seçenekler kapalı
    if (u.gridDurumuId === GridDurum.TrafoSevk) return true;

    // Grid Gelmedi → yalnızca Projeden/Stoktan/Tedarikçi açık
    if (u.gridDurumuId === GridDurum.Gelmedi) {
      return tip !== 'Projeden Karşılandı' && tip !== 'Stoktan Karşılandı' && tip !== 'Tedarikçiden Geldi';
    }

    // Hatalı Ürün → Grid sevk edilmiş olmalı
    if (tip === 'Hatalı Ürün' && u.gridSevkDurumuId !== GridSevkDurum.SevkEdildi) return true;

    // Tam Geldi → Grid sevk edilmiş olmalı
    if (tip === 'Tam Geldi' && u.gridSevkDurumuId !== GridSevkDurum.SevkEdildi) return true;

    // Projeden/Stoktan/Tedarikçi → Grid eksik gelmiş veya gelmemiş olmalı
    if (tip === 'Tedarikçiden Geldi' || tip === 'Stoktan Karşılandı' || tip === 'Projeden Karşılandı') {
      return u.gridDurumuMetni !== 'Eksik Geldi' && u.gridDurumuMetni !== 'Gelmedi';
    }

    return false;
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

    // Grid İptal blokajı
    if (u.gridDurumuId === GridDurum.Iptal) return 'Bu ürün Grid tarafından iptal edildiği için işlem yapılamaz.';

    // Grid Trafo Sevk blokajı
    if (u.gridDurumuId === GridDurum.TrafoSevk) return 'Bu ürün Grid tarafından Trafo Sevk olarak işaretlendiğinden 3K işlemi yapılamaz.';

    // Grid Gelmedi → sadece Projeden/Stoktan/Tedarikçi
    if (u.gridDurumuId === GridDurum.Gelmedi) {
      if (tip !== 'Projeden Karşılandı' && tip !== 'Stoktan Karşılandı' && tip !== 'Tedarikçiden Geldi') {
        return 'Grid "Gelmedi" durumunda yalnızca Projeden, Stoktan veya Tedarikçiden karşılama yapılabilir.';
      }
    }

    // Tam Geldi → Grid sevk edilmiş olmalı
    if (tip === 'Tam Geldi' && u.gridSevkDurumuId !== GridSevkDurum.SevkEdildi) {
      return 'Grid tarafından eksiksiz sevk edilmeden "Tam Geldi" olarak işaretlenemez.';
    }

    // Hatalı Ürün → Grid sevk edilmiş olmalı
    if (tip === 'Hatalı Ürün' && u.gridSevkDurumuId !== GridSevkDurum.SevkEdildi) {
      return 'Grid tarafından sevk edilmeden "Hatalı Ürün" işaretlenemez.';
    }

    if (tip === 'Tedarikçiden Geldi' || tip === 'Stoktan Karşılandı' || tip === 'Projeden Karşılandı') {
      if (u.gridDurumuMetni !== 'Eksik Geldi' && u.gridDurumuMetni !== 'Gelmedi') {
        return 'Bu işlem yalnızca ürün Grid tarafında eksik geldiğinde veya hiç gelmediğinde (GELMEDİ) yapılabilir.';
      }
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
    if (tip === 'Stoktan Karşılandı') {
      if (this.panelGelenAdet() <= 0) return 'Gelen adet girilmelidir.';
      if (!this.panelStokKaydiId()) return 'Kullanılacak stok seçilmelidir (Malzeme Adı veya Barkod arayın).';

      const s = this.stoklar().find(x => x.id === this.panelStokKaydiId());
      if (s) {
        const normalizeStr = (str: string) => {
          if (!str) return '';
          return str.replace(/[^\p{L}0-9\s]/gu, '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('tr-TR');
        };
        if (normalizeStr(s.malzemeAdi) !== normalizeStr(u.aciklama)) {
          return `Seçilen stok adı (${s.malzemeAdi}) ile proje ürün adı (${u.aciklama}) eşleşmelidir!`;
        }
        if (this.panelGelenAdet() > s.miktar) {
          return `Seçtiğiniz stokta yeterli miktar yok. (Stokta: ${s.miktar})`;
        }
      }
    }
    if (tip === 'Tedarikçiden Geldi') {
      if (this.panelGelenAdet() <= 0) return 'Gelen adet girilmelidir.';
    }
    if (tip === 'Hatalı Ürün') {
      if (this.panelGelenAdet() <= 0) return 'Gelen adet girilmelidir.';
      if (!this.panelAciklama()) return 'Hatalı ürün açıklaması girilmelidir.';
    }
    if (tip === 'Geri Gönderildi') {
      if (!this.panelGeriGonderilmeSebebi()) return 'Geri gönderilme sebebi seçilmelidir.';
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

    const _aciklama = tip === 'Geri Gönderildi' ? this.panelGeriGonderilmeSebebi() : this.panelAciklama();
    const dto: UcKDurumGuncelleDto = {
      cekiSatiriId: u.cekiSatiriId,
      projeId: this.projeId(),
      karsilamaTipiId: KARSILAMA_TIPLERI.find(t => t.value === tip)?.id ?? 0,
      gelenAdet: this.panelGelenAdet(),
      kaynakHedefProjeNo: this.panelKaynakHedef()?.trim(),
      kaynakCekiSatiriId: this.panelKaynakCekiSatiriId() || undefined,
      stokKaydiId: this.panelStokKaydiId() || undefined,
      aciklama: _aciklama ? _aciklama.trim() : '',
      urunAdi: u.aciklama || u.barkodNo,
      mevcutProjeNo: this.projeler().find(p => p.id === this.projeId())?.projeNo || this.projeId().toString(),
      mevcutSandikNo: u.sandikNo || this.sandikNo(),
      kaynakUrunAdi: this.panelTip() === 'Projeden Karşılandı' && this.panelKaynakCekiSatiriId() ?
        this.kaynakUrunler().find(cu => cu.cekiSatiriId === this.panelKaynakCekiSatiriId())?.aciklama : undefined
    };

    this.uckService.durumGuncelle(dto).subscribe({
      next: (res) => {
        this.panelSaving.set(false);
        if (res.isSuccess) {
          // Some backend APIs wrap the 202 inside the returned JSON object body
          const returnedStatus = (res.value as any)?.statusCode;
          if (res.statusCode === 202 || returnedStatus === 202) {
            this.toast.info('İşleminiz yetkili onayına sunulmuştur.');
            // Header'a anlık bildir
            this.onayService.notifyHeaderForNewApproval();
          } else {
            this.toast.success('3K durumu başarıyla güncellendi.');
          }
          this.uckService.notifyUckUpdated();
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

  // ===== Checkbox Selection =====
  toggleSelect(id: number) {
    const s = new Set(this.selectedIds());
    s.has(id) ? s.delete(id) : s.add(id);
    this.selectedIds.set(s);
  }
  toggleSelectAll() {
    if (this.selectedIds().size === this.filtered().length) {
      this.selectedIds.set(new Set());
    } else {
      this.selectedIds.set(new Set(this.filtered().map(u => u.cekiSatiriId)));
    }
  }
  isSelected(id: number): boolean { return this.selectedIds().has(id); }
  get allSelected(): boolean { return this.filtered().length > 0 && this.selectedIds().size === this.filtered().length; }

  // ===== Toplu Tam Geldi Modal =====
  openTopluTamGeldi() {
    this.topluAciklama.set('');
    this.showTopluModal.set(true);
  }
  closeTopluTamGeldi() { this.showTopluModal.set(false); }

  confirmTopluTamGeldi() {
    this.topluSaving.set(true);
    const dto: TopluTamGeldiDto = {
      projeId: this.projeId(),
      cekiSatiriIdler: Array.from(this.selectedIds()),
      aciklama: this.topluAciklama() || undefined,
    };
    this.uckService.topluTamGeldi(dto).subscribe({
      next: (res) => {
        this.topluSaving.set(false);
        if (res.isSuccess) {
          this.toast.success(`${dto.cekiSatiriIdler.length} ürün Tam Geldi olarak işaretlendi.`);
          this.uckService.notifyUckUpdated();
          this.closeTopluTamGeldi();
          this.selectedIds.set(new Set());
          this.loadUrunler();
        } else {
          this.toast.error(res.error ?? 'Toplu güncelleme başarısız.');
        }
      },
      error: () => {
        this.topluSaving.set(false);
        this.toast.error('Sunucu ile iletişim kurulamadı.');
      },
    });
  }

  // ===== Toplu TamGeldi için [disabled] mantığı =====
  isTopluTamGeldiDisabled(u: UcKUrunDto): boolean {
    // Grid İptal veya TrafoSevk → seçilemez
    if (u.gridDurumuId === GridDurum.Iptal || u.gridDurumuId === GridDurum.TrafoSevk) return true;
    // Grid henüz sevk etmediyse → seçilemez
    if (u.gridSevkDurumuId !== GridSevkDurum.SevkEdildi) return true;
    // Zaten TamGeldi → seçilemez
    if (u.ucKKarsilamaTipiId === UcKDurum.TamGeldi) return true;
    return false;
  }
}
