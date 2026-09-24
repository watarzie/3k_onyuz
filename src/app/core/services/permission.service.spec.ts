import { fakeAsync, flushMicrotasks, TestBed, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { API } from '../constants/api-endpoints';
import { YetkiTipi } from '../constants/enums';
import { MenuTreeDto } from '../../shared/models';
import { PermissionService } from './permission.service';

describe('PermissionService menü yenileme', () => {
  let service: PermissionService;
  let http: HttpTestingController;
  const menu: MenuTreeDto[] = [{
    id: 1,
    kod: 'islem-onay-merkezi',
    labelKey: '',
    ad: 'İşlem Onay Merkezi',
    icon: '',
    sira: 1,
    yetkiTipiId: YetkiTipi.R,
    yetkiTipiMetni: 'R',
    children: [],
  }];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PermissionService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PermissionService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('arka planda düzenli GET atmaz; odaklanınca yalnız eski menüyü yeniler', fakeAsync(() => {
    void service.ensurePermissionsLoaded();
    http.expectOne(API.MENU.KULLANICI_MENU).flush(menu);
    flushMicrotasks();

    tick(2 * 60 * 1000);
    http.expectNone(API.MENU.KULLANICI_MENU);
    window.dispatchEvent(new Event('focus'));
    http.expectNone(API.MENU.KULLANICI_MENU);

    tick(3 * 60 * 1000);
    window.dispatchEvent(new Event('focus'));
    http.expectOne(API.MENU.KULLANICI_MENU).flush(menu);
    flushMicrotasks();
    expect(service.hasAccess('islem-onay-merkezi')).toBeTrue();
  }));

  it('yetki değişikliği yenilenirken mevcut menüyü boşaltmaz', fakeAsync(() => {
    void service.ensurePermissionsLoaded();
    http.expectOne(API.MENU.KULLANICI_MENU).flush(menu);
    flushMicrotasks();

    void service.refreshPermissions();
    expect(service.hasAccess('islem-onay-merkezi')).toBeTrue();
    http.expectOne(API.MENU.KULLANICI_MENU).flush([]);
    flushMicrotasks();
    expect(service.hasAccess('islem-onay-merkezi')).toBeFalse();
    expect(service.loaded()).toBeTrue();
  }));

  it('odak yenilemesi hata verirse her odaklanmada yeniden istek atmaz', fakeAsync(() => {
    void service.ensurePermissionsLoaded();
    http.expectOne(API.MENU.KULLANICI_MENU).flush(menu);
    flushMicrotasks();

    tick(5 * 60 * 1000);
    window.dispatchEvent(new Event('focus'));
    http.expectOne(API.MENU.KULLANICI_MENU).flush('Geçici hata', {
      status: 503,
      statusText: 'Service Unavailable',
    });
    flushMicrotasks();

    window.dispatchEvent(new Event('focus'));
    http.expectNone(API.MENU.KULLANICI_MENU);
    expect(service.hasAccess('islem-onay-merkezi')).toBeTrue();
  }));

  it('yenileme sürerken gelen yetki olayını ikinci sorguyla uygular', fakeAsync(() => {
    void service.ensurePermissionsLoaded();
    http.expectOne(API.MENU.KULLANICI_MENU).flush(menu);
    flushMicrotasks();

    const first = service.refreshPermissions();
    const staleRequest = http.expectOne(API.MENU.KULLANICI_MENU);
    expect(service.refreshPermissions()).toBe(first);
    staleRequest.flush([]);
    flushMicrotasks();
    expect(service.hasAccess('islem-onay-merkezi')).toBeTrue();

    http.expectOne(API.MENU.KULLANICI_MENU).flush([]);
    flushMicrotasks();
    expect(service.hasAccess('islem-onay-merkezi')).toBeFalse();
  }));

  it('ilk menü yüklenirken gelen yetki olayını da yeniden sorgular', fakeAsync(() => {
    void service.ensurePermissionsLoaded();
    const firstRequest = http.expectOne(API.MENU.KULLANICI_MENU);
    void service.refreshPermissions();
    firstRequest.flush(menu);
    flushMicrotasks();

    http.expectOne(API.MENU.KULLANICI_MENU).flush([]);
    flushMicrotasks();
    expect(service.hasAccess('islem-onay-merkezi')).toBeFalse();
  }));

  it('ilk yükleme başarısızsa bekleyen yetki olayı için bir kez yeniden dener', fakeAsync(() => {
    void service.ensurePermissionsLoaded();
    const firstRequest = http.expectOne(API.MENU.KULLANICI_MENU);
    void service.refreshPermissions();
    firstRequest.flush('Geçici hata', { status: 503, statusText: 'Service Unavailable' });
    flushMicrotasks();

    http.expectOne(API.MENU.KULLANICI_MENU).flush(menu);
    flushMicrotasks();
    expect(service.hasAccess('islem-onay-merkezi')).toBeTrue();
  }));

  it('sunucudan gelen N ve R üst menü sınırlarını route ve işlem iznine uygular', fakeAsync(() => {
    const item = (id: number, kod: string, permission: YetkiTipi,
      children: MenuTreeDto[] = [], required?: YetkiTipi): MenuTreeDto => ({
      id, kod, labelKey: '', icon: '', route: `/${kod}`, sira: id,
      yetkiTipiId: permission, yetkiTipiMetni: YetkiTipi[permission],
      children, gerekenYetkiTipiId: required,
    });
    const inconsistentMenu = [
      item(1, 'sandik-yonetimi', YetkiTipi.N, [
        item(2, 'sandik-alt-islem', YetkiTipi.W),
      ]),
      item(3, 'okuma-modulu', YetkiTipi.R, [
        item(4, 'okuma-alt-menu', YetkiTipi.W),
        item(5, 'yazma-islemi', YetkiTipi.W, [], YetkiTipi.W),
      ]),
    ];

    void service.ensurePermissionsLoaded();
    http.expectOne(API.MENU.KULLANICI_MENU).flush(inconsistentMenu);
    flushMicrotasks();

    expect(service.menuAgaci().map(item => item.kod)).toEqual(['okuma-modulu']);
    expect(service.hasAccess('sandik-yonetimi')).toBeFalse();
    expect(service.canWrite('sandik-alt-islem')).toBeFalse();
    expect(service.isRouteAllowed('/sandik-alt-islem')).toBeFalse();
    expect(service.hasAccess('okuma-alt-menu')).toBeTrue();
    expect(service.canWrite('okuma-alt-menu')).toBeFalse();
    expect(service.isRouteAllowed('/okuma-alt-menu')).toBeTrue();
    expect(service.hasAccess('yazma-islemi')).toBeFalse();
    expect(service.canWrite('yazma-islemi')).toBeFalse();
  }));
});
