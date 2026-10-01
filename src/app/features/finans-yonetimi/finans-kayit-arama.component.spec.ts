import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { FINANS_YETKI } from '../../core/constants/yetki-kodlari';
import { FinansService } from '../../core/services/finans.service';
import { PermissionService } from '../../core/services/permission.service';
import { ToastService } from '../../core/services/toast.service';
import { FinansKayitAramaComponent } from './finans-kayit-arama.component';

describe('Finans İş Takibi kalem listesi (tüm dönemler / bekleyen işler)', () => {
  let api: jasmine.SpyObj<FinansService>;
  const bos = { items: [], toplamlar: [], totalCount: 0, totalPages: 0, pageNumber: 1, pageSize: 25, hasPreviousPage: false, hasNextPage: false };
  const izinler = new Set<string>();

  beforeEach(() => {
    izinler.clear();
    [FINANS_YETKI.Modul, FINANS_YETKI.KayitGoruntule, FINANS_YETKI.RaporGoruntule].forEach((x) => izinler.add(x));
    api = jasmine.createSpyObj<FinansService>('FinansService', ['genelArama', 'yaslandirma', 'paraBirimleri']);
    api.genelArama.and.returnValue(of({ isSuccess: true, value: bos }));
    api.yaslandirma.and.returnValue(of({ isSuccess: true, value: bos }));
    api.paraBirimleri.and.returnValue(of({ isSuccess: true, value: [] }));
    TestBed.configureTestingModule({
      imports: [FinansKayitAramaComponent],
      providers: [
        { provide: FinansService, useValue: api },
        { provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['error']) },
        { provide: PermissionService, useValue: { hasAccess: (k: string) => izinler.has(k), canWrite: () => true } },
      ],
    });
  });

  it('varsayılan bütün dönemlerde arar; para birimi filtresi boşsa bütün para birimlerini ister', () => {
    const fixture = TestBed.createComponent(FinansKayitAramaComponent); fixture.detectChanges();
    expect(api.genelArama).toHaveBeenCalledOnceWith(jasmine.objectContaining({ pageNumber: 1, paraBirimi: undefined }));
    expect(api.yaslandirma).not.toHaveBeenCalled();
  });

  it('panel kovasından bekleyen işler aşama ve eşikle açılır; filtre temizleme varsayılana döner', () => {
    const fixture = TestBed.createComponent(FinansKayitAramaComponent);
    fixture.componentRef.setInput('acilis', { anahtar: 1, gorunum: 'bekleyen', asama: 'Fatura', minimumGun: 60 });
    fixture.detectChanges();
    const [, , minimumGun, asama] = api.yaslandirma.calls.mostRecent().args;
    expect([minimumGun, asama]).toEqual([60, 'Fatura']);
    const c = fixture.componentInstance;
    expect(c.etkinFiltre()).toBe(1);
    c.filtreleriTemizle();
    expect(api.yaslandirma.calls.mostRecent().args.slice(2)).toEqual([15, undefined]);
  });

  it('rapor görme izni yoksa bekleyen işler görünümü açılmaz', () => {
    izinler.delete(FINANS_YETKI.RaporGoruntule);
    const fixture = TestBed.createComponent(FinansKayitAramaComponent);
    fixture.componentRef.setInput('acilis', { anahtar: 1, gorunum: 'bekleyen' });
    fixture.detectChanges();
    expect(fixture.componentInstance.gorunum()).toBe('arama');
    expect(api.yaslandirma).not.toHaveBeenCalled();
  });
});
