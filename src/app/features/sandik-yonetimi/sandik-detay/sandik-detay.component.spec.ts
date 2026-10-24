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
import { SandikDetayDto, SandikDurumOlayKaynagi, SandikDurumOlayTuru, SandikIcerikDto } from '../../../shared/models';

describe('Sandık detayı kalıcı ürün bilgisi gösterimi', () => {
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
    sandikApi = jasmine.createSpyObj('SandikService', ['getSandikIcerik', 'getSandiklar', 'icerikBilgisiGuncelle', 'durumGecmisi']);
    sandikApi.getSandikIcerik.and.returnValue(of({ isSuccess: true, value: sandik() }));
    sandikApi.durumGecmisi.and.returnValue(of({ isSuccess: true, value: [] }));
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

  it('satırda ve panelde ürün bilgisini yalnız gösterir; düzenleme 3K karşılama panelindedir', () => {
    const { fixture, c, el } = render();
    expect(el.querySelector('.urun-bilgisi-meta')!.textContent).toContain('SN: A-1001');

    c.selectUrun(c.sandik()!.icerikler[0]);
    fixture.detectChanges();

    expect(el.querySelector('.panel-urun-bilgisi')!.textContent).toContain('SN: A-1001');
    expect(el.querySelector('#urunBilgisi')).toBeNull();
    expect(el.querySelector('.urun-bilgisi-kaydet')).toBeNull();
    expect(sandikApi.icerikBilgisiGuncelle).not.toHaveBeenCalled();
  });

  it('kapalı sandıkta kapanma tarihini, açılış/kapanış geçmişini ve "Sandığı Geri Aç"ı gösterir', () => {
    const kapali = { ...sandik(3), durumMetni: 'Kapandı', kapanmaTarihi: '2026-10-24T14:32:00' };
    sandikApi.getSandikIcerik.and.returnValue(of({ isSuccess: true, value: kapali }));
    sandikApi.durumGecmisi.and.returnValue(of({ isSuccess: true, value: [
      { id: 2, projeId: 10, projeNo: 'PA', musteri: 'M', sandikId: 30, sandikNo: '1', tur: SandikDurumOlayTuru.Acildi, turMetni: 'Geri açıldı',
        kaynak: SandikDurumOlayKaynagi.Elle, kaynakMetni: 'Elle', yeniDurumMetni: 'Hazırlanıyor', sebepMetni: 'Tadilat', not: 'Kapak değişti',
        kullaniciAdi: 'Ali', tarih: '2026-10-23T09:05:00' },
      { id: 1, projeId: 10, projeNo: 'PA', musteri: 'M', sandikId: 30, sandikNo: '1', tur: SandikDurumOlayTuru.Kapandi, turMetni: 'Kapandı',
        kaynak: SandikDurumOlayKaynagi.Toplu, kaynakMetni: 'Toplu işlem', yeniDurumMetni: 'Kapandı', tarih: '2026-10-22T08:00:00' },
    ] }));
    const { el } = render();

    expect(el.querySelector('.sd-kapanma')!.textContent).toContain('24.10.2026 14:32');
    const olaylar = el.querySelectorAll('.durum-olayi');
    expect(olaylar.length).toBe(2);
    expect(olaylar[0].textContent).toContain('Tadilat');
    expect(olaylar[0].textContent).toContain('Kapak değişti');
    expect(olaylar[0].textContent).toContain('23.10.2026 09:05 · Ali');
    expect(olaylar[1].textContent).toContain('Sistem');
    expect(el.querySelector('.sd-diger-geri-ac')).not.toBeNull();
    expect(el.querySelector('.sd-diger-kapat')).toBeNull();
  });

  it('ürün bilgisi olmayan satırda panelde boş bilgi kutusu göstermez', () => {
    const bos = sandik();
    bos.icerikler[0].urunBilgisi = null;
    sandikApi.getSandikIcerik.and.returnValue(of({ isSuccess: true, value: bos }));
    const { fixture, c, el } = render();

    c.selectUrun(c.sandik()!.icerikler[0]);
    fixture.detectChanges();

    expect(el.querySelector('.urun-bilgisi-meta')).toBeNull();
    expect(el.querySelector('.panel-urun-bilgisi')).toBeNull();
  });
});
