import { AfterViewInit, Component, ElementRef, HostListener, OnDestroy, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

/**
 * Sayfadaki şirket bilgileri 3kambalaj.com'daki kurumsal, hizmet ve ürün sayfalarından alınmıştır; müşteriye özel
 * iş akışları (ürün kabul, PO, talep formu, saha gibi) bilerek anlatılmaz. Sayfa 3K'nın genel işini tanıtır.
 */

/** Bir sandığın tesisteki yolculuğu; sıra gerçek iş sırasıdır. */
interface LandingAdim {
  anahtar: string;
  baslik: string;
  ikon: string;
  ozet: string;
  maddeler: string[];
  etiketler: string[];
  sahne: string;
}

/** Çalışma biçimi: 3K'nın işin hangi adımlarını üstlendiği (3kambalaj.com hizmet modelleri). */
interface LandingCalismaBicimi {
  ad: string;
  ikon: string;
  baslik: string;
  ozet: string;
  adimlar: { ikon: string; ad: string }[];
}

/** Ürün kartındaki küçük sandık/palet çiziminin dokusu. */
type UrunDokusu = 'kapali' | 'kafes' | 'kontrplak' | 'osb' | 'katlanir' | 'menteseli' | 'klipsli' | 'ozel' | 'palet' | 'palet-kontrplak' | 'palet-ozel';

interface LandingUrun {
  ad: string;
  metin: string;
  doku: UrunDokusu;
}

interface LandingSayac {
  hedef: number;
  onek?: string;
  sonek: string;
  etiket: string;
  /** Sayı biçimlenmeden yazılır (yıl gibi). */
  yalin?: boolean;
}

const KURULUS_YILI = 1993;

const ADIMLAR: LandingAdim[] = [
  {
    anahtar: 'tasarim',
    baslik: 'Proje Tasarımı',
    ikon: 'ri-ruler-2-line',
    ozet: 'Ürünün ölçüsü, ağırlığı ve gideceği yol birlikte değerlendirilir; sandık ürüne göre tasarlanır.',
    maddeler: ['Ürün boyutları ve ağırlığı alınır', 'Sevk aracı ve yükleme şekli belirlenir', 'Sandık tipi ve iç sabitleme tasarlanır'],
    etiketler: ['Ölçüye özel', 'Teknik çizim'],
    sahne: 'Tasarım · Sandık ölçüleri',
  },
  {
    anahtar: 'uretim',
    baslik: 'Tomruktan Sandığa Üretim',
    ikon: 'ri-hammer-line',
    ozet: 'Tomruk biçim hattı ve tam otomatik üretim hattı aynı tesiste; kereste de sandık da kendi elimizden çıkar.',
    maddeler: ['Tomruk kendi hattımızda biçilir', 'Tam otomatik makine parkurunda üretim', 'Kapalı, kafes, kontrplak, OSB ve özel sandık'],
    etiketler: ['2 entegre hat', 'Tam otomatik'],
    sahne: 'Üretim · Biçim hattı',
  },
  {
    anahtar: 'ispm',
    baslik: 'ISPM-15 Isıl İşlem',
    ikon: 'ri-temp-hot-line',
    ozet: 'Uluslararası sevkiyat için ahşap ISPM-15 standardında ısıl işlemden geçirilir ve damgalanır.',
    maddeler: ['Ahşabın çekirdeğinde 56 °C, en az 30 dakika', 'İşlem sonrası ISPM-15 damgası', 'Yurt içi ve yurt dışı sevkiyata uygun'],
    etiketler: ['ISPM-15', 'Isıl işlem (HT)'],
    sahne: 'Isıl işlem · Fırın',
  },
  {
    anahtar: 'sandiklama',
    baslik: 'Sandıklama ve Montaj',
    ikon: 'ri-archive-stack-line',
    ozet: 'Ürün uzman personelin gözetiminde sandığa yerleştirilir ve sabitlenir; nem ve darbeye karşı korunur.',
    maddeler: ['Ürün sandığa yerleştirilip sabitlenir', 'Nem alıcı uygulanır', 'Alüminyum folyo ile vakumlanır, sandık kapatılır'],
    etiketler: ['Nem alıcı', 'Vakumlu folyo'],
    sahne: 'Sandıklama · Montaj',
  },
  {
    anahtar: 'depo',
    baslik: 'Güvenli Depolama',
    ikon: 'ri-store-3-line',
    ozet: 'Ambalajlanan ürünler sahanızdan alınıp güvenlikli depolarımıza taşınır; sevk tarihine kadar sigortalı korunur.',
    maddeler: ['Sahanızdan depomuza sevk', 'Sigortalı depolama', 'Her sandığın yeri sistemde izlenir'],
    etiketler: ['DepoFix', 'Sigortalı'],
    sahne: 'Depo · Lokasyon',
  },
  {
    anahtar: 'sevk',
    baslik: 'Yükleme ve Liman Teslimi',
    ikon: 'ri-ship-2-line',
    ozet: 'Sevk tarihi geldiğinde sandıklar yüklenir; sevkiyat sigortalanır ve ürün limana teslim edilir.',
    maddeler: ['Sevk aracına uygun yükleme', 'Sevkiyatların sigortalanması', 'Liman teslimi'],
    etiketler: ['Yükleme', 'Liman teslimi'],
    sahne: 'Sevkiyat · Liman',
  },
];

const CALISMA_BICIMLERI: LandingCalismaBicimi[] = [
  {
    ad: 'Standart',
    ikon: 'ri-tools-line',
    baslik: 'Ürününüzü uzman ekibimiz sandıklar',
    ozet: 'Ürün, uzman personelin gözetiminde sandık içerisine yerleştirilir ve sabitlenir. Ölçüden yüklemeye kadar her adım ürünün kendisine göre planlanır.',
    adimlar: [
      { ikon: 'ri-ruler-2-line', ad: 'Ürün ölçüsü ve sevk aracı' },
      { ikon: 'ri-draft-line', ad: 'Sandık tasarımı' },
      { ikon: 'ri-anchor-line', ad: 'Yerleştirme ve sabitleme' },
      { ikon: 'ri-drop-line', ad: 'Nem alıcı ve vakumlu folyo' },
      { ikon: 'ri-truck-line', ad: 'Yükleme' },
    ],
  },
  {
    ad: 'Pro',
    ikon: 'ri-team-line',
    baslik: 'Ekibimiz fabrikanızda sizinle çalışır',
    ozet: 'Fabrikanızda düzenli olarak kalacak yeterli sayıda personel istihdam edilir. Projelendirme ve sevk sürecinin tamamı bu ekip tarafından yürütülür.',
    adimlar: [
      { ikon: 'ri-team-line', ad: 'Fabrikanızda kalıcı ekip' },
      { ikon: 'ri-draft-line', ad: 'Projelendirme' },
      { ikon: 'ri-archive-stack-line', ad: 'Sandıklama' },
      { ikon: 'ri-umbrella-line', ad: 'Sigorta ve malzeme temini' },
      { ikon: 'ri-truck-line', ad: 'Sevk süreci' },
    ],
  },
  {
    ad: 'DepoFix',
    ikon: 'ri-store-3-line',
    baslik: 'Sandıklı ürününüzü depolar, limana teslim ederiz',
    ozet: 'Sahanızda ambalajlanan ürünler güvenlikli depolarımıza taşınır ve sigortalı tutulur. Sevk tarihi geldiğinde yüklenir ve limana teslim edilir.',
    adimlar: [
      { ikon: 'ri-truck-line', ad: 'Sahanızdan teslim alma' },
      { ikon: 'ri-store-3-line', ad: 'Güvenlikli depo' },
      { ikon: 'ri-umbrella-line', ad: 'Sigortalı bekleme' },
      { ikon: 'ri-calendar-check-line', ad: 'Sevk tarihinde yükleme' },
      { ikon: 'ri-ship-2-line', ad: 'Liman teslimi' },
    ],
  },
];

const SANDIKLAR: LandingUrun[] = [
  { ad: 'Tam Kapalı İhracat Sandığı', metin: 'Ağır ekipman, araç ve makine parçaları için dayanıklı çözüm.', doku: 'kapali' },
  { ad: 'Kafes Sandık', metin: 'Yarı kapalı tasarım; ürünün havalanmasını sağlar.', doku: 'kafes' },
  { ad: 'Kontrplak Sandık', metin: 'Sudan etkilenmez; deniz aşırı sevkiyatlarda tercih edilir.', doku: 'kontrplak' },
  { ad: 'OSB Sandık', metin: 'Hafif yapısıyla taşıma maliyetini düşürür.', doku: 'osb' },
  { ad: 'Katlanır Sandık', metin: 'Tekrar kullanılabilir; Avrupa pazarında yaygın.', doku: 'katlanir' },
  { ad: 'Menteşeli Sandık', metin: 'Kolayca açılıp kapanır, istiflenebilir.', doku: 'menteseli' },
  { ad: 'Klipsli Sandık', metin: 'Montajı ve demontajı kolay depo çözümü.', doku: 'klipsli' },
  { ad: 'Özel Sandık', metin: 'İhtiyacınıza göre tasarlanan modeller.', doku: 'ozel' },
];

const PALETLER: LandingUrun[] = [
  { ad: 'Ahşap Palet', metin: 'Endüstriyel taşıma için dayanıklı platform.', doku: 'palet' },
  { ad: 'Kontrplak Palet', metin: 'ISPM-15 sertifikası gerektirmez.', doku: 'palet-kontrplak' },
  { ad: 'Özel Palet', metin: 'Ürününüze göre özelleştirilmiş tasarım.', doku: 'palet-ozel' },
];

/** Kaydırdıkça kelime kelime koyulaşan tanıtım cümlesi; vurgulu parçalar yeşil yazılır. */
const MANIFESTO: [string, boolean][] = [
  [`${KURULUS_YILI}'te İstanbul'da başlayan yolculuğumuz bugün Derince'deki`, false],
  ['9.000 m²', true],
  ['tesisimizde sürüyor. Tomruğu kendi hattımızda biçiyor, sandığı', false],
  ['ürününüzün ölçüsüne göre', true],
  ['tasarlıyor,', false],
  ['ISPM-15', true],
  ['standardında ısıl işlemden geçiriyor ve ürününüzü', false],
  ['limana teslim edilene kadar', true],
  ['koruyoruz.', false],
];

/** Platform bölümü: müşteriden bağımsız, 3K'nın kendi operasyonunu izleyen yetenekler. */
const OZELLIKLER = [
  { ikon: 'ri-archive-stack-line', baslik: 'Sandık bazında takip', metin: 'Her sandığın içeriği, ölçüsü ve durumu tek ekranda.' },
  { ikon: 'ri-ruler-2-line', baslik: 'Ambalaj üretim planı', metin: 'Ölçü, m³ ihtiyacı ve üretim formu hazır.' },
  { ikon: 'ri-map-pin-2-line', baslik: 'Depo ve lokasyon', metin: 'Sandığın hangi rafta olduğu her an bilinir.' },
  { ikon: 'ri-truck-line', baslik: 'Sevkiyat kaydı', metin: 'Yüklenen sandıklar ve sevkiyat geçmişi.' },
  { ikon: 'ri-shield-check-line', baslik: 'Onaylı kritik işlemler', metin: 'Kritik değişiklik onaysız uygulanmaz, iz bırakır.' },
  { ikon: 'ri-file-chart-line', baslik: 'PDF · Excel raporlar', metin: 'Sandık, depo ve üretim raporları tek tıkla.' },
];

/** Uygulama penceresindeki örnek satırlar (görsel); ilk satır aşamaları döngüyle gezer. */
const CANLI_DURUMLAR = ['Tasarım', 'Üretimde', 'Isıl işlem', 'Sandıklandı', 'Depoda', 'Sevk edildi'];
const TAKIP_SATIRLARI = [
  { no: 'SND-0139', tip: 'Kontrplak sandık', oran: 66, durum: 'Sandıklandı', ton: 'mavi' },
  { no: 'SND-0135', tip: 'Kafes sandık', oran: 83, durum: 'Depoda · B-2', ton: 'mavi' },
  { no: 'SND-0128', tip: 'Özel sandık', oran: 100, durum: 'Sevk edildi', ton: 'yesil' },
];

/** Şirket konumu ve iletişim: Google Haritalar işletme kaydı ve 3kambalaj.com iletişim sayfası. */
const KONUM = {
  ad: '3K Ahşap Ambalaj',
  unvan: 'Üç Kardeşler İnşaat Kerestecilik Ltd. Şti.',
  adres: 'Fatih Sultan Mah., 41100 Derince / Kocaeli',
  telefon: '(0262) 223 28 75',
  telefonBaglanti: '+902622232875',
  eposta: 'info@3kambalaj.com',
  web: '3kambalaj.com',
  webAdresi: 'https://3kambalaj.com',
  saatler: 'Hafta içi 08:00 – 17:00 · Cumartesi 08:00 – 12:30',
  haritaBaglantisi: 'https://maps.google.com/?cid=15525171436395750926',
  yolTarifi: 'https://www.google.com/maps/dir/?api=1&destination=40.7681914,29.8178164',
} as const;

/**
 * 3K tanıtım sayfası. Süreç bölümü kaydırmaya bağlı anlatımdır: metin aşamaları kaydırıldıkça yapışık sahne o
 * aşamanın çizimini kurar. Animasyonlar CSS ile çalışır; bileşen yalnız görünürlüğü, etkin aşamayı, kaydırma
 * ilerlemesini, sayaçları ve kahraman sandığın yeniden kurulmasını yönetir.
 */
@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
})
export class LandingComponent implements AfterViewInit, OnDestroy {
  readonly auth = inject(AuthService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly adimlar = ADIMLAR;
  readonly calismaBicimleri = CALISMA_BICIMLERI;
  readonly ozellikler = OZELLIKLER;
  readonly canliDurumlar = CANLI_DURUMLAR;
  readonly takipSatirlari = TAKIP_SATIRLARI;
  readonly konum = KONUM;
  readonly yil = new Date().getFullYear();
  readonly manifesto = MANIFESTO.flatMap(([metin, vurgu]) => metin.split(' ').map((kelime) => ({ kelime, vurgu })));
  readonly urunBandi = [...SANDIKLAR, ...PALETLER].map((x) => x.ad);
  readonly sayaclar: LandingSayac[] = [
    { hedef: new Date().getFullYear() - KURULUS_YILI, sonek: '+', etiket: 'yıllık tecrübe' },
    { hedef: 9000, sonek: ' m²', etiket: 'üretim ve depolama alanı' },
    { hedef: 2, sonek: '', etiket: 'entegre üretim hattı' },
    { hedef: 15, onek: 'ISPM-', sonek: '', etiket: 'standardında ısıl işlem', yalin: true },
  ];
  /** Kahraman bölümündeki süzülen talaş taneleri: konum, boy ve gecikme sabittir (rastgele değil). */
  readonly talaslar = Array.from({ length: 14 }, (_, i) => ({
    x: (i * 37 + 11) % 100,
    boy: 3 + (i % 4) * 2,
    sure: 14 + (i % 5) * 3,
    gecikme: -((i * 2.3) % 16),
  }));

  readonly aktifAdim = signal(0);
  readonly aktifBicim = signal(0);
  readonly kaydirildi = signal(false);
  readonly ilerleme = signal(0);
  readonly manifestoIlerleme = signal(0);
  /** Artınca kahraman sandığı DOM'dan çıkıp yeniden girer; böylece kurulum animasyonu baştan oynar. */
  readonly kurulum = signal(0);

  private gozlemci?: IntersectionObserver;
  private adimGozlemcisi?: IntersectionObserver;
  private sayacGozlemcisi?: IntersectionObserver;
  private readonly hareketAzalt =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  ngAfterViewInit(): void {
    const kok = this.host.nativeElement;
    const ogeler = kok.querySelectorAll<HTMLElement>('[data-reveal]');
    const sayaclar = kok.querySelectorAll<HTMLElement>('[data-sayac]');
    if (typeof IntersectionObserver === 'undefined' || this.hareketAzalt) {
      ogeler.forEach((x) => x.classList.add('is-in'));
      sayaclar.forEach((x) => this.sayacYaz(x, 1));
      if (typeof IntersectionObserver === 'undefined') return;
    } else {
      this.gozlemci = new IntersectionObserver(
        (girdiler) => {
          for (const girdi of girdiler) {
            if (!girdi.isIntersecting) continue;
            girdi.target.classList.add('is-in');
            this.gozlemci?.unobserve(girdi.target);
          }
        },
        { threshold: 0.14, rootMargin: '0px 0px -40px 0px' },
      );
      ogeler.forEach((x) => this.gozlemci!.observe(x));

      this.sayacGozlemcisi = new IntersectionObserver(
        (girdiler) => {
          for (const girdi of girdiler) {
            if (!girdi.isIntersecting) continue;
            this.sayacGozlemcisi?.unobserve(girdi.target);
            this.sayacOynat(girdi.target as HTMLElement);
          }
        },
        { threshold: 0.6 },
      );
      sayaclar.forEach((x) => {
        this.sayacYaz(x, 0);
        this.sayacGozlemcisi!.observe(x);
      });
    }
    // Metni ekrandaki ince şeridi kesen aşama etkin olur. Masaüstünde şerit ve yapışık sahne ekranın ortasındadır,
    // böylece etkin metin sahnesiyle yan yana gelir; dar ekranda sahne üstte durduğu için şerit sahnenin altındadır.
    // Metinler arası boşlukta önceki aşama korunur.
    const serit = Math.round(this.adimSeridi() * 100);
    this.adimGozlemcisi = new IntersectionObserver(
      (girdiler) => {
        for (const girdi of girdiler) {
          if (girdi.isIntersecting) this.aktifAdim.set(Number((girdi.target as HTMLElement).dataset['adim']));
        }
      },
      { rootMargin: `-${serit - 2}% 0px -${100 - serit - 2}% 0px` },
    );
    kok.querySelectorAll<HTMLElement>('[data-adim]').forEach((x) => this.adimGozlemcisi!.observe(x));
    this.kaydirmaDegisti();
  }

  ngOnDestroy(): void {
    this.gozlemci?.disconnect();
    this.adimGozlemcisi?.disconnect();
    this.sayacGozlemcisi?.disconnect();
  }

  @HostListener('window:scroll')
  @HostListener('window:resize')
  kaydirmaDegisti(): void {
    const kok = document.documentElement;
    const yukseklik = kok.scrollHeight - kok.clientHeight;
    this.kaydirildi.set(kok.scrollTop > 12);
    this.ilerleme.set(yukseklik > 0 ? Math.min(100, (kok.scrollTop / yukseklik) * 100) : 0);

    // Tanıtım cümlesi ekranın altına girdiğinde koyulaşmaya başlar, ekranın üst üçte birine varınca tamamlanır.
    const manifesto = this.host.nativeElement.querySelector<HTMLElement>('.manifesto__metin');
    if (manifesto) {
      const kutu = manifesto.getBoundingClientRect();
      const baslangic = window.innerHeight * 0.88;
      const bitis = window.innerHeight * 0.3;
      const oran = (baslangic - kutu.top) / (baslangic - bitis + kutu.height * 0.6);
      this.manifestoIlerleme.set(this.hareketAzalt ? 1 : Math.max(0, Math.min(1, oran)));
    }
  }

  /** Aşama numarasına tıklanınca o aşamanın metni etkinleştiği şeride kaydırılır. */
  adimSec(i: number): void {
    const hedef = this.host.nativeElement.querySelector<HTMLElement>(`[data-adim="${i}"]`);
    if (!hedef) return;
    const kutu = hedef.getBoundingClientRect();
    const top = window.scrollY + kutu.top + kutu.height / 2 - window.innerHeight * this.adimSeridi();
    window.scrollTo({ top, behavior: this.hareketAzalt ? 'auto' : 'smooth' });
  }

  /** Sıra numarası iki haneli yazılır: 01, 02… */
  sira(i: number): string {
    return String(i + 1).padStart(2, '0');
  }

  sandigiYenidenKur(): void {
    this.kurulum.update((x) => x + 1);
  }

  /** Aşama şeridinin ekran yüksekliğine oranı; SCSS'teki 820px kırılımıyla aynıdır. */
  private adimSeridi(): number {
    return window.matchMedia?.('(max-width: 820px)').matches ? 0.72 : 0.5;
  }

  private sayacOynat(oge: HTMLElement): void {
    const sure = 1600;
    const baslangic = performance.now();
    const adim = (simdi: number) => {
      const t = Math.min(1, (simdi - baslangic) / sure);
      this.sayacYaz(oge, 1 - Math.pow(1 - t, 3));
      if (t < 1) requestAnimationFrame(adim);
    };
    requestAnimationFrame(adim);
  }

  private sayacYaz(oge: HTMLElement, oran: number): void {
    const hedef = Number(oge.dataset['sayac']);
    const deger = Math.round(hedef * oran);
    oge.textContent = oge.dataset['yalin'] === 'true' ? String(deger) : deger.toLocaleString('tr-TR');
  }
}
