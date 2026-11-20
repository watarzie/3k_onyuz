import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ConfirmService } from '../../../core/services/confirm.service';
import { ToastService } from '../../../core/services/toast.service';
import { YuklemePlanlamaService } from '../../../core/services/yukleme-planlama.service';
import {
  AciklikTarafi,
  DingilTuru,
  EkipmanAilesiModeli,
  EkipmanKaynakTuru,
  EkipmanKonfigurasyonDetayi,
  EkipmanTeknikVerisi,
  EngelTuru,
  onayaAlindi,
} from '../../../shared/models/index';
import {
  EKIPMAN_ALAN_SINIRI,
  EkipmanFormu,
  SatirDegisikligi,
  SatirListesi,
  bosEkipmanFormu,
  ekipmanFormuDenetle,
  ekipmanFormuDoldur,
  ekipmanKaydi,
  formdanTeknikVeri,
  satirEkle,
  satirGuncelle,
  satirSil,
  sorunMetinleri,
  teknikVeriDuzenlemeEngeli,
} from '../ortak/ekipman-formu';
import { ACIKLIK_TARAFI, DINGIL_TURU, EKIPMAN_KAYNAK_TURU, ENGEL_TURU } from '../ortak/yukleme-etiketleri';
import { Ekipman3dComponent } from './ekipman-3d.component';

/**
 * Ekipman konfigürasyonunu ekrandan ekler ya da düzenler (Excel şablonundaki bütün alanlar). Değişen teknik veri ya da
 * kaynak yeni, doğrulanmamış revizyon oluşturur; yalnız ad değişirse sunucu revizyon açmaz. Düzenlemede kod, tip,
 * üretici ve model değiştirilemez. 3B önizleme girilen değerlerle güncellenir. Çağrılan uçlar ekipman-kitapligi W
 * ister; bileşeni yalnız o izne sahip kullanıcıya açan üst ekrandır.
 *
 * Kayıtlı teknik veri formla kayıpsız taşınamıyorsa (okunamayan JSON, başka şema sürümü, formun bilmediği alan) form
 * salt okunur açılır ve kayıt kapalıdır: ekrandan kayıt o veriyi sessizce silerdi.
 */
@Component({
  selector: 'app-ekipman-duzenle',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, Ekipman3dComponent],
  templateUrl: './ekipman-duzenle.component.html',
  styleUrls: ['../ortak/yukleme.scss', './ekipman-duzenle.component.scss'],
})
export class EkipmanDuzenleComponent implements OnInit, AfterViewInit {
  private readonly api = inject(YuklemePlanlamaService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly destroyRef = inject(DestroyRef);

  /** Düzenlenen konfigürasyon; null ise yeni ekipman. */
  readonly detay = input<EkipmanKonfigurasyonDetayi | null>(null);
  /** Yeni kayıtta aile → tip seçimi (`GET aileler` yanıtı). */
  readonly aileler = input.required<EkipmanAilesiModeli[]>();
  /** Kayıt uygulandı: sunucunun döndürdüğü güncel ayrıntı. */
  readonly kaydedildi = output<EkipmanKonfigurasyonDetayi>();
  readonly kapandi = output<void>();

  readonly SINIR = EKIPMAN_ALAN_SINIRI;
  readonly KAYNAK_TURLERI = secenekler<EkipmanKaynakTuru>(EKIPMAN_KAYNAK_TURU, Number);
  readonly TARAFLAR = secenekler<AciklikTarafi>(ACIKLIK_TARAFI);
  readonly ENGEL_TURLERI = secenekler<EngelTuru>(ENGEL_TURU);
  readonly DINGIL_TURLERI = secenekler<DingilTuru>(DINGIL_TURU);

  readonly form = signal<EkipmanFormu>(bosEkipmanFormu());
  /** Formun açılıştaki hâli; kaydedilmemiş değişiklik bununla karşılaştırılır. */
  private readonly ilkDurum = signal('');
  readonly kaydediliyor = signal(false);
  readonly hata = signal<string | null>(null);
  readonly sorunlar = signal<string[]>([]);
  /** Kayıtlı teknik verinin ekrandan düzenlenememe nedeni; null ise form düzenlenebilir. */
  readonly engel = signal<string | null>(null);
  private readonly pencere = viewChild.required<ElementRef<HTMLElement>>('pencere');
  private readonly govde = viewChild.required<ElementRef<HTMLElement>>('govde');
  /** Kapatma onayı açıkken ikinci kapatma isteği (ör. yeniden Esc) yeni onay açmaz. */
  private onayBekliyor = false;

  readonly yeni = computed(() => this.detay() === null);
  readonly saltOkunur = computed(() => this.engel() !== null);
  readonly degisti = computed(() => JSON.stringify(this.form()) !== this.ilkDurum());
  readonly tipler = computed(() => this.aileler().find((a) => a.id === this.form().aileId)?.tipler ?? []);
  // Önizleme yalnız teknik veri değişince yeniden çizilir (ad, kaynak gibi alanlar sahneyi etkilemez).
  private readonly onizlemeJson = computed(() => JSON.stringify(formdanTeknikVeri(this.form())));
  readonly onizleme = computed(() => JSON.parse(this.onizlemeJson()) as EkipmanTeknikVerisi);

  ngOnInit(): void {
    const detay = this.detay();
    const form = detay ? ekipmanFormuDoldur(detay) : bosEkipmanFormu();
    this.form.set(form);
    this.ilkDurum.set(JSON.stringify(form));
    this.engel.set(detay ? teknikVeriDuzenlemeEngeli(detay) : null);
  }

  /** Odak pencereye gelir (Esc ve sekme sırası pencerede başlar): ilk düzenlenebilir alan, yoksa pencerenin kendisi. */
  ngAfterViewInit(): void {
    const ilkAlan = this.govde().nativeElement.querySelector<HTMLElement>(
      'input:not([readonly]):not(:disabled), select:not(:disabled), textarea:not(:disabled)',
    );
    (ilkAlan ?? this.pencere().nativeElement).focus();
  }

  alan(degisiklik: Partial<EkipmanFormu>): void {
    this.form.update((f) => ({ ...f, ...degisiklik }));
  }

  /** Aile değişince o aileye ait olmayan tip seçimi kalkar. */
  aileSec(aileId: number | null): void {
    const tipler = this.aileler().find((a) => a.id === aileId)?.tipler ?? [];
    this.form.update((f) => ({ ...f, aileId, tipId: tipler.some((t) => t.id === f.tipId) ? f.tipId : null }));
  }

  satirEkle(liste: SatirListesi): void {
    this.form.update((f) => satirEkle(f, liste));
  }

  satirSil(liste: SatirListesi, satirId: number): void {
    this.form.update((f) => satirSil(f, liste, satirId));
  }

  satir<K extends SatirListesi>(liste: K, satirId: number, degisiklik: SatirDegisikligi<K>): void {
    this.form.update((f) => satirGuncelle(f, liste, satirId, degisiklik));
  }

  kaydet(): void {
    if (this.kaydediliyor() || this.saltOkunur()) return;
    const eksikler = ekipmanFormuDenetle(this.form(), this.yeni());
    const kayit = eksikler.length ? null : ekipmanKaydi(this.form());
    if (!kayit) {
      this.hataGoster('Form eksik; aşağıdakileri tamamlayıp yeniden kaydedin.', eksikler);
      return;
    }
    const detay = this.detay();
    const istek = detay
      ? this.api.ekipmanGuncelle(detay.id, { ...kayit, beklenenRevizyonNo: detay.revizyon.revizyonNo })
      : this.api.ekipmanEkle(kayit);
    this.kaydediliyor.set(true);
    this.hata.set(null);
    this.sorunlar.set([]);
    istek.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((r) => {
      this.kaydediliyor.set(false);
      if (onayaAlindi(r)) {
        // Onaya alınan istek uygulanmadı: başarı mesajı ve yenileme yok.
        this.toast.info('İstek onaya gönderildi; onaylanınca uygulanır.');
        this.kapandi.emit();
        return;
      }
      if (!r.isSuccess || !r.value) {
        const sorunlar = sorunMetinleri(r);
        // Kayıt arada değişti: form eski revizyonla açık kalır; pencere kapanınca üst ekran güncel kaydı yeniden çeker.
        if (detay && r.statusCode === 409)
          sorunlar.push('Pencereyi kapatıp "Düzenle" ile yeniden açın; güncel revizyon yüklenir ve değişikliklerinizi yeniden girmeniz gerekir.');
        this.hataGoster(r.error ?? 'Ekipman kaydedilemedi.', sorunlar);
        return;
      }
      const yeniDetay = r.value;
      const revizyonNo = yeniDetay.revizyon.revizyonNo;
      if (!detay) this.toast.success(`${yeniDetay.kod} eklendi; revizyon ${revizyonNo} doğrulanmayı bekliyor.`);
      else if (revizyonNo > detay.revizyon.revizyonNo)
        this.toast.success(`${yeniDetay.kod}: revizyon ${revizyonNo} oluştu; doğrulama gerekir.`);
      else if (yeniDetay.ad !== detay.ad) this.toast.success(`${yeniDetay.kod}: ad güncellendi; revizyon açılmadı.`);
      else this.toast.info(`${yeniDetay.kod}: revizyon gerektiren değişiklik yok; son revizyon yine ${revizyonNo}.`);
      this.kaydedildi.emit(yeniDetay);
    });
  }

  /** X, Vazgeç, arka plan ve Esc: kayıt sürerken kapanmaz; kaydedilmemiş değişiklik varsa onay ister. */
  async kapat(): Promise<void> {
    if (this.kaydediliyor() || this.onayBekliyor) return;
    if (this.degisti()) {
      this.onayBekliyor = true;
      const onay = await this.confirm.ask({
        title: 'Kaydedilmemiş değişiklikler',
        message: 'Kaydedilmemiş değişiklikler var; kapatırsanız girdikleriniz kaybolur. Kapatılsın mı?',
        confirmText: 'Kapat',
        cancelText: 'Düzenlemeye dön',
        type: 'warning',
      });
      this.onayBekliyor = false;
      if (!onay) return;
    }
    this.kapandi.emit();
  }

  /** Hata formun üstünde gösterilir; kullanıcı aşağıdaysa görebilsin diye gövde başa kaydırılır. */
  private hataGoster(mesaj: string, sorunlar: string[]): void {
    this.hata.set(mesaj);
    this.sorunlar.set(sorunlar);
    this.govde().nativeElement.scrollTo({ top: 0 });
  }
}

/** Etiket eşlemesini seçim listesine çevirir; sayı anahtarlı enum için `cevir` verilir (nesne anahtarı metindir). */
function secenekler<T extends string | number>(
  etiketler: Record<T, string>, cevir?: (anahtar: string) => T,
): { deger: T; ad: string }[] {
  return Object.entries<string>(etiketler).map(([anahtar, ad]) => ({ deger: cevir ? cevir(anahtar) : (anahtar as T), ad }));
}
