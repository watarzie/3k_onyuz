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
import { Subject, finalize, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AmbalajYasamDongusuService } from '../../core/services/ambalaj-yasam-dongusu.service';
import { PermissionService } from '../../core/services/permission.service';
import { ToastService } from '../../core/services/toast.service';
import { AmbalajBagimsizSandikDto, AmbalajUretimPlanDto, ApiResult } from '../../shared/models';
import { TranslationService } from '../../core/services/translation.service';
import {
  AmbalajFormOlusturRequest,
  AmbalajFormSurumu,
  AmbalajGerceklesme,
  AmbalajGerceklesenRapor,
} from '../../shared/models/ambalaj-yasam-dongusu.model';

@Component({
  selector: 'app-uretim-yasam-dongusu',
  standalone: true,
  imports: [FormsModule, DatePipe, DecimalPipe],
  templateUrl: './uretim-yasam-dongusu.component.html',
  styleUrl: './uretim-yasam-dongusu.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UretimYasamDongusuComponent {
  plan = input<AmbalajUretimPlanDto | null>(null);
  bagimsiz = input<AmbalajBagimsizSandikDto | null>(null);
  entegre = input(false);
  grup = input<number | null>(null);
  islemGerekcesi = input('');
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
  readonly izin = inject(PermissionService);
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
      this.izin.canWrite('ambalaj-form-olustur') ||
      this.izin.canWrite('ambalaj-form-yeniden-olustur') ||
      this.izin.canWrite('ambalaj-plan-olustur'),
  );
  private secimKapsami: string | null = null;
  private formKapsami: string | null = null;
  private oncekiSatirlar: {
    id: number;
    kaynakSandikId?: number | null;
    ambalajaDahilMi?: boolean | null;
  }[] = [];
  formlar = signal<AmbalajFormSurumu[]>([]);
  rapor = signal<AmbalajGerceklesenRapor | null>(null);
  islemde = signal(false);
  raporYukleniyor = signal(false);
  duzeltme = signal<AmbalajGerceklesme | null>(null);
  gerekce = '';
  yeniden = false;
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
            return (
              k.ambalajaDahilMi !== false &&
              (kapsam !== this.secimKapsami || !eski || eski.haric || eski.secili)
            );
          })
          .map((k) => this.secimKimligi(k)),
      );
      this.oncekiSatirlar = rows;
      this.secimKapsami = kapsam;
      const formKapsami = (p || b) && this.izin.hasAccess('ambalaj-form-goruntule') ? kapsam : null;
      if (formKapsami !== this.formKapsami) {
        this.formlar.set([]);
        this.formKapsami = formKapsami;
        if (formKapsami) this.formIstekleri.next(b ? { kayitId: b.id } : { projeId: p!.projeId });
      }
    });
    effect(() => {
      this.gerekce = this.islemGerekcesi();
    });
  }

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
  olustur() {
    const plan = this.plan();
    const bagimsiz = this.bagimsiz();
    if ((!plan && !bagimsiz) || this.islemde() || !this.secim().length) return;
    if (this.yeniden && !this.gerekce.trim()) {
      this.toast.warning(this.t('REASON_REQUIRED'));
      return;
    }
    const request: AmbalajFormOlusturRequest = {
      projeId: plan?.projeId ?? bagimsiz?.projeId,
      kayitIdleri: this.secim()
        .filter((id) => id > 0)
        .sort((a, b) => a - b),
      kaynakSandikIdleri: this.secim()
        .filter((id) => id < 0)
        .map((id) => -id)
        .sort((a, b) => a - b),
      yenidenOlustur: this.yeniden,
      aciklama: this.gerekce.trim(),
      idempotencyAnahtari: '',
    };
    const imza = JSON.stringify(request);
    if (this.sonIstek?.imza !== imza) this.sonIstek = { imza, key: crypto.randomUUID() };
    request.idempotencyAnahtari = this.sonIstek!.key;
    this.islemde.set(true);
    this.api
      .formOlustur(request)
      .pipe(
        finalize(() => this.islemde.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((r) => {
        if (!this.uygulandi(r)) return;
        this.toast.success(this.t('FORM_SAVED'));
        if (this.izin.hasAccess('ambalaj-form-goruntule'))
          this.formIstekleri.next(bagimsiz ? { kayitId: bagimsiz.id } : { projeId: plan!.projeId });
        this.degisti.emit();
      });
  }
  durum(id: number, durum: number) {
    if (this.islemde()) return;
    if (durum !== 3 && !this.gerekce.trim()) {
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
          this.degisti.emit();
        }
      });
  }
  raporGetir() {
    this.raporIstekleri.next();
  }
  formIndir(id: number, format: 'pdf' | 'xlsx') {
    this.api
      .formIndir(id, format)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (b) => this.indir(b, `uretim-formu-${id}.${format}`),
        error: () => this.toast.error(this.t('DOWNLOAD_ERROR')),
      });
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
    if (r.statusCode === 202) {
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
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
