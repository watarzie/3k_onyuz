import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, switchMap, tap } from 'rxjs';
import { BreadcrumbComponent } from '../../../shared/components/breadcrumb/breadcrumb.component';
import { ServerPagerComponent } from '../../../shared/components/server-pager/server-pager.component';
import { ToastService } from '../../../core/services/toast.service';
import { PermissionService } from '../../../core/services/permission.service';
import { YuklemePlanlamaService } from '../../../core/services/yukleme-planlama.service';
import { YETKI } from '../../../core/constants/yetki-kodlari';
import {
  PaginatedList,
  PlanProjeAdayi,
  YuklemePlanAyarlari,
  YuklemePlaniOzeti,
  YuklemePlaniTanimlari,
} from '../../../shared/models/index';
import { PlanSecimleriComponent, YENI_PLAN_AYARLARI } from '../ortak/plan-secimleri.component';

/**
 * Yükleme planları listesi (sunucuda sayfalı) ve yeni plan penceresi. Yeni plan tek adımdır (saha geri bildirimi
 * 19.11.2026 madde 5): proje, taşıma ailesi/tip ve paylar seçilip "Hesapla" denir; plan kaydı arka planda açılır, ekran
 * araç sayısı, 3B ve PDF ile açılır. Seçilen projelerin bütün sandıkları (sevk edilmişler dahil) gelir.
 */
@Component({
  selector: 'app-plan-listesi',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, FormsModule, BreadcrumbComponent, ServerPagerComponent, PlanSecimleriComponent],
  templateUrl: './plan-listesi.component.html',
  styleUrls: ['../ortak/yukleme.scss', './plan-listesi.component.scss'],
})
export class PlanListesiComponent implements OnInit {
  private readonly api = inject(YuklemePlanlamaService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly permissions = inject(PermissionService);
  private readonly destroyRef = inject(DestroyRef);

  readonly breadcrumb = [{ label: 'Ana Kontrol Paneli', link: '/dashboard' }, { label: 'Yükleme Planları' }];
  readonly SAYFA_BOYUTLARI = [25, 50, 100];

  readonly yazabilir = computed(() => this.permissions.canWrite(YETKI.YUKLEME_PLANLAMA.PLANLAR));

  readonly arama = signal('');
  readonly sayfa = signal(1);
  readonly boyut = signal(25);
  readonly liste = signal<PaginatedList<YuklemePlaniOzeti> | null>(null);
  readonly yukleniyor = signal(false);
  private readonly aramaAkisi = new Subject<void>();

  // ----- Yeni plan penceresi -----
  readonly yeniAcik = signal(false);
  readonly tanimlar = signal<YuklemePlaniTanimlari | null>(null);
  readonly tasimaAilesiId = signal<number | null>(null);
  readonly ayarlar = signal<YuklemePlanAyarlari>(YENI_PLAN_AYARLARI);
  readonly seciliProjeler = signal<Map<number, PlanProjeAdayi>>(new Map());
  readonly adayArama = signal('');
  readonly adaySayfa = signal(1);
  readonly adaylar = signal<PaginatedList<PlanProjeAdayi> | null>(null);
  readonly adayYukleniyor = signal(false);
  readonly hesaplaniyor = signal(false);
  private readonly adayAramaAkisi = new Subject<void>();
  /** Aday istekleri tek akıştan geçer: eski yanıt yeni aramanın ya da sayfanın sonucunu ezmez. */
  private readonly adayIstekleri = new Subject<void>();

  readonly gelecekSandik = computed(() =>
    [...this.seciliProjeler().values()].reduce((t, p) => t + p.planaGelecekSandikSayisi, 0));
  readonly hesaplanabilir = computed(() => !!this.tasimaAilesiId() && this.seciliProjeler().size > 0 && !this.hesaplaniyor());

  ngOnInit(): void {
    this.aramaAkisi.pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.sayfa.set(1);
      this.yukle();
    });
    this.adayAramaAkisi.pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.adaySayfa.set(1);
      this.adaylariYukle();
    });
    this.adayIstekleri
      .pipe(
        tap(() => this.adayYukleniyor.set(true)),
        switchMap(() => this.api.projeAdaylari(this.adayArama(), this.adaySayfa(), 10)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((r) => {
        this.adayYukleniyor.set(false);
        if (r.isSuccess && r.value) this.adaylar.set(r.value);
        else this.toast.error(r.error ?? 'Projeler yüklenemedi.');
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
    this.ayarlar.set(YENI_PLAN_AYARLARI);
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
    this.adayIstekleri.next();
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

  /** Tek adımda planı açar ve yerleşimi hesaplar; plan ekranı sonuçla açılır. */
  hesapla(): void {
    if (!this.hesaplanabilir()) return;
    this.hesaplaniyor.set(true);
    this.api.planHesapla({
      planId: null,
      beklenenRevizyonNo: null,
      projeIdleri: [...this.seciliProjeler().keys()],
      tasimaAilesiId: this.tasimaAilesiId()!,
      ayarlar: this.ayarlar(),
    }).subscribe((r) => {
      this.hesaplaniyor.set(false);
      if (r.isSuccess && r.value) {
        this.toast.success(`${r.value.planNo}: ${r.value.yerlesim?.araclar.length ?? 0} araç hesaplandı.`);
        this.yeniAcik.set(false);
        this.router.navigate(['/yukleme-planlari', r.value.id]);
      } else {
        this.toast.error(r.error ?? 'Plan hesaplanamadı.');
      }
    });
  }
}
