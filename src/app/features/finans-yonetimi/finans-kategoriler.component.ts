import { Component, DestroyRef, OnInit, computed, inject, output, signal } from '@angular/core';
import { TranslationService } from '../../core/services/translation.service';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { FinansService } from '../../core/services/finans.service';
import { ToastService } from '../../core/services/toast.service';
import { PermissionService } from '../../core/services/permission.service';
import { FINANS_YETKI } from '../../core/constants/yetki-kodlari';
import { FinansGiderKalemi, FinansGiderKategori } from '../../shared/models/finans.model';

@Component({
  selector: 'app-finans-kategoriler',
  standalone: true,
  imports: [FormsModule],
  styleUrl: './finans-v2.scss',
  templateUrl: './finans-kategoriler.component.html',
})
export class FinansKategorilerComponent implements OnInit {
  private readonly translation = inject(TranslationService);
  t(key: string): string {
    return this.translation.translate(`FINANS_V2.${key}`);
  }
  private readonly service = inject(FinansService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);
  private readonly permissions = inject(PermissionService);
  private listeSurumu = 0;
  readonly degisti = output<void>();
  readonly kategoriler = signal<FinansGiderKategori[]>([]);
  readonly loading = signal(false);
  readonly arama = signal('');
  readonly gorunenKategoriler = computed(() => {
    const term = this.arama().trim().toLocaleLowerCase();
    return this.kategoriler().filter((k) => k.ad.toLocaleLowerCase().includes(term));
  });
  readonly kalemler = signal<FinansGiderKalemi[]>([]);
  readonly seciliKategoriId = signal<number | null>(null);
  readonly seciliKategori = computed(() =>
    this.kategoriler().find((k) => k.id === this.seciliKategoriId()),
  );
  readonly yonetebilir = computed(
    () =>
      this.permissions.hasAccess(FINANS_YETKI.Modul) &&
      this.permissions.canWrite(FINANS_YETKI.GiderKutuphanesiYonet),
  );
  readonly varsayilanlariGorebilir = computed(() =>
    [
      FINANS_YETKI.ParasalVeriGoruntule,
      FINANS_YETKI.BirimFiyatGoruntule,
      FINANS_YETKI.TutarGoruntule,
      FINANS_YETKI.GiderGoruntule,
    ].every((k) => this.permissions.hasAccess(k)),
  );
  readonly kalemSaving = signal(false);
  readonly kalemLoading = signal(false);
  readonly kalemHatasi = signal('');
  readonly kalemVarsayilanlariTam = signal(false);
  kalemId?: number;
  kalemForm: Omit<FinansGiderKalemi, 'id'> = { kategoriId: 0, kod: '', ad: '', aktif: true };
  readonly saving = signal(false);
  readonly hata = signal('');
  id?: number;
  ad = '';
  aktif = true;
  ngOnInit(): void {
    this.yukle();
  }
  yukle(): void {
    this.loading.set(true);
    this.hata.set('');
    this.service
      .giderKutuphaneKategorileri()
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (r) => {
          if (r.isSuccess) this.kategoriler.set(r.value ?? []);
          else this.hata.set(r.error ?? 'Kategoriler alınamadı.');
        },
        error: () => this.hata.set('Kategoriler alınamadı.'),
      });
  }
  yeni(): void {
    if (this.saving()) return;
    this.id = undefined;
    this.ad = '';
    this.aktif = true;
  }
  duzenle(k: FinansGiderKategori): void {
    if (!this.yonetebilir() || this.saving()) return;
    this.id = k.id;
    this.ad = k.ad;
    this.aktif = k.aktif;
  }
  kaydet(): void {
    if (!this.yonetebilir() || this.saving() || !this.ad.trim()) return;
    this.saving.set(true);
    this.hata.set('');
    this.service
      .giderKategoriKaydet({ ad: this.ad.trim(), aktif: this.aktif }, this.id)
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (r) => {
          if (!r.isSuccess) this.hata.set(r.error ?? 'Kategori kaydedilemedi.');
          else if (r.statusCode === 202) this.toast.info('Kategori değişikliği onaya gönderildi.');
          else {
            this.toast.success('Kategori kaydedildi.');
            this.id = undefined;
            this.ad = '';
            this.aktif = true;
            this.yukle();
            this.degisti.emit();
          }
        },
        error: () => this.hata.set('Kategori kaydedilemedi.'),
      });
  }
  kategoriSec(id: number): void {
    if (this.kalemSaving()) return;
    this.seciliKategoriId.set(id);
    this.yeniKalem();
    this.kalemleriYukle();
  }
  yeniKalem(): void {
    if (this.kalemSaving()) return;
    this.kalemId = undefined;
    this.kalemForm = { kategoriId: this.seciliKategoriId() ?? 0, kod: '', ad: '', aktif: true };
    this.kalemHatasi.set('');
  }
  kalemDuzenle(kalem: FinansGiderKalemi): void {
    if (
      !this.yonetebilir() ||
      !this.varsayilanlariGorebilir() ||
      !this.kalemVarsayilanlariTam() ||
      !this.seciliKategori()?.aktif ||
      this.kalemSaving()
    )
      return;
    const { id, ...form } = kalem;
    this.kalemId = id;
    this.kalemForm = { ...form };
    this.kalemHatasi.set('');
  }
  kalemKaydet(): void {
    if (
      !this.yonetebilir() ||
      this.kalemSaving() ||
      !this.seciliKategori()?.aktif ||
      (this.kalemId && !this.varsayilanlariGorebilir())
    )
      return;
    const form = this.kalemForm;
    if (!form.ad.trim() || !form.kod.trim() || form.kategoriId !== this.seciliKategoriId()) return;
    this.kalemSaving.set(true);
    this.kalemHatasi.set('');
    this.service
      .giderKalemiKaydet({ ...form, kod: form.kod.trim(), ad: form.ad.trim() }, this.kalemId)
      .pipe(
        finalize(() => this.kalemSaving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (r) => {
          if (!r.isSuccess) this.kalemHatasi.set(r.error ?? 'Kalem kaydedilemedi.');
          else if (r.statusCode === 202) this.toast.info('Kalem değişikliği onaya gönderildi.');
          else {
            this.toast.success('Kalem kaydedildi.');
            this.kalemId = undefined;
            this.kalemForm = { kategoriId: form.kategoriId, kod: '', ad: '', aktif: true };
            this.kalemleriYukle();
            this.degisti.emit();
          }
        },
        error: () => this.kalemHatasi.set('Kalem kaydedilemedi.'),
      });
  }
  private kalemleriYukle(): void {
    const id = this.seciliKategoriId();
    if (!id) return;
    const version = ++this.listeSurumu;
    const defaultsVisible = this.varsayilanlariGorebilir();
    this.kalemVarsayilanlariTam.set(false);
    this.kalemLoading.set(true);
    this.kalemler.set([]);
    this.service
      .giderKutuphaneKalemleri(id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          if (version === this.listeSurumu) this.kalemLoading.set(false);
        }),
      )
      .subscribe({
        next: (r) => {
          if (version !== this.listeSurumu) return;
          if (r.isSuccess) {
            this.kalemler.set(r.value ?? []);
            this.kalemVarsayilanlariTam.set(defaultsVisible && this.varsayilanlariGorebilir());
          } else this.kalemHatasi.set(r.error ?? 'Kalemler alınamadı.');
        },
        error: () => {
          if (version === this.listeSurumu) this.kalemHatasi.set('Kalemler alınamadı.');
        },
      });
  }
}
