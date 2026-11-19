import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, switchMap } from 'rxjs';
import { BreadcrumbComponent } from '../../../shared/components/breadcrumb/breadcrumb.component';
import { ServerPagerComponent } from '../../../shared/components/server-pager/server-pager.component';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmService, duzMetin } from '../../../core/services/confirm.service';
import { PermissionService } from '../../../core/services/permission.service';
import { YuklemePlanlamaService } from '../../../core/services/yukleme-planlama.service';
import { YETKI } from '../../../core/constants/yetki-kodlari';
import {
  PaginatedList,
  PlanProjeAdayi,
  PlanProjeBilgisi,
  PlanYukDurumu,
  PlanYukKaynagi,
  YerlesimKontrolSonucu,
  YuklemePlanAyarlari,
  YuklemePlaniDetayi,
  YuklemePlaniTanimlari,
} from '../../../shared/models/index';
import { satirAnahtari } from '../ortak/plan-yuk-listesi';
import { PlanSecimleriComponent, YENI_PLAN_AYARLARI } from '../ortak/plan-secimleri.component';
import { KAYNAK_FARKI, YUK_DURUMU } from '../ortak/yukleme-etiketleri';
import { PlanYerlesimComponent } from './plan-yerlesim.component';

type DurumSuzgeci = 'hepsi' | PlanYukDurumu;

/**
 * Yükleme planı (saha geri bildirimi 19.11.2026 madde 5, 6, 9): projeler, araç (aile ve isteğe bağlı tip) ve güvenlik
 * payları seçilir, "Hesapla" tek adımda planı güncel kaynaktan (sevk edilmiş sandıklar dahil) kurar ve yerleşimi yazar.
 * Kaydetme, revizyon notu, yük izinleri ve elle yük ekleme yoktur; yük listesi salt okunurdur. Elle yerleşim
 * düzenleyicisi yerleşim kartında ikincil seçenek olarak kalır.
 */
@Component({
  selector: 'app-plan-duzenle',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DecimalPipe, FormsModule, BreadcrumbComponent, ServerPagerComponent, PlanSecimleriComponent, PlanYerlesimComponent],
  templateUrl: './plan-duzenle.component.html',
  styleUrls: ['../ortak/yukleme.scss', './plan-duzenle.component.scss'],
})
export class PlanDuzenleComponent implements OnInit {
  private readonly api = inject(YuklemePlanlamaService);
  private readonly toast = inject(ToastService);
  private readonly onay = inject(ConfirmService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly permissions = inject(PermissionService);
  private readonly destroyRef = inject(DestroyRef);

  readonly YUK_DURUMU = YUK_DURUMU;
  readonly KAYNAK_FARKI = KAYNAK_FARKI;
  readonly Durum = PlanYukDurumu;
  readonly Kaynak = PlanYukKaynagi;
  readonly anahtar = satirAnahtari;

  readonly yazabilir = computed(() => this.permissions.canWrite(YETKI.YUKLEME_PLANLAMA.PLANLAR));

  readonly planId = signal(0);
  readonly plan = signal<YuklemePlaniDetayi | null>(null);
  readonly tanimlar = signal<YuklemePlaniTanimlari | null>(null);
  readonly yukleniyor = signal(true);
  readonly hesaplaniyor = signal(false);
  /** Seçimler (proje, aile/tip, pay) son hesaptan farklı: yeni sonuç için "Hesapla" gerekir. */
  readonly degisti = signal(false);
  /** Elle yerleşim düzenleyicisi açık: kaydı son hesaplanan revizyona yazılır, bu sırada seçimler değiştirilemez. */
  readonly elleDuzenleme = signal(false);
  /** Seçimler kilitli: izin yok, hesap sürüyor ya da elle düzenleme açık (yanıt seçimleri sessizce ezmesin). */
  readonly kilitli = computed(() => !this.yazabilir() || this.hesaplaniyor() || this.elleDuzenleme());

  // ----- Seçimler -----
  readonly tasimaAilesiId = signal<number | null>(null);
  readonly ayarlar = signal<YuklemePlanAyarlari>(YENI_PLAN_AYARLARI);
  readonly projeler = signal<PlanProjeBilgisi[]>([]);
  readonly projeIdleri = computed(() => this.projeler().filter((p) => p.projeId != null).map((p) => p.projeId!));

  readonly breadcrumb = computed(() => [
    { label: 'Ana Kontrol Paneli', link: '/dashboard' },
    { label: 'Yükleme Planları', link: '/yukleme-planlari' },
    { label: this.plan()?.planNo ?? 'Plan' },
  ]);

  // ----- Yük listesi (salt okunur) ve süzgeç -----
  readonly arama = signal('');
  readonly durumSuzgeci = signal<DurumSuzgeci>('hepsi');
  readonly projeSuzgeci = signal<number | 'hepsi' | 'manuel'>('hepsi');
  readonly elleYukVar = computed(() => (this.plan()?.yukler ?? []).some((s) => s.kaynak === PlanYukKaynagi.Manuel));
  readonly gorunenler = computed(() => {
    const metin = this.arama().trim().toLocaleLowerCase('tr-TR');
    const durum = this.durumSuzgeci();
    const proje = this.projeSuzgeci();
    return (this.plan()?.yukler ?? []).filter((s) =>
      (durum === 'hepsi' || s.durum === durum) &&
      (proje === 'hepsi' || (proje === 'manuel' ? s.kaynak === PlanYukKaynagi.Manuel : s.projeId === proje)) &&
      (!metin || s.kod.toLocaleLowerCase('tr-TR').includes(metin) || (s.aciklama ?? '').toLocaleLowerCase('tr-TR').includes(metin)));
  });

  // ----- Proje ekleme penceresi -----
  readonly projeEkleAcik = signal(false);
  readonly adayArama = signal('');
  readonly adaySayfa = signal(1);
  readonly adaylar = signal<PaginatedList<PlanProjeAdayi> | null>(null);
  private readonly adayAramaAkisi = new Subject<void>();
  /** Aday istekleri tek akıştan geçer: eski yanıt yeni aramanın ya da sayfanın sonucunu ezmez. */
  private readonly adayIstekleri = new Subject<void>();

  ngOnInit(): void {
    this.adayAramaAkisi.pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.adaySayfa.set(1);
      this.adaylariYukle();
    });
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((p) => {
      this.planId.set(Number(p.get('id')));
      this.yukle();
    });
    this.adayIstekleri
      .pipe(switchMap(() => this.api.projeAdaylari(this.adayArama(), this.adaySayfa(), 10)), takeUntilDestroyed(this.destroyRef))
      .subscribe((r) => {
        if (r.isSuccess && r.value) this.adaylar.set(r.value);
        else this.toast.error(r.error ?? 'Projeler yüklenemedi.');
      });
    this.api.tanimlar().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((r) => {
      if (r.isSuccess && r.value) this.tanimlar.set(r.value);
      else this.toast.error(r.error ?? 'Taşıma aileleri yüklenemedi.');
    });
  }

  yukle(): void {
    this.yukleniyor.set(true);
    this.api.plan(this.planId()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe((r) => {
      this.yukleniyor.set(false);
      if (r.isSuccess && r.value) this.planiYerlestir(r.value);
      else {
        this.toast.error(r.error ?? 'Plan yüklenemedi.');
        if (r.statusCode === 404) this.router.navigate(['/yukleme-planlari']);
      }
    });
  }

  private planiYerlestir(p: YuklemePlaniDetayi): void {
    this.plan.set(p);
    this.tasimaAilesiId.set(p.tasimaAilesiId);
    this.ayarlar.set({ ...p.ayarlar, mevcutAraclar: [], tipIdleri: [...(p.ayarlar.tipIdleri ?? [])] });
    this.projeler.set([...p.projeler]);
    this.degisti.set(false);
  }

  aileDegistir(aileId: number): void {
    this.tasimaAilesiId.set(aileId);
    this.degisti.set(true);
  }

  ayarlarDegistir(ayarlar: YuklemePlanAyarlari): void {
    this.ayarlar.set(ayarlar);
    this.degisti.set(true);
  }

  /**
   * Tek adımlı hesap: seçimlerle plan güncel kaynaktan yeniden kurulur ve yerleşim aynı revizyonda yazılır. Yerleşim elle
   * düzenlenmişse önce sorulur (elle düzenleme geçmiş revizyonda kalır).
   */
  async hesapla(): Promise<void> {
    const p = this.plan();
    if (!p || this.hesaplaniyor() || !this.yazabilir()) return;
    if (!this.tasimaAilesiId()) return this.toast.error('Taşıma ailesi seçiniz.');
    if (!this.projeIdleri().length) return this.toast.error('Plana en az bir proje ekleyiniz.');
    if (p.yerlesim?.elleDuzenlendi) {
      const tamam = await this.onay.ask({
        title: 'Yeniden hesapla',
        message: 'Yerleşim elle düzenlendi. Yeniden hesaplamak elle düzenlemeyi otomatik öneriyle değiştirir (eski revizyonda kalır).',
        confirmText: 'Hesapla',
        type: 'warning',
      });
      if (!tamam) return;
    }
    this.hesaplaniyor.set(true);
    this.api.planHesapla({
      planId: p.id,
      beklenenRevizyonNo: p.revizyonNo,
      projeIdleri: this.projeIdleri(),
      tasimaAilesiId: this.tasimaAilesiId()!,
      ayarlar: this.ayarlar(),
    }).subscribe((r) => {
      this.hesaplaniyor.set(false);
      if (r.isSuccess && r.value) {
        this.planiYerlestir(r.value);
        const y = r.value.yerlesim;
        this.toast.success(y
          ? `Yerleşim hesaplandı: ${y.araclar.length} araç, ${r.value.sayaclar.yerlesemeyen} yerleşemeyen yük.`
          : 'Yerleşim hesaplandı.');
      } else {
        this.toast.error(r.statusCode === 409
          ? `Sayfayı yenileyip tekrar deneyin. ${r.error ?? 'Plan arada başka biri tarafından hesaplandı.'}`
          : r.error ?? 'Yerleşim hesaplanamadı.');
      }
    });
  }

  /** Elle düzenlenen yerleşim yeni revizyon olarak kaydedildi. */
  elleKaydedildi(p: YuklemePlaniDetayi): void {
    this.planiYerlestir(p);
    this.toast.success(p.yerlesim?.sonuc === YerlesimKontrolSonucu.Uygunsuz
      ? `Elle yerleşim revizyon ${p.revizyonNo} olarak kaydedildi; uygunsuzluk var, raporlar taslak basılır.`
      : `Elle yerleşim revizyon ${p.revizyonNo} olarak kaydedildi.`);
  }

  /** Seçimleri son hesaba döndürür. */
  vazgec(): void {
    const p = this.plan();
    if (p && this.degisti()) this.planiYerlestir(p);
  }

  // ----- Proje ekleme ve çıkarma -----

  projeEkle(): void {
    this.adayArama.set('');
    this.adaySayfa.set(1);
    this.projeEkleAcik.set(true);
    this.adaylariYukle();
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

  plandaMi(projeId: number): boolean {
    return this.projeIdleri().includes(projeId);
  }

  adayEkle(a: PlanProjeAdayi): void {
    if (this.kilitli() || this.plandaMi(a.projeId)) return;
    this.projeler.update((l) => [...l, { projeId: a.projeId, projeNo: a.projeNo, musteri: a.musteri, projeTipiId: a.projeTipiId }]);
    this.degisti.set(true);
  }

  async projeCikar(p: PlanProjeBilgisi): Promise<void> {
    if (p.projeId == null || this.kilitli()) return;
    const tamam = await this.onay.ask({
      title: 'Projeyi plandan çıkar',
      message: `${duzMetin(p.projeNo)} projesi plandan çıkacak. Sonraki "Hesapla"da uygulanır.`,
      confirmText: 'Çıkar',
      type: 'warning',
    });
    if (!tamam) return;
    this.projeler.update((l) => l.filter((x) => x.projeId !== p.projeId));
    this.degisti.set(true);
  }
}
