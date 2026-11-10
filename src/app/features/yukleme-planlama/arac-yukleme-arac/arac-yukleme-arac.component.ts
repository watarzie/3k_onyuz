import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, filter, firstValueFrom, switchMap, takeUntil, timer } from 'rxjs';
import { BreadcrumbComponent } from '../../../shared/components/breadcrumb/breadcrumb.component';
import { ConfirmService, duzMetin } from '../../../core/services/confirm.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ToastService } from '../../../core/services/toast.service';
import { AracYuklemeService } from '../../../core/services/arac-yukleme.service';
import { YETKI } from '../../../core/constants/yetki-kodlari';
import {
  AracYuklemeAraci,
  EkipmanTeknikVerisi,
  PlanYukKonumu,
  YukCozumSonucu,
  YukIsareti,
  YuklemeIsaretKaynagi,
  YuklemeOturumDurumu,
} from '../../../shared/models/index';
import { Ekipman3dComponent, Yuk3d } from '../ekipman-kitapligi/ekipman-3d.component';
import { OTURUM_DURUMU, PROJE_RENKLERI, girisYonuMetni, mm, yuklemeYuzdesi } from '../ortak/yukleme-etiketleri';
import { YuklemeAdimi, yuklemeAdimlari } from '../ortak/yukleme-adimlari';

/** Süren oturumda aracın yenilenme aralığı (başka tabletlerin okutmaları görünsün). */
export const ARAC_YENILEME_MS = 15000;

/** Ekranda tutulan son okutma sonucu sayısı. */
const BILDIRIM_SAYISI = 4;
/** Okutma kutusunun kabul ettiği en uzun metin (sunucudaki sınırla aynı). */
const BARKOD_EN_FAZLA = 64;
/** Kutunun dışında yakalanan tuşlar bu süreden uzun aralıklıysa yeni okutma sayılır (okuyucu haneleri art arda yazar). */
const OKUYUCU_TUS_ARALIGI_MS = 1000;

/** Adım listesinin satırı: yük, adımı ve varsa yükleme işareti. */
export interface AdimSatiri {
  no: number;
  adimNo: number;
  konum: PlanYukKonumu;
  isaret: YukIsareti | null;
}

type BildirimTonu = 'success' | 'info' | 'warning' | 'danger';

/** Bir okutmanın ya da işlemin sonucu. */
export interface Bildirim {
  id: number;
  ton: BildirimTonu;
  metin: string;
  saat: Date;
}

/**
 * Araç yükleme ekranı (tablet): sıradaki yük ve konumu, sandık barkodu okutma, ilerleme ve adım listesi. Barkod el
 * okuyucusuyla okutulur (okuyucu klavye gibi yazar ve Enter gönderir); barkodu olmayan yük listeden elle işaretlenir.
 * Okutulan barkodu sunucu çözer ve yönlendirir: başka aracın yükü, plan dışı sandık ve zaten yüklenmiş yük işaretlenmez,
 * sıra dışı yük onay ister. İşaret planlama kaydıdır; sandık durumunu ve sevki değiştirmez.
 *
 * Okutmalar sıraya girer ve tek tek işlenir: bir okutma (ya da onay penceresi) sürerken okutulan barkod kaybolmaz.
 * Odak kutuda değilken de okuyucunun yazdıkları yakalanır.
 */
@Component({
  selector: 'app-arac-yukleme-arac',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DecimalPipe, FormsModule, BreadcrumbComponent, Ekipman3dComponent],
  templateUrl: './arac-yukleme-arac.component.html',
  styleUrls: ['../ortak/yukleme.scss', '../ortak/arac-yukleme.scss', './arac-yukleme-arac.component.scss'],
  host: { '(document:keydown)': 'tusBasildi($event)' },
})
export class AracYuklemeAracComponent implements OnInit {
  private readonly api = inject(AracYuklemeService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly rota = inject(ActivatedRoute);
  readonly permissions = inject(PermissionService);
  readonly izin = YETKI.YUKLEME_PLANLAMA;

  readonly oturumId = Number(this.rota.snapshot.paramMap.get('oturumId'));
  readonly aracNo = Number(this.rota.snapshot.paramMap.get('aracNo'));
  readonly OTURUM_DURUMU = OTURUM_DURUMU;
  readonly Kaynak = YuklemeIsaretKaynagi;
  readonly girisYonu = girisYonuMetni;
  readonly mm = mm;
  readonly yuzde = yuklemeYuzdesi;

  readonly arac = signal<AracYuklemeAraci | null>(null);
  readonly yukleniyor = signal(true);
  /** Bir okutma, elle işaret ya da geri alma sürüyor (onay penceresi açıkken de). */
  readonly islemde = signal(false);
  readonly barkod = signal('');
  /** Son okutmaların sonucu, en yenisi başta. */
  readonly bildirimler = signal<Bildirim[]>([]);
  /** En son sonuç (ton ve metin). */
  readonly bildirim = computed(() => {
    const son = this.bildirimler()[0];
    return son ? { ton: son.ton, metin: son.metin } : null;
  });
  /** İşlenmeyi bekleyen okutma sayısı. */
  readonly bekleyenOkutma = signal(0);
  private readonly girdi = viewChild<ElementRef<HTMLInputElement>>('girdi');

  private readonly kuyruk: string[] = [];
  private bosaltma: Promise<void> | null = null;
  private bildirimNo = 0;
  private sonDisTus = 0;
  private yokEdildi = false;
  /** İşlem başlarken uçuştaki yenileme iptal edilir: eski yanıt işlemin sonucunu ezmesin. */
  private readonly islemBasladi = new Subject<void>();

  readonly oturumAcik = computed(() => this.arac()?.oturum.durum === YuklemeOturumDurumu.Acik);
  /** İşaretleme ve geri alma: işlem izni ve açık oturum (sunucu da aynısını ister). */
  readonly yazabilir = computed(() => this.oturumAcik() && this.permissions.canWrite(this.izin.ARAC_YUKLEME));
  readonly adimlar = computed<YuklemeAdimi[]>(() => yuklemeAdimlari(this.arac()?.arac.konumlar ?? []));
  readonly isaretler = computed(() => new Map((this.arac()?.isaretler ?? []).map((i) => [i.yukAnahtari, i])));
  readonly satirlar = computed<AdimSatiri[]>(() =>
    this.adimlar().flatMap((a) =>
      a.yukler.map((y) => ({ no: y.no, adimNo: a.adimNo, konum: y.konum, isaret: this.isaretler().get(y.konum.yukAnahtari) ?? null }))));
  readonly toplamYuk = computed(() => this.satirlar().length);
  readonly yuklenenYuk = computed(() => this.arac()?.isaretler.length ?? 0);
  /** Sıradaki adım (yüklenmemiş yükü olan ilk adım); araç tamamlandıysa null. */
  readonly siradaki = computed<YuklemeAdimi | null>(() => this.adimlar().find((a) => a.adimNo === this.arac()?.siradakiAdimNo) ?? null);

  /** Geometri metni değişmedikçe 3B sahne yeniden kurulmaz (metin eşitliği sinyali sabit tutar). */
  private readonly teknikVeriJson = computed(() => this.arac()?.arac.teknikVeriJson ?? null);
  readonly teknikVeri = computed<EkipmanTeknikVerisi | null>(() => {
    const json = this.teknikVeriJson();
    if (!json) return null;
    try {
      return JSON.parse(json) as EkipmanTeknikVerisi;
    } catch {
      return null;
    }
  });

  readonly yukler3d = computed<Yuk3d[]>(() => {
    const a = this.arac()?.arac;
    if (!a) return [];
    const renk = (projeNo: string | null) => PROJE_RENKLERI[Math.max(0, a.projeNolari.indexOf(projeNo ?? '')) % PROJE_RENKLERI.length];
    return a.konumlar.map((k) => ({
      anahtar: k.yukAnahtari, kod: k.kod, xMm: k.xMm, yMm: k.yMm, zMm: k.zMm, boyMm: k.boyMm, enMm: k.enMm, yukseklikMm: k.yukseklikMm,
      renk: renk(k.projeNo), sorunlu: false,
    }));
  });
  /** 3B'de yüklenmiş yükler ve sıradaki adımın yükleri görünür; sıradaki adımın yüklenmemişleri parlak çizilir. */
  readonly gorunenler = computed(() =>
    new Set([...this.isaretler().keys(), ...(this.siradaki()?.yukler.map((y) => y.konum.yukAnahtari) ?? [])]));
  readonly vurgulular = computed(() =>
    new Set((this.siradaki()?.yukler ?? []).map((y) => y.konum.yukAnahtari).filter((anahtar) => !this.isaretler().has(anahtar))));

  readonly breadcrumb = computed(() => {
    const a = this.arac();
    return [
      { label: 'Ana Kontrol Paneli', link: '/dashboard' },
      { label: 'Araç Yükleme', link: '/arac-yukleme' },
      ...(a ? [{ label: a.planNo, link: `/arac-yukleme/${a.planId}` }] : []),
      { label: `Araç ${this.aracNo}` },
    ];
  });

  ngOnInit(): void {
    // Sayfadan çıkılınca bekleyen okutmalar ve açık onayın devamı işlenmez.
    this.destroyRef.onDestroy(() => {
      this.yokEdildi = true;
      this.kuyruk.length = 0;
    });
    this.yukle();
    // Başka tabletlerin okutmaları görünsün; işlem sürerken ve kapalı oturumda istek atılmaz.
    timer(ARAC_YENILEME_MS, ARAC_YENILEME_MS)
      .pipe(
        filter(() => this.oturumAcik() && !this.islemde()),
        switchMap(() => this.api.arac(this.oturumId, this.aracNo).pipe(takeUntil(this.islemBasladi))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((r) => {
        if (r.isSuccess && r.value && !this.islemde()) this.araciGuncelle(r.value);
      });
  }

  /** İlk yükleme ve "Yeniden dene". */
  yukle(): void {
    this.yukleniyor.set(true);
    this.api.arac(this.oturumId, this.aracNo).pipe(takeUntilDestroyed(this.destroyRef)).subscribe((r) => {
      this.yukleniyor.set(false);
      if (r.isSuccess && r.value) {
        this.arac.set(r.value);
        this.odakla();
      } else {
        this.toast.error(r.error ?? 'Araç yükleme bilgisi alınamadı.');
      }
    });
  }

  /**
   * Odak okutma kutusunda değilken (3B görünüme ya da bir düğmeye dokunulmuşken) okuyucunun yazdıklarını yakalar:
   * haneler kutuya eklenir, Enter okutmayı gönderir. Yazı alanlarındaki tuşlara (gerekçe kutusu dahil) dokunulmaz.
   */
  tusBasildi(olay: KeyboardEvent): void {
    if (!this.yazabilir() || olay.ctrlKey || olay.metaKey || olay.altKey) return;
    const hedef = olay.target instanceof Element ? olay.target : null;
    if (hedef?.closest('input, textarea, select, [contenteditable="true"]')) return;
    if (olay.key === 'Enter') {
      // Kutu boşken Enter odaktaki düğmenin işidir; doluyken okuyucunun gönderimidir (düğmeyi yeniden tıklamasın).
      if (!this.barkod().trim()) return;
      olay.preventDefault();
      void this.okut();
    } else if (olay.key.length === 1 && olay.key !== ' ') {
      const simdi = Date.now();
      const onceki = simdi - this.sonDisTus > OKUYUCU_TUS_ARALIGI_MS ? '' : this.barkod();
      this.sonDisTus = simdi;
      this.barkod.set((onceki + olay.key).slice(0, BARKOD_EN_FAZLA));
    }
  }

  /**
   * Kutudaki barkodu sıraya alır ve sırayı işletir. İşlem sürerken okutulan barkod beklemeye girer; dönen söz,
   * sıradaki bütün okutmalar işlenince tamamlanır.
   */
  okut(): Promise<void> {
    const metin = this.barkod().trim();
    this.barkod.set('');
    if (!metin || !this.yazabilir()) return Promise.resolve();
    this.kuyruk.push(metin);
    this.bekleyenOkutma.set(this.kuyruk.length);
    return this.kuyruguIslet();
  }

  /** Barkodu olmayan (ya da okunamayan) yükü listeden işaretler; sıradaki değilse ayrıca onay ister. */
  async elleIsaretle(s: AdimSatiri): Promise<void> {
    if (!this.yazabilir() || this.islemde() || s.isaret) return;
    await this.kilitli(async () => {
      const siradaki = this.arac()?.siradakiAdimNo ?? null;
      const siraDisi = siradaki !== null && s.adimNo > siradaki;
      const onay = await this.confirm.ask({
        title: siraDisi ? 'Sıra dışı yükleme' : 'Elle işaretle',
        message:
          `<strong>${duzMetin(s.konum.kod)}</strong> barkod okutulmadan yüklendi işaretlensin mi?` +
          (siraDisi ? `<br><br>Sıradaki adım ${siradaki}; bu yük ${s.adimNo}. adımda (sıra dışı).` : ''),
        confirmText: 'Yüklendi işaretle',
        cancelText: 'Vazgeç',
        type: siraDisi ? 'warning' : 'info',
      });
      if (onay && !this.yokEdildi) await this.isaretle(s.konum.yukAnahtari, s.konum.kod, YuklemeIsaretKaynagi.Elle, siraDisi, null);
    });
  }

  async geriAl(s: AdimSatiri): Promise<void> {
    const isaret = s.isaret;
    if (!this.yazabilir() || this.islemde() || !isaret) return;
    await this.kilitli(async () => {
      const gerekce = await this.confirm.askWithReason({
        title: 'Yükleme işaretini geri al',
        message: `<strong>${duzMetin(s.konum.kod)}</strong> yüklenmedi olarak işaretlensin mi? İşaret kayıtta kalır.`,
        confirmText: 'Geri al',
        cancelText: 'Vazgeç',
        type: 'danger',
        reason: { label: 'Gerekçe', hint: 'Geri alma nedeni (en az 5 karakter)' },
      });
      if (gerekce === null || this.yokEdildi) return;
      const r = await firstValueFrom(this.api.geriAl(this.oturumId, isaret.id, gerekce));
      if (r.isSuccess && r.value) {
        this.arac.set(r.value);
        this.bildir('info', `${s.konum.kod} işareti geri alındı.`);
      } else {
        this.bildir('danger', r.error ?? 'İşaret geri alınamadı.');
        await this.yenidenOku();
      }
    });
  }

  araclaraDon(): void {
    const a = this.arac();
    this.router.navigate(a ? ['/arac-yukleme', a.planId] : ['/arac-yukleme']);
  }

  /** Sıradaki okutmaları tek tek işler; aynı anda tek bir işletme çalışır. */
  private kuyruguIslet(): Promise<void> {
    if (this.bosaltma) return this.bosaltma;
    // Elle işaret ya da geri alma sürüyorsa okutma onun bitiminde işlenir.
    if (this.islemde() || !this.kuyruk.length) return Promise.resolve();
    this.kilitle();
    this.bosaltma = (async () => {
      try {
        while (this.kuyruk.length && !this.yokEdildi) {
          const metin = this.kuyruk.shift()!;
          this.bekleyenOkutma.set(this.kuyruk.length);
          await this.okutmayiIsle(metin);
        }
      } finally {
        this.bosaltma = null;
        this.kilidiAc();
      }
    })();
    return this.bosaltma;
  }

  /** Okutulan barkodu sunucuya çözdürür ve sonuca göre işaretler ya da operatörü yönlendirir. */
  private async okutmayiIsle(metin: string): Promise<void> {
    const r = await firstValueFrom(this.api.cozumle(this.oturumId, metin, this.aracNo));
    const c = r.value;
    if (!r.isSuccess || !c) {
      this.bildir('danger', r.error ?? 'Barkod çözülemedi.');
      // Ret çoğunlukla bayat ekrandandır (oturum kapandı): araç yeniden okunur.
      await this.yenidenOku();
      return;
    }
    if (c.sonuc === YukCozumSonucu.Yuklenebilir && c.yukAnahtari) {
      await this.isaretle(c.yukAnahtari, c.kod ?? c.yukAnahtari, YuklemeIsaretKaynagi.Barkod, false, metin);
    } else if (c.sonuc === YukCozumSonucu.SiraDisi && c.yukAnahtari) {
      const onay = await this.confirm.ask({
        title: 'Sıra dışı yükleme',
        message: `${duzMetin(c.mesaj)}<br><br>Yine de yüklendi işaretlensin mi?`,
        confirmText: 'Yüklendi işaretle',
        cancelText: 'Vazgeç',
        type: 'warning',
      });
      if (this.yokEdildi) return;
      if (onay) await this.isaretle(c.yukAnahtari, c.kod ?? c.yukAnahtari, YuklemeIsaretKaynagi.Barkod, true, metin);
      else this.bildir('warning', `${c.kod ?? 'Yük'} işaretlenmedi (sıra dışı).`);
    } else {
      this.bildir(c.sonuc === YukCozumSonucu.ZatenYuklendi ? 'info' : 'danger', c.mesaj);
    }
  }

  private async isaretle(yukAnahtari: string, kod: string, kaynak: YuklemeIsaretKaynagi, siraDisiOnayi: boolean, barkod: string | null): Promise<void> {
    const r = await firstValueFrom(this.api.isaretle(this.oturumId, { aracNo: this.aracNo, yukAnahtari, kaynak, siraDisiOnayi, barkod }));
    if (r.isSuccess && r.value) {
      this.arac.set(r.value.arac);
      this.bildir(r.value.zatenYuklendi ? 'info' : 'success', r.value.zatenYuklendi ? `${kod} zaten yüklenmiş; yeni kayıt yazılmadı.` : `${kod} yüklendi.`);
    } else {
      this.bildir('danger', r.error ?? 'Yük işaretlenemedi.');
      // Başka tablet sırayı değiştirmiş ya da oturum kapanmış olabilir: sıradaki adım yeniden okunur.
      await this.yenidenOku();
    }
  }

  /** Reddedilen işlemden sonra aracı sunucudan yeniden okur (okunamazsa ekran olduğu gibi kalır). */
  private async yenidenOku(): Promise<void> {
    if (this.yokEdildi) return;
    const r = await firstValueFrom(this.api.arac(this.oturumId, this.aracNo));
    if (r.isSuccess && r.value && !this.yokEdildi) this.arac.set(r.value);
  }

  /** Aralıklı yenileme: bir şey değişmediyse araç yerinde kalır (3B sahne ve liste yeniden kurulmaz). */
  private araciGuncelle(yeni: AracYuklemeAraci): void {
    const imza = (a: AracYuklemeAraci | null) =>
      a ? `${a.oturum.durum}|${a.oturum.planDegisti}|${a.siradakiAdimNo}|${a.isaretler.map((i) => i.id).join(',')}` : '';
    if (imza(yeni) !== imza(this.arac())) this.arac.set(yeni);
  }

  /** Onay isteyen işlemi (elle işaret, geri alma) kilit altında yürütür; bu sırada gelen okutmalar bitiminde işlenir. */
  private async kilitli(islem: () => Promise<void>): Promise<void> {
    this.kilitle();
    try {
      await islem();
    } finally {
      this.kilidiAc();
    }
    await this.kuyruguIslet();
  }

  private kilitle(): void {
    this.islemde.set(true);
    this.islemBasladi.next();
  }

  private kilidiAc(): void {
    this.islemde.set(false);
    this.odakla();
  }

  private bildir(ton: BildirimTonu, metin: string): void {
    this.bildirimler.update((eski) => [{ id: ++this.bildirimNo, ton, metin, saat: new Date() }, ...eski].slice(0, BILDIRIM_SAYISI));
  }

  /** Okuyucu doğrudan yazabilsin diye okutma kutusu her işlemden sonra yeniden odaklanır. */
  private odakla(): void {
    setTimeout(() => {
      if (!this.yokEdildi) this.girdi()?.nativeElement.focus();
    });
  }
}
