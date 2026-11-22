import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AracYuklemeService } from '../../../core/services/arac-yukleme.service';
import { ToastService } from '../../../core/services/toast.service';
import { ApiResult, AracYuklemePlanOzeti, PaginatedList, YuklemeOturumDurumu } from '../../../shared/models/index';
import { AracYuklemePlanlarComponent } from './arac-yukleme-planlar.component';

function ozet(id: number, acik: boolean): AracYuklemePlanOzeti {
  return {
    id, planNo: `YP-2026-00000${id}`, ad: `Plan ${id}`, yuklemeTarihi: null, revizyonNo: 4, yerlesimVar: true,
    acikOturum: acik
      ? { id: 5, revizyonNo: 3, durum: YuklemeOturumDurumu.Acik, baslatan: 'A', baslamaTarihi: '2026-11-09T08:30:00', kapatan: null,
          kapanisTarihi: null, kapanisGerekcesi: null, aracSayisi: 2, toplamYuk: 14, yuklenenYuk: 6, planDegisti: true }
      : null,
  };
}

function sayfa(items: AracYuklemePlanOzeti[], toplam = items.length): ApiResult<PaginatedList<AracYuklemePlanOzeti>> {
  return {
    isSuccess: true,
    value: { items, pageNumber: 1, pageSize: 25, totalCount: toplam, totalPages: Math.max(1, Math.ceil(toplam / 25)), hasPreviousPage: false, hasNextPage: toplam > 25 },
  } as ApiResult<PaginatedList<AracYuklemePlanOzeti>>;
}

describe('AracYuklemePlanlarComponent', () => {
  let api: jasmine.SpyObj<AracYuklemeService>;
  let toast: jasmine.SpyObj<ToastService>;

  function kur(yanit = sayfa([ozet(1, true), ozet(2, false)])) {
    api = jasmine.createSpyObj<AracYuklemeService>('AracYuklemeService', ['planlar']);
    api.planlar.and.returnValue(of(yanit));
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['error']);
    TestBed.configureTestingModule({
      imports: [AracYuklemePlanlarComponent],
      providers: [provideRouter([]), { provide: AracYuklemeService, useValue: api }, { provide: ToastService, useValue: toast }],
    });
    const fixture = TestBed.createComponent(AracYuklemePlanlarComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('ilk açılışta birinci sayfayı ister; süren ve başlatılmamış planı ayırt eder', () => {
    const fixture = kur();
    expect(api.planlar).toHaveBeenCalledOnceWith('', 1, 25);
    const kok = fixture.nativeElement as HTMLElement;
    const satirlar = kok.querySelectorAll('tbody tr');
    expect(satirlar.length).toBe(2);
    // Oturum başladığı revizyonla (3) gösterilir; planın güncel revizyonu (4) ayrı sütundadır.
    expect(satirlar[0].textContent).toContain('Sürüyor · Rev 3');
    expect(satirlar[0].textContent).toContain('6 / 14');
    expect(satirlar[1].textContent).toContain('Süren yükleme yok');
    expect(kok.querySelector('app-server-pager')).not.toBeNull();
  });

  it('arama bekleme süresinden sonra birinci sayfadan yeniden ister', fakeAsync(() => {
    const fixture = kur();
    const c = fixture.componentInstance;
    c.sayfaDegisti(3);
    api.planlar.calls.reset();
    c.aramaDegisti('wa');
    c.aramaDegisti('wasit');
    tick(299);
    expect(api.planlar).not.toHaveBeenCalled();
    tick(1);
    expect(api.planlar).toHaveBeenCalledOnceWith('wasit', 1, 25);
  }));

  it('sayfa değişimi sayfayı, boyut değişimi boyutu ve birinci sayfayı ister', () => {
    const c = kur().componentInstance;
    c.sayfaDegisti(2);
    expect(api.planlar.calls.mostRecent().args).toEqual(['', 2, 25]);
    c.boyutDegisti(50);
    expect(api.planlar.calls.mostRecent().args).toEqual(['', 1, 50]);
  });

  it('boş listede aramaya göre farklı açıklama gösterir', () => {
    const fixture = kur(sayfa([]));
    const metin = () => (fixture.nativeElement as HTMLElement).querySelector('.yp-bos')?.textContent ?? '';
    expect(metin()).toContain('Yüklenecek plan yok');
    fixture.componentInstance.arama.set('yok');
    fixture.detectChanges();
    expect(metin()).toContain('Aramaya uyan plan yok');
  });

  it('sunucu hatasında iletiyi gösterir ve listeyi boş bırakır', () => {
    const fixture = kur({ isSuccess: false, error: 'Bu işlem için yetkiniz yok.' } as ApiResult<PaginatedList<AracYuklemePlanOzeti>>);
    expect(toast.error).toHaveBeenCalledOnceWith('Bu işlem için yetkiniz yok.');
    expect(fixture.componentInstance.liste()).toBeNull();
    expect(fixture.componentInstance.yukleniyor()).toBeFalse();
  });

  it('satır planın yükleme oturumu ekranını açar', () => {
    const fixture = kur();
    const git = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    ((fixture.nativeElement as HTMLElement).querySelector('tbody tr') as HTMLElement).click();
    expect(git).toHaveBeenCalledOnceWith(['/arac-yukleme', 1]);
  });
});
