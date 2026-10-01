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
    api = jasmine.createSpyObj('FinansService', ['giderKategorileri', 'isRaporu', 'downloadErrorMessage', 'paraBirimleri', 'raporOnizleme']);
    api.paraBirimleri.and.returnValue(of({ isSuccess: true, value: [
      { id: 1, kod: 'TRY', ad: 'Türk lirası', sembol: '₺', aktif: true, sira: 1 },
      { id: 2, kod: 'EUR', ad: 'Euro', sembol: '€', aktif: true, sira: 2 },
    ] }));
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

  it('önizleme seçili tür ve filtreyle dosyanın satırlarını gösterir; tür veya filtre değişince yenilenmesini ister', () => {
    api.raporOnizleme.and.returnValue(of({ isSuccess: true, value: {
      baslik: 'Finans İşleri Raporu', sutunlar: ['Proje No', 'Net'], satirlar: [['PA-2', '2.500,00']], toplamSatir: 120,
    } }));
    const fixture = TestBed.createComponent(FinansRaporlarComponent); fixture.detectChanges();
    const c = fixture.componentInstance;
    const el = fixture.nativeElement as HTMLElement;
    c.filtre.projeNo = 'PA-2';
    c.onizle(); fixture.detectChanges();
    expect(api.raporOnizleme).toHaveBeenCalledOnceWith('is', jasmine.objectContaining({ projeNo: 'PA-2' }));
    expect(el.querySelector('.v2-preview-table tbody td')!.textContent).toBe('PA-2');
    expect(el.querySelector('.v2-report-preview')!.textContent).toContain('120 satır');
    expect(el.querySelector('.v2-preview-stale')).toBeNull();
    c.tur = 'gider'; fixture.detectChanges();
    expect(el.querySelector('.v2-preview-stale')).not.toBeNull();
    c.tur = 'is'; c.filtre.projeNo = 'PA-3'; fixture.detectChanges();
    expect(el.querySelector('.v2-preview-stale')).not.toBeNull();
  });
});
