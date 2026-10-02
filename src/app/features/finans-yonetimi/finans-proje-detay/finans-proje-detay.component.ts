import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, forkJoin, of } from 'rxjs';
import { AMBALAJ_YETKI, FINANS_YETKI } from '../../../core/constants/yetki-kodlari';
import { FinansIsKategorisi, FinansSandikMalzemesi } from '../../../core/constants/enums';
import { FinansService } from '../../../core/services/finans.service';
import { PermissionService } from '../../../core/services/permission.service';
import { TranslationService } from '../../../core/services/translation.service';
import { FinansFatura, FinansIsKaydi, FinansSayfaliSonuc } from '../../../shared/models/finans.model';
import { FinansFiyatBileseni, FinansVarlikTuru } from '../../../shared/models/finans-v2.model';
import { ApiResult } from '../../../shared/models/common.model';
import { finansSiparisFaturaOkunabilir } from '../ortak/finans-izinleri';
import {
  FINANS_KATEGORILERI,
  isDurumuAnahtari,
  kategoriAnahtari,
  odemeDurumuAnahtari,
  odemeDurumuSinifi,
} from '../ortak/finans-etiketleri';

interface KategoriGrubu {
  kategori: FinansIsKategorisi | undefined;
  kalemler: FinansIsKaydi[];
  ahsapM3: number;
  kontraM3: number;
}

/**
 * Proje detayı (R1 §49, F5, F11): projenin bütün aylardaki finans kalemleri kategori ve sandık kırılımıyla,
 * kontra/katlanır fiyat satırlarıyla, PO ve fatura bağlantılarıyla ve faturaların ödeme durumuyla gösterilir.
 */
@Component({
  selector: 'app-finans-proje-detay',
  standalone: true,
  imports: [DatePipe, DecimalPipe],
  templateUrl: './finans-proje-detay.component.html',
  styleUrls: ['../ortak/finans-v2.scss', '../ortak/finans-islem-dialoglari.scss'],
})
export class FinansProjeDetayComponent implements OnInit {
  private readonly translation = inject(TranslationService);
  t(key: string): string {
    return this.translation.translate(`FINANS_V2.${key}`);
  }
  private readonly service = inject(FinansService);
  private readonly destroyRef = inject(DestroyRef);
  readonly permissions = inject(PermissionService);
  readonly izin = FINANS_YETKI;
  readonly malzeme = FinansSandikMalzemesi;
  readonly kategoriAnahtari = kategoriAnahtari;
  readonly isDurumuAnahtari = isDurumuAnahtari;
  readonly odemeDurumuAnahtari = odemeDurumuAnahtari;
  readonly odemeDurumuSinifi = odemeDurumuSinifi;
  readonly projeNo = input.required<string>();
  readonly musteri = input('');
  readonly kapat = output<void>();
  readonly kayitAc = output<{ tur: FinansVarlikTuru; id: number }>();

  readonly loading = signal(false);
  readonly hata = signal('');
  readonly kalemler = signal<FinansIsKaydi[]>([]);
  readonly faturalar = signal<FinansFatura[]>([]);
  /** Sayfa sınırına takılan (250'den fazla kalem/fatura) projede eksik gösterim uyarısı. */
  readonly eksikGosterim = signal(false);

  readonly gruplar = computed<KategoriGrubu[]>(() => {
    const harita = new Map<FinansIsKategorisi | undefined, FinansIsKaydi[]>();
    for (const kalem of this.kalemler()) harita.set(kalem.kategori, [...(harita.get(kalem.kategori) ?? []), kalem]);
    const sira = (k: FinansIsKategorisi | undefined) => {
      const index = FINANS_KATEGORILERI.findIndex((x) => x.deger === k);
      return index < 0 ? FINANS_KATEGORILERI.length : index;
    };
    return [...harita.entries()]
      .sort(([a], [b]) => sira(a) - sira(b))
      .map(([kategori, kalemler]) => ({
        kategori,
        kalemler: [...kalemler].sort((a, b) => (a.sandikNo ?? '').localeCompare(b.sandikNo ?? '', 'tr-TR', { numeric: true })),
        ahsapM3: kalemler.reduce((t, x) => t + (x.ahsapM3 ?? 0), 0),
        kontraM3: kalemler.reduce((t, x) => t + (x.kontraM3 ?? 0), 0),
      }));
  });
  /** Proje toplamları para birimi bazında; para birimleri toplanmaz. */
  readonly toplamlar = computed(() => {
    const harita = new Map<string, number>();
    for (const kalem of this.kalemler())
      if (kalem.netTutar != null && kalem.paraBirimi) harita.set(kalem.paraBirimi, (harita.get(kalem.paraBirimi) ?? 0) + kalem.netTutar);
    return [...harita.entries()].map(([paraBirimi, net]) => ({ paraBirimi, net }));
  });
  readonly faturaDurumlari = computed(() => new Map(this.faturalar().map((f) => [f.faturaNumarasi, f])));

  ngOnInit(): void {
    this.loading.set(true);
    const projeNo = this.projeNo();
    const faturalar$ = finansSiparisFaturaOkunabilir(this.permissions)
      ? this.service.faturalar({ pageNumber: 1, pageSize: 250, projeNo })
      : of<ApiResult<FinansSayfaliSonuc<FinansFatura>>>({ isSuccess: true });
    forkJoin({ kalemler: this.service.genelArama({ pageNumber: 1, pageSize: 250, projeNo }), faturalar: faturalar$ })
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ kalemler, faturalar }) => {
        if (!kalemler.isSuccess) {
          this.hata.set(kalemler.error ?? this.t('PROJECT_DETAIL_ERROR'));
          return;
        }
        this.kalemler.set(kalemler.value?.items ?? []);
        this.faturalar.set(faturalar.isSuccess ? (faturalar.value?.items ?? []) : []);
        this.eksikGosterim.set((kalemler.value?.totalCount ?? 0) > 250 || (faturalar.value?.totalCount ?? 0) > 250);
      });
  }

  parasal(kod: string): boolean {
    return this.permissions.hasAccess(this.izin.ParasalVeriGoruntule) && this.permissions.hasAccess(kod);
  }
  m3Gorunur(): boolean {
    return this.permissions.hasAccess(AMBALAJ_YETKI.M3Goruntule);
  }
  satirTutari(b: FinansFiyatBileseni): number {
    const miktar = b.yontem === 3 || b.yontem === 4 ? 1 : b.miktar;
    return Math.round(miktar * b.birimFiyat * 100) / 100;
  }
  malzemeEtiketi(b: FinansFiyatBileseni): string {
    if (b.yontem !== 2) return '';
    return b.malzeme === FinansSandikMalzemesi.Ahsap
      ? this.t('MATERIAL_WOOD')
      : b.malzeme === FinansSandikMalzemesi.Kontra
        ? this.t('PLYWOOD_FOLDING')
        : this.t('PRICE_LINE_MATERIAL_CRATE');
  }
}
