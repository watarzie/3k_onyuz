import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpParams } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BreadcrumbComponent } from '../../../shared/components/breadcrumb/breadcrumb.component';
import { StatCardComponent } from '../../../shared/components/stat-card/stat-card.component';
import { ServerPagerComponent } from '../../../shared/components/server-pager/server-pager.component';
import { BaseApiService } from '../../../core/services/base-api.service';
import { ToastService } from '../../../core/services/toast.service';
import { API } from '../../../core/constants/api-endpoints';
import { dosyaAdiBasliktan, dosyayiKaydet } from '../../../core/services/dosya-kaydet';
import {
  PaginatedList, SandikDurumIstatistigi, SandikDurumIstatistikKriteri, SandikDurumKisiSatiri, SandikDurumMusteriSatiri,
  SandikDurumOlayi, SandikDurumOlayTuru, SandikDurumProjeSatiri, sandikTarihMetni,
} from '../../../shared/models/index';

export type IstatistikSekmesi = 'ozet' | 'projeler' | 'musteriler' | 'kisiler' | 'olaylar';

/** Sayfalı tabloların sayfa boyutu seçenekleri (sunucu en fazla 100 verir). */
export const ISTATISTIK_SAYFA_BOYUTLARI = [25, 50, 100] as const;

/** "yyyy-MM-dd" (tarih kutusu ve sunucu sorgusu biçimi). */
export function gunMetni(t: Date): string {
  const iki = (n: number) => String(n).padStart(2, '0');
  return `${t.getFullYear()}-${iki(t.getMonth() + 1)}-${iki(t.getDate())}`;
}

/** Hazır aralıklar: son 30 gün, bu yıl ya da tümü (boş). */
export function hazirAralik(tur: '30' | 'yil' | 'tumu', bugun = new Date()): { baslangic: string; bitis: string } {
  if (tur === 'tumu') return { baslangic: '', bitis: '' };
  const ilk = tur === '30'
    ? new Date(bugun.getFullYear(), bugun.getMonth(), bugun.getDate() - 29)
    : new Date(bugun.getFullYear(), 0, 1);
  return { baslangic: gunMetni(ilk), bitis: gunMetni(bugun) };
}

/** Sebep çubuğunun genişliği: en büyük sebebe göre yüzde. */
export function oran(sayi: number, enBuyuk: number): number {
  return enBuyuk > 0 ? Math.round((sayi / enBuyuk) * 100) : 0;
}

/** Sunucuda sayfalanan bir sekme tablosu: yalnız istenen sayfa okunur, süzgeç değişince başa döner. */
export class SayfaliTablo<T> {
  readonly veri = signal<PaginatedList<T> | null>(null);
  readonly sayfa = signal(1);
  readonly boyut = signal<number>(ISTATISTIK_SAYFA_BOYUTLARI[0]);
  readonly yukleniyor = signal(false);

  constructor(readonly url: string) {}

  sifirla(): void {
    this.veri.set(null);
    this.sayfa.set(1);
  }
}

/**
 * Sandık açılış/kapanış istatistiği (sandik-acilis-istatistigi R). Özet (sayılar, sebep dağılımı, en çok geri açılan 20
 * sandık) tek istekle gelir. Proje, müşteri, kişi ve olay tabloları büyüyebildiği için sekme açılınca sunucudan sayfa
 * sayfa okunur. Kenar menüde yoktur; Projeler ve 3K sandık listesinin "Diğer" menüsünden açılır (3K sandık listesinden
 * gelince proje süzgeci dolu). Süzgeç adres çubuğundadır. Excel aynı süzgeçle bütün tabloları ve olayları yazar.
 */
@Component({
  selector: 'app-sandik-acilis-istatistigi',
  standalone: true,
  imports: [DatePipe, BreadcrumbComponent, StatCardComponent, ServerPagerComponent],
  templateUrl: './sandik-acilis-istatistigi.component.html',
  styleUrl: './sandik-acilis-istatistigi.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SandikAcilisIstatistigiComponent implements OnInit {
  private readonly api = inject(BaseApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly breadcrumb = [
    { label: 'Ana Kontrol Paneli', link: '/dashboard' },
    { label: 'Sandık Açılış/Kapanış İstatistiği' },
  ];
  readonly SandikDurumOlayTuru = SandikDurumOlayTuru;
  readonly SAYFA_BOYUTLARI = ISTATISTIK_SAYFA_BOYUTLARI;
  readonly sandikTarihMetni = sandikTarihMetni;
  readonly oran = oran;

  readonly baslangic = signal('');
  readonly bitis = signal('');
  readonly projeArama = signal('');
  readonly musteri = signal('');
  readonly sekme = signal<IstatistikSekmesi>('ozet');

  readonly sonuc = signal<SandikDurumIstatistigi | null>(null);
  readonly yukleniyor = signal(false);
  readonly indiriliyor = signal(false);
  readonly hata = signal('');
  readonly tarihHatali = computed(() => !!this.baslangic() && !!this.bitis() && this.baslangic() > this.bitis());
  readonly enBuyukSebep = computed(() => Math.max(0, ...(this.sonuc()?.sebepler ?? []).map(s => s.sayi)));

  readonly projeler = new SayfaliTablo<SandikDurumProjeSatiri>(API.SANDIK_ISTATISTIK.PROJELER);
  readonly musteriler = new SayfaliTablo<SandikDurumMusteriSatiri>(API.SANDIK_ISTATISTIK.MUSTERILER);
  readonly kisiler = new SayfaliTablo<SandikDurumKisiSatiri>(API.SANDIK_ISTATISTIK.KISILER);
  readonly olaylar = new SayfaliTablo<SandikDurumOlayi>(API.SANDIK_ISTATISTIK.OLAYLAR);

  /** Son uygulanan süzgeç; tablolar ve Excel bunu kullanır (yazılıp uygulanmamış değer değil). */
  private uygulananKriter: SandikDurumIstatistikKriteri = {};

  ngOnInit(): void {
    const q = this.route.snapshot.queryParamMap;
    this.baslangic.set(q.get('baslangic') ?? '');
    this.bitis.set(q.get('bitis') ?? '');
    this.projeArama.set(q.get('proje') ?? '');
    this.musteri.set(q.get('musteri') ?? '');
    this.getir();
  }

  hazirAralikSec(tur: '30' | 'yil' | 'tumu'): void {
    const aralik = hazirAralik(tur);
    this.baslangic.set(aralik.baslangic);
    this.bitis.set(aralik.bitis);
    this.getir();
  }

  /** Süzgeci uygular: özeti yeniden okur, tabloları başa alır, açık sekmenin ilk sayfasını getirir. */
  getir(): void {
    if (this.tarihHatali()) return;
    const kriter = this.kriter();
    this.uygulananKriter = kriter;
    this.adresiGuncelle(kriter);
    for (const tablo of this.tablolar()) tablo.sifirla();
    this.yukleniyor.set(true);
    this.hata.set('');
    this.api.get<SandikDurumIstatistigi>(API.SANDIK_ISTATISTIK.GETIR, { params: this.httpParams(kriter) })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(res => {
        this.yukleniyor.set(false);
        if (res.isSuccess && res.value) {
          this.sonuc.set(res.value);
        } else {
          this.sonuc.set(null);
          this.hata.set(res.error || 'İstatistik yüklenemedi.');
        }
      });
    const acik = this.acikTablo();
    if (acik) this.tabloYukle(acik);
  }

  /** Kullanıcı avatarının baş harfi (Hareket Geçmişi ile aynı); kullanıcısız olayda "S" (sistem). */
  basHarf(ad: string | null | undefined): string {
    return ad?.trim() ? ad.trim().charAt(0).toLocaleUpperCase('tr-TR') : 'S';
  }

  sekmeSec(sekme: IstatistikSekmesi): void {
    this.sekme.set(sekme);
    const tablo = this.acikTablo();
    if (tablo && !tablo.veri() && !tablo.yukleniyor()) this.tabloYukle(tablo);
  }

  sayfaDegisti<T>(tablo: SayfaliTablo<T>, sayfa: number): void {
    tablo.sayfa.set(sayfa);
    this.tabloYukle(tablo);
  }

  boyutDegisti<T>(tablo: SayfaliTablo<T>, boyut: number): void {
    tablo.boyut.set(boyut);
    tablo.sayfa.set(1);
    this.tabloYukle(tablo);
  }

  tabloYukle<T>(tablo: SayfaliTablo<T>): void {
    const params = this.httpParams(this.uygulananKriter)
      .set('sayfa', String(tablo.sayfa()))
      .set('boyut', String(tablo.boyut()));
    tablo.yukleniyor.set(true);
    this.api.get<PaginatedList<T>>(tablo.url, { params })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(res => {
        tablo.yukleniyor.set(false);
        if (res.isSuccess && res.value) {
          tablo.veri.set(res.value);
          tablo.sayfa.set(res.value.pageNumber);
        } else {
          this.toast.error(res.error || 'Tablo yüklenemedi.');
        }
      });
  }

  excelIndir(): void {
    if (this.indiriliyor() || this.tarihHatali()) return;
    this.indiriliyor.set(true);
    this.api.downloadFileResponse(API.SANDIK_ISTATISTIK.EXCEL, { params: this.httpParams(this.uygulananKriter) })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: yanit => {
          this.indiriliyor.set(false);
          dosyayiKaydet(yanit.body!, dosyaAdiBasliktan(yanit.headers.get('Content-Disposition'), 'SandikAcilisKapanisIstatistigi.xlsx'));
        },
        error: async hata => {
          this.indiriliyor.set(false);
          this.toast.error(await this.api.downloadErrorMessage(hata, 'Excel indirilemedi.'));
        },
      });
  }

  private tablolar(): SayfaliTablo<unknown>[] {
    return [this.projeler, this.musteriler, this.kisiler, this.olaylar] as SayfaliTablo<unknown>[];
  }

  private acikTablo(): SayfaliTablo<unknown> | null {
    switch (this.sekme()) {
      case 'projeler': return this.projeler as SayfaliTablo<unknown>;
      case 'musteriler': return this.musteriler as SayfaliTablo<unknown>;
      case 'kisiler': return this.kisiler as SayfaliTablo<unknown>;
      case 'olaylar': return this.olaylar as SayfaliTablo<unknown>;
      default: return null;
    }
  }

  private kriter(): SandikDurumIstatistikKriteri {
    return {
      baslangic: this.baslangic() || null,
      bitis: this.bitis() || null,
      projeArama: this.projeArama().trim() || null,
      musteri: this.musteri().trim() || null,
    };
  }

  private httpParams(k: SandikDurumIstatistikKriteri): HttpParams {
    let p = new HttpParams();
    if (k.baslangic) p = p.set('baslangic', k.baslangic);
    if (k.bitis) p = p.set('bitis', k.bitis);
    if (k.projeArama) p = p.set('projeArama', k.projeArama);
    if (k.musteri) p = p.set('musteri', k.musteri);
    return p;
  }

  /** Süzgeç adres çubuğuna yazılır: yenileme ve paylaşılan bağlantı aynı sonucu açar. */
  private adresiGuncelle(k: SandikDurumIstatistikKriteri): void {
    this.router.navigate([], {
      relativeTo: this.route,
      replaceUrl: true,
      queryParams: { baslangic: k.baslangic, bitis: k.bitis, proje: k.projeArama, musteri: k.musteri },
    });
  }
}
