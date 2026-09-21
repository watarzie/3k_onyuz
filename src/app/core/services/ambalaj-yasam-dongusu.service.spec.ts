import { TestBed } from '@angular/core/testing';
import { HttpParams } from '@angular/common/http';
import { of } from 'rxjs';
import { BaseApiService } from './base-api.service';
import { AmbalajYasamDongusuService } from './ambalaj-yasam-dongusu.service';
import { AmbalajGerceklesme } from '../../shared/models/ambalaj-yasam-dongusu.model';

describe('AmbalajYasamDongusuService', () => {
  let api: jasmine.SpyObj<BaseApiService>;
  let service: AmbalajYasamDongusuService;
  beforeEach(() => {
    api = jasmine.createSpyObj('BaseApiService', ['get', 'post', 'put', 'downloadFile']);
    api.get.and.returnValue(of({ isSuccess: true })); api.put.and.returnValue(of({ isSuccess: true }));
    api.downloadFile.and.returnValue(of(new Blob()));
    TestBed.configureTestingModule({ providers: [{ provide: BaseApiService, useValue: api }] });
    service = TestBed.inject(AmbalajYasamDongusuService);
  });
  it('takvim aralığını saat dilimi dönüştürmeden gönderir', () => {
    service.rapor('2026-09-01', '2026-09-30').subscribe();
    const [, options] = api.get.calls.mostRecent().args;
    const params = (options as { params: HttpParams }).params;
    expect(params.get('baslangic')).toBe('2026-09-01'); expect(params.get('bitis')).toBe('2026-09-30');
    service.raporIndir('2026-09-01', '2026-09-30', 'xlsx').subscribe();
    expect(api.downloadFile.calls.mostRecent().args[0]).toContain('bitis=2026-09-30&format=xlsx');
  });
  it('düzeltme beklenen sürümü ve nonwood null hacimleri korur', () => {
    service.duzelt({ id: 8, surum: 2, tarih: '2026-09-28', adet: 4, netM3: null, sarfM3: null } as AmbalajGerceklesme, 'Sayım düzeltmesi').subscribe();
    expect(api.put.calls.mostRecent().args[1]).toEqual({ beklenenSurum: 2, tarih: '2026-09-28', adet: 4, netM3: null, sarfM3: null, gerekce: 'Sayım düzeltmesi' });
  });
  it('bağımsız form geçmişi kayıt kimliğine göre sorgulanır', () => {
    service.formlar({ kayitId: 12 }).subscribe();
    const params = (api.get.calls.mostRecent().args[1] as { params: HttpParams }).params;
    expect(params.get('kayitId')).toBe('12'); expect(params.has('projeId')).toBeFalse();
  });
});
