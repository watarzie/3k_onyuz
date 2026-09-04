import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, finalize, forkJoin, Subject, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BreadcrumbComponent } from '../../shared/components/breadcrumb/breadcrumb.component';
import { ServerPagerComponent } from '../../shared/components/server-pager/server-pager.component';
import { StatCardComponent } from '../../shared/components/stat-card/stat-card.component';
import { ToastService } from '../../core/services/toast.service';
import { ProjeService } from '../../core/services/proje.service';
import { AmbalajService } from '../../core/services/ambalaj.service';
import {
  AmbalajBagimsizSandikDto,
  AmbalajBagimsizSandikFiltreOzetiDto,
  AmbalajGrup,
  AmbalajIcSandikSablonDto,
  AmbalajIcSandikSablonKaydetRequest,
  AmbalajIlaveSandikAdayDto,
  AmbalajKullaniciSecenegiDto,
  AmbalajKalemKaydetRequest,
  AmbalajKuyruk,
  AmbalajOzelSandikKaydetRequest,
  AmbalajPlanlamaProjeFiltreOzetiDto,
  AmbalajProjeOzetDto,
  AmbalajSandikSecenegiDto,
  AmbalajUretimKalemDto,
  AmbalajUretimPlanDto,
  OzelSandikTur,
  ProjeDropdownDto,
  SandikTipi,
  UretimDurumId,
} from '../../shared/models';

@Component({
  selector: 'app-ambalaj-uretim-listesi',
  standalone: true,
  imports: [BreadcrumbComponent, DecimalPipe, FormsModule, RouterLink, ServerPagerComponent, StatCardComponent],
  templateUrl: './ambalaj-uretim-listesi.component.html',
  styleUrl: './ambalaj-uretim-listesi.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AmbalajUretimListesiComponent implements OnInit {
  private ambalajService = inject(AmbalajService);
  private toastService = inject(ToastService);
  private projeService = inject(ProjeService);
  private destroyRef = inject(DestroyRef);
  private projeListeIstekleri = new Subject<boolean>();
  private bagimsizListeIstekleri = new Subject<boolean>();
  private aramaDegisiklikleri = new Subject<string>();
  private ozelProjeAramaIstekleri = new Subject<{
    arama: string;
    projeTipiId: number;
    includeIds: number[];
  }>();
  private bagimsizListeYuklendi = false;

  projeler = signal<AmbalajProjeOzetDto[]>([]);
  loading = signal(true);
  downloadingProjectId = signal<number | null>(null);
  searchTerm = signal('');
  aktifKuyruk = signal<AmbalajKuyruk>('normal');
  readonly projePageSizeOptions = [15, 25, 50];
  projePageNumber = signal(1);
  projePageSize = signal(15);
  projeTotalCount = signal(0);
  projeTotalPages = signal(0);
  projeFiltreOzeti = signal<AmbalajPlanlamaProjeFiltreOzetiDto>({
    projeSayisi: 0,
    toplamSandikAdedi: 0,
    toplamHacimM3: 0,
    eksikOlculuProjeSayisi: 0,
  });
  planGrup = signal<AmbalajGrup>(1);
  plan = signal<AmbalajUretimPlanDto | null>(null);
  planLoading = signal(false);
  planSaving = signal(false);
  bagimsizSaving = signal(false);
  planOpen = signal(false);
  ambalajKarariSaving = signal(false);
  pdfUyari = signal<{ proje: AmbalajProjeOzetDto; tur: number | null; kalemler: AmbalajUretimKalemDto[] } | null>(null);
  firinTaslaklari: Record<string, string> = {};
  kalemFormOpen = signal(false);
  editingKalemId = signal<number | null>(null);
  kalemForm: AmbalajKalemKaydetRequest = this.bosKalemFormu();
  sandikTipleri: SandikTipi[] = ['Ahşap Kapalı', 'Kafes Sandık', 'Kontrplak Sandık', 'Katlanır Sandık'];
  ozelSandikTipleri: SandikTipi[] = ['Kontrplak Sandık', 'Ahşap Kapalı', 'Katlanır Sandık'];
  icSandikSablonlari = signal<AmbalajIcSandikSablonDto[]>([]);
  sablonFormOpen = signal(false);
  sablonSaving = signal(false);
  sablonForm: AmbalajIcSandikSablonKaydetRequest = this.bosSablonFormu();
  bagimsizSandiklar = signal<AmbalajBagimsizSandikDto[]>([]);
  bagimsizLoading = signal(false);
  readonly bagimsizPageSizeOptions = [25, 50, 100];
  bagimsizPageNumber = signal(1);
  bagimsizPageSize = signal(25);
  bagimsizTotalCount = signal(0);
  bagimsizTotalPages = signal(0);
  bagimsizFiltreOzeti = signal<AmbalajBagimsizSandikFiltreOzetiDto>({
    kayitSayisi: 0,
    toplamSandikAdedi: 0,
    uretimeAlinanSandikAdedi: 0,
    toplamHacimM3: 0,
    turOzetleri: [],
  });
  ozelRaporDownloading = signal<OzelSandikTur | null>(null);
  ozelUretimFormuDownloading = signal<number | null>(null);
  bagimsizFormOpen = signal(false);
  editingBagimsizSandikId = signal<number | null>(null);
  ozelTurFiltresi = signal<OzelSandikTur | 0>(0);
  ozelProjeler = signal<ProjeDropdownDto[]>([]);
  ozelProjeArama = signal('');
  ozelProjelerLoading = signal(false);
  ozelProjeSeciciAcik = signal(false);
  ozelUstSandiklar = signal<(AmbalajSandikSecenegiDto | AmbalajIlaveSandikAdayDto)[]>([]);
  ozelUstSandiklarLoading = signal(false);
  ozelManuelDetayGirisi = signal(false);
  secilenBilgiKaynakSandikId = signal<number | undefined>(undefined);
  secilenOzelSablonId?: number;
  talepEdenKullanicilari = signal<AmbalajKullaniciSecenegiDto[]>([]);
  talepEdenKullanicilariLoading = signal(false);
  talepEdenKullanicilariHatasi = signal<string | null>(null);
  secilenTalepEdenKullaniciId = signal<number | undefined>(undefined);
  talepEdenManuelGirisi = signal(false);
  ozelForm: AmbalajOzelSandikKaydetRequest = this.bosOzelSandikFormu();
  private ozelSandikYuklemeKimligi = 0;

  bagimsizKuyruk = computed(() => this.aktifKuyruk() === 'ozel');
  aktifListeLoading = computed(() => this.bagimsizKuyruk() ? this.bagimsizLoading() : this.loading());
  aktifTotalCount = computed(() => this.bagimsizKuyruk() ? this.bagimsizTotalCount() : this.projeTotalCount());
  projeHasPreviousPage = computed(() => this.projePageNumber() > 1);
  projeHasNextPage = computed(() => this.projePageNumber() < this.projeTotalPages());
  bagimsizHasPreviousPage = computed(() => this.bagimsizPageNumber() > 1);
  bagimsizHasNextPage = computed(() => this.bagimsizPageNumber() < this.bagimsizTotalPages());

  secilebilirOzelProjeler(): ProjeDropdownDto[] {
    return this.ozelProjeler()
      .sort((a, b) => a.projeNo.localeCompare(b.projeNo, 'tr', { numeric: true }));
  }

  toplamProje = computed(() => this.bagimsizKuyruk()
    ? this.bagimsizFiltreOzeti().kayitSayisi
    : this.projeFiltreOzeti().projeSayisi);
  toplamSandik = computed(() => this.bagimsizKuyruk()
    ? this.bagimsizFiltreOzeti().toplamSandikAdedi
    : this.projeFiltreOzeti().toplamSandikAdedi);
  toplamHacim = computed(() => this.bagimsizKuyruk()
    ? this.bagimsizFiltreOzeti().toplamHacimM3
    : this.projeFiltreOzeti().toplamHacimM3);
  eksikProje = computed(() => this.projeFiltreOzeti().eksikOlculuProjeSayisi);
  kaynakKalemler = computed(() => this.plan()?.kalemler.filter(kalem => kalem.kaynakSandikId && kalem.tur === this.planGrup()) ?? []);
  manuelKalemler = computed(() => this.plan()?.kalemler.filter(kalem => !kalem.kaynakSandikId && kalem.tur === this.planGrup()) ?? []);
  seciliAdet = computed(() => this.plan()?.kalemler.filter(k => k.tur === this.planGrup() && k.uretimeAlindi).reduce((sum, k) => sum + k.adet, 0) ?? 0);
  seciliHacim = computed(() => this.plan()?.kalemler.filter(k => k.tur === this.planGrup() && k.uretimeAlindi).reduce((sum, k) => sum + k.hacimM3, 0) ?? 0);
  ilaveKalemSayisi = computed(() => this.plan()?.kalemler.filter(k => k.tur === 2).length ?? 0);
  icKalemSayisi = computed(() => this.plan()?.kalemler.filter(k => k.tur === 3).length ?? 0);

  ngOnInit(): void {
    this.listeAkislariniBaslat();
    this.loadProjects();
    this.icSandikSablonlariniYukle();
    this.talepEdenKullanicilariniYukle();
  }

  @HostListener('document:click')
  ozelSecicileriDisTiklamadaKapat(): void {
    this.ozelProjeSeciciyiKapat();
  }

  aramaDegisti(value: string): void {
    this.searchTerm.set(value);
    this.aramaDegisiklikleri.next(value.trim());
  }

  aktifKuyrukDegistir(kuyruk: AmbalajKuyruk): void {
    if (this.aktifKuyruk() === kuyruk) return;
    this.aktifKuyruk.set(kuyruk);
    if (kuyruk === 'ozel') {
      if (!this.bagimsizListeYuklendi) {
        this.bagimsizPageNumber.set(1);
        this.bagimsizSandiklariYukle();
      }
      return;
    }

    this.projePageNumber.set(1);
    this.loadProjects();
  }

  ozelTurFiltresiDegistir(tur: OzelSandikTur | 0): void {
    if (this.ozelTurFiltresi() === tur) return;
    this.ozelTurFiltresi.set(tur);
    this.bagimsizPageNumber.set(1);
    this.bagimsizSandiklariYukle();
  }

  aktifListeyiYenile(): void {
    if (this.bagimsizKuyruk()) this.bagimsizSandiklariYukle();
    else this.loadProjects();
  }

  projeSayfasiDegisti(pageNumber: number): void {
    this.projePageNumber.set(pageNumber);
    this.loadProjects(false);
  }

  projeSayfaBoyutuDegisti(pageSize: number): void {
    this.projePageSize.set(pageSize);
    this.projePageNumber.set(1);
    this.loadProjects(false);
  }

  bagimsizSayfasiDegisti(pageNumber: number): void {
    this.bagimsizPageNumber.set(pageNumber);
    this.bagimsizSandiklariYukle(false);
  }

  bagimsizSayfaBoyutuDegisti(pageSize: number): void {
    this.bagimsizPageSize.set(pageSize);
    this.bagimsizPageNumber.set(1);
    this.bagimsizSandiklariYukle(false);
  }

  bagimsizSandiklariYukle(includeSummary = true): void {
    this.bagimsizListeIstekleri.next(includeSummary);
  }

  private listeAkislariniBaslat(): void {
    this.aramaDegisiklikleri
      .pipe(
        debounceTime(400),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        if (this.bagimsizKuyruk()) {
          this.bagimsizPageNumber.set(1);
          this.bagimsizSandiklariYukle();
        } else {
          this.projePageNumber.set(1);
          this.loadProjects();
        }
      });

    this.projeListeIstekleri
      .pipe(
        switchMap(includeSummary => {
          const kapsam = this.aktifProjeKapsami();
          this.loading.set(true);
          return this.ambalajService.getProjeler({
            arama: this.searchTerm(),
            projeTipiId: kapsam.projeTipiId,
            grup: kapsam.grup,
            pageNumber: this.projePageNumber(),
            pageSize: this.projePageSize(),
            includeSummary,
          }).pipe(finalize(() => this.loading.set(false)));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(result => {
        if (!result.isSuccess || !result.value) {
          this.toastService.error(result.error ?? 'Ambalaj projeleri yüklenemedi.');
          return;
        }

        const sayfa = result.value;
        const sonSayfa = Math.max(1, sayfa.totalPages);
        if (sayfa.pageNumber > sonSayfa) {
          this.projePageNumber.set(sonSayfa);
          this.loadProjects();
          return;
        }

        this.projeler.set(sayfa.items ?? []);
        this.projePageNumber.set(sayfa.pageNumber);
        this.projePageSize.set(sayfa.pageSize);
        this.projeTotalCount.set(sayfa.totalCount);
        this.projeTotalPages.set(sayfa.totalPages);
        if (sayfa.filteredSummary) this.projeFiltreOzeti.set(sayfa.filteredSummary);
        for (const proje of sayfa.items ?? []) {
          for (const grup of [1, 2, 3] as AmbalajGrup[]) {
            this.firinTaslaklari[this.taslakAnahtari(proje.projeId, grup)] = this.projeFirinPartiNo(proje, grup);
          }
        }
      });

    this.bagimsizListeIstekleri
      .pipe(
        switchMap(includeSummary => {
          this.bagimsizLoading.set(true);
          return this.ambalajService.getBagimsizSandiklar({
            arama: this.searchTerm(),
            tur: this.ozelTurFiltresi() || undefined,
            pageNumber: this.bagimsizPageNumber(),
            pageSize: this.bagimsizPageSize(),
            includeSummary,
          }).pipe(finalize(() => this.bagimsizLoading.set(false)));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(result => {
        if (!result.isSuccess || !result.value) {
          this.toastService.error(result.error ?? 'Özel sandıklar yüklenemedi.');
          return;
        }

        const sayfa = result.value;
        const sonSayfa = Math.max(1, sayfa.totalPages);
        if (sayfa.pageNumber > sonSayfa) {
          this.bagimsizPageNumber.set(sonSayfa);
          this.bagimsizSandiklariYukle();
          return;
        }

        this.bagimsizSandiklar.set(sayfa.items ?? []);
        this.bagimsizPageNumber.set(sayfa.pageNumber);
        this.bagimsizPageSize.set(sayfa.pageSize);
        this.bagimsizTotalCount.set(sayfa.totalCount);
        this.bagimsizTotalPages.set(sayfa.totalPages);
        if (sayfa.filteredSummary) this.bagimsizFiltreOzeti.set(sayfa.filteredSummary);
        this.bagimsizListeYuklendi = true;
      });

    this.ozelProjeAramaIstekleri
      .pipe(
        debounceTime(300),
        switchMap(istek => {
          this.ozelProjelerLoading.set(true);
          return this.projeService.getProjeDropdownListesi({
            projeTipiId: istek.projeTipiId,
            searchTerm: istek.arama,
            take: 30,
            includeIds: istek.includeIds,
          }).pipe(finalize(() => this.ozelProjelerLoading.set(false)));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(result => {
        if (result.isSuccess) {
          this.ozelProjeler.set(result.value ?? []);
          return;
        }
        this.toastService.error(result.error ?? 'Proje seçenekleri yüklenemedi.');
      });
  }

  private aktifProjeKapsami(): { projeTipiId: number; grup: AmbalajGrup } {
    const kuyruk = this.aktifKuyruk();
    return {
      projeTipiId: kuyruk === 'saha' ? 2 : kuyruk === 'yedek' ? 3 : 1,
      grup: kuyruk === 'ilave' ? 2 : kuyruk === 'ic' ? 3 : 1,
    };
  }

  bagimsizFormuAc(sandik?: AmbalajBagimsizSandikDto): void {
    if (!this.talepEdenKullanicilariLoading()
      && (this.talepEdenKullanicilariHatasi() || this.talepEdenKullanicilari().length === 0)) {
      this.talepEdenKullanicilariniYukle();
    }
    this.editingBagimsizSandikId.set(sandik?.id ?? null);
    this.secilenOzelSablonId = sandik?.icSandikSablonId;
    this.secilenBilgiKaynakSandikId.set(sandik?.tur === 2 ? sandik.kaynakSandikId : undefined);
    this.secilenTalepEdenKullaniciId.set(undefined);
    this.talepEdenManuelGirisi.set(false);
    this.ozelProjeArama.set('');
    this.ozelProjeSeciciAcik.set(false);
    this.ozelForm = sandik ? {
      tur: sandik.tur,
      projeId: sandik.projeId ?? 0,
      kaynakSandikId: sandik.tur === 2 ? sandik.kaynakSandikId : undefined,
      ustKaynakSandikId: sandik.ustKaynakSandikId,
      icSandikSablonId: sandik.icSandikSablonId,
      uretimeAlindi: sandik.uretimeAlindi,
      sandikNo: sandik.sandikNo,
      ad: sandik.ad,
      sandikTipi: sandik.sandikTipi,
      adet: sandik.adet,
      boy: sandik.boy,
      en: sandik.en,
      yukseklik: sandik.yukseklik,
      talimatVeren: sandik.talimatVeren ?? '',
      aciklama: sandik.aciklama,
    } : this.bosOzelSandikFormu(this.ozelTurFiltresi() || 2);
    this.ozelManuelDetayGirisi.set(sandik
      ? sandik.tur === 2
        ? !sandik.kaynakSandikId
      : sandik.tur === 3
          ? !sandik.icSandikSablonId
          : true
      : false);
    this.talepEdenSeciminiKayitlaEslestir();
    if (this.ozelForm.projeId) this.ozelProjeDegisti(this.ozelForm.projeId, false);
    else {
      this.ozelUstSandiklar.set([]);
      this.ozelUstSandiklarLoading.set(false);
    }
    this.ozelProjeleriYukle();
    this.bagimsizFormOpen.set(true);
  }

  bagimsizSandikKaydet(): void {
    if ([2, 4, 5].includes(this.ozelForm.tur)
      && !this.secilenBilgiKaynakSandikId()
      && !this.ozelManuelDetayGirisi()) {
      this.toastService.warning('Projeden bir sandık seçin veya “Elle gir” seçeneğini işaretleyin.');
      return;
    }
    if (this.ozelForm.tur === 3 && !this.ozelForm.icSandikSablonId && !this.ozelManuelDetayGirisi()) {
      this.toastService.warning('Kayıtlı bir iç sandık tipi seçin veya “Elle gir” seçeneğini işaretleyin.');
      return;
    }
    if (!this.ozelForm.projeId || !this.ozelForm.ad?.trim() || !this.ozelForm.talimatVeren.trim()
      || (this.ozelForm.tur === 3 && !this.ozelForm.ustKaynakSandikId)
      || this.ozelForm.adet <= 0 || this.ozelForm.boy <= 0 || this.ozelForm.en <= 0 || this.ozelForm.yukseklik <= 0) {
      this.toastService.warning('Proje, sandık adı, tipi, adet, ölçüler ve isteyen kişi zorunludur. İç sandıkta dış sandık da seçilmelidir.');
      return;
    }
    if (this.bagimsizSaving()) return;
    this.bagimsizSaving.set(true);
    const request: AmbalajOzelSandikKaydetRequest = {
      ...this.ozelForm,
      kaynakSandikId: this.ozelForm.tur === 2 ? this.ozelForm.kaynakSandikId : undefined,
    };
    const operation = this.editingBagimsizSandikId()
      ? this.ambalajService.bagimsizSandikGuncelle(this.editingBagimsizSandikId()!, request)
      : this.ambalajService.bagimsizSandikEkle(request);
    operation.pipe(finalize(() => this.bagimsizSaving.set(false))).subscribe(result => {
      if (result.isSuccess) {
        this.toastService.success(this.editingBagimsizSandikId() ? 'Sandık güncellendi.' : 'Sandık eklendi.');
        this.bagimsizFormOpen.set(false);
        this.bagimsizSandiklariYukle();
        return;
      }
      this.toastService.error(result.error ?? 'Sandık kaydedilemedi.');
    });
  }

  ozelTurDegisti(tur: OzelSandikTur): void {
    if (this.ozelBaglantiKilitli()) return;
    this.ozelForm.tur = tur;
    this.ozelForm.icSandikSablonId = undefined;
    this.secilenOzelSablonId = undefined;
    this.ozelProjeArama.set('');
    this.ozelProjeSeciciAcik.set(false);
    this.ozelForm.projeId = 0;
    this.ozelForm.kaynakSandikId = undefined;
    this.secilenBilgiKaynakSandikId.set(undefined);
    this.ozelForm.ustKaynakSandikId = undefined;
    this.ozelUstSandiklar.set([]);
    this.ozelUstSandiklarLoading.set(false);
    this.ozelSandikYuklemeKimligi++;
    this.ozelManuelDetayGirisi.set(false);
    this.ozelDetayAlanlariniTemizle();
    this.ozelProjeleriYukle();
  }

  ozelProjeDegisti(projeId: number, secimiTemizle = true): void {
    this.ozelForm.projeId = Number(projeId);
    if (secimiTemizle) {
      this.ozelForm.kaynakSandikId = undefined;
      this.secilenBilgiKaynakSandikId.set(undefined);
      this.ozelForm.ustKaynakSandikId = undefined;
      this.ozelForm.icSandikSablonId = undefined;
      this.secilenOzelSablonId = undefined;
      this.ozelManuelDetayGirisi.set(false);
      this.ozelDetayAlanlariniTemizle();
    }
    this.ozelUstSandiklar.set([]);
    const yuklemeKimligi = ++this.ozelSandikYuklemeKimligi;
    this.ozelUstSandiklarLoading.set(false);
    if (!this.ozelForm.projeId || ![2, 3, 4, 5].includes(this.ozelForm.tur)) return;
    const sandiklar = this.ozelForm.tur === 2
      ? this.ambalajService.getIlaveSandikAdaylari(this.ozelForm.projeId, this.editingBagimsizSandikId())
      : this.ambalajService.getProjeSandikSecenekleri(this.ozelForm.projeId);
    this.ozelUstSandiklarLoading.set(true);
    sandiklar
      .pipe(finalize(() => {
        if (yuklemeKimligi === this.ozelSandikYuklemeKimligi) this.ozelUstSandiklarLoading.set(false);
      }))
      .subscribe(result => {
        if (yuklemeKimligi !== this.ozelSandikYuklemeKimligi) return;
        if (result.isSuccess) this.ozelUstSandiklar.set(result.value ?? []);
        else this.toastService.error(result.error ?? 'Projenin sandıkları yüklenemedi.');
      });
  }

  ozelKaynakSandikDegisti(sandikId?: number): void {
    if (this.ozelBaglantiKilitli()) return;
    const kaynakSandikId = sandikId ? Number(sandikId) : undefined;
    this.secilenBilgiKaynakSandikId.set(kaynakSandikId);
    this.ozelForm.kaynakSandikId = this.ozelForm.tur === 2 ? kaynakSandikId : undefined;
    const sandik = this.ozelUstSandiklar().find(item => item.id === kaynakSandikId);
    this.ozelManuelDetayGirisi.set(false);
    this.ozelDetayAlanlariniTemizle();
    if (!sandik) return;
    this.ozelForm.sandikNo = sandik.sandikNo;
    this.ozelForm.ad = sandik.ad ?? '';
    this.ozelForm.boy = sandik.boy ?? 0;
    this.ozelForm.en = sandik.en ?? 0;
    this.ozelForm.yukseklik = sandik.yukseklik ?? 0;
  }

  ozelUstKaynakSandikDegisti(sandikId?: number): void {
    if (this.ozelBaglantiKilitli()) return;
    this.ozelForm.ustKaynakSandikId = sandikId ? Number(sandikId) : undefined;
    if (this.ozelForm.ustKaynakSandikId) return;
    this.ozelForm.icSandikSablonId = undefined;
    this.secilenOzelSablonId = undefined;
    this.ozelManuelDetayGirisi.set(false);
    this.ozelDetayAlanlariniTemizle();
  }

  ozelManuelDetayGirisiDegisti(manuel: boolean): void {
    if (this.ozelBaglantiKilitli()) return;
    this.ozelManuelDetayGirisi.set(!!manuel);
    if ([2, 4, 5].includes(this.ozelForm.tur)) {
      this.ozelForm.kaynakSandikId = undefined;
      this.secilenBilgiKaynakSandikId.set(undefined);
    }
    if (this.ozelForm.tur === 3) {
      this.ozelForm.icSandikSablonId = undefined;
      this.secilenOzelSablonId = undefined;
    }
    this.ozelDetayAlanlariniTemizle();
  }

  ozelDetayFormuGoster(): boolean {
    if (!this.ozelForm.projeId) return false;
    if (this.editingBagimsizSandikId()) return true;
    if ([2, 4, 5].includes(this.ozelForm.tur)) {
      return this.ozelManuelDetayGirisi() || !!this.secilenBilgiKaynakSandikId();
    }
    if (this.ozelForm.tur === 3) {
      return !!this.ozelForm.ustKaynakSandikId
        && (this.ozelManuelDetayGirisi() || !!this.ozelForm.icSandikSablonId);
    }
    return false;
  }

  ozelBaglantiKilitli(): boolean {
    return this.editingBagimsizSandikId() !== null;
  }

  ozelProjeSeciciyiAcKapat(): void {
    if (this.ozelBaglantiKilitli()) return;
    const acilacak = !this.ozelProjeSeciciAcik();
    if (acilacak) {
      this.ozelProjeArama.set('');
      this.ozelProjeleriYukle();
    }
    this.ozelProjeSeciciAcik.set(acilacak);
  }

  ozelProjeSeciciyiKapat(): void {
    this.ozelProjeSeciciAcik.set(false);
  }

  ozelProjeSec(projeId: number): void {
    if (this.ozelBaglantiKilitli()) return;
    this.ozelProjeDegisti(projeId);
    this.ozelProjeArama.set('');
    this.ozelProjeSeciciyiKapat();
  }

  secilenOzelProjeEtiketi(): string {
    const proje = this.ozelProjeler().find(item => item.id === this.ozelForm.projeId);
    return proje ? `${proje.projeNo} · ${proje.musteri || '-'}` : 'Proje seçin';
  }

  ozelProjeAramasiDegisti(value: string): void {
    this.ozelProjeArama.set(value);
    this.ozelProjeleriYukle(value);
  }

  private ozelProjeleriYukle(arama = this.ozelProjeArama()): void {
    const projeTipiId = this.ozelForm.tur === 4 ? 2 : this.ozelForm.tur === 5 ? 3 : 1;
    this.ozelProjelerLoading.set(true);
    this.ozelProjeAramaIstekleri.next({
      arama: arama.trim(),
      projeTipiId,
      includeIds: this.ozelForm.projeId ? [this.ozelForm.projeId] : [],
    });
  }

  talepEdenKullanicilariniYukle(): void {
    this.talepEdenKullanicilariHatasi.set(null);
    this.talepEdenKullanicilariLoading.set(true);
    this.ambalajService.getTalepEdenKullanicilar()
      .pipe(finalize(() => this.talepEdenKullanicilariLoading.set(false)))
      .subscribe(result => {
        if (result.isSuccess) {
          this.talepEdenKullanicilari.set(result.value ?? []);
          this.talepEdenSeciminiKayitlaEslestir();
          return;
        }
        const hata = result.error ?? 'Sistem kullanıcıları yüklenemedi.';
        this.talepEdenKullanicilari.set([]);
        this.talepEdenKullanicilariHatasi.set(hata);
        this.toastService.error(hata);
      });
  }

  talepEdenKullaniciDegisti(kullaniciId?: number): void {
    const id = kullaniciId ? Number(kullaniciId) : undefined;
    this.secilenTalepEdenKullaniciId.set(id);
    this.ozelForm.talimatVeren = this.talepEdenKullanicilari()
      .find(kullanici => kullanici.id === id)?.adSoyad ?? '';
  }

  talepEdenManuelGirisiDegisti(manuel: boolean): void {
    this.talepEdenManuelGirisi.set(!!manuel);
    this.secilenTalepEdenKullaniciId.set(undefined);
    this.ozelForm.talimatVeren = '';
  }

  private talepEdenSeciminiKayitlaEslestir(): void {
    const kayitliAd = this.ozelForm.talimatVeren?.trim();
    if (!kayitliAd) {
      this.secilenTalepEdenKullaniciId.set(undefined);
      return;
    }

    const kullanici = this.talepEdenKullanicilari().find(item =>
      item.adSoyad.toLocaleLowerCase('tr-TR') === kayitliAd.toLocaleLowerCase('tr-TR'));
    this.secilenTalepEdenKullaniciId.set(kullanici?.id);
    this.talepEdenManuelGirisi.set(!kullanici);
    if (kullanici) this.ozelForm.talimatVeren = kullanici.adSoyad;
  }

  bagimsizSandikSil(sandik: AmbalajBagimsizSandikDto): void {
    if (!confirm(`${sandik.sandikNo} sandığını silmek istediğinize emin misiniz?`)) return;
    this.ambalajService.bagimsizSandikSil(sandik.id).subscribe(result => {
      if (result.isSuccess) {
        this.toastService.success('Sandık silindi.');
        this.bagimsizSandiklariYukle();
      } else this.toastService.error(result.error ?? 'Sandık silinemedi.');
    });
  }

  ozelRaporIndir(tur: OzelSandikTur): void {
    if (this.ozelRaporDownloading() !== null) return;
    if (this.ozelRaporAdedi(tur) === 0) {
      this.toastService.warning(`${this.ozelTurMetni(tur)} raporunda kayıt bulunamadı.`);
      return;
    }
    this.ozelRaporDownloading.set(tur);
    this.ambalajService.ozelSandikRaporuIndir(tur)
      .pipe(finalize(() => this.ozelRaporDownloading.set(null)))
      .subscribe({
        next: blob => {
          const url = URL.createObjectURL(blob);
          const baglanti = document.createElement('a');
          baglanti.href = url;
          baglanti.download = `${this.ozelTurMetni(tur).replaceAll(' ', '_')}_Raporu.pdf`;
          baglanti.click();
          URL.revokeObjectURL(url);
        },
        error: () => this.toastService.error('PDF raporu oluşturulamadı.'),
      });
  }

  ozelUretimFormuIndir(sandik: AmbalajBagimsizSandikDto): void {
    if (this.ozelUretimFormuDownloading() !== null) return;
    if (!sandik.projeId) {
      this.toastService.warning('Üretim formu için proje seçilmelidir.');
      return;
    }

    this.ozelUretimFormuDownloading.set(sandik.id);
    this.ambalajService.ozelSandikUretimFormuIndir(sandik.tur, sandik.projeId)
      .pipe(finalize(() => this.ozelUretimFormuDownloading.set(null)))
      .subscribe({
        next: blob => {
          const url = URL.createObjectURL(blob);
          const baglanti = document.createElement('a');
          baglanti.href = url;
          baglanti.download = `${sandik.projeNo || 'Proje'}_${this.ozelTurMetni(sandik.tur).replaceAll(' ', '_')}_UretimFormu.pdf`;
          baglanti.click();
          URL.revokeObjectURL(url);
        },
        error: () => this.toastService.error('Üretim formu oluşturulamadı.'),
      });
  }

  ozelRaporAdedi(tur: OzelSandikTur): number {
    return this.bagimsizFiltreOzeti().turOzetleri.find(ozet => ozet.tur === tur)?.toplamSandikAdedi ?? 0;
  }

  ozelRaporHacmi(tur: OzelSandikTur): number {
    return this.bagimsizFiltreOzeti().turOzetleri.find(ozet => ozet.tur === tur)?.toplamHacimM3 ?? 0;
  }

  private ozelTurMetni(tur: OzelSandikTur): string {
    return tur === 4 ? 'Saha Sandık' : tur === 5 ? 'Yedek Sandık' : tur === 2 ? 'İlave Sandık' : 'İç Sandık';
  }

  loadProjects(includeSummary = true): void {
    this.projeListeIstekleri.next(includeSummary);
  }

  projeYolu(proje: AmbalajProjeOzetDto): string[] {
    const base = proje.projeTipiId === 2
      ? '/saha-yonetimi'
      : proje.projeTipiId === 3
        ? '/yedek-yonetimi'
        : '/sandik-yonetimi';
    return [base, proje.projeId.toString()];
  }

  planAc(proje: AmbalajProjeOzetDto): void {
    this.planGrup.set(this.kuyrukGrubu());
    this.planOpen.set(true);
    this.planLoading.set(true);
    this.plan.set(null);
    this.kalemFormOpen.set(false);
    this.ambalajService.getPlan(proje.projeId, this.kaynakProjeTipiId(), this.planGrup())
      .pipe(finalize(() => this.planLoading.set(false)))
      .subscribe(result => {
        if (result.isSuccess && result.value) {
          this.plan.set(result.value);
          return;
        }
        this.toastService.error(result.error ?? 'Üretim planı yüklenemedi.');
      });
  }

  planKapat(): void {
    this.planOpen.set(false);
    this.plan.set(null);
    this.kalemFormOpen.set(false);
  }

  firinPartiDegistir(value: string): void {
    const grup = this.planGrup();
    this.plan.update(plan => !plan ? plan : grup === 1 ? { ...plan, firinPartiNo: value }
      : grup === 2 ? { ...plan, ilaveFirinPartiNo: value }
      : { ...plan, icSandikFirinPartiNo: value });
  }

  kaynakSecimDegistir(kalem: AmbalajUretimKalemDto, secili: boolean): void {
    if (kalem.ambalajaDahilMi === false) return;
    this.plan.update(plan => plan ? {
      ...plan,
      kalemler: plan.kalemler.map(item => item.kaynakSandikId === kalem.kaynakSandikId ? { ...item, uretimeAlindi: secili } : item),
    } : plan);
  }

  tumKaynaklariSec(secili: boolean): void {
    this.plan.update(plan => plan ? {
      ...plan,
      kalemler: plan.kalemler.map(item => item.tur === this.planGrup() && item.kaynakSandikId && item.ambalajaDahilMi !== false
        ? { ...item, uretimeAlindi: secili }
        : item),
    } : plan);
  }

  ambalajKarariKaydet(kalem: AmbalajUretimKalemDto, ambalajaDahilMi: boolean): void {
    if (!kalem.kaynakSandikId) return;
    this.ambalajKarariSaving.set(true);
    this.ambalajService.ambalajKarariKaydet(kalem.kaynakSandikId, ambalajaDahilMi)
      .pipe(finalize(() => this.ambalajKarariSaving.set(false)))
      .subscribe(result => {
        if (result.isSuccess && result.value) {
          this.plan.set(result.value);
          this.loadProjects();
          this.toastService.success(ambalajaDahilMi ? 'Sandık ambalaja dahil edildi.' : 'Sandık ambalaj kapsamından çıkarıldı.');
          return;
        }
        this.toastService.error(result.error ?? 'Ambalaj kararı kaydedilemedi.');
      });
  }

  planKaydet(): void {
    const plan = this.plan();
    if (!plan) return;
    this.planSaving.set(true);
    const grup = this.planGrup();
    const seciliIds = plan.kalemler.filter(k => k.tur === grup && k.uretimeAlindi && k.kaynakSandikId).map(k => k.kaynakSandikId!);
    this.ambalajService.planKaydet(plan.projeId, this.planFirinPartiNo(plan, grup), seciliIds, grup, this.planDurumId(plan, grup), this.kaynakProjeTipiId())
      .pipe(finalize(() => this.planSaving.set(false)))
      .subscribe(result => {
        if (result.isSuccess && result.value) {
          this.plan.set(result.value);
          this.firinTaslaklari[this.taslakAnahtari(plan.projeId, grup)] = this.planFirinPartiNo(result.value, grup);
          this.toastService.success('Üretim planı kaydedildi.');
          this.loadProjects();
          return;
        }
        this.toastService.error(result.error ?? 'Üretim planı kaydedilemedi.');
      });
  }

  firinPartiKaydet(proje: AmbalajProjeOzetDto): void {
    const grup = this.kuyrukGrubu();
    this.ambalajService.getPlan(proje.projeId, this.kaynakProjeTipiId(), grup).subscribe(result => {
      if (!result.isSuccess || !result.value) {
        this.toastService.error(result.error ?? 'Proje planı yüklenemedi.');
        return;
      }
      const seciliIds = result.value.kalemler.filter(k => k.tur === grup && k.uretimeAlindi && k.kaynakSandikId).map(k => k.kaynakSandikId!);
      this.ambalajService.planKaydet(proje.projeId, this.firinTaslaklari[this.taslakAnahtari(proje.projeId, grup)] ?? '', seciliIds, grup, this.projeDurumId(proje, grup), this.kaynakProjeTipiId()).subscribe(saveResult => {
        if (saveResult.isSuccess) {
          this.toastService.success('Fırın parti numarası kaydedildi.');
          this.loadProjects();
        } else {
          this.toastService.error(saveResult.error ?? 'Fırın parti numarası kaydedilemedi.');
        }
      });
    });
  }

  durumDegistir(proje: AmbalajProjeOzetDto, durumId: UretimDurumId): void {
    const grup = this.kuyrukGrubu();
    this.ambalajService.getPlan(proje.projeId, this.kaynakProjeTipiId(), grup).subscribe(result => {
      if (!result.isSuccess || !result.value) {
        this.toastService.error(result.error ?? 'Proje planı yüklenemedi.');
        return;
      }
      const seciliIds = result.value.kalemler.filter(k => k.tur === grup && k.uretimeAlindi && k.kaynakSandikId).map(k => k.kaynakSandikId!);
      this.ambalajService.planKaydet(proje.projeId, this.projeFirinPartiNo(proje, grup), seciliIds, grup, durumId, this.kaynakProjeTipiId()).subscribe(saveResult => {
        if (saveResult.isSuccess) this.loadProjects();
        else this.toastService.error(saveResult.error ?? 'Üretim durumu kaydedilemedi.');
      });
    });
  }

  kalemFormuAc(tur: 1 | 2 | 3, kalem?: AmbalajUretimKalemDto): void {
    this.editingKalemId.set(kalem?.id ?? null);
    this.kalemForm = kalem ? {
      tur,
      ustKalemId: kalem.ustKalemId,
      icSandikSablonId: kalem.icSandikSablonId,
      uretimeAlindi: kalem.uretimeAlindi,
      sandikNo: kalem.sandikNo,
      ad: kalem.ad,
      sandikTipi: kalem.sandikTipi,
      adet: kalem.adet,
      boy: kalem.boy,
      en: kalem.en,
      yukseklik: kalem.yukseklik,
      kullanimAmaci: kalem.kullanimAmaci ?? '',
      talimatVeren: kalem.talimatVeren ?? '',
      aciklama: kalem.aciklama,
    } : this.bosKalemFormu(tur);
    this.kalemFormOpen.set(true);
  }

  kalemKaydet(): void {
    const plan = this.plan();
    if (!plan) return;
    if (!this.kalemForm.ad?.trim() || !this.kalemForm.talimatVeren.trim()
      || this.kalemForm.adet <= 0 || this.kalemForm.boy <= 0 || this.kalemForm.en <= 0 || this.kalemForm.yukseklik <= 0) {
      this.toastService.warning('Sandık adı, tipi, adet, ölçüler ve talimat veren zorunludur.');
      return;
    }
    this.planSaving.set(true);
    const request = { ...this.kalemForm };
    const operation = this.editingKalemId()
      ? this.ambalajService.kalemGuncelle(this.editingKalemId()!, request)
      : this.ambalajService.kalemEkle(plan.projeId, request);
    operation.pipe(finalize(() => this.planSaving.set(false))).subscribe(result => {
      if (result.isSuccess) {
        this.toastService.success(this.editingKalemId() ? 'Sandık güncellendi.' : 'Sandık eklendi.');
        this.kalemFormOpen.set(false);
        this.planYenile(plan.projeId);
        return;
      }
      this.toastService.error(result.error ?? 'Sandık kaydedilemedi.');
    });
  }

  kalemSil(kalem: AmbalajUretimKalemDto): void {
    if (!confirm(`${kalem.sandikNo} sandığını silmek istediğinize emin misiniz?`)) return;
    this.ambalajService.kalemSil(kalem.id).subscribe(result => {
      if (result.isSuccess) {
        this.toastService.success('Sandık silindi.');
        this.planYenile(this.plan()!.projeId);
      } else {
        this.toastService.error(result.error ?? 'Sandık silinemedi.');
      }
    });
  }

  manuelSandikEklenebilir(): boolean {
    return this.aktifKuyruk() !== 'normal';
  }

  aktifManuelTur(): 1 | 2 | 3 {
    return this.aktifKuyruk() === 'ilave' ? 2 : this.aktifKuyruk() === 'ic' ? 3 : 1;
  }

  kaynakProjeTipiId(): number | undefined {
    return this.aktifKuyruk() === 'saha' ? 2 : this.aktifKuyruk() === 'yedek' ? 3 : undefined;
  }

  icSandikSablonlariniYukle(): void {
    this.ambalajService.getIcSandikSablonlari().subscribe(result => {
      if (result.isSuccess) this.icSandikSablonlari.set(result.value ?? []);
      else this.toastService.error(result.error ?? 'İç sandık şablonları yüklenemedi.');
    });
  }

  sablonuUygula(sablonId: number | undefined): void {
    this.kalemForm.icSandikSablonId = sablonId ? Number(sablonId) : undefined;
    const sablon = this.icSandikSablonlari().find(item => item.id === this.kalemForm.icSandikSablonId);
    if (!sablon) return;
    this.kalemForm.ad = sablon.ad;
    this.kalemForm.sandikTipi = sablon.sandikTipi;
    this.kalemForm.boy = sablon.boy;
    this.kalemForm.en = sablon.en;
    this.kalemForm.yukseklik = sablon.yukseklik;
  }

  ozelSablonuUygula(sablonId: number | undefined): void {
    if (this.ozelBaglantiKilitli()) return;
    this.secilenOzelSablonId = sablonId ? Number(sablonId) : undefined;
    this.ozelForm.icSandikSablonId = this.secilenOzelSablonId;
    const sablon = this.icSandikSablonlari().find(item => item.id === this.secilenOzelSablonId);
    this.ozelManuelDetayGirisi.set(false);
    this.ozelDetayAlanlariniTemizle();
    if (!sablon) return;
    this.ozelForm.ad = sablon.ad;
    this.ozelForm.sandikTipi = sablon.sandikTipi;
    this.ozelForm.boy = sablon.boy;
    this.ozelForm.en = sablon.en;
    this.ozelForm.yukseklik = sablon.yukseklik;
  }

  sablonKaydet(): void {
    if (!this.sablonForm.ad.trim() || this.sablonForm.boy <= 0 || this.sablonForm.en <= 0 || this.sablonForm.yukseklik <= 0) {
      this.toastService.warning('Şablon adı, sandık tipi ve ölçüler zorunludur.');
      return;
    }
    this.sablonSaving.set(true);
    this.ambalajService.icSandikSablonuEkle(this.sablonForm)
      .pipe(finalize(() => this.sablonSaving.set(false)))
      .subscribe(result => {
        if (result.isSuccess) {
          this.toastService.success('İç sandık şablonu kaydedildi.');
          this.sablonForm = this.bosSablonFormu();
          this.sablonFormOpen.set(false);
          this.icSandikSablonlariniYukle();
        } else this.toastService.error(result.error ?? 'Şablon kaydedilemedi.');
      });
  }

  sablonSil(sablon: AmbalajIcSandikSablonDto): void {
    if (!confirm(`${sablon.ad} şablonunu silmek istediğinize emin misiniz?`)) return;
    this.ambalajService.icSandikSablonuSil(sablon.id).subscribe(result => {
      if (result.isSuccess) {
        this.icSandikSablonlari.update(items => items.filter(item => item.id !== sablon.id));
        this.toastService.success('Şablon silindi.');
      } else this.toastService.error(result.error ?? 'Şablon silinemedi.');
    });
  }

  uretimFormuIndir(proje: AmbalajProjeOzetDto, tur: number | null = this.kuyrukGrubu()): void {
    if (this.downloadingProjectId() !== null) return;
    this.downloadingProjectId.set(proje.projeId);
    if (tur === 3) {
      this.pdfDosyasiniIndir(proje, tur);
      return;
    }

    this.ambalajService.getPlan(proje.projeId, proje.projeTipiId, tur as AmbalajGrup | null ?? undefined)
      .subscribe(result => {
        if (!result.isSuccess || !result.value) {
          this.downloadingProjectId.set(null);
          this.toastService.error(result.error ?? 'Ambalaj kararları kontrol edilemedi.');
          return;
        }

        const kararsizKalemler = this.kararsizAmbalajKalemleri(result.value.kalemler, tur);
        if (kararsizKalemler.length > 0) {
          this.downloadingProjectId.set(null);
          this.pdfUyari.set({ proje, tur, kalemler: kararsizKalemler });
          return;
        }

        this.pdfDosyasiniIndir(proje, tur);
      });
  }

  pdfKarariUygula(ambalajaDahilMi: boolean): void {
    const uyari = this.pdfUyari();
    if (!uyari) return;
    this.ambalajKarariSaving.set(true);
    forkJoin(uyari.kalemler.map(kalem => this.ambalajService.ambalajKarariKaydet(kalem.kaynakSandikId!, ambalajaDahilMi)))
      .pipe(finalize(() => this.ambalajKarariSaving.set(false)))
      .subscribe({
        next: results => {
          const hata = results.find(result => !result.isSuccess);
          if (hata) {
            this.toastService.error(hata.error ?? 'Ambalaj kararları kaydedilemedi.');
            return;
          }
          this.pdfUyari.set(null);
          this.loadProjects();
          this.downloadingProjectId.set(uyari.proje.projeId);
          this.pdfDosyasiniIndir(uyari.proje, uyari.tur);
        },
        error: () => this.toastService.error('Ambalaj kararları kaydedilemedi.'),
      });
  }

  pdfUyarisiKapat(): void {
    if (!this.ambalajKarariSaving()) this.pdfUyari.set(null);
  }

  private pdfDosyasiniIndir(proje: AmbalajProjeOzetDto, tur: number | null): void {
    this.ambalajService.uretimFormuIndir(proje.projeId, tur)
      .pipe(finalize(() => this.downloadingProjectId.set(null)))
      .subscribe({
        next: blob => {
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = url;
          const turMetni = tur === 1 ? 'ProjeSandiklari' : tur === 2 ? 'IlaveSandiklar' : tur === 3 ? 'IcSandiklar' : 'TumSandiklar';
          anchor.download = `${proje.fbNo || proje.projeNo}_${turMetni}_AmbalajUretimFormu.pdf`;
          anchor.click();
          URL.revokeObjectURL(url);
        },
        error: error => this.toastService.error(error?.error?.message ?? 'Üretim formu oluşturulamadı.'),
      });
  }

  planRaporuIndir(): void {
    const plan = this.plan();
    const proje = this.projeler().find(item => item.projeId === plan?.projeId);
    if (!plan || !proje || this.downloadingProjectId() !== null) return;

    const tur = this.planGrup();
    const kararsizKalemler = this.kararsizAmbalajKalemleri(plan.kalemler, tur);

    if (kararsizKalemler.length > 0) {
      this.pdfUyari.set({ proje, tur, kalemler: kararsizKalemler });
      return;
    }

    this.downloadingProjectId.set(proje.projeId);
    this.pdfDosyasiniIndir(proje, tur);
  }

  private kararsizAmbalajKalemleri(kalemler: AmbalajUretimKalemDto[], tur: number | null): AmbalajUretimKalemDto[] {
    return kalemler.filter(kalem => kalem.kaynakSandikId
      && kalem.uretimeAlindi
      && kalem.ambalajKarariOneriliyor
      && kalem.ambalajaDahilMi === null
      && (!tur || kalem.tur === tur));
  }

  kuyrukGrubu(): AmbalajGrup {
    const kuyruk = this.aktifKuyruk();
    return kuyruk === 'ilave' ? 2 : kuyruk === 'ic' ? 3 : 1;
  }

  kuyrukBasligi(): string {
    return ({ normal: 'Normal Projeler', ozel: 'Özel Sandıklar', saha: 'Saha Projeleri', yedek: 'Yedek Projeleri', ilave: 'İlave Sandıklar', ic: 'İç Sandıklar' } as const)[this.aktifKuyruk()];
  }

  projeDurumId(proje: AmbalajProjeOzetDto, grup = this.kuyrukGrubu()): UretimDurumId {
    return grup === 1 ? proje.projeSandiklariDurumId : grup === 2 ? proje.ilaveSandiklarDurumId : proje.icSandiklarDurumId;
  }

  projeFirinPartiNo(proje: AmbalajProjeOzetDto, grup = this.kuyrukGrubu()): string {
    return (grup === 1 ? proje.firinPartiNo : grup === 2 ? proje.ilaveFirinPartiNo : proje.icSandikFirinPartiNo) ?? '';
  }

  projeSandikSayisi(proje: AmbalajProjeOzetDto): number {
    const grup = this.kuyrukGrubu();
    return grup === 1 ? proje.projeSandikSayisi : grup === 2 ? proje.ilaveSandikSayisi : proje.icSandikSayisi;
  }

  projeHacmi(proje: AmbalajProjeOzetDto): number {
    const grup = this.kuyrukGrubu();
    return grup === 1 ? proje.projeSandiklariHacimM3 : grup === 2 ? proje.ilaveSandiklarHacimM3 : proje.icSandiklarHacimM3;
  }

  durumMetni(durumId: UretimDurumId): string {
    return durumId === 1 ? 'Beklemede' : durumId === 2 ? 'Üretimde' : 'Tamamlandı';
  }

  planFirinPartiNo(plan: AmbalajUretimPlanDto, grup = this.planGrup()): string {
    return (grup === 1 ? plan.firinPartiNo : grup === 2 ? plan.ilaveFirinPartiNo : plan.icSandikFirinPartiNo) ?? '';
  }

  planDurumId(plan: AmbalajUretimPlanDto, grup = this.planGrup()): UretimDurumId {
    return grup === 1 ? plan.projeSandiklariDurumId : grup === 2 ? plan.ilaveSandiklarDurumId : plan.icSandiklarDurumId;
  }

  planDurumDegistir(durumId: UretimDurumId): void {
    const grup = this.planGrup();
    this.plan.update(plan => !plan ? plan : grup === 1 ? { ...plan, projeSandiklariDurumId: durumId }
      : grup === 2 ? { ...plan, ilaveSandiklarDurumId: durumId }
      : { ...plan, icSandiklarDurumId: durumId });
  }

  private planYenile(projeId: number): void {
    this.ambalajService.getPlan(projeId, this.kaynakProjeTipiId(), this.planGrup()).subscribe(result => {
      if (result.isSuccess && result.value) this.plan.set(result.value);
      else this.toastService.error(result.error ?? 'Üretim planı yenilenemedi.');
    });
  }

  private bosKalemFormu(tur: 1 | 2 | 3 = 2): AmbalajKalemKaydetRequest {
    return { tur, uretimeAlindi: true, sandikNo: '', sandikTipi: 'Ahşap Kapalı', adet: 1, boy: 0, en: 0, yukseklik: 0, kullanimAmaci: '', talimatVeren: '' };
  }

  private bosOzelSandikFormu(tur: OzelSandikTur = 2): AmbalajOzelSandikKaydetRequest {
    return { tur, projeId: 0, uretimeAlindi: true, sandikNo: '', sandikTipi: 'Kontrplak Sandık', adet: 1, boy: 0, en: 0, yukseklik: 0, talimatVeren: '' };
  }

  private ozelDetayAlanlariniTemizle(): void {
    this.ozelForm.sandikNo = '';
    this.ozelForm.ad = '';
    this.ozelForm.sandikTipi = 'Kontrplak Sandık';
    this.ozelForm.adet = 1;
    this.ozelForm.boy = 0;
    this.ozelForm.en = 0;
    this.ozelForm.yukseklik = 0;
  }

  private bosSablonFormu(): AmbalajIcSandikSablonKaydetRequest {
    return { ad: '', sandikTipi: 'Ahşap Kapalı', boy: 0, en: 0, yukseklik: 0 };
  }

  taslakAnahtari(projeId: number, grup = this.kuyrukGrubu()): string {
    return `${projeId}-${grup}`;
  }

}
