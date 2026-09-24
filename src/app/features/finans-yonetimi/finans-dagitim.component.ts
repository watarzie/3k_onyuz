import { TranslationService } from '../../core/services/translation.service';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subject, debounceTime, distinctUntilChanged, finalize, switchMap } from 'rxjs';
import { FinansService } from '../../core/services/finans.service';
import { PermissionService } from '../../core/services/permission.service';
import { ToastService } from '../../core/services/toast.service';
import { ServerPagerComponent } from '../../shared/components/server-pager/server-pager.component';
import {
  FinansIsKaydi,
  FinansSiparis,
  FinansFatura,
  FinansSayfaliSonuc,
  FinansSiparisDetay,
} from '../../shared/models/finans.model';
import { ApiResult } from '../../shared/models/common.model';
import { FinansVarlikTuru } from '../../shared/models/finans-v2.model';

interface DagitimSatiri {
  id: number;
  referans: string;
  ad: string;
  paraBirimi: string;
  kalan: number | null;
  netTutar: number;
  secili: boolean;
}

@Component({
  selector: 'app-finans-dagitim',
  standalone: true,
  imports: [FormsModule, DecimalPipe, DatePipe, ServerPagerComponent],
  templateUrl: './finans-dagitim.component.html',
  styleUrls: ['./finans-v2.scss', './finans-islem-dialoglari.scss'],
})
export class FinansDagitimComponent implements OnInit {
  private readonly translation = inject(TranslationService);
  t(key: string): string {
    return this.translation.translate(`FINANS_V2.${key}`);
  }
  readonly tur = input.required<'Siparis' | 'Fatura'>();
  readonly isKaydiIds = input<readonly number[]>([]);
  readonly siparisId = input<number | null>(null);
  readonly kapat = output<void>();
  readonly kaydedildi = output<{ tur: FinansVarlikTuru; id: number }>();
  private readonly service = inject(FinansService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);
  readonly permissions = inject(PermissionService);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly hata = signal('');
  readonly satirlar = signal<DagitimSatiri[]>([]);
  readonly siparisler = signal<FinansSayfaliSonuc<FinansSiparis> | null>(null);
  readonly seciliPo = signal<FinansSiparisDetay | null>(null);
  readonly poIstekleri = new Subject<void>();
  private readonly poAramalari = new Subject<string>();
  readonly detayIstekleri = new Subject<number>();
  numara = '';
  tarih = this.bugun();
  aciklama = '';
  paraBirimi = '';
  poArama = '';
  pageNumber = 1;

  ngOnInit(): void {
    this.poAramalari
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.pageNumber = 1;
        this.poIstekleri.next();
      });
    this.poIstekleri
      .pipe(
        switchMap(() => {
          this.loading.set(true);
          return this.service
            .siparisler({
              pageNumber: this.pageNumber,
              pageSize: 15,
              arama: this.poArama.trim() || undefined,
              faturaBekleyen: true,
            })
            .pipe(finalize(() => this.loading.set(false)));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        this.siparisler.set(result.isSuccess ? (result.value ?? null) : null);
        if (!result.isSuccess) this.hata.set(result.error ?? this.t('ALLOC_PO_LIST_ERROR'));
      });
    this.detayIstekleri
      .pipe(
        switchMap((id) => {
          this.loading.set(true);
          this.satirlar.set([]);
          this.hata.set('');
          return this.service.siparisDetay(id).pipe(finalize(() => this.loading.set(false)));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        if (!result.isSuccess || !result.value) {
          this.hata.set(result.error ?? this.t('ALLOC_PO_DETAIL_ERROR'));
          return;
        }
        this.seciliPo.set(result.value);
        this.satirlar.set(
          result.value.kalemler.map((row) => ({
            id: row.id,
            referans: row.sandikNo,
            ad: row.sandikAdi,
            paraBirimi: row.paraBirimi,
            kalan: row.kalanFaturaNetTutar ?? null,
            netTutar: 0,
            secili: false,
          })),
        );
        this.paraBirimi = this.satirlar()[0]?.paraBirimi ?? '';
      });
    if (this.tur() === 'Siparis') {
      this.loading.set(true);
      this.service
        .isKayitlariSecim([...this.isKaydiIds()])
        .pipe(
          finalize(() => this.loading.set(false)),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe((result) => {
          if (!result.isSuccess) {
            this.hata.set(result.error ?? this.t('ALLOC_WORK_ERROR'));
            return;
          }
          this.isleriKur(result.value ?? []);
        });
    } else if (this.siparisId()) this.detayIstekleri.next(this.siparisId()!);
    else this.poIstekleri.next();
  }
  isleriKur(rows: FinansIsKaydi[]): void {
    this.satirlar.set(
      rows.map((row) => ({
        id: row.id,
        referans: `${row.projeNo} · ${row.sandikNo || ''}`,
        ad: row.isAdi || row.sandikAdi,
        paraBirimi: row.paraBirimi ?? '',
        kalan: row.kalanSiparisNetTutar ?? null,
        netTutar: 0,
        secili: false,
      })),
    );
    this.paraBirimi = this.satirlar()[0]?.paraBirimi ?? '';
  }
  poAra(): void {
    this.poAramalari.next(this.poArama);
  }
  poSayfa(page: number): void {
    this.pageNumber = page;
    this.poIstekleri.next();
  }
  poSec(id: number): void {
    this.detayIstekleri.next(id);
  }
  poDegistir(): void {
    this.seciliPo.set(null);
    this.satirlar.set([]);
    this.poIstekleri.next();
  }
  izinli(): boolean {
    return this.permissions.canWrite(
      this.tur() === 'Siparis' ? 'finans-po-gir' : 'finans-fatura-gir',
    );
  }
  kaydet(): void {
    if (this.saving() || !this.izinli()) return;
    const rows = this.satirlar().filter((row) => row.secili);
    if (
      !this.numara.trim() ||
      !this.tarih ||
      !rows.length ||
      rows.some(
        (row) =>
          !Number.isFinite(row.netTutar) ||
          row.netTutar <= 0 ||
          row.kalan == null ||
          row.netTutar > row.kalan,
      )
    ) {
      this.hata.set(this.t('ALLOC_VALIDATION'));
      return;
    }
    if (rows.some((row) => row.paraBirimi !== this.paraBirimi)) {
      this.hata.set(this.t('ALLOC_CURRENCY_ERROR'));
      return;
    }
    const po = this.seciliPo();
    if (this.tur() === 'Fatura' && !po) {
      this.hata.set(this.t('ALLOC_SELECT_PO_ERROR'));
      return;
    }
    this.saving.set(true);
    this.hata.set('');
    const request: Observable<ApiResult<FinansSiparis | FinansFatura>> =
      this.tur() === 'Siparis'
        ? this.service.siparisOlustur({
            poNumarasi: this.numara.trim(),
            siparisTarihi: this.tarih,
            paraBirimi: this.paraBirimi,
            aciklama: this.aciklama.trim() || null,
            kalemler: rows.map((row) => ({
              isKaydiId: row.id,
              adet: 0,
              m3: 0,
              netTutar: Number(row.netTutar),
            })),
          })
        : this.service.faturaOlustur({
            siparisId: po!.ozet.id,
            faturaNumarasi: this.numara.trim(),
            faturaTarihi: this.tarih,
            aciklama: this.aciklama.trim() || null,
            kalemler: rows.map((row) => ({
              siparisKalemiId: row.id,
              adet: 0,
              m3: 0,
              netTutar: Number(row.netTutar),
            })),
          });
    request
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        if (!result.isSuccess) {
          this.hata.set(result.error ?? this.t('ALLOC_SAVE_ERROR'));
          return;
        }
        if (result.statusCode === 202) {
          this.toast.info(this.t('APPROVAL_PENDING'));
          this.kapat.emit();
          return;
        }
        if (!result.value?.id) {
          this.hata.set(this.t('ALLOC_ID_ERROR'));
          return;
        }
        this.toast.success(this.t('ALLOC_SAVED'));
        this.kaydedildi.emit({ tur: this.tur(), id: result.value.id });
      });
  }
  private bugun(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
