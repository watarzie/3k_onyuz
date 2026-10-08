import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { API } from '../constants/api-endpoints';
import { SevkiyatService } from './sevkiyat.service';
import { SevkSeferiOzet, aracPlakaBicimle, sandikSevkAdayiMi } from '../../shared/models';

describe('SevkiyatService ve sevk kuralları', () => {
  let service: SevkiyatService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(SevkiyatService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('sefer listesi yalnız dolu süzgeçleri kırpılmış olarak gönderir', () => {
    service.seferler({ baslangic: '2026-10-01', plaka: ' 34 abc ', projeNo: '  ', projeTipiId: 2 }, 3, 50).subscribe();
    const istek = http.expectOne(r => r.url === API.SEVKIYAT.SEFERLER);
    expect(istek.request.params.keys().sort()).toEqual(['baslangic', 'pageNumber', 'pageSize', 'plaka', 'projeTipiId']);
    expect(istek.request.params.get('plaka')).toBe('34 abc');
    expect(istek.request.params.get('pageNumber')).toBe('3');
    istek.flush({ items: [], totalCount: 0 });
  });

  it('gerçek sefer kimlikle, eski kayıt plaka ve sevk günüyle okunur', () => {
    const ozet = { seferId: 7, eskiKayit: false, aracPlaka: '34 ABC 123', sevkTarihi: '2026-10-08T09:30:00' } as SevkSeferiOzet;
    service.seferDetay(ozet).subscribe();
    http.expectOne(API.SEVKIYAT.SEFER_DETAY(7)).flush({});

    service.seferDetay({ ...ozet, seferId: null, eskiKayit: true }).subscribe();
    const eski = http.expectOne(r => r.url === API.SEVKIYAT.ESKI_SEFER_DETAY);
    expect(eski.request.params.get('plaka')).toBe('34 ABC 123');
    expect(eski.request.params.get('tarih')).toBe('2026-10-08');
    eski.flush({});
  });

  it('toplu sevkin 409 engelleri sonucun issues alanında gelir', () => {
    let sonuc: any;
    service.topluSevk({ islemAnahtari: 'a', sevkTarihi: '2026-10-08T09:30:00', aracPlaka: '34ABC123', projeler: [] })
      .subscribe(r => (sonuc = r));
    const issues = [{ projeId: 1, projeNo: 'P-1', sandikIds: [12], mesaj: 'Engel' }];
    http.expectOne(API.SEVKIYAT.TOPLU_SEVK).flush({ message: 'Engel var.', issues }, { status: 409, statusText: 'Conflict' });
    expect(sonuc.isSuccess).toBeFalse();
    expect(sonuc.issues).toEqual(issues);
  });

  it('plaka gösterimi sunucudaki AracPlakaKurali ile aynıdır', () => {
    expect(aracPlakaBicimle('34-abc-123')).toBe('34 ABC 123');
    expect(aracPlakaBicimle(' 06 a 1234 ')).toBe('06 A 1234');
    expect(aracPlakaBicimle('WX-1234-AB')).toBe('WX1234AB');
    expect(aracPlakaBicimle('   ')).toBe('');
  });

  it('sevke hazır sandık: kapalı, sevk edilmemiş, sahaya aktarılmamış', () => {
    const kapali = { id: 1, sandikNo: '1', durumId: 3, durumMetni: 'Kapalı' } as any;
    expect(sandikSevkAdayiMi(kapali)).toBeTrue();
    expect(sandikSevkAdayiMi({ ...kapali, durumId: 2 })).toBeFalse();
    expect(sandikSevkAdayiMi({ ...kapali, sahayaAktarildiMi: true })).toBeFalse();
    expect(sandikSevkAdayiMi({ ...kapali, sahaUzerindenSevkEdildiMi: true })).toBeFalse();
  });
});
