import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AmbalajUretimListesiComponent } from './ambalaj-uretim-listesi.component';
import { AmbalajService } from '../../../core/services/ambalaj.service';
import { AmbalajYasamDongusuService } from '../../../core/services/ambalaj-yasam-dongusu.service';
import { ProjeService } from '../../../core/services/proje.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ToastService } from '../../../core/services/toast.service';
import { AmbalajProjeOzetDto, AmbalajUretimKalemDto, AmbalajUretimPlanDto, ApiResult } from '../../../shared/models';

describe('Üretim formu indirilmeden önce verilen ambalaj kararı', () => {
  let ambalaj: jasmine.SpyObj<AmbalajService>;
  let toast: jasmine.SpyObj<ToastService>;

  beforeEach(() => {
    ambalaj = jasmine.createSpyObj('AmbalajService', ['ambalajKarariKaydet', 'uretimFormuIndir']);
    ambalaj.uretimFormuIndir.and.returnValue(of(new Blob(['%PDF-'])));
    toast = jasmine.createSpyObj('ToastService', ['success', 'error', 'info', 'warning']);
    spyOn(AmbalajUretimListesiComponent.prototype, 'ngOnInit').and.stub();
    spyOn(HTMLAnchorElement.prototype, 'click');
    TestBed.configureTestingModule({
      imports: [AmbalajUretimListesiComponent],
      providers: [
        provideRouter([]),
        { provide: AmbalajService, useValue: ambalaj },
        { provide: AmbalajYasamDongusuService, useValue: {} },
        { provide: ProjeService, useValue: {} },
        { provide: PermissionService, useValue: { loaded: () => true, hasAccess: () => true, canWrite: () => true } },
        { provide: ToastService, useValue: toast },
      ],
    });
  });

  function kararsizKalemUyarisi() {
    const component = TestBed.createComponent(AmbalajUretimListesiComponent).componentInstance;
    component.pdfUyari.set({
      proje: { projeId: 7, projeNo: 'PA-1', fbNo: 'FB-1' } as AmbalajProjeOzetDto,
      tur: 1,
      kalemler: [{ kaynakSandikId: 41 } as AmbalajUretimKalemDto],
    });
    return component;
  }

  it('karar onaya alındıysa (202) form kararsız kalemlerle indirilmez', () => {
    ambalaj.ambalajKarariKaydet.and.returnValue(of({ isSuccess: true, statusCode: 202 } as ApiResult<AmbalajUretimPlanDto>));
    const component = kararsizKalemUyarisi();

    component.pdfKarariUygula(true);

    expect(ambalaj.uretimFormuIndir).not.toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalled();
    expect(component.pdfUyari()).toBeNull();
  });

  it('kararlar uygulandıysa form indirilir', () => {
    ambalaj.ambalajKarariKaydet.and.returnValue(of({ isSuccess: true, value: {} as AmbalajUretimPlanDto }));
    const component = kararsizKalemUyarisi();

    component.pdfKarariUygula(true);

    expect(ambalaj.ambalajKarariKaydet).toHaveBeenCalledWith(41, true, '');
    expect(ambalaj.uretimFormuIndir).toHaveBeenCalledWith(7, 1);
  });
});
