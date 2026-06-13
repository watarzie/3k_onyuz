import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { BreadcrumbComponent } from '../../../shared/components/breadcrumb/breadcrumb.component';
import { ProjeService } from '../../../core/services/proje.service';
import { SandikService } from '../../../core/services/sandik.service';
import { ToastService } from '../../../core/services/toast.service';
import { EksikUrunForSandikDto, ProjeDto } from '../../../shared/models';

interface SepetUrun extends EksikUrunForSandikDto {
  draftId: string;
  miktar: number;
  not?: string | null;
}

interface SepetSandik {
  id: string;
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

  kaynakProjeler = signal<ProjeDto[]>([]);
  selectedProjeIds = signal<number[]>([]);
  aktifKaynakProjeId = signal<number | null>(null);
  eksikUrunler = signal<EksikUrunForSandikDto[]>([]);
  sandiklar = signal<SepetSandik[]>([]);
  private lastDefaultProjeNo = '';

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
  }

  loadKaynakProjeler(): void {
    this.loadingProjeler.set(true);
    this.projeService.getProjeListesi(1, 1000, 1).subscribe({
      next: res => {
        if (res.isSuccess && res.value) {
          this.kaynakProjeler.set(res.value.items ?? []);
          this.refreshKaynakProjeNo();
          this.updateDefaultProjeNo();
          this.loadEksikler();
        } else {
          this.loading.set(false);
          this.toast.error(res.error || 'Kaynak projeler yüklenemedi.');
        }
        this.loadingProjeler.set(false);
      },
      error: () => {
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
    this.loadEksikler();
  }

  toggleProjeDropdown(): void {
    if (this.loadingProjeler()) return;
    this.projeDropdownOpen.update(open => !open);
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
    this.loadEksikler();
  }

  addSandik(): void {
    const nextNo = this.getNextSandikNo();
    const id = this.createDraftId();
    this.sandiklar.update(list => [
      ...list,
      {
        id,
        sandikNo: nextNo,
        sandikIsmi: '',
        en: null,
        boy: null,
        yukseklik: null,
        netKg: null,
        grossKg: null,
        urunler: [],
      }
    ]);
  }

  removeSandik(sandikId: string): void {
    if (this.sandiklar().length === 1) {
      this.toast.warning('En az bir sandık kalmalıdır.');
      return;
    }
    this.sandiklar.update(list => list.filter(s => s.id !== sandikId));
  }

  updateSandikNo(sandikId: string, value: string): void {
    this.sandiklar.update(list => list.map(s => s.id === sandikId ? { ...s, sandikNo: value } : s));
  }

  updateSandikIsmi(sandikId: string, value: string): void {
    this.sandiklar.update(list => list.map(s => s.id === sandikId ? { ...s, sandikIsmi: value } : s));
  }

  updateSandikOlcu(sandikId: string, field: 'en' | 'boy' | 'yukseklik' | 'netKg' | 'grossKg', value: number | string | null): void {
    this.sandiklar.update(list => list.map(s => {
      if (s.id !== sandikId) return s;
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
      projeNo: this.yeniProjeNo().trim() || null,
      aciklama: this.aciklama().trim() || null,
      sandiklar,
    }).subscribe({
      next: res => {
        this.saving.set(false);
        if (res.isSuccess && res.value) {
          this.toast.success('Saha projesi oluşturuldu.');
          this.router.navigate(['/saha-yonetimi', res.value.id]);
        } else {
          this.toast.error(res.error || 'Saha projesi oluşturulamadı.');
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

  private toNullablePositiveNumber(value: number | string | null): number | null {
    if (value === null || value === '') return null;
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return null;
    return Math.max(numericValue, 0);
  }
}
