import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AmbalajUretimListesiComponent } from './ambalaj-uretim-listesi.component';
import { UretimYasamDongusuComponent } from './uretim-yasam-dongusu.component';
import { AmbalajService } from '../../core/services/ambalaj.service';
import { AmbalajYasamDongusuService } from '../../core/services/ambalaj-yasam-dongusu.service';
import { ProjeService } from '../../core/services/proje.service';
import { PermissionService } from '../../core/services/permission.service';
import { ToastService } from '../../core/services/toast.service';
import { TranslationService } from '../../core/services/translation.service';
import { AmbalajUretimPlanDto } from '../../shared/models';

describe('Üretim planı tek temalı seçim akışı', () => {
  let plans: jasmine.SpyObj<AmbalajService>;
  let lifecycle: jasmine.SpyObj<AmbalajYasamDongusuService>;
  const allowed = new Set<string>();
  const plan: AmbalajUretimPlanDto = {
    projeId: 1,
    projeNo: 'SENTETIK',
    musteri: 'Test',
    projeTipiId: 1,
    projeTipiMetni: 'Normal',
    projeSandiklariDurumId: 2,
    ilaveSandiklarDurumId: 1,
    icSandiklarDurumId: 1,
    seciliSandikAdedi: 1,
    seciliHacimM3: 1.25,
    genelUretimDurumu: 2,
    kalemler: [
      {
        id: 11,
        kaynakSandikId: 41,
        tur: 1,
        turMetni: 'Normal',
        uretimeAlindi: true,
        sandikNo: '1',
        ad: 'Ana sandık',
        sandikTipi: 'Ahşap Kapalı',
        adet: 1,
        boy: 2000,
        en: 1200,
        yukseklik: 1800,
        hacimM3: 1.25,
        ambalajaDahilMi: true,
        ambalajKarariOneriliyor: false,
        m3HesaplanabilirMi: true,
        uretimDurumu: 2,
      },
      {
        id: 12,
        kaynakSandikId: 42,
        tur: 1,
        turMetni: 'Normal',
        uretimeAlindi: false,
        sandikNo: '2',
        ad: 'Hariç sandık',
        sandikTipi: 'Ahşap Kapalı',
        adet: 2,
        boy: 2000,
        en: 1200,
        yukseklik: 1800,
        hacimM3: 2.5,
        ambalajaDahilMi: false,
        ambalajKarariOneriliyor: false,
        m3HesaplanabilirMi: true,
        uretimDurumu: 1,
      },
    ],
  };
  beforeEach(() => {
    allowed.clear();
    [
      'ambalaj-plan-olustur',
      'ambalaj-form-olustur',
      'ambalaj-form-goruntule',
      'ambalaj-durum-duzenle',
      'ambalaj-uretimi-tamamla',
      'ambalaj-durumu-geri-al',
      'ambalaj-m3-goruntule',
      'ambalaj-olcu-goruntule',
    ].forEach((x) => allowed.add(x));
    plans = jasmine.createSpyObj('AmbalajService', ['planKaydet']);
    plans.planKaydet.and.returnValue(of({ isSuccess: true, statusCode: 202 }));
    lifecycle = jasmine.createSpyObj('AmbalajYasamDongusuService', [
      'formlar',
      'formOlustur',
      'durum',
    ]);
    lifecycle.formlar.and.returnValue(of({ isSuccess: true, value: [] }));
    lifecycle.formOlustur.and.returnValue(of({ isSuccess: true, statusCode: 202 }));
    lifecycle.durum.and.returnValue(of({ isSuccess: true, statusCode: 202 }));
    spyOn(AmbalajUretimListesiComponent.prototype, 'ngOnInit').and.stub();
    TestBed.configureTestingModule({
      imports: [AmbalajUretimListesiComponent],
      providers: [
        provideRouter([]),
        { provide: AmbalajService, useValue: plans },
        { provide: AmbalajYasamDongusuService, useValue: lifecycle },
        { provide: ProjeService, useValue: {} },
        {
          provide: PermissionService,
          useValue: {
            loaded: () => true,
            hasAccess: (key: string) => allowed.has(key),
            canWrite: (key: string) => allowed.has(key),
          },
        },
        {
          provide: ToastService,
          useValue: jasmine.createSpyObj('ToastService', ['success', 'error', 'info', 'warning']),
        },
      ],
    });
    TestBed.inject(TranslationService).switchLanguage('tr');
  });
  function render() {
    const fixture = TestBed.createComponent(AmbalajUretimListesiComponent);
    fixture.componentInstance.planOpen.set(true);
    fixture.componentInstance.plan.set(structuredClone(plan));
    fixture.detectChanges();
    const child = fixture.debugElement
      .queryAll(By.directive(UretimYasamDongusuComponent))
      .map((e) => e.componentInstance as UretimYasamDongusuComponent)
      .find((c) => c.entegre())!;
    return {
      fixture,
      component: fixture.componentInstance,
      child,
      drawer: fixture.nativeElement.querySelector('.plan-drawer') as HTMLElement,
    };
  }

  it('ham kopya yerine yalnız eski temalı sandık tablosunu ve compact geçmişi gösterir', () => {
    const { drawer } = render();
    expect(drawer.querySelectorAll('table').length).toBe(1);
    expect(drawer.querySelectorAll('.crate-table tbody tr').length).toBe(2);
    expect(drawer.querySelector('.lifecycle-panel .lifecycle-table')).toBeNull();
    expect(drawer.querySelector('.form-history')).not.toBeNull();
    expect(drawer.querySelector('.drawer-status select')).toBeNull();
  });

  it('tek checkbox seçimini hem plan kaydına hem forma aktarır; 202 durum değiştirmez', () => {
    const { fixture, component, child, drawer } = render();
    const checkbox = drawer.querySelector('.crate-table tbody input') as HTMLInputElement;
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(child.secim()).toEqual([]);
    expect(child.seciliAdet()).toBe(0);
    component.planKaydet(child.secim());
    expect(plans.planKaydet.calls.mostRecent().args[2]).toEqual([]);
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    child.olustur();
    expect(lifecycle.formOlustur.calls.mostRecent().args[0].kayitIdleri).toEqual([11]);
    expect(component.plan()!.kalemler[0].uretimDurumu).toBe(2);
    expect(
      (drawer.querySelectorAll('.crate-table tbody input')[1] as HTMLInputElement).disabled,
    ).toBeTrue();
  });

  it('satır tamamlaması lifecycle endpointine gider ve ayrı izin yoksa buton yoktur', () => {
    const { drawer } = render();
    (drawer.querySelector('.complete-action') as HTMLButtonElement).click();
    expect(lifecycle.durum).toHaveBeenCalledWith(11, 3, '');
    expect(plans.planKaydet).not.toHaveBeenCalled();
  });

  it('manuel kutuyu form seçimi diye açıklar; plan kaydı kaynak IDs gönderir ve yerel form seçimini korur', () => {
    const { fixture, component, child, drawer } = render();
    const savedPlan: AmbalajUretimPlanDto = {
      ...structuredClone(plan),
      kalemler: [
        { ...plan.kalemler[0], tur: 2 },
        {
          ...plan.kalemler[0],
          id: 21,
          kaynakSandikId: undefined,
          tur: 2,
          sandikNo: 'M-1',
          ad: 'Manuel',
        },
      ],
    };
    component.planGrup.set(2);
    component.plan.set(savedPlan);
    fixture.detectChanges();
    const checkbox = drawer.querySelector('.manual-selection') as HTMLInputElement;
    expect(drawer.querySelector('.manual-selection-field')!.textContent).toContain('Form seçimi');
    const help = 'Manuel sandık seçimi oluşturulacak forma uygulanır.';
    expect(drawer.querySelector('.plan-selection-help')!.textContent).toContain(help);
    expect(
      (drawer.querySelector('.plan-toolbar .primary-action') as HTMLButtonElement).title,
    ).toContain(help);
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    spyOn(component, 'loadProjects').and.stub();
    plans.planKaydet.and.returnValue(of({ isSuccess: true, value: structuredClone(savedPlan) }));
    component.planKaydet(child.secim());
    fixture.detectChanges();
    expect(plans.planKaydet.calls.mostRecent().args[2]).toEqual([41]);
    expect(component.plan()!.kalemler.find((k) => k.id === 21)!.uretimeAlindi).toBeTrue();
    expect(child.secim()).toEqual([11]);
    expect(checkbox.checked).toBeFalse();
    child.olustur();
    expect(lifecycle.formOlustur.calls.mostRecent().args[0].kayitIdleri).toEqual([11]);
  });

  it('ölçü/m³ ve tamamlama izni olmayan kullanıcıda alanlar ve işlem gizlenir', () => {
    allowed.delete('ambalaj-m3-goruntule');
    allowed.delete('ambalaj-olcu-goruntule');
    allowed.delete('ambalaj-uretimi-tamamla');
    const { drawer } = render();
    expect(drawer.querySelector('.complete-action')).toBeNull();
    expect(drawer.textContent).not.toContain('2000 × 1200 × 1800');
    expect(drawer.textContent).not.toContain('1.250');
  });
});
