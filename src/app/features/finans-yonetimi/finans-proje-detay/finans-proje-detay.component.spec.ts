import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { FinansIsKategorisi, FinansOdemeDurumu, FinansSandikMalzemesi } from '../../../core/constants/enums';
import { AMBALAJ_YETKI, FINANS_YETKI } from '../../../core/constants/yetki-kodlari';
import { FinansService } from '../../../core/services/finans.service';
import { PermissionService } from '../../../core/services/permission.service';
import { FinansFatura, FinansIsKaydi, FinansSayfaliSonuc } from '../../../shared/models/finans.model';
import { FinansProjeDetayComponent } from './finans-proje-detay.component';

describe('Finans proje detayı', () => {
  let api: jasmine.SpyObj<FinansService>;
  const izinler = new Set<string>();
  const kalem = (ek: Partial<FinansIsKaydi>) =>
    ({
      id: 1, projeId: 7, projeNo: 'PA-1', musteri: 'GE', sandikNo: '1', sandikAdi: 'Sandık', isTuru: 1, adet: 1,
      siparisAdedi: 0, siparisBekleyenAdet: 1, faturalananAdet: 0, poNumaralari: [], faturaNumaralari: [],
      kaynakAktif: true, paraBirimi: 'EUR', ...ek,
    }) as FinansIsKaydi;
  const sayfa = <T>(items: T[], totalCount = items.length): FinansSayfaliSonuc<T> => ({
    items, toplamlar: [], pageNumber: 1, pageSize: 250, totalCount, totalPages: 1, hasPreviousPage: false, hasNextPage: false,
  });
  const kalemler = [
    kalem({ id: 3, sandikNo: '10', kategori: FinansIsKategorisi.Ilave, ahsapM3: 0.5, kontraM3: 0, netTutar: 100 }),
    kalem({ id: 1, sandikNo: '2', kategori: FinansIsKategorisi.AnaAmbalaj, ahsapM3: 1, kontraM3: 0.25, netTutar: 300,
      faturaNumaralari: ['INV-1'] }),
    kalem({ id: 2, sandikNo: '1', kategori: FinansIsKategorisi.AnaAmbalaj, ahsapM3: 2, kontraM3: 0, netTutar: 200,
      paraBirimi: 'USD' }),
  ];
  const fatura = {
    id: 8, kayitNo: 'F8', faturaNumarasi: 'INV-1', faturaTarihi: '2026-08-01', poNumarasi: 'PO-1', projeNo: 'PA-1',
    isTurleri: [], sandikAdedi: 1, toplamM3: null, durum: 1, vadeTarihi: '2026-08-31', odendiMi: false,
    odemeDurumu: FinansOdemeDurumu.VadesiGecti,
  } as FinansFatura;

  beforeEach(() => {
    izinler.clear();
    api = jasmine.createSpyObj<FinansService>('FinansService', ['genelArama', 'faturalar']);
    api.genelArama.and.returnValue(of({ isSuccess: true, value: sayfa(kalemler) }));
    api.faturalar.and.returnValue(of({ isSuccess: true, value: sayfa([fatura]) }));
    TestBed.configureTestingModule({
      imports: [FinansProjeDetayComponent],
      providers: [
        { provide: FinansService, useValue: api },
        { provide: PermissionService, useValue: { hasAccess: (k: string) => izinler.has(k), canWrite: () => false } },
      ],
    });
  });

  function setup() {
    const fixture = TestBed.createComponent(FinansProjeDetayComponent);
    fixture.componentRef.setInput('projeNo', 'PA-1');
    fixture.detectChanges();
    return { fixture, c: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
  }

  it('kalemleri kategori sırasıyla gruplar, sandık numarasına göre sıralar; m³ ve tutarları ayrı toplar', () => {
    [FINANS_YETKI.KayitGoruntule, FINANS_YETKI.SiparisOperasyonGoruntule].forEach((k) => izinler.add(k));
    const { c, el } = setup();
    expect(api.genelArama).toHaveBeenCalledOnceWith({ pageNumber: 1, pageSize: 250, projeNo: 'PA-1' });
    expect(api.faturalar).toHaveBeenCalledOnceWith({ pageNumber: 1, pageSize: 250, projeNo: 'PA-1' });
    const gruplar = c.gruplar();
    expect(gruplar.map((g) => g.kategori)).toEqual([FinansIsKategorisi.AnaAmbalaj, FinansIsKategorisi.Ilave]);
    expect(gruplar[0].kalemler.map((x) => x.sandikNo)).toEqual(['1', '2']);
    expect(gruplar[0].ahsapM3).toBe(3);
    expect(gruplar[0].kontraM3).toBe(0.25);
    expect(c.toplamlar()).toEqual([
      { paraBirimi: 'EUR', net: 400 },
      { paraBirimi: 'USD', net: 200 },
    ]);
    expect(c.faturaDurumlari().get('INV-1')?.odemeDurumu).toBe(FinansOdemeDurumu.VadesiGecti);
    expect(c.eksikGosterim()).toBeFalse();
    const acilan = spyOn(c.kayitAc, 'emit');
    (el.querySelector('.v2-dialog-action-cell button') as HTMLButtonElement).click();
    expect(acilan).toHaveBeenCalledOnceWith({ tur: 'IsKaydi', id: 2 });
  });

  it('fatura okuma izni yoksa fatura istemez; m³ ve tutar sütunları yalnız kendi izinleriyle görünür', () => {
    izinler.add(FINANS_YETKI.KayitGoruntule);
    const sutunlar = (el: HTMLElement) => el.querySelector('table thead tr')!.querySelectorAll('th').length;
    const kisitli = setup();
    expect(api.faturalar).not.toHaveBeenCalled();
    expect(kisitli.c.faturalar()).toEqual([]);
    expect(sutunlar(kisitli.el)).toBe(4);

    [AMBALAJ_YETKI.M3Goruntule, FINANS_YETKI.ParasalVeriGoruntule, FINANS_YETKI.TutarGoruntule].forEach((k) => izinler.add(k));
    const tam = setup();
    expect(sutunlar(tam.el)).toBe(7);
  });

  it('malzeme etiketi yalnız m³ satırında verilir; sabit satırın tutarı birim fiyattır', () => {
    const { c } = setup();
    expect(c.malzemeEtiketi({ ad: 'İşçilik', yontem: 1, miktar: 2, birimFiyat: 10, malzeme: FinansSandikMalzemesi.Ahsap })).toBe('');
    expect(c.malzemeEtiketi({ ad: 'Ahşap', yontem: 2, miktar: 2, birimFiyat: 10, malzeme: FinansSandikMalzemesi.Ahsap })).toBe(
      c.t('MATERIAL_WOOD'),
    );
    expect(c.malzemeEtiketi({ ad: 'Kontra', yontem: 2, miktar: 2, birimFiyat: 10, malzeme: FinansSandikMalzemesi.Kontra })).toBe(
      c.t('PLYWOOD_FOLDING'),
    );
    expect(c.malzemeEtiketi({ ad: 'm³', yontem: 2, miktar: 2, birimFiyat: 10 })).toBe(c.t('PRICE_LINE_MATERIAL_CRATE'));
    expect(c.satirTutari({ ad: 'Sabit', yontem: 3, miktar: 5, birimFiyat: 12.5 })).toBe(12.5);
    expect(c.satirTutari({ ad: 'm³', yontem: 2, miktar: 0.333, birimFiyat: 10 })).toBe(3.33);
  });

  it('250 kaydı aşan projede eksik gösterim uyarısı verir; yükleme hatasını boş projeyle karıştırmaz', () => {
    api.genelArama.and.returnValue(of({ isSuccess: true, value: sayfa(kalemler, 300) }));
    expect(setup().c.eksikGosterim()).toBeTrue();

    api.genelArama.and.returnValue(of({ isSuccess: false, error: 'Erişim reddedildi' }));
    const { c } = setup();
    expect(c.hata()).toBe('Erişim reddedildi');
    expect(c.kalemler()).toEqual([]);
    expect(c.loading()).toBeFalse();
  });
});
