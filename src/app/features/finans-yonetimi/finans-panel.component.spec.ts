import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { FinansPanelComponent } from './finans-panel.component';
import { FinansService } from '../../core/services/finans.service';
import { PermissionService } from '../../core/services/permission.service';
import { ToastService } from '../../core/services/toast.service';
import { TranslationService } from '../../core/services/translation.service';
import { FINANS_YETKI } from '../../core/constants/yetki-kodlari';
import { FinansPanel } from '../../shared/models/finans-v2.model';

describe('Finans paneli bağımsız kayıt izni', () => {
  let api: jasmine.SpyObj<FinansService>;
  let toast: jasmine.SpyObj<ToastService>;
  const kayitIzni = signal(false);
  beforeEach(() => {
    kayitIzni.set(false);
    api = jasmine.createSpyObj('FinansService', ['panel', 'hareketler', 'genelArama', 'yaslandirma']);
    toast = jasmine.createSpyObj('ToastService', ['error']);
    api.panel.and.returnValue(of({ isSuccess: true, value: {
      siparisBekleyen: 4, kismiSiparis: 1, siparisTam: 2, kismiFatura: 0, tamamlanan: 3,
      tutarlar: [], aylik: [], isTurleri: [], giderTurleri: [], projeler: [], ozelIsTurleri: [],
    } as unknown as FinansPanel }));
    const empty = { items: [], toplamlar: [], totalCount: 0, totalPages: 0, pageNumber: 1, pageSize: 25,
      hasPreviousPage: false, hasNextPage: false };
    api.hareketler.and.returnValue(of({ isSuccess: true, value: empty }));
    api.genelArama.and.returnValue(of({ isSuccess: true, value: empty }));
    api.yaslandirma.and.returnValue(of({ isSuccess: true, value: empty }));
    TestBed.configureTestingModule({ imports: [FinansPanelComponent], providers: [
      { provide: FinansService, useValue: api }, { provide: ToastService, useValue: toast },
      { provide: PermissionService, useValue: {
        hasAccess: (code: string) => code === FINANS_YETKI.Modul || (code === FINANS_YETKI.KayitGoruntule && kayitIzni()),
        canWrite: () => false,
      } },
    ] });
    TestBed.inject(TranslationService).switchLanguage('tr');
  });
  afterEach(() => TestBed.inject(TranslationService).switchLanguage('tr'));

  it('yalnız modül izniyle kartları açar; kayıt isteği, sekmesi ve tablosu oluşturmaz', () => {
    const fixture = TestBed.createComponent(FinansPanelComponent); fixture.detectChanges();
    expect(api.panel).toHaveBeenCalledTimes(1);
    expect(api.hareketler).not.toHaveBeenCalled();
    expect(api.genelArama).not.toHaveBeenCalled(); expect(api.yaslandirma).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('.v2-counts').textContent).toContain('4');
    expect(fixture.nativeElement.querySelector('nav')).toBeNull();
    expect(fixture.nativeElement.querySelector('table')).toBeNull();
    fixture.componentInstance.gorunumSec('arama'); fixture.componentInstance.gorunumSec('bekleyen');
    expect(fixture.componentInstance.gorunum()).toBe('aylik');
    expect(api.genelArama).not.toHaveBeenCalled(); expect(api.yaslandirma).not.toHaveBeenCalled();
  });

  it('kayıt izni açılınca listeyi getirir; geri alınca gizler ve yeniden istek atmaz', () => {
    kayitIzni.set(true);
    const fixture = TestBed.createComponent(FinansPanelComponent); fixture.detectChanges();
    expect(api.hareketler).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.querySelector('table')).not.toBeNull();
    fixture.componentInstance.gorunumSec('arama');
    expect(api.genelArama).toHaveBeenCalledTimes(1);
    kayitIzni.set(false); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('table')).toBeNull();
    fixture.componentInstance.yenile(); fixture.detectChanges();
    expect(api.hareketler).toHaveBeenCalledTimes(1);
    expect(api.genelArama).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.querySelector('.v2-counts')).not.toBeNull();
  });

  it('dil değişiminde başlık ve grafik etiketlerini günceller', () => {
    const fixture = TestBed.createComponent(FinansPanelComponent); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('h3').textContent).toBe('Finans kontrol paneli');
    fixture.componentInstance.grafik.set('siparis');
    TestBed.inject(TranslationService).switchLanguage('en'); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('h3').textContent).toBe('Finance dashboard');
    expect(fixture.componentInstance.xaxis().categories).toEqual(['Awaiting PO', 'PO placed']);
  });
});
