import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { API } from '../constants/api-endpoints';
import { YuklemePlanlamaService } from './yukleme-planlama.service';
import {
  EkipmanKaynakTuru,
  EkipmanKonfigurasyonKaydi,
  PlanYukIzni,
  YuklemeLokasyonTercihi,
  YuklemePlaniHesaplaIstegi,
} from '../../shared/models/index';

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
      manuelYukler: [{
        kod: 'Ek sandık 1', aciklama: null, yukTuruId: 1, boyMm: 1200, enMm: 800, yukseklikMm: 900, brutKg: 450, adet: 1,
        projeId: 7, lokasyonId: null, ozelTasimaNotu: null,
        birimler: [{
          birimNo: 1, dahil: true, dondurulebilirMi: false, usteKonabilirMi: true, altaKalabilirMi: true, ustYukSiniriKg: 450,
          elleDegisenIzinler: PlanYukIzni.Yok,
        }],
      }],
    };
    service.planHesapla(istek).subscribe();
    const cagri = http.expectOne(API.YUKLEME_PLANLARI.YERLESIM_HESAPLA);
    expect(cagri.request.method).toBe('POST');
    expect(cagri.request.url).toContain('/yukleme-planlari/yerlesim-hesapla');
    expect(cagri.request.body).toEqual(istek);
    expect([cagri.request.body.lokasyonTercihi, cagri.request.body.sandikYukleri[0].elleDegisenIzinler]).toEqual([2, 9]);
    expect(cagri.request.body.manuelYukler[0].birimler[0].birimNo).toBe(1);
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

  describe('ekipman kitaplığı: ekrandan ekleme ve güncelleme', () => {
    const kayit: EkipmanKonfigurasyonKaydi = {
      kod: 'LB-3D', ad: 'Lowbed 3 dingil', tipId: 22, uretici: 'Jenerik', modelAdi: 'LB', kaynakTuru: EkipmanKaynakTuru.SahadaOlculdu,
      kaynakAciklama: null, kaynakTarihi: '2026-11-20', aciklama: null, teknikVeriJson: '{"semaSurumu":1,"yuzeyler":[]}',
    };

    it('yeni ekipman konfigürasyonlar ucuna POST edilir; gövdede beklenen revizyon yoktur', () => {
      let kod = '';
      service.ekipmanEkle(kayit).subscribe((r) => (kod = r.value?.kod ?? ''));
      const cagri = http.expectOne(API.EKIPMAN_KITAPLIGI.KONFIGURASYON_EKLE);
      expect(cagri.request.method).toBe('POST');
      expect(cagri.request.url).toMatch(/\/ekipman-kitapligi\/konfigurasyonlar$/);
      expect(cagri.request.body).toEqual(kayit);
      expect([cagri.request.body.kaynakTuru, 'beklenenRevizyonNo' in cagri.request.body]).toEqual([4, false]);
      cagri.flush({ id: 9, kod: 'LB-3D' });
      expect(kod).toBe('LB-3D');
    });

    it('güncelleme kaydın ucuna PUT edilir ve ekrandaki son revizyon numarasını taşır', () => {
      service.ekipmanGuncelle(7, { ...kayit, beklenenRevizyonNo: 3 }).subscribe();
      const cagri = http.expectOne(API.EKIPMAN_KITAPLIGI.KONFIGURASYON_GUNCELLE(7));
      expect(cagri.request.method).toBe('PUT');
      expect(cagri.request.url).toMatch(/\/ekipman-kitapligi\/konfigurasyonlar\/7$/);
      expect(cagri.request.body).toEqual({ ...kayit, beklenenRevizyonNo: 3 });
      cagri.flush({});
    });

    it('400 yanıtındaki mesaj ve sorun listesi, 409 yanıtındaki durum kodu sonuca taşınır', () => {
      const sonuclar: { isSuccess: boolean; error?: string; statusCode?: number; issues?: unknown }[] = [];
      service.ekipmanGuncelle(7, { ...kayit, beklenenRevizyonNo: 3 }).subscribe((r) => sonuclar.push(r));
      http.expectOne(API.EKIPMAN_KITAPLIGI.KONFIGURASYON_GUNCELLE(7))
        .flush({ message: 'Teknik veri geçersiz.', issues: ['Dara büyük.'] }, { status: 400, statusText: 'Bad Request' });
      service.ekipmanEkle(kayit).subscribe((r) => sonuclar.push(r));
      http.expectOne(API.EKIPMAN_KITAPLIGI.KONFIGURASYON_EKLE)
        .flush({ message: "'LB-3D' kodu kullanılıyor." }, { status: 409, statusText: 'Conflict' });
      expect(sonuclar.map((r) => [r.isSuccess, r.statusCode, r.error, r.issues])).toEqual([
        [false, 400, 'Teknik veri geçersiz.', ['Dara büyük.']],
        [false, 409, "'LB-3D' kodu kullanılıyor.", undefined],
      ]);
    });
  });
});
