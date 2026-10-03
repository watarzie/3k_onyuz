import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, HttpHeaders, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { BaseApiService } from './base-api.service';

describe('BaseApiService takip kodu', () => {
  let api: BaseApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), BaseApiService] });
    api = TestBed.inject(BaseApiService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  const takipli = (kod: string) => new HttpHeaders({ 'X-Correlation-ID': kod });

  it('iş hatası mesajına sunucu logundaki takip kodunu ekler', () => {
    let sonuc: any;
    api.post('/uck', {}).subscribe(r => (sonuc = r));
    http.expectOne('/uck').flush({ message: 'Geri gönderilen adet büyük olamaz.' },
      { status: 409, statusText: 'Conflict', headers: takipli('a1b2c3d4e5f6') });

    expect(sonuc.isSuccess).toBeFalse();
    expect(sonuc.error).toBe('Geri gönderilen adet büyük olamaz. · Takip: a1b2c3d4e5f6');
    expect(sonuc.takipKodu).toBe('a1b2c3d4e5f6');
  });

  it('giriş/oturum (401) hatasında ve başlık yoksa takip eklemez', () => {
    let giris: any;
    api.post('/login', {}).subscribe(r => (giris = r));
    http.expectOne('/login').flush({ message: 'E-posta veya şifre hatalı.' },
      { status: 401, statusText: 'Unauthorized', headers: takipli('a1b2c3d4e5f6') });
    expect(giris.error).toBe('E-posta veya şifre hatalı.');

    let basliksiz: any;
    api.get('/x').subscribe(r => (basliksiz = r));
    http.expectOne('/x').flush({ message: 'Bulunamadı.' }, { status: 404, statusText: 'Not Found' });
    expect(basliksiz.error).toBe('Bulunamadı.');
    expect(basliksiz.takipKodu).toBeUndefined();
  });

  it('beklenmeyen biçimdeki başlığı göstermez; indirme hatasına da takip ekler', async () => {
    let sonuc: any;
    api.get('/y').subscribe(r => (sonuc = r));
    http.expectOne('/y').flush({ message: 'Hata' }, { status: 400, statusText: 'Bad', headers: takipli('<script>') });
    expect(sonuc.error).toBe('Hata');

    const indirme = new HttpErrorResponse({
      error: new Blob([JSON.stringify({ message: 'Rapor yetkisi yok.' })], { type: 'application/json' }),
      status: 403,
      headers: takipli('ffee0011aabb'),
    });
    expect(await api.downloadErrorMessage(indirme, 'İndirilemedi')).toBe('Rapor yetkisi yok. · Takip: ffee0011aabb');
  });
});
