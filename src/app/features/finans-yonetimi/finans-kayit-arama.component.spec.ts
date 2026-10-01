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

  it('arama sonuçlarını proje başlıklarında toplar; kalemler isteğe bağlı açılır, proje seçimi bütün kalemleri seçer', () => {
    const kalem = (id: number, projeNo: string, net: number, paraBirimi: string, kategori: number) =>
      ({ id, projeNo, musteri: 'GE', netTutar: net, paraBirimi, kategori, finansTarihi: '2026-10-0' + id, poNumaralari: [], faturaNumaralari: [] });
    api.genelArama.and.returnValue(of({ isSuccess: true, value: { ...bos, totalCount: 3, items: [
      kalem(1, 'PA-1', 100, 'EUR', 1), kalem(2, 'PA-1', 50, 'EUR', 2), kalem(3, 'PA-2', 10, 'TRY', 1),
    ] as never } }));
    const fixture = TestBed.createComponent(FinansKayitAramaComponent); fixture.detectChanges();
    const c = fixture.componentInstance;
    const gruplar = c.projeGruplari();
    expect(gruplar.map((g) => [g.projeNo, g.kalemler.length, g.kategoriSayisi])).toEqual([['PA-1', 2, 2], ['PA-2', 1, 1]]);
    expect(gruplar[0].toplamlar).toEqual([{ paraBirimi: 'EUR', net: 150 }]);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.project-group-row').length).toBe(2);
    expect(el.querySelectorAll('.project-item-row').length).toBe(0);
    c.projeAcKapat('PA-1'); fixture.detectChanges();
    expect(el.querySelectorAll('.project-item-row').length).toBe(2);
    c.projeSec(gruplar[0], true);
    expect([...c.secilenler()]).toEqual([1, 2]);
    expect(c.projeSecili(gruplar[0])).toBeTrue();
  });

  it('proje altındaki sandıklar numaraya göre küçükten büyüğe, aynı sandıkta kategori sırasıyla listelenir', () => {
    const kalem = (id: number, sandikNo: string, kategori: number) =>
      ({ id, projeNo: 'PA-1', musteri: 'GE', sandikNo, kategori, netTutar: 0, paraBirimi: 'EUR', poNumaralari: [], faturaNumaralari: [] });
    api.genelArama.and.returnValue(of({ isSuccess: true, value: { ...bos, totalCount: 5, items: [
      kalem(1, '9', 2), kalem(2, '10', 1), kalem(3, '9', 1), kalem(4, '2', 2), kalem(5, '1', 1),
    ] as never } }));
    const fixture = TestBed.createComponent(FinansKayitAramaComponent); fixture.detectChanges();
    expect(fixture.componentInstance.projeGruplari()[0].kalemler.map((k) => k.sandikNo + '/' + k.kategori))
      .toEqual(['1/1', '2/2', '9/1', '9/2', '10/1']);
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
