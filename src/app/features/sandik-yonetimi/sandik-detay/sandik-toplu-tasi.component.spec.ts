import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { SandikService } from '../../../core/services/sandik.service';
import { TranslationService } from '../../../core/services/translation.service';
import { SandikDto, SandikIcerikDto } from '../../../shared/models/sandik.model';
import { ApiResult } from '../../../shared/models/common.model';
import { SandikTopluTasiComponent } from './sandik-toplu-tasi.component';

describe('Toplu sandık taşıma', () => {
  let fixture: ComponentFixture<SandikTopluTasiComponent>;
  let component: SandikTopluTasiComponent;
  let service: jasmine.SpyObj<SandikService>;
  const urunler: SandikIcerikDto[] = [
    { id: 1, barkodNo: 'AYNI', aciklama: 'İlk', sandikMiktari: 3.25, konulanAdet: 1 },
    { id: 2, barkodNo: 'AYNI', aciklama: 'İkinci', sandikMiktari: 2, konulanAdet: 0 },
  ] as SandikIcerikDto[];

  beforeEach(async () => {
    service = jasmine.createSpyObj<SandikService>('SandikService', ['urunleriTopluTasi']);
    service.urunleriTopluTasi.and.returnValue(of({ isSuccess: false, error: 'Ağ hatası' }));
    await TestBed.configureTestingModule({
      imports: [SandikTopluTasiComponent],
      providers: [
        { provide: SandikService, useValue: service },
        { provide: TranslationService, useValue: { translate: (key: string) => key } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(SandikTopluTasiComponent);
    fixture.componentRef.setInput('projeId', 10);
    fixture.componentRef.setInput('kaynakSandikId', 11);
    fixture.componentRef.setInput('kaynakSandikNo', '1');
    fixture.componentRef.setInput('urunler', urunler);
    fixture.componentRef.setInput('hedefSandiklar', [{ id: 12, sandikNo: '2' }] as SandikDto[]);
    fixture.componentRef.setInput('canWrite', true);
    fixture.detectChanges();
    component = fixture.componentInstance;
    component.hedefSandikId.set(12);
  });

  it('tam tahsisi varsayılan seçer, fiziksel miktarı üretmez ve aynı barkodları birleştirmez', () => {
    expect(component.miktarlar()).toEqual({ 1: 3.25, 2: 2 });
    expect(component.fiziksel(urunler[0])).toBe(1);
    expect(component.fiziksel(urunler[1])).toBe(0);
    component.submit();
    expect(service.urunleriTopluTasi).toHaveBeenCalledTimes(1);
    expect(service.urunleriTopluTasi.calls.mostRecent().args[0].satirlar).toEqual([
      { kaynakSandikIcerikId: 1, tasinanAdet: 3.25 },
      { kaynakSandikIcerikId: 2, tasinanAdet: 2 },
    ]);
  });

  it('aynı isteğin ağ tekrarında anahtarı korur; miktar değişirse yeni anahtar kullanır', () => {
    component.submit();
    const ilkAnahtar = service.urunleriTopluTasi.calls.mostRecent().args[0].islemAnahtari;
    component.submit();
    expect(service.urunleriTopluTasi.calls.mostRecent().args[0].islemAnahtari).toBe(ilkAnahtar);
    component.miktarDegistir(1, 1.2345);
    component.submit();
    expect(service.urunleriTopluTasi.calls.mostRecent().args[0].islemAnahtari).not.toBe(ilkAnahtar);
  });

  it('API isSuccess:false yanıtını modalda gösterir, başarı eventi üretmez', () => {
    const moved = jasmine.createSpy('moved');
    component.moved.subscribe(moved);
    component.submit();
    expect(component.error()).toBe('Ağ hatası');
    expect(component.saving()).toBeFalse();
    expect(moved).not.toHaveBeenCalled();
  });

  it('beklerken ikinci istek ve kapatma engellenir, başarılı yanıt yenilemeyi tetikler', () => {
    const yanit = new Subject<ApiResult<unknown>>();
    service.urunleriTopluTasi.and.returnValue(yanit);
    const moved = jasmine.createSpy('moved');
    const closed = jasmine.createSpy('closed');
    component.moved.subscribe(moved);
    component.closed.subscribe(closed);
    component.submit();
    component.submit();
    component.close();
    expect(service.urunleriTopluTasi).toHaveBeenCalledTimes(1);
    expect(closed).not.toHaveBeenCalled();
    expect(component.saving()).toBeTrue();
    yanit.next({ isSuccess: true });
    yanit.complete();
    expect(moved).toHaveBeenCalledTimes(1);
    expect(component.saving()).toBeFalse();
  });

  for (const miktar of [0, -1, 5, 1.12345, Number.NaN]) {
    it(`geçersiz miktarı reddeder: ${miktar}`, () => {
      component.miktarDegistir(1, miktar);
      component.submit();
      expect(service.urunleriTopluTasi).not.toHaveBeenCalled();
      expect(component.error()).toContain('#1:');
    });
  }

  it('yazma yetkisi veya uygun hedef yoksa istek göndermez', () => {
    fixture.componentRef.setInput('canWrite', false);
    component.submit();
    fixture.componentRef.setInput('canWrite', true);
    component.hedefSandikId.set(999);
    component.submit();
    expect(service.urunleriTopluTasi).not.toHaveBeenCalled();
  });
});
