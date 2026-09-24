import { TranslationService } from '../../core/services/translation.service';
import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subject, debounceTime, distinctUntilChanged, finalize, switchMap } from 'rxjs';
import { ApiResult } from '../../shared/models/common.model';
import { FinansService } from '../../core/services/finans.service';
import { PermissionService } from '../../core/services/permission.service';
import { FINANS_YETKI } from '../../core/constants/yetki-kodlari';
import { FinansFatura, FinansSayfaliSonuc, FinansSiparis } from '../../shared/models/finans.model';
import { FinansVarlikTuru } from '../../shared/models/finans-v2.model';
import { ServerPagerComponent } from '../../shared/components/server-pager/server-pager.component';

@Component({
  selector: 'app-finans-belgeler-listesi',
  standalone: true,
  imports: [FormsModule, DatePipe, ServerPagerComponent],
  styleUrl: './finans-v2.scss',
  templateUrl: './finans-belgeler-listesi.component.html',
})
export class FinansBelgelerListesiComponent implements OnInit {
  private readonly translation = inject(TranslationService);
  t(key: string): string {
    return this.translation.translate(`FINANS_V2.${key}`);
  }
  private readonly service = inject(FinansService);
  private readonly destroyRef = inject(DestroyRef);
  readonly permissions = inject(PermissionService);
  readonly izin = FINANS_YETKI;
  readonly detayAc = output<{ tur: FinansVarlikTuru; id: number }>();
  readonly faturaAc = output<number | null>();
  readonly liste = signal<FinansSayfaliSonuc<FinansSiparis | FinansFatura> | null>(null);
  readonly loading = signal(false);
  readonly hata = signal('');
  tur: 'Siparis' | 'Fatura' = 'Siparis';
  arama = '';
  pageNumber = 1;
  pageSize = 25;
  private readonly refresh = new Subject<void>();
  private readonly search = new Subject<string>();
  ngOnInit(): void {
    this.search
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.filtrele());
    this.refresh
      .pipe(
        switchMap(() => {
          this.hata.set('');
          this.loading.set(true);
          this.liste.set(null);
          const q = {
            pageNumber: this.pageNumber,
            pageSize: this.pageSize,
            arama: this.arama.trim() || undefined,
          };
          const request: Observable<ApiResult<FinansSayfaliSonuc<FinansSiparis | FinansFatura>>> =
            this.tur === 'Siparis' ? this.service.siparisler(q) : this.service.faturalar(q);
          return request.pipe(finalize(() => this.loading.set(false)));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((r) => {
        if (r.isSuccess) this.liste.set(r.value ?? null);
        else this.hata.set(r.error ?? this.t('DOC_ERROR'));
      });
    this.refresh.next();
  }
  ara(): void {
    this.search.next(this.arama);
  }
  filtrele(): void {
    this.pageNumber = 1;
    this.refresh.next();
  }
  turSec(tur: 'Siparis' | 'Fatura'): void {
    if (this.tur === tur) return;
    this.tur = tur;
    this.filtrele();
  }
  sayfa(p: number): void {
    this.pageNumber = p;
    this.refresh.next();
  }
  boyut(s: number): void {
    this.pageSize = s;
    this.filtrele();
  }
  numara(r: FinansSiparis | FinansFatura): string {
    return 'faturaNumarasi' in r ? r.faturaNumarasi : r.poNumarasi;
  }
  tarih(r: FinansSiparis | FinansFatura): string {
    return 'faturaTarihi' in r ? r.faturaTarihi : r.siparisTarihi;
  }
}
