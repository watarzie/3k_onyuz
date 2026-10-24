import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { SandikDetayComponent } from './sandik-detay.component';
import { SandikService } from '../../../core/services/sandik.service';
import { ProjeService } from '../../../core/services/proje.service';
import { LookupService } from '../../../core/services/lookup.service';
import { ToastService } from '../../../core/services/toast.service';
import { AuthService } from '../../../core/auth/auth.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { TranslationService } from '../../../core/services/translation.service';
import { SandikDetayDto, SandikDuzeltmeDurumuDto, SandikIcerikDto } from '../../../shared/models';

describe('Sandık detayı sevk sonrası düzeltme', () => {
  let sandikApi: jasmine.SpyObj<SandikService>;
  const icerik = (values: Partial<SandikIcerikDto> = {}): SandikIcerikDto => ({
    id: 40, cekiSatiriId: 23, barkodNo: 'BC-001', aciklama: 'Pompa', istenenAdet: 2, sandikMiktari: 2, konulanAdet: 2,
    eksikAdet: 0, durumId: 3, durumMetni: 'Tamamlandı', isManuelEklenen: false, manuelSilinebilirMi: false, miktar: 2,
    stokKarsilanan: 0, projeKarsilanan: 0, tedarikciKarsilanan: 0, ...values,
  } as SandikIcerikDto);
  const sandik = (duzeltmeAcik: boolean, icerikler: SandikIcerikDto[] = [icerik()]): SandikDetayDto => ({
    id: 30, sandikNo: '1', tipId: 2, durumId: 4, durumMetni: 'Sevkedildi', sevkiyatDuzeltmeAcikMi: duzeltmeAcik,
    depoLokasyonId: 3, depoLokasyonMetni: '3K', icerikler,
  });
  const durum = (values: Partial<SandikDuzeltmeDurumuDto> = {}): SandikDuzeltmeDurumuDto => ({
    sandikId: 30, acikMi: true, gerekce: 'Konsol unutuldu', acanKullanici: 'Ayşe', acilisTarihi: '2026-10-23T09:00:00',
    degisiklikler: ['Eklendi: Konsol (B-YENI) — 2 adet'], gecmis: [], ...values,
  });

  beforeEach(() => {
    sandikApi = jasmine.createSpyObj('SandikService',
      ['getSandikIcerik', 'getSandiklar', 'sevkSonrasiDuzeltmeDurumu', 'durumGecmisi']);
    sandikApi.getSandikIcerik.and.returnValue(of({ isSuccess: true, value: sandik(true) }));
    sandikApi.durumGecmisi.and.returnValue(of({ isSuccess: true, value: [] }));
    sandikApi.getSandiklar.and.returnValue(of({ isSuccess: true, value: [] }));
    sandikApi.sevkSonrasiDuzeltmeDurumu.and.returnValue(of({ isSuccess: true, value: durum() }));
    TestBed.configureTestingModule({
      imports: [SandikDetayComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ projeId: '10', sandikId: '30' }), data: { menuKod: 'sandik-yonetimi' } } },
        },
        { provide: SandikService, useValue: sandikApi },
        { provide: ProjeService, useValue: {} },
        { provide: LookupService, useValue: {} },
        { provide: AuthService, useValue: { currentUser: () => ({ id: 7 }) } },
        { provide: ConfirmService, useValue: jasmine.createSpyObj('ConfirmService', ['ask']) },
        { provide: PermissionService, useValue: { loaded: () => true, hasAccess: () => true, canWrite: () => true } },
        { provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['success', 'error', 'info', 'warning']) },
      ],
    });
    TestBed.inject(TranslationService).switchLanguage('tr');
  });

  function render() {
    const fixture = TestBed.createComponent(SandikDetayComponent);
    fixture.detectChanges();
    return { fixture, c: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
  }

  it('açık düzeltmenin gerekçesini ve açılıştan bu yana değişiklikleri gösterir; sandık taşımaya açılır', () => {
    const { c, el } = render();

    const panel = el.querySelector('.duzeltme-panel')!;
    expect(panel.textContent).toContain('Konsol unutuldu');
    expect(panel.textContent).toContain('Eklendi: Konsol (B-YENI) — 2 adet');
    expect(c.isSandikTasimayaKilitli()).toBeFalse();
  });

  it('düzeltme kapalı sevkli sandık taşımaya ve ürün eklemeye kilitlidir', () => {
    sandikApi.getSandikIcerik.and.returnValue(of({ isSuccess: true, value: sandik(false) }));
    sandikApi.sevkSonrasiDuzeltmeDurumu.and.returnValue(of({ isSuccess: true, value: durum({ acikMi: false }) }));
    const { c, el } = render();

    expect(c.isSandikTasimayaKilitli()).toBeTrue();
    expect(c.isSandikKilitli()).toBeTrue();
    expect(el.querySelector('.duzeltme-panel')).toBeNull();
  });

  it('sahada takip edilen ürünü saha projesine bağlar ve taşımasını kapatır', () => {
    sandikApi.getSandikIcerik.and.returnValue(of({
      isSuccess: true,
      value: sandik(true, [icerik({ aktifSahaProjeleri: [{ projeId: 77, projeNo: 'PA723-SAHA' }] })]),
    }));
    const { el } = render();

    const pill = el.querySelector<HTMLAnchorElement>('.saha-takip-pill')!;
    expect(pill.textContent).toContain('PA723-SAHA');
    expect(pill.getAttribute('href')).toBe('/saha-yonetimi/77');
    const tasi = Array.from(el.querySelectorAll<HTMLButtonElement>('.row-actions button'))
      .find(b => b.textContent?.includes('Taşı'))!;
    expect(tasi.disabled).toBeTrue();
  });
});
