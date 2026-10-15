import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { TranslationService } from '../../core/services/translation.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

/** Akış bölümündeki bir aşama; sıra gerçek iş akışıdır. */
interface AkisAdimi {
  readonly no: string;
  readonly ikon: string;
  readonly baslik: string;
  readonly metin: string;
}

interface Guvence {
  readonly ikon: string;
  readonly anahtar: string;
}

/** Üst çubuktaki ve hero'daki birincil bağlantı: oturuma göre giriş ekranı ya da panel. */
interface BirincilEylem {
  readonly rota: string;
  readonly ikon: string;
  readonly kisa: string;
  readonly uzun: string;
}

const AKIS_ADIMLARI: readonly AkisAdimi[] = [
  {
    no: '01',
    ikon: 'ri-file-list-3-line',
    baslik: 'LANDING.FLOW.STEPS.PROJECT.TITLE',
    metin: 'LANDING.FLOW.STEPS.PROJECT.TEXT',
  },
  {
    no: '02',
    ikon: 'ri-archive-line',
    baslik: 'LANDING.FLOW.STEPS.CRATING.TITLE',
    metin: 'LANDING.FLOW.STEPS.CRATING.TEXT',
  },
  {
    no: '03',
    ikon: 'ri-hammer-line',
    baslik: 'LANDING.FLOW.STEPS.PACKAGING.TITLE',
    metin: 'LANDING.FLOW.STEPS.PACKAGING.TEXT',
  },
  {
    no: '04',
    ikon: 'ri-building-2-line',
    baslik: 'LANDING.FLOW.STEPS.WAREHOUSE.TITLE',
    metin: 'LANDING.FLOW.STEPS.WAREHOUSE.TEXT',
  },
  {
    no: '05',
    ikon: 'ri-truck-line',
    baslik: 'LANDING.FLOW.STEPS.SHIPMENT.TITLE',
    metin: 'LANDING.FLOW.STEPS.SHIPMENT.TEXT',
  },
  {
    no: '06',
    ikon: 'ri-line-chart-line',
    baslik: 'LANDING.FLOW.STEPS.FINANCE.TITLE',
    metin: 'LANDING.FLOW.STEPS.FINANCE.TEXT',
  },
];

// "Alan bazlı yetki" bilerek yok: Finans'ta alan maskesi kalktığı için artık doğru bir iddia değil.
const GUVENCELER: readonly Guvence[] = [
  { ikon: 'ri-shield-check-line', anahtar: 'LANDING.HERO.TRUST.TWO_FACTOR' },
  { ikon: 'ri-checkbox-circle-line', anahtar: 'LANDING.HERO.TRUST.APPROVALS' },
  { ikon: 'ri-user-settings-line', anahtar: 'LANDING.HERO.TRUST.ROLES' },
  { ikon: 'ri-file-chart-line', anahtar: 'LANDING.HERO.TRUST.REPORTS' },
];

/** Örnek paneldeki haftalık hacim çubukları (yüzde yükseklik). Yalnız görseldir, gerçek veri değildir. */
const HAFTALIK_CUBUKLAR = [
  { no: 1, yukseklik: 44 },
  { no: 2, yukseklik: 60 },
  { no: 3, yukseklik: 52 },
  { no: 4, yukseklik: 72 },
  { no: 5, yukseklik: 64 },
  { no: 6, yukseklik: 82 },
  { no: 7, yukseklik: 100 },
] as const;

/** Şirket bilgileri: Google Haritalar'daki işletme kaydı (3K AHŞAP AMBALAJ, Derince/Kocaeli). */
const KONUM = {
  ad: '3K Ahşap Ambalaj',
  unvan: 'Üç Kardeşler İnşaat Kerestecilik Ltd. Şti.',
  adres: 'Fatih Sultan Mah., 41100 Derince / Kocaeli',
  telefon: '(0262) 223 28 75',
  telefonBaglanti: '+902622232875',
  webAdresi: 'https://3kambalaj.com/',
  haritaBaglantisi: 'https://maps.google.com/?cid=15525171436395750926',
} as const;

const DILLER = [
  { kod: 'tr', etiket: 'TR' },
  { kod: 'en', etiket: 'EN' },
] as const;

const GIRIS_EYLEMI: BirincilEylem = {
  rota: '/auth/login',
  ikon: 'ri-login-circle-line',
  kisa: 'LANDING.CTA.LOGIN_SHORT',
  uzun: 'LANDING.CTA.LOGIN',
};

const PANEL_EYLEMI: BirincilEylem = {
  rota: '/dashboard',
  ikon: 'ri-dashboard-line',
  // Üst çubukta kısa etiket: dar ekranda (320px, EN) uzun metin düğmeyi taşırır.
  kisa: 'LANDING.CTA.DASHBOARD_SHORT',
  uzun: 'LANDING.CTA.DASHBOARD',
};

/**
 * 3K tanıtım sayfası: üst çubuk, hero, altı adımlı akış, kurumsal siteye yönlendirme ve alt bilgi.
 * Ziyaretçiyi az bilgiyle girişe ya da kurumsal siteye taşır; ayrıntı kurumsal sitededir.
 */
@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingComponent {
  private readonly auth = inject(AuthService);
  readonly ceviri = inject(TranslationService);

  readonly adimlar = AKIS_ADIMLARI;
  readonly guvenceler = GUVENCELER;
  readonly cubuklar = HAFTALIK_CUBUKLAR;
  readonly diller = DILLER;
  readonly konum = KONUM;
  readonly telefonHref = `tel:${KONUM.telefonBaglanti}`;
  readonly yil = new Date().getFullYear();

  /** Oturum açıksa ziyaretçi panele, değilse giriş ekranına yönlenir; metin ve ikon da buna uyar. */
  readonly birincil = computed(() => (this.auth.isLoggedIn() ? PANEL_EYLEMI : GIRIS_EYLEMI));
  readonly kaydirildi = signal(false);

  private readonly akisBolumu = viewChild.required<ElementRef<HTMLElement>>('akisBolumu');
  private readonly akisBasligi = viewChild.required<ElementRef<HTMLElement>>('akisBasligi');

  constructor() {
    // Üst çubuk gölgesi için kaydırma zone dışında dinlenir: her olay değişiklik denetimi başlatmaz,
    // yalnız eşik geçilince sinyal değişir (header bileşenindeki kalıp).
    const kaydirmaDegisti = () => {
      const kaydi = window.scrollY > 8;
      if (kaydi !== this.kaydirildi()) this.kaydirildi.set(kaydi);
    };
    kaydirmaDegisti();
    inject(NgZone).runOutsideAngular(() =>
      window.addEventListener('scroll', kaydirmaDegisti, { passive: true }),
    );
    inject(DestroyRef).onDestroy(() => window.removeEventListener('scroll', kaydirmaDegisti));
  }

  dilSec(dil: string): void {
    this.ceviri.switchLanguage(dil);
  }

  /**
   * "Akışı İncele": akış bölümüne kaydırır ve odağı bölüm başlığına taşır; klavye kullanıcısı
   * sekme sırasına oradan devam eder. Hareket azaltma tercihinde kaydırma anlıktır.
   * Değiştirici tuşlu ya da sol tık dışı tıklama bağlantının olağan davranışına bırakılır (yeni sekme vb.).
   */
  akisaGit(olay: MouseEvent): void {
    if (olay.button !== 0 || olay.ctrlKey || olay.metaKey || olay.shiftKey || olay.altKey) return;
    olay.preventDefault();
    const hareketAzalt = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    this.akisBolumu().nativeElement.scrollIntoView({
      behavior: hareketAzalt ? 'auto' : 'smooth',
      block: 'start',
    });
    this.akisBasligi().nativeElement.focus({ preventScroll: true });
  }
}
