import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { AMBALAJ_YETKI } from '../../core/constants/yetki-kodlari';
import { UretimYasamDongusuComponent } from './uretim-yasam-dongusu.component';
import { AmbalajYasamDongusuService } from '../../core/services/ambalaj-yasam-dongusu.service';
import { PermissionService } from '../../core/services/permission.service';
import { ToastService } from '../../core/services/toast.service';
import { TranslationService } from '../../core/services/translation.service';
import { AmbalajUretimPlanDto, ApiResult } from '../../shared/models';
import { AmbalajFormSurumu, AmbalajGerceklesenRapor } from '../../shared/models/ambalaj-yasam-dongusu.model';

describe('Üretim V2 gerçek işlem UI sözleşmesi', () => {
  let fixture: ComponentFixture<UretimYasamDongusuComponent>;
  let component: UretimYasamDongusuComponent;
  let api: jasmine.SpyObj<AmbalajYasamDongusuService>;
  let toast: jasmine.SpyObj<ToastService>;
  /** Testin kapattığı okuma izinleri; yazma izinleri açıktır. */
  const reddedilen = new Set<string>();
  const plan: AmbalajUretimPlanDto = {
    projeId: 1,
    projeNo: 'SENTETIK-1',
    musteri: 'Test',
    projeTipiId: 1,
    projeTipiMetni: 'Normal',
    projeSandiklariDurumId: 1,
    ilaveSandiklarDurumId: 1,
    icSandiklarDurumId: 1,
    seciliSandikAdedi: 0,
    seciliHacimM3: null,
    kalemler: [
      {
        id: 1,
        tur: 1,
        turMetni: 'Ana',
        uretimeAlindi: false,
        sandikNo: '1',
        sandikTipi: 'Kontrplak Sandık',
        adet: 4,
        boy: 100,
        en: 200,
        yukseklik: 300,
        hacimM3: null,
        ambalajaDahilMi: true,
        ambalajKarariOneriliyor: false,
        m3HesaplanabilirMi: false,
        uretimDurumu: 1,
      },
    ],
  };
  beforeEach(() => {
    reddedilen.clear();
    api = jasmine.createSpyObj('AmbalajYasamDongusuService', [
      'formlar',
      'formOlustur',
      'formIndir',
      'durum',
      'rapor',
      'duzelt',
    ]);
    api.formlar.and.returnValue(of({ isSuccess: true, value: [] }));
    api.formOlustur.and.returnValue(of({ isSuccess: false, error: 'Geçici hata' }));
    api.durum.and.returnValue(of({ isSuccess: true, statusCode: 202 }));
    toast = jasmine.createSpyObj('ToastService', ['success', 'error', 'warning', 'info']);
    TestBed.configureTestingModule({
      imports: [UretimYasamDongusuComponent],
      providers: [
        { provide: AmbalajYasamDongusuService, useValue: api },
        {
          provide: PermissionService,
          useValue: { hasAccess: (kod: string) => !reddedilen.has(kod), canWrite: () => true },
        },
        { provide: ToastService, useValue: toast },
        {
          provide: TranslationService,
          useValue: {
            translate: (key: string) => (key === 'URETIM_V2.NOT_APPLICABLE' ? 'Hesaplanmaz' : key),
          },
        },
      ],
    });
    fixture = TestBed.createComponent(UretimYasamDongusuComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('plan', structuredClone(plan));
    fixture.detectChanges();
  });

  it('form retry aynı anahtarı korur; değişen seçim yeni anahtar kullanır', () => {
    component.olustur();
    component.olustur();
    const first = api.formOlustur.calls.argsFor(0)[0];
    expect(api.formOlustur.calls.argsFor(1)[0].idempotencyAnahtari).toBe(first.idempotencyAnahtari);
    expect(first.kayitIdleri).toEqual([1]);
    component.secim.set([1, 2]);
    component.olustur();
    expect(api.formOlustur.calls.argsFor(2)[0].idempotencyAnahtari).not.toBe(
      first.idempotencyAnahtari,
    );
  });

  it('ilk kaynak formu önceden üretime alma gerektirmez', () => {
    component.secim.set([-41]);
    component.olustur();
    const request = api.formOlustur.calls.mostRecent().args[0];
    expect(request.kaynakSandikIdleri).toEqual([41]);
    expect(request.kayitIdleri).toEqual([]);
    expect(request.yenidenOlustur).toBeFalse();
  });

  it('202 form sonucu uygulandı sinyali veya başarılı toast üretmez', () => {
    api.formOlustur.and.returnValue(of({ isSuccess: true, statusCode: 202 }));
    const changed = spyOn(component.degisti, 'emit');
    component.olustur();
    expect(changed).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalledWith('URETIM_V2.PENDING');
  });

  it('durum 202 ve gerekçesiz yeniden açma uygulanmış gibi görünmez', () => {
    const changed = spyOn(component.degisti, 'emit');
    component.durum(1, 2);
    expect(api.durum).not.toHaveBeenCalled();
    component.gerekce = 'Kontrollü düzeltme';
    component.durum(1, 2);
    expect(changed).not.toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalled();
  });

  it('nonwood hacmi sıfır yerine hesaplanmaz gösterir', () => {
    expect(fixture.nativeElement.textContent).toContain('Hesaplanmaz');
    expect(fixture.nativeElement.textContent).not.toContain('0.000');
  });

  it('entegre modda ikinci sandık tablosu, sürüm geçmişi ve gerekçe alanı oluşturmaz; form kontrolü kalır (A2)', () => {
    fixture.componentRef.setInput('entegre', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('table')).toBeNull();
    expect(fixture.nativeElement.querySelector('.lifecycle-controls')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.form-history')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.lifecycle-controls input:not([type="date"])').length).toBe(0);
  });

  it('form gerekçe istemez ve isteğe bağlı finans tarihini gönderir (A2, A6)', () => {
    component.finansTarihi = '2026-10-01';
    component.olustur();
    const request = api.formOlustur.calls.mostRecent().args[0];
    expect(request.aciklama).toBeUndefined();
    expect(request.finansTarihi).toBe('2026-10-01');
    expect(request.yenidenOlustur).toBeFalse();
    component.finansTarihi = '';
    component.secim.set([1, 5]);
    component.olustur();
    expect(api.formOlustur.calls.mostRecent().args[0].finansTarihi).toBeNull();
  });

  it('daha önce forma alınmış sandık seçilince formu güncel veriyle yeniden oluşturur (D10)', () => {
    api.formlar.and.returnValue(of({ isSuccess: true, value: [
      { id: 9, formKimligi: 'f', surum: 2, olusturmaTarihi: '2026-09-20T10:00:00', olusturanKullaniciId: 1,
        form: { projeNo: 'SENTETIK-1', netM3: null, sarfM3: null, toplamM3: null,
          kalemler: [{ kayitId: 1, sandikNo: '1', adet: 4, m3HesaplanabilirMi: false, netM3: null }] } },
    ] }));
    fixture.componentRef.setInput('plan', { ...structuredClone(plan), projeId: 2 });
    fixture.detectChanges();
    expect(component.yenidenOlusturulacak()).toBeTrue();
    expect(fixture.nativeElement.querySelector('.latest-form')).toBeNull();
    component.olustur();
    expect(api.formOlustur.calls.mostRecent().args[0].yenidenOlustur).toBeTrue();
    component.secim.set([]);
    expect(component.yenidenOlusturulacak()).toBeFalse();
  });

  it('üretilen çam grafiği yalnız ahşap/kafes net m³ değerlerini aylara toplar (A5)', () => {
    api.rapor.and.returnValue(of({ isSuccess: true, value: {
      m3Tanimi: '', m3Gorunur: true, sarfGorunur: true, baslangic: '', bitis: '', tarihiBelirsizEskiKayitSayisi: 0,
      toplam: { anahtar: '', adet: 0, netM3: 0, sarfM3: 0, sarfDahilM3: 0 }, projeler: [], gunler: [], aylar: [], cinsler: [],
      kayitlar: [
        { id: 1, gerceklesmeKimligi: 'a', surum: 1, kayitId: 1, tarih: '2026-08-05', projeId: 1, projeNo: 'P', sandikNo: '1', sandikCinsi: 1, tur: 1, adet: 1, m3HesaplanabilirMi: true, netM3: 1.5, sarfM3: 0.2, sarfDahilM3: 1.7 },
        { id: 2, gerceklesmeKimligi: 'b', surum: 1, kayitId: 2, tarih: '2026-08-20', projeId: 1, projeNo: 'P', sandikNo: '2', sandikCinsi: 2, tur: 1, adet: 1, m3HesaplanabilirMi: true, netM3: 0.5, sarfM3: 0.1, sarfDahilM3: 0.6 },
        { id: 3, gerceklesmeKimligi: 'c', surum: 1, kayitId: 3, tarih: '2026-09-01', projeId: 1, projeNo: 'P', sandikNo: '3', sandikCinsi: 3, tur: 1, adet: 1, m3HesaplanabilirMi: true, netM3: 9, sarfM3: 0, sarfDahilM3: 9 },
      ],
    } as AmbalajGerceklesenRapor }));
    component.raporGetir();
    const grafik = component.camGrafigi();
    expect(grafik?.xaxis.categories).toEqual(['2026-08']);
    expect(grafik?.series[0].data).toEqual([2]);
    expect(grafik?.series[1].data).toEqual([0.3]);
  });

  it('aynı planın parti numarası yenilenince kullanıcı seçimini sıfırlamaz', () => {
    component.sec(1, false);
    fixture.componentRef.setInput('plan', { ...structuredClone(plan), firinPartiNo: 'FP-2' });
    fixture.detectChanges();
    expect(component.secim()).toEqual([]);
    expect(api.formlar).toHaveBeenCalledTimes(1);
  });

  it('yalnız açık grubun satırlarını ve miktarını forma gönderir', () => {
    fixture.componentRef.setInput('grup', 1);
    fixture.componentRef.setInput('plan', {
      ...structuredClone(plan),
      kalemler: [plan.kalemler[0], { ...plan.kalemler[0], id: 2, tur: 2, adet: 12 }],
    });
    fixture.detectChanges();
    component.olustur();
    expect(component.satirlar().length).toBe(1);
    expect(component.seciliAdet()).toBe(4);
    expect(api.formOlustur.calls.mostRecent().args[0].kayitIdleri).toEqual([1]);
  });

  it('kaynak satırı kalıcı kimlik alınca aynı seçimi korur', () => {
    const sourcePlan = {
      ...structuredClone(plan),
      kalemler: [{ ...plan.kalemler[0], id: 0, kaynakSandikId: 41 }],
    };
    fixture.componentRef.setInput('plan', sourcePlan);
    fixture.detectChanges();
    expect(component.secim()).toEqual([-41]);
    fixture.componentRef.setInput('plan', {
      ...sourcePlan,
      kalemler: [{ ...sourcePlan.kalemler[0], id: 71 }],
    });
    fixture.detectChanges();
    expect(component.secim()).toEqual([71]);
    component.sec(71, false);
    fixture.componentRef.setInput('plan', {
      ...sourcePlan,
      kalemler: [{ ...sourcePlan.kalemler[0], id: 71, ad: 'Yeni ad' }],
    });
    fixture.detectChanges();
    expect(component.secim()).toEqual([]);
  });

  it('tümünü seç hariç satırı seçmez ve panel gerekçesini üst akışa bildirir', () => {
    fixture.componentRef.setInput('plan', {
      ...structuredClone(plan),
      kalemler: [plan.kalemler[0], { ...plan.kalemler[0], id: 2, ambalajaDahilMi: false }],
    });
    fixture.detectChanges();
    component.hepsiniSec(false);
    component.hepsiniSec(true);
    expect(component.secim()).toEqual([1]);
    const reason = spyOn(component.gerekceDegisti, 'emit');
    component.gerekceyiDegistir('Fiili düzeltme');
    expect(component.gerekce).toBe('Fiili düzeltme');
    expect(reason).toHaveBeenCalledWith('Fiili düzeltme');
  });

  describe('oluştur ve seçilen biçimde indir (A2/D10)', () => {
    const olusan = {
      id: 15, formKimligi: 'f', surum: 1, olusturmaTarihi: '2026-09-30T00:02:00', olusturanKullaniciId: 1,
      form: { projeNo: 'SENTETIK-1', netM3: null, sarfM3: null, toplamM3: null, kalemler: [] },
    } as unknown as AmbalajFormSurumu;
    let indirilenler: string[];
    beforeEach(() => {
      indirilenler = [];
      api.formOlustur.and.returnValue(of({ isSuccess: true, value: olusan }));
      api.formIndir.and.returnValue(of(new Blob(['form'])));
      spyOn(URL, 'createObjectURL').and.returnValue('blob:form');
      spyOn(URL, 'revokeObjectURL');
      spyOn(HTMLAnchorElement.prototype, 'click').and.callFake(function (this: HTMLAnchorElement) {
        indirilenler.push(this.download);
      });
    });
    function yenidenOlustur() {
      fixture = TestBed.createComponent(UretimYasamDongusuComponent);
      component = fixture.componentInstance;
      fixture.componentRef.setInput('plan', structuredClone(plan));
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    }

    it('iki biçim izni varsa biçim sorar; seçilen biçimde oluşturup hemen indirir ve güncel form satırı göstermez', () => {
      const degisti = spyOn(component.degisti, 'emit');
      const el = fixture.nativeElement as HTMLElement;
      (el.querySelector('app-islemler-menusu .islemler-tetik') as HTMLButtonElement).click();
      fixture.detectChanges();
      const secenekler = Array.from(el.querySelectorAll<HTMLButtonElement>('.islemler-panel.acik button'));
      expect(secenekler.map((b) => b.textContent!.trim())).toEqual([
        'URETIM_V2.CREATE_AS_PDF',
        'URETIM_V2.CREATE_AS_EXCEL',
      ]);
      secenekler[1].click();
      expect(api.formOlustur).toHaveBeenCalledTimes(1);
      expect(api.formIndir).toHaveBeenCalledOnceWith(15, 'xlsx');
      expect(indirilenler.length).toBe(1);
      expect(indirilenler[0]).toMatch(/^uretim-formu-SENTETIK-1-\d{12}\.xlsx$/);
      expect(toast.success).toHaveBeenCalledOnceWith('URETIM_V2.FORM_DOWNLOADED');
      expect(degisti).toHaveBeenCalledTimes(1);
      expect(component.islemde()).toBeFalse();
      fixture.detectChanges();
      expect(el.querySelector('.latest-form')).toBeNull();
    });

    it('tek biçim izni varsa doğrudan o biçimde indirir; indirme izni yoksa yalnız oluşturur', () => {
      reddedilen.add(AMBALAJ_YETKI.ExcelIndir);
      let el = yenidenOlustur();
      expect(el.querySelector('app-islemler-menusu')).toBeNull();
      (el.querySelector('.form-actions .primary-action') as HTMLButtonElement).click();
      expect(api.formIndir).toHaveBeenCalledOnceWith(15, 'pdf');

      reddedilen.add(AMBALAJ_YETKI.FormIndir);
      api.formIndir.calls.reset();
      toast.success.calls.reset();
      el = yenidenOlustur();
      (el.querySelector('.form-actions .primary-action') as HTMLButtonElement).click();
      expect(api.formOlustur).toHaveBeenCalledTimes(2);
      expect(api.formIndir).not.toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledOnceWith('URETIM_V2.FORM_SAVED');
    });

    it('form öncesi adım false dönerse form oluşturulmaz; true dönerse oluşturma devam eder', () => {
      const oncesi = jasmine.createSpy('formOncesi').and.returnValue(of(false));
      fixture.componentRef.setInput('formOncesi', oncesi);
      component.olustur('pdf');
      expect(oncesi).toHaveBeenCalledTimes(1);
      expect(api.formOlustur).not.toHaveBeenCalled();
      expect(component.islemde()).toBeFalse();
      oncesi.and.returnValue(of(true));
      component.olustur('pdf');
      expect(api.formOlustur).toHaveBeenCalledTimes(1);
      expect(api.formIndir).toHaveBeenCalledOnceWith(15, 'pdf');
    });

    it('onaya düşen form indirilmez; indirme hatasında form oluşmuş sayılır ve kullanıcıya bildirilir', () => {
      api.formOlustur.and.returnValue(of({ isSuccess: true, statusCode: 202 }));
      component.olustur('pdf');
      expect(api.formIndir).not.toHaveBeenCalled();
      expect(toast.info).toHaveBeenCalledWith('URETIM_V2.PENDING');

      api.formOlustur.and.returnValue(of({ isSuccess: true, value: olusan }));
      api.formIndir.and.returnValue(throwError(() => new Error('ağ hatası')));
      const degisti = spyOn(component.degisti, 'emit');
      component.olustur('pdf');
      expect(degisti).toHaveBeenCalledTimes(1);
      expect(toast.error).toHaveBeenCalledWith('URETIM_V2.FORM_DOWNLOAD_FAILED');
      expect(indirilenler).toEqual([]);
      expect(component.islemde()).toBeFalse();
    });
  });

  it('hızlı tarih değişiminde eski rapor yanıtı yeni raporu ezmez', () => {
    const old = new Subject<ApiResult<AmbalajGerceklesenRapor>>();
    const fresh = new Subject<ApiResult<AmbalajGerceklesenRapor>>();
    api.rapor.and.returnValues(old, fresh);
    component.raporGetir();
    component.baslangic = '2026-09-01';
    component.raporGetir();
    const report = { m3Tanimi: 'Yeni' } as AmbalajGerceklesenRapor;
    fresh.next({ isSuccess: true, value: report });
    old.next({ isSuccess: true, value: { ...report, m3Tanimi: 'Eski' } });
    expect(component.rapor()?.m3Tanimi).toBe('Yeni');
  });
});
