import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { API } from '../constants/api-endpoints';
import { AracYuklemeService } from './arac-yukleme.service';
import { YuklemeIsaretKaynagi } from '../../shared/models/index';

describe('AracYuklemeService sözleşmesi', () => {
  let service: AracYuklemeService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(AracYuklemeService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('plan listesi sayfa ve boyutu, aramayı yalnız doluysa kırpılmış gönderir', () => {
    service.planlar('  wasit ', 2, 50).subscribe();
    const dolu = http.expectOne((r) => r.url === API.ARAC_YUKLEME.PLANLAR);
    expect(dolu.request.method).toBe('GET');
    expect(dolu.request.params.get('sayfa')).toBe('2');
    expect(dolu.request.params.get('boyut')).toBe('50');
    expect(dolu.request.params.get('arama')).toBe('wasit');
    dolu.flush({ items: [], totalCount: 0 });

    service.planlar('   ', 1, 25).subscribe();
    const bos = http.expectOne((r) => r.url === API.ARAC_YUKLEME.PLANLAR);
    expect(bos.request.params.has('arama')).toBeFalse();
    bos.flush({ items: [], totalCount: 0 });
  });

  it('oturum, planın beklenen revizyon numarasıyla başlatılır', () => {
    service.baslat(7, 4).subscribe();
    const istek = http.expectOne(API.ARAC_YUKLEME.OTURUM_BASLAT(7));
    expect(istek.request.method).toBe('POST');
    expect(istek.request.body).toEqual({ beklenenRevizyonNo: 4 });
    istek.flush({});
  });

  it('durum ve araç okuma uçları plan, oturum ve araç numarasıyla çağrılır', () => {
    service.durum(7).subscribe();
    expect(http.expectOne(API.ARAC_YUKLEME.PLAN(7)).request.method).toBe('GET');
    service.arac(5, 2).subscribe();
    const arac = http.expectOne(API.ARAC_YUKLEME.ARAC(5, 2));
    expect(arac.request.url).toContain('/arac-yukleme/oturumlar/5/araclar/2');
    arac.flush({});
  });

  it('barkod çözümü durum değiştirmeyen GET isteğidir; barkod ve araç sorgu parametresidir', () => {
    service.cozumle(5, '000000000042', 2).subscribe();
    const istek = http.expectOne((r) => r.url === API.ARAC_YUKLEME.COZUMLE(5));
    expect(istek.request.method).toBe('GET');
    expect(istek.request.params.get('barkod')).toBe('000000000042');
    expect(istek.request.params.get('aracNo')).toBe('2');
    istek.flush({});
  });

  it('işaretleme isteği gövdeyi olduğu gibi gönderir; 409 iletisi sonuca taşınır', () => {
    const istek = { aracNo: 2, yukAnahtari: 's:42', kaynak: YuklemeIsaretKaynagi.Barkod, siraDisiOnayi: false, barkod: '000000000042' };
    let hata: string | undefined;
    let basarili: boolean | undefined;
    service.isaretle(5, istek).subscribe((r) => {
      basarili = r.isSuccess;
      hata = r.error;
    });
    const cagri = http.expectOne(API.ARAC_YUKLEME.YUKLEMELER(5));
    expect(cagri.request.method).toBe('POST');
    expect(cagri.request.body).toEqual(istek);
    cagri.flush({ message: 'Sıra dışı yükleme onay ister.' }, { status: 409, statusText: 'Conflict' });
    expect(basarili).toBeFalse();
    expect(hata).toContain('Sıra dışı yükleme onay ister.');
  });

  it('geri alma, tamamlama ve iptal gerekçeyi gövdede gönderir', () => {
    service.geriAl(5, 31, 'Yanlış sandık okutuldu').subscribe();
    const geri = http.expectOne(API.ARAC_YUKLEME.GERI_AL(5, 31));
    expect(geri.request.url).toContain('/arac-yukleme/oturumlar/5/yuklemeler/31/geri-al');
    expect(geri.request.body).toEqual({ gerekce: 'Yanlış sandık okutuldu' });
    geri.flush({});

    service.tamamla(5, null).subscribe();
    const tamam = http.expectOne(API.ARAC_YUKLEME.TAMAMLA(5));
    expect(tamam.request.body).toEqual({ gerekce: null });
    tamam.flush({});

    service.iptal(5, 'Sevk ertelendi').subscribe();
    const iptal = http.expectOne(API.ARAC_YUKLEME.IPTAL(5));
    expect(iptal.request.method).toBe('POST');
    expect(iptal.request.body).toEqual({ gerekce: 'Sevk ertelendi' });
    iptal.flush({});
  });
});
