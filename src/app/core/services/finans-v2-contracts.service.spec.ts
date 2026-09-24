import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API } from '../constants/api-endpoints';
import { BaseApiService } from './base-api.service';
import { FinansService } from './finans.service';

describe('Finans V2 gerçek HTTP istemci sözleşmeleri', () => {
  let service: FinansService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), BaseApiService, FinansService] });
    service = TestBed.inject(FinansService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('ham PO yanıtını tek özet sarmalamasına çevirir; kalem ve oluşturma bilgisini korur', () => {
    const raw = { id: 7, poNumarasi: 'GERCEK-PO', createdDate: '2026-09-19T10:00:00', createdBy: 'Test',
      kalemler: [{ id: 21, isKaydiId: 11, netTutar: 6000, paraBirimi: 'EUR' }] };
    service.siparisDetay(7).subscribe(result => {
      expect(result.isSuccess).toBeTrue();
      expect(result.value?.ozet).toEqual(jasmine.objectContaining(raw));
      expect(result.value?.kalemler).toEqual(jasmine.objectContaining(raw.kalemler));
      expect(result.value?.createdDate).toBe(raw.createdDate);
      expect(result.value?.createdBy).toBe('Test');
      expect(result.value?.belgeler).toEqual([]);
    });
    const request = http.expectOne(API.FINANS.SIPARIS(7));
    expect(request.request.method).toBe('GET');
    request.flush(raw);
  });

  it('PO kaleminde maskelenmiş null tutarı ve hacmi sahte sıfıra dönüştürmez', () => {
    service.siparisDetay(7).subscribe(result => {
      expect(result.value?.kalemler[0].netTutar).toBeNull();
      expect(result.value?.kalemler[0].m3).toBeNull();
      expect(result.value?.ozet.tutarlar).toBeNull();
    });
    http.expectOne(API.FINANS.SIPARIS(7)).flush({ id: 7, tutarlar: null, kalemler: [{ id: 21, netTutar: null, m3: null }] });
  });

  it('eski PO yanıtında opsiyonel koleksiyon ve oluşturma bilgisi yoksa güvenli boş değer kullanır', () => {
    service.siparisDetay(7).subscribe(result => {
      expect(result.value?.ozet.id).toBe(7);
      expect(result.value?.kalemler).toEqual([]);
      expect(result.value?.createdDate).toBe('');
    });
    http.expectOne(API.FINANS.SIPARIS(7)).flush({ id: 7, poNumarasi: 'ESKI-PO' });
  });

  it('PO bulunamadığında hata ve HTTP durumu korunur; boş başarılı detay oluşturmaz', () => {
    service.siparisDetay(404).subscribe(result => {
      expect(result.isSuccess).toBeFalse();
      expect(result.statusCode).toBe(404);
      expect(result.error).toBe('PO bulunamadı.');
      expect(result.value).toBeUndefined();
    });
    http.expectOne(API.FINANS.SIPARIS(404)).flush({ message: 'PO bulunamadı.' }, { status: 404, statusText: 'Not Found' });
  });

  it('PO revizyonunu PUT ile gerekçeli net tutar olarak gönderir ve onay durumunu taşır', () => {
    const body = { poNumarasi: 'PO-R1', siparisTarihi: '2026-09-19', aciklama: 'Düzeltme', gerekce: 'Mutabakat revizyonu',
      kalemler: [{ isKaydiId: 11, adet: 0, m3: 0, netTutar: 6500 }] };
    service.siparisGuncelle(7, body).subscribe(result => expect(result.statusCode).toBe(202));
    const request = http.expectOne(API.FINANS.SIPARIS(7));
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(body);
    request.flush({ statusCode: 202, message: 'Onaya alındı.' }, { status: 202, statusText: 'Accepted' });
  });

  it('fatura revizyonunda PO kalem kimliğini ve fiziksel sıfırları aynen taşır', () => {
    const body = { faturaNumarasi: 'INV-R1', faturaTarihi: '2026-09-19', aciklama: '', gerekce: 'Tutar düzeltmesi',
      belgeMutabakatiniKoru: false, kalemler: [{ siparisKalemiId: 21, adet: 0, m3: 0, netTutar: 4000 }] };
    service.faturaGuncelle(8, body).subscribe(result => {
      expect(result.isSuccess).toBeFalse();
      expect(result.error).toBe('PO bakiyesi değişti.');
    });
    const request = http.expectOne(API.FINANS.FATURA(8));
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(body);
    request.flush({ isSuccess: false, error: 'PO bakiyesi değişti.' });
  });

  it('silme önizlemesi hedefi query ile, silme ise sunucu sürümü ve ikinci onayla POST edilir', () => {
    service.kaliciSilOnizleme('Gider', 31).subscribe(result => expect(result.value?.surum).toBe('SERVER-HASH-31'));
    const preview = http.expectOne(request => request.url === API.FINANS.KALICI_SIL_ONIZLEME);
    expect(preview.request.method).toBe('GET');
    expect(preview.request.params.get('varlikTuru')).toBe('Gider');
    expect(preview.request.params.get('id')).toBe('31');
    preview.flush({ varlikTuru: 'Gider', id: 31, surum: 'SERVER-HASH-31', silinebilir: true, bagimliliklar: [], engeller: [] });
    const body = { varlikTuru: 'Gider' as const, id: 31, surum: 'SERVER-HASH-31', ikinciOnay: true, aciklama: 'Yinelenmiş test kaydı' };
    service.kaliciSil(body).subscribe(result => expect(result.isSuccess).toBeTrue());
    const deletion = http.expectOne(API.FINANS.KALICI_SIL);
    expect(deletion.request.method).toBe('POST');
    expect(deletion.request.body).toEqual(body);
    deletion.flush(null);
  });
});
