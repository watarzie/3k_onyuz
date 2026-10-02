import { AfterViewInit, Component, ElementRef, HostListener, OnDestroy, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

/** Bir ürünün sistemdeki yolculuğu; sıra gerçek iş akışıdır. */
interface LandingAdim {
  anahtar: string;
  baslik: string;
  kisa: string;
  ikon: string;
  ozet: string;
  neOlur: string[];
  kim: string;
  cikti: string[];
}

interface LandingModul {
  baslik: string;
  ikon: string;
  metin: string;
  ton: 'green' | 'cyan' | 'violet' | 'amber' | 'rose';
  genis?: boolean;
  gorsel?: 'grafik' | 'onay' | 'harita' | 'sandik' | 'iz' | 'bildirim';
}

interface LandingRol {
  ad: string;
  ikon: string;
  ozet: string;
  ekranlar: string[];
  isler: string[];
}

const ADIMLAR: LandingAdim[] = [
  {
    anahtar: 'proje',
    baslik: 'Proje & Çeki Listesi',
    kisa: 'Proje',
    ikon: 'ri-file-excel-2-line',
    ozet: 'Excel çeki listesi içe aktarılır; normal, saha ve yedek projelerin ürün omurgası tek seferde oluşur.',
    neOlur: [
      'Çeki listesi Excel’den yüklenir, her satır izlenebilir bir ürüne dönüşür',
      'Revizyonlar fark önizlemesiyle gösterilir ve onaya sunulur',
      'Proje tipi (normal · saha · yedek) sonraki akışı belirler',
    ],
    kim: 'Proje ve planlama',
    cikti: ['Ürün listesi', 'Revizyon geçmişi'],
  },
  {
    anahtar: 'kabul',
    baslik: 'Ürün Kabul · Tedarik Takibi',
    kisa: 'Kabul',
    ikon: 'ri-inbox-archive-line',
    ozet: 'Tedarikçiden gelen ürünler çeki listesiyle karşılaştırılır; geliş durumu, kalite ve süreç adımları ürün bazında izlenir.',
    neOlur: [
      'Tam geldi · eksik geldi · gelmedi durumları tek tabloda',
      'Kalite ve süreç işaretleri, ambar talep formu',
      'Eksik ürün raporu PDF ve Excel olarak hazır',
    ],
    kim: 'Satın alma ve ürün kabul ekibi',
    cikti: ['Eksik raporu', 'Talep formu'],
  },
  {
    anahtar: '3k',
    baslik: '3K · Sandıklama',
    kisa: '3K',
    ikon: 'ri-archive-stack-line',
    ozet: 'Ürünler sandıklara yerleştirilir; konulan, eksik ve kalan miktar her an görünür.',
    neOlur: [
      'Sandık oluştur, ürünü yerleştir, sandığı kapat',
      'Projeden veya tedarikçiden karşılama, toplu taşıma',
      'Sandık lokasyonu ve sahaya aktarım',
    ],
    kim: '3K operasyon ekibi',
    cikti: ['Sandık durum raporu', 'Kapalı sandıklar'],
  },
  {
    anahtar: 'ambalaj',
    baslik: 'Ambalaj Üretimi',
    kisa: 'Ambalaj',
    ikon: 'ri-hammer-line',
    ozet: 'Sandık ölçüleri, çam ihtiyacı (m³) ve üretim planı hazırlanır; fırın partisi kayda geçer.',
    neOlur: [
      'Ölçüsü eksik sandıklar önceden işaretlenir',
      'Üretim formu tek tıkla PDF veya Excel',
      'Planlandı → üretimde → tamamlandı durumu',
    ],
    kim: 'Ambalaj üretimi',
    cikti: ['Üretim formu', 'm³ ihtiyacı'],
  },
  {
    anahtar: 'depo',
    baslik: 'Depo & Stok',
    kisa: 'Depo',
    ikon: 'ri-map-pin-2-line',
    ozet: 'Sandıkların depo lokasyonu ve fazla teslim, iade malzemeler stokta takip edilir.',
    neOlur: [
      'Lokasyon atama ve anlık depo durumu',
      'Fazla teslim ve iade stok kaydı',
      'Proje tipine göre depo sandık raporu',
    ],
    kim: 'Depo ekibi',
    cikti: ['Depo sandık raporu', 'Stok raporu'],
  },
  {
    anahtar: 'sevk',
    baslik: 'Sevkiyat & Saha',
    kisa: 'Sevkiyat',
    ikon: 'ri-truck-line',
    ozet: 'Hazır sandıklar sevk edilir ve proje kilitlenir; geri alma gibi kritik işlemler onaya düşer.',
    neOlur: [
      'Sevkiyat ve sevkiyat geçmişi',
      'Gerçekleşen çeki listesi raporu',
      'Saha eksikleri ve geri alma talepleri onay akışında',
    ],
    kim: 'Sevkiyat ve yönetim',
    cikti: ['Gerçekleşen çeki', 'Sevk kaydı'],
  },
  {
    anahtar: 'finans',
    baslik: 'Finans',
    kisa: 'Finans',
    ikon: 'ri-money-euro-circle-line',
    ozet: 'Üretilen işler finans kaydına dönüşür; PO, fatura, vade ve tahsilat aynı ekranda izlenir.',
    neOlur: [
      'İş kalemleri kendiliğinden oluşur, tarifeyle fiyatlanır',
      'PO ve fatura dağıtımı, ödeme ve vade takibi',
      'Dönemsel panel, detaylı döküm ve raporlar',
    ],
    kim: 'Finans',
    cikti: ['PO ve fatura', 'Finans raporları'],
  },
];

const MODULLER: LandingModul[] = [
  { baslik: '3K Sandıklama', ikon: 'ri-archive-stack-line', metin: 'Ürünleri sandıklara yerleştirin, konulan ve eksik miktarı anlık görün, sandığı tek tıkla kapatın.', ton: 'green', genis: true, gorsel: 'sandik' },
  { baslik: 'Ürün Kabul Takibi', ikon: 'ri-inbox-archive-line', metin: 'Tedarikten gelen ürünler çeki listesiyle eşleşir; eksik, kalite ve süreç ürün bazında.', ton: 'amber' },
  { baslik: 'Ambalaj Üretimi', ikon: 'ri-hammer-line', metin: 'Ölçü, m³ çam ihtiyacı, üretim planı ve fırın partisi.', ton: 'amber' },
  { baslik: 'Finans Yönetimi', ikon: 'ri-line-chart-line', metin: 'İş kayıtları, PO, fatura, vade ve tahsilat; dönemsel panel ve detaylı döküm.', ton: 'cyan', genis: true, gorsel: 'grafik' },
  { baslik: 'İşlem Onay Merkezi', ikon: 'ri-shield-check-line', metin: 'Kritik işlemler onaylanmadan uygulanmaz; her karar gerekçesiyle kayda geçer.', ton: 'violet', gorsel: 'onay' },
  { baslik: 'Depo Durumu', ikon: 'ri-map-pin-2-line', metin: 'Sandık lokasyonları ve depo raporu.', ton: 'cyan', gorsel: 'harita' },
  { baslik: 'Proje Yönetimi', ikon: 'ri-folder-3-line', metin: 'Normal, saha ve yedek projeler; çeki revizyonları.', ton: 'green' },
  { baslik: 'Saha Yönetimi', ikon: 'ri-map-2-line', metin: 'Sahaya aktarılan sandıklar ve saha eksikleri.', ton: 'green' },
  { baslik: 'Stok Modülü', ikon: 'ri-stack-line', metin: 'Fazla teslim ve iade malzemeler.', ton: 'rose' },
  { baslik: 'Rol & Yetki', ikon: 'ri-user-settings-line', metin: 'Ekran, işlem ve alan bazında okuma/yazma yetkisi.', ton: 'violet' },
  { baslik: 'Hareket Geçmişi', ikon: 'ri-history-line', metin: 'Kim, neyi, ne zaman değiştirdi; eski ve yeni değerle.', ton: 'cyan', genis: true, gorsel: 'iz' },
  { baslik: 'Bildirim Merkezi', ikon: 'ri-notification-3-line', metin: 'Onay talepleri ve durum değişiklikleri ilgili kişiye anında düşer.', ton: 'rose', genis: true, gorsel: 'bildirim' },
];

const ROLLER: LandingRol[] = [
  {
    ad: 'Planlama',
    ikon: 'ri-folder-chart-line',
    ozet: 'Projeyi kurar, çeki listesini ve revizyonları yönetir.',
    ekranlar: ['Projeler', 'Çeki listesi ve revizyon geçmişi', 'Eksik raporları'],
    isler: ['Excel’den çeki listesi yükler', 'Revizyon farkını önizleyip onaya sunar', 'Toplu eksik raporu ve talep formu alır'],
  },
  {
    ad: 'Operasyon',
    ikon: 'ri-archive-stack-line',
    ozet: 'Gelen ürünleri kabul eder, sandıklara yerleştirir.',
    ekranlar: ['Ürün kabul takibi', '3K sandık listesi', 'Sandık içerik yönetimi'],
    isler: ['Tam geldi / eksik geldi işaretler', 'Ürünü sandığa koyar, sandığı kapatır', 'Toplu taşıma ve lokasyon atar'],
  },
  {
    ad: 'Ambalaj',
    ikon: 'ri-hammer-line',
    ozet: 'Sandık ölçüsünden üretime kadar ambalajı planlar.',
    ekranlar: ['Ambalaj üretim listesi', 'Üretim planı', 'Özel sandıklar'],
    isler: ['Ölçü eksiklerini tamamlar', 'Üretim formunu PDF/Excel indirir', 'Fırın partisini kaydeder'],
  },
  {
    ad: 'Finans',
    ikon: 'ri-money-euro-circle-line',
    ozet: 'İşleri PO’ya ve faturaya bağlar, tahsilatı izler.',
    ekranlar: ['Finans kontrol paneli', 'Finans iş takibi', 'PO ve faturalar', 'Raporlar'],
    isler: ['PO ve fatura girer, dağıtır', 'Ödeme ve vadeyi işaretler', 'Dönemsel rapor ve önizleme alır'],
  },
  {
    ad: 'Yönetim',
    ikon: 'ri-dashboard-3-line',
    ozet: 'Bütün akışı tek panelden izler, kritik işlemleri onaylar.',
    ekranlar: ['Ana kontrol paneli', 'İşlem onay merkezi', 'Rol ve kullanıcı yönetimi', 'Hareket geçmişi'],
    isler: ['Kritik talepleri onaylar veya gerekçeyle reddeder', 'Rol ve alan yetkilerini belirler', 'Değişiklik izini denetler'],
  },
];

/** Kaydırma sahnesinin pencere başlıkları; sıra ADIMLAR ile aynıdır. */
const SAHNE_BASLIKLARI = [
  'Proje · Çeki listesi içe aktarma',
  'Ürün kabul · Geliş kontrolü',
  '3K · Sandık 12',
  'Ambalaj · Üretim planı',
  'Depo · Lokasyon',
  'Sevkiyat · PA727-03',
  'Finans · PO ve fatura',
];

/**
 * 3K tanıtım sayfası. Akış bölümü kaydırmaya bağlı anlatımdır: metin aşamaları kaydırıldıkça yapışık sahne
 * o aşamanın görselini kurar. Animasyonlar CSS ile çalışır; bileşen yalnız görünürlüğü, etkin aşamayı,
 * kaydırma ilerlemesini ve fare ışığını yönetir.
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
  readonly sahneBasliklari = SAHNE_BASLIKLARI;
  readonly moduller = MODULLER;
  readonly roller = ROLLER;
  readonly yil = new Date().getFullYear();
  readonly modulBandi = [
    'Çeki Listesi', 'Ürün Kabul', '3K Sandıklama', 'Ambalaj Üretimi', 'Depo', 'Sevkiyat', 'Saha',
    'Stok', 'Finans', 'İşlem Onayı', 'Rol & Yetki', 'Hareket Geçmişi',
  ];

  readonly aktifAdim = signal(0);
  readonly aktifRol = signal(0);
  readonly kaydirildi = signal(false);
  readonly ilerleme = signal(0);

  private gozlemci?: IntersectionObserver;
  private adimGozlemcisi?: IntersectionObserver;
  private readonly hareketAzalt =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  ngAfterViewInit(): void {
    const kok = this.host.nativeElement;
    const ogeler = kok.querySelectorAll<HTMLElement>('[data-reveal]');
    if (typeof IntersectionObserver === 'undefined') {
      ogeler.forEach((x) => x.classList.add('is-in'));
      return;
    }
    if (this.hareketAzalt) {
      ogeler.forEach((x) => x.classList.add('is-in'));
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
    }
    // Ekranın ortasındaki ince şeridi kesen aşama etkin olur; sahne ona göre kurulur.
    this.adimGozlemcisi = new IntersectionObserver(
      (girdiler) => {
        for (const girdi of girdiler) {
          if (girdi.isIntersecting) this.aktifAdim.set(Number((girdi.target as HTMLElement).dataset['adim']));
        }
      },
      { rootMargin: '-48% 0px -48% 0px' },
    );
    kok.querySelectorAll<HTMLElement>('[data-adim]').forEach((x) => this.adimGozlemcisi!.observe(x));
    this.kaydirmaDegisti();
  }

  ngOnDestroy(): void {
    this.gozlemci?.disconnect();
    this.adimGozlemcisi?.disconnect();
  }

  @HostListener('window:scroll')
  kaydirmaDegisti(): void {
    const kok = document.documentElement;
    const yukseklik = kok.scrollHeight - kok.clientHeight;
    this.kaydirildi.set(kok.scrollTop > 12);
    this.ilerleme.set(yukseklik > 0 ? Math.min(100, (kok.scrollTop / yukseklik) * 100) : 0);
  }

  /** Sahnedeki aşama noktasına tıklanınca o aşamanın metnine kaydırılır. */
  adimSec(i: number): void {
    const hedef = this.host.nativeElement.querySelector<HTMLElement>(`[data-adim="${i}"]`);
    hedef?.scrollIntoView({ behavior: this.hareketAzalt ? 'auto' : 'smooth', block: 'center' });
  }

  /** Fare ışığı: imlecin konumu CSS değişkeni olarak öğeye yazılır (yalnız görsel). */
  isikTasi(olay: PointerEvent): void {
    const hedef = olay.currentTarget as HTMLElement;
    const kutu = hedef.getBoundingClientRect();
    hedef.style.setProperty('--mx', `${olay.clientX - kutu.left}px`);
    hedef.style.setProperty('--my', `${olay.clientY - kutu.top}px`);
  }

  /** Bento kartları: ışık her kartın kendi koordinatına göre konur. */
  kartIsigi(olay: PointerEvent): void {
    const kapsayici = olay.currentTarget as HTMLElement;
    kapsayici.querySelectorAll<HTMLElement>('.bento-card').forEach((kart) => {
      const kutu = kart.getBoundingClientRect();
      kart.style.setProperty('--mx', `${olay.clientX - kutu.left}px`);
      kart.style.setProperty('--my', `${olay.clientY - kutu.top}px`);
    });
  }
}
