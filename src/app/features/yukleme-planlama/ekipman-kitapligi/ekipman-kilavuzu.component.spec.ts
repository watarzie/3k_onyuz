import { TestBed } from '@angular/core/testing';
import { Route, Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../../app.routes';
import { YETKI } from '../../../core/constants/yetki-kodlari';
import { menuGuard } from '../../../core/guards/menu.guard';
import { EKIPMAN_KILAVUZU_YOLU, KILAVUZ_BOLUMLERI } from '../ortak/ekipman-kilavuzu-bolumleri';
import { EkipmanKilavuzuComponent } from './ekipman-kilavuzu.component';

describe('EkipmanKilavuzuComponent', () => {
  let harness: RouterTestingHarness;
  let kaydirilan: string[];

  /** Sayfayı gerçek adresiyle (isteğe bağlı çapayla) açar; kaydırılan bölümler `kaydirilan` listesine düşer. */
  async function ac(capa = ''): Promise<HTMLElement> {
    kaydirilan = [];
    spyOn(Element.prototype, 'scrollIntoView').and.callFake(function (this: Element) {
      kaydirilan.push(this.id);
    });
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: EKIPMAN_KILAVUZU_YOLU.slice(1), component: EkipmanKilavuzuComponent }])],
    });
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(EKIPMAN_KILAVUZU_YOLU + capa, EkipmanKilavuzuComponent);
    await harness.fixture.whenStable();
    return harness.routeNativeElement!;
  }

  const metin = (oge: Element | null) => oge?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  it('başlığı, breadcrumb yolunu ve on altı bölümü çapalarıyla çizer; içindekiler her bölüme gider', async () => {
    const kok = await ac();
    expect(metin(kok.querySelector('h2'))).toBe('Ekipman Kitaplığı Kılavuzu');
    expect([...kok.querySelectorAll('.breadcrumb-item')].map(metin)).toEqual(['Ana Kontrol Paneli', 'Ekipman Kitaplığı', 'Kılavuz']);
    expect(kok.querySelector<HTMLAnchorElement>('.breadcrumb-item:nth-child(2) a')!.getAttribute('href')).toBe('/ekipman-kitapligi');

    expect(KILAVUZ_BOLUMLERI.map((b) => b.no)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
    const bolumler = [...kok.querySelectorAll<HTMLElement>('section.kl-bolum')];
    expect(bolumler.map((b) => b.id)).toEqual(KILAVUZ_BOLUMLERI.map((b) => b.id));
    expect(new Set(bolumler.map((b) => b.id)).size).toBe(16);
    for (const [i, b] of KILAVUZ_BOLUMLERI.entries()) {
      // Bölüm kendi h3 başlığıyla adlandırılır; başlık numara + ad taşır.
      const baslik = bolumler[i].querySelector('h3')!;
      expect(bolumler[i].getAttribute('aria-labelledby')).toBe(baslik.id);
      expect(metin(baslik)).toContain(`${b.no}${b.baslik}`);
    }

    const icindekiler = [...kok.querySelectorAll<HTMLAnchorElement>('.kl-icindekiler ol a')];
    expect(icindekiler.map(metin)).toEqual(KILAVUZ_BOLUMLERI.map((b) => b.baslik));
    expect(icindekiler.map((a) => a.getAttribute('href'))).toEqual(KILAVUZ_BOLUMLERI.map((b) => `${EKIPMAN_KILAVUZU_YOLU}#${b.id}`));
    // Bu sayfa yalnız okunur: açılışta kaydırma yok.
    expect(kaydirilan).toEqual([]);
  });

  it('istenen şemalar satır içi SVG olarak çizilir; her birinin erişilebilir adı ve metin karşılığı vardır', async () => {
    const kok = await ac();
    const semalar = [...kok.querySelectorAll<HTMLElement>('figure.kl-sema')];
    expect(semalar.map((s) => s.dataset['sema'])).toEqual([
      'yonler', 'yandan', 'yuzey', 'lowbed', 'aciklik-arka', 'aciklik-yan', 'aciklik-ust', 'engel',
    ]);
    for (const sema of semalar) {
      const svg = sema.querySelector('svg')!;
      expect(svg.getAttribute('role')).toBe('img');
      expect(svg.getAttribute('aria-label')!.length).toBeGreaterThan(40);
      expect(metin(sema.querySelector('figcaption'))).toMatch(/^Şema \d[abc]? · /);
    }
    // Dış görsel ve başka belgeye başvuru yok (işaretçi/`url(#...)` de kullanılmaz: <base href> ile kırılmasın).
    expect(kok.querySelector('img, image, use, marker')).toBeNull();
    expect(metin(kok.querySelector('[data-sema="yuzey"]'))).toContain('Dış uzunluk 12.192 mm');
    expect(metin(kok.querySelector('[data-sema="yuzey"]'))).toContain('Başlangıç X = 97 mm');
    expect(metin(kok.querySelector('[data-sema="lowbed"] svg'))).toContain('HAVUZ başlangıç X = 3.200');
    // Lowbed değerlerinin örnek olduğu açıkça yazılır.
    expect(metin(kok.querySelector('#ornek-lowbed [data-ornek-uyarisi]'))).toContain('Bu değerler örnektir.');
  });

  it('"Yazdır / PDF olarak kaydet" tarayıcının yazdırma penceresini açar; ekran düğmeleri ve içindekiler kâğıda çıkmaz', async () => {
    const kok = await ac();
    const yazdir = spyOn(window, 'print');
    const dugme = kok.querySelector<HTMLButtonElement>('[data-yazdir]')!;
    expect(metin(dugme)).toBe('Yazdır / PDF olarak kaydet');
    dugme.click();
    expect(yazdir).toHaveBeenCalledTimes(1);

    // Çerçeveyi gizleyen genel kural bu işaretle çalışır (src/styles.scss → .tz-yazdir-sayfa).
    expect(kok.querySelector('.tz-yazdir-sayfa')).not.toBeNull();
    const gizlenenler = ['.kl-islemler', '.kl-icindekiler', '[data-icindekiler]'].map((secici) => kok.querySelector(secici)!);
    expect(gizlenenler.map((oge) => oge.classList.contains('kl-yazdirma-gizle'))).toEqual([true, true, true]);
    expect(kok.querySelector('section.kl-bolum.kl-yazdirma-gizle, figure.kl-yazdirma-gizle')).toBeNull();
  });

  it('adresteki çapayla açılınca o bölüme kaydırır ve odağı bölüme taşır', async () => {
    const kok = await ac('#yuzeyler');
    expect(kaydirilan).toEqual(['yuzeyler']);
    expect(document.activeElement).toBe(kok.querySelector('#yuzeyler'));
  });

  it('bilinmeyen çapa yok sayılır', async () => {
    await ac('#boyle-bir-bolum-yok');
    expect(kaydirilan).toEqual([]);
  });

  it('içindekiler bağlantısı bölüme kaydırır ve çapayı adrese yazar; "İçindekiler" düğmesi başa döner', async () => {
    const kok = await ac();
    kok.querySelector<HTMLAnchorElement>(`.kl-icindekiler a[href$="#engeller"]`)!.click();
    await harness.fixture.whenStable();
    expect(kaydirilan[0]).toBe('engeller');
    expect(TestBed.inject(Router).url).toBe(`${EKIPMAN_KILAVUZU_YOLU}#engeller`);
    expect(document.activeElement).toBe(kok.querySelector('#engeller'));

    // Aynı bağlantıya yeniden tıklanınca adres değişmez ama bölüm yine görünür alana gelir.
    kaydirilan = [];
    kok.querySelector<HTMLAnchorElement>(`.kl-icindekiler a[href$="#engeller"]`)!.click();
    await harness.fixture.whenStable();
    expect(kaydirilan).toEqual(['engeller']);

    kaydirilan = [];
    kok.querySelector<HTMLButtonElement>('[data-icindekiler]')!.click();
    expect(kaydirilan).toEqual(['icindekiler']);
    expect(document.activeElement).toBe(kok.querySelector('.kl-icindekiler'));
  });

  it('metindeki "Şema 4" göndermesi lowbed şemasına gider', async () => {
    const kok = await ac();
    const gonderme = kok.querySelector<HTMLAnchorElement>('#king-pin a[href$="#sema-4"]')!;
    gonderme.click();
    await harness.fixture.whenStable();
    expect(kaydirilan[0]).toBe('sema-4');
    expect(kok.querySelector('[data-sema="lowbed"]')!.id).toBe('sema-4');
  });
});

describe('Ekipman Kitaplığı Kılavuzu rotası', () => {
  const rotalar = (liste: Route[]): Route[] => liste.flatMap((r) => [r, ...rotalar(r.children ?? [])]);

  it('kitaplık görüntüleme izniyle (R) korunur: menuGuard, yazma şartı yok', () => {
    const rota = rotalar(routes).find((r) => `/${r.path}` === EKIPMAN_KILAVUZU_YOLU)!;
    expect(rota).withContext('rota tanımlı olmalı').toBeDefined();
    expect(rota.canActivate).toEqual([menuGuard]);
    expect(rota.data).toEqual({ menuKod: YETKI.YUKLEME_PLANLAMA.EKIPMAN_KITAPLIGI });
  });
});
