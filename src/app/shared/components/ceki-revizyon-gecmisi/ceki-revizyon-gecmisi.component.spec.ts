import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { CekiRevizyonGecmisiComponent } from './ceki-revizyon-gecmisi.component';
import { CekiRevizyonGecmisiService } from '../../../core/services/ceki-revizyon-gecmisi.service';
import { TranslationService } from '../../../core/services/translation.service';
import { ApiResult, PaginatedList } from '../../models/common.model';
import { CekiRevizyonGecmisiKaydi } from '../../models/ceki-revizyon-gecmisi.model';

describe('Revizyon geçmişi ekranı', () => {
  let fixture: ComponentFixture<CekiRevizyonGecmisiComponent>;
  let service: jasmine.SpyObj<CekiRevizyonGecmisiService>;
  const page = (ids: number[], number = 1): ApiResult<PaginatedList<CekiRevizyonGecmisiKaydi>> => ({
    isSuccess: true, value: {
      items: ids.map(kayitId => ({ kayitId, kaynak: 'talep' } as CekiRevizyonGecmisiKaydi)),
      pageNumber: number, pageSize: 10, totalCount: 21, totalPages: 3,
      hasNextPage: number < 3, hasPreviousPage: number > 1,
    },
  });
  beforeEach(() => {
    service = jasmine.createSpyObj<CekiRevizyonGecmisiService>('history', ['listele', 'detay', 'dosya', 'dosyaHatasi']);
    service.listele.and.returnValue(of(page([1])));
    TestBed.configureTestingModule({ imports: [CekiRevizyonGecmisiComponent], providers: [
      { provide: CekiRevizyonGecmisiService, useValue: service },
      { provide: TranslationService, useValue: { translate: (key: string) => key } },
    ] });
    TestBed.overrideComponent(CekiRevizyonGecmisiComponent, { set: { template: '' } });
    fixture = TestBed.createComponent(CekiRevizyonGecmisiComponent);
    fixture.componentRef.setInput('projeId', 17);
    fixture.componentRef.setInput('projeNo', 'QA-17');
    fixture.detectChanges();
  });

  it('sayfa ve toplamı sunucudan okur', () => {
    expect(service.listele).toHaveBeenCalledWith(17, 1);
    expect(fixture.componentInstance.rows().map(row => row.kayitId)).toEqual([1]);
    expect(fixture.componentInstance.total()).toBe(21);
  });

  it('geciken önceki sayfa yanıtı yeni sayfayı ezmez', () => {
    const old = new Subject<ApiResult<PaginatedList<CekiRevizyonGecmisiKaydi>>>();
    service.listele.and.returnValues(old, of(page([30], 3)));
    fixture.componentInstance.load(17, 2);
    fixture.componentInstance.load(17, 3);
    old.next(page([20], 2));
    expect(fixture.componentInstance.page()).toBe(3);
    expect(fixture.componentInstance.rows()[0].kayitId).toBe(30);
  });

  it('HTTP200 içindeki başarısız sonucu boş başarı gibi göstermez', () => {
    service.listele.and.returnValue(of({ isSuccess: false, error: 'Yetkisiz' }));
    fixture.componentInstance.load(17, 2);
    expect(fixture.componentInstance.error()).toBe('Yetkisiz');
    expect(fixture.componentInstance.loading()).toBeFalse();
    expect(fixture.componentInstance.rows()).toEqual([]);
  });

  it('eski kayıt detayını bugünkü veriden üretmez', () => {
    const row = { kayitId: 1, kaynak: 'ceki', bilgi: 'Eski kayıt' } as CekiRevizyonGecmisiKaydi;
    service.detay.and.returnValue(of({ isSuccess: true, value: { kayit: row, onizleme: null } }));
    fixture.componentInstance.openDetail(row);
    expect(fixture.componentInstance.detail()?.onizleme).toBeNull();
    expect(fixture.componentInstance.detail()?.kayit.bilgi).toBe('Eski kayıt');
  });
});
