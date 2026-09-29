import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { FinansService } from '../../core/services/finans.service';
import { ToastService } from '../../core/services/toast.service';
import { FinansParaBirimi } from '../../shared/models/finans-v2.model';
import { FinansParametrelerComponent } from './finans-parametreler.component';

describe('Finans para birimi tanımları ve vade parametreleri', () => {
  let api: jasmine.SpyObj<FinansService>;
  let toast: jasmine.SpyObj<ToastService>;
  const tanimlar: FinansParaBirimi[] = [
    { id: 1, kod: 'TRY', ad: 'Türk lirası', sembol: '₺', aktif: true, sira: 1 },
    { id: 2, kod: 'EUR', ad: 'Euro', sembol: '€', aktif: true, sira: 2 },
  ];

  beforeEach(() => {
    api = jasmine.createSpyObj<FinansService>('FinansService', [
      'paraBirimleri',
      'parametreler',
      'paraBirimiKaydet',
      'parametreleriKaydet',
    ]);
    api.paraBirimleri.and.returnValue(of({ isSuccess: true, value: tanimlar }));
    api.parametreler.and.returnValue(of({ isSuccess: true, value: { varsayilanVadeGunu: 60, vadeUyariGunu: 10 } }));
    api.paraBirimiKaydet.and.returnValue(of({ isSuccess: true }));
    api.parametreleriKaydet.and.returnValue(of({ isSuccess: true }));
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'info']);
    TestBed.configureTestingModule({
      imports: [FinansParametrelerComponent],
      providers: [
        { provide: FinansService, useValue: api },
        { provide: ToastService, useValue: toast },
      ],
    });
  });

  function setup(yazabilir = true) {
    const fixture = TestBed.createComponent(FinansParametrelerComponent);
    fixture.componentRef.setInput('yazabilir', yazabilir);
    fixture.detectChanges();
    return { fixture, c: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
  }

  it('tanımları ve vade parametrelerini yükler; yazma izni yoksa düzenleme düğmesi göstermez ve kayıt göndermez', () => {
    const { c, el } = setup(false);
    expect(api.paraBirimleri).toHaveBeenCalledOnceWith(false);
    expect(c.paraBirimleri().map((x) => x.kod)).toEqual(['TRY', 'EUR']);
    expect(c.parametreForm).toEqual({ varsayilanVadeGunu: 60, vadeUyariGunu: 10 });
    expect(el.querySelectorAll('button').length).toBe(0);
    c.aktiflikDegistir(tanimlar[0]);
    c.parametreleriKaydet();
    expect(api.paraBirimiKaydet).not.toHaveBeenCalled();
    expect(api.parametreleriKaydet).not.toHaveBeenCalled();
  });

  it('yeni para birimini üç harfli büyük koda çevirerek ekler; listeyi yeniler ve seçim listelerine haber verir', () => {
    const { c } = setup();
    const degisti = spyOn(c.degisti, 'emit');
    c.yeniParaBirimi();
    expect(c.form()).toEqual({ id: null, kod: '', ad: '', sembol: '', aktif: true, sira: 3 });
    const form = c.form()!;
    form.kod = 'us';
    form.ad = 'ABD doları';
    c.paraBirimiKaydet();
    expect(api.paraBirimiKaydet).not.toHaveBeenCalled();
    expect(c.hata()).toBe(c.t('CURRENCY_VALIDATION'));
    form.kod = ' usd ';
    form.sembol = ' $ ';
    c.paraBirimiKaydet();
    expect(api.paraBirimiKaydet).toHaveBeenCalledOnceWith(
      { kod: 'USD', ad: 'ABD doları', sembol: '$', aktif: true, sira: 3 },
      undefined,
    );
    expect(degisti).toHaveBeenCalledTimes(1);
    expect(c.form()).toBeNull();
    expect(toast.success).toHaveBeenCalledOnceWith(c.t('CURRENCY_SAVED'));
    expect(api.paraBirimleri).toHaveBeenCalledTimes(2);
  });

  it('düzenlemede kodu kilitler; aktiflik değişimi kimliği gövdeye koymadan günceller', async () => {
    const { c, el, fixture } = setup();
    c.duzenle(tanimlar[1]);
    fixture.detectChanges();
    await fixture.whenStable();
    expect((el.querySelector('input[maxlength="3"]') as HTMLInputElement).disabled).toBeTrue();
    c.aktiflikDegistir(tanimlar[1]);
    expect(api.paraBirimiKaydet).toHaveBeenCalledOnceWith(
      { kod: 'EUR', ad: 'Euro', sembol: '€', aktif: false, sira: 2 },
      2,
    );
  });

  it('onaya alınan para birimi değişikliği formu açık tutar ve listeyi uygulanmış saymaz', () => {
    api.paraBirimiKaydet.and.returnValue(of({ isSuccess: true, statusCode: 202 }));
    const { c } = setup();
    const degisti = spyOn(c.degisti, 'emit');
    c.duzenle(tanimlar[0]);
    c.form()!.ad = 'Türk Lirası';
    c.paraBirimiKaydet();
    expect(toast.info).toHaveBeenCalledOnceWith(c.t('APPROVAL_QUEUED'));
    expect(c.form()).not.toBeNull();
    expect(degisti).not.toHaveBeenCalled();
  });

  it('vade ayarlarında aralık dışı veya kesirli günü göndermez; geçerli değeri kaydeder', () => {
    const { c } = setup();
    for (const hatali of [
      { varsayilanVadeGunu: 400, vadeUyariGunu: 7 },
      { varsayilanVadeGunu: 45, vadeUyariGunu: 91 },
      { varsayilanVadeGunu: 45, vadeUyariGunu: 1.5 },
      { varsayilanVadeGunu: -1, vadeUyariGunu: 7 },
    ]) {
      c.parametreForm = hatali;
      c.parametreleriKaydet();
      expect(c.hata()).toBe(c.t('DUE_SETTINGS_VALIDATION'));
    }
    expect(api.parametreleriKaydet).not.toHaveBeenCalled();
    c.parametreForm = { varsayilanVadeGunu: 45, vadeUyariGunu: 5 };
    c.parametreleriKaydet();
    expect(api.parametreleriKaydet).toHaveBeenCalledOnceWith({ varsayilanVadeGunu: 45, vadeUyariGunu: 5 });
    expect(toast.success).toHaveBeenCalledOnceWith(c.t('DUE_SETTINGS_SAVED'));
  });
});
