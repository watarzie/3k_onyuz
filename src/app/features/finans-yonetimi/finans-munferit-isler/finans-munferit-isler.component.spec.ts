import { signal } from '@angular/core';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { of } from 'rxjs';
import { FINANS_YETKI } from '../../../core/constants/yetki-kodlari';
import { ConfirmService } from '../../../core/services/confirm.service';
import { FinansService } from '../../../core/services/finans.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ToastService } from '../../../core/services/toast.service';
import { TranslationService } from '../../../core/services/translation.service';
import { FinansIsKaydi, FinansUrunSecenegi } from '../../../shared/models/finans.model';
import { ApiResult } from '../../../shared/models/common.model';
import { FinansMunferitIslerComponent } from './finans-munferit-isler.component';

describe('Finans Münferit İşler sekmesi', () => {
  let api: jasmine.SpyObj<FinansService>;
  let confirm: jasmine.SpyObj<ConfirmService>;
  // Gerçek PermissionService sinyal okur; computed izinler değişince yeniden hesaplansın diye sahte de sinyaldir.
  const okumaS = signal(new Set<string>());
  const yazmaS = signal(new Set<string>());
  const okuma = { add: (k: string) => okumaS.update((x) => new Set(x).add(k)), clear: () => okumaS.set(new Set()) };
  const yazma = { add: (k: string) => yazmaS.update((x) => new Set(x).add(k)), clear: () => yazmaS.set(new Set()) };
  const kayit = (id: number, ek: Partial<FinansIsKaydi> = {}) =>
    ({ id, isAdi: 'Kanat kasası', musteri: 'GE Vernova', projeNo: '', adet: 2, birim: 'Adet', toplamM3: 0, netTutar: 2500,
       paraBirimi: 'EUR', finansTarihi: '2026-10-06', poNumaralari: [], faturaNumaralari: [], iptalEdildi: false, ...ek }) as FinansIsKaydi;
  const sayfa = (items: FinansIsKaydi[]) =>
    ({ items, toplamlar: [], totalCount: items.length, totalPages: 1, pageNumber: 1, pageSize: 25, hasPreviousPage: false, hasNextPage: false });

  beforeEach(() => {
    okuma.clear();
    yazma.clear();
    [FINANS_YETKI.Modul, FINANS_YETKI.SekmeMunferitIsler].forEach((k) => okuma.add(k));
    api = jasmine.createSpyObj<FinansService>('FinansService', ['munferitIsler', 'munferitIsOlustur', 'urunSecenekleri', 'ozelIsIptal', 'ozelIsGeriAl']);
    api.munferitIsler.and.returnValue(of({ isSuccess: true, value: sayfa([kayit(1), kayit(2, { iptalEdildi: true })]) }));
    api.urunSecenekleri.and.returnValue(of({ isSuccess: true, value: [
      // Sekme R izniyle tarife fiyatı her zaman gelir (alan maskesi yoktur).
      { id: 7, kod: 'HX-KASA', ad: 'Haliade-X kasa', fiyatlandirmaBirimi: 1, birimFiyat: 1250, paraBirimi: 'EUR' },
      { id: 8, kod: 'SKIT-M3', ad: 'SKIT kontra', fiyatlandirmaBirimi: 2, birimFiyat: 300, paraBirimi: 'EUR' },
    ] }));
    api.munferitIsOlustur.and.returnValue(of({ isSuccess: true, value: kayit(3) }));
    api.ozelIsIptal.and.returnValue(of({ isSuccess: true }));
    confirm = jasmine.createSpyObj<ConfirmService>('ConfirmService', ['askWithReason']);
    TestBed.configureTestingModule({
      imports: [FinansMunferitIslerComponent],
      providers: [
        { provide: FinansService, useValue: api },
        { provide: ConfirmService, useValue: confirm },
        { provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['success', 'info', 'error']) },
        { provide: PermissionService, useValue: { hasAccess: (k: string) => okumaS().has(k) || yazmaS().has(k), canWrite: (k: string) => yazmaS().has(k) } },
      ],
    });
    TestBed.inject(TranslationService).switchLanguage('tr');
  });

  function olustur() {
    const fixture = TestBed.createComponent(FinansMunferitIslerComponent);
    fixture.detectChanges();
    return { fixture, c: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
  }

  it('ayın aralığında münferit işleri listeler; iptalleri göster sunucuya gider; sekmede W izni yoksa yeni iş düğmesi yoktur', () => {
    const { fixture, c, el } = olustur();
    const istek = api.munferitIsler.calls.mostRecent().args[0];
    expect(istek.baslangic).toMatch(/^\d{4}-\d{2}-01$/);
    expect(istek.iptalEdilenleriDahilEt).toBeFalse();
    expect(el.querySelectorAll('tr.adhoc-row').length).toBe(2);
    expect(el.querySelector('tr.adhoc-row.is-cancelled')).not.toBeNull();
    expect(el.querySelector('.adhoc-new')).toBeNull();

    c.iptalleriGoster = true;
    c.filtrele();
    expect(api.munferitIsler.calls.mostRecent().args[0].iptalEdilenleriDahilEt).toBeTrue();

    // Başka sekmenin W izni Münferit İşler'de iş eklemez.
    yazma.add(FINANS_YETKI.SekmeIsTakibi);
    fixture.detectChanges();
    expect(c.ekleyebilir()).toBeFalse();
    yazma.add(FINANS_YETKI.SekmeMunferitIsler);
    fixture.detectChanges();
    expect(c.ekleyebilir()).toBeTrue();
    expect(el.querySelector('.adhoc-new')).not.toBeNull();
  });

  it('form yalnız tarife + proje + tarih ister; m³ tarifesinde ahşap/kontra m³ zorunludur; istek iş adı ve fiyat taşımaz', fakeAsync(() => {
    yazma.add(FINANS_YETKI.SekmeMunferitIsler);
    const { fixture, c, el } = olustur();
    c.yeniAc();
    tick(300);
    fixture.detectChanges();
    expect(api.urunSecenekleri).toHaveBeenCalledWith('', undefined, c.form.isTarihi);
    expect(el.querySelectorAll('select.adhoc-tariff option').length).toBe(3);

    c.kaydet();
    expect(c.hata()).toBe('Tarife seçin.');
    c.urunSecId(8);
    fixture.detectChanges();
    c.kaydet();
    expect(c.hata()).toBe('Sistemden bir proje seçin veya proje adını yazın.');

    // Serbest proje adı: sistemde olmayan proje.
    c.projeKaynagiSec('serbest');
    c.form = { ...c.form, projeAdi: '  Rüzgar Sahası ' };
    fixture.detectChanges();
    expect(el.querySelector('.adhoc-volume')).not.toBeNull();
    expect(el.querySelector('.adhoc-quantity')).toBeNull();
    c.kaydet();
    expect(c.hata()).toContain('m³');
    expect(api.munferitIsOlustur).not.toHaveBeenCalled();

    c.form = { ...c.form, ahsapM3: 1.2, kontraM3: 0.8 };
    fixture.detectChanges();
    // Ahşap ve kontra ayrı girilir; toplam ("bileşik") alanı yoktur.
    expect(el.querySelector('.adhoc-composite')).toBeNull();
    c.kaydet();
    const istek = api.munferitIsOlustur.calls.mostRecent().args[0];
    expect(istek).toEqual({ finansUrunId: 8, projeId: null, projeAdi: 'Rüzgar Sahası', isTarihi: c.form.isTarihi, adet: 1, ahsapM3: 1.2, kontraM3: 0.8 });
    expect(Object.keys(istek).some((k) => /fiyat|paraBirimi|kdv|isAdi|musteri/i.test(k))).toBeFalse();
    expect(c.formAcik()).toBeFalse();
  }));

  it('adet tarifesinde sistem projesiyle adet gönderilir; tarih değişince fiyat o tarihe göre yenilenir, tarifesiz tarih engellenir', fakeAsync(() => {
    yazma.add(FINANS_YETKI.SekmeMunferitIsler);
    api.urunSecenekleri.and.returnValue(of({ isSuccess: true, value: [
      { id: 7, kod: 'HX-KASA', ad: 'Haliade-X kasa', fiyatlandirmaBirimi: 1, birimFiyat: 1250, paraBirimi: 'EUR', kdvOrani: 20 },
    ] }));
    const { fixture, c, el } = olustur();
    c.yeniAc();
    tick(300);
    c.urunSecId(7);
    c.projeSec({ projeId: 3, projeNo: 'PA-3', musteri: 'GE Vernova' });
    c.form = { ...c.form, adet: 2 };
    fixture.detectChanges();
    expect(c.secenekEtiketi(c.urunSecenekleri()[0])).toContain('1.250,00 EUR/adet');
    expect(c.onizlemeTutari()).toBe(2500);
    expect(el.querySelector('.adhoc-preview')?.textContent).toContain('Haliade-X kasa');

    // Yeni tarihte tarife yok: seçili tarifenin fiyatı yenilenir ve kayıt engellenir.
    api.urunSecenekleri.and.returnValue(of({ isSuccess: true, value: [
      { id: 7, kod: 'HX-KASA', ad: 'Haliade-X kasa', fiyatlandirmaBirimi: 1, birimFiyat: null, paraBirimi: null, kdvOrani: null },
    ] }));
    c.form = { ...c.form, isTarihi: '2026-01-05' };
    c.secenekleriYukle();
    tick(300);
    fixture.detectChanges();
    expect(api.urunSecenekleri).toHaveBeenCalledWith('', undefined, '2026-01-05');
    expect(c.tarifesizTarih()).toBeTrue();
    expect(el.querySelector('.adhoc-no-tariff')).not.toBeNull();
    c.kaydet();
    expect(api.munferitIsOlustur).not.toHaveBeenCalled();

    api.urunSecenekleri.and.returnValue(of({ isSuccess: true, value: [
      { id: 7, kod: 'HX-KASA', ad: 'Haliade-X kasa', fiyatlandirmaBirimi: 1, birimFiyat: 1250, paraBirimi: 'EUR', kdvOrani: 20 },
    ] }));
    c.form = { ...c.form, isTarihi: '2026-10-06' };
    c.secenekleriYukle();
    tick(300);
    c.kaydet();
    expect(api.munferitIsOlustur).toHaveBeenCalledOnceWith(
      { finansUrunId: 7, projeId: 3, projeAdi: null, isTarihi: '2026-10-06', adet: 2, ahsapM3: null, kontraM3: null });
  }));

  it('tarife listesi yüklenemezse sessizce boş kalmaz; hata formda gösterilir', fakeAsync(() => {
    yazma.add(FINANS_YETKI.SekmeMunferitIsler);
    api.urunSecenekleri.and.returnValue(of({ isSuccess: false, error: 'Yetkiniz yok', statusCode: 403 } as ApiResult<FinansUrunSecenegi[]>));
    const { fixture, c, el } = olustur();
    c.yeniAc();
    tick(300);
    fixture.detectChanges();
    expect(c.secenekHatasi()).toBe('Yetkiniz yok');
    expect(el.querySelector('.adhoc-options-error')?.textContent).toContain('Yetkiniz yok');
  }));

  it('iptal gerekçeyle yapılır; iptal ve PO aç yalnız sekmenin W izniyle açılır', async () => {
    const { c } = olustur();
    confirm.askWithReason.and.returnValue(Promise.resolve('Mükerrer kayıt'));
    const acilan: number[][] = [];
    c.siparisAc.subscribe((ids) => acilan.push(ids));
    // Yalnız R: iptal ve PO aç kapalı.
    await c.iptal(kayit(1));
    c.poAc(kayit(1));
    expect(api.ozelIsIptal).not.toHaveBeenCalled();
    expect(acilan).toEqual([]);

    yazma.add(FINANS_YETKI.SekmeMunferitIsler);
    await c.iptal(kayit(1));
    expect(api.ozelIsIptal).toHaveBeenCalledOnceWith(1, 'Mükerrer kayıt');
    c.poAc(kayit(1));
    expect(acilan).toEqual([[1]]);
  });
});
