import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { FinansYonetimiComponent } from './finans-aylik.component';
import { FinansService } from '../../core/services/finans.service';
import { AmbalajService } from '../../core/services/ambalaj.service';
import { PermissionService } from '../../core/services/permission.service';
import { ToastService } from '../../core/services/toast.service';
import { FINANS_YETKI } from '../../core/constants/yetki-kodlari';
import { FinansUrun } from '../../shared/models/finans.model';

describe('Finans ürün ve tarife kaydı', () => {
  let api: jasmine.SpyObj<FinansService>;
  let toast: jasmine.SpyObj<ToastService>;
  const okuma = new Set<string>([
    FINANS_YETKI.Modul,
    FINANS_YETKI.IsKutuphanesiYonet,
    FINANS_YETKI.BirimFiyatGoruntule,
    FINANS_YETKI.ParasalVeriGoruntule,
    FINANS_YETKI.TutarGoruntule,
  ]);
  const yazma = new Set<string>([FINANS_YETKI.IsKutuphanesiYonet]);

  beforeEach(() => {
    api = jasmine.createSpyObj('FinansService', ['aylikIsler', 'urunler', 'urunGuncelle', 'urunSil', 'giderKategorileri']);
    const sayfa = { items: [], toplamlar: [], pageNumber: 1, pageSize: 25, totalCount: 0, totalPages: 0, hasPreviousPage: false, hasNextPage: false };
    api.aylikIsler.and.returnValue(of({ isSuccess: true, value: { ...sayfa, finansOzeti: [], grupToplamlari: [] } }));
    api.urunler.and.returnValue(of({ isSuccess: true, value: sayfa }));
    api.giderKategorileri.and.returnValue(of({ isSuccess: true, value: [] }));
    toast = jasmine.createSpyObj('ToastService', ['success', 'info', 'error']);
    TestBed.configureTestingModule({
      imports: [FinansYonetimiComponent],
      providers: [
        provideRouter([]),
        { provide: FinansService, useValue: api },
        { provide: AmbalajService, useValue: {} },
        { provide: ToastService, useValue: toast },
        {
          provide: PermissionService,
          useValue: { loaded: signal(true), hasAccess: (k: string) => okuma.has(k) || yazma.has(k), canWrite: (k: string) => yazma.has(k) },
        },
      ],
    });
  });

  const urun: FinansUrun = {
    id: 3, kod: 'AMB', ad: 'Ambalaj', fiyatlandirmaBirimi: 2, birimFiyat: 550, paraBirimi: 'EUR', kdvOrani: 20, aktif: true, sira: 0,
    eslesmeler: [
      { id: 1, isTuru: 1, sandikAdi: 'Eski', aktif: false },
      { id: 2, isTuru: 1, sandikAdi: null, aktif: true },
    ],
  };

  it('düzenlenen geçerli eşleşmenin kimliğini aktif olarak gönderir', () => {
    api.urunGuncelle.and.returnValue(of({ isSuccess: true }));
    const c = TestBed.createComponent(FinansYonetimiComponent).componentInstance;

    c.urunDuzenle(urun);
    c.urunKaydet();

    const [id, istek] = api.urunGuncelle.calls.mostRecent().args;
    expect(id).toBe(3);
    expect(istek.eslesmeler).toEqual([jasmine.objectContaining({ id: 2, aktif: true, isTuru: 1 })]);
    expect(c.urunEslesmeMetni(urun)).not.toContain('Eski');
  });

  it('onaya düşen silmeyi başarılı saymaz', () => {
    api.urunSil.and.returnValue(of({ isSuccess: true, statusCode: 202 }));
    spyOn(window, 'confirm').and.returnValue(true);
    const c = TestBed.createComponent(FinansYonetimiComponent).componentInstance;

    c.urunSil(urun);

    expect(toast.info).toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });
});
