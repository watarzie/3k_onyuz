import { signal } from '@angular/core';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { of } from 'rxjs';
import { FINANS_YETKI } from '../../../core/constants/yetki-kodlari';
import { ConfirmService } from '../../../core/services/confirm.service';
import { FinansService } from '../../../core/services/finans.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ToastService } from '../../../core/services/toast.service';
import { TranslationService } from '../../../core/services/translation.service';
import { FinansIsKaydi } from '../../../shared/models/finans.model';
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
    [FINANS_YETKI.Modul, FINANS_YETKI.SekmeMunferitIsler, FINANS_YETKI.KayitGoruntule].forEach((k) => okuma.add(k));
    api = jasmine.createSpyObj<FinansService>('FinansService', ['munferitIsler', 'munferitIsOlustur', 'urunSecenekleri', 'urunler', 'ozelIsIptal', 'ozelIsGeriAl']);
    api.munferitIsler.and.returnValue(of({ isSuccess: true, value: sayfa([kayit(1), kayit(2, { iptalEdildi: true })]) }));
    api.urunSecenekleri.and.returnValue(of({ isSuccess: true, value: [
      { id: 7, kod: 'HX-KASA', ad: 'Haliade-X kasa', fiyatlandirmaBirimi: 1 },
      { id: 8, kod: 'SKIT-M3', ad: 'SKIT kontra', fiyatlandirmaBirimi: 2 },
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

  it('ayın aralığında münferit işleri listeler; iptalleri göster sunucuya gider; yazma izni yoksa yeni iş düğmesi yoktur', () => {
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

    yazma.add(FINANS_YETKI.ManuelIsEkle);
    fixture.detectChanges();
    expect(c.ekleyebilir()).toBeFalse();
    yazma.add(FINANS_YETKI.SekmeMunferitIsler);
    expect(c.ekleyebilir()).toBeTrue();
  });

  it('m³ ile fiyatlanan tanımda ahşap/kontra m³ zorunludur; istek fiyat alanı taşımaz', fakeAsync(() => {
    yazma.add(FINANS_YETKI.ManuelIsEkle);
    yazma.add(FINANS_YETKI.SekmeMunferitIsler);
    const { fixture, c, el } = olustur();
    c.yeniAc();
    tick(300);
    fixture.detectChanges();
    expect(el.querySelectorAll('.adhoc-option').length).toBe(2);

    c.kaydet();
    expect(c.hata()).toBe('İş/ürün tanımı seçin.');
    c.urunSec(c.urunSecenekleri()[1]);
    c.form = { ...c.form, isAdi: 'Kontra kasa', ozelIsTuru: 'SKIT' };
    fixture.detectChanges();
    expect(el.querySelector('.adhoc-volume')).not.toBeNull();
    c.kaydet();
    expect(c.hata()).toContain('m³');
    expect(api.munferitIsOlustur).not.toHaveBeenCalled();

    c.form = { ...c.form, ahsapM3: 1.2, kontraM3: 0.8 };
    fixture.detectChanges();
    expect((el.querySelector('.adhoc-composite') as HTMLInputElement).value).toBe('2');
    c.kaydet();
    const istek = api.munferitIsOlustur.calls.mostRecent().args[0];
    expect(istek).toEqual(jasmine.objectContaining({ finansUrunId: 8, isAdi: 'Kontra kasa', ozelIsTuru: 'SKIT', ahsapM3: 1.2, kontraM3: 0.8, adet: 1 }));
    expect(Object.keys(istek).some((k) => /fiyat|paraBirimi|kdv/i.test(k))).toBeFalse();
    expect(c.formAcik()).toBeFalse();
    // Fiyat önizlemesi tarifeleri görme izni olmadan istenmez.
    expect(api.urunler).not.toHaveBeenCalled();
  }));

  it('tarifeleri ve birim fiyatı görebilen kullanıcıya iş tarihindeki tarife fiyatıyla önizleme gösterilir', () => {
    yazma.add(FINANS_YETKI.ManuelIsEkle);
    yazma.add(FINANS_YETKI.SekmeMunferitIsler);
    [FINANS_YETKI.ParasalVeriGoruntule, FINANS_YETKI.BirimFiyatGoruntule, FINANS_YETKI.SekmeTanimlar, FINANS_YETKI.IsKutuphanesiYonet]
      .forEach((k) => okuma.add(k));
    api.urunler.and.returnValue(of({ isSuccess: true, value: { ...sayfa([]), items: [{ id: 7, guncelBirimFiyat: 1250, guncelParaBirimi: 'EUR' }] as never } }));
    const { c } = olustur();
    c.yeniAc();
    c.form = { ...c.form, adet: 2, isTarihi: '2026-10-06' };
    c.urunSec({ id: 7, kod: 'HX-KASA', ad: 'Haliade-X kasa', fiyatlandirmaBirimi: 1 });
    expect(api.urunler).toHaveBeenCalledOnceWith(jasmine.objectContaining({ arama: 'HX-KASA', tarifeTarihi: '2026-10-06' }));
    expect(c.fiyatOnizleme()).toEqual({ birimFiyat: 1250, paraBirimi: 'EUR' });
    expect(c.onizlemeTutari()).toBe(2500);
  });

  it('iptal gerekçeyle yapılır; PO aç yalnız PO girme izniyle ve PO\'suz işte', async () => {
    yazma.add(FINANS_YETKI.IsIptal);
    const { c } = olustur();
    confirm.askWithReason.and.returnValue(Promise.resolve('Mükerrer kayıt'));
    await c.iptal(kayit(1));
    expect(api.ozelIsIptal).toHaveBeenCalledOnceWith(1, 'Mükerrer kayıt');

    const acilan: number[][] = [];
    c.siparisAc.subscribe((ids) => acilan.push(ids));
    c.poAc(kayit(1));
    expect(acilan).toEqual([]);
    okuma.add(FINANS_YETKI.SiparisOperasyonGoruntule);
    yazma.add(FINANS_YETKI.PoGir);
    c.poAc(kayit(1));
    expect(acilan).toEqual([[1]]);
  });
});
