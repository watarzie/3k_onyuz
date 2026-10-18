import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { SandikService } from '../../../core/services/sandik.service';
import { ToastService } from '../../../core/services/toast.service';
import { TranslationService } from '../../../core/services/translation.service';
import { ApiResult } from '../../models/common.model';
import {
  UrunBilgisiDuzenleComponent, UrunBilgisiSatiri, urunBilgisiIstegi, urunBilgisiKaydedilebilir, urunBilgisiKilitNedeni,
} from './urun-bilgisi-duzenle.component';

describe('Grid ve 3K ortak ürün bilgisi penceresi (U-249)', () => {
  let sandikApi: jasmine.SpyObj<SandikService>;
  let toast: jasmine.SpyObj<ToastService>;
  const ts = { translate: (anahtar: string) => anahtar };
  const satir = (degerler: Partial<UrunBilgisiSatiri> = {}): UrunBilgisiSatiri => ({
    sandikId: 30, sandikIcerikId: 401, urunBilgisi: 'SN: A-1001', sandikSevkEdildiMi: false,
    aciklama: 'Radyatör FG-L', barkodNo: 'FCT01212023', sandikNo: '4',
    ...degerler,
  });

  beforeEach(() => {
    sandikApi = jasmine.createSpyObj('SandikService', ['icerikBilgisiGuncelle']);
    sandikApi.icerikBilgisiGuncelle.and.returnValue(of({ isSuccess: true, value: null }));
    toast = jasmine.createSpyObj('ToastService', ['success', 'error', 'info', 'warning']);
    TestBed.configureTestingModule({
      imports: [UrunBilgisiDuzenleComponent],
      providers: [
        { provide: SandikService, useValue: sandikApi },
        { provide: ToastService, useValue: toast },
      ],
    });
    TestBed.inject(TranslationService).switchLanguage('tr');
  });

  function render(s: UrunBilgisiSatiri, yazabilir = true) {
    const fixture = TestBed.createComponent(UrunBilgisiDuzenleComponent);
    fixture.componentRef.setInput('satir', s);
    fixture.componentRef.setInput('projeId', 10);
    fixture.componentRef.setInput('yazabilir', yazabilir);
    fixture.detectChanges();
    const c = fixture.componentInstance;
    const kaydedilen: (string | null)[] = [];
    let cakisma = 0;
    c.kaydedildi.subscribe(v => kaydedilen.push(v));
    c.cakisti.subscribe(() => cakisma++);
    return { fixture, c, el: fixture.nativeElement as HTMLElement, kaydedilen, cakisma: () => cakisma };
  }

  it('kural sunucuyla aynıdır: tahsis, sevk kilidi ve yazma izni; işlem kilitleri hesaba girmez', () => {
    expect(urunBilgisiKaydedilebilir(satir(), true)).toBeTrue();
    expect(urunBilgisiKaydedilebilir(satir(), false)).toBeFalse();
    expect(urunBilgisiKaydedilebilir(satir({ sandikSevkEdildiMi: true }), true)).toBeFalse();
    expect(urunBilgisiKaydedilebilir(satir({ sandikIcerikId: undefined }), true)).toBeFalse();
    expect(urunBilgisiKaydedilebilir(satir({ sandikId: null }), true)).toBeFalse();
    expect(urunBilgisiKaydedilebilir(null, true)).toBeFalse();

    expect(urunBilgisiKilitNedeni(satir({ sandikSevkEdildiMi: true }), true, ts)).toBe('MESSAGES.URUN_BILGISI_KILITLI');
    expect(urunBilgisiKilitNedeni(satir({ sandikIcerikId: undefined }), true, ts)).toContain('sandık tahsisi');
    expect(urunBilgisiKilitNedeni(satir(), true, ts)).toBe('');
  });

  it('istek ekranda görülen eski değeri taşır; boşaltılan bilgi null gider', () => {
    expect(urunBilgisiIstegi(10, satir(), '  SN: A-1001, SKT: 03.2027 ')).toEqual({
      projeId: 10, sandikId: 30, sandikIcerikId: 401, urunBilgisi: 'SN: A-1001, SKT: 03.2027', oncekiUrunBilgisi: 'SN: A-1001',
    });
    expect(urunBilgisiIstegi(10, satir({ urunBilgisi: null }), '   ')).toEqual({
      projeId: 10, sandikId: 30, sandikIcerikId: 401, urunBilgisi: null, oncekiUrunBilgisi: null,
    });
  });

  it('kayıtlı değeri gösterir, değişiklik yokken kaydetmez; kaydedince sonucu bildirir', () => {
    const { fixture, c, el, kaydedilen } = render(satir());
    const kutu = el.querySelector<HTMLTextAreaElement>('#urunBilgisiDeger')!;
    const dugme = el.querySelector<HTMLButtonElement>('.urun-bilgisi-kaydet')!;
    expect(c.deger()).toBe('SN: A-1001');
    expect(dugme.disabled).toBeTrue();

    c.deger.set('SN: A-1001, SKT: 03.2027');
    fixture.detectChanges();
    expect(kutu.disabled).toBeFalse();
    expect(dugme.disabled).toBeFalse();
    dugme.click();

    expect(sandikApi.icerikBilgisiGuncelle).toHaveBeenCalledOnceWith({
      projeId: 10, sandikId: 30, sandikIcerikId: 401, urunBilgisi: 'SN: A-1001, SKT: 03.2027', oncekiUrunBilgisi: 'SN: A-1001',
    });
    expect(kaydedilen).toEqual(['SN: A-1001, SKT: 03.2027']);
    expect(toast.success).toHaveBeenCalled();
  });

  it('başkası arada değiştirdiyse (409) kaydı bildirmez, çakışmayı bildirir', () => {
    const yanit: ApiResult<unknown> = { isSuccess: false, error: 'Ürün bilgisi siz düzenlerken değiştirildi.', statusCode: 409 };
    sandikApi.icerikBilgisiGuncelle.and.returnValue(of(yanit));
    const { c, kaydedilen, cakisma } = render(satir());

    c.deger.set('SKT: 03.2027');
    c.kaydet();

    expect(kaydedilen).toEqual([]);
    expect(cakisma()).toBe(1);
    expect(toast.error).toHaveBeenCalledWith('Ürün bilgisi siz düzenlerken değiştirildi.');
  });

  it('diğer retlerde çakışma bildirmez', () => {
    sandikApi.icerikBilgisiGuncelle.and.returnValue(of({ isSuccess: false, error: 'Sevk edilmiş sandık kilitlidir.', statusCode: 400 }));
    const { c, kaydedilen, cakisma } = render(satir());

    c.deger.set('SKT: 03.2027');
    c.kaydet();

    expect(kaydedilen).toEqual([]);
    expect(cakisma()).toBe(0);
    expect(toast.error).toHaveBeenCalledWith('Sevk edilmiş sandık kilitlidir.');
  });

  it('sevk edilmiş sandıkta kutu kapalıdır, kilit nedeni yazar ve istek gitmez', async () => {
    const { fixture, c, el } = render(satir({ sandikSevkEdildiMi: true }));
    // ngModel kapalı durumunu bir sonraki mikro görevde uygular.
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.querySelector<HTMLTextAreaElement>('#urunBilgisiDeger')!.disabled).toBeTrue();
    expect(el.querySelector<HTMLButtonElement>('.urun-bilgisi-kaydet')!.disabled).toBeTrue();
    expect(el.querySelector('.urun-bilgisi-modal__kilit')!.textContent).toContain('Sevk edilmiş sandıkta');
    c.deger.set('SN-2');
    fixture.detectChanges();
    c.kaydet();

    expect(sandikApi.icerikBilgisiGuncelle).not.toHaveBeenCalled();
  });

  it('satır tazelenince kutu güncel değere döner', () => {
    const { fixture, c } = render(satir());
    c.deger.set('yarım kalan giriş');

    fixture.componentRef.setInput('satir', satir({ urunBilgisi: 'SN: B-2002' }));
    fixture.detectChanges();

    expect(c.deger()).toBe('SN: B-2002');
  });
});
