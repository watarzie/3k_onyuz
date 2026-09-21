import { TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { FinansRaporlarComponent } from './finans-raporlar.component';
import { FinansService } from '../../core/services/finans.service';
import { PermissionService } from '../../core/services/permission.service';
import { ToastService } from '../../core/services/toast.service';
import { TranslationService } from '../../core/services/translation.service';

describe('Finans raporu indirme ve çeviri', () => {
  let api: jasmine.SpyObj<FinansService>;
  let toast: jasmine.SpyObj<ToastService>;
  beforeEach(() => {
    api = jasmine.createSpyObj('FinansService', ['giderKategorileri', 'isRaporu', 'downloadErrorMessage']);
    toast = jasmine.createSpyObj('ToastService', ['error']);
    api.giderKategorileri.and.returnValue(of({ isSuccess: true, value: [] }));
    TestBed.configureTestingModule({ imports: [FinansRaporlarComponent], providers: [
      { provide: FinansService, useValue: api }, { provide: ToastService, useValue: toast },
      { provide: PermissionService, useValue: { hasAccess: () => true } },
    ] });
    TestBed.inject(TranslationService).switchLanguage('tr');
  });
  afterEach(() => TestBed.inject(TranslationService).switchLanguage('tr'));

  it('Blob hata gövdesini ortak servisle ayrıştırıp sunucu mesajını gösterir', fakeAsync(() => {
    const failure = { error: new Blob(['{"message":"Rapor sınırı aşıldı"}'], { type: 'application/json' }) };
    api.isRaporu.and.returnValue(throwError(() => failure));
    api.downloadErrorMessage.and.returnValue(Promise.resolve('Rapor sınırı aşıldı'));
    const fixture = TestBed.createComponent(FinansRaporlarComponent); fixture.detectChanges();
    fixture.componentInstance.indir('pdf'); flushMicrotasks();
    expect(api.downloadErrorMessage).toHaveBeenCalledWith(failure, jasmine.any(String));
    expect(toast.error).toHaveBeenCalledWith('Rapor sınırı aşıldı');
    expect(fixture.componentInstance.loading()).toBeFalse();
  }));

  it('İngilizce görünümde rapor türü API değerlerini değiştirmez', () => {
    const fixture = TestBed.createComponent(FinansRaporlarComponent); fixture.detectChanges();
    TestBed.inject(TranslationService).switchLanguage('en'); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('h3').textContent).toBe('Finance reports');
    const reportSelect = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    expect(reportSelect.options[0].value).toBe('is');
    expect(reportSelect.options[0].textContent).toBe('Work / project / PO / invoice');
  });
});
