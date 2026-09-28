import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';
import { SessionManager } from '../managers/session.manager';
import { API } from '../constants/api-endpoints';

describe('authInterceptor sessiz token yenileme', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let token: string | null;
  let logout: jasmine.Spy;
  const yetkisiz = { status: 401, statusText: 'Unauthorized' };

  beforeEach(() => {
    token = 'eski';
    logout = jasmine.createSpy('logout');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        {
          provide: SessionManager,
          useValue: { get token() { return token; }, setToken: (yeni: string) => (token = yeni), getUser: () => null },
        },
        { provide: AuthService, useValue: { logout, currentUser: signal(null) } },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('eşzamanlı 401 alan istekler tek yenilemeyi paylaşır ve yeni token ile tekrarlanır', () => {
    const sonuclar: unknown[] = [];
    http.get('/a').subscribe((v) => sonuclar.push(v));
    http.get('/b').subscribe((v) => sonuclar.push(v));
    backend.expectOne('/a').flush(null, yetkisiz);
    backend.expectOne('/b').flush(null, yetkisiz);

    backend.expectOne(API.AUTH.REFRESH_TOKEN).flush({ token: 'yeni' });

    for (const url of ['/a', '/b']) {
      const tekrar = backend.expectOne(url);
      expect(tekrar.request.headers.get('Authorization')).toBe('Bearer yeni');
      tekrar.flush({ url });
    }
    expect(sonuclar).toEqual([{ url: '/a' }, { url: '/b' }]);
    expect(logout).not.toHaveBeenCalled();
  });

  it('yenileme başarısızsa oturum bir kez kapanır ve bekleyen bütün istekler hatayla biter', () => {
    const hatalar: unknown[] = [];
    http.get('/a').subscribe({ error: (e) => hatalar.push(e) });
    http.get('/b').subscribe({ error: (e) => hatalar.push(e) });
    backend.expectOne('/a').flush(null, yetkisiz);
    backend.expectOne('/b').flush(null, yetkisiz);

    backend.expectOne(API.AUTH.REFRESH_TOKEN).flush({ message: 'Oturum süresi doldu' }, yetkisiz);

    expect(hatalar.length).toBe(2);
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('yenilemeyi başlatan isteğin iptali yenilemeyi durdurmaz; sonraki 401 aynı yenilemeyi bekler', () => {
    const ilk = http.get('/a').subscribe();
    backend.expectOne('/a').flush(null, yetkisiz);
    const yenileme = backend.expectOne(API.AUTH.REFRESH_TOKEN);
    ilk.unsubscribe();
    expect(yenileme.cancelled).toBeFalse();

    let sonuc: unknown;
    http.get('/b').subscribe((v) => (sonuc = v));
    backend.expectOne('/b').flush(null, yetkisiz);
    backend.expectNone(API.AUTH.REFRESH_TOKEN);
    yenileme.flush({ token: 'yeni' });

    const tekrar = backend.expectOne('/b');
    expect(tekrar.request.headers.get('Authorization')).toBe('Bearer yeni');
    tekrar.flush({ tamam: true });
    expect(sonuc).toEqual({ tamam: true });
  });

  it('parola adımı token taşımaz ve 401 aldığında yenileme başlatmaz', () => {
    http.post(API.AUTH.LOGIN, {}).subscribe({ error: () => undefined });
    const giris = backend.expectOne(API.AUTH.LOGIN);
    expect(giris.request.headers.has('Authorization')).toBeFalse();
    giris.flush(null, yetkisiz);

    backend.expectNone(API.AUTH.REFRESH_TOKEN);
    expect(logout).not.toHaveBeenCalled();
  });
});
