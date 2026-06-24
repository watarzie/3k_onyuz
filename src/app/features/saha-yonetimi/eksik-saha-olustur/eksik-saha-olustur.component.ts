import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { BreadcrumbComponent } from '../../../shared/components/breadcrumb/breadcrumb.component';
import { ProjeService } from '../../../core/services/proje.service';
import { SandikService } from '../../../core/services/sandik.service';
import { ToastService } from '../../../core/services/toast.service';
import { EksikUrunForSandikDto, ProjeDropdownDto, SandikDto } from '../../../shared/models';

interface SepetUrun extends EksikUrunForSandikDto {
  draftId: string;
  miktar: number;
  not?: string | null;
}

interface SepetSandik {
  id: string;
  hedefSandikId?: number | null;
  isExisting?: boolean;
  existingUrunSayisi?: number;
  durumMetni?: string;
  sandikNo: string;
  sandikIsmi: string;
  en: number | null;
  boy: number | null;
  yukseklik: number | null;
  netKg: number | null;
  grossKg: number | null;
  urunler: SepetUrun[];
}

@Component({
  selector: 'app-eksik-saha-olustur',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, BreadcrumbComponent],
  templateUrl: './eksik-saha-olustur.component.html',
  styleUrl: './eksik-saha-olustur.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EksikSahaOlusturComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private projeService = inject(ProjeService);
  private sandikService = inject(SandikService);
  private toast = inject(ToastService);

  kaynakProjeId = signal(0);
  kaynakProjeNo = signal('');
  yeniProjeNo = signal('');
  aciklama = signal('');
  searchTerm = signal('');
  projeAramaTerm = signal('');
  loading = signal(true);
  loadingProjeler = signal(false);
  saving = signal(false);
  selectedUrunId = signal<number | null>(null);
  selectedUrunMiktar = signal(0);
  projeSecimiId = signal<number | null>(null);
  projeDropdownOpen = signal(false);
  hedefTipi = signal<'new' | 'existing'>('new');
  hedefSahaProjeId = signal<number | null>(null);
  hedefSahaProjeLoading = signal(false);
  hedefSahaProjeSearchTerm = signal('');
  hedefSahaDropdownOpen = signal(false);

  kaynakProjeler = signal<ProjeDropdownDto[]>([]);
  hedefSahaProjeleri = signal<ProjeDropdownDto[]>([]);
  hedefSahaSandiklari = signal<SandikDto[]>([]);
  selectedProjeIds = signal<number[]>([]);
  aktifKaynakProjeId = signal<number | null>(null);
  eksikUrunler = signal<EksikUrunForSandikDto[]>([]);
  sandiklar = signal<SepetSandik[]>([]);
  private lastDefaultProjeNo = '';
  private kaynakProjeSearchTimer?: ReturnType<typeof setTimeout>;
  private hedefSahaSearchTimer?: ReturnType<typeof setTimeout>;
  private kaynakProjeSearchRequest = 0;
  private hedefSahaSearchRequest = 0;

  breadcrumb = [
    { label: 'Ana Kontrol Paneli', link: '/dashboard' },
    { label: 'Projeler', link: '/projeler' },
    { label: 'Eksik Saha Projesi' },
  ];

  filteredUrunler = computed(() => {
    const term = this.searchTerm().trim().toLocaleLowerCase('tr-TR');
    const aktifProjeId = this.aktifKaynakProjeId();
    return this.eksikUrunler()
      .filter(u => this.getKalanAdet(u.cekiSatiriId) > 0)
      .filter(u => !aktifProjeId || u.projeId === aktifProjeId)
      .filter(u => {
        if (!term) return true;
        return [
          u.siraNo.toString(),
          u.projeNo,
          u.barkodNo,
          u.aciklama,
          u.sandikNo,
        ].some(value => (value ?? '').toLocaleLowerCase('tr-TR').includes(term));
      });
  });

  seciliKaynakProjeler = computed(() => {
    const selected = new Set(this.selectedProjeIds());
    return this.kaynakProjeler().filter(p => selected.has(p.id));
  });

  secilebilirKaynakProjeler = computed(() => {
    const selected = new Set(this.selectedProjeIds());
    return this.kaynakProjeler().filter(p => !selected.has(p.id));
  });

  filteredSecilebilirKaynakProjeler = computed(() => {
    const term = this.projeAramaTerm().trim().toLocaleLowerCase('tr-TR');
    const seciliId = this.projeSecimiId();
    return this.secilebilirKaynakProjeler().filter(p => {
      if (p.id === seciliId) return true;
      if (!term) return true;
      return [
        p.projeNo,
        p.musteri,
        p.lokasyon,
      ].some(value => (value ?? '').toLocaleLowerCase('tr-TR').includes(term));
    });
  });

  filteredHedefSahaProjeleri = computed(() => {
    const term = this.hedefSahaProjeSearchTerm().trim().toLocaleLowerCase('tr-TR');
    const list = this.hedefSahaProjeleri();
    if (!term) return list;

    return list.filter(p => [
      p.projeNo,
      p.musteri,
    ].some(value => (value ?? '').toLocaleLowerCase('tr-TR').includes(term)));
  });

  seciliHedefSahaProje = computed(() => {
    const id = this.hedefSahaProjeId();
    return id ? this.hedefSahaProjeleri().find(p => p.id === id) ?? null : null;
  });

  toplamEksikAdet = computed(() => this.eksikUrunler().reduce((sum, u) => sum + u.kalanMiktar, 0));
  toplamSepetAdet = computed(() =>
    this.sandiklar().reduce((sum, sandik) => sum + sandik.urunler.reduce((s, u) => s + u.miktar, 0), 0)
  );
  toplamSepetSatir = computed(() =>
    this.sandiklar().reduce((sum, sandik) => sum + sandik.urunler.length, 0)
  );
  toplamKalanAdet = computed(() => Math.max(this.toplamEksikAdet() - this.toplamSepetAdet(), 0));
  selectedUrun = computed(() => {
    const selectedId = this.selectedUrunId();
    return this.eksikUrunler().find(u => u.cekiSatiriId === selectedId) ?? null;
  });

  ngOnInit(): void {
    const projeId = Number(this.route.snapshot.paramMap.get('projeId'));
    if (Number.isFinite(projeId) && projeId > 0) {
      this.kaynakProjeId.set(projeId);
      this.selectedProjeIds.set([projeId]);
    }
    this.addSandik();
    this.loadKaynakProjeler();
  }

  @HostListener('document:click')
  closeProjectDropdownFromOutside(): void {
    this.closeProjeDropdown();
    this.closeHedefSahaDropdown();
  }

  loadKaynakProjeler(): void {
    this.loadKaynakProjeOptions(this.projeAramaTerm(), true);
  }

  onKaynakProjeSearchChange(value: string): void {
    this.projeAramaTerm.set(value);
    if (this.kaynakProjeSearchTimer) {
      clearTimeout(this.kaynakProjeSearchTimer);
    }

    this.kaynakProjeSearchTimer = setTimeout(() => this.loadKaynakProjeOptions(value), 250);
  }

  onHedefSahaProjeSearchChange(value: string): void {
    this.hedefSahaProjeSearchTerm.set(value);
    if (this.hedefSahaSearchTimer) {
      clearTimeout(this.hedefSahaSearchTimer);
    }

    this.hedefSahaSearchTimer = setTimeout(() => this.loadHedefSahaProjeleri(value), 250);
  }

  private loadKaynakProjeOptions(searchTerm = this.projeAramaTerm(), refreshEksikler = false): void {
    const requestId = ++this.kaynakProjeSearchRequest;
    this.loadingProjeler.set(true);
    this.projeService.getProjeDropdownListesi({
      projeTipiId: 1,
      searchTerm,
      take: 50,
      includeIds: this.selectedProjeIds(),
    }).subscribe({
      next: res => {
        if (requestId !== this.kaynakProjeSearchRequest) return;

        if (res.isSuccess && res.value) {
          this.kaynakProjeler.set(res.value ?? []);
          this.refreshKaynakProjeNo();
          this.updateDefaultProjeNo();
          if (refreshEksikler) {
            this.loadEksikler();
          }
        } else {
          this.loading.set(false);
          this.toast.error(res.error || 'Kaynak projeler yüklenemedi.');
        }
        this.loadingProjeler.set(false);
      },
      error: () => {
        if (requestId !== this.kaynakProjeSearchRequest) return;

        this.loadingProjeler.set(false);
        this.loading.set(false);
        this.toast.error('Sunucu hatası oluştu.');
      }
    });
  }

  loadEksikler(): void {
    const projeIds = this.selectedProjeIds();
    const aktifProjeId = this.aktifKaynakProjeId();
    this.refreshKaynakProjeNo();
    this.updateDefaultProjeNo();

    if (projeIds.length === 0) {
      this.loading.set(false);
      this.aktifKaynakProjeId.set(null);
      this.eksikUrunler.set([]);
      return;
    }

    if (aktifProjeId && !projeIds.includes(aktifProjeId)) {
      this.aktifKaynakProjeId.set(null);
    }

    this.loading.set(true);
    forkJoin(projeIds.map(projeId => this.sandikService.getEksikUrunlerByProje(projeId))).subscribe({
      next: responses => {
        this.loading.set(false);
        const errors = responses.filter(res => !res.isSuccess).map(res => res.error).filter(Boolean);
        const urunler = responses.flatMap(res => res.isSuccess && res.value ? res.value : []);
        this.eksikUrunler.set(urunler);

        if (errors.length > 0) {
          this.toast.warning(errors[0] || 'Bazı projelerin eksikleri yüklenemedi.');
        }
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Sunucu hatası oluştu.');
      }
    });
  }

  addSeciliProje(): void {
    const projeId = Number(this.projeSecimiId());
    if (!Number.isFinite(projeId) || projeId <= 0) {
      this.toast.warning('Kaynak proje seçilmelidir.');
      return;
    }

    if (this.selectedProjeIds().includes(projeId)) {
      this.toast.warning('Bu proje zaten kaynak listesinde.');
      return;
    }

    this.selectedProjeIds.update(ids => [...ids, projeId]);
    this.projeSecimiId.set(null);
    this.projeAramaTerm.set('');
    this.closeProjeDropdown();
    this.loadKaynakProjeOptions('', true);
  }

  toggleProjeDropdown(): void {
    if (this.loadingProjeler()) return;
    const nextOpen = !this.projeDropdownOpen();
    this.projeDropdownOpen.set(nextOpen);
    if (nextOpen) {
      this.loadKaynakProjeOptions(this.projeAramaTerm());
    }
  }

  closeProjeDropdown(): void {
    this.projeDropdownOpen.set(false);
  }

  selectProje(projeId: number): void {
    this.projeSecimiId.set(projeId);
    this.projeAramaTerm.set('');
    this.closeProjeDropdown();
  }

  selectedProjeLabel(): string {
    const selectedId = this.projeSecimiId();
    const proje = this.kaynakProjeler().find(p => p.id === selectedId);
    return proje ? `${proje.projeNo} - ${proje.musteri || '-'}` : 'Proje seçin';
  }

  setHedefTipi(tip: 'new' | 'existing'): void {
    this.hedefTipi.set(tip);

    if (tip === 'new') {
      this.hedefSahaProjeId.set(null);
      this.hedefSahaSandiklari.set([]);
      this.hedefSahaProjeSearchTerm.set('');
      this.closeHedefSahaDropdown();
      this.sandiklar.update(list => {
        const taslakSandiklar = list.filter(s => !s.isExisting);
        return taslakSandiklar.length > 0 ? taslakSandiklar : [this.createEmptySandik('1')];
      });
      this.updateDefaultProjeNo();
      return;
    }

    this.yeniProjeNo.set('');
    this.closeHedefSahaDropdown();
    if (this.hedefSahaProjeleri().length === 0) {
      this.loadHedefSahaProjeleri();
    }
  }

  toggleHedefSahaDropdown(): void {
    if (this.hedefSahaProjeLoading()) return;
    const nextOpen = !this.hedefSahaDropdownOpen();
    this.hedefSahaDropdownOpen.set(nextOpen);
    if (nextOpen) {
      this.loadHedefSahaProjeleri(this.hedefSahaProjeSearchTerm());
    }
  }

  closeHedefSahaDropdown(): void {
    this.hedefSahaDropdownOpen.set(false);
  }

  selectHedefSahaProje(proje: ProjeDropdownDto): void {
    if (this.hedefSahaProjeId() && this.hedefSahaProjeId() !== proje.id) {
      const mevcutSandikUrunuVar = this.sandiklar().some(s => s.isExisting && s.urunler.length > 0);
      if (mevcutSandikUrunuVar) {
        this.toast.warning('Mevcut saha sandıklarına eklenmiş ürün var. Hedef projeyi değiştirmeden önce bu ürünleri sepetten kaldırın.');
        return;
      }
    }

    this.hedefSahaProjeId.set(proje.id);
    this.hedefSahaProjeSearchTerm.set('');
    this.closeHedefSahaDropdown();
    this.loadHedefSahaSandiklari(proje.id);
  }

  selectedHedefSahaLabel(): string {
    const proje = this.seciliHedefSahaProje();
    return proje ? `${proje.projeNo} - ${proje.musteri || '-'}` : 'Saha projesi seçin';
  }

  filterByKaynakProje(projeId: number): void {
    this.aktifKaynakProjeId.update(aktifId => aktifId === projeId ? null : projeId);
  }

  removeKaynakProje(projeId: number): void {
    const kullanilanUrunVar = this.sandiklar()
      .flatMap(s => s.urunler)
      .some(u => u.projeId === projeId);

    if (kullanilanUrunVar) {
      this.toast.warning('Bu projeden sepete alınmış ürün var. Önce sepetten kaldırın.');
      return;
    }

    const kalanProjeIds = this.selectedProjeIds().filter(id => id !== projeId);
    this.selectedProjeIds.set(kalanProjeIds);
    if (this.aktifKaynakProjeId() === projeId) {
      this.aktifKaynakProjeId.set(null);
    }
    this.loadKaynakProjeOptions(this.projeAramaTerm(), true);
  }

  addSandik(): void {
    this.sandiklar.update(list => [...list, this.createEmptySandik()]);
  }

  removeSandik(sandikId: string): void {
    const sandik = this.sandiklar().find(s => s.id === sandikId);
    if (sandik?.isExisting) {
      this.toast.info('Mevcut saha sandığı bu ekrandan silinemez.');
      return;
    }

    if (this.sandiklar().length === 1) {
      this.toast.warning('En az bir sandık kalmalıdır.');
      return;
    }
    this.sandiklar.update(list => list.filter(s => s.id !== sandikId));
  }

  updateSandikNo(sandikId: string, value: string): void {
    this.sandiklar.update(list => list.map(s => s.id === sandikId && !s.isExisting ? { ...s, sandikNo: value } : s));
  }

  updateSandikIsmi(sandikId: string, value: string): void {
    this.sandiklar.update(list => list.map(s => s.id === sandikId && !s.isExisting ? { ...s, sandikIsmi: value } : s));
  }

  updateSandikOlcu(sandikId: string, field: 'en' | 'boy' | 'yukseklik' | 'netKg' | 'grossKg', value: number | string | null): void {
    this.sandiklar.update(list => list.map(s => {
      if (s.id !== sandikId || s.isExisting) return s;
      return { ...s, [field]: this.toNullablePositiveNumber(value) };
    }));
  }

  openSandikSecimi(urun: EksikUrunForSandikDto): void {
    const kalan = this.getKalanAdet(urun.cekiSatiriId);
    if (kalan <= 0) {
      this.toast.warning('Bu ürünün tüm kalan adedi sepete alındı.');
      return;
    }

    this.selectedUrunId.set(urun.cekiSatiriId);
    this.selectedUrunMiktar.set(kalan);
  }

  closeSandikSecimi(): void {
    this.selectedUrunId.set(null);
    this.selectedUrunMiktar.set(0);
  }

  setSelectedUrunMiktar(value: number | string): void {
    const urun = this.selectedUrun();
    if (!urun) {
      this.selectedUrunMiktar.set(0);
      return;
    }

    const numericValue = typeof value === 'string'
      ? Number(value.replace(',', '.'))
      : Number(value);

    if (!Number.isFinite(numericValue)) {
      return;
    }

    const kalan = this.getKalanAdet(urun.cekiSatiriId);
    this.selectedUrunMiktar.set(Math.min(Math.max(numericValue, 0), kalan));
  }

  addUrunToSandik(cekiSatiriId: number, sandikId: string, miktar: number): void {
    const urun = this.eksikUrunler().find(u => u.cekiSatiriId === cekiSatiriId);
    if (!urun) return;

    const kalan = this.getKalanAdet(cekiSatiriId);
    const numericMiktar = Number(miktar);
    const eklenecekMiktar = Number.isFinite(numericMiktar)
      ? Math.min(Math.max(numericMiktar, 0), kalan)
      : 0;

    if (kalan <= 0) {
      this.toast.warning('Bu ürünün tüm kalan adedi sepete alındı.');
      return;
    }

    if (eklenecekMiktar <= 0) {
      this.toast.warning('Eklenecek adet 0\'dan büyük olmalı.');
      return;
    }

    this.sandiklar.update(list => list.map(sandik => {
      if (sandik.id !== sandikId) return sandik;

      const mevcut = sandik.urunler.find(u => u.cekiSatiriId === cekiSatiriId);
      if (mevcut) {
        return {
          ...sandik,
          urunler: sandik.urunler.map(u =>
            u.draftId === mevcut.draftId ? { ...u, miktar: u.miktar + eklenecekMiktar } : u
          )
        };
      }

      return {
        ...sandik,
        urunler: [
          ...sandik.urunler,
          {
            ...urun,
            draftId: this.createDraftId(),
            miktar: eklenecekMiktar,
            not: null,
          }
        ]
      };
    }));
  }

  addSelectedUrunToSandik(sandikId: string): void {
    const cekiSatiriId = this.selectedUrunId();
    if (!cekiSatiriId) return;

    this.addUrunToSandik(cekiSatiriId, sandikId, this.selectedUrunMiktar());
    this.closeSandikSecimi();
  }

  setUrunNot(sandikId: string, draftId: string, value: string): void {
    this.sandiklar.update(list => list.map(sandik => {
      if (sandik.id !== sandikId) return sandik;
      return {
        ...sandik,
        urunler: sandik.urunler.map(urun =>
          urun.draftId === draftId ? { ...urun, not: value } : urun
        )
      };
    }));
  }

  removeUrun(sandikId: string, draftId: string): void {
    this.sandiklar.update(list => list.map(sandik =>
      sandik.id === sandikId
        ? { ...sandik, urunler: sandik.urunler.filter(u => u.draftId !== draftId) }
        : sandik
    ));
  }

  createSahaProjesi(): void {
    const sandiklar = this.sandiklar()
      .map(sandik => ({
        sandikNo: sandik.sandikNo.trim(),
        hedefSandikId: sandik.hedefSandikId ?? null,
        sandikIsmi: sandik.sandikIsmi.trim() || null,
        en: sandik.en,
        boy: sandik.boy,
        yukseklik: sandik.yukseklik,
        netKg: sandik.netKg,
        grossKg: sandik.grossKg,
        urunler: sandik.urunler
          .filter(urun => urun.miktar > 0)
          .map(urun => ({
            cekiSatiriId: urun.cekiSatiriId,
            kaynakProjeId: urun.projeId,
            miktar: urun.miktar,
            aciklama: urun.not?.trim() || null,
          }))
      }))
      .filter(sandik => sandik.urunler.length > 0);

    if (sandiklar.length === 0) {
      this.toast.error('Saha projesi için en az bir ürün seçilmelidir.');
      return;
    }

    if (sandiklar.some(s => !s.sandikNo)) {
      this.toast.error('Ürün bulunan tüm sandıkların numarası olmalıdır.');
      return;
    }

    const hedefTipi = this.hedefTipi();
    if (hedefTipi === 'new' && !this.yeniProjeNo().trim()) {
      this.toast.error('Saha proje numarası girilmelidir.');
      return;
    }

    if (hedefTipi === 'existing' && !this.hedefSahaProjeId()) {
      this.toast.error('Aktarım yapılacak saha projesi seçilmelidir.');
      return;
    }

    const tekrarEdenSandik = sandiklar
      .map(s => s.sandikNo.toLocaleLowerCase('tr-TR'))
      .find((value, index, list) => list.indexOf(value) !== index);

    if (tekrarEdenSandik) {
      this.toast.error('Aynı sandık numarası birden fazla kez kullanılamaz.');
      return;
    }

    this.saving.set(true);
    this.projeService.eksiklerdenSahaProjesiOlustur({
      kaynakProjeId: this.selectedProjeIds()[0] ?? null,
      hedefSahaProjeId: hedefTipi === 'existing' ? this.hedefSahaProjeId() : null,
      projeNo: hedefTipi === 'new' ? this.yeniProjeNo().trim() || null : null,
      aciklama: this.aciklama().trim() || null,
      sandiklar,
    }).subscribe({
      next: res => {
        this.saving.set(false);
        if (res.isSuccess && res.value) {
          this.toast.success(hedefTipi === 'existing' ? 'Eksikler mevcut saha projesine eklendi.' : 'Saha projesi oluşturuldu.');
          this.router.navigate(['/saha-yonetimi', res.value.id]);
        } else {
          this.toast.error(res.error || 'Eksikler sahaya aktarılamadı.');
        }
      },
      error: () => {
        this.saving.set(false);
        this.toast.error('Sunucu hatası oluştu.');
      }
    });
  }

  getKalanAdet(cekiSatiriId: number): number {
    const urun = this.eksikUrunler().find(u => u.cekiSatiriId === cekiSatiriId);
    if (!urun) return 0;
    return Math.max(urun.kalanMiktar - this.getSepetAdet(cekiSatiriId), 0);
  }

  getSepetAdet(cekiSatiriId: number): number {
    return this.sandiklar()
      .flatMap(s => s.urunler)
      .filter(u => u.cekiSatiriId === cekiSatiriId)
      .reduce((sum, u) => sum + u.miktar, 0);
  }

  formatAdet(value: number): string {
    return Number.isInteger(value) ? value.toString() : value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
  }

  getSandikToplamAdet(sandik: SepetSandik): number {
    return sandik.urunler.reduce((sum, urun) => sum + urun.miktar, 0);
  }

  private refreshKaynakProjeNo(): void {
    const seciliProjeler = this.seciliKaynakProjeler();
    if (seciliProjeler.length === 0) {
      this.kaynakProjeNo.set('');
      return;
    }

    if (seciliProjeler.length <= 2) {
      this.kaynakProjeNo.set(seciliProjeler.map(p => p.projeNo).join(', '));
      return;
    }

    this.kaynakProjeNo.set(`${seciliProjeler[0].projeNo} +${seciliProjeler.length - 1}`);
  }

  private updateDefaultProjeNo(): void {
    if (this.hedefTipi() === 'existing') return;

    const nextDefault = this.buildDefaultSahaProjeNo();
    if (!nextDefault) return;

    const current = this.yeniProjeNo().trim();
    if (!current || current === this.lastDefaultProjeNo) {
      this.yeniProjeNo.set(nextDefault);
    }
    this.lastDefaultProjeNo = nextDefault;
  }

  private buildDefaultSahaProjeNo(): string {
    const seciliProjeler = this.seciliKaynakProjeler();
    if (seciliProjeler.length === 0) return '';
    if (seciliProjeler.length === 1) return `${seciliProjeler[0].projeNo}-SAHA`;

    const now = new Date();
    const y = now.getFullYear();
    const m = (now.getMonth() + 1).toString().padStart(2, '0');
    const d = now.getDate().toString().padStart(2, '0');
    return `SAHA-${y}${m}${d}`;
  }

  private getNextSandikNo(): string {
    const used = new Set(this.sandiklar().map(s => s.sandikNo.trim()));
    let index = this.sandiklar().length + 1;
    while (used.has(index.toString())) index++;
    return index.toString();
  }

  private createDraftId(): string {
    return Math.random().toString(36).slice(2, 10);
  }

  private createEmptySandik(sandikNo = this.getNextSandikNo()): SepetSandik {
    return {
      id: this.createDraftId(),
      sandikNo,
      sandikIsmi: '',
      en: null,
      boy: null,
      yukseklik: null,
      netKg: null,
      grossKg: null,
      urunler: [],
    };
  }

  private toNullablePositiveNumber(value: number | string | null): number | null {
    if (value === null || value === '') return null;
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return null;
    return Math.max(numericValue, 0);
  }

  private loadHedefSahaProjeleri(searchTerm = this.hedefSahaProjeSearchTerm()): void {
    const requestId = ++this.hedefSahaSearchRequest;
    this.hedefSahaProjeLoading.set(true);
    this.projeService.getProjeDropdownListesi({
      projeTipiId: 2,
      searchTerm,
      isSevkEdilen: false,
      take: 50,
      includeIds: this.hedefSahaProjeId() ? [this.hedefSahaProjeId()!] : [],
    }).subscribe({
      next: res => {
        if (requestId !== this.hedefSahaSearchRequest) return;

        this.hedefSahaProjeLoading.set(false);
        if (res.isSuccess && res.value) {
          this.hedefSahaProjeleri.set(this.filterAktifSahaProjeleri(res.value ?? []));
        } else {
          this.toast.warning(res.error || 'Saha projeleri yüklenemedi.');
        }
      },
      error: () => {
        if (requestId !== this.hedefSahaSearchRequest) return;

        this.hedefSahaProjeLoading.set(false);
        this.toast.error('Saha projeleri yüklenirken sunucu hatası oluştu.');
      }
    });
  }

  private loadHedefSahaSandiklari(projeId: number): void {
    this.sandikService.getSandiklar(projeId).subscribe({
      next: res => {
        if (!res.isSuccess || !res.value) {
          this.toast.warning(res.error || 'Saha sandıkları yüklenemedi.');
          this.hedefSahaSandiklari.set([]);
          return;
        }

        const hedefSandiklar = [...res.value]
          .sort((a, b) => this.extractNumber(a.sandikNo) - this.extractNumber(b.sandikNo))
          .map<SepetSandik>(sandik => ({
            id: `existing-${sandik.id}`,
            hedefSandikId: sandik.id,
            isExisting: true,
            existingUrunSayisi: sandik.urunSayisi,
            durumMetni: sandik.durumMetni,
            sandikNo: sandik.sandikNo,
            sandikIsmi: sandik.ad ?? '',
            en: sandik.en ?? null,
            boy: sandik.boy ?? null,
            yukseklik: sandik.yukseklik ?? null,
            netKg: sandik.netKg ?? null,
            grossKg: sandik.grossKg ?? null,
            urunler: [],
          }));

        const taslakSandiklar = this.sandiklar()
          .filter(s => !s.isExisting && s.urunler.length > 0);

        const sepetSandiklari = [...hedefSandiklar, ...taslakSandiklar];
        this.hedefSahaSandiklari.set(res.value);
        this.sandiklar.set(sepetSandiklari);
        if (sepetSandiklari.length === 0) {
          this.addSandik();
        }
      },
      error: () => {
        this.hedefSahaSandiklari.set([]);
        this.toast.error('Saha sandıkları yüklenirken sunucu hatası oluştu.');
      }
    });
  }

  private filterAktifSahaProjeleri(projeler: ProjeDropdownDto[]): ProjeDropdownDto[] {
    return projeler
      .filter(p => p.projeTipiId === 2)
      .filter(p => p.durumId !== 5 && p.durumId !== 6)
      .sort((a, b) => a.projeNo.localeCompare(b.projeNo, 'tr-TR'));
  }

  private extractNumber(value: string): number {
    const match = (value ?? '').match(/(\d+)/);
    return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
  }
}
