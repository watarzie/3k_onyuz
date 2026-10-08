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
import { SandikDetayDto, SandikIcerikDto } from '../../../shared/models';

describe('Sandık detayı kalıcı ürün bilgisi', () => {
  let sandikApi: jasmine.SpyObj<SandikService>;
  let yazabilir = true;
  const icerik = {
    id: 40, cekiSatiriId: 23, barkodNo: 'BC-001', aciklama: 'Pompa', istenenAdet: 2, sandikMiktari: 2, konulanAdet: 1,
    eksikAdet: 1, durumId: 1, durumMetni: 'Bekliyor', isManuelEklenen: false, manuelSilinebilirMi: false, miktar: 2,
    stokKarsilanan: 0, projeKarsilanan: 0, tedarikciKarsilanan: 0, urunBilgisi: 'SN: A-1001',
  } as SandikIcerikDto;
  const sandik = (durumId = 2): SandikDetayDto => ({
    id: 30, sandikNo: '1', durumId, durumMetni: durumId === 4 ? 'Sevkedildi' : 'Hazırlanıyor', depoLokasyonId: 1,
    depoLokasyonMetni: '3K', icerikler: [structuredClone(icerik)],
  });

  beforeEach(() => {
    yazabilir = true;
    sandikApi = jasmine.createSpyObj('SandikService', ['getSandikIcerik', 'getSandiklar', 'icerikBilgisiGuncelle']);
    sandikApi.getSandikIcerik.and.returnValue(of({ isSuccess: true, value: sandik() }));
    sandikApi.getSandiklar.and.returnValue(of({ isSuccess: true, value: [] }));
    sandikApi.icerikBilgisiGuncelle.and.returnValue(of({ isSuccess: true, value: null }));
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
        { provide: PermissionService, useValue: { loaded: () => true, hasAccess: () => true, canWrite: () => yazabilir } },
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

  it('satırda ürün bilgisini gösterir, panelden düzenlenip kaydedilir', () => {
    const { fixture, c, el } = render();
    expect(el.querySelector('.urun-bilgisi-meta')!.textContent).toContain('SN: A-1001');

    c.selectUrun(c.sandik()!.icerikler[0]);
    fixture.detectChanges();
    const alan = el.querySelector('#urunBilgisi') as HTMLTextAreaElement;
    expect(alan.disabled).toBeFalse();
    c.urunBilgisiTaslak.set('  SN: A-1001, SKT: 03.2027  ');
    fixture.detectChanges();
    (el.querySelector('.urun-bilgisi-kaydet') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(sandikApi.icerikBilgisiGuncelle).toHaveBeenCalledWith({
      projeId: 10, sandikId: 30, sandikIcerikId: 40, urunBilgisi: 'SN: A-1001, SKT: 03.2027',
    });
    expect(c.sandik()!.icerikler[0].urunBilgisi).toBe('SN: A-1001, SKT: 03.2027');
  });

  it('boşaltılan bilgi null olarak gönderilir; değişiklik yoksa kaydet devre dışıdır', () => {
    const { fixture, c, el } = render();
    c.selectUrun(c.sandik()!.icerikler[0]);
    fixture.detectChanges();
    expect((el.querySelector('.urun-bilgisi-kaydet') as HTMLButtonElement).disabled).toBeTrue();

    c.urunBilgisiTaslak.set('   ');
    c.urunBilgisiKaydet();
    expect(sandikApi.icerikBilgisiGuncelle.calls.mostRecent().args[0].urunBilgisi).toBeNull();
  });

  it('sevk edilmiş (kilitli) sandıkta alan ve kaydet devre dışıdır, istek gönderilmez', async () => {
    sandikApi.getSandikIcerik.and.returnValue(of({ isSuccess: true, value: sandik(4) }));
    const { fixture, c, el } = render();
    c.selectUrun(c.sandik()!.icerikler[0]);
    fixture.detectChanges();
    await fixture.whenStable();

    expect((el.querySelector('#urunBilgisi') as HTMLTextAreaElement).disabled).toBeTrue();
    expect((el.querySelector('.urun-bilgisi-kaydet') as HTMLButtonElement).disabled).toBeTrue();
    c.urunBilgisiTaslak.set('SN-2');
    c.urunBilgisiKaydet();
    expect(sandikApi.icerikBilgisiGuncelle).not.toHaveBeenCalled();
  });

  it('sandık yazma izni olmayan kullanıcı bilgiyi yalnız görür', async () => {
    yazabilir = false;
    const { fixture, c, el } = render();
    c.selectUrun(c.sandik()!.icerikler[0]);
    fixture.detectChanges();
    await fixture.whenStable();

    expect((el.querySelector('#urunBilgisi') as HTMLTextAreaElement).disabled).toBeTrue();
    expect(el.querySelector('.urun-bilgisi-kaydet')).toBeNull();
  });
});
