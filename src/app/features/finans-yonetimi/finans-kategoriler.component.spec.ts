import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, Subject } from 'rxjs';
import { FinansKategorilerComponent } from './finans-kategoriler.component';
import { FinansYonetimiComponent } from './finans-aylik.component';
import { FinansService } from '../../core/services/finans.service';
import { AmbalajService } from '../../core/services/ambalaj.service';
import { PermissionService } from '../../core/services/permission.service';
import { ToastService } from '../../core/services/toast.service';
import { FINANS_YETKI } from '../../core/constants/yetki-kodlari';
import { FinansGider, FinansGiderKalemi } from '../../shared/models/finans.model';
import { ApiResult } from '../../shared/models/common.model';

describe('Finans F8 kategori ve bağlı gider kalemi', () => {
  let api: jasmine.SpyObj<FinansService>;
  let toast: jasmine.SpyObj<ToastService>;
  const write = signal(true);
  const denied = signal<string | null>(null);
  const item: FinansGiderKalemi = {
    id: 8, kategoriId: 1, kod: 'YAKIT', ad: 'Yakıt', aktif: true,
    varsayilanFirmaVeyaKisi: 'Firma', varsayilanMiktar: 2, varsayilanBirim: 'Litre',
    varsayilanBirimFiyat: 30, varsayilanParaBirimi: 'TRY', varsayilanKdvDahil: false,
    varsayilanKdvOrani: 0
  };
  beforeEach(() => {
    write.set(true); denied.set(null);
    api = jasmine.createSpyObj<FinansService>('FinansService', ['giderKutuphaneKategorileri', 'giderKutuphaneKalemleri', 'giderKategoriKaydet', 'giderKalemiKaydet', 'giderKalemleri', 'giderGuncelle', 'giderOlustur']);
    toast = jasmine.createSpyObj('ToastService', ['success', 'info', 'error']);
    api.giderKutuphaneKategorileri.and.returnValue(of({ isSuccess: true, value: [{ id: 1, ad: 'Araç', aktif: true }, { id: 2, ad: 'Eski', aktif: false }] }));
    api.giderKutuphaneKalemleri.and.returnValue(of({ isSuccess: true, value: [item] }));
    api.giderKalemleri.and.returnValue(of({ isSuccess: true, value: [item] }));
    api.giderKalemiKaydet.and.returnValue(of({ isSuccess: true, value: item }));
    api.giderKategoriKaydet.and.returnValue(of({ isSuccess: true, value: { id: 1, ad: 'Araç', aktif: true } }));
    api.giderGuncelle.and.returnValue(of({ isSuccess: true, value: expense() }));
    api.giderOlustur.and.returnValue(of({ isSuccess: true, value: expense() }));
    TestBed.configureTestingModule({ imports: [FinansKategorilerComponent, FinansYonetimiComponent], providers: [
      { provide: FinansService, useValue: api }, { provide: AmbalajService, useValue: {} },
      { provide: ToastService, useValue: toast },
      { provide: PermissionService, useValue: { hasAccess: (k: string) => denied() !== k, canWrite: () => write() } }
    ] });
    // Aylık sayfanın bu testte yalnız gider formu davranışı çalışır; diğer sekmeler başlatılmaz.
    TestBed.overrideComponent(FinansYonetimiComponent, { set: { template: '', imports: [] } });
  });
  function categories() {
    const fixture = TestBed.createComponent(FinansKategorilerComponent);
    fixture.detectChanges(); fixture.componentInstance.kategoriSec(1);
    return fixture.componentInstance;
  }
  function expenses() {
    const component = TestBed.createComponent(FinansYonetimiComponent).componentInstance;
    component.giderKategorileri.set([{ id: 1, ad: 'Araç', aktif: true }]);
    return component;
  }
  function expense(): FinansGider {
    return { id: 4, tarih: '2026-09-19', kategoriId: 1, kategori: 'Araç', giderKalemiId: 8,
      giderKalemi: 'Yakıt', altKategori: 'Yakıt', aciklama: 'Eski işlem', miktar: 5, birim: 'Litre',
      birimFiyat: 42, tutar: 210, paraBirimi: 'EUR', kdvDahil: true, kdvOrani: 20,
      matrah: 175, kdvTutari: 35, toplamTutar: 210, projeNo: '', iptalEdildi: false, belgeSayisi: 0 };
  }
  it('kalem adı/pasiflik düzenlenirken bütün mevcut varsayılanları korur', () => {
    const c = categories(); c.kalemDuzenle(item); c.kalemForm.ad = 'Dizel'; c.kalemForm.aktif = false; c.kalemKaydet();
    const { id, ...defaults } = item;
    expect(api.giderKalemiKaydet).toHaveBeenCalledOnceWith({ ...defaults, ad: 'Dizel', aktif: false }, id);
    expect(item.ad).toBe('Yakıt'); expect(item.aktif).toBeTrue();
  });
  it('202 kalem değişikliğini uygulanmış saymaz, formu ve seçimi korur', () => {
    api.giderKalemiKaydet.and.returnValue(of({ isSuccess: true, statusCode: 202 }));
    const c = categories(); const emitted = spyOn(c.degisti, 'emit'); c.kalemDuzenle(item); c.kalemKaydet();
    expect(c.kalemId).toBe(8); expect(c.kalemSaving()).toBeFalse(); expect(emitted).not.toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalled(); expect(toast.success).not.toHaveBeenCalled();
  });
  it('iş hatasında kalem formunu açık tutar', () => {
    api.giderKalemiKaydet.and.returnValue(of({ isSuccess: false, error: 'Kod mevcut' }));
    const c = categories(); c.kalemDuzenle(item); c.kalemKaydet();
    expect(c.kalemHatasi()).toBe('Kod mevcut'); expect(c.kalemId).toBe(8); expect(c.kalemSaving()).toBeFalse();
  });
  it('pasif kategoriye kalem yazmaz ve sonradan kaldırılan yetkiyle kaydetmez', () => {
    const c = categories(); c.kategoriSec(2); c.kalemForm.ad = 'Yeni'; c.kalemForm.kod = 'Y'; c.kalemKaydet();
    expect(api.giderKalemiKaydet).not.toHaveBeenCalled();
    c.kategoriSec(1); c.kalemDuzenle(item); write.set(false); c.kalemKaydet(); c.ad = 'Yeni'; c.kaydet();
    expect(api.giderKalemiKaydet).not.toHaveBeenCalled(); expect(api.giderKategoriKaydet).not.toHaveBeenCalled();
  });
  it('gizlenmiş fiyat varsayılanını null ile ezebilecek kalem düzenlemesini engeller', () => {
    const c = categories(); denied.set(FINANS_YETKI.BirimFiyatGoruntule); c.kalemDuzenle({ ...item, varsayilanBirimFiyat: null });
    expect(c.kalemId).toBeUndefined(); expect(api.giderKalemiKaydet).not.toHaveBeenCalled();
  });
  it('izin sonradan verilse de önceki maskeli kalem listesini düzenlemeye açmaz', () => {
    denied.set(FINANS_YETKI.BirimFiyatGoruntule);
    const c = categories(); denied.set(null); c.kalemDuzenle(item);
    expect(c.kalemId).toBeUndefined();
    c.kategoriSec(1); c.kalemDuzenle(item); expect(c.kalemId).toBe(8);
  });
  it('eski kategori cevabının yeni kalem listesini ezmesini engeller', () => {
    const first = new Subject<ApiResult<FinansGiderKalemi[]>>();
    const second = new Subject<ApiResult<FinansGiderKalemi[]>>();
    api.giderKutuphaneKalemleri.and.returnValues(first, second);
    const c = categories(); c.kategoriSec(2);
    second.next({ isSuccess: true, value: [{ ...item, id: 9, kategoriId: 2 }] }); second.complete();
    first.next({ isSuccess: true, value: [item] }); first.complete();
    expect(c.kalemler()[0].id).toBe(9); expect(c.kalemLoading()).toBeFalse();
  });
  it('gider düzenlemesi aktif kalem kimliğini ve kayıtlı fiyat/miktar/para birimini korur', () => {
    const c = expenses(); c.giderDuzenle(expense()); c.giderKaydet();
    expect(api.giderKalemleri).toHaveBeenCalledWith(1, true);
    expect(api.giderGuncelle.calls.mostRecent().args[1]).toEqual(jasmine.objectContaining({ giderKalemiId: 8, altKategori: 'Yakıt', miktar: 5, birimFiyat: 42, paraBirimi: 'EUR' }));
  });
  it('aktif listede olmayan eski kalem ID/adını sessizce sıfırlamaz', () => {
    api.giderKalemleri.and.returnValue(of({ isSuccess: true, value: [] }));
    const c = expenses(); c.giderDuzenle(expense());
    expect(c.giderForm.giderKalemiId).toBe(8); expect(c.giderEskiKalem()).toEqual({ id: 8, ad: 'Yakıt' });
    c.giderKaydet(); expect(api.giderGuncelle).not.toHaveBeenCalled();
    c.giderKalemiSecildi(null); c.giderKaydet();
    expect(api.giderGuncelle.calls.mostRecent().args[1].giderKalemiId).toBeNull();
  });
  it('yeni giderde seçilen kalemin ID/adını ve sıfır KDV varsayılanını uygular', () => {
    const c = expenses(); c.yeniGider(); c.giderKategoriDegisti(1); c.giderKalemiSecildi(8);
    expect(c.giderForm.giderKalemiId).toBe(8); expect(c.giderForm.altKategori).toBe('Yakıt');
    expect(c.giderForm.kdvOrani).toBe(0); expect(c.giderForm.birimFiyat).toBe(30);
    c.giderKategoriDegisti(2); expect(c.giderForm.giderKalemiId).toBeNull(); expect(c.giderKalemleri()).toEqual([]);
  });
  it('hızlı kategori değişiminde eski yanıtı ve eski kalem bağlantısını kullanmaz', () => {
    const first = new Subject<ApiResult<FinansGiderKalemi[]>>();
    api.giderKalemleri.and.returnValues(first, of({ isSuccess: true, value: [{ ...item, id: 9, kategoriId: 2 }] }));
    const c = expenses(); c.giderKategoriDegisti(1); c.giderKategoriDegisti(2);
    first.next({ isSuccess: true, value: [item] }); first.complete();
    expect(c.giderKalemleri()[0].id).toBe(9); expect(c.giderForm.giderKalemiId).toBeNull(); expect(c.giderKalemLoading()).toBeFalse();
  });
  it('gider 202 yanıtında formu kapatmaz veya başarı bildirimi göstermez', () => {
    api.giderGuncelle.and.returnValue(of({ isSuccess: true, statusCode: 202 }));
    const c = expenses(); c.giderDuzenle(expense()); c.giderKaydet();
    expect(c.giderAcik()).toBeTrue(); expect(toast.info).toHaveBeenCalled(); expect(toast.success).not.toHaveBeenCalled();
  });
});
