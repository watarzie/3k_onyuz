import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { UretimYasamDongusuComponent } from './uretim-yasam-dongusu.component';
import { AmbalajYasamDongusuService } from '../../core/services/ambalaj-yasam-dongusu.service';
import { PermissionService } from '../../core/services/permission.service';
import { ToastService } from '../../core/services/toast.service';
import { TranslationService } from '../../core/services/translation.service';
import { AmbalajUretimPlanDto, ApiResult } from '../../shared/models';
import { AmbalajGerceklesenRapor } from '../../shared/models/ambalaj-yasam-dongusu.model';

describe('Üretim V2 gerçek işlem UI sözleşmesi', () => {
  let fixture: ComponentFixture<UretimYasamDongusuComponent>;
  let component: UretimYasamDongusuComponent;
  let api: jasmine.SpyObj<AmbalajYasamDongusuService>;
  let toast: jasmine.SpyObj<ToastService>;
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
    api = jasmine.createSpyObj('AmbalajYasamDongusuService', [
      'formlar',
      'formOlustur',
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
        { provide: PermissionService, useValue: { hasAccess: () => true, canWrite: () => true } },
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

  it('entegre modda ikinci sandık tablosu oluşturmaz, form ve geçmiş paneli kalır', () => {
    fixture.componentRef.setInput('entegre', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('table')).toBeNull();
    expect(fixture.nativeElement.querySelector('.lifecycle-controls')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.form-history')).not.toBeNull();
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
