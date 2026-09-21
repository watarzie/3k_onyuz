import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { TranslationService } from '../../core/services/translation.service';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { FinansService } from '../../core/services/finans.service';
import { ToastService } from '../../core/services/toast.service';
import { PermissionService } from '../../core/services/permission.service';
import { FINANS_YETKI } from '../../core/constants/yetki-kodlari';
import { FinansSablon, FinansSablonKaydet } from '../../shared/models/finans-v2.model';

@Component({
  selector: 'app-finans-sablonlar',
  standalone: true,
  imports: [FormsModule],
  styleUrl: './finans-v2.scss',
  templateUrl: './finans-sablonlar.component.html',
})
export class FinansSablonlarComponent implements OnInit {
  private readonly translation = inject(TranslationService);
  t(key: string): string {
    return this.translation.translate(`FINANS_V2.${key}`);
  }
  private readonly service = inject(FinansService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);
  readonly permissions = inject(PermissionService);
  readonly izin = FINANS_YETKI;
  readonly sablonlar = signal<FinansSablon[]>([]);
  readonly loading = signal(false);
  readonly arama = signal('');
  readonly gorunenSablonlar = computed(() => {
    const term = this.arama().trim().toLocaleLowerCase();
    return this.sablonlar().filter((s) => `${s.kod} ${s.ad}`.toLocaleLowerCase().includes(term));
  });
  readonly acik = signal(false);
  readonly saving = signal(false);
  readonly hata = signal('');
  id?: number;
  form: FinansSablonKaydet = { kod: '', ad: '', aktif: true, alanlar: [] };
  ngOnInit(): void {
    this.yukle();
  }
  yukle(): void {
    this.loading.set(true);
    this.hata.set('');
    this.service
      .sablonlar()
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((r) => {
        if (r.isSuccess) this.sablonlar.set(r.value ?? []);
        else this.hata.set(r.error ?? 'Şablonlar yüklenemedi.');
      });
  }
  yeni(): void {
    if (!this.permissions.canWrite(this.izin.SablonYonet) || this.saving()) return;
    this.id = undefined;
    this.form = { kod: '', ad: '', aktif: true, alanlar: [] };
    this.acik.set(true);
  }
  duzenle(s: FinansSablon): void {
    if (!this.permissions.canWrite(this.izin.SablonYonet) || this.saving()) return;
    this.id = s.id;
    this.form = { kod: s.kod, ad: s.ad, aktif: s.aktif, alanlar: s.alanlar.map((a) => ({ ...a })) };
    this.acik.set(true);
  }
  alanEkle(): void {
    this.form.alanlar.push({ kod: '', ad: '', veriTuru: 'metin', zorunlu: false });
  }
  alanSil(i: number): void {
    this.form.alanlar.splice(i, 1);
  }
  kaydet(): void {
    if (!this.permissions.canWrite(this.izin.SablonYonet) || this.saving()) return;
    this.hata.set('');
    if (
      !this.form.kod.trim() ||
      !this.form.ad.trim() ||
      this.form.alanlar.some((a) => !a.kod.trim() || !a.ad.trim())
    ) {
      this.hata.set('Kod, ad ve alan başlıklarını tamamlayın.');
      return;
    }
    this.saving.set(true);
    this.service
      .sablonKaydet(this.form, this.id)
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((r) => {
        if (!r.isSuccess) {
          this.hata.set(r.error ?? 'Şablon kaydedilemedi.');
          return;
        }
        if (r.statusCode === 202) {
          this.toast.info('Şablon onaya gönderildi.');
          return;
        }
        this.toast.success('Şablon sürümü kaydedildi.');
        this.acik.set(false);
        this.yukle();
      });
  }
}
