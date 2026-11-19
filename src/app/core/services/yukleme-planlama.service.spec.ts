import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { API } from '../constants/api-endpoints';
import { YuklemePlanlamaService } from './yukleme-planlama.service';
import { YuklemePlaniHesaplaIstegi } from '../../shared/models/index';

describe('YuklemePlanlamaService tek adımlı hesap sözleşmesi', () => {
  it('yeni ve var olan plan aynı uca, gövde olduğu gibi gider', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const service = TestBed.inject(YuklemePlanlamaService);
    const http = TestBed.inject(HttpTestingController);
    const istek: YuklemePlaniHesaplaIstegi = {
      planId: null, beklenenRevizyonNo: null, projeIdleri: [7], tasimaAilesiId: 1,
      ayarlar: { yerlesimBosluguMm: 30, yukseklikPayiMm: 50, genislikPayiMm: null, uzunlukPayiMm: null, agirlikPayiKg: null,
        yuklemeHareketiPayiMm: null, agirlikMerkeziSapmaYuzde: null, mevcutAraclar: [], tipIdleri: [3] },
    };
    service.planHesapla(istek).subscribe();
    const cagri = http.expectOne(API.YUKLEME_PLANLARI.YERLESIM_HESAPLA);
    expect(cagri.request.method).toBe('POST');
    expect(cagri.request.url).toContain('/yukleme-planlari/yerlesim-hesapla');
    expect(cagri.request.body).toEqual(istek);
    cagri.flush({});
    http.verify();
  });
});
