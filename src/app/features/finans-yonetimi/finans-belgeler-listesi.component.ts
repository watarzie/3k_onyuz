import { TranslationService } from '../../core/services/translation.service';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subject, debounceTime, distinctUntilChanged, finalize, switchMap } from 'rxjs';
import { ApiResult } from '../../shared/models/common.model';
import { FinansService } from '../../core/services/finans.service';
import { PermissionService } from '../../core/services/permission.service';
import { ToastService } from '../../core/services/toast.service';
import { FinansOdemeFiltresi } from '../../core/constants/enums';
import { FINANS_YETKI } from '../../core/constants/yetki-kodlari';
import {
  FinansFatura,
  FinansListelemeRequest,
  FinansSayfaliSonuc,
  FinansSiparis,
  FinansSiparisDurumu,
} from '../../shared/models/finans.model';
import { FinansVarlikTuru } from '../../shared/models/finans-v2.model';
import { ServerPagerComponent } from '../../shared/components/server-pager/server-pager.component';
import { IslemlerMenusuComponent } from '../../shared/components/islemler-menusu/islemler-menusu.component';
import { finansFaturaGirilebilir, finansOdemeKaydedilebilir, finansPoGirilebilir } from './finans-izinleri';
import { odemeDurumuAnahtari, odemeDurumuSinifi, poDurumuAnahtari } from './finans-etiketleri';
import { onayaAlindi } from '../../shared/models';

/**
 * PO ve fatura listesi. PO'lar uygulamada doğrudan girilir; liste belge yüklemesine bağlı değildir.
 * PO satırı tutar, faturalanan tutar ve net sonucu (faturalanan − ilişkili gider) para birimi bazında gösterir.
 */
@Component({
  selector: 'app-finans-belgeler-listesi',
  standalone: true,
  imports: [FormsModule, DatePipe, DecimalPipe, ServerPagerComponent, IslemlerMenusuComponent],
  styleUrls: ['./finans-v2.scss', './finans-islem-dialoglari.scss'],
  templateUrl: './finans-belgeler-listesi.component.html',
})
export class FinansBelgelerListesiComponent implements OnInit {
  private readonly translation = inject(TranslationService);
  t(key: string): string {
    return this.translation.translate(`FINANS_V2.${key}`);
  }
  private readonly service = inject(FinansService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);
  readonly permissions = inject(PermissionService);
  readonly izin = FINANS_YETKI;
  readonly poDurumuAnahtari = poDurumuAnahtari;
  readonly odemeDurumuAnahtari = odemeDurumuAnahtari;
  readonly odemeDurumuSinifi = odemeDurumuSinifi;
  readonly odemeFiltreleri = FinansOdemeFiltresi;
  /** Açılış görünümü: vade uyarısından gelindiğinde fatura listesi ve ödeme filtresi (D3). */
  readonly baslangicTuru = input<'Siparis' | 'Fatura'>('Siparis');
  readonly baslangicOdemeFiltresi = input<FinansOdemeFiltresi | null>(null);
  readonly detayAc = output<{ tur: FinansVarlikTuru; id: number }>();
  readonly faturaAc = output<number | null>();
  /** null: yeni PO; kimlik: mevcut PO'ya kalem ekleme. */
  readonly siparisAc = output<number | null>();
  readonly liste = signal<FinansSayfaliSonuc<FinansSiparis | FinansFatura> | null>(null);
  readonly loading = signal(false);
  readonly hata = signal('');
  tur: 'Siparis' | 'Fatura' = 'Siparis';
  arama = '';
  /** PO durum filtresi (yalnız PO listesinde). */
  siparisDurumu: FinansSiparisDurumu | null = null;
  iptalEdilenler = false;
  /** Fatura ödeme/vade filtresi (yalnız fatura listesinde). */
  odemeDurumu: FinansOdemeFiltresi | null = null;
  /** Hızlı ödeme işaretleme paneli. */
  readonly odemeFatura = signal<FinansFatura | null>(null);
  readonly odemeHatasi = signal('');
  readonly odemeKaydediliyor = signal(false);
  odemeForm = { odendi: true, tarih: '', aciklama: '' };
  pageNumber = 1;
  pageSize = 25;
  private readonly refresh = new Subject<void>();
  private readonly search = new Subject<string>();
  ngOnInit(): void {
    this.tur = this.baslangicTuru();
    this.odemeDurumu = this.tur === 'Fatura' ? this.baslangicOdemeFiltresi() : null;
    this.search
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.filtrele());
    this.refresh
      .pipe(
        switchMap(() => {
          this.hata.set('');
          this.loading.set(true);
          this.liste.set(null);
          const q: FinansListelemeRequest = {
            pageNumber: this.pageNumber,
            pageSize: this.pageSize,
            arama: this.arama.trim() || undefined,
          };
          if (this.tur === 'Siparis' && this.siparisDurumu) q.siparisDurumu = this.siparisDurumu;
          if (this.tur === 'Fatura' && this.odemeDurumu) q.odemeDurumu = this.odemeDurumu;
          if (this.iptalEdilenler) q.iptalEdilenleriDahilEt = true;
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
  siparis(r: FinansSiparis | FinansFatura): FinansSiparis | null {
    return 'faturaNumarasi' in r ? null : r;
  }
  fatura(r: FinansSiparis | FinansFatura): FinansFatura | null {
    return 'faturaNumarasi' in r ? r : null;
  }
  parasal(kod: string): boolean {
    return this.permissions.hasAccess(this.izin.ParasalVeriGoruntule) && this.permissions.hasAccess(kod);
  }
  poGirilebilir(): boolean {
    return finansPoGirilebilir(this.permissions);
  }
  faturaGirilebilir(): boolean {
    return finansFaturaGirilebilir(this.permissions);
  }
  /** Kalem eklenebilir: PO iptal değil (fatura durumu kalem eklemeyi engellemez). */
  kalemEklenebilir(po: FinansSiparis): boolean {
    return !po.iptalEdildi && po.durum !== 4;
  }
  odemeKaydedilebilir(f: FinansFatura): boolean {
    return !f.iptalEdildi && f.durum !== 2 && finansOdemeKaydedilebilir(this.permissions);
  }
  /** Ödendi kutusu: işaretli faturada işareti kaldırma (gerekçeli), işaretsizde ödeme tarihi girişi açılır. */
  odemePaneliniAc(f: FinansFatura): void {
    if (!this.odemeKaydedilebilir(f)) return;
    this.odemeForm = { odendi: !f.odendiMi, tarih: this.bugun(), aciklama: '' };
    this.odemeHatasi.set('');
    this.odemeFatura.set(f);
  }
  odemeKaydet(): void {
    const f = this.odemeFatura();
    if (!f || this.odemeKaydediliyor()) return;
    const aciklama = this.odemeForm.aciklama.trim();
    if (this.odemeForm.odendi && (!this.odemeForm.tarih || this.odemeForm.tarih > this.bugun())) {
      this.odemeHatasi.set(this.t('PAYMENT_DATE_ERROR'));
      return;
    }
    if (!this.odemeForm.odendi && aciklama.length < 5) {
      this.odemeHatasi.set(this.t('PAYMENT_UNMARK_REASON_ERROR'));
      return;
    }
    this.odemeKaydediliyor.set(true);
    this.service
      .faturaOdeme(f.id, {
        odendi: this.odemeForm.odendi,
        odemeTarihi: this.odemeForm.odendi ? this.odemeForm.tarih : null,
        aciklama: aciklama || null,
      })
      .pipe(
        finalize(() => this.odemeKaydediliyor.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((r) => {
        if (!r.isSuccess) {
          this.odemeHatasi.set(r.error ?? this.t('PAYMENT_SAVE_ERROR'));
          return;
        }
        this.odemeFatura.set(null);
        if (onayaAlindi(r)) this.toast.info(this.t('APPROVAL_QUEUED'));
        else this.toast.success(this.t('PAYMENT_SAVED'));
        this.refresh.next();
      });
  }
  /** Vadeye kalan gün ya da gecikme metni. */
  vadeMetni(f: FinansFatura): string {
    const gun = f.vadeFarkiGun ?? 0;
    if (f.odendiMi) return gun > 0 ? this.t('PAYMENT_PAID_DAYS_LATE').replace('{0}', String(gun)) : '';
    if (gun === 0) return this.t('DUE_TODAY');
    return gun > 0 ? this.t('DUE_IN_DAYS').replace('{0}', String(gun)) : this.t('OVERDUE_DAYS').replace('{0}', String(-gun));
  }
  bugun(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  /** Fatura girilebilir: PO iptal değil ve tamamen faturalanmamış. */
  faturaGirilebilirPo(po: FinansSiparis): boolean {
    return !po.iptalEdildi && po.durum !== 4 && po.durum !== 3;
  }
}
