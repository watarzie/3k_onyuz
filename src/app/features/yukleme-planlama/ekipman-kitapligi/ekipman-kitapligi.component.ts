import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subject, debounceTime } from 'rxjs';
import { BreadcrumbComponent } from '../../../shared/components/breadcrumb/breadcrumb.component';
import { ServerPagerComponent } from '../../../shared/components/server-pager/server-pager.component';
import { ToastService } from '../../../core/services/toast.service';
import { PermissionService } from '../../../core/services/permission.service';
import { YuklemePlanlamaService } from '../../../core/services/yukleme-planlama.service';
import { dosyaAdiBasliktan, dosyayiKaydet } from '../../../core/services/dosya-kaydet';
import { YETKI } from '../../../core/constants/yetki-kodlari';
import {
  EkipmanAilesiModeli,
  EkipmanDogrulamaDurumu,
  EkipmanIceAktarimIslemi,
  EkipmanIceAktarimSonucu,
  EkipmanIceAktarimSorunu,
  EkipmanKonfigurasyonDetayi,
  EkipmanKonfigurasyonOzeti,
  EkipmanTeknikVerisi,
  PaginatedList,
} from '../../../shared/models/index';
import {
  ACIKLIK_TARAFI,
  DINGIL_TURU,
  DOGRULAMA_DURUMU,
  ENGEL_TURU,
  EKIPMAN_KAYNAK_TURU,
  EKIPMAN_KATEGORISI,
  ICE_AKTARIM_ISLEMI,
  mm,
  yuklemeYontemiMetni,
} from '../ortak/yukleme-etiketleri';
import { Ekipman3dComponent } from './ekipman-3d.component';
import { EkipmanDuzenleComponent } from './ekipman-duzenle.component';

/** Excel dosyasının en büyük boyutu (sunucu: EkipmanKitapligiKurali.DosyaEnFazlaBayt). */
const DOSYA_ENFAZLA_BAYT = 10 * 1024 * 1024;

/**
 * Ekipman kitaplığı: aile → tip → model → konfigürasyon. Teknik veri Excel ile toplu (önce önizleme, sonra uygula)
 * ya da ekrandan tek tek girilir; değişen her konfigürasyon yeni, doğrulanmamış revizyon olur. Doğrulama ayrı
 * izindir (ekipman-dogrulama).
 */
@Component({
  selector: 'app-ekipman-kitapligi',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, FormsModule, BreadcrumbComponent, ServerPagerComponent, Ekipman3dComponent, EkipmanDuzenleComponent],
  templateUrl: './ekipman-kitapligi.component.html',
  styleUrls: ['../ortak/yukleme.scss', './ekipman-kitapligi.component.scss'],
})
export class EkipmanKitapligiComponent implements OnInit {
  private readonly api = inject(YuklemePlanlamaService);
  private readonly toast = inject(ToastService);
  private readonly izin = inject(PermissionService);
  private readonly destroyRef = inject(DestroyRef);

  readonly breadcrumb = [{ label: 'Ana Kontrol Paneli', link: '/dashboard' }, { label: 'Ekipman Kitaplığı' }];
  readonly SAYFA_BOYUTLARI = [25, 50, 100];
  readonly KATEGORI = EKIPMAN_KATEGORISI;
  readonly KAYNAK = EKIPMAN_KAYNAK_TURU;
  readonly DOGRULAMA = DOGRULAMA_DURUMU;
  readonly ISLEM = ICE_AKTARIM_ISLEMI;
  readonly TARAF = ACIKLIK_TARAFI;
  readonly DINGIL = DINGIL_TURU;
  readonly ENGEL = ENGEL_TURU;
  readonly Dogrulama = EkipmanDogrulamaDurumu;
  readonly Islem = EkipmanIceAktarimIslemi;
  readonly yontemMetni = yuklemeYontemiMetni;
  readonly mm = mm;

  readonly yazabilir = computed(() => this.izin.canWrite(YETKI.YUKLEME_PLANLAMA.EKIPMAN_KITAPLIGI));
  readonly dogrulayabilir = computed(() => this.izin.canWrite(YETKI.YUKLEME_PLANLAMA.EKIPMAN_DOGRULAMA));

  readonly aileler = signal<EkipmanAilesiModeli[]>([]);
  readonly arama = signal('');
  readonly aileId = signal<number | null>(null);
  readonly tipId = signal<number | null>(null);
  readonly dogrulamaDurumu = signal<EkipmanDogrulamaDurumu | null>(null);
  readonly pasifleriGoster = signal(false);
  readonly sayfa = signal(1);
  readonly boyut = signal(25);
  readonly liste = signal<PaginatedList<EkipmanKonfigurasyonOzeti> | null>(null);
  readonly yukleniyor = signal(false);
  private readonly aramaAkisi = new Subject<void>();

  readonly tipler = computed(() => {
    const aile = this.aileler().find((a) => a.id === this.aileId());
    return aile ? aile.tipler : this.aileler().flatMap((a) => a.tipler);
  });

  // ----- Ayrıntı -----
  readonly detay = signal<EkipmanKonfigurasyonDetayi | null>(null);
  readonly detayYukleniyor = signal(false);
  readonly dogrulaniyor = signal(false);
  readonly teknikVeri = computed<EkipmanTeknikVerisi | null>(() => {
    const d = this.detay();
    if (!d) return null;
    try {
      return JSON.parse(d.teknikVeriJson) as EkipmanTeknikVerisi;
    } catch {
      return null;
    }
  });

  // ----- Ekrandan ekleme / düzenleme (ekipman-kitapligi W) -----
  /** Açık düzenleme formu: `detay` null ise yeni ekipman. */
  readonly duzenleme = signal<{ detay: EkipmanKonfigurasyonDetayi | null } | null>(null);

  // ----- İçe aktarım -----
  readonly iceAktarAcik = signal(false);
  readonly dosya = signal<File | null>(null);
  readonly onizleme = signal<EkipmanIceAktarimSonucu | null>(null);
  readonly sorunlar = signal<EkipmanIceAktarimSorunu[]>([]);
  readonly isleniyor = signal(false);
  readonly indiriliyor = signal<'sablon' | 'disa' | null>(null);
  readonly uygulanabilir = computed(() => {
    const o = this.onizleme();
    return !!o && !this.sorunlar().length && o.yeniSayisi + o.yeniRevizyonSayisi > 0 && !this.isleniyor();
  });

  ngOnInit(): void {
    this.aramaAkisi.pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.sayfa.set(1);
      this.yukle();
    });
    this.api.ekipmanAileleri().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((r) => {
      if (r.isSuccess && r.value) this.aileler.set(r.value);
      else this.toast.error(r.error ?? 'Ekipman aileleri yüklenemedi.');
    });
    this.yukle();
  }

  yukle(): void {
    this.yukleniyor.set(true);
    this.api.konfigurasyonlar({
      arama: this.arama(),
      aileId: this.aileId(),
      tipId: this.tipId(),
      dogrulamaDurumu: this.dogrulamaDurumu(),
      pasifleriGoster: this.pasifleriGoster(),
      sayfa: this.sayfa(),
      boyut: this.boyut(),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe((r) => {
      this.yukleniyor.set(false);
      if (r.isSuccess && r.value) this.liste.set(r.value);
      else this.toast.error(r.error ?? 'Ekipmanlar yüklenemedi.');
    });
  }

  aramaDegisti(metin: string): void {
    this.arama.set(metin);
    this.aramaAkisi.next();
  }

  suzgecDegisti(): void {
    this.sayfa.set(1);
    this.yukle();
  }

  aileDegisti(id: number | null): void {
    this.aileId.set(id);
    if (this.tipId() && !this.tipler().some((t) => t.id === this.tipId())) this.tipId.set(null);
    this.suzgecDegisti();
  }

  sayfaDegisti(sayfa: number): void {
    this.sayfa.set(sayfa);
    this.yukle();
  }

  boyutDegisti(boyut: number): void {
    this.boyut.set(boyut);
    this.sayfa.set(1);
    this.yukle();
  }

  // ----- Ayrıntı -----

  ac(k: EkipmanKonfigurasyonOzeti): void {
    this.detay.set(null);
    this.detayYukleniyor.set(true);
    this.api.konfigurasyon(k.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe((r) => {
      this.detayYukleniyor.set(false);
      if (r.isSuccess && r.value) this.detay.set(r.value);
      else this.toast.error(r.error ?? 'Konfigürasyon yüklenemedi.');
    });
  }

  kapat(): void {
    this.detay.set(null);
  }

  dogrula(): void {
    const d = this.detay();
    if (!d || this.dogrulaniyor()) return;
    this.dogrulaniyor.set(true);
    this.api.dogrula(d.id, d.revizyon.revizyonNo).subscribe((r) => {
      this.dogrulaniyor.set(false);
      if (r.isSuccess && r.value) {
        this.detay.set(r.value);
        this.toast.success(`${d.kod} revizyon ${d.revizyon.revizyonNo} doğrulandı.`);
        this.yukle();
      } else {
        this.toast.error(r.error ?? 'Doğrulanamadı.');
      }
    });
  }

  // ----- Ekrandan ekleme / düzenleme -----

  yeniEkipman(): void {
    this.duzenleme.set({ detay: null });
  }

  duzenle(): void {
    const d = this.detay();
    if (d) this.duzenleme.set({ detay: d });
  }

  /**
   * Form kaydetmeden kapandı. Düzenlemede ayrıntı sunucudan yeniden çekilir: kayıt arada değiştiyse (409) "Düzenle"
   * güncel revizyonla açılır, eski revizyonla açılıp yeniden çakışmaz.
   */
  duzenlemeKapandi(): void {
    const id = this.duzenleme()?.detay?.id;
    this.duzenleme.set(null);
    if (id == null) return;
    this.api.konfigurasyon(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe((r) => {
      // Yanıt gelene kadar ayrıntı kapatılmış ya da başka kayıt açılmış olabilir.
      if (this.detay()?.id !== id) return;
      if (r.isSuccess && r.value) this.detay.set(r.value);
      else this.toast.error(r.error ?? 'Konfigürasyon yüklenemedi.');
    });
  }

  /** Kayıt uygulandı: ayrıntı sunucunun döndürdüğü güncel kayıtla açılır, liste yenilenir. */
  kaydedildi(detay: EkipmanKonfigurasyonDetayi): void {
    this.detay.set(detay);
    this.duzenleme.set(null);
    this.yukle();
  }

  // ----- Dosyalar -----

  sablonIndir(): void {
    this.indir('sablon', this.api.sablonIndir(), 'ekipman-sablonu.xlsx');
  }

  disaAktar(): void {
    this.indir('disa', this.api.disaAktar(), 'ekipman-kitapligi.xlsx');
  }

  private indir(tur: 'sablon' | 'disa', istek: Observable<HttpResponse<Blob>>, varsayilan: string): void {
    this.indiriliyor.set(tur);
    istek.subscribe({
      next: (yanit) => {
        this.indiriliyor.set(null);
        dosyayiKaydet(yanit.body!, dosyaAdiBasliktan(yanit.headers.get('Content-Disposition'), varsayilan));
      },
      error: async (hata) => {
        this.indiriliyor.set(null);
        this.toast.error(await this.api.downloadErrorMessage(hata, 'Dosya indirilemedi.'));
      },
    });
  }

  iceAktarAc(): void {
    this.dosya.set(null);
    this.onizleme.set(null);
    this.sorunlar.set([]);
    this.iceAktarAcik.set(true);
  }

  dosyaSecildi(olay: Event): void {
    const girdi = olay.target as HTMLInputElement;
    const dosya = girdi.files?.[0] ?? null;
    girdi.value = '';
    this.onizleme.set(null);
    this.sorunlar.set([]);
    if (!dosya) return;
    if (!dosya.name.toLowerCase().endsWith('.xlsx')) {
      this.toast.error('Yalnız .xlsx dosyası yüklenebilir.');
      return;
    }
    if (dosya.size > DOSYA_ENFAZLA_BAYT) {
      this.toast.error('Dosya en fazla 10 MB olabilir.');
      return;
    }
    this.dosya.set(dosya);
    this.isleniyor.set(true);
    this.api.iceAktarOnizle(dosya).subscribe((r) => {
      this.isleniyor.set(false);
      if (r.isSuccess && r.value) {
        this.onizleme.set(r.value);
        this.sorunlar.set(r.value.sorunlar);
      } else {
        this.sorunlar.set(sorunListesi(r));
        this.toast.error(r.error ?? 'Dosya incelenemedi.');
      }
    });
  }

  uygula(): void {
    const dosya = this.dosya();
    if (!dosya || !this.uygulanabilir()) return;
    this.isleniyor.set(true);
    this.api.iceAktar(dosya).subscribe((r) => {
      this.isleniyor.set(false);
      if (r.isSuccess && r.value) {
        this.toast.success(`${r.value.yeniSayisi} yeni konfigürasyon, ${r.value.yeniRevizyonSayisi} yeni revizyon yazıldı.`);
        this.iceAktarAcik.set(false);
        this.yukle();
      } else {
        this.sorunlar.set(sorunListesi(r));
        this.toast.error(r.error ?? 'Dosya uygulanamadı.');
      }
    });
  }
}

/** Hata yanıtındaki yapılandırılmış sorun listesi (sunucu: `issues`). */
function sorunListesi(r: unknown): EkipmanIceAktarimSorunu[] {
  const issues = (r as { issues?: unknown }).issues;
  return Array.isArray(issues) ? (issues as EkipmanIceAktarimSorunu[]) : [];
}
