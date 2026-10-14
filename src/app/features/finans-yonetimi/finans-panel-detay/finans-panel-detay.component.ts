import { DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finansKayitOkunabilir } from '../ortak/finans-izinleri';
import { PermissionService } from '../../../core/services/permission.service';
import { TranslationService } from '../../../core/services/translation.service';
import { FinansPanel, FinansPanelProjeGrubu, FinansPanelProjeOzeti, FinansVarlikTuru } from '../../../shared/models/finans-v2.model';
import {
  faturaKarsilanmaAnahtari,
  kategoriAnahtari,
  siparisKarsilanmaAnahtari,
} from '../ortak/finans-etiketleri';
import { FinansPanelProjePaneliComponent } from './finans-panel-proje-paneli.component';

export type FinansPanelDetaySekmesi = 'projeler' | 'kategoriler' | 'giderler';

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

/**
 * Finans panelinin detay dökümü: proje, kategori ve gider türü kırılımları. Kullanıcıyı boğmamak için
 * ilk satırlar gösterilir; projeye tıklanınca sağdan proje paneli açılır (dönem özeti; kategoriler, sandıklar,
 * PO / fatura) ve kalemden kayıt detayı açılır (en alt veri).
 */
@Component({
  selector: 'app-finans-panel-detay',
  standalone: true,
  imports: [DecimalPipe, FormsModule, FinansPanelProjePaneliComponent],
  templateUrl: './finans-panel-detay.component.html',
  styleUrl: './finans-panel-detay.component.scss',
})
export class FinansPanelDetayComponent {
  private readonly translation = inject(TranslationService);
  t(key: string): string {
    return this.translation.translate(`FINANS_V2.${key}`);
  }
  readonly permissions = inject(PermissionService);

  readonly panel = input.required<FinansPanel>();
  readonly kayitAc = output<{ tur: FinansVarlikTuru; id: number }>();

  readonly sekme = signal<FinansPanelDetaySekmesi>('projeler');
  readonly para = signal('');
  readonly arama = signal('');
  readonly tumu = signal(false);
  /** Sağdaki proje panelinde açık proje. */
  readonly seciliProje = signal<FinansPanelProjeOzeti | null>(null);

  readonly kategoriAnahtari = kategoriAnahtari;
  readonly siparisKarsilanmaAnahtari = siparisKarsilanmaAnahtari;
  readonly faturaKarsilanmaAnahtari = faturaKarsilanmaAnahtari;

  /** Projenin kalemleri genel aramayla yüklenir: kayıt sekmelerinden biri (Kontrol Paneli dahil). */
  readonly kayitGorunur = computed(() => finansKayitOkunabilir(this.permissions));

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

  /** Kategori satırları; pay iş bedeli üzerinden hesaplanır. */
  readonly kategoriler = computed(() => {
    const satirlar = (this.panel().kategoriOzetleri ?? []).filter((x) => x.paraBirimi === this.para());
    const toplam = satirlar.reduce((a, x) => a + (x.isBedeli ?? 0), 0);
    return satirlar
      .map((x) => ({
        ...x,
        pay: toplam ? ((x.isBedeli ?? 0) / toplam) * 100 : 0,
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
    // Panel yenilenince (dönem değişti) açık proje paneli eski döneme aittir; kapanır.
    effect(() => {
      const kodlar = this.paraKodlari();
      this.panel();
      this.seciliProje.set(null);
      if (!kodlar.includes(untracked(this.para))) this.para.set(kodlar.includes('EUR') ? 'EUR' : (kodlar[0] ?? ''));
    });
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
  seciliMi(p: FinansPanelProjeOzeti): boolean {
    const secili = this.seciliProje();
    return !!secili && this.projeAnahtari(secili) === this.projeAnahtari(p);
  }
  /** Projeye tıklama: sağdaki proje paneli açılır; aynı proje yeniden tıklanırsa kapanır. */
  projeSec(p: FinansPanelProjeOzeti): void {
    if (!this.kayitGorunur()) return;
    this.seciliProje.set(this.seciliMi(p) ? null : p);
  }
}
