import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { Subject, of } from 'rxjs';
import { AracYuklemeService } from '../../../core/services/arac-yukleme.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  ApiResult,
  AracYuklemeDurumu,
  AracYuklemeOturumu,
  YerlesimKontrolSonucu,
  YuklemeOturumDurumu,
} from '../../../shared/models/index';
import { AracYuklemeOturumComponent, DURUM_YENILEME_MS } from './arac-yukleme-oturum.component';

function oturum(yuklenen: number, durum = YuklemeOturumDurumu.Acik, planDegisti = false): AracYuklemeOturumu {
  return {
    id: 5, revizyonNo: 3, durum, baslatan: 'Ayşe', baslamaTarihi: '2026-11-09T08:30:00', kapatan: null, kapanisTarihi: null,
    kapanisGerekcesi: null, aracSayisi: 2, toplamYuk: 14, yuklenenYuk: yuklenen, planDegisti,
  };
}

function durum(o: AracYuklemeOturumu | null, ek: Partial<AracYuklemeDurumu> = {}): AracYuklemeDurumu {
  return {
    planId: 7, planNo: 'YP-2026-000007', planAdi: 'Wasit sevki', yuklemeTarihi: null, sonRevizyonNo: 4, yerlesimVar: true,
    yerlesimSonucu: YerlesimKontrolSonucu.Uygun, baslatilabilir: o === null, oturum: o,
    araclar: [
      { aracNo: 1, ekipmanKodu: 'K40', ekipmanAdi: '40 ft', tipAdi: 'Kapalı', projeNolari: ['P1'], toplamKg: 4300, toplamYuk: 9,
        yuklenenYuk: Math.min(9, o?.yuklenenYuk ?? 0), sonuc: YerlesimKontrolSonucu.Uygun },
      { aracNo: 2, ekipmanKodu: 'K40', ekipmanAdi: '40 ft', tipAdi: 'Kapalı', projeNolari: ['P1'], toplamKg: 2200, toplamYuk: 5,
        yuklenenYuk: Math.max(0, (o?.yuklenenYuk ?? 0) - 9), sonuc: YerlesimKontrolSonucu.Uygun },
    ],
    ...ek,
  };
}

const tamam = <T>(value: T): ApiResult<T> => ({ isSuccess: true, value }) as ApiResult<T>;
const hata = <T>(error: string): ApiResult<T> => ({ isSuccess: false, error }) as ApiResult<T>;

describe('AracYuklemeOturumComponent', () => {
  let api: jasmine.SpyObj<AracYuklemeService>;
  let confirm: jasmine.SpyObj<ConfirmService>;
  let toast: jasmine.SpyObj<ToastService>;

  function kur(ilk: AracYuklemeDurumu, yazma = true) {
    api = jasmine.createSpyObj<AracYuklemeService>('AracYuklemeService', ['durum', 'baslat', 'tamamla', 'iptal']);
    api.durum.and.returnValue(of(tamam(ilk)));
    confirm = jasmine.createSpyObj<ConfirmService>('ConfirmService', ['ask', 'askWithReason']);
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error']);
    TestBed.configureTestingModule({
      imports: [AracYuklemeOturumComponent],
      providers: [
        provideRouter([]),
        { provide: AracYuklemeService, useValue: api },
        { provide: ConfirmService, useValue: confirm },
        { provide: ToastService, useValue: toast },
        { provide: PermissionService, useValue: { canWrite: (kod: string) => yazma && kod === 'arac-yukleme' } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ planId: '7' }) } } },
      ],
    });
    const fixture = TestBed.createComponent(AracYuklemeOturumComponent);
    fixture.detectChanges();
    return fixture;
  }

  const dugmeler = (kok: HTMLElement) => [...kok.querySelectorAll('.ay-ust button')].map((b) => b.textContent?.trim());

  it('oturum yokken yalnız başlatma, sürerken iptal ve tamamlama düğmesi görünür', () => {
    const yok = kur(durum(null));
    expect(api.durum).toHaveBeenCalledOnceWith(7);
    expect(dugmeler(yok.nativeElement)).toEqual(['Yüklemeyi başlat']);
    // Araç kartları oturum başlamadan açılmaz.
    expect([...(yok.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.ao-arac')].every((b) => b.disabled)).toBeTrue();

    TestBed.resetTestingModule();
    const suren = kur(durum(oturum(6)));
    expect(dugmeler(suren.nativeElement)).toEqual(['İptal et', 'Yüklemeyi tamamla']);
    expect((suren.nativeElement as HTMLElement).textContent).toContain('6 / 14 yük');
  });

  it('işlem izni olmayan kullanıcıya düğme gösterilmez ve işlemler istek atmaz', async () => {
    const fixture = kur(durum(oturum(6)), false);
    const c = fixture.componentInstance;
    expect(dugmeler(fixture.nativeElement)).toEqual([]);
    await c.tamamla();
    await c.iptal();
    expect(confirm.ask).not.toHaveBeenCalled();
    expect(confirm.askWithReason).not.toHaveBeenCalled();
    expect(api.tamamla).not.toHaveBeenCalled();
    expect(api.iptal).not.toHaveBeenCalled();
  });

  it('başlatma onayla, planın son revizyon numarasıyla yapılır', async () => {
    const c = kur(durum(null)).componentInstance;
    confirm.ask.and.resolveTo(true);
    api.baslat.and.returnValue(of(tamam(durum(oturum(0)))));
    await c.baslat();
    expect(confirm.ask.calls.mostRecent().args[0].type).toBe('info');
    expect(api.baslat).toHaveBeenCalledOnceWith(7, 4);
    expect(c.durum()?.oturum?.id).toBe(5);
    expect(toast.success).toHaveBeenCalledOnceWith('Yükleme başlatıldı.');
  });

  it('uygunsuz yerleşimde başlatma uyarıyla sorulur; vazgeçilirse istek atılmaz', async () => {
    const c = kur(durum(null, { yerlesimSonucu: YerlesimKontrolSonucu.Uygunsuz })).componentInstance;
    confirm.ask.and.resolveTo(false);
    await c.baslat();
    const secenek = confirm.ask.calls.mostRecent().args[0];
    expect(secenek.type).toBe('warning');
    expect(secenek.message).toContain('Uygunsuz');
    expect(api.baslat).not.toHaveBeenCalled();
  });

  it('başlatılamayan planda (yerleşim yok ya da oturum sürüyor) başlatma sorulmaz', async () => {
    const c = kur(durum(null, { baslatilabilir: false, yerlesimVar: false })).componentInstance;
    await c.baslat();
    expect(confirm.ask).not.toHaveBeenCalled();
  });

  it('başlatma çakışmasında (409) sunucu iletisi gösterilir ve durum değişmez', async () => {
    const c = kur(durum(null)).componentInstance;
    confirm.ask.and.resolveTo(true);
    api.baslat.and.returnValue(of(hata<AracYuklemeDurumu>('Plan revize edildi; sayfayı yenileyin.')));
    await c.baslat();
    expect(toast.error).toHaveBeenCalledOnceWith('Plan revize edildi; sayfayı yenileyin.');
    expect(c.durum()?.oturum).toBeNull();
    expect(c.islemde()).toBeFalse();
  });

  it('eksik yükle tamamlama gerekçe ister; gerekçe verilmezse istek atılmaz', async () => {
    const c = kur(durum(oturum(6))).componentInstance;
    expect(c.eksikYuk()).toBe(8);
    confirm.askWithReason.and.resolveTo(null);
    await c.tamamla();
    expect(confirm.askWithReason.calls.mostRecent().args[0].message).toContain('8 yük yüklenmedi');
    expect(api.tamamla).not.toHaveBeenCalled();

    confirm.askWithReason.and.resolveTo('İki sandık hasarlı çıktı');
    api.tamamla.and.returnValue(of(tamam(durum(oturum(6, YuklemeOturumDurumu.Tamamlandi)))));
    await c.tamamla();
    expect(api.tamamla).toHaveBeenCalledOnceWith(5, 'İki sandık hasarlı çıktı');
    expect(c.oturumAcik()).toBeFalse();
  });

  it('bütün yükler yüklendiyse tamamlama gerekçesiz, yalnız onayla yapılır', async () => {
    const c = kur(durum(oturum(14))).componentInstance;
    confirm.ask.and.resolveTo(true);
    api.tamamla.and.returnValue(of(tamam(durum(oturum(14, YuklemeOturumDurumu.Tamamlandi)))));
    await c.tamamla();
    expect(confirm.askWithReason).not.toHaveBeenCalled();
    expect(api.tamamla).toHaveBeenCalledOnceWith(5, null);
    expect(toast.success).toHaveBeenCalledOnceWith('Yükleme tamamlandı.');
  });

  it('iptal gerekçeyle yapılır; sunucu reddederse ileti gösterilir', async () => {
    const c = kur(durum(oturum(6))).componentInstance;
    confirm.askWithReason.and.resolveTo('Sevk ertelendi');
    api.iptal.and.returnValue(of(hata<AracYuklemeDurumu>('Gerekçe en az 5 karakter olmalıdır.')));
    await c.iptal();
    expect(api.iptal).toHaveBeenCalledOnceWith(5, 'Sevk ertelendi');
    expect(toast.error).toHaveBeenCalledOnceWith('Gerekçe en az 5 karakter olmalıdır.');
    expect(c.oturumAcik()).toBeTrue();
  });

  it('kapanmış oturumda tamamlama ve iptal çalışmaz; araç salt okunur açılır', async () => {
    const fixture = kur(durum(oturum(6, YuklemeOturumDurumu.IptalEdildi)));
    const c = fixture.componentInstance;
    expect(dugmeler(fixture.nativeElement)).toEqual([]);
    await c.tamamla();
    await c.iptal();
    expect(confirm.ask).not.toHaveBeenCalled();
    expect(confirm.askWithReason).not.toHaveBeenCalled();
    const git = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    ((fixture.nativeElement as HTMLElement).querySelector('.ao-arac') as HTMLElement).click();
    expect(git).toHaveBeenCalledOnceWith(['/arac-yukleme/oturum', 5, 'arac', 1]);
  });

  it('plan yükleme başladıktan sonra değiştiyse hangi revizyonla sürdüğünü söyler', () => {
    const fixture = kur(durum(oturum(6, YuklemeOturumDurumu.Acik, true)));
    const uyari = (fixture.nativeElement as HTMLElement).querySelector('.yp-uyari')?.textContent ?? '';
    expect(uyari).toContain('güncel revizyon 4');
    expect(uyari).toContain('Revizyon 3 yerleşimiyle sürüyor');
  });

  it('reddedilen işlemden sonra durumu yeniden okur: başkasının başlattığı oturum görünür', async () => {
    const fixture = kur(durum(null));
    const c = fixture.componentInstance;
    confirm.ask.and.resolveTo(true);
    api.baslat.and.returnValue(of(hata<AracYuklemeDurumu>('Bu planda süren bir yükleme oturumu var.')));
    api.durum.and.returnValue(of(tamam(durum(oturum(2)))));
    await c.baslat();
    expect(toast.error).toHaveBeenCalledOnceWith('Bu planda süren bir yükleme oturumu var.');
    expect(api.durum).toHaveBeenCalledTimes(2);
    expect([c.durum()?.oturum?.yuklenenYuk, c.islemde()]).toEqual([2, false]);
    fixture.detectChanges();
    expect(dugmeler(fixture.nativeElement)).toEqual(['İptal et', 'Yüklemeyi tamamla']);
  });

  it('işlem başlayınca uçuştaki yenileme iptal edilir: eski yanıt kapanışı geri almaz', fakeAsync(() => {
    const fixture = kur(durum(oturum(14)));
    const c = fixture.componentInstance;
    const gecikenYenileme = new Subject<ApiResult<AracYuklemeDurumu>>();
    api.durum.and.returnValue(gecikenYenileme);
    tick(DURUM_YENILEME_MS);
    confirm.ask.and.resolveTo(true);
    api.tamamla.and.returnValue(of(tamam(durum(oturum(14, YuklemeOturumDurumu.Tamamlandi)))));
    void c.tamamla();
    tick();
    expect(c.oturumAcik()).toBeFalse();
    gecikenYenileme.next(tamam(durum(oturum(14))));
    tick();
    expect(c.oturumAcik()).toBeFalse();
    fixture.destroy();
  }));

  it('oturum yokken de durumu yeniler (başkası başlatınca görünsün)', fakeAsync(() => {
    const fixture = kur(durum(null));
    api.durum.and.returnValue(of(tamam(durum(oturum(0)))));
    tick(DURUM_YENILEME_MS);
    expect(api.durum).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.oturumAcik()).toBeTrue();
    fixture.destroy();
  }));

  it('ilk yükleme başarısızsa yeniden denenebilir', () => {
    const fixture = kur(durum(null));
    const c = fixture.componentInstance;
    c.durum.set(null);
    fixture.detectChanges();
    api.durum.and.returnValue(of(tamam(durum(oturum(3)))));
    ((fixture.nativeElement as HTMLElement).querySelector('.yp-bos button') as HTMLButtonElement).click();
    expect(c.durum()?.oturum?.yuklenenYuk).toBe(3);
  });

  it('süren oturumda ilerlemeyi aralıkla yeniler; kapanmış oturumda istek atmaz', fakeAsync(() => {
    const suren = kur(durum(oturum(6)));
    api.durum.and.returnValue(of(tamam(durum(oturum(9)))));
    tick(DURUM_YENILEME_MS);
    expect(api.durum).toHaveBeenCalledTimes(2);
    expect(suren.componentInstance.durum()?.oturum?.yuklenenYuk).toBe(9);
    suren.destroy();

    TestBed.resetTestingModule();
    const kapali = kur(durum(oturum(14, YuklemeOturumDurumu.Tamamlandi)));
    tick(DURUM_YENILEME_MS * 2);
    expect(api.durum).toHaveBeenCalledTimes(1);
    kapali.destroy();
  }));
});
