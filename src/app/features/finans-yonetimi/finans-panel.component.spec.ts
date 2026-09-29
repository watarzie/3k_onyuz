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
  const ekIzinler = signal<string[]>([]);
  const panelVerisi = {
    siparisBekleyen: 4, kismiSiparis: 1, siparisTam: 2, kismiFatura: 0, tamamlanan: 3,
    tutarlar: [], aylik: [], isTurleri: [], giderTurleri: [], projeler: [], ozelIsTurleri: [],
  } as unknown as FinansPanel;
  beforeEach(() => {
    kayitIzni.set(false);
    ekIzinler.set([]);
    api = jasmine.createSpyObj('FinansService', ['panel', 'hareketler', 'genelArama', 'yaslandirma']);
    toast = jasmine.createSpyObj('ToastService', ['error']);
    api.panel.and.returnValue(of({ isSuccess: true, value: panelVerisi }));
    const empty = { items: [], toplamlar: [], totalCount: 0, totalPages: 0, pageNumber: 1, pageSize: 25,
      hasPreviousPage: false, hasNextPage: false };
    api.hareketler.and.returnValue(of({ isSuccess: true, value: empty }));
    api.genelArama.and.returnValue(of({ isSuccess: true, value: empty }));
    api.yaslandirma.and.returnValue(of({ isSuccess: true, value: empty }));
    TestBed.configureTestingModule({ imports: [FinansPanelComponent], providers: [
      { provide: FinansService, useValue: api }, { provide: ToastService, useValue: toast },
      { provide: PermissionService, useValue: {
        hasAccess: (code: string) =>
          code === FINANS_YETKI.Modul || (code === FINANS_YETKI.KayitGoruntule && kayitIzni()) || ekIzinler().includes(code),
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
    expect(fixture.nativeElement.querySelector('.dashboard-counts').textContent).toContain('4');
    expect(fixture.nativeElement.querySelector('nav')).toBeNull();
    expect(fixture.nativeElement.querySelector('table')).toBeNull();
    fixture.componentInstance.gorunumSec('arama'); fixture.componentInstance.gorunumSec('bekleyen');
    expect(fixture.componentInstance.gorunum()).toBe('aylik');
    expect(api.genelArama).not.toHaveBeenCalled(); expect(api.yaslandirma).not.toHaveBeenCalled();
  });

  it('hareket listesi varsayılan kapalıdır; açılınca getirir, kayıt izni kalkınca gizler ve yeniden istek atmaz', () => {
    kayitIzni.set(true);
    const fixture = TestBed.createComponent(FinansPanelComponent); fixture.detectChanges();
    expect(api.hareketler).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('table')).toBeNull();
    fixture.componentInstance.hareketleriAcKapat(); fixture.detectChanges();
    expect(api.hareketler).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.querySelector('table')).not.toBeNull();
    fixture.componentInstance.gorunumSec('arama');
    expect(api.genelArama).toHaveBeenCalledTimes(1);
    kayitIzni.set(false); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('table')).toBeNull();
    fixture.componentInstance.yenile(); fixture.detectChanges();
    expect(api.hareketler).toHaveBeenCalledTimes(1);
    expect(api.genelArama).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.querySelector('.dashboard-counts')).not.toBeNull();
  });

  it('alacak kartları fatura okuma izniyle görünür; tutarlar yalnız tutar izniyle yazılır', () => {
    api.panel.and.returnValue(of({ isSuccess: true, value: { ...panelVerisi, vadeUyariGunu: 7, alacaklar: [{
      paraBirimi: 'USD', bekleyenTutar: 1500, bekleyenAdet: 3, vadesiGecenTutar: 500, vadesiGecenAdet: 1,
      yaklasanTutar: 1000, yaklasanAdet: 2, zamanindaOdenenAdet: 4, gecOdenenAdet: 1, odenenTutar: 2500,
    }] } }));
    kayitIzni.set(true);
    const fixture = TestBed.createComponent(FinansPanelComponent); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.dashboard-receivables')).toBeNull();

    ekIzinler.set([FINANS_YETKI.SiparisOperasyonGoruntule]); fixture.detectChanges();
    const kart = fixture.nativeElement.querySelector('.dashboard-receivables') as HTMLElement;
    expect(kart.querySelector('h5')!.textContent).toBe('USD');
    expect(kart.textContent).toContain('7 gün içinde');
    const degerler = () => Array.from(kart.querySelectorAll('dd')).map((x) => x.textContent!.trim());
    expect(degerler()).toEqual(['3', '1', '2', '5', '4 / 1']);

    ekIzinler.set([FINANS_YETKI.SiparisOperasyonGoruntule, FINANS_YETKI.ParasalVeriGoruntule, FINANS_YETKI.TutarGoruntule]);
    fixture.detectChanges();
    expect(degerler().slice(0, 4).every((x) => x.includes(' · '))).toBeTrue();
  });

  it('yaşlandırma kovası bekleme listesini kovanın aşaması ve eşiğiyle bugünden açar; boş kova tıklanamaz', () => {
    api.panel.and.returnValue(of({ isSuccess: true, value: { ...panelVerisi, yaslandirma: [
      { asama: 'Sipariş', minGun: 15, adet: 2, tutarlar: [] },
      { asama: 'Sipariş', minGun: 30, adet: 1, tutarlar: [] },
      { asama: 'Fatura', minGun: 60, adet: 0, tutarlar: [] },
    ] } }));
    kayitIzni.set(true);
    ekIzinler.set([FINANS_YETKI.RaporGoruntule]);
    const fixture = TestBed.createComponent(FinansPanelComponent); fixture.detectChanges();
    const kovalar = fixture.nativeElement.querySelectorAll('.dashboard-aging-bucket') as NodeListOf<HTMLButtonElement>;
    expect(kovalar.length).toBe(3);
    expect(kovalar[2].disabled).toBeTrue();
    kovalar[1].click(); fixture.detectChanges();
    expect(fixture.componentInstance.gorunum()).toBe('bekleyen');
    const [, referansTarihi, minimumGun, asama] = api.yaslandirma.calls.mostRecent().args;
    const bugun = new Date();
    expect(referansTarihi).toBe(
      `${bugun.getFullYear()}-${String(bugun.getMonth() + 1).padStart(2, '0')}-${String(bugun.getDate()).padStart(2, '0')}`,
    );
    expect(minimumGun).toBe(30);
    expect(asama).toBe('Sipariş');
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
