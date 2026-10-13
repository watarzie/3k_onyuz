import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, Subject, finalize, of, switchMap } from 'rxjs';
import { NgApexchartsModule, ApexAxisChartSeries, ApexChart, ApexXAxis } from 'ng-apexcharts';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AmbalajYasamDongusuService } from '../../../core/services/ambalaj-yasam-dongusu.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ToastService } from '../../../core/services/toast.service';
import { AmbalajBagimsizSandikDto, AmbalajKayitGecmisi, AmbalajUretimPlanDto, ApiResult, onayaAlindi } from '../../../shared/models';
import { TranslationService } from '../../../core/services/translation.service';
import {
  AmbalajFormOlusturRequest,
  AmbalajFormSurumu,
  AmbalajGerceklesme,
  AmbalajGerceklesenRapor,
} from '../../../shared/models/ambalaj-yasam-dongusu.model';
import { AMBALAJ_YETKI } from '../../../core/constants/yetki-kodlari';
import { dosyayiKaydet } from '../../../core/services/dosya-kaydet';
import { IslemlerMenusuComponent } from '../../../shared/components/islemler-menusu/islemler-menusu.component';

type FormBicimi = 'pdf' | 'xlsx';

@Component({
  selector: 'app-uretim-yasam-dongusu',
  standalone: true,
  imports: [FormsModule, DatePipe, DecimalPipe, NgApexchartsModule, IslemlerMenusuComponent],
  templateUrl: './uretim-yasam-dongusu.component.html',
  styleUrl: './uretim-yasam-dongusu.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UretimYasamDongusuComponent {
  plan = input<AmbalajUretimPlanDto | null>(null);
  bagimsiz = input<AmbalajBagimsizSandikDto | null>(null);
  /** Finansa aktar / geri al yanıtındaki güncel özel sandık; liste yenilenene kadar panel bunu gösterir. */
  private ozelGuncel = signal<AmbalajBagimsizSandikDto | null>(null);
  /** Ekrandaki özel sandık: işlem yanıtı varsa o, yoksa girdi. */
  ozel = computed(() => {
    const b = this.bagimsiz();
    const g = this.ozelGuncel();
    return b && g?.id === b.id ? g : b;
  });
  entegre = input(false);
  grup = input<number | null>(null);
  /**
   * Bütün gruplar listelenirken (grup null) ilk açılışta ve yeni satırda varsayılan seçilecek grup; diğer gruplardaki
   * satırlar görünür ve seçilebilir ama kendiliğinden seçilmez. Boşsa bütün dahil satırlar seçilir.
   */
  varsayilanGrup = input<number | null>(null);
  islemGerekcesi = input('');
  /**
   * Form oluşturulmadan hemen önce çalışan isteğe bağlı adım (entegre planda kaydedilmemiş fırın parti numarasını
   * kaydeder); false dönerse form oluşturulmaz.
   */
  formOncesi = input<(() => Observable<boolean>) | null>(null);
  gerekceDegisti = output<string>();
  satirlar = computed(() => {
    const b = this.bagimsiz();
    const rows = this.plan()?.kalemler ?? (b ? [{ ...b, kaynakSandikId: undefined }] : []);
    return this.grup() === null ? rows : rows.filter((k) => k.tur === this.grup());
  });
  raporModu = input(false);
  degisti = output<void>();
  private api = inject(AmbalajYasamDongusuService);
  private destroyRef = inject(DestroyRef);
  readonly permissions = inject(PermissionService);
  readonly izin = AMBALAJ_YETKI;
  private toast = inject(ToastService);
  private i18n = inject(TranslationService);
  private raporIstekleri = new Subject<void>();
  private formIstekleri = new Subject<{ projeId?: number; kayitId?: number }>();
  private sonIstek: { imza: string; key: string } | null = null;
  secim = signal<number[]>([]);
  seciliAdet = computed(() =>
    this.satirlar()
      .filter((k) => this.secim().includes(this.secimKimligi(k)))
      .reduce((n, k) => n + k.adet, 0),
  );
  seciliHacim = computed(() => {
    const rows = this.satirlar().filter((k) => this.secim().includes(this.secimKimligi(k)));
    return rows.some((k) => k.hacimM3 != null)
      ? rows.reduce((n, k) => n + (k.hacimM3 ?? 0), 0)
      : null;
  });
  secimYetkili = computed(
    () =>
      this.permissions.canWrite(AMBALAJ_YETKI.FormOlustur) ||
      this.permissions.canWrite(AMBALAJ_YETKI.FormYenidenOlustur) ||
      this.permissions.canWrite(AMBALAJ_YETKI.PlanOlustur),
  );
  private secimKapsami: string | null = null;
  private formKapsami: string | null = null;
  private oncekiSatirlar: {
    id: number;
    kaynakSandikId?: number | null;
    ambalajaDahilMi?: boolean | null;
  }[] = [];
  formlar = signal<AmbalajFormSurumu[]>([]);
  /** Özel sandıkta "Finanstan geri al" onayı; isteğe bağlı gerekçe alanı yalnız o an açılır. */
  finansGeriAlAcik = signal(false);
  /** Özel sandığın değişiklik geçmişi (isteğe bağlı açılır; her işlemden sonra yenilenir). */
  gecmisAcik = signal(false);
  gecmisYukleniyor = signal(false);
  gecmisKayitlari = signal<AmbalajKayitGecmisi[]>([]);
  /** Açılan olaylar: oluşturma gibi çok alanlı olaylar varsayılan kısaltılır. */
  gecmisGenis = signal<ReadonlySet<number>>(new Set());
  rapor = signal<AmbalajGerceklesenRapor | null>(null);
  islemde = signal(false);
  raporYukleniyor = signal(false);
  duzeltme = signal<AmbalajGerceklesme | null>(null);
  gerekce = '';
  /** A6: isteğe bağlı tarih; formdaki sandıklardan oluşan finans kalemlerinin varsayılan finans tarihi olur. */
  finansTarihi = '';
  baslangic =
    new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' }).slice(0, 7) + '-01';
  bitis = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });
  gruplama: 'projeler' | 'gunler' | 'aylar' | 'cinsler' = 'projeler';
  t(key: string) {
    return this.i18n.translate(`URETIM_V2.${key}`);
  }

  constructor() {
    this.formIstekleri
      .pipe(
        switchMap((id) => this.api.formlar(id)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((r) => {
        if (r.isSuccess && r.value) this.formlar.set(r.value);
        else this.toast.error(r.error ?? this.t('FORM_ERROR'));
      });
    this.raporIstekleri
      .pipe(
        switchMap(() => {
          this.raporYukleniyor.set(true);
          return this.api
            .rapor(this.baslangic, this.bitis)
            .pipe(finalize(() => this.raporYukleniyor.set(false)));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((r) => {
        if (r.isSuccess && r.value) this.rapor.set(r.value);
        else {
          this.rapor.set(null);
          this.toast.error(r.error ?? this.t('REPORT_ERROR'));
        }
      });
    effect(() => {
      const p = this.plan();
      const b = this.bagimsiz();
      const rows = this.satirlar();
      const kapsam = b ? `K:${b.id}` : p ? `P:${p.projeId}:G:${this.grup()}` : null;
      const varsayilan = this.varsayilanGrup();
      const oncekiSecim = untracked(this.secim);
      const eskiKararlar = new Map(
        this.oncekiSatirlar.map((k) => [
          this.kalemAnahtari(k),
          {
            secili: oncekiSecim.includes(this.secimKimligi(k)),
            haric: k.ambalajaDahilMi === false,
          },
        ]),
      );
      this.secim.set(
        rows
          .filter((k) => {
            const eski = eskiKararlar.get(this.kalemAnahtari(k));
            if (k.ambalajaDahilMi === false) return false;
            if (kapsam !== this.secimKapsami || !eski) return varsayilan === null || k.tur === varsayilan;
            return eski.haric || eski.secili;
          })
          .map((k) => this.secimKimligi(k)),
      );
      this.oncekiSatirlar = rows;
      this.secimKapsami = kapsam;
      // Özel sandıkta üretim formu yoktur; form geçmişi yalnız plan için okunur.
      const formKapsami = p && !b && this.permissions.hasAccess(AMBALAJ_YETKI.FormGoruntule) ? kapsam : null;
      if (formKapsami !== this.formKapsami) {
        this.formlar.set([]);
        this.formKapsami = formKapsami;
        if (formKapsami) this.formIstekleri.next({ projeId: p!.projeId });
      }
    });
    effect(() => {
      this.bagimsiz();
      untracked(() => {
        this.ozelGuncel.set(null);
        this.finansGeriAlAcik.set(false);
        this.gecmisAcik.set(false);
        this.gecmisKayitlari.set([]);
        this.gecmisGenis.set(new Set());
      });
    });
    effect(() => {
      this.gerekce = this.islemGerekcesi();
    });
  }

  /** Herhangi bir form sürümünde yer almış kayıtlar; bu kayıtlar seçilirse form güncel veriyle yeniden oluşturulur. */
  formluKayitlar = computed(() => new Set(this.formlar().flatMap((f) => f.form.kalemler.map((k) => k.kayitId))));
  /**
   * A2/D10: sürüm seçimi kaldırıldı. Seçimde formu olan kayıt varsa istek yeniden oluşturmadır (sunucu formu güncel
   * veriyle üretir); form geçmişi okunamıyorsa üretime alınmış kayıt formlu sayılır.
   */
  yenidenOlusturulacak = computed(() => {
    const secili = this.satirlar().filter((k) => k.id > 0 && this.secim().includes(this.secimKimligi(k)));
    const formlu = this.formluKayitlar();
    return secili.some((k) =>
      this.permissions.hasAccess(AMBALAJ_YETKI.FormGoruntule) ? formlu.has(k.id) : (k.uretimDurumu ?? 1) > 1,
    );
  });
  /**
   * Özel sandığın tek bakışta durumu. Üretim formu ve üretim adımları yoktur: kaydedilen sandık "Finansa aktar" ile
   * finansa iş kaydı olarak aktarılır, proje tamamlanınca tamamlanır.
   */
  tekilDurum = computed((): 'haric' | 'aktarilmadi' | 'aktarildi' | 'tamamlandi' => {
    const b = this.ozel();
    if (!b || b.ambalajaDahilMi === false) return 'haric';
    if ((b.uretimDurumu ?? 1) === 3) return 'tamamlandi';
    return b.uretimeAlindi ? 'aktarildi' : 'aktarilmadi';
  });
  ozelAktarYetkili(): boolean {
    return this.permissions.canWrite(AMBALAJ_YETKI.DurumDuzenle);
  }
  ozelGeriAlYetkili(): boolean {
    return this.permissions.canWrite(AMBALAJ_YETKI.DurumDuzenle) && this.permissions.canWrite(AMBALAJ_YETKI.DurumuGeriAl);
  }
  /** A5: gerçekleşen üretim raporundan aylık üretilen çam (ahşap kapalı + kafes) net ve sarf m³. */
  camGrafigi = computed(() => {
    const r = this.rapor();
    if (!r || !r.m3Gorunur) return null;
    const aylar = new Map<string, { net: number; sarf: number }>();
    for (const k of r.kayitlar) {
      if (!k.m3HesaplanabilirMi || k.netM3 == null || ![1, 2].includes(k.sandikCinsi)) continue;
      const ay = k.tarih.slice(0, 7);
      const deger = aylar.get(ay) ?? { net: 0, sarf: 0 };
      deger.net += k.netM3;
      deger.sarf += k.sarfM3 ?? 0;
      aylar.set(ay, deger);
    }
    if (!aylar.size) return null;
    const anahtarlar = [...aylar.keys()].sort();
    const series: ApexAxisChartSeries = [
      { name: this.t('NET'), data: anahtarlar.map((ay) => Math.round(aylar.get(ay)!.net * 1000) / 1000) },
    ];
    if (r.sarfGorunur && this.permissions.hasAccess(AMBALAJ_YETKI.SarfGoruntule))
      series.push({ name: this.t('WASTE'), data: anahtarlar.map((ay) => Math.round(aylar.get(ay)!.sarf * 1000) / 1000) });
    return { series, xaxis: { categories: anahtarlar } as ApexXAxis };
  });
  readonly grafik: ApexChart = { type: 'bar', height: 260, stacked: true, toolbar: { show: false }, animations: { enabled: false } };

  secimKimligi(k: { id: number; kaynakSandikId?: number | null }): number {
    return k.id || -(k.kaynakSandikId || 0);
  }
  private kalemAnahtari(k: { id: number; kaynakSandikId?: number | null }): string {
    return k.kaynakSandikId ? `S:${k.kaynakSandikId}` : `K:${k.id}`;
  }
  sec(id: number, checked: boolean) {
    if (
      this.islemde() ||
      !this.secimYetkili() ||
      this.satirlar().find((k) => this.secimKimligi(k) === id)?.ambalajaDahilMi === false
    )
      return;
    this.secim.update((ids) =>
      checked ? [...new Set([...ids, id])] : ids.filter((x) => x !== id),
    );
  }
  hepsiniSec(checked: boolean) {
    if (this.islemde() || !this.secimYetkili()) return;
    this.secim.set(
      checked
        ? this.satirlar()
            .filter((k) => k.ambalajaDahilMi !== false)
            .map((k) => this.secimKimligi(k))
        : [],
    );
  }
  gerekceyiDegistir(value: string) {
    this.gerekce = value;
    this.gerekceDegisti.emit(value);
  }
  /** Oluşturma yetkisi: seçimde formlu kayıt varsa yeniden oluşturma, yoksa ilk form izni. */
  formYetkili(): boolean {
    return this.permissions.canWrite(
      this.yenidenOlusturulacak() ? AMBALAJ_YETKI.FormYenidenOlustur : AMBALAJ_YETKI.FormOlustur,
    );
  }
  /** Formun indirilebileceği biçimler; sunucudaki indirme ucu form görüntüleme ve biçim iznini birlikte ister. */
  indirmeBicimleri(): FormBicimi[] {
    if (!this.permissions.hasAccess(AMBALAJ_YETKI.FormGoruntule)) return [];
    const bicimler: FormBicimi[] = [];
    if (this.permissions.hasAccess(AMBALAJ_YETKI.FormIndir)) bicimler.push('pdf');
    if (this.permissions.hasAccess(AMBALAJ_YETKI.ExcelIndir)) bicimler.push('xlsx');
    return bicimler;
  }
  /**
   * Formu o anki güncel veriyle oluşturur ve seçilen biçimde hemen indirir (A2/D10); biçim verilmezse yalnız
   * oluşturur. Entegre planda önce `formOncesi` adımı çalışır; plan kaydı gerekmez.
   */
  olustur(bicim: FormBicimi | null = null) {
    const plan = this.plan();
    const bagimsiz = this.bagimsiz();
    if ((!plan && !bagimsiz) || this.islemde() || !this.secim().length || !this.formYetkili()) return;
    const request: AmbalajFormOlusturRequest = {
      projeId: plan?.projeId ?? bagimsiz?.projeId,
      kayitIdleri: this.secim()
        .filter((id) => id > 0)
        .sort((a, b) => a - b),
      kaynakSandikIdleri: this.secim()
        .filter((id) => id < 0)
        .map((id) => -id)
        .sort((a, b) => a - b),
      yenidenOlustur: this.yenidenOlusturulacak(),
      // A2/D11: üretim formu işlemleri gerekçe istemez.
      aciklama: undefined,
      finansTarihi: this.finansTarihi || null,
      idempotencyAnahtari: '',
    };
    const imza = JSON.stringify(request);
    if (this.sonIstek?.imza !== imza) this.sonIstek = { imza, key: crypto.randomUUID() };
    request.idempotencyAnahtari = this.sonIstek!.key;
    this.islemde.set(true);
    const oncesi = this.formOncesi();
    (oncesi ? oncesi() : of(true))
      .pipe(
        switchMap((devam) => (devam ? this.api.formOlustur(request) : of(null))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (r) => {
          if (!r || !this.uygulandi(r)) {
            this.islemde.set(false);
            return;
          }
          if (this.permissions.hasAccess(AMBALAJ_YETKI.FormGoruntule))
            this.formIstekleri.next(bagimsiz ? { kayitId: bagimsiz.id } : { projeId: plan!.projeId });
          this.degisti.emit();
          if (bicim && r.value) this.olusanFormuIndir(r.value.id, bicim);
          else {
            this.islemde.set(false);
            this.toast.success(this.t('FORM_SAVED'));
          }
        },
        error: () => {
          this.islemde.set(false);
          this.toast.error(this.t('FAILED'));
        },
      });
  }
  /** Oluşan form seçilen biçimde indirilir; indirme başarısız olsa da form oluşturulmuştur. */
  private olusanFormuIndir(id: number, bicim: FormBicimi) {
    this.api
      .formIndir(id, bicim)
      .pipe(
        finalize(() => this.islemde.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (b) => {
          this.indir(b, this.formDosyaAdi(bicim));
          this.toast.success(this.t('FORM_DOWNLOADED'));
        },
        error: () => this.toast.error(this.t('FORM_DOWNLOAD_FAILED')),
      });
  }
  private formDosyaAdi(bicim: FormBicimi): string {
    const projeNo = (this.plan()?.projeNo || this.bagimsiz()?.projeNo || 'bagimsiz').replace(/[\\/:*?"<>|\s]+/g, '-');
    const zaman = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Istanbul' }).slice(0, 16).replace(/\D/g, '');
    return `uretim-formu-${projeNo}-${zaman}.${bicim}`;
  }
  durum(id: number, durum: number) {
    if (this.islemde()) return;
    // Gerekçe yalnız geri almada (Bekleyene al, Yeniden aç) istenir; ileri adımlar kritik değildir.
    const mevcut = this.satirlar().find((k) => k.id === id)?.uretimDurumu ?? 1;
    if (durum < mevcut && !this.gerekce.trim()) {
      this.toast.warning(this.t('REASON_REQUIRED'));
      return;
    }
    this.islemde.set(true);
    this.api
      .durum(id, durum, this.gerekce)
      .pipe(
        finalize(() => this.islemde.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((r) => {
        if (this.uygulandi(r)) {
          this.toast.success(this.t('STATUS_SAVED'));
          this.gerekceyiDegistir('');
          this.degisti.emit();
        }
      });
  }
  gecmisiAcKapat() {
    const acik = !this.gecmisAcik();
    this.gecmisAcik.set(acik);
    if (acik) this.gecmisiYukle();
  }
  private gecmisiYukle() {
    const b = this.ozel();
    if (!b || !this.gecmisAcik()) return;
    this.gecmisYukleniyor.set(true);
    this.api
      .gecmis(b.id)
      .pipe(
        finalize(() => this.gecmisYukleniyor.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((r) => {
        if (r.isSuccess) this.gecmisKayitlari.set(r.value ?? []);
        else this.toast.error(r.error ?? this.t('HISTORY_ERROR'));
      });
  }
  gecmisOlayiAcKapat(i: number) {
    this.gecmisGenis.update((s) => {
      const yeni = new Set(s);
      if (yeni.has(i)) yeni.delete(i);
      else yeni.add(i);
      return yeni;
    });
  }
  /** Özel sandığı finansa aktarır; Finans iş kaydı açılır ve tarifesiyle fiyatlanır. */
  finansaAktar() {
    const b = this.ozel();
    if (!b || this.islemde() || !this.ozelAktarYetkili()) return;
    this.islemde.set(true);
    this.api
      .finansaAktar(b.id, this.finansTarihi || null)
      .pipe(
        finalize(() => this.islemde.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((r) => {
        if (!this.uygulandi(r)) return;
        if (r.value) this.ozelGuncel.set(r.value);
        this.finansTarihi = '';
        this.gecmisiYukle();
        this.toast.success(this.t('FINANCE_TRANSFERRED'));
        this.degisti.emit();
      });
  }
  /** Özel sandığı finanstan geri alır (PO yoksa); gerekçe isteğe bağlıdır. */
  finanstanGeriAl() {
    const b = this.ozel();
    if (!b || this.islemde() || !this.ozelGeriAlYetkili()) return;
    this.islemde.set(true);
    this.api
      .finanstanGeriAl(b.id, this.gerekce.trim())
      .pipe(
        finalize(() => this.islemde.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((r) => {
        if (!this.uygulandi(r)) return;
        if (r.value) this.ozelGuncel.set(r.value);
        this.finansGeriAlAcik.set(false);
        this.gerekceyiDegistir('');
        this.gecmisiYukle();
        this.toast.success(this.t('FINANCE_REVERTED'));
        this.degisti.emit();
      });
  }
  raporGetir() {
    this.raporIstekleri.next();
  }
  raporIndir(format: 'pdf' | 'xlsx') {
    this.api
      .raporIndir(this.baslangic, this.bitis, format)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (b) => this.indir(b, `gerceklesen-uretim.${format}`),
        error: () => this.toast.error(this.t('DOWNLOAD_ERROR')),
      });
  }
  duzelt(k: AmbalajGerceklesme) {
    this.duzeltme.set({ ...k, tarih: k.tarih.slice(0, 10) });
    this.gerekce = '';
  }
  duzeltmeyiKaydet() {
    const k = this.duzeltme();
    if (!k || this.islemde() || !this.gerekce.trim()) return;
    this.islemde.set(true);
    this.api
      .duzelt(k, this.gerekce)
      .pipe(
        finalize(() => this.islemde.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((r) => {
        if (this.uygulandi(r)) {
          this.duzeltme.set(null);
          this.raporGetir();
          this.toast.success(this.t('CORRECTION_SAVED'));
        }
      });
  }
  private uygulandi<T>(r: ApiResult<T>): boolean {
    if (onayaAlindi(r)) {
      this.toast.info(this.t('PENDING'));
      return false;
    }
    if (!r.isSuccess) {
      this.toast.error(r.error ?? this.t('FAILED'));
      return false;
    }
    return true;
  }
  private indir(blob: Blob, name: string) {
    dosyayiKaydet(blob, name);
  }
}
