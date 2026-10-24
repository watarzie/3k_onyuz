import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpParams } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BreadcrumbComponent } from '../../../shared/components/breadcrumb/breadcrumb.component';
import { StatCardComponent } from '../../../shared/components/stat-card/stat-card.component';
import { BaseApiService } from '../../../core/services/base-api.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ToastService } from '../../../core/services/toast.service';
import { API } from '../../../core/constants/api-endpoints';
import { ProjeTipi } from '../../../core/constants/enums';
import { projeTipiBaglami } from '../../../core/constants/proje-tipi';
import { dosyaAdiBasliktan, dosyayiKaydet } from '../../../core/services/dosya-kaydet';
import { BarkodUrunAramaParams, BarkodUrunAramaSonucu, BarkodUrunSatiri } from '../../../shared/models/index';

/** Sunucudaki BarkodUrunAramaKurali.EnFazlaUzunluk ile aynı. */
export const BARKOD_EN_FAZLA = 100;

/**
 * Barkodla ürün arama (barkod-urun-arama R): bir barkodun Normal/Saha/Yedek bütün projelerdeki satırları, projeye
 * girmeden. Varsayılan yalnız eksikler, eksikler önce; PDF/Excel raporu ekrandaki süzgeçle aynı satırları her satırda
 * proje no ile yazar. Barkod adres çubuğunda (?barkod=) tutulur; satırdaki proje no, kullanıcının o proje tipinde Grid
 * modülü izni varsa Grid ekranına götürür.
 */
@Component({
  selector: 'app-barkod-arama',
  standalone: true,
  imports: [DecimalPipe, RouterLink, BreadcrumbComponent, StatCardComponent],
  templateUrl: './barkod-arama.component.html',
  styleUrl: './barkod-arama.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BarkodAramaComponent implements OnInit {
  private readonly api = inject(BaseApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly permissions = inject(PermissionService);
  private readonly destroyRef = inject(DestroyRef);

  readonly BARKOD_EN_FAZLA = BARKOD_EN_FAZLA;
  readonly breadcrumb = [
    { label: 'Ana Kontrol Paneli', link: '/dashboard' },
    { label: 'Sandık Yönetimi', link: '/sandik-yonetimi' },
    { label: 'Barkodla Ürün Arama' },
  ];
  readonly projeTipiSecenekleri = [
    { deger: null, etiket: 'Tüm projeler' },
    { deger: ProjeTipi.Normal, etiket: 'Normal' },
    { deger: ProjeTipi.Saha, etiket: 'Saha' },
    { deger: ProjeTipi.Yedek, etiket: 'Yedek' },
  ] as const;

  readonly barkodTaslak = signal('');
  readonly yalnizEksikler = signal(true);
  readonly projeTipiId = signal<number | null>(null);
  readonly sonuc = signal<BarkodUrunAramaSonucu | null>(null);
  readonly yukleniyor = signal(false);
  readonly hata = signal('');
  readonly indiriliyor = signal<'pdf' | 'excel' | null>(null);
  /** Son başarılı aramanın ölçütleri; rapor bunları kullanır (yazılan ama aranmamış barkod değil). */
  private readonly sonArama = signal<BarkodUrunAramaParams | null>(null);

  readonly satirlar = computed(() => this.sonuc()?.satirlar ?? []);
  readonly aranabilir = computed(() => {
    const barkod = this.barkodTaslak().trim();
    return !!barkod && barkod.length <= BARKOD_EN_FAZLA && !this.yukleniyor();
  });

  ngOnInit(): void {
    const parametreler = this.route.snapshot.queryParamMap;
    const barkod = parametreler.get('barkod')?.trim();
    if (parametreler.get('tumu') === '1') this.yalnizEksikler.set(false);
    const tip = Number(parametreler.get('tip'));
    if ([ProjeTipi.Normal, ProjeTipi.Saha, ProjeTipi.Yedek].includes(tip)) this.projeTipiId.set(tip);
    if (barkod) {
      this.barkodTaslak.set(barkod);
      this.ara();
    }
  }

  ara(): void {
    if (!this.aranabilir()) return;
    const params: BarkodUrunAramaParams = {
      barkod: this.barkodTaslak().trim(),
      yalnizEksikler: this.yalnizEksikler(),
      projeTipiId: this.projeTipiId(),
    };
    this.yukleniyor.set(true);
    this.hata.set('');
    this.adresiGuncelle(params);
    this.api.get<BarkodUrunAramaSonucu>(API.BARKOD_ARAMA.ARA, { params: this.httpParams(params) })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(res => {
        this.yukleniyor.set(false);
        if (res.isSuccess && res.value) {
          this.sonuc.set(res.value);
          this.sonArama.set(params);
          return;
        }
        this.sonuc.set(null);
        this.sonArama.set(null);
        this.hata.set(res.error || 'Arama yapılamadı.');
      });
  }

  /** Süzgeç değişince son barkodla yeniden aranır. */
  yalnizEksiklerDegisti(deger: boolean): void {
    this.yalnizEksikler.set(deger);
    if (this.sonArama()) this.ara();
  }

  projeTipiDegisti(deger: string): void {
    this.projeTipiId.set(deger ? Number(deger) : null);
    if (this.sonArama()) this.ara();
  }

  raporIndir(format: 'pdf' | 'excel'): void {
    const params = this.sonArama();
    if (!params || this.indiriliyor()) return;
    this.indiriliyor.set(format);
    this.api.downloadFileResponse(API.BARKOD_ARAMA.RAPOR(format), { params: this.httpParams(params) })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: yanit => {
          this.indiriliyor.set(null);
          const varsayilan = `BarkodArama_${params.barkod}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
          dosyayiKaydet(yanit.body!, dosyaAdiBasliktan(yanit.headers.get('Content-Disposition'), varsayilan));
        },
        error: async hata => {
          this.indiriliyor.set(null);
          this.toast.error(await this.api.downloadErrorMessage(hata, 'Rapor indirilemedi.'));
        },
      });
  }

  projeTipiAdi(projeTipiId: number): string {
    return projeTipiBaglami(projeTipiId).ad;
  }

  /** Satırın proje tipinde Grid modülü izni varsa Grid ekranı rotası; yoksa null (proje no düz metin kalır). */
  gridRotasi(satir: BarkodUrunSatiri): string[] | null {
    const baglam = projeTipiBaglami(satir.projeTipiId);
    return this.permissions.hasAccess(baglam.yetki.gridModulu) ? [baglam.gridRotasi, String(satir.projeId)] : null;
  }

  private httpParams(params: BarkodUrunAramaParams): HttpParams {
    let sorgu = new HttpParams().set('barkod', params.barkod).set('yalnizEksikler', String(params.yalnizEksikler));
    if (params.projeTipiId) sorgu = sorgu.set('projeTipiId', String(params.projeTipiId));
    return sorgu;
  }

  /** Arama adres çubuğuna yazılır: sayfa yenilenince veya bağlantı paylaşılınca aynı sonuç açılır. */
  private adresiGuncelle(params: BarkodUrunAramaParams): void {
    this.router.navigate([], {
      relativeTo: this.route,
      replaceUrl: true,
      queryParams: { barkod: params.barkod, tumu: params.yalnizEksikler ? null : '1', tip: params.projeTipiId ?? null },
    });
  }
}
