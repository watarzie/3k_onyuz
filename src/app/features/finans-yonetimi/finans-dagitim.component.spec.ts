import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { FinansDagitimComponent } from './finans-dagitim.component';
import { FinansService } from '../../core/services/finans.service';
import { PermissionService } from '../../core/services/permission.service';
import { ToastService } from '../../core/services/toast.service';
import { FinansIsKaydi, FinansSiparisDetay } from '../../shared/models/finans.model';

describe('Finans tutar dağıtımı', () => {
  let api: jasmine.SpyObj<FinansService>;
  let toast: jasmine.SpyObj<ToastService>;
  beforeEach(() => {
    api = jasmine.createSpyObj('FinansService', ['isKayitlariSecim', 'siparisOlustur', 'faturaOlustur', 'siparisler', 'siparisDetay']);
    toast = jasmine.createSpyObj('ToastService', ['success', 'info']);
    api.isKayitlariSecim.and.returnValue(of({isSuccess: true, value: [{id: 11, projeNo: 'PA1', sandikNo: '1', sandikAdi: 'İş', paraBirimi: 'EUR', kalanSiparisNetTutar: 10000} as FinansIsKaydi]}));
    api.siparisOlustur.and.returnValue(of({isSuccess: true, value: {id: 7} as never}));
    api.faturaOlustur.and.returnValue(of({isSuccess: true, value: {id: 8} as never}));
    api.siparisler.and.returnValue(of({isSuccess: true, value: {items: [], totalCount: 0} as never}));
    api.siparisDetay.and.returnValue(of({isSuccess: true, value: {ozet: {id: 7, poNumarasi: 'PO-1'}, kalemler: [{id: 21, sandikNo: '1', sandikAdi: 'İş', paraBirimi: 'EUR', kalanFaturaNetTutar: 6000}]} as FinansSiparisDetay}));
    TestBed.configureTestingModule({ imports:[FinansDagitimComponent], providers:[{provide:FinansService,useValue:api},{provide:ToastService,useValue:toast},{provide:PermissionService,useValue:{canWrite:()=>true}}] });
  });
  function setup(tur: 'Siparis'|'Fatura' = 'Siparis', po?: number) {
    const fixture = TestBed.createComponent(FinansDagitimComponent);
    fixture.componentRef.setInput('tur', tur); fixture.componentRef.setInput('isKaydiIds', [11]);
    if(po) fixture.componentRef.setInput('siparisId',po);
    fixture.detectChanges();
    const component=fixture.componentInstance; component.numara='BELGE-2026-1';component.tarih='2026-09-19';
    return {fixture, component};
  }
  it('10.000 EUR işin 6.000 EUR kısmını fiziksel adet/m³ uydurmadan gönderir',()=>{
    const {component}=setup();component.satirlar()[0].secili=true;component.satirlar()[0].netTutar=6000;component.kaydet();
    expect(api.siparisOlustur.calls.mostRecent().args[0].kalemler).toEqual([{isKaydiId:11,adet:0,m3:0,netTutar:6000}]);
  });
  it('faturayı gerçek belge numarası ve seçili PO kalemindeki kısmi tutarla gönderir',()=>{
    const {component}=setup('Fatura',7);component.satirlar()[0].secili=true;component.satirlar()[0].netTutar=4000;component.kaydet();
    const request=api.faturaOlustur.calls.mostRecent().args[0];expect(request.faturaNumarasi).toBe('BELGE-2026-1');expect(request.siparisId).toBe(7);expect(request.kalemler).toEqual([{siparisKalemiId:21,adet:0,m3:0,netTutar:4000}]);
  });
  it('6.000 EUR açık PO üstünde 6.001 fatura göndermeyi engeller',()=>{
    const {component}=setup('Fatura',7);component.satirlar()[0].secili=true;component.satirlar()[0].netTutar=6001;component.kaydet();expect(api.faturaOlustur).not.toHaveBeenCalled();
  });
  it('PO seçilmeden fatura oluşturmaz',()=>{const {component}=setup('Fatura');component.kaydet();expect(api.faturaOlustur).not.toHaveBeenCalled();});
  it('aynı belgeye para birimi karıştırmaz',()=>{const {component}=setup();component.satirlar()[0].secili=true;component.satirlar()[0].netTutar=100;component.paraBirimi='USD';component.kaydet();expect(api.siparisOlustur).not.toHaveBeenCalled();});
  it('202 onay yanıtını uygulanmış belge saymaz',()=>{
    api.siparisOlustur.and.returnValue(of({isSuccess:true,statusCode:202}));const {component}=setup();const done=spyOn(component.kaydedildi,'emit');component.satirlar()[0].secili=true;component.satirlar()[0].netTutar=100;component.kaydet();expect(done).not.toHaveBeenCalled();expect(toast.info).toHaveBeenCalled();expect(toast.success).not.toHaveBeenCalled();
  });
  it('HTTP başarı içinde isSuccess false ise modalı açık tutar',()=>{
    api.siparisOlustur.and.returnValue(of({isSuccess:false,error:'Bakiye değişti'}));const {component}=setup();const done=spyOn(component.kaydedildi,'emit');component.satirlar()[0].secili=true;component.satirlar()[0].netTutar=100;component.kaydet();expect(component.hata()).toBe('Bakiye değişti');expect(done).not.toHaveBeenCalled();
  });
  it('yetkisiz bakiye null ise sahte sıfır veya tam tutar kullanmaz',()=>{const {component}=setup();component.satirlar()[0].kalan=null;component.satirlar()[0].secili=true;component.satirlar()[0].netTutar=1;component.kaydet();expect(api.siparisOlustur).not.toHaveBeenCalled();});
});
