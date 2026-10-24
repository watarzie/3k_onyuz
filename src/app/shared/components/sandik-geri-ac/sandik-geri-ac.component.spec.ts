import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { SandikGeriAcComponent } from './sandik-geri-ac.component';
import { LookupService } from '../../../core/services/lookup.service';
import { ProjeService } from '../../../core/services/proje.service';
import { ToastService } from '../../../core/services/toast.service';

describe('Sandık geri açma penceresi', () => {
  let proje: jasmine.SpyObj<ProjeService>;
  let toast: jasmine.SpyObj<ToastService>;

  beforeEach(() => {
    proje = jasmine.createSpyObj('ProjeService', ['sandikKapat']);
    toast = jasmine.createSpyObj('ToastService', ['success', 'error']);
    TestBed.configureTestingModule({
      imports: [SandikGeriAcComponent],
      providers: [
        { provide: ProjeService, useValue: proje },
        { provide: ToastService, useValue: toast },
        {
          provide: LookupService,
          useValue: {
            getLookups: () => of({
              LookupSandikAcilmaSebebi: [{ id: 1, anahtar: 1, deger: 'Trafo kurulum' }, { id: 2, anahtar: 2, deger: 'Tadilat' }],
            }),
          },
        },
      ],
    });
  });

  function render() {
    const fixture = TestBed.createComponent(SandikGeriAcComponent);
    fixture.componentRef.setInput('sandikId', 30);
    fixture.componentRef.setInput('sandikNo', '4');
    fixture.detectChanges();
    return { fixture, c: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
  }

  it('sebepleri lookup tablosundan listeler; sebep seçilmeden geri açılmaz', () => {
    const { el } = render();
    const secenekler = Array.from(el.querySelectorAll('.sga-sebep option')).map(o => o.textContent?.trim());
    expect(secenekler).toEqual(['Sebep seçin', 'Trafo kurulum', 'Tadilat']);
    expect((el.querySelector('.sga-onayla') as HTMLButtonElement).disabled).toBeTrue();
  });

  it('seçilen sebep ve kırpılmış notla geri alır, başarıda tamamlandı yayar', () => {
    proje.sandikKapat.and.returnValue(of({ isSuccess: true, value: true }));
    const { fixture, c, el } = render();
    const tamamlandi = jasmine.createSpy('tamamlandi');
    c.tamamlandi.subscribe(tamamlandi);
    c.sebepId.set(2);
    c.not.set('  kapak değişti  ');
    fixture.detectChanges();

    (el.querySelector('.sga-onayla') as HTMLButtonElement).click();

    expect(proje.sandikKapat).toHaveBeenCalledOnceWith(30, false, 2, 'kapak değişti');
    expect(tamamlandi).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalled();
  });

  it('sunucu reddederse mesajı gösterir ve pencere açık kalır', () => {
    proje.sandikKapat.and.returnValue(of({ isSuccess: false, error: 'Seçilen geri açma sebebi bulunamadı.' }));
    const { c } = render();
    const tamamlandi = jasmine.createSpy('tamamlandi');
    c.tamamlandi.subscribe(tamamlandi);
    c.sebepId.set(1);

    c.onayla();

    expect(proje.sandikKapat).toHaveBeenCalledOnceWith(30, false, 1, null);
    expect(toast.error).toHaveBeenCalledWith('Seçilen geri açma sebebi bulunamadı.');
    expect(tamamlandi).not.toHaveBeenCalled();
    expect(c.kaydediliyor()).toBeFalse();
  });
});
