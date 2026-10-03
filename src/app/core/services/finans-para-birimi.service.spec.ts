import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { FinansParaBirimi } from '../../shared/models/finans-v2.model';
import { FinansParaBirimiService } from './finans-para-birimi.service';
import { FinansService } from './finans.service';

describe('FinansParaBirimiService tanım tablosu', () => {
  let api: jasmine.SpyObj<FinansService>;
  let service: FinansParaBirimiService;
  const TRY: FinansParaBirimi = { id: 1, kod: 'TRY', ad: 'Türk lirası', sembol: '₺', aktif: true, sira: 1 };
  const EUR: FinansParaBirimi = { id: 2, kod: 'EUR', ad: 'Euro', sembol: '€', aktif: true, sira: 2 };
  const USD: FinansParaBirimi = { id: 3, kod: 'USD', ad: 'ABD doları', sembol: '$', aktif: false, sira: 3 };

  beforeEach(() => {
    api = jasmine.createSpyObj<FinansService>('FinansService', ['paraBirimleri']);
    api.paraBirimleri.and.returnValue(of({ isSuccess: true, value: [TRY, EUR, USD] }));
    TestBed.configureTestingModule({ providers: [{ provide: FinansService, useValue: api }] });
    service = TestBed.inject(FinansParaBirimiService);
  });

  it('tanımları bir kez yükler; zorla yenilemede yeniden ister', () => {
    service.yukle();
    service.yukle();
    expect(api.paraBirimleri).toHaveBeenCalledOnceWith(false);
    service.yukle(true);
    expect(api.paraBirimleri).toHaveBeenCalledTimes(2);
  });

  it('seçeneklerde yalnız aktifleri verir, kaydın pasif kodunu korur; USD aktifleşince listeye girer', () => {
    expect(service.varsayilan()).toBe('');
    service.yukle();
    expect(service.aktifKodlar()).toEqual(['TRY', 'EUR']);
    expect(service.varsayilan()).toBe('TRY');
    expect(service.secenekler()).toEqual(['TRY', 'EUR']);
    expect(service.secenekler('USD')).toEqual(['TRY', 'EUR', 'USD']);
    expect(service.ad('EUR')).toBe('EUR · Euro');
    expect(service.ad('GBP')).toBe('GBP');
    api.paraBirimleri.and.returnValue(of({ isSuccess: true, value: [TRY, EUR, { ...USD, aktif: true }] }));
    service.yukle(true);
    expect(service.secenekler()).toEqual(['TRY', 'EUR', 'USD']);
  });

  it('başarısız yükleme tanımları değiştirmez ve sonraki denemeye izin verir', () => {
    api.paraBirimleri.and.returnValue(of({ isSuccess: false, error: 'Erişim reddedildi' }));
    service.yukle();
    expect(service.tumu()).toEqual([]);
    api.paraBirimleri.and.returnValue(of({ isSuccess: true, value: [TRY] }));
    service.yukle();
    expect(service.aktifKodlar()).toEqual(['TRY']);
  });
});
