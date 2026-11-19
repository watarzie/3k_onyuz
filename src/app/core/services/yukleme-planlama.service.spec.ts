import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { API } from '../constants/api-endpoints';
import { YuklemePlanlamaService } from './yukleme-planlama.service';
import { PlanYukIzni, YuklemeLokasyonTercihi, YuklemePlaniHesaplaIstegi } from '../../shared/models/index';

describe('YuklemePlanlamaService yükleme simülasyonu sözleşmesi', () => {
  let service: YuklemePlanlamaService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(YuklemePlanlamaService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('hesap isteği tek uca gider; yükleme yeri ve sandık seçimleri gövdede olduğu gibi taşınır', () => {
    const istek: YuklemePlaniHesaplaIstegi = {
      planId: null, beklenenRevizyonNo: null, projeIdleri: [7], tasimaAilesiId: 1,
      lokasyonTercihi: YuklemeLokasyonTercihi.LokasyonaGoreAyri,
      ayarlar: { yerlesimBosluguMm: 50, agirlikMerkeziSapmaYuzde: null, mevcutAraclar: [], tipIdleri: [3] },
      sandikYukleri: [{
        sandikId: 71, dahil: false, dondurulebilirMi: true, usteKonabilirMi: true, altaKalabilirMi: false, ustYukSiniriKg: null,
        elleDegisenIzinler: PlanYukIzni.Dondurme | PlanYukIzni.UstYukSiniri,
      }],
    };
    service.planHesapla(istek).subscribe();
    const cagri = http.expectOne(API.YUKLEME_PLANLARI.YERLESIM_HESAPLA);
    expect(cagri.request.method).toBe('POST');
    expect(cagri.request.url).toContain('/yukleme-planlari/yerlesim-hesapla');
    expect(cagri.request.body).toEqual(istek);
    expect([cagri.request.body.lokasyonTercihi, cagri.request.body.sandikYukleri[0].elleDegisenIzinler]).toEqual([2, 9]);
    cagri.flush({});
  });

  it('yük önizlemesi proje kimliklerini gövdede gönderir ve yanıtı sonuç olarak sarar', () => {
    let yukSayisi = -1;
    service.yukOnizleme([7, 8]).subscribe((r) => (yukSayisi = r.isSuccess ? r.value!.yukler.length : -1));
    const cagri = http.expectOne(API.YUKLEME_PLANLARI.YUK_ONIZLEME);
    expect(cagri.request.method).toBe('POST');
    expect(cagri.request.url).toContain('/yukleme-planlari/yuk-onizleme');
    expect(cagri.request.body).toEqual({ projeIdleri: [7, 8] });
    cagri.flush({ yukler: [], farkliLokasyonSayisi: 0 });
    expect(yukSayisi).toBe(0);
  });
});
