import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, DestroyRef, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, of } from 'rxjs';
import { FinansService } from '../../../core/services/finans.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ToastService } from '../../../core/services/toast.service';
import { TranslationService } from '../../../core/services/translation.service';
import { ApiResult } from '../../../shared/models/common.model';
import { FinansFatura, FinansSayfaliSonuc, FinansSiparis } from '../../../shared/models/finans.model';
import { FinansVarlikTuru } from '../../../shared/models/finans-v2.model';
import { odemeDurumuAnahtari, odemeDurumuSinifi, poDurumuAnahtari } from './finans-etiketleri';
import { finansAltSekmeAcik } from './finans-izinleri';

/** Liste başına en fazla bu kadar PO / fatura getirilir; fazlası için PO ve Faturalar sekmesi önerilir. */
const BELGE_SINIRI = 100;

/**
 * Proje panelinin PO / Fatura sekmesi (İş Takibi ve Kontrol Paneli): projenin bütün dönemlerdeki PO ve faturaları.
 * PO listesi sunucuda PO'lar veya Faturalar alt sekmesine, fatura listesi Faturalar alt sekmesine açıktır; panelin
 * döneminde işlere bağlı belgeler işaretlenir. Proje veya sürüm değişince yeniden yüklenir; eski cevap yazılmaz.
 */
@Component({
  selector: 'app-finans-proje-belgeleri',
  standalone: true,
  imports: [DatePipe, DecimalPipe],
  templateUrl: './finans-proje-belgeleri.component.html',
  styleUrls: ['./finans-proje-paneli.scss'],
})
export class FinansProjeBelgeleriComponent {
  private readonly service = inject(FinansService);
  private readonly permissions = inject(PermissionService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translation = inject(TranslationService);
  t(key: string): string {
    return this.translation.translate(`FINANS_V2.${key}`);
  }

  readonly projeNo = input.required<string>();
  /** Panelin dönemindeki işlere bağlı PO / fatura numaraları ("Bu ay" / "Dönemde" işareti). */
  readonly donemPoNumaralari = input<readonly string[]>([]);
  readonly donemFaturaNumaralari = input<readonly string[]>([]);
  readonly isaretEtiketi = input('');
  readonly notMetni = input('');
  /** Artınca liste yeniden yüklenir (ör. PO / fatura kaydedildi). */
  readonly surum = input(0);
  readonly kayitAc = output<{ tur: FinansVarlikTuru; id: number }>();

  readonly poDurumuAnahtari = poDurumuAnahtari;
  readonly odemeDurumuAnahtari = odemeDurumuAnahtari;
  readonly odemeDurumuSinifi = odemeDurumuSinifi;
  readonly yukleniyor = signal(false);
  readonly belgeler = signal<{ siparisler: FinansSiparis[]; faturalar: FinansFatura[]; eksik: boolean } | null>(null);
  readonly donemPo = computed(() => new Set(this.donemPoNumaralari()));
  readonly donemFatura = computed(() => new Set(this.donemFaturaNumaralari()));
  private nesil = 0;

  constructor() {
    effect(() => {
      const projeNo = this.projeNo();
      this.surum();
      untracked(() => this.yukle(projeNo));
    });
  }

  faturalarOkunur(): boolean {
    return finansAltSekmeAcik(this.permissions, 'fatura');
  }

  private yukle(projeNo: string): void {
    const nesil = ++this.nesil;
    if (!finansAltSekmeAcik(this.permissions, 'po') && !this.faturalarOkunur()) {
      this.belgeler.set(null);
      return;
    }
    const istek = { pageNumber: 1, pageSize: BELGE_SINIRI, projeNo };
    const bos = <T>() => of<ApiResult<FinansSayfaliSonuc<T>>>({ isSuccess: true });
    this.yukleniyor.set(true);
    forkJoin({
      siparisler: this.service.siparisler(istek),
      faturalar: this.faturalarOkunur() ? this.service.faturalar(istek) : bos<FinansFatura>(),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ siparisler, faturalar }) => {
      if (nesil !== this.nesil) return;
      this.yukleniyor.set(false);
      if (!siparisler.isSuccess || !faturalar.isSuccess) {
        this.toast.error(siparisler.error ?? faturalar.error ?? this.t('DRAWER_DOCS_LOAD_ERROR'));
        return;
      }
      this.belgeler.set({
        siparisler: siparisler.value?.items ?? [],
        faturalar: faturalar.value?.items ?? [],
        eksik: (siparisler.value?.totalCount ?? 0) > BELGE_SINIRI || (faturalar.value?.totalCount ?? 0) > BELGE_SINIRI,
      });
    });
  }
}
