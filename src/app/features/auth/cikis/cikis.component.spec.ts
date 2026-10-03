import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { CikisComponent } from './cikis.component';
import { AuthService } from '../../../core/auth/auth.service';
import { SessionManager } from '../../../core/managers/session.manager';
import { PermissionService } from '../../../core/services/permission.service';
import { BaseApiService } from '../../../core/services/base-api.service';

describe('CikisComponent — veda sayfası', () => {
  let router: Router;

  function kur(oturumAcik = false, ad: string | null = 'ömer YILMAZ') {
    history.replaceState({ ad }, '');
    TestBed.configureTestingModule({
      imports: [CikisComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { isLoggedIn: signal(oturumAcik) } },
      ],
    });
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    const fixture = TestBed.createComponent(CikisComponent);
    fixture.detectChanges();
    return { fixture, c: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
  }

  afterEach(() => history.replaceState(null, ''));

  it('çıkış yapan kişiyi ilk adıyla uğurlar', () => {
    const { fixture, el } = kur();
    expect(el.querySelector('.cikis-veda')!.textContent).toContain('Görüşmek üzere, Ömer');
    fixture.destroy();
  });

  it('süre dolunca giriş ekranına yönlendirir; "Burada kal" yönlendirmeyi durdurur', fakeAsync(() => {
    const ilk = kur();
    tick(12_000);
    expect(router.navigate).toHaveBeenCalledWith(['/auth/login']);
    ilk.fixture.destroy();
    TestBed.resetTestingModule();

    const ikinci = kur();
    ikinci.c.burayaKal();
    tick(20_000);
    expect(router.navigate).not.toHaveBeenCalledWith(['/auth/login']);
    ikinci.fixture.detectChanges();
    expect(ikinci.el.querySelector('.cikis-sayac')!.textContent).toContain('durduruldu');
    ikinci.fixture.destroy();
  }));

  it('oturum açıkken açılırsa veda göstermeden panele döner', fakeAsync(() => {
    const { fixture } = kur(true);
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
    tick(15_000);
    expect(router.navigate).not.toHaveBeenCalledWith(['/auth/login']);
    fixture.destroy();
  }));
});

describe('AuthService.cikisYap', () => {
  it('oturumu temizler ve veda sayfasına adı yalnız gezinme durumunda taşıyarak gider', () => {
    const session = jasmine.createSpyObj('SessionManager', ['getUser', 'clearAll', 'isTokenExpired']);
    session.getUser.and.returnValue({ id: 1, adSoyad: 'Ömer Yılmaz', basHarf: 'ÖY', email: 'o@x', rol: 'Admin', rolId: 1 });
    session.isTokenExpired.and.returnValue(false);
    const permissions = jasmine.createSpyObj('PermissionService', ['clear']);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: SessionManager, useValue: session },
        { provide: PermissionService, useValue: permissions },
        { provide: BaseApiService, useValue: {} },
      ],
    });
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    const auth = TestBed.inject(AuthService);

    auth.cikisYap();

    expect(session.clearAll).toHaveBeenCalled();
    expect(permissions.clear).toHaveBeenCalled();
    expect(auth.currentUser()).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/auth/cikis'], { state: { ad: 'Ömer Yılmaz' } });
  });
});
