import { TestBed } from '@angular/core/testing';
import { HttpParams } from '@angular/common/http';
import { of } from 'rxjs';
import { BaseApiService } from './base-api.service';
import { AmbalajService } from './ambalaj.service';

describe('AmbalajService referans sözleşmesi', () => {
  let service: AmbalajService;
  let api: jasmine.SpyObj<BaseApiService>;

  beforeEach(() => {
    api = jasmine.createSpyObj<BaseApiService>('BaseApiService', [
      'get', 'post', 'put', 'delete', 'downloadFile',
    ]);
    api.get.and.returnValue(of({ isSuccess: true, value: [] }));
    api.put.and.returnValue(of({ isSuccess: true }));
    api.downloadFile.and.returnValue(of(new Blob()));
    TestBed.configureTestingModule({ providers: [
      AmbalajService,
      { provide: BaseApiService, useValue: api },
    ] });
    service = TestBed.inject(AmbalajService);
  });

  it('projeleri server-side arama ve sayfalama parametreleriyle alır', () => {
    service.getProjeler({
      arama: '699',
      projeTipiId: 1,
      grup: 1,
      pageNumber: 2,
      pageSize: 25,
      includeSummary: false,
    }).subscribe();

    expect(api.get).toHaveBeenCalledTimes(1);
    expect(api.get.calls.mostRecent().args[0]).toMatch(/\/api\/ambalaj\/projeler$/i);
    const params = (api.get.calls.mostRecent().args[1] as { params: HttpParams }).params;
    expect(params.get('arama')).toBe('699');
    expect(params.get('projeTipiId')).toBe('1');
    expect(params.get('grup')).toBe('1');
    expect(params.get('pageNumber')).toBe('2');
    expect(params.get('pageSize')).toBe('25');
    expect(params.get('includeSummary')).toBe('false');
  });

  it('özel sandıkları tür filtresi ve sayfalama parametreleriyle alır', () => {
    service.getBagimsizSandiklar({
      arama: 'radyatör',
      tur: 2,
      pageNumber: 3,
      pageSize: 50,
      includeSummary: false,
    }).subscribe();

    expect(api.get.calls.mostRecent().args[0]).toMatch(/\/api\/ambalaj\/bagimsiz-sandiklar$/i);
    const params = (api.get.calls.mostRecent().args[1] as { params: HttpParams }).params;
    expect(params.get('arama')).toBe('radyatör');
    expect(params.get('tur')).toBe('2');
    expect(params.get('pageNumber')).toBe('3');
    expect(params.get('pageSize')).toBe('50');
    expect(params.get('includeSummary')).toBe('false');
  });

  it('proje planını kaynak tipi ve grupla ister', () => {
    service.getPlan(682, 2, 1).subscribe();

    const url = api.get.calls.mostRecent().args[0] as string;
    expect(url).toMatch(/\/api\/ambalaj\/projeler\/682\/plan\?/i);
    expect(url).toContain('kaynakProjeTipiId=2');
    expect(url).toContain('grup=1');
  });

  it('plan seçimini referans gövdesiyle kaydeder', () => {
    service.planKaydet(682, 'FP-01', [10, 11], 1, 2, 1).subscribe();

    const [url, body] = api.put.calls.mostRecent().args;
    expect(url as string).toMatch(/\/api\/ambalaj\/projeler\/682\/plan\?/i);
    expect(body).toEqual({
      firinPartiNo: 'FP-01',
      seciliKaynakSandikIds: [10, 11],
      grup: 1,
      durumId: 2,
    });
  });

  it('üretim formunu proje bazlı PDF endpointinden indirir', () => {
    service.uretimFormuIndir(682, 1).subscribe();

    expect(api.downloadFile.calls.mostRecent().args[0] as string)
      .toMatch(/\/api\/pdf\/ambalaj-uretim\/682\?tur=1$/i);
  });

  it('özel sandık için hafif proje sandığı seçenek endpointini kullanır', () => {
    service.getProjeSandikSecenekleri(531).subscribe();

    expect(api.get.calls.mostRecent().args[0] as string)
      .toMatch(/\/api\/ambalaj\/projeler\/531\/sandik-secenekleri$/i);
  });

  it('talep edenleri ambalaj yetkili kullanıcı seçenek endpointinden alır', () => {
    service.getTalepEdenKullanicilar().subscribe();

    expect(api.get.calls.mostRecent().args[0] as string)
      .toMatch(/\/api\/ambalaj\/talep-eden-kullanicilar$/i);
  });
});
