import { signal } from '@angular/core';
import { GRAFIK_RENKLERI } from '../../../core/constants/grafik-renkleri';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { FinansPanelComponent } from './finans-panel.component';
import { FinansService } from '../../../core/services/finans.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ToastService } from '../../../core/services/toast.service';
import { TranslationService } from '../../../core/services/translation.service';
import { FINANS_YETKI } from '../../../core/constants/yetki-kodlari';
import { FinansPanel } from '../../../shared/models/finans-v2.model';

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

  it('varsayılan tüm dönemlerin özetini açar; sekme, kalem listesi ve kayıt isteği yoktur', () => {
    kayitIzni.set(true);
    const fixture = TestBed.createComponent(FinansPanelComponent); fixture.detectChanges();
    expect(api.panel).toHaveBeenCalledTimes(1);
    const yil = new Date().getFullYear();
    expect(api.panel).toHaveBeenCalledWith(`${yil - 9}-01-01`, `${yil}-12-31`);
    expect(api.hareketler).not.toHaveBeenCalled();
    expect(api.genelArama).not.toHaveBeenCalled(); expect(api.yaslandirma).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('.dashboard-counts').textContent).toContain('4');
    expect(fixture.nativeElement.querySelector('nav')).toBeNull();
    expect(fixture.nativeElement.querySelector('table')).toBeNull();
  });

  it('dönem seçimi panel aralığını değiştirir; özel aralık tarih alanlarını açar ve kendiliğinden yenilemez', () => {
    const fixture = TestBed.createComponent(FinansPanelComponent); fixture.detectChanges();
    const c = fixture.componentInstance;
    const bugun = new Date();
    const ay = String(bugun.getMonth() + 1).padStart(2, '0');
    const sonGun = new Date(bugun.getFullYear(), bugun.getMonth() + 1, 0).getDate();
    c.donemSec('ay');
    expect(api.panel).toHaveBeenCalledWith(`${bugun.getFullYear()}-${ay}-01`, `${bugun.getFullYear()}-${ay}-${sonGun}`);
    c.donemSec('ozel'); fixture.detectChanges();
    expect(api.panel).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.querySelectorAll('.period-filter input[type="date"]').length).toBe(2);
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

  it('yaşlandırma kovası bekleme listesini İş Takibinde kovanın aşaması ve eşiğiyle açtırır; boş kova tıklanamaz', () => {
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
    const acilan = spyOn(fixture.componentInstance.bekleyenAc, 'emit');
    kovalar[1].click();
    expect(acilan).toHaveBeenCalledOnceWith({ asama: 'Sipariş', minimumGun: 30 });
    expect(api.yaslandirma).not.toHaveBeenCalled();
  });

  it('genel durum kartları iş kalemi, PO ve fatura sayılarını gösterir; PO/fatura kartları fatura okuma izniyle açılır', () => {
    api.panel.and.returnValue(of({ isSuccess: true, value: { ...panelVerisi, sayilar: {
      isKaydi: 10, proje: 3, po: 6, acikPo: 2, kismiFaturaliPo: 1, kapaliPo: 3,
      fatura: 9, odenenFatura: 7, odenmemisFatura: 2, vadesiGecenFatura: 1, giderKaydi: 4,
    } } }));
    kayitIzni.set(true);
    const fixture = TestBed.createComponent(FinansPanelComponent); fixture.detectChanges();
    const kartlar = () => Array.from(fixture.nativeElement.querySelectorAll('.kpi-card') as NodeListOf<HTMLElement>)
      .map((x) => x.getAttribute('data-kpi'));
    expect(kartlar()).toEqual(['is', 'gider']);
    expect(fixture.nativeElement.querySelector('[data-kpi="is"] .kpi-value').textContent.trim()).toBe('10');
    expect(fixture.nativeElement.querySelector('[data-kpi="is"]').textContent).toContain('3 proje');

    ekIzinler.set([FINANS_YETKI.SiparisOperasyonGoruntule]); fixture.detectChanges();
    expect(kartlar()).toEqual(['is', 'po', 'fatura', 'gider']);
    const po = fixture.nativeElement.querySelector('[data-kpi="po"]') as HTMLElement;
    expect(po.querySelector('.kpi-value')!.textContent!.trim()).toBe('6');
    expect(po.textContent).toContain('2 açık');
    expect(fixture.nativeElement.querySelector('[data-kpi="fatura"]').textContent).toContain('7 ödendi');
  });

  it('dönemsel grafik varsayılan olarak aylık adetleri çizer; gizleme tercihi hatırlanır', () => {
    localStorage.removeItem('3k_finans_panel_grafik');
    api.panel.and.returnValue(of({ isSuccess: true, value: { ...panelVerisi, aylikSayilar: [
      { ay: '2026-08', isKaydi: 4, po: 2, fatura: 1 },
      { ay: '2026-09', isKaydi: 6, po: 3, fatura: 5 },
    ] } }));
    kayitIzni.set(true);
    const fixture = TestBed.createComponent(FinansPanelComponent); fixture.detectChanges();
    const c = fixture.componentInstance;
    expect(c.series().map((x) => x.name)).toEqual(['İş kalemi']);
    expect(c.series()[0].data).toEqual([4, 6]);
    ekIzinler.set([FINANS_YETKI.SiparisOperasyonGoruntule]);
    expect(c.series().map((x) => x.data)).toEqual([[4, 6], [2, 3], [1, 5]]);
    expect(c.chart().type).toBe('area');

    c.grafikAcKapat(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('apx-chart')).toBeNull();
    expect(localStorage.getItem('3k_finans_panel_grafik')).toBe('0');
    expect(TestBed.createComponent(FinansPanelComponent).componentInstance.grafikAcik()).toBeFalse();
    localStorage.removeItem('3k_finans_panel_grafik');
  });

  it('grafik göstergesi seriyi gizleyip yeniden gösterir; düğme durumu seriyle aynı kalır, son seri gizlenmez', () => {
    localStorage.removeItem('3k_finans_panel_grafik');
    api.panel.and.returnValue(of({ isSuccess: true, value: { ...panelVerisi, aylikSayilar: [
      { ay: '2026-08', isKaydi: 4, po: 2, fatura: 1 },
      { ay: '2026-09', isKaydi: 6, po: 3, fatura: 5 },
    ] } }));
    kayitIzni.set(true);
    ekIzinler.set([FINANS_YETKI.SiparisOperasyonGoruntule]);
    const fixture = TestBed.createComponent(FinansPanelComponent); fixture.detectChanges();
    const c = fixture.componentInstance;
    const dugmeler = () => Array.from(fixture.nativeElement.querySelectorAll('.chart-legend__item')) as HTMLButtonElement[];
    const kapali = () => dugmeler().map((x) => x.classList.contains('is-off'));
    expect(dugmeler().length).toBe(3);
    expect(c.series().map((x) => x.color)).toEqual([GRAFIK_RENKLERI[0], GRAFIK_RENKLERI[1], GRAFIK_RENKLERI[2]]);

    dugmeler()[2].click(); fixture.detectChanges();
    expect(c.series().length).toBe(2);
    expect(kapali()).toEqual([false, false, true]);
    expect(c.series().map((x) => x.color)).toEqual([GRAFIK_RENKLERI[0], GRAFIK_RENKLERI[1]]);

    dugmeler()[2].click(); fixture.detectChanges();
    expect(c.series().map((x) => x.data)).toEqual([[4, 6], [2, 3], [1, 5]]);
    expect(kapali()).toEqual([false, false, false]);

    dugmeler()[1].click(); dugmeler()[2].click(); fixture.detectChanges();
    expect(dugmeler()[0].disabled).toBeTrue();
    c.seriAcKapat('is'); fixture.detectChanges();
    expect(c.series().length).toBe(1);

    c.grafikGorunumuSec('adet'); fixture.detectChanges();
    expect(kapali()).toEqual([false, false, false]);
    localStorage.removeItem('3k_finans_panel_grafik');
  });

  it('bekleyen iş yoksa bekleme kartı kova yerine sakin bir durum gösterir', () => {
    api.panel.and.returnValue(of({ isSuccess: true, value: { ...panelVerisi, yaslandirma: [
      { asama: 'Sipariş', minGun: 15, adet: 0, tutarlar: [] },
      { asama: 'Fatura', minGun: 15, adet: 0, tutarlar: [] },
    ] } }));
    const fixture = TestBed.createComponent(FinansPanelComponent); fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.dashboard-aging-bucket').length).toBe(0);
    expect(fixture.nativeElement.querySelector('.dashboard-aging').textContent).toContain('15 günden uzun bekleyen iş yok.');
  });

  it('dil değişiminde başlık ve grafik etiketlerini günceller', () => {
    const fixture = TestBed.createComponent(FinansPanelComponent); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('h3').textContent).toBe('Finans kontrol paneli');
    fixture.componentInstance.grafikGorunumuSec('dagilim');
    fixture.componentInstance.grafik.set('siparis');
    TestBed.inject(TranslationService).switchLanguage('en'); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('h3').textContent).toBe('Finance dashboard');
    expect(fixture.componentInstance.xaxis().categories).toEqual(['Awaiting PO', 'PO placed']);
  });
});
