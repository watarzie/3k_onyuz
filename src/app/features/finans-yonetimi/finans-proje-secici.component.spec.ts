import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { FinansProjeSeciciComponent } from './finans-proje-secici.component';
import { FinansService } from '../../core/services/finans.service';
import { ApiResult } from '../../shared/models/common.model';
import { FinansSayfaliSonuc } from '../../shared/models/finans.model';

type Project = { projeId: number; projeNo: string; musteri: string };
type Page = FinansSayfaliSonuc<Project>;

describe('Finans proje seçici sunucu sayfalaması', () => {
  let api: jasmine.SpyObj<FinansService>;
  const project: Project = { projeId: 9, projeNo: 'QA-9', musteri: 'Test firma' };
  const page = (number = 1): Page => ({
    items: [project],
    toplamlar: [],
    pageNumber: number,
    pageSize: 20,
    totalCount: 21,
    totalPages: 2,
    hasPreviousPage: number > 1,
    hasNextPage: number < 2,
  });
  beforeEach(() => {
    api = jasmine.createSpyObj('FinansService', ['projeSecenekleri']);
    api.projeSecenekleri.and.returnValue(of({ isSuccess: true, value: page() }));
    TestBed.configureTestingModule({
      imports: [FinansProjeSeciciComponent],
      providers: [{ provide: FinansService, useValue: api }],
    });
  });
  it('açılmadan veri çekmez; aramayı geciktirip sunucuya ilk sayfa ile gönderir', fakeAsync(() => {
    const f = TestBed.createComponent(FinansProjeSeciciComponent);
    f.detectChanges();
    expect(api.projeSecenekleri).not.toHaveBeenCalled();
    f.componentInstance.ac();
    tick(249);
    expect(api.projeSecenekleri).not.toHaveBeenCalled();
    tick(1);
    expect(api.projeSecenekleri).toHaveBeenCalledWith('', 1);
    f.componentInstance.arama = 'QA';
    f.componentInstance.ara();
    tick(250);
    expect(api.projeSecenekleri).toHaveBeenCalledWith('QA', 1);
  }));
  it('yeni aramanın debounce süresi içinde gelen eski yanıtı da yok sayar', fakeAsync(() => {
    const old = new Subject<ApiResult<Page>>();
    api.projeSecenekleri.and.returnValues(old, of({ isSuccess: true, value: page() }));
    const f = TestBed.createComponent(FinansProjeSeciciComponent);
    f.detectChanges();
    const c = f.componentInstance;
    c.ac();
    tick(250);
    c.arama = 'QA';
    c.ara();
    old.next({ isSuccess: true, value: { ...page(), items: [{ ...project, projeNo: 'ESKI' }] } });
    expect(c.sonuc()).toBeNull();
    expect(c.loading()).toBeTrue();
    tick(250);
    expect(c.sonuc()?.items[0].projeNo).toBe('QA-9');
  }));
  it('sonraki sayfayı backendden ister, seçimde proje kimliğini yayınlar', fakeAsync(() => {
    const f = TestBed.createComponent(FinansProjeSeciciComponent);
    f.detectChanges();
    const c = f.componentInstance;
    c.ac();
    tick(250);
    c.sayfa(1);
    tick(250);
    expect(api.projeSecenekleri).toHaveBeenCalledWith('', 2);
    let selected: Project | null | undefined;
    c.secildi.subscribe((value) => (selected = value));
    c.sec(project);
    expect(selected).toEqual(project);
    expect(c.acik()).toBeFalse();
    c.sec(null);
    expect(selected).toBeNull();
  }));
  it('hata cevabında eski seçenekleri temizler ve bekleme göstergesini kapatır', fakeAsync(() => {
    api.projeSecenekleri.and.returnValue(of({ isSuccess: false, error: 'Erişim reddedildi.' }));
    const f = TestBed.createComponent(FinansProjeSeciciComponent);
    f.detectChanges();
    const c = f.componentInstance;
    c.ac();
    tick(250);
    expect(c.sonuc()).toBeNull();
    expect(c.loading()).toBeFalse();
    expect(c.hata()).toBe('Erişim reddedildi.');
  }));
});
