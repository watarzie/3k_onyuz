import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { BaseApiService } from './base-api.service';
import { PdfService } from './pdf.service';
import { CekiRevizyonGecmisiService } from './ceki-revizyon-gecmisi.service';
import { CekiRevizyonGecmisiKaydi } from '../../shared/models/ceki-revizyon-gecmisi.model';

describe('Rapor ve revizyon geçmişi API sözleşmeleri', () => {
  let api: jasmine.SpyObj<BaseApiService>;
  beforeEach(() => {
    api = jasmine.createSpyObj<BaseApiService>('BaseApiService', ['get', 'downloadFile', 'downloadPostFile', 'downloadErrorMessage']);
    api.get.and.returnValue(of({ isSuccess: true }));
    api.downloadFile.and.returnValue(of(new Blob()));
    api.downloadPostFile.and.returnValue(of(new Blob()));
    TestBed.configureTestingModule({ providers: [PdfService, CekiRevizyonGecmisiService, { provide: BaseApiService, useValue: api }] });
  });

  for (const [type, menu] of [[1, 'eksik-raporu'], [2, 'saha-sevk-sonrasi-eksik-raporu'], [3, 'yedek-eksik-raporu']] as const) {
    it(`${type} projesinde PDF/Excel için aynı proje tipi ve seçim gönderilir`, () => {
      const service = TestBed.inject(PdfService);
      service.topluEksikUrunlerPdf([10, 20], type).subscribe();
      service.topluEksikUrunlerExcel([10, 20], type).subscribe();
      expect(api.downloadPostFile).toHaveBeenCalledTimes(2);
      for (const call of api.downloadPostFile.calls.all()) {
        expect(call.args[1]).toEqual({ projeIds: [10, 20], projeTipi: type });
        expect(call.args[2]).toEqual({ headers: { 'X-Menu-Kod': menu } });
      }
    });
  }

  it('geçmiş listesi sunucuya sayfa gönderir, tüm geçmişi indirip kesmez', () => {
    TestBed.inject(CekiRevizyonGecmisiService).listele(17, 3).subscribe();
    expect(api.get.calls.mostRecent().args).toEqual([
      jasmine.stringMatching('/ceki/revizyon-gecmisi/17$'), { params: { pageNumber: 3, pageSize: 10 } },
    ]);
  });

  it('dosya indirmede fiziksel yol yerine proje/kayıt kimliği kullanılır', () => {
    const row = { projeId: 17, kaynak: 'talep', kayitId: 42 } as CekiRevizyonGecmisiKaydi;
    TestBed.inject(CekiRevizyonGecmisiService).dosya(row).subscribe();
    expect(api.downloadFile.calls.mostRecent().args[0]).toMatch(/\/ceki\/revizyon-gecmisi\/17\/talep\/42\/dosya$/);
  });
});
