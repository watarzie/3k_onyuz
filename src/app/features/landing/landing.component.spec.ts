import { WritableSignal, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { TranslationService } from '../../core/services/translation.service';
import { LandingComponent } from './landing.component';

describe('LandingComponent — tanıtım sayfası', () => {
  // Sahte çeviri servisi: anahtarı aynen döndürür, localStorage'a dokunmaz.
  let ceviri: {
    currentLang: WritableSignal<string>;
    switchLanguage: jasmine.Spy;
    translate: (anahtar: string) => string;
  };

  function kur(oturumAcik: boolean) {
    ceviri = {
      currentLang: signal('tr'),
      switchLanguage: jasmine.createSpy('switchLanguage'),
      translate: (anahtar: string) => anahtar,
    };
    TestBed.configureTestingModule({
      imports: [LandingComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { isLoggedIn: signal(oturumAcik) } },
        { provide: TranslationService, useValue: ceviri },
      ],
    });
    const fixture = TestBed.createComponent(LandingComponent);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  function birincilBaglantilar(el: HTMLElement): HTMLAnchorElement[] {
    return Array.from(el.querySelectorAll<HTMLAnchorElement>('a.ld-giris-baglantisi'));
  }

  function dilDugmesi(el: HTMLElement, etiket: string): HTMLButtonElement {
    const dugme = Array.from(el.querySelectorAll<HTMLButtonElement>('.ld-dil button')).find(
      (b) => b.textContent?.trim() === etiket,
    );
    expect(dugme).withContext(`${etiket} düğmesi`).toBeTruthy();
    return dugme!;
  }

  it('oturum kapalıyken üst çubuk ve hero bağlantıları giriş ekranına gider', () => {
    const { el } = kur(false);
    const linkler = birincilBaglantilar(el);

    expect(linkler.length).toBe(2);
    for (const a of linkler) {
      expect(a.getAttribute('href')).toBe('/auth/login');
      expect(a.querySelector('i')!.classList.contains('ri-login-circle-line')).toBeTrue();
    }
  });

  it('oturum açıkken aynı bağlantılar panele gider', () => {
    const { el } = kur(true);
    const linkler = birincilBaglantilar(el);

    expect(linkler.length).toBe(2);
    for (const a of linkler) {
      expect(a.getAttribute('href')).toBe('/dashboard');
      expect(a.querySelector('i')!.classList.contains('ri-dashboard-line')).toBeTrue();
    }
  });

  it('oturum açıkken üst çubuk kısa panel etiketini, hero uzun etiketi gösterir', () => {
    // Dar ekranda (320px, EN) uzun etiket üst çubuk düğmesini taşırır; kısa anahtar bunu önler.
    const { el } = kur(true);
    const ust = el.querySelector<HTMLAnchorElement>('.ld-ust a.ld-giris-baglantisi')!;
    const hero = el.querySelector<HTMLAnchorElement>('.ld-hero a.ld-giris-baglantisi')!;

    expect(ust.textContent?.trim()).toBe('LANDING.CTA.DASHBOARD_SHORT');
    expect(hero.textContent?.trim()).toBe('LANDING.CTA.DASHBOARD');
  });

  it('kurumsal site bağlantıları 3kambalaj.com adresine yeni sekmede ve noopener ile açılır', () => {
    const { el } = kur(false);
    const kurumsal = Array.from(el.querySelectorAll<HTMLAnchorElement>('a')).filter(
      (a) => a.href === 'https://3kambalaj.com/',
    );

    expect(kurumsal.length).toBeGreaterThanOrEqual(2);
    for (const a of kurumsal) {
      expect(a.target).toBe('_blank');
      expect(a.rel.split(/\s+/)).toContain('noopener');
    }

    // Sayfadaki her yeni sekme bağlantısı açan sayfaya erişimi kapatır (harita dahil).
    el.querySelectorAll<HTMLAnchorElement>('a[target="_blank"]').forEach((a) =>
      expect(a.rel.split(/\s+/)).withContext(a.href).toContain('noopener'),
    );
  });

  it('TR/EN düğmesi dili TranslationService üzerinden değiştirir ve seçili dili işaretler', () => {
    const { fixture, el } = kur(false);
    const en = dilDugmesi(el, 'EN');
    const tr = dilDugmesi(el, 'TR');
    expect(tr.getAttribute('aria-pressed')).toBe('true');
    expect(en.getAttribute('aria-pressed')).toBe('false');

    en.click();
    expect(ceviri.switchLanguage).toHaveBeenCalledOnceWith('en');

    ceviri.currentLang.set('en');
    fixture.detectChanges();
    expect(en.getAttribute('aria-pressed')).toBe('true');
    expect(tr.getAttribute('aria-pressed')).toBe('false');

    tr.click();
    expect(ceviri.switchLanguage).toHaveBeenCalledWith('tr');
  });

  it('"Akışı İncele" adres değiştirmeden akış bölümüne kaydırır ve odağı bölüm başlığına taşır', () => {
    const { el } = kur(false);
    const bolum = el.querySelector<HTMLElement>('#akis')!;
    const kaydir = spyOn(bolum, 'scrollIntoView');
    const tik = new MouseEvent('click', { bubbles: true, cancelable: true });

    el.querySelector<HTMLAnchorElement>('a[href="#akis"]')!.dispatchEvent(tik);

    expect(tik.defaultPrevented).toBeTrue();
    expect(kaydir).toHaveBeenCalled();
    expect(document.activeElement).toBe(el.querySelector('#ld-akis-baslik'));
  });

  it('"Akışı İncele" değiştirici tuşlu tıklamayı bağlantının olağan davranışına bırakır', () => {
    const { el } = kur(false);
    const kaydir = spyOn(el.querySelector<HTMLElement>('#akis')!, 'scrollIntoView');
    // Bileşen dinleyicisinden sonra çalışır: durumu kaydeder, test sayfasının gezinmesini ise önler.
    let bilesenEngelledi: boolean | undefined;
    el.addEventListener('click', (olay) => {
      bilesenEngelledi = olay.defaultPrevented;
      olay.preventDefault();
    });

    el.querySelector<HTMLAnchorElement>('a[href="#akis"]')!.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true }),
    );

    expect(bilesenEngelledi).toBeFalse();
    expect(kaydir).not.toHaveBeenCalled();
  });
});
