import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { BaseApiService } from './base-api.service';

/** Sunucunun 4xx gövdesindeki yapılandırılmış sorun listesi (issues) çağıran ekrana ulaşmalıdır. */
describe('BaseApiService yapılandırılmış sorunlar', () => {
  let api: BaseApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), BaseApiService] });
    api = TestBed.inject(BaseApiService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('409 yanıtındaki issues listesini sonuca olduğu gibi geçirir', () => {
    let sonuc: any;
    api.put('/ambalaj/projeler/7/uretim-durumu', { tamamla: true }).subscribe((r) => (sonuc = r));
    const issues = [{ kayitId: 31, sandikNo: '12', grupMetni: 'İlave', mesaj: '12 (İlave): üretim formu yok' }];
    http.expectOne('/ambalaj/projeler/7/uretim-durumu')
      .flush({ message: 'Üretim tamamlanamıyor.', issues }, { status: 409, statusText: 'Conflict' });

    expect(sonuc.isSuccess).toBeFalse();
    expect(sonuc.statusCode).toBe(409);
    expect(sonuc.error).toBe('Üretim tamamlanamıyor.');
    expect(sonuc.issues).toEqual(issues);
  });

  it('issues taşımayan hata yanıtında alan tanımsız kalır', () => {
    let sonuc: any;
    api.get('/x').subscribe((r) => (sonuc = r));
    http.expectOne('/x').flush({ message: 'Bulunamadı.' }, { status: 404, statusText: 'Not Found' });
    expect(sonuc.issues).toBeUndefined();
  });
});
