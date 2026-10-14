import { signal } from '@angular/core';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { FinansOdemeFiltresi } from '../../../core/constants/enums';
import { FINANS_YETKI } from '../../../core/constants/yetki-kodlari';
import { FinansService } from '../../../core/services/finans.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ToastService } from '../../../core/services/toast.service';
import { TranslationService } from '../../../core/services/translation.service';
import { ApiResult } from '../../../shared/models/common.model';
import { FinansFatura, FinansSayfaliSonuc, FinansSiparis } from '../../../shared/models/finans.model';
import { FinansBelgelerListesiComponent } from './finans-belgeler-listesi.component';
import { FinansRaporlarComponent } from '../finans-raporlar/finans-raporlar.component';

describe('Finans yönetim tasarımı — mevcut iş akışları', () => {
  let api: jasmine.SpyObj<FinansService>;
  let toast: jasmine.SpyObj<ToastService>;
  const write = signal(true);
  /** Okunamayan rol ağacı düğümleri (alt sekme izinleri için). */
  const gizli = signal<string[]>([]);
  const fatura: FinansFatura = {
    id: 8,
    kayitNo: 'F8',
    faturaNumarasi: 'INV-8',
    faturaTarihi: '2026-09-01T00:00:00',
    poNumarasi: 'PO-7',
    projeNo: 'PROJE-A',
    isTurleri: [],
    sandikAdedi: 1,
    toplamM3: null,
    durum: 1,
    vadeTarihi: '2026-09-15T00:00:00',
    odendiMi: false,
    vadeFarkiGun: -14,
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
      'siparisler',
      'faturalar',
      'faturaOdeme',
      'giderKategorileri',
      'paraBirimleri',
    ]);
    toast = jasmine.createSpyObj('ToastService', ['success', 'info', 'error']);
    api.faturaOdeme.and.returnValue(of({ isSuccess: true }));
    api.paraBirimleri.and.returnValue(of({ isSuccess: true, value: [] }));
    api.siparisler.and.returnValue(of({ isSuccess: true, value: page<FinansSiparis>([]) }));
    api.faturalar.and.returnValue(of({ isSuccess: true, value: page<FinansFatura>([]) }));
    api.giderKategorileri.and.returnValue(of({ isSuccess: true, value: [] }));
    gizli.set([]);
    TestBed.configureTestingModule({
      imports: [FinansBelgelerListesiComponent, FinansRaporlarComponent],
      providers: [
        { provide: FinansService, useValue: api },
        { provide: ToastService, useValue: toast },
        {
          provide: PermissionService,
          useValue: { hasAccess: (kod: string) => !gizli().includes(kod), canWrite: (kod: string) => write() && !gizli().includes(kod) },
        },
        { provide: TranslationService, useValue: { translate: (key: string) => key } },
      ],
    });
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

  it('vade uyarısından açılan fatura listesi ödeme filtresini sunucuya gönderir; PO listesine geçince bırakır', () => {
    const fixture = TestBed.createComponent(FinansBelgelerListesiComponent);
    fixture.componentRef.setInput('baslangicTuru', 'Fatura');
    fixture.componentRef.setInput('baslangicOdemeFiltresi', FinansOdemeFiltresi.VadesiGecen);
    fixture.detectChanges();
    expect(api.faturalar).toHaveBeenCalledOnceWith({
      pageNumber: 1,
      pageSize: 25,
      arama: undefined,
      odemeDurumu: FinansOdemeFiltresi.VadesiGecen,
    });
    fixture.componentInstance.turSec('Siparis');
    expect(api.siparisler.calls.mostRecent().args[0]).toEqual({ pageNumber: 1, pageSize: 25, arama: undefined });
  });

  it('hızlı ödeme paneli: işaretlemede geçerli tarih, kaldırmada gerekçe ister; kayıttan sonra listeyi yeniler', () => {
    api.faturalar.and.returnValue(of({ isSuccess: true, value: page<FinansFatura>([fatura]) }));
    const fixture = TestBed.createComponent(FinansBelgelerListesiComponent);
    fixture.componentRef.setInput('baslangicTuru', 'Fatura');
    fixture.detectChanges();
    const c = fixture.componentInstance;
    c.odemePaneliniAc(fatura);
    expect(c.odemeForm).toEqual({ odendi: true, tarih: c.bugun(), aciklama: '' });
    c.odemeForm.tarih = '2999-01-01';
    c.odemeKaydet();
    expect(api.faturaOdeme).not.toHaveBeenCalled();
    expect(c.odemeHatasi()).toBe('FINANS_V2.PAYMENT_DATE_ERROR');
    c.odemeForm.tarih = '2026-09-20';
    c.odemeKaydet();
    expect(api.faturaOdeme).toHaveBeenCalledOnceWith(8, { odendi: true, odemeTarihi: '2026-09-20', aciklama: null });
    expect(c.odemeFatura()).toBeNull();
    expect(toast.success).toHaveBeenCalledOnceWith('FINANS_V2.PAYMENT_SAVED');
    expect(api.faturalar).toHaveBeenCalledTimes(2);

    c.odemePaneliniAc({ ...fatura, odendiMi: true });
    expect(c.odemeForm.odendi).toBeFalse();
    c.odemeForm.aciklama = 'kısa';
    c.odemeKaydet();
    expect(c.odemeHatasi()).toBe('FINANS_V2.PAYMENT_UNMARK_REASON_ERROR');
    expect(api.faturaOdeme).toHaveBeenCalledTimes(1);
  });

  it('Faturalar alt sekmesi okunamıyorsa fatura listesi düğmesi yoktur; vade uyarısından fatura istense de PO listesi açılır', () => {
    gizli.set([FINANS_YETKI.SekmePoFaturaFatura]);
    const fixture = TestBed.createComponent(FinansBelgelerListesiComponent);
    fixture.componentRef.setInput('baslangicTuru', 'Fatura');
    fixture.detectChanges();
    const c = fixture.componentInstance;
    expect(c.tur).toBe('Siparis');
    expect(fixture.nativeElement.querySelectorAll('.v2-segmented button').length).toBe(1);
    expect(api.siparisler).toHaveBeenCalled();
    expect(api.faturalar).not.toHaveBeenCalled();
    c.turSec('Fatura');
    expect(c.tur).toBe('Siparis');
    // Fatura girişi ve ödeme Faturalar alt sekmesinin W iznine bağlıdır.
    expect(c.faturaGirilebilir()).toBeFalse();
    expect(c.odemeKaydedilebilir(fatura)).toBeFalse();
  });

  it("açık listenin alt sekme izni kalkınca okunabilen listeye geçilir; PO'lar okunamasa da Faturalar W ile fatura girilir", () => {
    const fixture = TestBed.createComponent(FinansBelgelerListesiComponent);
    fixture.detectChanges();
    const c = fixture.componentInstance;
    expect(c.tur).toBe('Siparis');
    expect(c.faturaGirilebilir()).toBeTrue();
    gizli.set([FINANS_YETKI.SekmePoFaturaPo]);
    fixture.detectChanges();
    expect(c.tur).toBe('Fatura');
    expect(api.faturalar).toHaveBeenCalled();
    // PO seçimi için PO listesi Faturalar alt sekmesine de açıktır.
    expect(c.faturaGirilebilir()).toBeTrue();
    expect(c.odemeKaydedilebilir(fatura)).toBeTrue();
  });

  it('ödeme yazma izni yoksa hızlı ödeme paneli açılmaz; 202 yanıtı onay bilgisini gösterir', () => {
    const fixture = TestBed.createComponent(FinansBelgelerListesiComponent);
    fixture.detectChanges();
    const c = fixture.componentInstance;
    write.set(false);
    c.odemePaneliniAc(fatura);
    expect(c.odemeFatura()).toBeNull();

    write.set(true);
    api.faturaOdeme.and.returnValue(of({ isSuccess: true, statusCode: 202 }));
    c.odemePaneliniAc(fatura);
    c.odemeForm.tarih = '2026-09-20';
    c.odemeKaydet();
    expect(toast.info).toHaveBeenCalledOnceWith('FINANS_V2.APPROVAL_QUEUED');
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('vade metni kalan günü, gecikmeyi ve geç ödemeyi ayırır', () => {
    const fixture = TestBed.createComponent(FinansBelgelerListesiComponent);
    const c = fixture.componentInstance;
    expect(c.vadeMetni({ ...fatura, vadeFarkiGun: -14 })).toBe('FINANS_V2.OVERDUE_DAYS');
    expect(c.vadeMetni({ ...fatura, vadeFarkiGun: 0 })).toBe('FINANS_V2.DUE_TODAY');
    expect(c.vadeMetni({ ...fatura, odendiMi: true, vadeFarkiGun: -1 })).toBe('');
    expect(c.vadeMetni({ ...fatura, odendiMi: true, vadeFarkiGun: 3 })).toBe('FINANS_V2.PAYMENT_PAID_DAYS_LATE');
  });

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
