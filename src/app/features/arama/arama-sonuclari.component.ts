import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { map, of, switchMap, tap } from 'rxjs';
import { BreadcrumbComponent } from '../../shared/components/breadcrumb/breadcrumb.component';
import { PermissionService } from '../../core/services/permission.service';
import { projeTipiBaglami } from '../../core/constants/proje-tipi';
import { GenelAramaProje, GenelAramaSandik, GenelAramaSonucu, GenelAramaUrun } from '../../shared/models/index';
import {
  GENEL_ARAMA_EN_AZ,
  GENEL_ARAMA_SAYFA_LIMITI,
  GenelAramaService,
  projeRotasi,
  sandikRotasi,
  urunRotasi,
} from '../../layout/genel-arama/genel-arama';

/**
 * Genel aramanın tam sonuç sayfası (/arama?q=…): üst çubukta Enter'a basınca açılır. Gruplar (Ürünler, Projeler,
 * Sandıklar) panelden daha çok sonuçla, yine kullanıcının iznine göre gelir. Oturum açmış her kullanıcıya açıktır; sunucu
 * izni olmayan grubu boş döndürür.
 */
@Component({
  selector: 'app-arama-sonuclari',
  standalone: true,
  imports: [RouterLink, BreadcrumbComponent],
  templateUrl: './arama-sonuclari.component.html',
  styleUrl: './arama-sonuclari.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AramaSonuclariComponent {
  private readonly service = inject(GenelAramaService);
  private readonly permissions = inject(PermissionService);

  readonly breadcrumb = [{ label: 'Ana Kontrol Paneli', link: '/dashboard' }, { label: 'Arama' }];
  readonly LIMIT = GENEL_ARAMA_SAYFA_LIMITI;
  readonly q = signal('');
  readonly yukleniyor = signal(false);
  readonly hata = signal('');
  readonly sonuc = signal<GenelAramaSonucu | null>(null);
  readonly sonucVar = computed(() => {
    const s = this.sonuc();
    return !!s && s.projeler.length + s.urunler.length + s.sandiklar.length > 0;
  });

  constructor() {
    inject(ActivatedRoute).queryParamMap
      .pipe(
        map(p => (p.get('q') ?? '').trim()),
        tap(q => {
          this.q.set(q);
          this.hata.set('');
          this.yukleniyor.set(q.length >= GENEL_ARAMA_EN_AZ);
        }),
        switchMap(q => q.length >= GENEL_ARAMA_EN_AZ ? this.service.ara(q, GENEL_ARAMA_SAYFA_LIMITI) : of(null)),
        takeUntilDestroyed(),
      )
      .subscribe(res => {
        this.yukleniyor.set(false);
        this.sonuc.set(res?.isSuccess ? res.value ?? null : null);
        if (res && !res.isSuccess) this.hata.set(res.error || 'Arama yapılamadı.');
      });
  }

  private izinVar = (kod: string) => this.permissions.hasAccess(kod);

  projeRotasi(p: GenelAramaProje): unknown[] | null {
    return projeRotasi(p, this.izinVar);
  }

  sandikRotasi(s: GenelAramaSandik): unknown[] | null {
    return sandikRotasi(s, this.izinVar);
  }

  urunRotasi(u: GenelAramaUrun) {
    return urunRotasi(u);
  }

  tipAdi(projeTipiId: number): string {
    return projeTipiBaglami(projeTipiId).ad;
  }
}
