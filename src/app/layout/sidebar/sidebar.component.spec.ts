import { ApplicationRef, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, Routes } from '@angular/router';
import { YetkiTipi } from '../../core/constants/enums';
import { YETKI } from '../../core/constants/yetki-kodlari';
import { PermissionService } from '../../core/services/permission.service';
import { TranslationService } from '../../core/services/translation.service';
import { MenuTreeDto } from '../../shared/models';
import { ToggleService } from '../../core/services/toggle.service';
import { aktifGrupKodu, MenuItem, SidebarComponent } from './sidebar.component';

describe('SidebarComponent yetki filtresi', () => {
  it('N üst menüyü çocuk W olsa bile göstermez; N alt menüyü de çıkarır', () => {
    const item = (id: number, kod: string, permission: YetkiTipi,
      children: MenuTreeDto[] = []): MenuTreeDto => ({
      id, kod, labelKey: kod, icon: '', route: `/${kod}`, sira: id,
      yetkiTipiId: permission, yetkiTipiMetni: YetkiTipi[permission], children,
    });
    const menuAgaci = signal([
      item(1, 'sandik-yonetimi', YetkiTipi.N, [item(2, 'eski-w', YetkiTipi.W)]),
      item(3, 'projeler', YetkiTipi.R, [
        item(4, 'gizli-alt', YetkiTipi.N),
        item(5, 'gorunur-alt', YetkiTipi.R),
      ]),
    ]);
    TestBed.configureTestingModule({
      imports: [SidebarComponent],
      providers: [
        provideRouter([]),
        { provide: PermissionService, useValue: { menuAgaci } },
        { provide: TranslationService, useValue: {
          currentLang: signal('tr'), translate: (key: string) => key,
        } },
        { provide: ToggleService, useValue: { isSidebarToggled: signal(false), toggle: () => {} } },
      ],
    });

    const fixture = TestBed.createComponent(SidebarComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.menu().map(item => item.kod)).toEqual(['projeler']);
    expect(fixture.componentInstance.menu()[0].children?.map(item => item.kod))
      .toEqual(['gorunur-alt']);
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('sandik-yonetimi');
  });

  it('iş listeleri ve Grid Sahası rotalı kalsa da kenar menüde çıkmaz; ekran proje listesindeki düğmeyle açılır', () => {
    const dugum = (id: number, kod: string, children: MenuTreeDto[] = []): MenuTreeDto => ({
      id, kod, labelKey: kod, icon: '', route: `/${kod}`, sira: id,
      yetkiTipiId: YetkiTipi.R, yetkiTipiMetni: YetkiTipi[YetkiTipi.R], children,
    });
    TestBed.configureTestingModule({
      imports: [SidebarComponent],
      providers: [
        provideRouter([]),
        // Betik 23'ün ilk sürümü düğümü /grid-saha rotasıyla kurmuştu: sunucu ağacı bu hâliyle gelse de gizlenir.
        { provide: PermissionService, useValue: { menuAgaci: signal([
          dugum(1, YETKI.SANDIK.YONETIMI, [
            dugum(2, YETKI.SANDIK.GRID_SAHA_GORUNUMU),
            dugum(3, YETKI.SANDIK.GRID_IS_LISTESI),
            dugum(4, YETKI.SANDIK.UCK_IS_LISTESI),
          ]),
        ]) } },
        { provide: TranslationService, useValue: { currentLang: signal('tr'), translate: (key: string) => key } },
        { provide: ToggleService, useValue: { isSidebarToggled: signal(false), toggle: () => {} } },
      ],
    });

    const fixture = TestBed.createComponent(SidebarComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.menu().map(item => item.kod)).toEqual([YETKI.SANDIK.YONETIMI]);
    expect(fixture.componentInstance.menu()[0].children).toEqual([]);
    expect((fixture.nativeElement as HTMLElement).querySelector('a[href="/grid-saha"]')).toBeNull();
  });
});

/** Gezinme testleri için boş hedef sayfa; kenar menüde router-outlet olmadığından çizilmez. */
@Component({ template: '' })
class BosSayfaComponent {}

describe('SidebarComponent grupları', () => {
  /** route null verilirse rotasız grup başlığı olur (Projeler gibi). */
  const dugum = (id: number, kod: string, children: MenuTreeDto[] = [],
    route: string | null = `/${kod}`): MenuTreeDto => ({
    id, kod, labelKey: kod, icon: '', route: route ?? undefined, sira: id,
    yetkiTipiId: YetkiTipi.R, yetkiTipiMetni: YetkiTipi[YetkiTipi.R], children,
  });

  const kur = (menu: MenuTreeDto[], routes: Routes = []) => {
    const menuAgaci = signal(menu);
    TestBed.configureTestingModule({
      imports: [SidebarComponent],
      providers: [
        provideRouter(routes),
        { provide: PermissionService, useValue: { menuAgaci } },
        { provide: TranslationService, useValue: {
          currentLang: signal('tr'), translate: (key: string) => key,
        } },
        { provide: ToggleService, useValue: { isSidebarToggled: signal(false), toggle: () => {} } },
      ],
    });
    const fixture = TestBed.createComponent(SidebarComponent);
    fixture.detectChanges();
    return { fixture, menuAgaci, el: fixture.nativeElement as HTMLElement };
  };

  const projelerGrubu = () => dugum(1, YETKI.PROJE.KOK, [
    dugum(2, YETKI.PROJE.AKTIF_PROJELER, [], '/projeler'),
    dugum(3, YETKI.PROJE.SEVK_EDILEN, [], '/projeler/sevk-edilen'),
  ], null);

  it('rotasız grup başlığı düğmedir; aria-expanded ile açılıp kapanır', () => {
    const { fixture, el } = kur([projelerGrubu()]);
    const baslik = el.querySelector<HTMLButtonElement>('button.km-link--grup');
    expect(baslik).withContext('grup başlığı düğme olmalı').not.toBeNull();
    expect(baslik!.type).toBe('button');
    expect(baslik!.getAttribute('aria-expanded')).toBe('false');
    const altMenu = el.querySelector(`[id="${baslik!.getAttribute('aria-controls')}"]`);
    expect(altMenu).withContext('aria-controls alt menüyü göstermeli').not.toBeNull();

    baslik!.click();
    fixture.detectChanges();
    expect(baslik!.getAttribute('aria-expanded')).toBe('true');
    expect(altMenu!.classList).toContain('acik');

    baslik!.click();
    fixture.detectChanges();
    expect(baslik!.getAttribute('aria-expanded')).toBe('false');
    expect(altMenu!.classList).not.toContain('acik');
  });

  it('Yönetim başlığı yalnız yönetim öğesi varken çizilir; sunucu sırası korunur', () => {
    const { fixture, el, menuAgaci } = kur([dugum(1, YETKI.DASHBOARD)]);
    const basliklar = () => Array.from(el.querySelectorAll('.km-bolum__baslik'))
      .map(baslik => baslik.textContent?.trim());
    expect(basliklar()).toEqual(['SIDEBAR.GRUP_OPERASYON']);

    menuAgaci.set([
      dugum(1, YETKI.DASHBOARD),
      dugum(2, YETKI.KULLANICILAR),
      dugum(3, YETKI.ROL_YONETIMI),
    ]);
    fixture.detectChanges();
    expect(basliklar()).toEqual(['SIDEBAR.GRUP_OPERASYON', 'SIDEBAR.GRUP_YONETIM']);
    const yonetim = el.querySelectorAll('.km-bolum')[1];
    expect(Array.from(yonetim.querySelectorAll('.km-etiket')).map(etiket => etiket.textContent?.trim()))
      .toEqual([YETKI.KULLANICILAR, YETKI.ROL_YONETIMI]);

    menuAgaci.set([dugum(4, YETKI.HAREKET_GECMISI)]);
    fixture.detectChanges();
    expect(basliklar()).toEqual(['SIDEBAR.GRUP_YONETIM']);
  });

  it('aktif rotanın grubu açık başlar; kullanıcı kapatırsa aynı grupta gezinirken kapalı kalır', async () => {
    const { fixture, el } = kur(
      [dugum(9, YETKI.DASHBOARD), projelerGrubu()],
      [{ path: '**', component: BosSayfaComponent }],
    );
    const router = TestBed.inject(Router);
    const baslik = () => el.querySelector<HTMLButtonElement>('button.km-link--grup')!;
    expect(baslik().getAttribute('aria-expanded')).toBe('false');

    await router.navigateByUrl('/projeler/sevk-edilen');
    fixture.detectChanges();
    expect(baslik().getAttribute('aria-expanded')).toBe('true');
    expect(el.querySelector('.km-grup')!.classList).toContain('icinde-aktif');

    baslik().click();
    fixture.detectChanges();
    expect(baslik().getAttribute('aria-expanded')).toBe('false');

    await router.navigateByUrl('/projeler');
    fixture.detectChanges();
    expect(baslik().getAttribute('aria-expanded')).toBe('false');
  });

  it('aktif grup en uzun rota eşleşmesiyle bulunur; düz öğe eşleşirse grup yoktur', () => {
    const oge = (kod: string, route: string | null, children: MenuItem[] = []): MenuItem =>
      ({ label: kod, kod, icon: '', route, yetkiTipiId: YetkiTipi.R, children });
    const menu = [
      oge('projeler', null, [oge('aktif', '/projeler'), oge('sevk', '/projeler/sevk-edilen')]),
      oge('sandik', '/sandik-yonetimi'),
    ];

    expect(aktifGrupKodu(menu, '/projeler/sevk-edilen')).toBe('projeler');
    expect(aktifGrupKodu(menu, '/projeler/12')).toBe('projeler');
    expect(aktifGrupKodu(menu, '/sandik-yonetimi/12')).toBeNull();
    expect(aktifGrupKodu(menu, '/projelerx')).toBeNull();
  });

  it('düz kök bağlantı birebir rotada aria-current="page", detay sayfasında "true" alır', async () => {
    const { fixture, el } = kur([dugum(1, 'sandik-yonetimi')], [{ path: '**', component: BosSayfaComponent }]);
    const router = TestBed.inject(Router);
    const baglanti = () => el.querySelector<HTMLAnchorElement>('a.km-link')!;
    // RouterLinkActive özniteliği mikro görevde yazar; bir makro görev beklemek hepsinin bitmesini sağlar.
    const yerlessin = async () => {
      fixture.detectChanges();
      await new Promise<void>(resolve => setTimeout(resolve));
      fixture.detectChanges();
    };

    await router.navigateByUrl('/sandik-yonetimi/12');
    await yerlessin();
    expect(baglanti().classList).withContext('detay sayfasında kök öğe vurgulu kalır').toContain('active');
    expect(baglanti().getAttribute('aria-current')).toBe('true');

    await router.navigateByUrl('/sandik-yonetimi');
    await yerlessin();
    expect(baglanti().getAttribute('aria-current')).toBe('page');

    await router.navigateByUrl('/baska-sayfa');
    await yerlessin();
    expect(baglanti().hasAttribute('aria-current')).toBeFalse();
  });
});

/** Sahte masaüstü kırılımı: matches değiştirilir ve change dinleyicisi elle tetiklenir. */
function sahteKirilim(masaustu: boolean) {
  let dinleyici: ((olay: MediaQueryListEvent) => void) | null = null;
  const durum = { matches: masaustu };
  const ekle = jasmine.createSpy('addEventListener').and.callFake(
    (_tur: string, fn: (olay: MediaQueryListEvent) => void) => { dinleyici = fn; });
  const kaldir = jasmine.createSpy('removeEventListener');
  const sorgu = {
    get matches() { return durum.matches; },
    media: '(min-width: 1200px)',
    addEventListener: ekle,
    removeEventListener: kaldir,
  } as unknown as MediaQueryList;
  const degistir = (yeni: boolean) => {
    durum.matches = yeni;
    dinleyici?.({ matches: yeni, media: '(min-width: 1200px)' } as MediaQueryListEvent);
  };
  return { sorgu, ekle, kaldir, degistir };
}

describe('SidebarComponent kırılım ve mobil menü', () => {
  /**
   * Karma gerçek Chrome'da koşar; sonuç pencere genişliğine bağlı kalmasın diye matchMedia taklit edilir.
   * ToggleService sahtesi gerçekçi: signal + update, toggle çağrıları sayılır.
   */
  const kur = (masaustu: boolean, toggled: boolean) => {
    const kirilim = sahteKirilim(masaustu);
    spyOn(window, 'matchMedia').and.returnValue(kirilim.sorgu);
    const isSidebarToggled = signal(toggled);
    const toggle = jasmine.createSpy('toggle').and.callFake(() => isSidebarToggled.update(acik => !acik));
    TestBed.configureTestingModule({
      imports: [SidebarComponent],
      providers: [
        provideRouter([]),
        { provide: PermissionService, useValue: { menuAgaci: signal<MenuTreeDto[]>([]) } },
        { provide: TranslationService, useValue: {
          currentLang: signal('tr'), translate: (key: string) => key,
        } },
        { provide: ToggleService, useValue: { isSidebarToggled, toggle } },
      ],
    });
    const fixture = TestBed.createComponent(SidebarComponent);
    fixture.detectChanges();
    return { fixture, kirilim, isSidebarToggled, toggle, el: fixture.nativeElement as HTMLElement };
  };

  it('closeSidebar masaüstünde daraltılmış menüyü açmaz', () => {
    const { fixture, toggle, isSidebarToggled } = kur(true, true);
    fixture.componentInstance.closeSidebar();
    expect(toggle).not.toHaveBeenCalled();
    expect(isSidebarToggled()).toBeTrue();
  });

  it('closeSidebar mobilde açık menüyü bir kez kapatır; kapalıyken dokunmaz', () => {
    const { fixture, toggle, isSidebarToggled } = kur(false, true);
    fixture.componentInstance.closeSidebar();
    expect(toggle).toHaveBeenCalledTimes(1);
    expect(isSidebarToggled()).toBeFalse();

    fixture.componentInstance.closeSidebar();
    expect(toggle).toHaveBeenCalledTimes(1);
  });

  it('kırılım geçilince daraltılmış/açık durum sıfırlanır', () => {
    const { kirilim, toggle, isSidebarToggled } = kur(true, true);
    kirilim.degistir(false);
    expect(toggle).withContext('masaüstünde daraltılmış menü mobilde açık gelmemeli').toHaveBeenCalledTimes(1);
    expect(isSidebarToggled()).toBeFalse();

    isSidebarToggled.set(true);
    kirilim.degistir(true);
    expect(toggle).withContext('mobilde açık menü masaüstünde daraltılmış gelmemeli').toHaveBeenCalledTimes(2);
    expect(isSidebarToggled()).toBeFalse();
  });

  it('kırılım geçişi varsayılan durumdaki menüye dokunmaz', () => {
    const { kirilim, toggle } = kur(false, false);
    kirilim.degistir(true);
    kirilim.degistir(false);
    expect(toggle).not.toHaveBeenCalled();
  });

  it('bileşen yok edilince kırılım dinleyicisi kaldırılır', () => {
    const { fixture, kirilim } = kur(true, false);
    expect(kirilim.ekle).toHaveBeenCalledWith('change', jasmine.any(Function));
    const dinleyici = kirilim.ekle.calls.mostRecent().args[1];

    fixture.destroy();
    expect(kirilim.kaldir).toHaveBeenCalledWith('change', dinleyici);
  });

  it('mobilde açılınca odak kapat düğmesine geçer; Esc kapatır ve odağı açan öğeye geri verir', () => {
    const hamburger = document.createElement('button');
    document.body.appendChild(hamburger);
    try {
      const { fixture, el, isSidebarToggled, toggle } = kur(false, false);
      const appRef = TestBed.inject(ApplicationRef);
      // afterRenderEffect uygulama tick'inde koşar; fixture.detectChanges tek başına çalıştırmaz.
      const ciz = () => {
        fixture.detectChanges();
        appRef.tick();
      };
      ciz();
      hamburger.focus();

      isSidebarToggled.set(true);
      ciz();
      const kapat = el.querySelector<HTMLButtonElement>('.km-kapat')!;
      expect(document.activeElement).withContext('açılınca odak menüye taşınmalı').toBe(kapat);

      kapat.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      ciz();
      expect(toggle).toHaveBeenCalledTimes(1);
      expect(isSidebarToggled()).toBeFalse();
      expect(document.activeElement).withContext('Esc sonrası odak açan öğeye dönmeli').toBe(hamburger);
    } finally {
      hamburger.remove();
    }
  });

  it('masaüstünde Esc daraltılmış menüye dokunmaz', () => {
    const { el, toggle } = kur(true, true);
    el.querySelector('aside')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(toggle).not.toHaveBeenCalled();
  });
});
