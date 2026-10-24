import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, switchMap } from 'rxjs';
import { BreadcrumbComponent } from '../../../shared/components/breadcrumb/breadcrumb.component';
import { ReadOnlyBannerComponent } from '../../../shared/components/readonly-banner/readonly-banner.component';
import { ServerPagerComponent } from '../../../shared/components/server-pager/server-pager.component';
import { StatCardComponent } from '../../../shared/components/stat-card/stat-card.component';
import { IslemlerMenusuComponent } from '../../../shared/components/islemler-menusu/islemler-menusu.component';
import { GridService } from '../../../core/services/grid.service';
import { PermissionService } from '../../../core/services/permission.service';
import { TranslationService } from '../../../core/services/translation.service';
import { YETKI } from '../../../core/constants/yetki-kodlari';
import { GridDurum, ProjeTipi } from '../../../core/constants/enums';
import { projeTipiBaglami } from '../../../core/constants/proje-tipi';
import {
  GridMalKabulGecmisiDto,
  GridMalKabulHareketDto,
  GridMalKabulParams,
  GridMalKabulTuru,
  GridSahaKapsam,
  GridSahaSiralama,
  GridSahaUrunDto,
  GridSahaUrunleriDto,
  GridSahaUrunleriParams,
} from '../../../shared/models/index';

export type GridSahaSekmesi = 'urunler' | 'malKabul';

/** Mal kabul kayıtları günlere göre gruplanır (sunucu sırası korunur). */
export interface GridMalKabulGunu {
  readonly gun: string;
  readonly hareketler: GridMalKabulHareketDto[];
}

/**
 * Grid Sahası (grid-saha-gorunumu R): Grid'e gelmiş ürünler (varsayılan Grid'de bekleyenler, "Tümü" ile gelen her şey)
 * proje tipinden bağımsız tek listede; ikinci sekmede Grid personelinin mal kabul kayıtları (canlı + arşiv). Ekran salt
 * okunurdur; "Grid'e git" bağlantısı satırın proje tipinin Grid modülü iznini ister, izin yoksa proje numarası düz metin kalır.
 */
@Component({
  selector: 'app-grid-saha',
  standalone: true,
  imports: [
    DatePipe, DecimalPipe, RouterLink, BreadcrumbComponent, ReadOnlyBannerComponent, ServerPagerComponent,
    StatCardComponent, IslemlerMenusuComponent,
  ],
  templateUrl: './grid-saha.component.html',
  styleUrl: './grid-saha.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GridSahaComponent implements OnInit {
  private readonly gridService = inject(GridService);
  private readonly ts = inject(TranslationService);
  private readonly destroyRef = inject(DestroyRef);
  readonly permissions = inject(PermissionService);
  readonly izin = YETKI.SANDIK;

  private readonly urunIstek = new Subject<GridSahaUrunleriParams>();
  private readonly malKabulIstek = new Subject<GridMalKabulParams>();
  private readonly aramaDegisti$ = new Subject<void>();
  private readonly mkAramaDegisti$ = new Subject<void>();

  readonly breadcrumb = [
    { label: 'Ana Kontrol Paneli', link: '/dashboard' },
    { label: 'Sandık Yönetimi', link: '/sandik-yonetimi' },
    { label: 'Grid Sahası' },
  ];
  readonly projeTipiSecenekleri = [
    { deger: null, etiket: 'GRID_SAHA.ALL_TYPES' },
    { deger: ProjeTipi.Normal, etiket: 'GRID_SAHA.TYPE_NORMAL' },
    { deger: ProjeTipi.Saha, etiket: 'GRID_SAHA.TYPE_FIELD' },
    { deger: ProjeTipi.Yedek, etiket: 'GRID_SAHA.TYPE_SPARE' },
  ] as const;
  readonly siralamaSecenekleri: ReadonlyArray<{ deger: GridSahaSiralama; etiket: string }> = [
    { deger: 'proje', etiket: 'GRID_SAHA.SORT_PROJECT' },
    { deger: 'bekleyen', etiket: 'GRID_SAHA.SORT_WAITING' },
    { deger: 'sandik', etiket: 'GRID_SAHA.SORT_CRATE' },
  ];
  readonly turSecenekleri: ReadonlyArray<{ deger: GridMalKabulTuru; etiket: string }> = [
    { deger: 'mal-kabul', etiket: 'GRID_SAHA.KIND_RECEIPT' },
    { deger: 'toplu-sevk', etiket: 'GRID_SAHA.KIND_BULK_SHIP' },
    { deger: 'hepsi', etiket: 'GRID_SAHA.KIND_ALL' },
  ];
  readonly GridDurum = GridDurum;

  readonly sekme = signal<GridSahaSekmesi>('urunler');

  // ===== Grid sahasındaki ürünler =====
  readonly urunler = signal<GridSahaUrunleriDto | null>(null);
  readonly urunYukleniyor = signal(true);
  readonly urunHata = signal('');
  readonly kapsam = signal<GridSahaKapsam>('bekleyen');
  readonly arama = signal('');
  readonly projeTipiId = signal<number | null>(null);
  readonly gridDurumuId = signal<number | null>(null);
  readonly siralama = signal<GridSahaSiralama>('proje');
  readonly azalan = signal(false);
  readonly sayfa = signal(1);
  readonly sayfaBoyutu = signal(25);

  // ===== Mal kabul kayıtları =====
  readonly malKabul = signal<GridMalKabulGecmisiDto | null>(null);
  readonly mkYukleniyor = signal(false);
  readonly mkHata = signal('');
  readonly mkTur = signal<GridMalKabulTuru>('mal-kabul');
  readonly mkBaslangic = signal('');
  readonly mkBitis = signal('');
  readonly mkPersonelId = signal<number | null>(null);
  readonly mkArama = signal('');
  readonly mkSayfa = signal(1);
  readonly mkSayfaBoyutu = signal(25);
  private mkYuklendi = false;

  readonly satirlar = computed(() => this.urunler()?.liste.items ?? []);
  readonly ozet = computed(() => this.urunler()?.ozet ?? null);
  readonly filtreVar = computed(() => !!(this.arama().trim() || this.projeTipiId() || this.gridDurumuId()));
  readonly mkFiltreVar = computed(() =>
    !!(this.mkBaslangic() || this.mkBitis() || this.mkPersonelId() || this.mkArama().trim() || this.mkTur() !== 'mal-kabul'));
  readonly gunGruplari = computed<GridMalKabulGunu[]>(() => {
    const gruplar: GridMalKabulGunu[] = [];
    for (const hareket of this.malKabul()?.liste.items ?? []) {
      const gun = hareket.tarih.slice(0, 10);
      const son = gruplar[gruplar.length - 1];
      if (son && son.gun === gun) son.hareketler.push(hareket);
      else gruplar.push({ gun, hareketler: [hareket] });
    }
    return gruplar;
  });

  ngOnInit(): void {
    this.urunIstek
      .pipe(switchMap(params => this.gridService.getSahaUrunleri(params)), takeUntilDestroyed(this.destroyRef))
      .subscribe(res => {
        this.urunYukleniyor.set(false);
        if (res.isSuccess && res.value) {
          this.urunler.set(res.value);
          this.urunHata.set('');
          return;
        }
        this.urunler.set(null);
        this.urunHata.set(res.error || this.t('GRID_SAHA.ERROR'));
      });
    this.malKabulIstek
      .pipe(switchMap(params => this.gridService.getMalKabulKayitlari(params)), takeUntilDestroyed(this.destroyRef))
      .subscribe(res => {
        this.mkYukleniyor.set(false);
        if (res.isSuccess && res.value) {
          this.malKabul.set(res.value);
          this.mkHata.set('');
          return;
        }
        this.malKabul.set(null);
        this.mkHata.set(res.error || this.t('GRID_SAHA.ERROR'));
      });
    this.aramaDegisti$.pipe(debounceTime(400), takeUntilDestroyed(this.destroyRef)).subscribe(() => this.yenile());
    this.mkAramaDegisti$.pipe(debounceTime(400), takeUntilDestroyed(this.destroyRef)).subscribe(() => this.mkYenile());
    this.yukle();
  }

  t(key: string, degerler?: Record<string, string | number>): string {
    let metin = this.ts.translate(key);
    for (const [ad, deger] of Object.entries(degerler ?? {})) metin = metin.split(`{${ad}}`).join(String(deger));
    return metin;
  }

  sekmeDegistir(sekme: GridSahaSekmesi): void {
    if (this.sekme() === sekme) return;
    this.sekme.set(sekme);
    if (sekme === 'malKabul' && !this.mkYuklendi) this.mkYukle();
  }

  // ===== Grid sahasındaki ürünler =====

  urunParams(): GridSahaUrunleriParams {
    return {
      pageNumber: this.sayfa(),
      pageSize: this.sayfaBoyutu(),
      kapsam: this.kapsam(),
      arama: this.arama().trim() || undefined,
      projeTipiId: this.projeTipiId(),
      gridDurumuId: this.gridDurumuId(),
      siralama: this.siralama(),
      azalan: this.azalan(),
    };
  }

  yukle(): void {
    this.urunYukleniyor.set(true);
    this.urunIstek.next(this.urunParams());
  }

  /** Süzgeç değişince ilk sayfaya dönülür. */
  yenile(): void {
    this.sayfa.set(1);
    this.yukle();
  }

  kapsamDegisti(kapsam: GridSahaKapsam): void {
    if (this.kapsam() === kapsam) return;
    this.kapsam.set(kapsam);
    this.yenile();
  }

  aramaDegisti(deger: string): void {
    this.arama.set(deger);
    this.aramaDegisti$.next();
  }

  projeTipiDegisti(deger: string): void {
    this.projeTipiId.set(deger ? Number(deger) : null);
    this.yenile();
  }

  durumDegisti(deger: number | null): void {
    this.gridDurumuId.set(this.gridDurumuId() === deger ? null : deger);
    this.yenile();
  }

  siralamaDegisti(deger: string): void {
    this.siralama.set(this.siralamaSecenekleri.find(s => s.deger === deger)?.deger ?? 'proje');
    this.yenile();
  }

  azalanDegistir(): void {
    this.azalan.update(v => !v);
    this.yenile();
  }

  filtreleriTemizle(): void {
    this.arama.set('');
    this.projeTipiId.set(null);
    this.gridDurumuId.set(null);
    this.yenile();
  }

  sayfaDegisti(sayfa: number): void {
    this.sayfa.set(sayfa);
    this.yukle();
  }

  sayfaBoyutuDegisti(boyut: number): void {
    this.sayfaBoyutu.set(boyut);
    this.yenile();
  }

  // ===== Mal kabul kayıtları =====

  malKabulParams(): GridMalKabulParams {
    return {
      pageNumber: this.mkSayfa(),
      pageSize: this.mkSayfaBoyutu(),
      tur: this.mkTur(),
      baslangic: this.mkBaslangic() || undefined,
      bitis: this.mkBitis() || undefined,
      personelId: this.mkPersonelId(),
      arama: this.mkArama().trim() || undefined,
    };
  }

  mkYukle(): void {
    this.mkYuklendi = true;
    this.mkYukleniyor.set(true);
    this.malKabulIstek.next(this.malKabulParams());
  }

  mkYenile(): void {
    this.mkSayfa.set(1);
    this.mkYukle();
  }

  mkTurDegisti(tur: GridMalKabulTuru): void {
    if (this.mkTur() === tur) return;
    this.mkTur.set(tur);
    this.mkYenile();
  }

  mkAramaDegisti(deger: string): void {
    this.mkArama.set(deger);
    this.mkAramaDegisti$.next();
  }

  mkTarihDegisti(alan: 'mkBaslangic' | 'mkBitis', deger: string): void {
    (alan === 'mkBaslangic' ? this.mkBaslangic : this.mkBitis).set(deger);
    this.mkYenile();
  }

  mkPersonelDegisti(deger: string): void {
    this.mkPersonelId.set(deger ? Number(deger) : null);
    this.mkYenile();
  }

  mkFiltreleriTemizle(): void {
    this.mkTur.set('mal-kabul');
    this.mkBaslangic.set('');
    this.mkBitis.set('');
    this.mkPersonelId.set(null);
    this.mkArama.set('');
    this.mkYenile();
  }

  mkSayfaDegisti(sayfa: number): void {
    this.mkSayfa.set(sayfa);
    this.mkYukle();
  }

  mkSayfaBoyutuDegisti(boyut: number): void {
    this.mkSayfaBoyutu.set(boyut);
    this.mkYenile();
  }

  // ===== Satır yardımcıları =====

  projeTipiAdi(projeTipiId: number | null | undefined): string {
    return projeTipiBaglami(projeTipiId).ad;
  }

  /** Satırın proje tipinin Grid modülü izni varsa Grid ekranı rotası; yoksa null (bağlantı düz metin kalır). */
  gridRotasi(satir: { projeTipiId?: number | null; projeId: number }): string[] | null {
    const baglam = projeTipiBaglami(satir.projeTipiId);
    return this.permissions.hasAccess(baglam.yetki.gridModulu) ? [baglam.gridRotasi, String(satir.projeId)] : null;
  }

  /** Satırın proje sandık listesi rotası; rota guard'ıyla aynı izin (Normal sandik-yonetimi, Saha/Yedek sandıklar) yoksa null. */
  projeRotasi(satir: { projeTipiId?: number | null; projeId: number }): string[] | null {
    const baglam = projeTipiBaglami(satir.projeTipiId);
    const izin = baglam.tip === ProjeTipi.Saha ? YETKI.SAHA.SANDIKLAR : baglam.tip === ProjeTipi.Yedek ? YETKI.YEDEK.SANDIKLAR : YETKI.SANDIK.YONETIMI;
    return this.permissions.hasAccess(izin) ? [baglam.yonetimRotasi, String(satir.projeId)] : null;
  }

  gridOdak(satir: GridSahaUrunDto | GridMalKabulHareketDto): Record<string, number> | null {
    const id = satir.cekiSatiriId;
    return id ? { focusCekiSatiriId: id } : null;
  }

  durumTonu(gridDurumuId: number): string {
    if (gridDurumuId === GridDurum.TamGeldi) return 'success';
    if (gridDurumuId === GridDurum.EksikGeldi) return 'warning';
    if (gridDurumuId === GridDurum.TrafoSevk) return 'info';
    if (gridDurumuId === GridDurum.GridKapandi) return 'dark';
    return 'secondary';
  }

  islemTonu(h: GridMalKabulHareketDto): string {
    if (h.topluUrunSayisi != null) return 'info';
    if (h.islemMetni === 'Manuel ürün') return 'primary';
    // Durum geçişinin rengi ürün listesindekiyle aynıdır (Tam Geldi yeşil, Eksik turuncu, Trafo Sevk mavi, Grid Kapandı gri).
    return h.gridDurumuId ? this.durumTonu(h.gridDurumuId) : 'secondary';
  }

  gunEtiketi(gun: string): string {
    const dil = this.ts.currentLang() === 'en' ? 'en-GB' : 'tr-TR';
    const [yil, ay, g] = gun.split('-').map(Number);
    return new Date(yil, ay - 1, g).toLocaleDateString(dil, { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' });
  }
}
