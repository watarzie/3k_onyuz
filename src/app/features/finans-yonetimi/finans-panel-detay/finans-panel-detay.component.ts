import { DecimalPipe } from '@angular/common';
import { Component, DestroyRef, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FINANS_YETKI } from '../../../core/constants/yetki-kodlari';
import { FinansService } from '../../../core/services/finans.service';
import { PermissionService } from '../../../core/services/permission.service';
import { TranslationService } from '../../../core/services/translation.service';
import { FinansIsKaydi } from '../../../shared/models/finans.model';
import { FinansPanel, FinansPanelProjeGrubu, FinansPanelProjeOzeti, FinansVarlikTuru } from '../../../shared/models/finans-v2.model';
import {
  faturaKarsilanmaAnahtari,
  isDurumuAnahtari,
  kategoriAnahtari,
  siparisKarsilanmaAnahtari,
} from '../ortak/finans-etiketleri';

export type FinansPanelDetaySekmesi = 'projeler' | 'kategoriler' | 'giderler';

/** Proje satırı açıldığında yüklenen kalemler; tek istekle en fazla bu kadar kalem getirilir. */
const KALEM_SINIRI = 250;
/** Her grup ilk açılışta bu kadar satır gösterir; gerisi "Tümünü göster" ile açılır. */
const ILK_SATIR = 5;
/** Grup sırası ve başlıkları (sunucu satırları bu sırayla ve grup içinde iş bedeline göre gönderir). */
const GRUPLAR: readonly { grup: FinansPanelProjeGrubu; anahtar: string }[] = [
  { grup: 1, anahtar: 'PANEL_GROUP_NORMAL' },
  { grup: 2, anahtar: 'PANEL_GROUP_FIELD' },
  { grup: 3, anahtar: 'PANEL_GROUP_SPARE' },
  { grup: 4, anahtar: 'PANEL_GROUP_INDEPENDENT' },
];

export interface FinansPanelProjeGrubuSatiri {
  grup: FinansPanelProjeGrubu;
  anahtar: string;
  projeler: FinansPanelProjeOzeti[];
  gorunen: FinansPanelProjeOzeti[];
  isKaydi: number;
  isBedeli: number;
  gider: number;
}

interface ProjeKalemleri {
  yukleniyor: boolean;
  kalemler: FinansIsKaydi[];
  kesildi: boolean;
  hata: boolean;
}

/**
 * Finans panelinin detay dökümü: proje, kategori ve gider türü kırılımları. Kullanıcıyı boğmamak için
 * ilk satırlar gösterilir; proje satırı açılınca o projenin dönemdeki sandık/kalemleri yüklenir ve
 * kalemden kayıt detayı açılır (en alt veri).
 */
@Component({
  selector: 'app-finans-panel-detay',
  standalone: true,
  imports: [DecimalPipe, FormsModule],
  templateUrl: './finans-panel-detay.component.html',
  styleUrl: './finans-panel-detay.component.scss',
})
export class FinansPanelDetayComponent {
  private readonly translation = inject(TranslationService);
  t(key: string): string {
    return this.translation.translate(`FINANS_V2.${key}`);
  }
  private readonly service = inject(FinansService);
  private readonly destroyRef = inject(DestroyRef);
  readonly permissions = inject(PermissionService);
  readonly izin = FINANS_YETKI;

  readonly panel = input.required<FinansPanel>();
  readonly kayitAc = output<{ tur: FinansVarlikTuru; id: number }>();

  readonly sekme = signal<FinansPanelDetaySekmesi>('projeler');
  readonly para = signal('');
  readonly arama = signal('');
  readonly tumu = signal(false);
  readonly acikProjeler = signal(new Set<string>());
  readonly projeKalemleri = signal(new Map<string, ProjeKalemleri>());

  readonly kategoriAnahtari = kategoriAnahtari;
  readonly siparisKarsilanmaAnahtari = siparisKarsilanmaAnahtari;
  readonly faturaKarsilanmaAnahtari = faturaKarsilanmaAnahtari;
  readonly isDurumuAnahtari = isDurumuAnahtari;

  readonly kayitGorunur = computed(() => this.permissions.hasAccess(FINANS_YETKI.KayitGoruntule));
  readonly tutarGorunur = computed(() => this.parasal(FINANS_YETKI.TutarGoruntule));
  readonly giderGorunur = computed(() => this.parasal(FINANS_YETKI.GiderGoruntule));

  /** Detayda bulunan para birimleri; projeler, kategoriler ve gider türlerinin birleşimi. */
  readonly paraKodlari = computed(() => {
    const p = this.panel();
    const kodlar = new Set<string>([
      ...(p.projeOzetleri ?? []).map((x) => x.paraBirimi),
      ...(p.kategoriOzetleri ?? []).map((x) => x.paraBirimi),
      ...(p.giderTurleri ?? []).map((x) => x.paraBirimi),
    ]);
    return [...kodlar];
  });

  readonly projeler = computed(() => {
    const aranan = this.arama().trim().toLocaleLowerCase('tr-TR');
    return (this.panel().projeOzetleri ?? []).filter(
      (x) =>
        x.paraBirimi === this.para() &&
        (!aranan || `${x.projeNo} ${x.musteri}`.toLocaleLowerCase('tr-TR').includes(aranan)),
    );
  });
  /** Normal → Saha → Yedek → Bağımsız grupları; boş grup gösterilmez, her grubun ara toplamı vardır. */
  readonly gruplar = computed((): FinansPanelProjeGrubuSatiri[] =>
    GRUPLAR.map(({ grup, anahtar }) => {
      const projeler = this.projeler().filter((x) => (x.projeGrubu ?? 1) === grup);
      return {
        grup,
        anahtar,
        projeler,
        gorunen: this.tumu() ? projeler : projeler.slice(0, ILK_SATIR),
        isKaydi: projeler.reduce((a, x) => a + x.isKaydi, 0),
        isBedeli: projeler.reduce((a, x) => a + (x.isBedeli ?? 0), 0),
        gider: projeler.reduce((a, x) => a + (x.gider ?? 0), 0),
      };
    }).filter((g) => g.projeler.length > 0),
  );
  /** Gruplarda gizlenen satır var mı ("Tümünü göster" düğmesi). */
  readonly kisaltildi = computed(() => this.gruplar().some((g) => g.projeler.length > ILK_SATIR));
  readonly projeToplami = computed(() =>
    this.projeler().reduce(
      (a, x) => ({
        isKaydi: a.isKaydi + x.isKaydi,
        isBedeli: a.isBedeli + (x.isBedeli ?? 0),
        siparis: a.siparis + (x.siparisNetTutar ?? 0),
        fatura: a.fatura + (x.faturalananNetTutar ?? 0),
        gider: a.gider + (x.gider ?? 0),
      }),
      { isKaydi: 0, isBedeli: 0, siparis: 0, fatura: 0, gider: 0 },
    ),
  );

  /** Kategori satırları; pay, iş bedeli (tutar izni yoksa kalem sayısı) üzerinden hesaplanır. */
  readonly kategoriler = computed(() => {
    const satirlar = (this.panel().kategoriOzetleri ?? []).filter((x) => x.paraBirimi === this.para());
    const tutarla = this.tutarGorunur();
    const toplam = satirlar.reduce((a, x) => a + (tutarla ? (x.isBedeli ?? 0) : x.isKaydi), 0);
    return satirlar
      .map((x) => ({
        ...x,
        pay: toplam ? ((tutarla ? (x.isBedeli ?? 0) : x.isKaydi) / toplam) * 100 : 0,
        faturaOrani: x.isBedeli ? ((x.faturalananNetTutar ?? 0) / x.isBedeli) * 100 : 0,
      }))
      .sort((a, b) => b.pay - a.pay);
  });

  readonly giderler = computed(() => {
    const satirlar = (this.panel().giderTurleri ?? []).filter((x) => x.paraBirimi === this.para() && (x.gider ?? 0) !== 0);
    const toplam = satirlar.reduce((a, x) => a + (x.gider ?? 0), 0);
    return satirlar
      .map((x) => ({ grup: x.grup, gider: x.gider ?? 0, pay: toplam ? ((x.gider ?? 0) / toplam) * 100 : 0 }))
      .sort((a, b) => b.gider - a.gider);
  });
  readonly giderToplami = computed(() => this.giderler().reduce((a, x) => a + x.gider, 0));

  constructor() {
    // Panel yenilenince (dönem değişti) açık projeler ve yüklenmiş kalemler eski döneme aittir; sıfırlanır.
    effect(() => {
      const kodlar = this.paraKodlari();
      this.panel();
      this.acikProjeler.set(new Set());
      this.projeKalemleri.set(new Map());
      if (!kodlar.includes(untracked(this.para))) this.para.set(kodlar.includes('EUR') ? 'EUR' : (kodlar[0] ?? ''));
    });
  }

  parasal(alan: string): boolean {
    return this.permissions.hasAccess(FINANS_YETKI.ParasalVeriGoruntule) && this.permissions.hasAccess(alan);
  }
  sekmeSec(sekme: FinansPanelDetaySekmesi): void {
    this.sekme.set(sekme);
    this.tumu.set(false);
  }
  oran(pay: number | null, payda: number | null): number {
    return pay && payda ? Math.min(100, Math.max(0, (pay / payda) * 100)) : 0;
  }
  /** Bağımsız grupta aynı proje numarası müşteriye göre ayrı satırdır; anahtar müşteriyi de içerir. */
  projeAnahtari(p: FinansPanelProjeOzeti): string {
    return p.projeGrubu === 4 ? `${p.projeNo}|${p.paraBirimi}|${p.musteri}` : `${p.projeNo}|${p.paraBirimi}`;
  }
  projeAcik(p: FinansPanelProjeOzeti): boolean {
    return this.acikProjeler().has(this.projeAnahtari(p));
  }
  kalemDurumu(p: FinansPanelProjeOzeti): ProjeKalemleri | undefined {
    return this.projeKalemleri().get(this.projeAnahtari(p));
  }

  /** Proje satırını açar/kapatır; ilk açılışta projenin dönemdeki kalemleri bir kez yüklenir. */
  projeAcKapat(p: FinansPanelProjeOzeti): void {
    if (!this.kayitGorunur()) return;
    const anahtar = this.projeAnahtari(p);
    const acik = new Set(this.acikProjeler());
    if (acik.has(anahtar)) {
      acik.delete(anahtar);
      this.acikProjeler.set(acik);
      return;
    }
    acik.add(anahtar);
    this.acikProjeler.set(acik);
    if (this.projeKalemleri().has(anahtar)) return;
    this.kalemleriYaz(anahtar, { yukleniyor: true, kalemler: [], kesildi: false, hata: false });
    const { baslangic, bitis } = this.panel();
    const ilk = (baslangic ?? '').slice(0, 10);
    const son = (bitis ?? '').slice(0, 10);
    this.service
      .genelArama({ pageNumber: 1, pageSize: KALEM_SINIRI, projeNo: p.projeNo, paraBirimi: p.paraBirimi })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (sonuc) => {
          if (!sonuc.isSuccess || !sonuc.value) {
            this.kalemleriYaz(anahtar, { yukleniyor: false, kalemler: [], kesildi: false, hata: true });
            return;
          }
          // Genel arama bütün dönemleri tarar; panelle aynı kalemler için dönem ve aktif kaynak süzülür.
          const kalemler = sonuc.value.items
            .filter((x) => x.projeNo === p.projeNo && x.paraBirimi === p.paraBirimi && x.kaynakAktif !== false)
            // Bağımsız satır tek müşterinin işleridir (sunucu projesiz işleri müşteriye göre ayırır).
            .filter((x) => p.projeGrubu !== 4 || (x.musteri ?? '').trim() === p.musteri)
            .filter((x) => {
              const tarih = (x.finansTarihi ?? '').slice(0, 10);
              return !tarih || ((!ilk || tarih >= ilk) && (!son || tarih <= son));
            })
            .sort(
              (a, b) =>
                (a.sandikNo ?? '').localeCompare(b.sandikNo ?? '', 'tr-TR', { numeric: true }) ||
                (a.kategori ?? 99) - (b.kategori ?? 99) ||
                a.id - b.id,
            );
          this.kalemleriYaz(anahtar, {
            yukleniyor: false,
            kalemler,
            kesildi: sonuc.value.totalCount > KALEM_SINIRI,
            hata: false,
          });
        },
        error: () => this.kalemleriYaz(anahtar, { yukleniyor: false, kalemler: [], kesildi: false, hata: true }),
      });
  }
  private kalemleriYaz(anahtar: string, durum: ProjeKalemleri): void {
    this.projeKalemleri.update((eski) => new Map(eski).set(anahtar, durum));
  }
}
