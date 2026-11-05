import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime } from 'rxjs';
import { BreadcrumbComponent } from '../../../shared/components/breadcrumb/breadcrumb.component';
import { ServerPagerComponent } from '../../../shared/components/server-pager/server-pager.component';
import { ToastService } from '../../../core/services/toast.service';
import { PermissionService } from '../../../core/services/permission.service';
import { YuklemePlanlamaService } from '../../../core/services/yukleme-planlama.service';
import { YETKI } from '../../../core/constants/yetki-kodlari';
import {
  PaginatedList,
  PlanProjeAdayi,
  YuklemeCalismaBicimi,
  YuklemePlaniOzeti,
  YuklemePlaniTanimlari,
  YuklemeProjeKarisimi,
} from '../../../shared/models/index';
import { CALISMA_BICIMI, PROJE_KARISIMI } from '../ortak/yukleme-etiketleri';

/**
 * Yükleme planları listesi (sunucuda sayfalı) ve yeni plan penceresi. Yeni planda seçilen projelerin sevk edilmemiş
 * bütün sandıkları seçili gelir; yük listesi plan ekranında düzenlenir.
 */
@Component({
  selector: 'app-plan-listesi',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, FormsModule, BreadcrumbComponent, ServerPagerComponent],
  templateUrl: './plan-listesi.component.html',
  styleUrls: ['../ortak/yukleme.scss', './plan-listesi.component.scss'],
})
export class PlanListesiComponent implements OnInit {
  private readonly api = inject(YuklemePlanlamaService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly izin = inject(PermissionService);
  private readonly destroyRef = inject(DestroyRef);

  readonly breadcrumb = [{ label: 'Ana Kontrol Paneli', link: '/dashboard' }, { label: 'Yükleme Planları' }];
  readonly SAYFA_BOYUTLARI = [25, 50, 100];
  readonly CALISMA_BICIMI = CALISMA_BICIMI;
  readonly PROJE_KARISIMI = PROJE_KARISIMI;
  readonly Bicim = YuklemeCalismaBicimi;
  readonly Karisim = YuklemeProjeKarisimi;

  readonly yazabilir = computed(() => this.izin.canWrite(YETKI.YUKLEME_PLANLAMA.PLANLAR));

  readonly arama = signal('');
  readonly sayfa = signal(1);
  readonly boyut = signal(25);
  readonly liste = signal<PaginatedList<YuklemePlaniOzeti> | null>(null);
  readonly yukleniyor = signal(false);
  private readonly aramaAkisi = new Subject<void>();

  // ----- Yeni plan penceresi -----
  readonly yeniAcik = signal(false);
  readonly tanimlar = signal<YuklemePlaniTanimlari | null>(null);
  readonly ad = signal('');
  readonly calismaBicimi = signal<YuklemeCalismaBicimi>(YuklemeCalismaBicimi.IhtiyacaGoreArac);
  readonly tasimaAilesiId = signal<number | null>(null);
  readonly projeKarisimi = signal<YuklemeProjeKarisimi>(YuklemeProjeKarisimi.Karisik);
  readonly yuklemeTarihi = signal('');
  readonly aciklama = signal('');
  readonly seciliProjeler = signal<Map<number, PlanProjeAdayi>>(new Map());
  readonly adayArama = signal('');
  readonly adaySayfa = signal(1);
  readonly adaylar = signal<PaginatedList<PlanProjeAdayi> | null>(null);
  readonly adayYukleniyor = signal(false);
  readonly olusturuluyor = signal(false);
  private readonly adayAramaAkisi = new Subject<void>();

  readonly gelecekSandik = computed(() =>
    [...this.seciliProjeler().values()].reduce((t, p) => t + p.planaGelecekSandikSayisi, 0));
  readonly sevkliSandik = computed(() =>
    [...this.seciliProjeler().values()].reduce((t, p) => t + p.sevkEdilmisSandikSayisi, 0));
  readonly olusturulabilir = computed(() =>
    !!this.ad().trim() && !!this.tasimaAilesiId() && this.seciliProjeler().size > 0 && !this.olusturuluyor());

  ngOnInit(): void {
    this.aramaAkisi.pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.sayfa.set(1);
      this.yukle();
    });
    this.adayAramaAkisi.pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.adaySayfa.set(1);
      this.adaylariYukle();
    });
    this.yukle();
  }

  yukle(): void {
    this.yukleniyor.set(true);
    this.api.planlar(this.arama(), this.sayfa(), this.boyut())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((r) => {
        this.yukleniyor.set(false);
        if (r.isSuccess && r.value) this.liste.set(r.value);
        else this.toast.error(r.error ?? 'Planlar yüklenemedi.');
      });
  }

  aramaDegisti(metin: string): void {
    this.arama.set(metin);
    this.aramaAkisi.next();
  }

  sayfaDegisti(sayfa: number): void {
    this.sayfa.set(sayfa);
    this.yukle();
  }

  boyutDegisti(boyut: number): void {
    this.boyut.set(boyut);
    this.sayfa.set(1);
    this.yukle();
  }

  ac(plan: YuklemePlaniOzeti): void {
    this.router.navigate(['/yukleme-planlari', plan.id]);
  }

  yeniPlan(): void {
    if (!this.yazabilir()) return;
    this.ad.set('');
    this.calismaBicimi.set(YuklemeCalismaBicimi.IhtiyacaGoreArac);
    this.projeKarisimi.set(YuklemeProjeKarisimi.Karisik);
    this.yuklemeTarihi.set('');
    this.aciklama.set('');
    this.seciliProjeler.set(new Map());
    this.adayArama.set('');
    this.adaySayfa.set(1);
    this.yeniAcik.set(true);
    if (!this.tanimlar()) {
      this.api.tanimlar().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((r) => {
        if (r.isSuccess && r.value) {
          this.tanimlar.set(r.value);
          if (!this.tasimaAilesiId() && r.value.tasimaAileleri.length) this.tasimaAilesiId.set(r.value.tasimaAileleri[0].id);
        } else {
          this.toast.error(r.error ?? 'Tanımlar yüklenemedi.');
        }
      });
    }
    this.adaylariYukle();
  }

  kapat(): void {
    this.yeniAcik.set(false);
  }

  adaylariYukle(): void {
    this.adayYukleniyor.set(true);
    this.api.projeAdaylari(this.adayArama(), this.adaySayfa(), 10)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((r) => {
        this.adayYukleniyor.set(false);
        if (r.isSuccess && r.value) this.adaylar.set(r.value);
        else this.toast.error(r.error ?? 'Projeler yüklenemedi.');
      });
  }

  adayAramaDegisti(metin: string): void {
    this.adayArama.set(metin);
    this.adayAramaAkisi.next();
  }

  adaySayfaDegisti(sayfa: number): void {
    this.adaySayfa.set(sayfa);
    this.adaylariYukle();
  }

  projeSeciliMi(projeId: number): boolean {
    return this.seciliProjeler().has(projeId);
  }

  projeDegistir(proje: PlanProjeAdayi): void {
    const yeni = new Map(this.seciliProjeler());
    if (yeni.has(proje.projeId)) yeni.delete(proje.projeId);
    else yeni.set(proje.projeId, proje);
    this.seciliProjeler.set(yeni);
  }

  olustur(): void {
    if (!this.olusturulabilir()) return;
    this.olusturuluyor.set(true);
    this.api.olustur({
      ad: this.ad().trim(),
      calismaBicimi: this.calismaBicimi(),
      tasimaAilesiId: this.tasimaAilesiId()!,
      projeKarisimi: this.projeKarisimi(),
      yuklemeTarihi: this.yuklemeTarihi() || null,
      aciklama: this.aciklama().trim() || null,
      projeIdleri: [...this.seciliProjeler().keys()],
    }).subscribe((r) => {
      this.olusturuluyor.set(false);
      if (r.isSuccess && r.value) {
        this.toast.success(`${r.value.planNo} oluşturuldu.`);
        this.yeniAcik.set(false);
        this.router.navigate(['/yukleme-planlari', r.value.id]);
      } else {
        this.toast.error(r.error ?? 'Plan oluşturulamadı.');
      }
    });
  }
}
