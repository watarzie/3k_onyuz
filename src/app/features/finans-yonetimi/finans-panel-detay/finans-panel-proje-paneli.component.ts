import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, DestroyRef, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { FinansIsKategorisi } from '../../../core/constants/enums';
import { FinansService } from '../../../core/services/finans.service';
import { PermissionService } from '../../../core/services/permission.service';
import { TranslationService } from '../../../core/services/translation.service';
import { FinansIsKaydi } from '../../../shared/models/finans.model';
import { FinansPanelProjeOzeti, FinansVarlikTuru } from '../../../shared/models/finans-v2.model';
import {
  FINANS_KATEGORILERI,
  faturaKarsilanmaAnahtari,
  isDurumuAnahtari,
  kategoriAnahtari,
  siparisKarsilanmaAnahtari,
} from '../ortak/finans-etiketleri';
import { finansAltSekmeAcik } from '../ortak/finans-izinleri';
import {
  FINANS_SANDIK_DURUM_SUZGECLERI,
  FinansSandikDurumSuzgeci,
  aramayaUyar,
  sandikDurumSuzgeceUyar,
  sandikNoKarsilastir,
  sarfKaydi,
} from '../ortak/finans-kirilim';
import { FinansProjeBelgeleriComponent } from '../ortak/finans-proje-belgeleri.component';
import { FinansProjeDetayComponent } from '../finans-proje-detay/finans-proje-detay.component';

/** Tek istekle en fazla bu kadar kalem getirilir (genel arama sayfası); fazlası için İş Takibi önerilir. */
const KALEM_SINIRI = 250;
const GRUP_ANAHTARLARI: Record<number, string> = {
  1: 'PANEL_GROUP_NORMAL',
  2: 'PANEL_GROUP_FIELD',
  3: 'PANEL_GROUP_SPARE',
  4: 'PANEL_GROUP_INDEPENDENT',
};

export type PanelProjeSekmesi = 'kategoriler' | 'sandiklar' | 'belgeler';

/** Sandık: sandığın dönemdeki kalemleri (NET ve SARF), tutarları ve en geride kalan kaydın durumu. */
export interface PanelProjeSandigi {
  anahtar: string;
  sandikNo: string;
  sandikAdi: string;
  sandikTipi: string | null;
  kalemler: FinansIsKaydi[];
  net: number;
  siparis: number;
  fatura: number;
  durum: number;
  fiyatBekleyenKayitSayisi: number;
  poNumaralari: string[];
  faturaNumaralari: string[];
}

export interface PanelProjeKategorisi {
  kategori: FinansIsKategorisi | 0;
  kalemSayisi: number;
  sandikSayisi: number;
  ahsapM3: number;
  kontraM3: number;
  net: number;
  siparis: number;
  fatura: number;
  durum: number;
}

const toplam = (kalemler: readonly FinansIsKaydi[], alan: (k: FinansIsKaydi) => number | null | undefined) =>
  Math.round(kalemler.reduce((a, k) => a + (alan(k) ?? 0), 0) * 100) / 100;
/** Kalem durumu (FinansIsDurumu); iptal kalem (6) en geride kalan sayılmaz. */
const enGeridekiDurum = (kalemler: readonly FinansIsKaydi[]) => {
  const durumlar = kalemler.map((k) => k.durum ?? 1).filter((d) => d !== 6);
  return durumlar.length ? Math.min(...durumlar) : 6;
};

/**
 * Kontrol Paneli detaylı dökümünde projenin sağdan açılan paneli (İş Takibi proje paneliyle aynı düzen): üstte dönem
 * özeti (iş bedeli, PO, fatura, kalan); altında Kategoriler | Sandıklar | PO / Fatura sekmeleri. Kalemler panelin
 * dönemine ve projenin para birimine süzülmüş genel arama sonucudur; kalemden kayıt detayı açılır.
 */
@Component({
  selector: 'app-finans-panel-proje-paneli',
  standalone: true,
  imports: [DatePipe, DecimalPipe, FormsModule, FinansProjeBelgeleriComponent, FinansProjeDetayComponent],
  templateUrl: './finans-panel-proje-paneli.component.html',
  styleUrls: ['../ortak/finans-proje-paneli.scss', './finans-panel-proje-paneli.component.scss'],
})
export class FinansPanelProjePaneliComponent {
  private readonly translation = inject(TranslationService);
  t(key: string): string {
    return this.translation.translate(`FINANS_V2.${key}`);
  }
  private readonly service = inject(FinansService);
  private readonly permissions = inject(PermissionService);
  private readonly destroyRef = inject(DestroyRef);

  readonly proje = input.required<FinansPanelProjeOzeti>();
  /** Panel dönemi (yyyy-MM-dd…); kalemler bu aralığa süzülür. */
  readonly baslangic = input('');
  readonly bitis = input('');
  readonly kapat = output<void>();
  readonly kayitAc = output<{ tur: FinansVarlikTuru; id: number }>();

  readonly kategoriAnahtari = kategoriAnahtari;
  readonly isDurumuAnahtari = isDurumuAnahtari;
  readonly siparisKarsilanmaAnahtari = siparisKarsilanmaAnahtari;
  readonly faturaKarsilanmaAnahtari = faturaKarsilanmaAnahtari;
  readonly sarfKaydi = sarfKaydi;
  readonly suzgecler = FINANS_SANDIK_DURUM_SUZGECLERI;

  readonly yukleniyor = signal(false);
  readonly hata = signal(false);
  readonly kalemler = signal<FinansIsKaydi[]>([]);
  readonly kesildi = signal(false);
  readonly sekme = signal<PanelProjeSekmesi>('kategoriler');
  readonly arama = signal('');
  readonly durumSuzgeci = signal<FinansSandikDurumSuzgeci>('hepsi');
  /** Kategori satırından açılan sandık dökümü: yalnız o kategorinin kalemleri. */
  readonly kategoriSuzgeci = signal<FinansIsKategorisi | 0 | null>(null);
  readonly acikSandiklar = signal(new Set<string>());
  readonly tumDonemlerAcik = signal(false);
  private nesil = 0;

  readonly grupAnahtari = computed(() => GRUP_ANAHTARLARI[this.proje().projeGrubu ?? 1] ?? GRUP_ANAHTARLARI[1]);
  /** Bağımsız işler (projesiz) için PO / fatura listesi ve bütün dönemler görünümü yoktur. */
  readonly projeli = computed(() => (this.proje().projeGrubu ?? 1) !== 4);
  readonly belgelerGorunur = computed(() =>
    this.projeli() && (finansAltSekmeAcik(this.permissions, 'po') || finansAltSekmeAcik(this.permissions, 'fatura')));

  readonly kategoriler = computed<PanelProjeKategorisi[]>(() => {
    const gruplar = new Map<FinansIsKategorisi | 0, FinansIsKaydi[]>();
    for (const k of this.kalemler()) gruplar.set(k.kategori ?? 0, [...(gruplar.get(k.kategori ?? 0) ?? []), k]);
    const sira = (kategori: FinansIsKategorisi | 0) => {
      const i = FINANS_KATEGORILERI.findIndex((x) => x.deger === kategori);
      return i < 0 ? FINANS_KATEGORILERI.length : i;
    };
    return [...gruplar.entries()]
      .sort(([a], [b]) => sira(a) - sira(b))
      .map(([kategori, kalemler]) => ({
        kategori,
        kalemSayisi: kalemler.length,
        sandikSayisi: new Set(kalemler.map((k) => (k.sandikNo ?? '').trim()).filter(Boolean)).size,
        ahsapM3: toplam(kalemler, (k) => k.ahsapM3),
        kontraM3: toplam(kalemler, (k) => k.kontraM3),
        net: toplam(kalemler, (k) => k.netTutar),
        siparis: toplam(kalemler, (k) => k.siparisNetTutar),
        fatura: toplam(kalemler, (k) => k.faturalananNetTutar),
        durum: enGeridekiDurum(kalemler),
      }));
  });

  /** Sandıklar: kategori süzgeci varsa yalnız o kategorinin kalemleriyle; doğal sandık no sırasıyla. */
  private readonly tumSandiklar = computed<PanelProjeSandigi[]>(() => {
    const kategori = this.kategoriSuzgeci();
    const kalemler = kategori === null ? this.kalemler() : this.kalemler().filter((k) => (k.kategori ?? 0) === kategori);
    const gruplar = new Map<string, FinansIsKaydi[]>();
    for (const k of kalemler) {
      const anahtar = (k.sandikNo ?? '').trim();
      gruplar.set(anahtar, [...(gruplar.get(anahtar) ?? []), k]);
    }
    return [...gruplar.entries()]
      .map(([anahtar, sirasiz]) => {
        const sirali = [...sirasiz].sort((a, b) => Number(sarfKaydi(a)) - Number(sarfKaydi(b)) || (a.kategori ?? 99) - (b.kategori ?? 99) || a.id - b.id);
        const temsil = sirali.find((k) => !sarfKaydi(k)) ?? sirali[0];
        return {
          anahtar,
          sandikNo: anahtar,
          sandikAdi: temsil.sandikAdi || temsil.isAdi || '',
          sandikTipi: temsil.sandikTipi ?? null,
          kalemler: sirali,
          net: toplam(sirali, (k) => k.netTutar),
          siparis: toplam(sirali, (k) => k.siparisNetTutar),
          fatura: toplam(sirali, (k) => k.faturalananNetTutar),
          durum: enGeridekiDurum(sirali),
          fiyatBekleyenKayitSayisi: sirali.filter((k) => k.netTutar === null || k.netTutar === undefined).length,
          poNumaralari: [...new Set(sirali.flatMap((k) => k.poNumaralari ?? []))],
          faturaNumaralari: [...new Set(sirali.flatMap((k) => k.faturaNumaralari ?? []))],
        };
      })
      .sort((a, b) => sandikNoKarsilastir(a.sandikNo, b.sandikNo));
  });
  readonly sandiklar = computed(() => {
    const arama = this.arama().trim().toLocaleLowerCase('tr-TR');
    const suzgec = this.durumSuzgeci();
    return this.tumSandiklar().filter((s) => sandikDurumSuzgeceUyar(s, suzgec) &&
      aramayaUyar(arama, [s.sandikNo, s.sandikAdi, s.sandikTipi, ...s.poNumaralari, ...s.faturaNumaralari,
        ...s.kalemler.map((k) => k.isAdi)]));
  });
  readonly suzgecSayilari = computed(() => {
    const sandiklar = this.tumSandiklar();
    return Object.fromEntries(this.suzgecler.map((f) =>
      [f.deger, sandiklar.filter((s) => sandikDurumSuzgeceUyar(s, f.deger)).length])) as Record<FinansSandikDurumSuzgeci, number>;
  });
  readonly sandikSayisi = computed(() => new Set(this.kalemler().map((k) => (k.sandikNo ?? '').trim())).size);
  readonly ahsapM3 = computed(() => toplam(this.kalemler(), (k) => k.ahsapM3));
  readonly kontraM3 = computed(() => toplam(this.kalemler(), (k) => k.kontraM3));
  readonly fiyatBekleyen = computed(() => this.kalemler().filter((k) => k.netTutar === null || k.netTutar === undefined).length);
  readonly donemPo = computed(() => [...new Set(this.kalemler().flatMap((k) => k.poNumaralari ?? []))]);
  readonly donemFatura = computed(() => [...new Set(this.kalemler().flatMap((k) => k.faturaNumaralari ?? []))]);

  constructor() {
    effect(() => {
      const proje = this.proje();
      this.baslangic();
      this.bitis();
      untracked(() => this.yukle(proje));
    });
  }

  sekmeSec(sekme: PanelProjeSekmesi): void {
    this.sekme.set(sekme);
    this.kategoriSuzgeci.set(null);
  }
  /** Kategori satırından Sandıklar sekmesine: yalnız o kategorinin kalemleri. */
  kategoriSandiklari(kategori: FinansIsKategorisi | 0): void {
    this.kategoriSuzgeci.set(kategori);
    this.durumSuzgeci.set('hepsi');
    this.sekme.set('sandiklar');
  }
  sandikAcik(s: PanelProjeSandigi): boolean {
    return this.acikSandiklar().has(s.anahtar);
  }
  sandikAcKapat(s: PanelProjeSandigi): void {
    this.acikSandiklar.update((x) => {
      const y = new Set(x);
      if (y.has(s.anahtar)) y.delete(s.anahtar); else y.add(s.anahtar);
      return y;
    });
  }
  durumSinifi(durum: number): string {
    return durum === 5 ? 'complete' : durum === 6 ? 'cancel-status' : durum > 1 ? 'partial' : '';
  }
  oran(karsilanan: number | null | undefined, tutar: number | null | undefined): number {
    return tutar ? Math.min(100, Math.max(0, Math.round(((karsilanan ?? 0) / tutar) * 100))) : 0;
  }

  /** Projenin dönemdeki kalemleri: genel arama bütün dönemleri tarar; dönem, para birimi ve aktif kaynak süzülür. */
  private yukle(p: FinansPanelProjeOzeti): void {
    const nesil = ++this.nesil;
    this.yukleniyor.set(true);
    this.hata.set(false);
    this.kalemler.set([]);
    this.acikSandiklar.set(new Set());
    const ilk = (this.baslangic() ?? '').slice(0, 10);
    const son = (this.bitis() ?? '').slice(0, 10);
    this.service
      .genelArama({ pageNumber: 1, pageSize: KALEM_SINIRI, projeNo: p.projeNo, paraBirimi: p.paraBirimi })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (sonuc) => {
          if (nesil !== this.nesil) return;
          this.yukleniyor.set(false);
          if (!sonuc.isSuccess || !sonuc.value) {
            this.hata.set(true);
            return;
          }
          this.kalemler.set(sonuc.value.items
            .filter((x) => x.projeNo === p.projeNo && x.paraBirimi === p.paraBirimi && x.kaynakAktif !== false)
            // Bağımsız satır tek müşterinin işleridir (sunucu projesiz işleri müşteriye göre ayırır).
            .filter((x) => p.projeGrubu !== 4 || (x.musteri ?? '').trim() === p.musteri)
            .filter((x) => {
              const tarih = (x.finansTarihi ?? '').slice(0, 10);
              return !tarih || ((!ilk || tarih >= ilk) && (!son || tarih <= son));
            }));
          this.kesildi.set(sonuc.value.totalCount > KALEM_SINIRI);
        },
        error: () => {
          if (nesil !== this.nesil) return;
          this.yukleniyor.set(false);
          this.hata.set(true);
        },
      });
  }
}
