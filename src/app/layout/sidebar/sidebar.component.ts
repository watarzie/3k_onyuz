import {
  afterRenderEffect, ChangeDetectionStrategy, Component, computed, DestroyRef, DOCUMENT, ElementRef, inject, linkedSignal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, PRIMARY_OUTLET, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter, map } from 'rxjs';
import { ToggleService } from '../../core/services/toggle.service';
import { TranslationService } from '../../core/services/translation.service';
import { PermissionService } from '../../core/services/permission.service';
import { YetkiTipi } from '../../core/constants/enums';
import { YETKI } from '../../core/constants/yetki-kodlari';

export interface MenuItem {
  label: string;
  kod: string;
  icon: string;
  route?: string | null;
  yetkiTipiId: number;
  children?: MenuItem[];
}

/** Kenar menünün başlıklı bölümü; başlık yalnız bölümde görünür öğe varsa çizilir. */
export interface MenuBolumu {
  kod: 'operasyon' | 'yonetim';
  baslik: string;
  ogeler: MenuItem[];
}

/** Yönetim başlığını başlatan kök menü kodları (sistem yönetimi ekranları). */
const YONETIM_KODLARI: ReadonlySet<string> = new Set<string>([
  YETKI.HAREKET_GECMISI,
  YETKI.KULLANICILAR,
  YETKI.ROL_YONETIMI,
  YETKI.ONAY.MERKEZI,
]);

/** SCSS'teki masaüstü kırılımıyla aynı: masaüstünde "toggled" menüyü kapatmaz, daraltır. */
const MASAUSTU_SORGUSU = '(min-width: 1200px)';

/**
 * Sunucu sırasını bozmadan menüyü iki bölüme ayırır: ilk görünen yönetim öğesinden önceki her şey
 * Operasyon, o öğeden itibaren Yönetim. Sıra sunucudan geldiği için yeniden sıralama yapılmaz.
 */
export function menuBolumleri(ogeler: readonly MenuItem[]): { operasyon: MenuItem[]; yonetim: MenuItem[] } {
  const sinir = ogeler.findIndex(oge => YONETIM_KODLARI.has(oge.kod));
  return sinir < 0
    ? { operasyon: [...ogeler], yonetim: [] }
    : { operasyon: ogeler.slice(0, sinir), yonetim: ogeler.slice(sinir) };
}

/** Rotayı karşılaştırılabilir yola çevirir: baştaki '/' zorunlu, sorgu ve sondaki '/' atılır. */
function yolBicimi(rota: string): string {
  const yol = rota.split(/[?#]/)[0].replace(/\/+$/, '');
  return yol.startsWith('/') ? yol : `/${yol}`;
}

/**
 * Aktif yolun ait olduğu alt menülü kök öğenin kodu. Detay sayfaları da (ör. /projeler/12) grubunu
 * bulsun diye önek eşleşmesi kullanılır; çakışmada en uzun rota kazanır, düz öğe kazanırsa grup yoktur.
 */
export function aktifGrupKodu(ogeler: readonly MenuItem[], aktifYol: string): string | null {
  const yol = yolBicimi(aktifYol);
  let enIyiKod: string | null = null;
  let enIyiUzunluk = -1;
  for (const oge of ogeler) {
    const grupKod = oge.children?.length ? oge.kod : null;
    const rotalar = [oge.route, ...(oge.children ?? []).map(cocuk => cocuk.route)];
    for (const rota of rotalar) {
      if (!rota) {
        continue;
      }
      const aday = yolBicimi(rota);
      const eslesir = yol === aday || (aday !== '/' && yol.startsWith(`${aday}/`));
      if (eslesir && aday.length > enIyiUzunluk) {
        enIyiKod = grupKod;
        enIyiUzunluk = aday.length;
      }
    }
  }
  return enIyiKod;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarComponent {
  toggleService = inject(ToggleService);
  ts = inject(TranslationService);
  permissionService = inject(PermissionService);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);

  /**
   * Masaüstü kırılımı; bir kez alınır, closeSidebar ve kırılım dinleyicisi aynı nesneyi kullanır.
   * matchMedia olmayan ortamda (SSR) null = mobil. Karma gerçek Chrome'da koştuğu için sonucu pencere
   * genişliği belirler; bu yüzden testler matchMedia'yı taklit etmeli.
   */
  private readonly masaustuSorgusu: MediaQueryList | null =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(MASAUSTU_SORGUSU)
      : null;

  private readonly kapatDugmesi = viewChild<ElementRef<HTMLButtonElement>>('kapatDugmesi');

  /** Mobil menüyü açan öğe (genelde hamburger); Esc/kapat ile kapanınca odak ona döner. */
  private oncekiOdak: HTMLElement | null = null;

  /** Kapanış Esc, kapat düğmesi ya da karartmadan mı geldi; bağlantıyla gezinmede odak yeni sayfada kalır. */
  private odagiGeriVer = false;

  constructor() {
    // Aynı "toggled" bayrağı masaüstünde daraltma, mobilde açık menü demek. Kırılım geçilince sıfırlanmazsa
    // daraltılmış menü küçülen pencerede karartmalı açık gelir (ya da tersi); geçişte varsayılana dönülür.
    const sorgu = this.masaustuSorgusu;
    if (sorgu) {
      const kirilimDegisti = () => {
        if (this.toggleService.isSidebarToggled()) {
          this.toggleService.toggle();
        }
      };
      sorgu.addEventListener('change', kirilimDegisti);
      inject(DestroyRef).onDestroy(() => sorgu.removeEventListener('change', kirilimDegisti));
    }

    // Mobil menü açılınca odak menüye taşınır, kapanınca (Esc/kapat) açan öğeye döner. afterRenderEffect:
    // düz effect şablon yenilenmeden koşar; o an menü hâlâ visibility:hidden olduğundan odak verilemez.
    let acikti = false;
    afterRenderEffect(() => {
      const acik = this.mobilMenuAcik();
      if (acik && !acikti) {
        const odak = this.document.activeElement;
        this.oncekiOdak = odak instanceof HTMLElement && odak !== this.document.body ? odak : null;
        this.kapatDugmesi()?.nativeElement.focus({ preventScroll: true });
      } else if (!acik && acikti) {
        if (this.odagiGeriVer) {
          this.oncekiOdak?.focus({ preventScroll: true });
        }
        this.oncekiOdak = null;
        this.odagiGeriVer = false;
      }
      acikti = acik;
    });
  }

  /**
   * Menü ağacı — TAMAMEN backend'den gelir.
   * PermissionService etkin yetkiye göre sınırlar; burada da N düğümler elenir.
   */
  menu = computed<MenuItem[]>(() => {
    // Signal bağımlılıkları: dil + menü ağacı
    this.ts.currentLang();
    const menuAgaci = this.permissionService.menuAgaci();

    return menuAgaci
      .filter(node => node.yetkiTipiId >= YetkiTipi.R &&
        (node.route || node.children?.some(c => c.yetkiTipiId >= YetkiTipi.R && c.route)))
      .map(node => ({
        label: this.ts.translate(node.labelKey),
        kod: node.kod,
        icon: node.icon || '',
        route: node.route,
        yetkiTipiId: node.yetkiTipiId,
        // Route=null olanları sidebar'da GİZLE (grid-modulu, 3k-modulu gibi). İş listeleri ve Grid Sahası proje
        // listesindeki düğmelerden açılır; sunucu ağacında rotalı kalmış eski kayıt da menüye çıkmaz.
        children: node.children
          ?.filter(child => child.yetkiTipiId >= YetkiTipi.R && !!child.route &&
            child.kod !== YETKI.SANDIK.UCK_IS_LISTESI && child.kod !== YETKI.SANDIK.GRID_IS_LISTESI &&
            child.kod !== YETKI.SANDIK.GRID_SAHA_GORUNUMU)
          .map(child => ({
            label: this.ts.translate(child.labelKey),
            kod: child.kod,
            icon: child.icon || '',
            route: child.route,
            yetkiTipiId: child.yetkiTipiId,
          })),
      }));
  });

  /** Şablondaki sabit metinler; dil değişince yeniden çevrilir. */
  readonly metinler = computed(() => {
    this.ts.currentLang();
    return {
      kenarMenu: this.ts.translate('SIDEBAR.KENAR_MENU'),
      anaMenu: this.ts.translate('SIDEBAR.ANA_MENU'),
      menuyuKapat: this.ts.translate('SIDEBAR.MENUYU_KAPAT'),
      altMenuAcKapat: this.ts.translate('SIDEBAR.ALT_MENU_AC_KAPAT'),
    };
  });

  /** Operasyon ve Yönetim başlıkları; boş bölümün başlığı çizilmez. */
  readonly bolumler = computed<MenuBolumu[]>(() => {
    this.ts.currentLang();
    const { operasyon, yonetim } = menuBolumleri(this.menu());
    const bolumler: MenuBolumu[] = [
      { kod: 'operasyon', baslik: this.ts.translate('SIDEBAR.GRUP_OPERASYON'), ogeler: operasyon },
      { kod: 'yonetim', baslik: this.ts.translate('SIDEBAR.GRUP_YONETIM'), ogeler: yonetim },
    ];
    return bolumler.filter(bolum => bolum.ogeler.length > 0);
  });

  /** Son tamamlanan gezinmenin adresi; aktif grubu Router olaylarından türetmek için. */
  private readonly aktifUrl = toSignal(
    this.router.events.pipe(
      filter((olay): olay is NavigationEnd => olay instanceof NavigationEnd),
      map(olay => olay.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  /** Sorgu, parça ve matris parametreleri olmadan aktif yol. */
  private readonly aktifYol = computed(() => this.yolu(this.aktifUrl()));

  /** Aktif rotayı içeren grup; üst öğe hafif vurgulanır. */
  readonly aktifGrupKod = computed(() => aktifGrupKodu(this.menu(), this.aktifYol()));

  /**
   * Açık alt menü (tek akordeon, kod ile tutulur ki izin yenilemesinde sıra değişse de doğru grup açık kalsın).
   * Aktif rotanın grubu değişince o grup açılır; aynı grupta gezinirken kullanıcının kapattığı grup kapalı kalır,
   * grubu olmayan sayfaya geçişte kullanıcının seçimi korunur.
   */
  readonly acikGrupKod = linkedSignal<string | null, string | null>({
    source: this.aktifGrupKod,
    computation: (aktif, onceki) => aktif ?? onceki?.value ?? null,
  });

  toggleSection(kod: string): void {
    this.acikGrupKod.update(acik => (acik === kod ? null : kod));
  }

  altMenuId(kod: string): string {
    return `km-alt-${kod}`;
  }

  acKapatEtiketi(etiket: string): string {
    return this.metinler().altMenuAcKapat.replace('{grup}', etiket);
  }

  /**
   * Düz kök bağlantının aria-current değeri (RouterLinkActive yalnız bağlantı etkinken yazar): rota birebir
   * açıksa "page", yalnız alt yolu açıksa (ör. /sandik-yonetimi/12) "true"; üst bağlantı detay sayfasında
   * "geçerli sayfa" diye duyurulmasın.
   */
  kokAriaCurrent(rota: string | null | undefined): 'page' | true {
    return rota != null && yolBicimi(rota) === this.aktifYol() ? 'page' : true;
  }

  closeSidebar(): void {
    // Masaüstünde "toggled" menünün daraltılmış (ikon) hâlidir; bağlantı tıklaması onu geri açmasın.
    // Mobilde ekran dışı menüyü kapatır (önceki davranış).
    if (this.mobilMenuAcik()) {
      this.toggleService.toggle();
    }
  }

  /** Kapat düğmesi ve karartma: closeSidebar ile aynı, ek olarak odak menüyü açan öğeye döner. */
  menuyuKapat(): void {
    this.odagiGeriVer = this.mobilMenuAcik();
    this.closeSidebar();
  }

  /** Esc yalnız mobil açılır menüyü kapatır; masaüstünde daraltma durumuna dokunmaz. */
  escIleKapat(): void {
    if (this.mobilMenuAcik()) {
      this.menuyuKapat();
    }
  }

  /** Mobil açılır menü açık mı; masaüstünde "toggled" daraltma demektir, sayılmaz. matchMedia yoksa mobil. */
  private mobilMenuAcik(): boolean {
    return this.toggleService.isSidebarToggled() && !this.masaustuSorgusu?.matches;
  }

  /** Sorgu, parça ve matris parametreleri olmadan birincil çıkışın yolu. */
  private yolu(url: string): string {
    const segmentler = this.router.parseUrl(url).root.children[PRIMARY_OUTLET]?.segments ?? [];
    return `/${segmentler.map(segment => segment.path).join('/')}`;
  }
}
