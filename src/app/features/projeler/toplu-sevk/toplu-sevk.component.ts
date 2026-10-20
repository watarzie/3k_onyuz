import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, finalize, from, map, mergeMap, of } from 'rxjs';
import { SandikService } from '../../../core/services/sandik.service';
import { SevkiyatService } from '../../../core/services/sevkiyat.service';
import { PermissionService } from '../../../core/services/permission.service';
import { TranslationService } from '../../../core/services/translation.service';
import { projeTipiBaglami } from '../../../core/constants/proje-tipi';
import {
  ARAC_PLAKA_EN_FAZLA,
  ProjeDto,
  SandikDto,
  SEFER_ACIKLAMA_EN_FAZLA,
  SOFOR_EN_FAZLA,
  TOPLU_SEVK_EN_FAZLA_PROJE,
  TOPLU_SEVK_EN_FAZLA_SANDIK,
  TopluSevkSonucu,
  TopluSevkSorunu,
  aracPlakaBicimle,
  onayaAlindi,
  sandikSevkAdayiMi,
} from '../../../shared/models/index';

/** Seçilen projenin toplu sevk satırı: sevke hazır sandıkları ve neden dışarıda kaldığı. */
export interface TopluSevkProjeSatiri {
  proje: ProjeDto;
  /** Projenin gerçek tipinin sevk etme (W) izni; yoksa sefere eklenmez. */
  yetkili: boolean;
  yukleniyor: boolean;
  yuklemeHatasi: string | null;
  adaylar: SandikDto[];
  /** Sevke hazır olmayan (boş, hazırlanıyor, sevk edilmiş, sahaya aktarılmış) sandık sayısı. */
  digerSandikSayisi: number;
}

/** Başarılı toplu sevk: sunucu sonucu ve sefere giren projeler (liste, kalan seçimi bunlarla ayırır). */
export interface TopluSevkTamamlandi extends TopluSevkSonucu {
  sevkEdilenProjeIds: number[];
}

/**
 * Çok projeli toplu sevk (tır seferi): seçilen projelerin sevke hazır sandıkları tek seferde, hepsi ya da hiçbiri
 * sevk edilir. Sunucu bütün projeleri tekil sevkle aynı kurallarla doğrular; bir projede engel varsa hiçbir proje
 * sevk edilmez ve engeller proje/sandık bazında gösterilir.
 */
@Component({
  selector: 'app-toplu-sevk',
  standalone: true,
  templateUrl: './toplu-sevk.component.html',
  styleUrl: './toplu-sevk.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TopluSevkComponent implements OnInit {
  private readonly sandikService = inject(SandikService);
  private readonly sevkiyatService = inject(SevkiyatService);
  private readonly permissions = inject(PermissionService);
  private readonly ts = inject(TranslationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sandikNoCollator = new Intl.Collator('tr', { numeric: true, sensitivity: 'base' });

  readonly projeler = input.required<readonly ProjeDto[]>();
  readonly kapandi = output<void>();
  readonly sevkEdildi = output<TopluSevkTamamlandi>();

  protected readonly plakaEnFazla = ARAC_PLAKA_EN_FAZLA;
  protected readonly soforEnFazla = SOFOR_EN_FAZLA;
  protected readonly aciklamaEnFazla = SEFER_ACIKLAMA_EN_FAZLA;

  readonly satirlar = signal<TopluSevkProjeSatiri[]>([]);
  /** Proje → seçili sandık kimlikleri; varsayılan bütün sevke hazır sandıklar. */
  readonly secimler = signal<Record<number, number[]>>({});
  readonly acikProjeler = signal<ReadonlySet<number>>(new Set());

  readonly sevkTarihi = signal(this.simdi());
  readonly aracPlaka = signal('');
  readonly sofor = signal('');
  readonly dorsePlaka = signal('');
  readonly aciklama = signal('');

  readonly gonderiliyor = signal(false);
  readonly hata = signal('');
  readonly sorunlar = signal<TopluSevkSorunu[]>([]);
  private sonIstek: { parmakIzi: string; anahtar: string } | null = null;

  readonly yukleniyor = computed(() => this.satirlar().some(s => s.yukleniyor));
  /** Sefere girecek projeler: yetkili, sandıkları yüklenmiş ve en az bir sandığı seçili. */
  readonly dahilSatirlar = computed(() => {
    const secimler = this.secimler();
    return this.satirlar().filter(s => this.sevkEdilebilir(s) && (secimler[s.proje.id]?.length ?? 0) > 0);
  });
  readonly sevkEdilebilirSatirlar = computed(() => this.satirlar().filter(s => this.sevkEdilebilir(s)));
  /** Sefere eklenemeyen projeler ve nedenleri (yetki yok, sevke hazır sandık yok, yükleme hatası). */
  readonly disaridaKalanlar = computed(() => this.satirlar().filter(s => !s.yukleniyor && !this.sevkEdilebilir(s)));
  readonly toplamSandik = computed(() =>
    this.dahilSatirlar().reduce((toplam, s) => toplam + (this.secimler()[s.proje.id]?.length ?? 0), 0));
  readonly plakaOnizleme = computed(() => aracPlakaBicimle(this.aracPlaka()));
  readonly sorunluProjeler = computed(() => new Map(this.sorunlar().map(s => [s.projeId, s])));
  readonly sorunluSandiklar = computed(() => new Set(this.sorunlar().flatMap(s => s.sandikIds ?? [])));
  /** İstemci tarafı engel: gönderim düğmesi kapalıyken nedeni gösterilir. Sunucu aynı kuralları ayrıca uygular. */
  readonly engel = computed((): string | null => {
    if (this.yukleniyor()) return null;
    const projeSayisi = this.dahilSatirlar().length;
    if (projeSayisi === 0) return this.t('SHIPMENTS.BULK_NO_PROJECT');
    if (projeSayisi > TOPLU_SEVK_EN_FAZLA_PROJE) return this.t('SHIPMENTS.BULK_PROJECT_LIMIT', { n: TOPLU_SEVK_EN_FAZLA_PROJE });
    if (this.toplamSandik() > TOPLU_SEVK_EN_FAZLA_SANDIK) return this.t('SHIPMENTS.BULK_CRATE_LIMIT', { n: TOPLU_SEVK_EN_FAZLA_SANDIK });
    if (!this.plakaOnizleme()) return this.t('SHIPMENTS.BULK_PLATE_REQUIRED');
    if (!this.sevkTarihi().trim()) return this.t('SHIPMENTS.BULK_DATE_REQUIRED');
    return null;
  });

  ngOnInit(): void {
    const satirlar = this.projeler().map((proje): TopluSevkProjeSatiri => {
      const yetkili = this.permissions.canWrite(projeTipiBaglami(proje.projeTipiId).yetki.sevkEt);
      return { proje, yetkili, yukleniyor: yetkili, yuklemeHatasi: null, adaylar: [], digerSandikSayisi: 0 };
    });
    this.satirlar.set(satirlar);
    if (satirlar.length <= 3) this.acikProjeler.set(new Set(satirlar.map(s => s.proje.id)));

    // Sandık listeleri en fazla dört eşzamanlı istekle yüklenir; her proje geldiği anda görünür.
    from(satirlar.filter(s => s.yetkili).map(s => s.proje.id)).pipe(
      mergeMap(projeId => this.sandikService.getSandiklar(projeId).pipe(
        map(sonuc => ({ projeId, sonuc })),
        catchError(() => of({ projeId, sonuc: { isSuccess: false, error: this.t('SHIPMENTS.BULK_CRATES_FAILED') } as { isSuccess: boolean; value?: SandikDto[]; error?: string } })),
      ), 4),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(({ projeId, sonuc }) => {
      const sandiklar = sonuc.isSuccess ? [...(sonuc.value ?? [])] : [];
      const adaylar = sandiklar.filter(s => sandikSevkAdayiMi(s))
        .sort((a, b) => this.sandikNoCollator.compare(a.sandikNo ?? '', b.sandikNo ?? ''));
      this.satirlar.update(liste => liste.map(s => s.proje.id !== projeId ? s : {
        ...s,
        yukleniyor: false,
        yuklemeHatasi: sonuc.isSuccess ? null : (sonuc.error || this.t('SHIPMENTS.BULK_CRATES_FAILED')),
        adaylar,
        digerSandikSayisi: sandiklar.length - adaylar.length,
      }));
      this.secimler.update(secimler => ({ ...secimler, [projeId]: adaylar.map(s => s.id) }));
    });
  }

  t(key: string, degerler?: Record<string, string | number>): string {
    let metin = this.ts.translate(key);
    for (const [ad, deger] of Object.entries(degerler ?? {})) metin = metin.split(`{${ad}}`).join(String(deger));
    return metin;
  }

  sevkEdilebilir(satir: TopluSevkProjeSatiri): boolean {
    return satir.yetkili && !satir.yukleniyor && !satir.yuklemeHatasi && satir.adaylar.length > 0;
  }

  disaridaKalmaNedeni(satir: TopluSevkProjeSatiri): string {
    if (!satir.yetkili) return this.t('SHIPMENTS.BULK_REASON_NO_PERMISSION');
    if (satir.yuklemeHatasi) return satir.yuklemeHatasi;
    return this.t('SHIPMENTS.BULK_REASON_NO_READY_CRATE');
  }

  projeTipiAdi(projeTipiId: number): string {
    return projeTipiBaglami(projeTipiId).ad;
  }

  seciliSayisi(projeId: number): number {
    return this.secimler()[projeId]?.length ?? 0;
  }

  sandikSeciliMi(projeId: number, sandikId: number): boolean {
    return this.secimler()[projeId]?.includes(sandikId) ?? false;
  }

  sandikDegistir(projeId: number, sandikId: number, secili: boolean): void {
    if (this.gonderiliyor()) return;
    this.secimler.update(secimler => {
      const mevcut = secimler[projeId] ?? [];
      const yeni = secili ? (mevcut.includes(sandikId) ? mevcut : [...mevcut, sandikId]) : mevcut.filter(id => id !== sandikId);
      return { ...secimler, [projeId]: yeni };
    });
  }

  /** Projeyi sefere ekler (bütün sevke hazır sandıklar) veya çıkarır (seçim boşalır). */
  projeDegistir(satir: TopluSevkProjeSatiri, dahil: boolean): void {
    if (this.gonderiliyor()) return;
    this.secimler.update(secimler => ({ ...secimler, [satir.proje.id]: dahil ? satir.adaylar.map(s => s.id) : [] }));
  }

  acKapat(projeId: number): void {
    this.acikProjeler.update(acik => {
      const yeni = new Set(acik);
      if (!yeni.delete(projeId)) yeni.add(projeId);
      return yeni;
    });
  }

  hepsiniAcKapat(): void {
    const hepsi = this.sevkEdilebilirSatirlar().map(s => s.proje.id);
    const hepsiAcik = hepsi.every(id => this.acikProjeler().has(id));
    this.acikProjeler.set(hepsiAcik ? new Set() : new Set(hepsi));
  }

  hepsiAcik(): boolean {
    const hepsi = this.sevkEdilebilirSatirlar();
    return hepsi.length > 0 && hepsi.every(s => this.acikProjeler().has(s.proje.id));
  }

  kapat(): void {
    if (!this.gonderiliyor()) this.kapandi.emit();
  }

  gonder(): void {
    if (this.gonderiliyor() || this.yukleniyor()) return;
    const engel = this.engel();
    if (engel) {
      this.hata.set(engel);
      return;
    }
    this.hata.set('');

    const metin = (deger: string) => deger.trim() || undefined;
    const payload = {
      sevkTarihi: this.apiTarihi(this.sevkTarihi()),
      aracPlaka: this.aracPlaka().trim(),
      sofor: metin(this.sofor()),
      dorsePlaka: metin(this.dorsePlaka()),
      aciklama: metin(this.aciklama()),
      projeler: this.dahilSatirlar()
        .map(s => ({ projeId: s.proje.id, sandikIds: [...(this.secimler()[s.proje.id] ?? [])].sort((a, b) => a - b) }))
        .sort((a, b) => a.projeId - b.projeId),
    };
    const parmakIzi = JSON.stringify(payload);
    // Ağ hatası veya engel sonrası aynı istek aynı anahtarla tekrarlanır (sefer iki kez oluşmaz); değişen seçim yeni iştir.
    if (this.sonIstek?.parmakIzi !== parmakIzi) this.sonIstek = { parmakIzi, anahtar: crypto.randomUUID() };

    this.gonderiliyor.set(true);
    this.sevkiyatService.topluSevk({ ...payload, islemAnahtari: this.sonIstek.anahtar }).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.gonderiliyor.set(false)),
    ).subscribe({
      next: sonuc => {
        if (sonuc.isSuccess && sonuc.value && !onayaAlindi(sonuc)) {
          this.sorunlar.set([]);
          this.sevkEdildi.emit({ ...sonuc.value, sevkEdilenProjeIds: payload.projeler.map(p => p.projeId) });
          return;
        }
        const sorunlar = Array.isArray(sonuc.issues)
          ? sonuc.issues.filter(s => typeof s?.projeId === 'number' && typeof s?.mesaj === 'string')
          : [];
        this.sorunlar.set(sorunlar);
        if (sorunlar.length) {
          // Engelli projeler açılır; kullanıcı hangi sandığın sorunlu olduğunu doğrudan görür.
          this.acikProjeler.update(acik => new Set([...acik, ...sorunlar.map(s => s.projeId)]));
        }
        this.hata.set(sonuc.error || this.t('SHIPMENTS.BULK_FAILED'));
      },
      error: () => this.hata.set(this.t('SHIPMENTS.BULK_NETWORK_ERROR')),
    });
  }

  private simdi(): string {
    const tarih = new Date();
    const pad = (deger: number) => deger.toString().padStart(2, '0');
    return `${tarih.getFullYear()}-${pad(tarih.getMonth() + 1)}-${pad(tarih.getDate())}T${pad(tarih.getHours())}:${pad(tarih.getMinutes())}`;
  }

  private apiTarihi(deger: string): string {
    const temiz = deger.trim();
    return temiz.length === 16 ? `${temiz}:00` : temiz;
  }
}
