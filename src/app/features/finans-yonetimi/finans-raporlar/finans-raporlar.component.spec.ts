import { TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { HttpHeaders, HttpResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { FinansRaporlarComponent } from './finans-raporlar.component';
import { FinansService } from '../../../core/services/finans.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ToastService } from '../../../core/services/toast.service';
import { TranslationService } from '../../../core/services/translation.service';
import { FinansGiderRaporuGruplamasi, FinansIsRaporuKapsami } from '../../../core/constants/enums';

describe('Finans raporu indirme ve çeviri', () => {
  let api: jasmine.SpyObj<FinansService>;
  let toast: jasmine.SpyObj<ToastService>;
  beforeEach(() => {
    api = jasmine.createSpyObj('FinansService', ['giderKategorileri', 'raporDosyasi', 'downloadErrorMessage', 'paraBirimleri', 'raporOnizleme']);
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
    api.raporDosyasi.and.returnValue(throwError(() => failure));
    api.downloadErrorMessage.and.returnValue(Promise.resolve('Rapor sınırı aşıldı'));
    const fixture = TestBed.createComponent(FinansRaporlarComponent); fixture.detectChanges();
    fixture.componentInstance.indir('pdf'); flushMicrotasks();
    expect(api.downloadErrorMessage).toHaveBeenCalledWith(failure, jasmine.any(String));
    expect(toast.error).toHaveBeenCalledWith('Rapor sınırı aşıldı');
    expect(fixture.componentInstance.loading()).toBeFalse();
  }));

  it('dosya sunucunun verdiği adla kaydedilir; işlerde kapsam, giderde gruplama gönderilir', () => {
    const olustur = spyOn(URL, 'createObjectURL').and.returnValue('blob:test');
    spyOn(URL, 'revokeObjectURL');
    const indirilenler: string[] = [];
    spyOn(HTMLAnchorElement.prototype, 'click').and.callFake(function (this: HTMLAnchorElement) {
      indirilenler.push(this.download);
    });
    const body = new Blob(['%PDF-']);
    api.raporDosyasi.and.returnValue(of(new HttpResponse({
      body, headers: new HttpHeaders({ 'Content-Disposition': 'attachment; filename="finans-isleri-siparisi-acilmayan-1.pdf"' }),
    })));
    const fixture = TestBed.createComponent(FinansRaporlarComponent); fixture.detectChanges();
    const c = fixture.componentInstance;
    const el = fixture.nativeElement as HTMLElement;

    (el.querySelector('[data-kapsam="2"]') as HTMLButtonElement).click(); fixture.detectChanges();
    c.indir('pdf');
    expect(api.raporDosyasi).toHaveBeenCalledWith('is', 'pdf', jasmine.any(Object), { kapsam: FinansIsRaporuKapsami.SiparisiAcilmayan });
    expect(olustur).toHaveBeenCalledWith(body);
    expect(indirilenler).toEqual(['finans-isleri-siparisi-acilmayan-1.pdf']);

    (el.querySelector('[data-tur="gider"]') as HTMLButtonElement).click(); fixture.detectChanges();
    expect(el.querySelector('[data-kapsam]')).toBeNull();
    (el.querySelector('[data-gruplama="1"]') as HTMLButtonElement).click(); fixture.detectChanges();
    c.indir('excel');
    expect(api.raporDosyasi).toHaveBeenCalledWith('gider', 'excel', jasmine.any(Object), { gruplama: FinansGiderRaporuGruplamasi.Kategori });

    (el.querySelector('[data-tur="finansal-durum"]') as HTMLButtonElement).click(); fixture.detectChanges();
    c.indir('pdf');
    expect(api.raporDosyasi.calls.mostRecent().args[3]).toEqual({});
  });

  it('finansal durumda yalnız dönem ve para birimi gönderilir; gizli filtre dosyayı daraltmaz', () => {
    const fixture = TestBed.createComponent(FinansRaporlarComponent); fixture.detectChanges();
    const c = fixture.componentInstance;
    const el = fixture.nativeElement as HTMLElement;
    c.filtre = { pageNumber: 1, pageSize: 25, baslangic: '2026-01-01', paraBirimi: 'EUR', projeNo: 'PA-1', odemeDurumu: 1, firma: 'X' };

    c.sec('finansal-durum'); fixture.detectChanges();

    expect(el.querySelector('.v2-advanced')).toBeNull();
    expect(el.querySelector('.v2-report-search')).toBeNull();
    expect(c.gonderilenFiltre()).toEqual(jasmine.objectContaining({ baslangic: '2026-01-01', paraBirimi: 'EUR' }));
    expect(c.gonderilenFiltre().projeNo).toBeUndefined();
    expect(c.gonderilenFiltre().odemeDurumu).toBeUndefined();
    expect(c.gonderilenFiltre().firma).toBeUndefined();
    c.sec('is');
    expect(c.gonderilenFiltre().odemeDurumu).toBeUndefined();
    expect([c.gonderilenFiltre().projeNo, c.gonderilenFiltre().firma]).toEqual(['PA-1', 'X']);
  });

  it('İngilizce görünümde rapor kataloğu API değerlerini değiştirmez', () => {
    const fixture = TestBed.createComponent(FinansRaporlarComponent); fixture.detectChanges();
    TestBed.inject(TranslationService).switchLanguage('en'); fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h3')!.textContent).toBe('Finance reports');
    const ilk = el.querySelector('.rapor-karti') as HTMLButtonElement;
    expect(ilk.dataset['tur']).toBe('is');
    expect(ilk.getAttribute('aria-checked')).toBe('true');
    expect(ilk.querySelector('strong')!.textContent).toBe('Jobs report');
    expect(el.querySelector('[data-kapsam="0"]')!.textContent!.trim()).toBe('Combined');
  });

  it('önizleme seçili tür, seçim ve filtreyle satırları türleriyle gösterir; değişince yenilenmesini ister', () => {
    api.raporOnizleme.and.returnValue(of({ isSuccess: true, value: {
      baslik: 'Finans İşleri Raporu', sutunlar: ['Proje', 'Net'],
      satirlar: [['Siparişi açılan işler (1 kayıt)', ''], ['PA-2', '2.500,00'], ['GENEL TOPLAM (1 kayıt)', '2.500,00']],
      satirTurleri: ['bolum', 'veri', 'genel-toplam'], tablolar: ['İşler'], toplamSatir: 120,
    } }));
    const fixture = TestBed.createComponent(FinansRaporlarComponent); fixture.detectChanges();
    const c = fixture.componentInstance;
    const el = fixture.nativeElement as HTMLElement;
    c.filtre.projeNo = 'PA-2';
    c.onizle(); fixture.detectChanges();
    expect(api.raporOnizleme).toHaveBeenCalledOnceWith(
      'is', jasmine.objectContaining({ projeNo: 'PA-2' }), { kapsam: FinansIsRaporuKapsami.Birlesik },
    );
    const bolum = el.querySelector('.v2-preview-table tbody tr.rapor-satir-bolum td') as HTMLTableCellElement;
    expect([bolum.textContent, bolum.colSpan]).toEqual(['Siparişi açılan işler (1 kayıt)', 2]);
    expect(el.querySelector('.v2-preview-table tbody tr:nth-child(2) td')!.textContent).toBe('PA-2');
    expect(el.querySelector('.rapor-satir-genel')).not.toBeNull();
    expect(el.querySelector('.v2-report-preview')!.textContent).toContain('120 satır');
    expect(el.querySelector('.v2-report-preview')!.textContent).toContain('ilk 1 satır');
    expect(el.querySelector('.v2-preview-stale')).toBeNull();
    c.kapsam = FinansIsRaporuKapsami.SiparisiAcilan; fixture.detectChanges();
    expect(el.querySelector('.v2-preview-stale')).not.toBeNull();
    c.kapsam = FinansIsRaporuKapsami.Birlesik; fixture.detectChanges();
    expect(el.querySelector('.v2-preview-stale')).toBeNull();
    c.tur = 'gider'; fixture.detectChanges();
    expect(el.querySelector('.v2-preview-stale')).not.toBeNull();
    c.tur = 'is'; c.filtre.projeNo = 'PA-3'; fixture.detectChanges();
    expect(el.querySelector('.v2-preview-stale')).not.toBeNull();
  });
});
