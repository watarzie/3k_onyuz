import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, finalize } from 'rxjs';
import { FINANS_YETKI } from '../../core/constants/yetki-kodlari';
import { FinansService } from '../../core/services/finans.service';
import { FinansParaBirimiService } from '../../core/services/finans-para-birimi.service';
import { PermissionService } from '../../core/services/permission.service';
import { ToastService } from '../../core/services/toast.service';
import { ApiResult } from '../../shared/models/common.model';
import {
  FinansIsKaydi,
  FinansSayfaliSonuc,
  FinansSiparis,
  FinansFatura,
} from '../../shared/models/finans.model';
import {
  FinansDegisiklik,
  FinansFiyatBileseni,
  FinansFiyatlandirma,
  FinansKaliciSilOnizleme,
  FinansVarlikTuru,
} from '../../shared/models/finans-v2.model';
import { ServerPagerComponent } from '../../shared/components/server-pager/server-pager.component';
import {
  finansFaturaGirilebilir,
  finansOdemeKaydedilebilir,
  finansPoGirilebilir,
  tumFinansAlanlariGorunur,
} from './finans-izinleri';
import {
  kategoriAnahtari,
  odemeDurumuAnahtari,
  odemeDurumuSinifi,
  poDurumuAnahtari,
  uretimKategorisi,
} from './finans-etiketleri';
import { TranslationService } from '../../core/services/translation.service';
import { FinansIsKategorisi, FinansSandikMalzemesi } from '../../core/constants/enums';

import { onayaAlindi } from '../../shared/models';
@Component({
  selector: 'app-finans-kayit-detay',
  standalone: true,
  imports: [FormsModule, DatePipe, DecimalPipe, ServerPagerComponent],
  templateUrl: './finans-kayit-detay.component.html',
  styleUrls: ['./finans-v2.scss', './finans-islem-dialoglari.scss'],
})
export class FinansKayitDetayComponent implements OnInit {
  private readonly translation = inject(TranslationService);
  t(key: string): string {
    return this.translation.translate(`FINANS_V2.${key}`);
  }
  readonly hedef = input.required<{ tur: FinansVarlikTuru; id: number }>();
  readonly kapat = output<void>();
  readonly degisti = output<void>();
  readonly siparisAc = output<number[]>();
  /** Mevcut PO'ya yeni iş kalemi ekleme ekranını açar. */
  readonly kalemEkle = output<number>();
  readonly faturaAc = output<number>();
  readonly kategoriAnahtari = kategoriAnahtari;
  readonly poDurumuAnahtari = poDurumuAnahtari;
  readonly odemeDurumuAnahtari = odemeDurumuAnahtari;
  readonly odemeDurumuSinifi = odemeDurumuSinifi;
  private readonly service = inject(FinansService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);
  readonly permissions = inject(PermissionService);
  readonly paraBirimleri = inject(FinansParaBirimiService);
  readonly izin = FINANS_YETKI;
  readonly malzeme = FinansSandikMalzemesi;
  readonly kayit = signal<FinansIsKaydi | null>(null);
  readonly siparis = signal<FinansSiparis | null>(null);
  readonly fatura = signal<FinansFatura | null>(null);
  belgeForm = { numara: '', tarih: '', aciklama: '', gerekce: '', vade: '' };
  /** Ödeme işareti (D3): tahsilat dışarıdan gelir; işaretin kaldırılması gerekçe ister. */
  odemeForm = { odendi: false, tarih: '', aciklama: '' };
  /**
   * PO/fatura satırları: işin toplam bedeli, bu belgedeki tutar, faturalanan ve kalan tutarlar (R1 §18).
   * Tutarlar izin yoksa sunucudan null gelir ve düzenlenemez.
   */
  belgeKalemleri: {
    id: number;
    isKaydiId: number;
    ad: string;
    kategori: FinansIsKategorisi | null;
    isBedeli: number | null;
    netTutar: number | null;
    faturalanan: number | null;
    kalanFatura: number | null;
    kalanSiparis: number | null;
    paraBirimi: string;
  }[] = [];
  tutarlariDuzenle = false;
  readonly denetim = signal<FinansSayfaliSonuc<FinansDegisiklik> | null>(null);
  readonly preview = signal<FinansKaliciSilOnizleme | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly hata = signal('');
  readonly sekme = signal<'bilgi' | 'fiyat' | 'gecmis' | 'islemler'>('bilgi');
  readonly ikinciAdim = signal(false);
  finansTarihi = '';
  tarihNedeni = '';
  iptalNedeni = '';
  silmeNedeni = '';
  ikinciOnay = false;
  fiyat: FinansFiyatlandirma = {
    fiyatlandirmaBirimi: 1,
    adet: 1,
    birimM3: 0,
    birimFiyat: 0,
    paraBirimi: 'EUR',
    kdvOrani: 20,
    aciklama: '',
    bilesenler: [],
  };
  ngOnInit(): void {
    this.paraBirimleri.yukle();
    this.yukle();
  }
  parasal(kod: string): boolean {
    return (
      this.permissions.hasAccess(this.izin.ParasalVeriGoruntule) && this.permissions.hasAccess(kod)
    );
  }
  fiyatDuzenlenebilir(): boolean {
    // Dinamik alanlar tüm mali/ölçü izinleri olmadığında sunucuda bütünüyle maskelenir.
    // Görülemeyen eski snapshot'ı boş bileşen/0 ile üzerine yazmayız.
    return (
      !!this.kayit() &&
      this.permissions.canWrite(this.izin.FiyatlandirmaDegistir) &&
      tumFinansAlanlariGorunur(this.permissions)
    );
  }
  yukle(): void {
    if (this.hedef().tur === 'Siparis') {
      this.loading.set(true);
      this.service
        .siparisDetay(this.hedef().id)
        .pipe(
          finalize(() => this.loading.set(false)),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe((r) => {
          if (!r.isSuccess || !r.value) {
            this.hata.set(r.error ?? 'PO yüklenemedi.');
            return;
          }
          const p = r.value.ozet;
          this.siparis.set(p);
          this.belgeForm = {
            numara: p.poNumarasi,
            tarih: p.siparisTarihi.slice(0, 10),
            aciklama: p.aciklama ?? '',
            gerekce: '',
            vade: '',
          };
          this.belgeKalemleri = r.value.kalemler.map((x) => ({
            id: x.id,
            isKaydiId: x.isKaydiId,
            ad: this.kalemAdi(x.projeNo, x.isAdi || x.sandikAdi || x.urunAdi),
            kategori: x.kategori ?? null,
            isBedeli: x.isBedeli ?? null,
            netTutar: x.netTutar,
            faturalanan: x.faturalananNetTutar ?? null,
            kalanFatura: x.kalanFaturaNetTutar ?? null,
            kalanSiparis: x.kalanSiparisNetTutar ?? null,
            paraBirimi: x.paraBirimi,
          }));
          this.tutarlariDuzenle = false;
        });
      return;
    }
    if (this.hedef().tur === 'Fatura') {
      this.loading.set(true);
      this.service
        .faturaDetay(this.hedef().id)
        .pipe(
          finalize(() => this.loading.set(false)),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe((r) => {
          if (!r.isSuccess || !r.value) {
            this.hata.set(r.error ?? 'Fatura yüklenemedi.');
            return;
          }
          const f = r.value;
          this.fatura.set(f);
          this.belgeForm = {
            numara: f.faturaNumarasi,
            tarih: f.faturaTarihi.slice(0, 10),
            aciklama: f.aciklama ?? '',
            gerekce: '',
            vade: f.vadeTarihi?.slice(0, 10) ?? '',
          };
          this.odemeForm = {
            odendi: !!f.odendiMi,
            tarih: f.odemeTarihi?.slice(0, 10) ?? this.bugun(),
            aciklama: f.odemeAciklamasi ?? '',
          };
          this.belgeKalemleri = (f.kalemler ?? []).map((x) => ({
            id: x.siparisKalemiId,
            isKaydiId: x.isKaydiId,
            ad: x.isAdi ? this.kalemAdi(x.projeNo, x.isAdi) : `İş #${x.isKaydiId}`,
            kategori: x.kategori ?? null,
            isBedeli: null,
            netTutar: x.netTutar,
            faturalanan: null,
            kalanFatura: null,
            kalanSiparis: null,
            paraBirimi: x.paraBirimi,
          }));
          this.tutarlariDuzenle = false;
        });
      return;
    }
    if (this.hedef().tur !== 'IsKaydi') return;
    this.loading.set(true);
    this.service
      .isDetay(this.hedef().id)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        if (!result.isSuccess || !result.value) {
          this.hata.set(result.error ?? 'Kayıt yüklenemedi.');
          return;
        }
        const k = result.value;
        this.kayit.set(k);
        this.finansTarihi = k.finansTarihi?.slice(0, 10) ?? '';
        if (this.fiyatDuzenlenebilir()) {
          this.fiyat = {
            fiyatlandirmaBirimi: k.fiyatlandirmaBirimi ?? 1,
            adet: k.adet,
            birimM3: k.birimM3,
            birimFiyat: k.birimFiyat ?? 0,
            paraBirimi: k.paraBirimi ?? 'EUR',
            kdvOrani: k.kdvOrani ?? 0,
            aciklama: '',
            manuelNetTutar: k.manuelNetTutar,
            bilesenler: k.bilesenler?.map((b) => ({ ...b })) ?? [],
          };
        }
      });
  }
  /** Kategori adı yalnız üretim kategorilerinde gösterilir; özel/düzenli işte iş adı yeterlidir. */
  kategoriEtiketi(kategori: FinansIsKategorisi | null): string {
    return uretimKategorisi(kategori) ? this.t(kategoriAnahtari(kategori)) : '';
  }
  poKalemiEklenebilir(): boolean {
    const po = this.siparis();
    return !!po && !po.iptalEdildi && po.durum !== 4 && finansPoGirilebilir(this.permissions);
  }
  poFaturalanabilir(): boolean {
    const po = this.siparis();
    return !!po && !po.iptalEdildi && po.durum !== 4 && po.durum !== 3 && finansFaturaGirilebilir(this.permissions);
  }
  isePoAcilabilir(): boolean {
    const k = this.kayit();
    return !!k && !k.iptalEdildi && (k.kalanSiparisNetTutar ?? 1) > 0 && finansPoGirilebilir(this.permissions);
  }
  private kalemAdi(projeNo: string | undefined, ad: string): string {
    return projeNo && !ad.startsWith(projeNo) ? `${projeNo} · ${ad}` : ad;
  }
  belgeDuzenlemeIzni(): boolean {
    return this.permissions.canWrite(
      this.hedef().tur === 'Siparis' ? this.izin.PoDegistir : this.izin.FaturaDegistir,
    );
  }
  belgeKaydet(): void {
    const form = this.belgeForm;
    if (!form.numara.trim() || !form.tarih || !form.gerekce.trim()) {
      this.hata.set('Belge numarası, tarih ve değişiklik gerekçesi zorunludur.');
      return;
    }
    if (
      this.tutarlariDuzenle &&
      (!this.parasal(this.izin.TutarGoruntule) ||
        !this.belgeKalemleri.length ||
        this.belgeKalemleri.some(
          (x) => x.netTutar == null || !Number.isFinite(x.netTutar) || x.netTutar <= 0,
        ))
    ) {
      this.hata.set('Her kalem için erişilebilir, pozitif net tutar girin.');
      return;
    }
    if (this.hedef().tur === 'Siparis') {
      this.uygula(
        this.service.siparisGuncelle(this.hedef().id, {
          poNumarasi: form.numara.trim(),
          siparisTarihi: form.tarih,
          aciklama: form.aciklama,
          gerekce: form.gerekce.trim(),
          kalemler: this.tutarlariDuzenle
            ? this.belgeKalemleri.map((x) => ({
                isKaydiId: x.isKaydiId,
                adet: 0,
                m3: 0,
                netTutar: x.netTutar!,
              }))
            : undefined,
        }),
        'PO güncellendi.',
      );
    } else if (this.hedef().tur === 'Fatura') {
      if (form.vade && form.vade < form.tarih) {
        this.hata.set(this.t('DUE_DATE_BEFORE_INVOICE'));
        return;
      }
      this.uygula(
        this.service.faturaGuncelle(this.hedef().id, {
          faturaNumarasi: form.numara.trim(),
          faturaTarihi: form.tarih,
          vadeTarihi: form.vade || null,
          aciklama: form.aciklama,
          gerekce: form.gerekce.trim(),
          belgeMutabakatiniKoru: !this.tutarlariDuzenle,
          kalemler: this.tutarlariDuzenle
            ? this.belgeKalemleri.map((x) => ({
                siparisKalemiId: x.id,
                adet: 0,
                m3: 0,
                netTutar: x.netTutar!,
              }))
            : undefined,
        }),
        'Fatura güncellendi.',
      );
    }
  }
  odemeKaydedilebilir(): boolean {
    const f = this.fatura();
    return !!f && !f.iptalEdildi && f.durum !== 2 && finansOdemeKaydedilebilir(this.permissions);
  }
  odemeKaydet(): void {
    const f = this.fatura();
    if (!f || !this.odemeKaydedilebilir()) return;
    const form = this.odemeForm;
    const aciklama = form.aciklama.trim();
    if (form.odendi && (!form.tarih || form.tarih > this.bugun())) {
      this.hata.set(this.t('PAYMENT_DATE_ERROR'));
      return;
    }
    if (!form.odendi && f.odendiMi && aciklama.length < 5) {
      this.hata.set(this.t('PAYMENT_UNMARK_REASON_ERROR'));
      return;
    }
    this.uygula(
      this.service.faturaOdeme(f.id, {
        odendi: form.odendi,
        odemeTarihi: form.odendi ? form.tarih : null,
        aciklama: aciklama || null,
      }),
      this.t('PAYMENT_SAVED'),
    );
  }
  /** Vadeye kalan gün ya da gecikme; ödenmiş faturada vadeye göre ödeme günü. */
  vadeFarkiMetni(f: FinansFatura): string {
    const gun = f.vadeFarkiGun ?? 0;
    if (f.odendiMi)
      return gun > 0 ? this.t('PAYMENT_PAID_DAYS_LATE').replace('{0}', String(gun)) : this.t('PAYMENT_PAID_ON_TIME');
    if (gun === 0) return this.t('DUE_TODAY');
    return gun > 0
      ? this.t('DUE_IN_DAYS').replace('{0}', String(gun))
      : this.t('OVERDUE_DAYS').replace('{0}', String(-gun));
  }
  bugun(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  tab(value: 'bilgi' | 'fiyat' | 'gecmis' | 'islemler'): void {
    this.sekme.set(value);
    this.hata.set('');
    if (value === 'gecmis') this.gecmisSayfa(1);
  }
  tarihiKaydet(): void {
    if (!this.finansTarihi || !this.tarihNedeni.trim()) {
      this.hata.set('Finans tarihi ve değişiklik gerekçesi zorunludur.');
      return;
    }
    this.uygula(
      this.service.finansTarihiDegistir(
        this.hedef().id,
        this.finansTarihi,
        this.tarihNedeni.trim(),
      ),
      'Finans tarihi güncellendi.',
    );
  }
  fiyatKaydet(): void {
    if (!this.fiyatDuzenlenebilir()) {
      this.hata.set(
        'Fiyatlandırma için kayıt ve mali/ölçü alanlarına erişim gerekir. Gizlenmiş değerlerin üzerine yazılamaz.',
      );
      return;
    }
    if (!this.fiyat.aciklama.trim()) {
      this.hata.set('Fiyatlandırma gerekçesi zorunludur.');
      return;
    }
    // F11: malzeme yalnız m³ satırında anlamlıdır; diğer yöntemlere geçen satırın malzemesi gönderilmez.
    const bilesenler = this.fiyat.bilesenler?.map((b) => ({ ...b, malzeme: b.yontem === 2 ? (b.malzeme ?? null) : null }));
    this.uygula(this.service.fiyatlandir(this.hedef().id, { ...this.fiyat, bilesenler }), 'Fiyatlandırma kaydedildi.');
  }
  bilesenEkle(): void {
    this.fiyat.bilesenler = [
      ...(this.fiyat.bilesenler ?? []),
      { ad: '', yontem: 2, miktar: 1, birimFiyat: 0 },
    ];
  }
  bilesenSil(index: number): void {
    this.fiyat.bilesenler = this.fiyat.bilesenler?.filter((_, i) => i !== index);
  }
  /** Satır tutarı: m³ ve adet satırında miktar × birim fiyat, sabit satırda birim fiyat (sunucu kuralıyla aynı). */
  bilesenTutari(b: FinansFiyatBileseni): number {
    const miktar = b.yontem === 3 || b.yontem === 4 ? 1 : Number(b.miktar) || 0;
    return Math.round(miktar * (Number(b.birimFiyat) || 0) * 100) / 100;
  }
  /** Kümülatif toplamlar: satır tutarları ve m³ satırlarının malzemeye göre ayrımı (F11). */
  bilesenOzeti(): { tutar: number; ahsapM3: number; kontraM3: number; malzemesizM3: number } {
    const ozet = { tutar: 0, ahsapM3: 0, kontraM3: 0, malzemesizM3: 0 };
    for (const b of this.fiyat.bilesenler ?? []) {
      ozet.tutar = Math.round((ozet.tutar + this.bilesenTutari(b)) * 100) / 100;
      if (b.yontem !== 2) continue;
      const m3 = Number(b.miktar) || 0;
      if (b.malzeme === FinansSandikMalzemesi.Ahsap) ozet.ahsapM3 += m3;
      else if (b.malzeme === FinansSandikMalzemesi.Kontra) ozet.kontraM3 += m3;
      else ozet.malzemesizM3 += m3;
    }
    return ozet;
  }
  gecmisSayfa(page: number): void {
    const h = this.hedef();
    this.service
      .denetim(h.tur, h.id, page)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((r) => {
        if (r.isSuccess) this.denetim.set(r.value ?? null);
        else this.hata.set(r.error ?? 'Geçmiş alınamadı.');
      });
  }
  iptalIzni(): string {
    return {
      IsKaydi: this.izin.IsIptal,
      Siparis: this.izin.PoIptal,
      Fatura: this.izin.FaturaIptal,
      Gider: this.izin.GiderIptal,
    }[this.hedef().tur];
  }
  iptal(): void {
    if (!this.iptalNedeni.trim()) {
      this.hata.set('İptal gerekçesi zorunludur.');
      return;
    }
    const h = this.hedef();
    const reason = this.iptalNedeni.trim();
    const call =
      h.tur === 'IsKaydi'
        ? this.service.isIptal(h.id, reason)
        : h.tur === 'Siparis'
          ? this.service.siparisIptal(h.id, reason)
          : h.tur === 'Fatura'
            ? this.service.faturaIptal(h.id, reason)
            : this.service.giderIptal(h.id, reason);
    this.uygula(call, 'Kayıt iptal edildi.');
  }
  silOnizleme(): void {
    const h = this.hedef();
    this.preview.set(null);
    this.hata.set('');
    this.ikinciAdim.set(false);
    this.ikinciOnay = false;
    this.service
      .kaliciSilOnizleme(h.tur, h.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((r) => {
        if (r.isSuccess) this.preview.set(r.value ?? null);
        else this.hata.set(r.error ?? 'Bağımlılıklar kontrol edilemedi.');
      });
  }
  sil(): void {
    const p = this.preview();
    if (!p?.silinebilir || !this.ikinciAdim() || !this.ikinciOnay || !this.silmeNedeni.trim()) {
      this.hata.set('Güncel önizleme, ikinci onay ve silme gerekçesi zorunludur.');
      return;
    }
    this.uygula(
      this.service.kaliciSil({
        varlikTuru: p.varlikTuru,
        id: p.id,
        surum: p.surum,
        ikinciOnay: true,
        aciklama: this.silmeNedeni.trim(),
      }),
      'Kayıt kalıcı silindi; audit izi korundu.',
      true,
    );
  }
  private uygula<T>(call: Observable<ApiResult<T>>, message: string, close = false): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.hata.set('');
    call
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((r) => {
        if (!r.isSuccess) {
          this.hata.set(r.error ?? 'İşlem uygulanamadı.');
          return;
        }
        if (onayaAlindi(r)) {
          this.toast.info('İşlem onaya gönderildi; henüz uygulanmadı.');
          return;
        }
        this.toast.success(message);
        this.degisti.emit();
        if (close) this.kapat.emit();
        else this.yukle();
      });
  }
}
