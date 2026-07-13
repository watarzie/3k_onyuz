import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';
import { BreadcrumbComponent } from '../../shared/components/breadcrumb/breadcrumb.component';
import { ToastService } from '../../core/services/toast.service';
import { AmbalajService } from './ambalaj.service';
import { AmbalajBagimsizSandikDto, AmbalajGrup, AmbalajIcSandikSablonDto, AmbalajIcSandikSablonKaydetRequest, AmbalajKalemKaydetRequest, AmbalajKuyruk, AmbalajProjeOzetDto, AmbalajUretimKalemDto, AmbalajUretimPlanDto, SandikTipi, UretimDurumId } from './models/ambalaj.model';

@Component({
  selector: 'app-ambalaj-uretim-listesi',
  standalone: true,
  imports: [BreadcrumbComponent, DecimalPipe, FormsModule, RouterLink],
  templateUrl: './ambalaj-uretim-listesi.component.html',
  styleUrl: './ambalaj-uretim-listesi.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AmbalajUretimListesiComponent implements OnInit {
  private ambalajService = inject(AmbalajService);
  private toastService = inject(ToastService);

  projeler = signal<AmbalajProjeOzetDto[]>([]);
  loading = signal(true);
  downloadingProjectId = signal<number | null>(null);
  searchTerm = signal('');
  aktifKuyruk = signal<AmbalajKuyruk>('normal');
  planGrup = signal<AmbalajGrup>(1);
  plan = signal<AmbalajUretimPlanDto | null>(null);
  planLoading = signal(false);
  planSaving = signal(false);
  planOpen = signal(false);
  firinTaslaklari: Record<string, string> = {};
  kalemFormOpen = signal(false);
  editingKalemId = signal<number | null>(null);
  kalemForm: AmbalajKalemKaydetRequest = this.bosKalemFormu();
  sandikTipleri: SandikTipi[] = ['Ahşap Kapalı', 'Kafes Sandık', 'Kontrplak Sandık'];
  icSandikSablonlari = signal<AmbalajIcSandikSablonDto[]>([]);
  sablonFormOpen = signal(false);
  sablonSaving = signal(false);
  sablonForm: AmbalajIcSandikSablonKaydetRequest = this.bosSablonFormu();
  bagimsizSandiklar = signal<AmbalajBagimsizSandikDto[]>([]);
  bagimsizLoading = signal(false);
  bagimsizFormOpen = signal(false);
  editingBagimsizSandikId = signal<number | null>(null);

  bagimsizKuyruk = computed(() => this.aktifKuyruk() === 'ilave' || this.aktifKuyruk() === 'ic');
  filteredBagimsizSandiklar = computed(() => {
    const tur = this.aktifKuyruk() === 'ilave' ? 2 : 3;
    const search = this.searchTerm().trim().toLocaleLowerCase('tr-TR');
    return this.bagimsizSandiklar().filter(sandik => sandik.tur === tur
      && (!search || [sandik.sandikNo, sandik.ad, sandik.sandikTipi, sandik.talimatVeren, sandik.kullanimAmaci]
        .some(value => value?.toLocaleLowerCase('tr-TR').includes(search))));
  });

  filteredProjeler = computed(() => {
    const search = this.searchTerm().trim().toLocaleLowerCase('tr-TR');
    const kuyruk = this.aktifKuyruk();
    return this.projeler().filter(proje => {
      const typeMatches = kuyruk === 'normal' ? proje.projeTipiId === 1
        : kuyruk === 'saha' ? proje.projeTipiId === 2
        : kuyruk === 'yedek' ? proje.projeTipiId === 3
        : kuyruk === 'ilave' || kuyruk === 'ic';
      const searchMatches = !search || [proje.projeNo, proje.fbNo, proje.musteri]
        .some(value => value?.toLocaleLowerCase('tr-TR').includes(search));
      return typeMatches && searchMatches;
    });
  });

  toplamProje = computed(() => this.bagimsizKuyruk() ? this.filteredBagimsizSandiklar().length : this.filteredProjeler().length);
  toplamSandik = computed(() => this.bagimsizKuyruk()
    ? this.filteredBagimsizSandiklar().reduce((sum, sandik) => sum + sandik.adet, 0)
    : this.filteredProjeler().reduce((sum, proje) => sum + this.projeSandikSayisi(proje), 0));
  toplamHacim = computed(() => this.bagimsizKuyruk()
    ? this.filteredBagimsizSandiklar().reduce((sum, sandik) => sum + sandik.hacimM3, 0)
    : this.filteredProjeler().reduce((sum, proje) => sum + this.projeHacmi(proje), 0));
  eksikProje = computed(() => this.filteredProjeler().filter(proje => proje.eksikOlculuSandikSayisi > 0).length);
  kaynakKalemler = computed(() => this.plan()?.kalemler.filter(kalem => kalem.kaynakSandikId && kalem.tur === this.planGrup()) ?? []);
  manuelKalemler = computed(() => this.plan()?.kalemler.filter(kalem => !kalem.kaynakSandikId && kalem.tur === this.planGrup()) ?? []);
  seciliAdet = computed(() => this.plan()?.kalemler.filter(k => k.tur === this.planGrup() && k.uretimeAlindi).reduce((sum, k) => sum + k.adet, 0) ?? 0);
  seciliHacim = computed(() => this.plan()?.kalemler.filter(k => k.tur === this.planGrup() && k.uretimeAlindi).reduce((sum, k) => sum + k.hacimM3, 0) ?? 0);
  ilaveKalemSayisi = computed(() => this.plan()?.kalemler.filter(k => k.tur === 2).length ?? 0);
  icKalemSayisi = computed(() => this.plan()?.kalemler.filter(k => k.tur === 3).length ?? 0);

  ngOnInit(): void {
    this.loadProjects();
    this.bagimsizSandiklariYukle();
    this.icSandikSablonlariniYukle();
  }

  bagimsizSandiklariYukle(): void {
    this.bagimsizLoading.set(true);
    forkJoin({ ilave: this.ambalajService.getBagimsizSandiklar(2), ic: this.ambalajService.getBagimsizSandiklar(3) })
      .pipe(finalize(() => this.bagimsizLoading.set(false)))
      .subscribe(result => {
        if (result.ilave.isSuccess && result.ic.isSuccess) {
          this.bagimsizSandiklar.set([...(result.ilave.value ?? []), ...(result.ic.value ?? [])]);
          return;
        }
        this.toastService.error(result.ilave.error ?? result.ic.error ?? 'Bağımsız sandıklar yüklenemedi.');
      });
  }

  bagimsizFormuAc(sandik?: AmbalajBagimsizSandikDto): void {
    const tur = this.aktifKuyruk() === 'ilave' ? 2 : 3;
    this.editingBagimsizSandikId.set(sandik?.id ?? null);
    this.kalemForm = sandik ? {
      tur,
      uretimeAlindi: sandik.uretimeAlindi,
      sandikNo: sandik.sandikNo,
      ad: sandik.ad,
      sandikTipi: sandik.sandikTipi,
      adet: sandik.adet,
      boy: sandik.boy,
      en: sandik.en,
      yukseklik: sandik.yukseklik,
      kullanimAmaci: sandik.kullanimAmaci ?? '',
      talimatVeren: sandik.talimatVeren ?? '',
      aciklama: sandik.aciklama,
    } : this.bosKalemFormu(tur);
    this.bagimsizFormOpen.set(true);
  }

  bagimsizSandikKaydet(): void {
    if (!this.kalemForm.ad?.trim() || !this.kalemForm.talimatVeren.trim()
      || this.kalemForm.adet <= 0 || this.kalemForm.boy <= 0 || this.kalemForm.en <= 0 || this.kalemForm.yukseklik <= 0) {
      this.toastService.warning('Sandık adı, tipi, adet, ölçüler ve isteyen kişi zorunludur.');
      return;
    }
    this.planSaving.set(true);
    const operation = this.editingBagimsizSandikId()
      ? this.ambalajService.bagimsizSandikGuncelle(this.editingBagimsizSandikId()!, { ...this.kalemForm })
      : this.ambalajService.bagimsizSandikEkle({ ...this.kalemForm });
    operation.pipe(finalize(() => this.planSaving.set(false))).subscribe(result => {
      if (result.isSuccess) {
        this.toastService.success(this.editingBagimsizSandikId() ? 'Sandık güncellendi.' : 'Sandık eklendi.');
        this.bagimsizFormOpen.set(false);
        this.bagimsizSandiklariYukle();
        return;
      }
      this.toastService.error(result.error ?? 'Sandık kaydedilemedi.');
    });
  }

  bagimsizSandikSil(sandik: AmbalajBagimsizSandikDto): void {
    if (!confirm(`${sandik.sandikNo} sandığını silmek istediğinize emin misiniz?`)) return;
    this.ambalajService.bagimsizSandikSil(sandik.id).subscribe(result => {
      if (result.isSuccess) {
        this.bagimsizSandiklar.update(items => items.filter(item => item.id !== sandik.id));
        this.toastService.success('Sandık silindi.');
      } else this.toastService.error(result.error ?? 'Sandık silinemedi.');
    });
  }

  loadProjects(): void {
    this.loading.set(true);
    this.ambalajService.getProjeler()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe(result => {
        if (result.isSuccess) {
          this.projeler.set(result.value ?? []);
          for (const proje of result.value ?? []) {
            for (const grup of [1, 2, 3] as AmbalajGrup[]) {
              this.firinTaslaklari[this.taslakAnahtari(proje.projeId, grup)] = this.projeFirinPartiNo(proje, grup);
            }
          }
          return;
        }
        this.toastService.error(result.error ?? 'Ambalaj projeleri yüklenemedi.');
      });
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
    this.plan.update(plan => plan ? {
      ...plan,
      kalemler: plan.kalemler.map(item => item.kaynakSandikId === kalem.kaynakSandikId ? { ...item, uretimeAlindi: secili } : item),
    } : plan);
  }

  tumKaynaklariSec(secili: boolean): void {
    this.plan.update(plan => plan ? {
      ...plan,
      kalemler: plan.kalemler.map(item => item.tur === this.planGrup() && item.kaynakSandikId ? { ...item, uretimeAlindi: secili } : item),
    } : plan);
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
    const sablon = this.icSandikSablonlari().find(item => item.id === sablonId);
    if (!sablon) return;
    this.kalemForm.ad = sablon.ad;
    this.kalemForm.sandikTipi = sablon.sandikTipi;
    this.kalemForm.boy = sablon.boy;
    this.kalemForm.en = sablon.en;
    this.kalemForm.yukseklik = sablon.yukseklik;
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
    if (proje.eksikOlculuSandikSayisi > 0) {
      this.toastService.warning(`Ölçüsü eksik koliler: ${proje.eksikOlculuSandiklar.join(', ')}`);
      return;
    }

    this.downloadingProjectId.set(proje.projeId);
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
    if (proje) this.uretimFormuIndir(proje, this.planGrup());
  }

  kuyrukGrubu(): AmbalajGrup {
    const kuyruk = this.aktifKuyruk();
    return kuyruk === 'ilave' ? 2 : kuyruk === 'ic' ? 3 : 1;
  }

  kuyrukBasligi(): string {
    return ({ normal: 'Normal Projeler', saha: 'Saha Projeleri', yedek: 'Yedek Projeleri', ilave: 'İlave Sandıklar', ic: 'İç Sandıklar' } as const)[this.aktifKuyruk()];
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

  private bosSablonFormu(): AmbalajIcSandikSablonKaydetRequest {
    return { ad: '', sandikTipi: 'Ahşap Kapalı', boy: 0, en: 0, yukseklik: 0 };
  }

  taslakAnahtari(projeId: number, grup = this.kuyrukGrubu()): string {
    return `${projeId}-${grup}`;
  }

}