import { signal } from '@angular/core';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { FinansService } from '../../core/services/finans.service';
import { PermissionService } from '../../core/services/permission.service';
import { ToastService } from '../../core/services/toast.service';
import { TranslationService } from '../../core/services/translation.service';
import { ApiResult } from '../../shared/models/common.model';
import { FinansSablon } from '../../shared/models/finans-v2.model';
import { FinansFatura, FinansSayfaliSonuc, FinansSiparis } from '../../shared/models/finans.model';
import { FinansBelgelerListesiComponent } from './finans-belgeler-listesi.component';
import { FinansRaporlarComponent } from './finans-raporlar.component';
import { FinansSablonlarComponent } from './finans-sablonlar.component';

describe('Finans yönetim tasarımı — mevcut iş akışları', () => {
  let api: jasmine.SpyObj<FinansService>;
  let toast: jasmine.SpyObj<ToastService>;
  const write = signal(true);
  const template: FinansSablon = {
    id: 3,
    kod: 'MONTAJ',
    ad: 'Montaj',
    aktif: true,
    surumId: 7,
    surum: 2,
    alanlar: [{ kod: 'saat', ad: 'Süre', veriTuru: 'sayi', zorunlu: true }],
  };
  function page<T>(items: T[]): FinansSayfaliSonuc<T> {
    return {
      items,
      toplamlar: [],
      pageNumber: 1,
      pageSize: 25,
      totalCount: items.length,
      totalPages: 1,
      hasPreviousPage: false,
      hasNextPage: false,
    };
  }
  beforeEach(() => {
    write.set(true);
    api = jasmine.createSpyObj('FinansService', [
      'sablonlar',
      'sablonKaydet',
      'siparisler',
      'faturalar',
      'giderKategorileri',
    ]);
    toast = jasmine.createSpyObj('ToastService', ['success', 'info', 'error']);
    api.sablonlar.and.returnValue(of({ isSuccess: true, value: [template] }));
    api.sablonKaydet.and.returnValue(of({ isSuccess: true, statusCode: 202 }));
    api.siparisler.and.returnValue(of({ isSuccess: true, value: page<FinansSiparis>([]) }));
    api.faturalar.and.returnValue(of({ isSuccess: true, value: page<FinansFatura>([]) }));
    api.giderKategorileri.and.returnValue(of({ isSuccess: true, value: [] }));
    TestBed.configureTestingModule({
      imports: [FinansSablonlarComponent, FinansBelgelerListesiComponent, FinansRaporlarComponent],
      providers: [
        { provide: FinansService, useValue: api },
        { provide: ToastService, useValue: toast },
        {
          provide: PermissionService,
          useValue: { hasAccess: () => true, canWrite: () => write() },
        },
        { provide: TranslationService, useValue: { translate: (key: string) => key } },
      ],
    });
  });

  it('şablon araması tam listeyi filtreler; yeni sürüm editörü kaynak alanı değiştirmez ve 202 açık kalır', () => {
    const fixture = TestBed.createComponent(FinansSablonlarComponent);
    fixture.detectChanges();
    const c = fixture.componentInstance;
    c.arama.set('montaj');
    expect(c.gorunenSablonlar()).toEqual([template]);
    c.arama.set('başka');
    expect(c.gorunenSablonlar()).toEqual([]);
    c.duzenle(template);
    c.form.alanlar[0].ad = 'Yeni süre';
    c.kaydet();
    fixture.detectChanges();
    expect(template.alanlar[0].ad).toBe('Süre');
    expect(api.sablonKaydet).toHaveBeenCalledOnceWith(
      jasmine.objectContaining({
        kod: 'MONTAJ',
        alanlar: [{ kod: 'saat', ad: 'Yeni süre', veriTuru: 'sayi', zorunlu: true }],
      }),
      3,
    );
    expect(c.acik()).toBeTrue();
    expect(c.saving()).toBeFalse();
    expect(fixture.nativeElement.querySelector('.v2-editor-card')).not.toBeNull();
    expect(toast.info).toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(api.sablonlar).toHaveBeenCalledTimes(1);
  });

  it('canlı yazma izni kaldırılınca şablon editörü DOMdan kalkar ve kaydet gönderilmez', () => {
    const fixture = TestBed.createComponent(FinansSablonlarComponent);
    fixture.detectChanges();
    const c = fixture.componentInstance;
    c.duzenle(template);
    fixture.detectChanges();
    write.set(false);
    fixture.detectChanges();
    c.kaydet();
    expect(fixture.nativeElement.querySelector('.v2-editor-card')).toBeNull();
    expect(api.sablonKaydet).not.toHaveBeenCalled();
  });

  it('şablon yükleme ve hata durumu boş listeyle karıştırılmaz', () => {
    const result = new Subject<ApiResult<FinansSablon[]>>();
    api.sablonlar.and.returnValue(result);
    const fixture = TestBed.createComponent(FinansSablonlarComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="status"]')).not.toBeNull();
    result.next({ isSuccess: false, error: 'Erişim reddedildi' });
    result.complete();
    fixture.detectChanges();
    expect(fixture.componentInstance.loading()).toBeFalse();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(
      'Erişim reddedildi',
    );
  });

  it('belge sekmesi faturaya geçerken sayfayı sıfırlar, sunucu sayfa boyutunu korur', () => {
    const fixture = TestBed.createComponent(FinansBelgelerListesiComponent);
    fixture.detectChanges();
    const c = fixture.componentInstance;
    c.pageNumber = 4;
    c.pageSize = 50;
    const tabs = fixture.nativeElement.querySelectorAll('.v2-segmented button');
    tabs[1].click();
    fixture.detectChanges();
    expect(c.tur).toBe('Fatura');
    expect(c.pageNumber).toBe(1);
    expect(api.faturalar).toHaveBeenCalledOnceWith({
      pageNumber: 1,
      pageSize: 50,
      arama: undefined,
    });
    expect(tabs[1].getAttribute('aria-pressed')).toBe('true');
    expect(fixture.nativeElement.querySelector('app-server-pager')).not.toBeNull();
  });

  it('belge arama alanı debounce sonrasında sunucu filtresini gönderir; eski türün cevabı listeyi ezmez', fakeAsync(() => {
    const stale = new Subject<ApiResult<FinansSayfaliSonuc<FinansSiparis>>>();
    api.siparisler.and.returnValue(stale);
    const fixture = TestBed.createComponent(FinansBelgelerListesiComponent);
    fixture.detectChanges();
    tick();
    const c = fixture.componentInstance;
    c.turSec('Fatura');
    fixture.detectChanges();
    const search = fixture.nativeElement.querySelector('input[type="search"]') as HTMLInputElement;
    search.value = ' INV-2026 ';
    search.dispatchEvent(new Event('input'));
    tick(350);
    expect(api.faturalar.calls.mostRecent().args[0]).toEqual({
      pageNumber: 1,
      pageSize: 25,
      arama: 'INV-2026',
    });
    stale.next({ isSuccess: true, value: { ...page<FinansSiparis>([]), totalCount: 999 } });
    stale.complete();
    expect(c.liste()?.totalCount).toBe(0);
    expect(c.loading()).toBeFalse();
  }));

  it('kapalı gelişmiş rapor filtreleri modeli korur; temizleme seçili rapor türünü değiştirmez', () => {
    const fixture = TestBed.createComponent(FinansRaporlarComponent);
    fixture.detectChanges();
    const c = fixture.componentInstance;
    c.tur = 'proje-maliyet';
    c.filtre = {
      pageNumber: 1,
      pageSize: 25,
      poNumarasi: 'PO-1',
      faturaNumarasi: 'INV-1',
      firma: 'Firma',
      talepEden: 'Kişi',
      giderKategoriId: 3,
      sandikCinsi: '1',
      isTuru: 8,
      durum: 4,
      siparisDurumu: 2,
      faturaDurumu: 1,
      iptalEdilenleriDahilEt: true,
    };
    fixture.detectChanges();
    const advanced = fixture.nativeElement.querySelector('details') as HTMLDetailsElement;
    expect(advanced.open).toBeFalse();
    expect(advanced.querySelectorAll('select').length).toBe(6);
    advanced.open = true;
    advanced.open = false;
    expect(c.filtre.poNumarasi).toBe('PO-1');
    expect(c.filtre.iptalEdilenleriDahilEt).toBeTrue();
    c.filtreleriTemizle();
    expect(c.filtre).toEqual({ pageNumber: 1, pageSize: 25 });
    expect(c.tur).toBe('proje-maliyet');
  });
});
