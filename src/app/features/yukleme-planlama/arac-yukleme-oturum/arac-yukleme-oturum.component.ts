import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subject, filter, switchMap, takeUntil, timer } from 'rxjs';
import { BreadcrumbComponent } from '../../../shared/components/breadcrumb/breadcrumb.component';
import { ConfirmService, duzMetin } from '../../../core/services/confirm.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ToastService } from '../../../core/services/toast.service';
import { AracYuklemeService } from '../../../core/services/arac-yukleme.service';
import { YETKI } from '../../../core/constants/yetki-kodlari';
import {
  ApiResult,
  AracYuklemeAracOzeti,
  AracYuklemeDurumu,
  YerlesimKontrolSonucu,
  YuklemeOturumDurumu,
} from '../../../shared/models/index';
import { KONTROL_SONUCU, OTURUM_DURUMU, yuklemeYuzdesi } from '../ortak/yukleme-etiketleri';

/** Süren oturumda ilerlemenin yenilenme aralığı (başka tabletlerin okutmaları görünsün). */
export const DURUM_YENILEME_MS = 15000;

/**
 * Planın araç yükleme oturumu: başlatma, araç başına ilerleme, tamamlama ve iptal. Oturum, başladığı plan revizyonunun
 * yerleşimine sabittir; plan sonradan revize edilirse uyarı gösterilir ve yükleme aynı yerleşimle sürer. Tamamlama ve
 * iptal sandık durumunu ya da sevki değiştirmez.
 */
@Component({
  selector: 'app-arac-yukleme-oturum',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DecimalPipe, BreadcrumbComponent],
  templateUrl: './arac-yukleme-oturum.component.html',
  styleUrls: ['../ortak/yukleme.scss', '../ortak/arac-yukleme.scss', './arac-yukleme-oturum.component.scss'],
})
export class AracYuklemeOturumComponent implements OnInit {
  private readonly api = inject(AracYuklemeService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly permissions = inject(PermissionService);
  readonly izin = YETKI.YUKLEME_PLANLAMA;

  readonly planId = Number(inject(ActivatedRoute).snapshot.paramMap.get('planId'));
  readonly Durum = YuklemeOturumDurumu;
  readonly OTURUM_DURUMU = OTURUM_DURUMU;
  readonly KONTROL_SONUCU = KONTROL_SONUCU;
  readonly yuzde = yuklemeYuzdesi;

  readonly durum = signal<AracYuklemeDurumu | null>(null);
  readonly yukleniyor = signal(true);
  readonly islemde = signal(false);
  /** İşlem başlarken uçuştaki yenileme iptal edilir: eski yanıt işlemin sonucunu ezmesin. */
  private readonly islemBasladi = new Subject<void>();

  readonly yazabilir = computed(() => this.permissions.canWrite(this.izin.ARAC_YUKLEME));
  readonly oturumAcik = computed(() => this.durum()?.oturum?.durum === YuklemeOturumDurumu.Acik);
  /** Oturum yokken ya da sürerken durum değişebilir; kapanmış oturum değişmez. */
  private readonly yenilenir = computed(() => {
    const d = this.durum();
    return d !== null && (d.oturum === null || d.oturum.durum === YuklemeOturumDurumu.Acik);
  });
  readonly eksikYuk = computed(() => {
    const o = this.durum()?.oturum;
    return o ? Math.max(0, o.toplamYuk - o.yuklenenYuk) : 0;
  });
  readonly breadcrumb = computed(() => [
    { label: 'Ana Kontrol Paneli', link: '/dashboard' },
    { label: 'Araç Yükleme', link: '/arac-yukleme' },
    { label: this.durum()?.planNo ?? '…' },
  ]);

  ngOnInit(): void {
    this.yukle();
    // Durum kendiliğinden yenilenir (başkasının başlattığı oturum ve öbür tabletlerin okutmaları görünsün); kapanmış
    // oturum değişmez, yenilenmez. İşlem sürerken istek atılmaz.
    timer(DURUM_YENILEME_MS, DURUM_YENILEME_MS)
      .pipe(
        filter(() => this.yenilenir() && !this.islemde()),
        switchMap(() => this.api.durum(this.planId).pipe(takeUntil(this.islemBasladi))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((r) => {
        if (r.isSuccess && r.value && !this.islemde()) this.durum.set(r.value);
      });
  }

  /** İlk yükleme ve "Yeniden dene". */
  yukle(): void {
    this.yukleniyor.set(true);
    this.api.durum(this.planId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe((r) => {
      this.yukleniyor.set(false);
      if (r.isSuccess && r.value) this.durum.set(r.value);
      else this.toast.error(r.error ?? 'Yükleme durumu alınamadı.');
    });
  }

  async baslat(): Promise<void> {
    const d = this.durum();
    if (!d?.baslatilabilir || !this.yazabilir() || this.islemde()) return;
    const uygunsuz = d.yerlesimSonucu === YerlesimKontrolSonucu.Uygunsuz;
    const onay = await this.confirm.ask({
      title: 'Yüklemeyi başlat',
      message:
        `${duzMetin(d.planNo)} planının Revizyon ${d.sonRevizyonNo} yerleşimiyle yükleme başlatılsın mı? ` +
        'Yükleme bu yerleşimle sürer; plan sonradan değişse de oturum aynı kalır.' +
        (uygunsuz ? '<br><br><strong>Dikkat:</strong> bu yerleşimin sonucu "Uygunsuz"; yükleme sırası uygulanamayabilir.' : ''),
      confirmText: 'Başlat',
      type: uygunsuz ? 'warning' : 'info',
    });
    if (onay) this.calistir(this.api.baslat(this.planId, d.sonRevizyonNo), 'Yükleme başlatıldı.', 'Yükleme başlatılamadı.');
  }

  async tamamla(): Promise<void> {
    const o = this.durum()?.oturum;
    if (!o || !this.oturumAcik() || !this.yazabilir() || this.islemde()) return;
    const eksik = this.eksikYuk();
    let gerekce: string | null = null;
    if (eksik > 0) {
      // Eksik yükle tamamlama gerekçe ister (sunucu da denetler).
      gerekce = await this.confirm.askWithReason({
        title: 'Yüklemeyi tamamla',
        message: `<strong>${eksik} yük yüklenmedi.</strong> Oturum yine de tamamlansın mı? Tamamlanan oturum yeniden açılmaz.`,
        confirmText: 'Tamamla',
        type: 'warning',
        reason: { label: 'Gerekçe', hint: 'Eksik yükün nedeni (en az 5 karakter)' },
      });
      if (gerekce === null) return;
    } else {
      const onay = await this.confirm.ask({
        title: 'Yüklemeyi tamamla',
        message: 'Bütün yükler yüklendi. Oturum tamamlansın mı? Tamamlanan oturum yeniden açılmaz.',
        confirmText: 'Tamamla',
        type: 'success',
      });
      if (!onay) return;
    }
    this.calistir(this.api.tamamla(o.id, gerekce), 'Yükleme tamamlandı.', 'Yükleme tamamlanamadı.');
  }

  async iptal(): Promise<void> {
    const o = this.durum()?.oturum;
    if (!o || !this.oturumAcik() || !this.yazabilir() || this.islemde()) return;
    const gerekce = await this.confirm.askWithReason({
      title: 'Yüklemeyi iptal et',
      message: 'Yükleme oturumu iptal edilsin mi? Yapılan işaretler kayıtta kalır; iptal edilen oturum yeniden açılmaz.',
      confirmText: 'İptal et',
      cancelText: 'Vazgeç',
      type: 'danger',
      reason: { label: 'Gerekçe', hint: 'İptal nedeni (en az 5 karakter)' },
    });
    if (gerekce !== null) this.calistir(this.api.iptal(o.id, gerekce), 'Yükleme iptal edildi.', 'Yükleme iptal edilemedi.');
  }

  /** Araç ekranı oturum varken açılır (kapanmış oturumda salt okunur). */
  aracAc(a: AracYuklemeAracOzeti): void {
    const o = this.durum()?.oturum;
    if (o) this.router.navigate(['/arac-yukleme/oturum', o.id, 'arac', a.aracNo]);
  }

  private calistir(istek: Observable<ApiResult<AracYuklemeDurumu>>, basari: string, hata: string): void {
    this.islemde.set(true);
    this.islemBasladi.next();
    istek.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((r) => {
      if (r.isSuccess && r.value) {
        this.islemde.set(false);
        this.durum.set(r.value);
        this.toast.success(basari);
        return;
      }
      this.toast.error(r.error ?? hata);
      // Ret çoğunlukla bayat ekrandandır (başkası başlattı/kapattı, plan revize edildi): durum yeniden okunur.
      this.api.durum(this.planId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe((yeni) => {
        this.islemde.set(false);
        if (yeni.isSuccess && yeni.value) this.durum.set(yeni.value);
      });
    });
  }
}
