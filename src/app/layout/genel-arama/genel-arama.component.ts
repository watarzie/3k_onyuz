import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, HostListener, computed, inject, signal, viewChild } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, filter, of, switchMap } from 'rxjs';
import { PermissionService } from '../../core/services/permission.service';
import { projeTipiBaglami } from '../../core/constants/proje-tipi';
import { GenelAramaSonucu } from '../../shared/models/index';
import { GENEL_ARAMA_EN_AZ, GenelAramaService, projeRotasi, sandikRotasi, urunRotasi } from './genel-arama';

export type GenelAramaGrubu = 'proje' | 'urun' | 'sandik';

/** Paneldeki bir sonuç satırı; rota yoksa (izin yok) satır görünür ama seçilemez. */
export interface GenelAramaOgesi {
  grup: GenelAramaGrubu;
  anahtar: string;
  baslik: string;
  alt: string;
  rozet: string;
  rota: unknown[] | null;
  queryParams?: Record<string, string>;
}

const GRUP_BASLIKLARI: Record<GenelAramaGrubu, { baslik: string; ikon: string }> = {
  proje: { baslik: 'Projeler', ikon: 'ri-folder-3-line' },
  urun: { baslik: 'Ürünler (barkod)', ikon: 'ri-barcode-line' },
  sandik: { baslik: 'Sandıklar', ikon: 'ri-archive-line' },
};

/**
 * Üst çubuktaki genel arama: barkod, proje no veya sandık no yazınca açılır panelde gruplu sonuç (Projeler, Ürünler,
 * Sandıklar). Gruplar sunucuda kullanıcının iznine göre dolar. Ok tuşlarıyla gezilir; Enter seçili sonuca, seçili yoksa
 * tam sonuç sayfasına (/arama) götürür. Ctrl+K (Mac'te Cmd+K) kutuya odaklanır, Esc paneli kapatır.
 */
@Component({
  selector: 'app-genel-arama',
  standalone: true,
  templateUrl: './genel-arama.component.html',
  styleUrl: './genel-arama.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GenelAramaComponent {
  private readonly service = inject(GenelAramaService);
  private readonly permissions = inject(PermissionService);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly girdi = viewChild.required<ElementRef<HTMLInputElement>>('girdi');
  private readonly istek$ = new Subject<string>();

  readonly GRUP_BASLIKLARI = GRUP_BASLIKLARI;
  readonly metin = signal('');
  readonly acik = signal(false);
  readonly yukleniyor = signal(false);
  readonly hata = signal('');
  readonly sonuc = signal<GenelAramaSonucu | null>(null);
  readonly aktif = signal(-1);

  readonly yeterli = computed(() => this.metin().trim().length >= GENEL_ARAMA_EN_AZ);
  /** Gösterilen gruplar sırasıyla: yalnız kullanıcının arayabildiği gruplar. */
  readonly gruplar = computed(() => {
    const s = this.sonuc();
    if (!s) return [];
    const izinVar = (kod: string) => this.permissions.hasAccess(kod);
    const gruplar: { grup: GenelAramaGrubu; ogeler: GenelAramaOgesi[] }[] = [];
    if (s.urunAranabilir) {
      gruplar.push({ grup: 'urun', ogeler: s.urunler.map(u => {
        const rota = urunRotasi(u);
        return { grup: 'urun', anahtar: 'u-' + u.barkod, baslik: u.barkod, alt: u.aciklama ?? '', rozet: `${u.projeSayisi} proje`,
          rota: rota.commands, queryParams: rota.queryParams } as GenelAramaOgesi;
      }) });
    }
    if (s.projeAranabilir) {
      gruplar.push({ grup: 'proje', ogeler: s.projeler.map(p => ({
        grup: 'proje', anahtar: 'p-' + p.id, baslik: p.projeNo, alt: p.musteri,
        rozet: `${projeTipiBaglami(p.projeTipiId).ad}${p.durumMetni ? ' · ' + p.durumMetni : ''}`, rota: projeRotasi(p, izinVar),
      }) as GenelAramaOgesi) });
    }
    if (s.sandikAranabilir) {
      gruplar.push({ grup: 'sandik', ogeler: s.sandiklar.map(k => ({
        grup: 'sandik', anahtar: 's-' + k.id, baslik: `${k.projeNo} · Sandık ${k.sandikNo}`, alt: k.ad ?? '',
        rozet: `${projeTipiBaglami(k.projeTipiId).ad}${k.durumMetni ? ' · ' + k.durumMetni : ''}`, rota: sandikRotasi(k, izinVar),
      }) as GenelAramaOgesi) });
    }
    return gruplar;
  });
  /** Klavyeyle gezilebilen (rotası olan) sonuçlar, panel sırasıyla. */
  readonly secilebilir = computed(() => this.gruplar().flatMap(g => g.ogeler).filter(o => o.rota !== null));
  readonly sonucVar = computed(() => this.gruplar().some(g => g.ogeler.length > 0));

  constructor() {
    this.istek$
      .pipe(
        debounceTime(250),
        switchMap(q => q.trim().length >= GENEL_ARAMA_EN_AZ ? this.service.ara(q) : of(null)),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe(res => {
        this.yukleniyor.set(false);
        this.aktif.set(-1);
        if (!res) {
          this.sonuc.set(null);
          return;
        }
        this.sonuc.set(res.isSuccess ? res.value ?? null : null);
        this.hata.set(res.isSuccess ? '' : res.error || 'Arama yapılamadı.');
      });
    // Sonuca gidilince panel kapanır ve kutu boşalır.
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd), takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(() => this.kapat(true));
  }

  yazildi(deger: string): void {
    this.metin.set(deger);
    this.acik.set(true);
    this.yukleniyor.set(deger.trim().length >= GENEL_ARAMA_EN_AZ);
    this.istek$.next(deger);
  }

  odaklandi(): void {
    if (this.metin().trim()) this.acik.set(true);
  }

  aktifMi(oge: GenelAramaOgesi): boolean {
    return this.secilebilir()[this.aktif()]?.anahtar === oge.anahtar;
  }

  sec(oge: GenelAramaOgesi): void {
    if (!oge.rota) return;
    this.router.navigate(oge.rota, { queryParams: oge.queryParams });
  }

  tumSonuclar(): void {
    if (!this.yeterli()) return;
    this.router.navigate(['/arama'], { queryParams: { q: this.metin().trim() } });
  }

  tusBasildi(event: KeyboardEvent): void {
    const ogeler = this.secilebilir();
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        event.preventDefault();
        if (!ogeler.length) return;
        this.acik.set(true);
        this.aktif.update(i => event.key === 'ArrowDown' ? (i + 1) % ogeler.length : (i <= 0 ? ogeler.length - 1 : i - 1));
        break;
      case 'Enter': {
        event.preventDefault();
        const oge = ogeler[this.aktif()];
        if (oge) this.sec(oge);
        else this.tumSonuclar();
        break;
      }
      case 'Escape':
        this.kapat(false);
        this.girdi().nativeElement.blur();
        break;
    }
  }

  /** Ctrl+K / Cmd+K: arama kutusuna odaklanır (sayfanın kendi kısayolu yoktur). */
  @HostListener('document:keydown', ['$event'])
  kisayol(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      const girdi = this.girdi().nativeElement;
      girdi.focus();
      girdi.select();
      this.odaklandi();
    }
  }

  @HostListener('document:click', ['$event'])
  disariTiklandi(event: MouseEvent): void {
    if (this.acik() && !this.host.nativeElement.contains(event.target as Node)) this.acik.set(false);
  }

  private kapat(temizle: boolean): void {
    this.acik.set(false);
    this.aktif.set(-1);
    if (temizle) {
      this.metin.set('');
      this.sonuc.set(null);
    }
  }
}
