import { TranslationService } from '../../../core/services/translation.service';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subject, debounceTime, distinctUntilChanged, finalize, switchMap } from 'rxjs';
import { FinansService } from '../../../core/services/finans.service';
import { FinansParaBirimiService } from '../../../core/services/finans-para-birimi.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ToastService } from '../../../core/services/toast.service';
import { ServerPagerComponent } from '../../../shared/components/server-pager/server-pager.component';
import {
  FinansSiparis,
  FinansFatura,
  FinansSayfaliSonuc,
  FinansSiparisDetay,
  FinansSiparisGrubu,
  FinansSiparisKalemi,
} from '../../../shared/models/finans.model';
import { ApiResult } from '../../../shared/models/common.model';
import { FinansVarlikTuru } from '../../../shared/models/finans-v2.model';
import { FinansIsKategorisi } from '../../../core/constants/enums';
import { onayaAlindi } from '../../../shared/models';
import {
  FINANS_KATEGORILERI,
  kategoriAnahtari,
  poOnayDurumuAnahtari,
  poOnayDurumuSinifi,
  siparisKarsilanmaAnahtari,
  uretimKategorisi,
} from '../ortak/finans-etiketleri';
import { finansFaturaGirilebilir, finansPoGirilebilir } from '../ortak/finans-izinleri';
import { poOnayBildirimleri } from '../ortak/finans-po-onayi';

/** PO'ya bağlanmak üzere seçilen proje × kategori / düzenli iş grubu ve girilen net tutar. */
interface GrupSecimi {
  grup: FinansSiparisGrubu;
  tutar: number | null;
}

/** Faturada PO kalemleri proje × kategori grubunda gösterilir; sandıklar satır değildir. */
export interface FaturaGrubu {
  anahtar: string;
  projeNo: string;
  ad: string;
  kategori: FinansIsKategorisi | null;
  /** Düzenli işte faturalanan ay (YYYY-MM); düzenli işler aylık faturalandığı için her ay ayrı satırdır. */
  donem: string | null;
  paraBirimi: string;
  siparisKalemiIds: number[];
  siparisNetTutar: number | null;
  faturalananNetTutar: number | null;
  kalan: number | null;
  secili: boolean;
  tutar: number | null;
}

type PoHedefi = 'yeni' | 'mevcut';

/**
 * PO ve fatura girişi. PO doğrudan uygulamada girilir; belge yüklemesi gerekmez (PDF detaydan isteğe
 * bağlı eklenir). PO tutarı proje × kategori grubuna girilir, sunucu grubun kalemlerine eskiden yeniye
 * dağıtır. Mevcut aktif PO'ya yeni gruplar eklenebilir. Fatura, PO'nun proje × kategori gruplarına girilir.
 */
@Component({
  selector: 'app-finans-dagitim',
  standalone: true,
  imports: [FormsModule, DecimalPipe, DatePipe, ServerPagerComponent],
  templateUrl: './finans-dagitim.component.html',
  styleUrls: ['../ortak/finans-v2.scss', '../ortak/finans-islem-dialoglari.scss'],
})
export class FinansDagitimComponent implements OnInit {
  private readonly translation = inject(TranslationService);
  t(key: string): string {
    return this.translation.translate(`FINANS_V2.${key}`);
  }
  readonly tur = input.required<'Siparis' | 'Fatura'>();
  /** Açılışta seçili gelecek işler (aylık satır veya panelden). */
  readonly isKaydiIds = input<readonly number[]>([]);
  /** Fatura için seçili PO; PO modunda verilirse işler bu mevcut PO'ya eklenir. */
  readonly siparisId = input<number | null>(null);
  /** Grup seçicinin açılış dönemi (ör. aylık görünümün seçili ayı); verilmezse bütün dönemler. */
  readonly donem = input<{ baslangic: string; bitis: string } | null>(null);
  /** Yalnız bu düzenli işin dönemleri (düzenli işten PO açma). */
  readonly duzenliIsId = input<number | null>(null);
  /** Faturada aranacak PO numarası (satırdan açıldığında); tek tam eşleşme kendiliğinden seçilir. */
  readonly poNumarasi = input<string>('');
  readonly kapat = output<void>();
  readonly kaydedildi = output<{ tur: FinansVarlikTuru; id: number }>();
  private readonly service = inject(FinansService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);
  readonly permissions = inject(PermissionService);
  readonly kategoriSecenekleri = FINANS_KATEGORILERI;
  /** Para birimi seçenekleri tanım tablosundan gelir (F1). */
  readonly paraBirimleri = inject(FinansParaBirimiService);
  readonly kategoriAnahtari = kategoriAnahtari;
  readonly siparisKarsilanmaAnahtari = siparisKarsilanmaAnahtari;
  readonly uretimKategorisi = uretimKategorisi;
  readonly poOnayDurumuAnahtari = poOnayDurumuAnahtari;
  readonly poOnayDurumuSinifi = poOnayDurumuSinifi;
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly hata = signal('');

  // Ortak belge alanları
  numara = '';
  tarih = this.bugun();
  aciklama = '';

  // PO: yeni PO veya mevcut PO'ya ekleme
  readonly hedef = signal<PoHedefi>('yeni');
  readonly hedefPo = signal<FinansSiparis | null>(null);
  readonly gruplar = signal<FinansSayfaliSonuc<FinansSiparisGrubu> | null>(null);
  readonly secimler = signal(new Map<string, GrupSecimi>());
  readonly secimListesi = computed(() => [...this.secimler().values()]);
  readonly secimToplami = computed(() =>
    this.secimListesi().reduce((toplam, secim) => toplam + (Number(secim.tutar) || 0), 0),
  );
  /** PO öncesi iş onayı: listede onay bekleyen/onaysız grup varsa açıklama ve toplu gönderme gösterilir. */
  readonly onayGerekenGrupVar = computed(() => (this.gruplar()?.items ?? []).some((g) => g.poyaBaglanabilir === false));
  readonly onayaGonderilebilirGruplar = computed(() => (this.gruplar()?.items ?? []).filter((g) => g.poOnayaGonderilebilir));
  readonly onayaGonderiliyor = signal(false);
  grupArama = '';
  seciliKategoriler = new Set<FinansIsKategorisi>();
  tumDonemler = true;
  baslangic = '';
  bitis = '';
  /** Dönem seçimi: hazır dönemler veya özel aralık; özel aralık tek bir başlangıç → bitiş alanında girilir. */
  donemSecimi: 'tum' | 'ay' | 'gecenAy' | 'yil' | 'ozel' = 'tum';
  donemSecimiDegisti(secim: 'tum' | 'ay' | 'gecenAy' | 'yil' | 'ozel'): void {
    this.donemSecimi = secim;
    const bugun = new Date();
    const gun = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const yil = bugun.getFullYear();
    const ay = bugun.getMonth();
    this.tumDonemler = secim === 'tum';
    if (secim === 'ay') [this.baslangic, this.bitis] = [gun(new Date(yil, ay, 1)), gun(new Date(yil, ay + 1, 0))];
    else if (secim === 'gecenAy') [this.baslangic, this.bitis] = [gun(new Date(yil, ay - 1, 1)), gun(new Date(yil, ay, 0))];
    else if (secim === 'yil') [this.baslangic, this.bitis] = [gun(new Date(yil, 0, 1)), gun(new Date(yil, 11, 31))];
    else if (secim === 'ozel' && (!this.baslangic || !this.bitis))
      [this.baslangic, this.bitis] = [gun(new Date(yil, ay, 1)), gun(new Date(yil, ay + 1, 0))];
    this.gruplariFiltrele();
  }
  paraBirimi = '';
  grupSayfasi = 1;
  /** Açılış seçimi (satırdaki işler); kullanıcı "tüm işler"e geçince kaldırılır. */
  readonly onSecim = signal<readonly number[]>([]);
  private onSecimUygulandi = false;
  private readonly grupIstekleri = new Subject<void>();
  private readonly grupAramalari = new Subject<string>();

  // PO arama (fatura veya mevcut PO'ya ekleme)
  readonly siparisler = signal<FinansSayfaliSonuc<FinansSiparis> | null>(null);
  readonly poIstekleri = new Subject<void>();
  private readonly poAramalari = new Subject<string>();
  poArama = '';
  pageNumber = 1;
  private poOtomatikSec = false;

  // Fatura
  /** Vade tarihi (D3): varsayılanı fatura tarihi + parametredeki vade günü; kullanıcı değiştirebilir. */
  vadeTarihi = '';
  private vadeElleDegisti = false;
  readonly varsayilanVadeGunu = signal<number | null>(null);
  readonly seciliPo = signal<FinansSiparisDetay | null>(null);
  readonly faturaGruplari = signal<FaturaGrubu[]>([]);
  readonly detayIstekleri = new Subject<number>();

  ngOnInit(): void {
    this.paraBirimleri.yukle();
    if (this.tur() === 'Fatura') this.vadeParametresiniYukle();
    this.onSecim.set(this.isKaydiIds());
    if (this.tur() === 'Fatura' && this.poNumarasi().trim()) {
      this.poArama = this.poNumarasi().trim();
      this.poOtomatikSec = true;
    }
    const donem = this.donem();
    if (donem && !this.isKaydiIds().length && !this.duzenliIsId()) {
      this.tumDonemler = false;
      this.donemSecimi = 'ozel';
      this.baslangic = donem.baslangic;
      this.bitis = donem.bitis;
    }
    this.poAkisiniKur();
    this.grupAkisiniKur();
    this.detayAkisiniKur();
    const po = this.siparisId();
    if (this.tur() === 'Siparis') {
      if (po) {
        this.hedef.set('mevcut');
        this.detayIstekleri.next(po);
      } else this.grupIstekleri.next();
    } else if (po) this.detayIstekleri.next(po);
    else this.poIstekleri.next();
  }

  izinli(): boolean {
    return this.tur() === 'Siparis'
      ? finansPoGirilebilir(this.permissions)
      : finansFaturaGirilebilir(this.permissions);
  }

  // ----- PO: hedef seçimi -----
  hedefSec(hedef: PoHedefi): void {
    if (this.hedef() === hedef || this.saving()) return;
    this.hedef.set(hedef);
    this.hata.set('');
    this.hedefPo.set(null);
    this.seciliPo.set(null);
    if (hedef === 'mevcut') {
      this.pageNumber = 1;
      this.poIstekleri.next();
    } else this.paraBirimiKilidiniKaldir();
  }
  mevcutPoSec(id: number): void {
    this.detayIstekleri.next(id);
  }
  mevcutPoDegistir(): void {
    this.hedefPo.set(null);
    this.seciliPo.set(null);
    this.paraBirimiKilidiniKaldir();
    this.poIstekleri.next();
  }

  // ----- PO: grup seçici -----
  kategoriSeciliMi(kategori: FinansIsKategorisi): boolean {
    return this.seciliKategoriler.has(kategori);
  }
  kategoriDegistir(kategori: FinansIsKategorisi): void {
    const sonraki = new Set(this.seciliKategoriler);
    sonraki.has(kategori) ? sonraki.delete(kategori) : sonraki.add(kategori);
    this.seciliKategoriler = sonraki;
    this.gruplariFiltrele();
  }
  grupAra(): void {
    this.grupAramalari.next(this.grupArama);
  }
  gruplariFiltrele(): void {
    if (!this.tumDonemler && this.baslangic && this.bitis && this.baslangic > this.bitis) {
      this.hata.set(this.t('DATE_RANGE_ERROR'));
      return;
    }
    this.hata.set('');
    this.grupSayfasi = 1;
    this.grupIstekleri.next();
  }
  grupSayfa(sayfa: number): void {
    this.grupSayfasi = sayfa;
    this.grupIstekleri.next();
  }
  /** İş grubu listesinin sayfa başı kaydı; değişince ilk sayfadan yeniden istenir. */
  grupBoyutu = 20;
  grupBoyut(boyut: number): void {
    this.grupBoyutu = boyut;
    this.grupSayfasi = 1;
    this.grupIstekleri.next();
  }
  onSecimiKaldir(): void {
    this.onSecim.set([]);
    this.gruplariFiltrele();
  }
  grupSecili(grup: FinansSiparisGrubu): boolean {
    return this.secimler().has(grup.anahtar);
  }
  /** Seçilemeyen PO grubunun kullanıcıya gösterilen nedeni; seçilebilirse null. */
  grupEngeli(grup: FinansSiparisGrubu): string | null {
    if (this.grupSecilebilir(grup)) return null;
    if (grup.poyaBaglanabilir === false) {
      const durum = this.t(poOnayDurumuAnahtari(grup.poOnayDurumu) ?? 'PO_APPROVAL_NOT_SUBMITTED');
      return this.t('PO_APPROVAL_BLOCK').replace('{0}', grup.poOnayAciklamasi ? `${durum}: ${grup.poOnayAciklamasi}` : durum);
    }
    if (grup.kalanSiparisNetTutar == null) return this.t('ALLOC_BLOCK_HIDDEN');
    if (grup.kalanSiparisNetTutar <= 0)
      return this.t('ALLOC_BLOCK_ORDERED').replace('{0}', this.tutarMetni(grup.siparisNetTutar, grup.paraBirimi));
    return this.t('ALLOC_BLOCK_CURRENCY').replace('{0}', this.kilitliParaBirimi()).replace('{1}', grup.paraBirimi);
  }
  /** Seçilemeyen fatura grubunun nedeni: tamamen faturalandı veya tutar gizli. */
  faturaGrubuEngeli(grup: FaturaGrubu): string | null {
    if (grup.kalan == null) return this.t('ALLOC_BLOCK_HIDDEN');
    if (grup.kalan <= 0)
      return this.t('ALLOC_BLOCK_INVOICED').replace('{0}', this.tutarMetni(grup.faturalananNetTutar, grup.paraBirimi));
    return null;
  }
  /** PO'nun bütün satırları faturalanmışsa yeni fatura girilecek tutar yoktur. */
  tumuFaturalandi(): boolean {
    const gruplar = this.faturaGruplari();
    return gruplar.length > 0 && gruplar.every((g) => g.kalan != null && g.kalan <= 0);
  }
  private tutarMetni(tutar: number | null, paraBirimi: string): string {
    return tutar == null
      ? paraBirimi
      : `${tutar.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${paraBirimi}`;
  }
  /** Seçilebilir: PO öncesi onayı tamam, kalan tutar görünür ve pozitif, para birimi PO'nun para birimiyle aynı. */
  grupSecilebilir(grup: FinansSiparisGrubu): boolean {
    return (
      grup.poyaBaglanabilir !== false &&
      grup.kalanSiparisNetTutar != null &&
      grup.kalanSiparisNetTutar > 0 &&
      (!this.kilitliParaBirimi() || grup.paraBirimi === this.kilitliParaBirimi())
    );
  }
  grupSecimiDegistir(grup: FinansSiparisGrubu, secili: boolean): void {
    if (secili && !this.grupSecilebilir(grup)) return;
    this.secimler.update((mevcut) => {
      const sonraki = new Map(mevcut);
      if (secili) sonraki.set(grup.anahtar, { grup, tutar: grup.kalanSiparisNetTutar });
      else sonraki.delete(grup.anahtar);
      return sonraki;
    });
  }
  grupTutari(grup: FinansSiparisGrubu): number | null {
    return this.secimler().get(grup.anahtar)?.tutar ?? null;
  }
  grupTutariDegisti(grup: FinansSiparisGrubu, tutar: number | null): void {
    this.secimler.update((mevcut) => {
      const secim = mevcut.get(grup.anahtar);
      if (!secim) return mevcut;
      const sonraki = new Map(mevcut);
      sonraki.set(grup.anahtar, { ...secim, tutar });
      return sonraki;
    });
  }
  secimiKaldir(anahtar: string): void {
    this.secimler.update((mevcut) => {
      const sonraki = new Map(mevcut);
      sonraki.delete(anahtar);
      return sonraki;
    });
  }
  /** Seçimin para birimi: mevcut PO'nun veya seçilen ilk grubun para birimi (PO-2: tek para birimi). */
  kilitliParaBirimi(): string {
    const po = this.hedefPo();
    if (po) return po.paraBirimi || po.kalemler?.[0]?.paraBirimi || po.tutarlar[0]?.paraBirimi || '';
    return this.secimListesi()[0]?.grup.paraBirimi ?? '';
  }

  topluOnayMetni(): string {
    return this.t('PO_APPROVAL_SEND_ALL').replace('{0}', String(this.onayaGonderilebilirGruplar().length));
  }

  /**
   * Grupların kalemlerini PO öncesi onaya gönderir. Kural açıksa talepler İşlem Onay Merkezi'ne düşer; liste yeni
   * onay durumlarıyla yenilenir ve gönderilen gruplar seçimden çıkar.
   */
  onayaGonder(gruplar: readonly FinansSiparisGrubu[]): void {
    const ids = gruplar.flatMap((grup) => grup.isKaydiIds);
    if (!ids.length || this.onayaGonderiliyor() || !this.izinli()) return;
    this.onayaGonderiliyor.set(true);
    this.hata.set('');
    this.service
      .poOnayinaGonder(ids)
      .pipe(
        finalize(() => this.onayaGonderiliyor.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        if (!result.isSuccess) {
          this.hata.set(result.error ?? this.t('PO_APPROVAL_SEND_ERROR'));
          return;
        }
        for (const bildirim of poOnayBildirimleri(result)) {
          const mesaj = this.t(bildirim.anahtar).replace('{0}', String(bildirim.sayi));
          if (bildirim.tur === 'success') this.toast.success(mesaj);
          else this.toast.info(mesaj);
        }
        gruplar.forEach((grup) => this.secimiKaldir(grup.anahtar));
        this.grupIstekleri.next();
      });
  }

  // ----- Fatura: PO seçimi -----
  poAra(): void {
    this.poAramalari.next(this.poArama);
  }
  poSayfa(page: number): void {
    this.pageNumber = page;
    this.poIstekleri.next();
  }
  /** PO listesinin sayfa başı kaydı; değişince ilk sayfadan yeniden istenir. */
  poBoyutu = 15;
  poBoyut(boyut: number): void {
    this.poBoyutu = boyut;
    this.pageNumber = 1;
    this.poIstekleri.next();
  }
  poSec(id: number): void {
    this.detayIstekleri.next(id);
  }
  poDegistir(): void {
    this.seciliPo.set(null);
    this.faturaGruplari.set([]);
    this.poIstekleri.next();
  }
  /** Fatura tarihi değişince, kullanıcı vadeyi elle değiştirmediyse varsayılan vade yeniden hesaplanır. */
  faturaTarihiDegisti(): void {
    if (!this.vadeElleDegisti) this.vadeTarihi = this.varsayilanVade();
  }
  vadeDegisti(): void {
    this.vadeElleDegisti = true;
  }
  private vadeParametresiniYukle(): void {
    this.service
      .parametreler()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((r) => {
        if (!r.isSuccess || !r.value) return;
        this.varsayilanVadeGunu.set(r.value.varsayilanVadeGunu);
        if (!this.vadeElleDegisti) this.vadeTarihi = this.varsayilanVade();
      });
  }
  private varsayilanVade(): string {
    const gun = this.varsayilanVadeGunu();
    if (gun == null || !this.tarih) return '';
    const [yil, ay, gunNo] = this.tarih.split('-').map(Number);
    const vade = new Date(yil, ay - 1, gunNo + gun);
    return `${vade.getFullYear()}-${String(vade.getMonth() + 1).padStart(2, '0')}-${String(vade.getDate()).padStart(2, '0')}`;
  }

  faturaGrubuDegisti(grup: FaturaGrubu, secili: boolean): void {
    grup.secili = secili;
    grup.tutar = secili ? grup.kalan : null;
  }

  kaydet(): void {
    if (this.saving() || !this.izinli()) return;
    if (this.tur() === 'Siparis') this.siparisKaydet();
    else this.faturaKaydet();
  }

  private siparisKaydet(): void {
    const secimler = this.secimListesi();
    const yeni = this.hedef() === 'yeni';
    const po = this.hedefPo();
    if (yeni ? !this.numara.trim() || !this.tarih : !po) {
      this.hata.set(this.t(yeni ? 'ALLOC_VALIDATION' : 'ALLOC_SELECT_TARGET_PO'));
      return;
    }
    if (!secimler.length || secimler.some((x) => !this.gecerliTutar(x.tutar, x.grup.kalanSiparisNetTutar))) {
      this.hata.set(this.t('ALLOC_VALIDATION'));
      return;
    }
    const paraBirimi = this.kilitliParaBirimi();
    if (secimler.some((x) => x.grup.paraBirimi !== paraBirimi)) {
      this.hata.set(this.t('ALLOC_CURRENCY_ERROR'));
      return;
    }
    const gruplar = secimler.map((x) => ({ isKaydiIds: [...x.grup.isKaydiIds], netTutar: Number(x.tutar) }));
    this.gonder(
      yeni
        ? this.service.siparisOlustur({
            poNumarasi: this.numara.trim(),
            siparisTarihi: this.tarih,
            paraBirimi,
            aciklama: this.aciklama.trim() || null,
            kalemler: [],
            gruplar,
          })
        : this.service.siparisKalemEkle(po!.id, { gruplar }),
      'Siparis',
    );
  }

  private faturaKaydet(): void {
    const po = this.seciliPo();
    if (!po) {
      this.hata.set(this.t('ALLOC_SELECT_PO_ERROR'));
      return;
    }
    const secili = this.faturaGruplari().filter((x) => x.secili);
    if (
      !this.numara.trim() ||
      !this.tarih ||
      !secili.length ||
      secili.some((x) => !this.gecerliTutar(x.tutar, x.kalan))
    ) {
      this.hata.set(this.t('ALLOC_VALIDATION'));
      return;
    }
    if (new Set(secili.map((x) => x.paraBirimi)).size > 1) {
      this.hata.set(this.t('ALLOC_CURRENCY_ERROR'));
      return;
    }
    if (this.vadeTarihi && this.vadeTarihi < this.tarih) {
      this.hata.set(this.t('DUE_DATE_BEFORE_INVOICE'));
      return;
    }
    this.gonder(
      this.service.faturaOlustur({
        siparisId: po.ozet.id,
        faturaNumarasi: this.numara.trim(),
        faturaTarihi: this.tarih,
        vadeTarihi: this.vadeTarihi || null,
        aciklama: this.aciklama.trim() || null,
        kalemler: [],
        gruplar: secili.map((x) => ({ siparisKalemiIds: [...x.siparisKalemiIds], netTutar: Number(x.tutar) })),
      }),
      'Fatura',
    );
  }

  private gonder(request: Observable<ApiResult<FinansSiparis | FinansFatura>>, tur: FinansVarlikTuru): void {
    this.saving.set(true);
    this.hata.set('');
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
        if (onayaAlindi(result)) {
          this.toast.info(this.t('APPROVAL_PENDING'));
          this.kapat.emit();
          return;
        }
        if (!result.value?.id) {
          this.hata.set(this.t('ALLOC_ID_ERROR'));
          return;
        }
        this.toast.success(this.t(tur === 'Siparis' ? 'ALLOC_PO_SAVED' : 'ALLOC_INVOICE_SAVED'));
        this.kaydedildi.emit({ tur, id: result.value.id });
      });
  }

  /** Pozitif, en fazla 2 ondalıklı ve kalan tutarı aşmayan tutar; kalan gizliyse (null) geçersiz. */
  private gecerliTutar(tutar: number | null, kalan: number | null): boolean {
    if (tutar == null || kalan == null) return false;
    const deger = Number(tutar);
    return (
      Number.isFinite(deger) &&
      deger > 0 &&
      Math.abs(deger * 100 - Math.round(deger * 100)) < 1e-6 &&
      deger <= kalan + 1e-9
    );
  }

  private paraBirimiKilidiniKaldir(): void {
    // Hedef PO değişince önceki PO'nun para birimine göre yapılan seçimler geçersizdir.
    this.secimler.set(new Map());
    this.paraBirimi = '';
    this.gruplariFiltrele();
  }

  private poAkisiniKur(): void {
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
              pageSize: this.poBoyutu,
              arama: this.poArama.trim() || undefined,
              // Fatura yalnız faturalanacak bakiyesi olan PO'lara girilir; kalem ekleme her aktif PO'ya yapılabilir.
              faturaBekleyen: this.tur() === 'Fatura' ? true : undefined,
            })
            .pipe(finalize(() => this.loading.set(false)));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        this.siparisler.set(result.isSuccess ? (result.value ?? null) : null);
        if (!result.isSuccess) this.hata.set(result.error ?? this.t('ALLOC_PO_LIST_ERROR'));
        if (this.poOtomatikSec && result.isSuccess) {
          this.poOtomatikSec = false;
          const aranan = this.poNumarasi().trim().toLocaleUpperCase('tr-TR');
          const eslesen = (result.value?.items ?? []).filter((po) => po.poNumarasi.toLocaleUpperCase('tr-TR') === aranan);
          if (eslesen.length === 1) this.poSec(eslesen[0].id);
        }
      });
  }

  private grupAkisiniKur(): void {
    this.grupAramalari
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.gruplariFiltrele());
    this.grupIstekleri
      .pipe(
        switchMap(() => {
          this.loading.set(true);
          const kilitli = this.kilitliParaBirimi();
          return this.service
            .siparisGruplari({
              pageNumber: this.grupSayfasi,
              pageSize: this.grupBoyutu,
              arama: this.grupArama.trim() || undefined,
              kategoriler: [...this.seciliKategoriler],
              baslangic: this.tumDonemler ? undefined : this.baslangic || undefined,
              bitis: this.tumDonemler ? undefined : this.bitis || undefined,
              paraBirimi: (this.hedefPo() ? kilitli : this.paraBirimi) || undefined,
              isKaydiIds: [...this.onSecim()],
              duzenliIsId: this.duzenliIsId() ?? undefined,
              sadeceSiparisBekleyen: true,
            })
            .pipe(finalize(() => this.loading.set(false)));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        if (!result.isSuccess) {
          this.gruplar.set(null);
          this.hata.set(result.error ?? this.t('ALLOC_WORK_ERROR'));
          return;
        }
        const sayfa = result.value ?? null;
        this.gruplar.set(sayfa);
        // Satırdan açıldığında o satırın grupları kalan tutarlarıyla seçili gelir (yalnız ilk yüklemede).
        if (!this.onSecimUygulandi && this.onSecim().length && sayfa) {
          this.onSecimUygulandi = true;
          const secilebilir = sayfa.items.filter((grup) => this.grupSecilebilir(grup));
          const paraBirimi = this.kilitliParaBirimi() || secilebilir[0]?.paraBirimi;
          secilebilir
            .filter((grup) => grup.paraBirimi === paraBirimi)
            .forEach((grup) => this.grupSecimiDegistir(grup, true));
        }
      });
  }

  private detayAkisiniKur(): void {
    this.detayIstekleri
      .pipe(
        switchMap((id) => {
          this.loading.set(true);
          this.faturaGruplari.set([]);
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
        if (this.tur() === 'Siparis') {
          // Mevcut PO'ya ekleme: seçici PO'nun para birimine kilitlenir.
          this.hedefPo.set({ ...result.value.ozet, kalemler: result.value.kalemler });
          this.secimler.update((mevcut) => {
            const paraBirimi = this.kilitliParaBirimi();
            return new Map([...mevcut].filter(([, secim]) => secim.grup.paraBirimi === paraBirimi));
          });
          this.gruplariFiltrele();
          return;
        }
        this.seciliPo.set(result.value);
        this.faturaGruplari.set(faturaGruplariniOlustur(result.value.kalemler));
      });
  }

  private bugun(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}

/**
 * PO kalemlerini proje × kategori × para birimi grubuna toplar; düzenli işler (ör. yıllık kira PO'su) aylık
 * faturalandığı için iş × ay satırıdır. Gizli tutarlar (null) toplama katılmaz; gruptaki bir kalanın gizli olması
 * grubun kalanını da gizli (null) yapar.
 */
export function faturaGruplariniOlustur(kalemler: readonly FinansSiparisKalemi[]): FaturaGrubu[] {
  const gruplar = new Map<string, FaturaGrubu>();
  for (const kalem of kalemler) {
    const proje = kalem.projeId != null ? `P:${kalem.projeId}` : `M:${kalem.projeNo ?? ''}`;
    const kategori = kalem.kategori ?? null;
    const donem = kalem.duzenliIsId != null && kalem.finansTarihi ? kalem.finansTarihi.slice(0, 7) : null;
    const anahtar =
      kalem.duzenliIsId != null
        ? `D:${kalem.duzenliIsId}:${donem ?? ''}:${kalem.paraBirimi}`
        : kategori === FinansIsKategorisi.OzelIs
          ? `O:${kalem.isKaydiId}:${kalem.paraBirimi}`
          : `${proje}:${kategori ?? kalem.isTuru}:${kalem.paraBirimi}`;
    const mevcut = gruplar.get(anahtar);
    const grup: FaturaGrubu = mevcut ?? {
      anahtar,
      projeNo: kalem.projeNo ?? '',
      ad: kalem.isAdi || kalem.sandikAdi || kalem.urunAdi,
      kategori,
      donem,
      paraBirimi: kalem.paraBirimi,
      siparisKalemiIds: [],
      siparisNetTutar: 0,
      faturalananNetTutar: 0,
      kalan: 0,
      secili: false,
      tutar: null,
    };
    grup.siparisKalemiIds.push(kalem.id);
    grup.siparisNetTutar = topla(grup.siparisNetTutar, kalem.netTutar);
    grup.faturalananNetTutar = topla(grup.faturalananNetTutar, kalem.faturalananNetTutar ?? null);
    grup.kalan = topla(grup.kalan, kalem.kalanFaturaNetTutar ?? null);
    gruplar.set(anahtar, grup);
  }
  return [...gruplar.values()];
}

function topla(toplam: number | null, deger: number | null): number | null {
  return toplam == null || deger == null ? null : Math.round((toplam + deger) * 100) / 100;
}
