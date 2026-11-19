import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { YuklemePlanlamaService } from '../../../core/services/yukleme-planlama.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ToastService } from '../../../core/services/toast.service';
import { ApiResult, PaginatedList, PlanProjeAdayi, YuklemePlaniDetayi, YuklemePlaniOzeti, YuklemePlaniTanimlari } from '../../../shared/models/index';
import { PlanListesiComponent } from './plan-listesi.component';

const TANIMLAR = {
  tasimaAileleri: [{ id: 1, ad: 'Konteyner' }],
  tasimaTipleri: [{ id: 3, aileId: 1, ad: "40' High Cube", otomatikSecilir: true }],
  yukTurleri: [],
  lokasyonlar: [],
} as YuklemePlaniTanimlari;

const sayfa = <T>(items: T[]): PaginatedList<T> =>
  ({ items, pageNumber: 1, pageSize: 10, totalCount: items.length, totalPages: 1, hasPreviousPage: false, hasNextPage: false });
const tamam = <T>(value: T): ApiResult<T> => ({ isSuccess: true, value }) as ApiResult<T>;

describe('PlanListesiComponent yeni plan (tek adımlı hesap)', () => {
  let api: jasmine.SpyObj<YuklemePlanlamaService>;

  function kur() {
    api = jasmine.createSpyObj<YuklemePlanlamaService>('YuklemePlanlamaService', ['planlar', 'tanimlar', 'projeAdaylari', 'planHesapla']);
    api.planlar.and.returnValue(of(tamam(sayfa<YuklemePlaniOzeti>([]))));
    api.tanimlar.and.returnValue(of(tamam(TANIMLAR)));
    api.projeAdaylari.and.returnValue(of(tamam(sayfa<PlanProjeAdayi>([
      { projeId: 7, projeNo: 'PA900-01', musteri: 'M', projeTipiId: 1, projeTipiAdi: 'Normal', planaGelecekSandikSayisi: 12 },
    ]))));
    TestBed.configureTestingModule({
      imports: [PlanListesiComponent],
      providers: [
        provideRouter([]),
        { provide: YuklemePlanlamaService, useValue: api },
        { provide: ToastService, useValue: jasmine.createSpyObj<ToastService>('ToastService', ['error', 'success']) },
        { provide: PermissionService, useValue: { canWrite: () => true, hasAccess: () => true } },
      ],
    });
    const fixture = TestBed.createComponent(PlanListesiComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('pencerede yalnız projeler, aile/tip ve yükler arası boşluk vardır; plan adı, paylar ve kaydetme yoktur', () => {
    const fixture = kur();
    fixture.componentInstance.yeniPlan();
    fixture.detectChanges();
    const metin = (fixture.nativeElement as HTMLElement).querySelector('.tz-modal')!.textContent ?? '';
    expect(metin).toContain('Taşıma ailesi');
    expect(metin).toContain('Yükler arası boşluk');
    expect(metin).not.toContain('Güvenlik payları');
    expect(metin).not.toContain('Plan adı');
    expect(metin).not.toContain('Çalışma biçimi');
    expect(metin).not.toContain('Sevkli');
    expect(metin).toContain('Hesapla');
  });

  it('Hesapla yeni planı tek istekle açar ve plan ekranına gider', () => {
    const fixture = kur();
    const c = fixture.componentInstance;
    const git = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    c.yeniPlan();
    expect(c.hesaplanabilir()).toBeFalse();
    c.projeDegistir(c.adaylar()!.items[0]);
    c.ayarlar.set({ ...c.ayarlar(), tipIdleri: [3] });
    api.planHesapla.and.returnValue(of(tamam({ id: 42, planNo: 'YP-2026-000042', yerlesim: { araclar: [{}, {}] } } as unknown as YuklemePlaniDetayi)));
    c.hesapla();
    expect(api.planHesapla).toHaveBeenCalledOnceWith(jasmine.objectContaining({ planId: null, beklenenRevizyonNo: null, projeIdleri: [7], tasimaAilesiId: 1 }));
    expect(api.planHesapla.calls.mostRecent().args[0].ayarlar.tipIdleri).toEqual([3]);
    expect(git).toHaveBeenCalledOnceWith(['/yukleme-planlari', 42]);
    expect(c.yeniAcik()).toBeFalse();
  });
});
