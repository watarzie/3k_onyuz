import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { API } from '../constants/api-endpoints';
import { GridService } from './grid.service';

describe('GridService — Grid Sahası uçları', () => {
  let service: GridService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(GridService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('ürünler yalnız dolu süzgeçleri, sayfa bilgisiyle ve kırpılmış olarak gönderir; "tümü" kapsamı açıkça yazılır', () => {
    service.getSahaUrunleri({
      pageNumber: 2, pageSize: 50, kapsam: 'tumu', arama: '  pa-1 ', projeTipiId: 2, projeId: null, gridDurumuId: 9,
      siralama: 'bekleyen', azalan: true,
    }).subscribe();
    const istek = http.expectOne(r => r.url === API.GRID.SAHA_URUNLER);
    expect(istek.request.params.keys().sort()).toEqual(['arama', 'azalan', 'gridDurumuId', 'kapsam', 'pageNumber', 'pageSize', 'projeTipiId', 'siralama']);
    expect(istek.request.params.get('kapsam')).toBe('tumu');
    expect(istek.request.params.get('arama')).toBe('pa-1');
    expect(istek.request.params.get('pageNumber')).toBe('2');
    expect(istek.request.params.get('azalan')).toBe('true');
    istek.flush({ ozet: {}, liste: { items: [] } });
  });

  it('ürünler varsayılan çağrıda yalnız sayfa bilgisini gönderir (varsayılan kapsam "bekleyen" sunucuda)', () => {
    service.getSahaUrunleri({ kapsam: 'bekleyen', azalan: false, arama: '   ', projeTipiId: 0 }).subscribe();
    const istek = http.expectOne(r => r.url === API.GRID.SAHA_URUNLER);
    expect(istek.request.params.keys().sort()).toEqual(['pageNumber', 'pageSize']);
    expect(istek.request.params.get('pageSize')).toBe('25');
    istek.flush({});
  });

  it('mal kabul kayıtları tarih, personel, arama ve tür süzgecini gönderir; varsayılan tür yazılmaz', () => {
    service.getMalKabulKayitlari({ baslangic: '2026-10-01', bitis: '2026-10-15', personelId: 70, arama: ' kapak ', tur: 'hepsi' }).subscribe();
    const istek = http.expectOne(r => r.url === API.GRID.SAHA_MAL_KABUL);
    expect(istek.request.params.keys().sort()).toEqual(['arama', 'baslangic', 'bitis', 'pageNumber', 'pageSize', 'personelId', 'tur']);
    expect(istek.request.params.get('tur')).toBe('hepsi');
    expect(istek.request.params.get('arama')).toBe('kapak');
    istek.flush({});

    service.getMalKabulKayitlari({ tur: 'mal-kabul' }).subscribe();
    const varsayilan = http.expectOne(r => r.url === API.GRID.SAHA_MAL_KABUL);
    expect(varsayilan.request.params.keys().sort()).toEqual(['pageNumber', 'pageSize']);
    varsayilan.flush({});
  });

  it('sunucu hatası ApiResult olarak döner', () => {
    let sonuc: { isSuccess: boolean; error?: string } | undefined;
    service.getMalKabulKayitlari().subscribe(r => (sonuc = r));
    http.expectOne(r => r.url === API.GRID.SAHA_MAL_KABUL).flush({ message: 'Yetkiniz yok.' }, { status: 403, statusText: 'Forbidden' });
    expect(sonuc?.isSuccess).toBeFalse();
    expect(sonuc?.error).toContain('Yetkiniz yok.');
  });
});
