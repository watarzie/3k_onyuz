import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, finalize } from 'rxjs';
import { AMBALAJ_YETKI, FINANS_YETKI } from '../../core/constants/yetki-kodlari';
import { FinansService } from '../../core/services/finans.service';
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
  FinansBelge,
  FinansDegisiklik,
  FinansFiyatlandirma,
  FinansKaliciSilOnizleme,
  FinansSablon,
  FinansVarlikTuru,
} from '../../shared/models/finans-v2.model';
import { ServerPagerComponent } from '../../shared/components/server-pager/server-pager.component';

@Component({
  selector: 'app-finans-kayit-detay',
  standalone: true,
  imports: [FormsModule, DatePipe, DecimalPipe, ServerPagerComponent],
  templateUrl: './finans-kayit-detay.component.html',
  styleUrls: ['./finans-v2.scss', './finans-islem-dialoglari.scss'],
})
export class FinansKayitDetayComponent implements OnInit {
  readonly hedef = input.required<{ tur: FinansVarlikTuru; id: number }>();
  readonly kapat = output<void>();
  readonly degisti = output<void>();
  readonly siparisAc = output<number[]>();
  readonly faturaAc = output<number>();
  private readonly service = inject(FinansService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);
  readonly permissions = inject(PermissionService);
  readonly izin = FINANS_YETKI;
  readonly kayit = signal<FinansIsKaydi | null>(null);
  readonly belgeler = signal<FinansBelge[]>([]);
  readonly siparis = signal<FinansSiparis | null>(null);
  readonly fatura = signal<FinansFatura | null>(null);
  belgeForm = { numara: '', tarih: '', aciklama: '', gerekce: '' };
  belgeKalemleri: {
    id: number;
    isKaydiId: number;
    ad: string;
    netTutar: number | null;
    paraBirimi: string;
  }[] = [];
  tutarlariDuzenle = false;
  readonly denetim = signal<FinansSayfaliSonuc<FinansDegisiklik> | null>(null);
  readonly sablonlar = signal<FinansSablon[]>([]);
  readonly preview = signal<FinansKaliciSilOnizleme | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly hata = signal('');
  readonly sekme = signal<'bilgi' | 'fiyat' | 'belge' | 'gecmis' | 'islemler'>('bilgi');
  readonly ikinciAdim = signal(false);
  finansTarihi = '';
  tarihNedeni = '';
  iptalNedeni = '';
  silmeNedeni = '';
  ikinciOnay = false;
  secilenSablonSurumId: number | null = null;
  fiyat: FinansFiyatlandirma = {
    fiyatlandirmaBirimi: 1,
    adet: 1,
    birimM3: 0,
    birimFiyat: 0,
    paraBirimi: 'EUR',
    kdvOrani: 20,
    aciklama: '',
    bilesenler: [],
    alanDegerleri: {},
  };
  ngOnInit(): void {
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
      [
        this.izin.ParasalVeriGoruntule,
        this.izin.BirimFiyatGoruntule,
        this.izin.TutarGoruntule,
        this.izin.GelirGoruntule,
        this.izin.GiderGoruntule,
        this.izin.KarlilikGoruntule,
        AMBALAJ_YETKI.OlcuGoruntule,
        AMBALAJ_YETKI.M3Goruntule,
        AMBALAJ_YETKI.SarfGoruntule,
      ].every((kod) => this.permissions.hasAccess(kod))
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
          };
          this.belgeKalemleri = r.value.kalemler.map((x) => ({
            id: x.id,
            isKaydiId: x.isKaydiId,
            ad: x.sandikAdi || x.urunAdi,
            netTutar: x.netTutar,
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
          };
          this.belgeKalemleri = (f.kalemler ?? []).map((x) => ({
            id: x.siparisKalemiId,
            isKaydiId: x.isKaydiId,
            ad: `İş #${x.isKaydiId}`,
            netTutar: x.netTutar,
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
        this.secilenSablonSurumId = k.sablonSurumId ?? null;
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
            sablonSurumId: k.sablonSurumId,
            bilesenler: k.bilesenler?.map((b) => ({ ...b })) ?? [],
            alanDegerleri: { ...k.alanDegerleri },
          };
        }
      });
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
      this.uygula(
        this.service.faturaGuncelle(this.hedef().id, {
          faturaNumarasi: form.numara.trim(),
          faturaTarihi: form.tarih,
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
  tab(value: 'bilgi' | 'fiyat' | 'belge' | 'gecmis' | 'islemler'): void {
    this.sekme.set(value);
    this.hata.set('');
    if (value === 'belge') this.belgeleriYukle();
    if (value === 'gecmis') this.gecmisSayfa(1);
    if (value === 'fiyat')
      this.service
        .sablonlar()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((result) => {
          if (result.isSuccess) this.sablonlar.set(result.value ?? []);
        });
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
  sablonSec(): void {
    this.fiyat.sablonSurumId = this.secilenSablonSurumId;
    this.fiyat.alanDegerleri = {};
  }
  sablonSecenekleri(): FinansSablon[] {
    const kayitli = this.kayit()?.sablon;
    return kayitli
      ? [kayitli, ...this.sablonlar().filter((x) => x.surumId !== kayitli.surumId)]
      : this.sablonlar();
  }
  secilenSablon(): FinansSablon | undefined {
    return this.sablonSecenekleri().find((x) => x.surumId === this.secilenSablonSurumId);
  }
  alanTipi(type: string): string {
    return (
      ({ sayi: 'number', tarih: 'date', Number: 'number', Date: 'date' } as Record<string, string>)[
        type
      ] ?? 'text'
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
    const alanDegerleri = Object.fromEntries(
      Object.entries(this.fiyat.alanDegerleri ?? {}).map(([key, value]) => [
        key,
        value == null ? null : String(value).trim(),
      ]),
    );
    if (this.secilenSablon()?.alanlar.some((a) => a.zorunlu && !alanDegerleri[a.kod])) {
      this.hata.set('Şablonun zorunlu alanlarını tamamlayın.');
      return;
    }
    this.uygula(
      this.service.fiyatlandir(this.hedef().id, { ...this.fiyat, alanDegerleri }),
      'Fiyatlandırma kaydedildi.',
    );
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
  belgeleriYukle(): void {
    const h = this.hedef();
    this.service
      .belgeler(h.tur, h.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((r) => {
        if (r.isSuccess) this.belgeler.set(r.value ?? []);
        else this.hata.set(r.error ?? 'Belgeler yüklenemedi.');
      });
  }
  yukleBelge(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf') || file.size > 10 * 1024 * 1024) {
      this.hata.set('En fazla 10 MB PDF seçin. Dosya içeriği sunucuda da doğrulanır.');
      input.value = '';
      return;
    }
    const h = this.hedef();
    this.saving.set(true);
    this.service
      .belgeYukle(h.tur, h.id, file)
      .pipe(
        finalize(() => {
          this.saving.set(false);
          input.value = '';
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((r) => {
        if (!r.isSuccess) this.hata.set(r.error ?? 'Belge yüklenemedi.');
        else if (r.statusCode === 202) this.toast.info('Belge işlemi onaya gönderildi.');
        else {
          this.toast.success('PDF yeni sürüm olarak kaydedildi.');
          this.belgeleriYukle();
        }
      });
  }
  belgeIndir(belge: FinansBelge): void {
    this.service
      .belgeIndir(belge.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = belge.orijinalAd;
          a.click();
          URL.revokeObjectURL(url);
        },
        error: async (error: unknown) =>
          this.hata.set(
            await this.service.downloadErrorMessage(
              error,
              'Belge indirilemedi veya indirme yetkiniz kaldırıldı.',
            ),
          ),
      });
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
        if (r.statusCode === 202) {
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
