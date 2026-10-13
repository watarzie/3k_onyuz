import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { FinansOdemeDurumu, FinansSandikMalzemesi } from '../../../core/constants/enums';
import { FINANS_YETKI } from '../../../core/constants/yetki-kodlari';
import { FinansService } from '../../../core/services/finans.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ToastService } from '../../../core/services/toast.service';
import { ApiResult } from '../../../shared/models/common.model';
import {
  FinansFatura,
  FinansIsKaydi,
  FinansSiparis,
  FinansSiparisDetay,
  FinansSiparisKalemi,
} from '../../../shared/models/finans.model';
import {
  FinansKaliciSilOnizleme,
  FinansParaBirimi,
  FinansVarlikTuru,
} from '../../../shared/models/finans-v2.model';
import { FinansKayitDetayComponent } from './finans-kayit-detay.component';

describe('Finans kayıt detayı revizyon ve kalıcı silme', () => {
  let api: jasmine.SpyObj<FinansService>;
  let toast: jasmine.SpyObj<ToastService>;
  let permissions: jasmine.SpyObj<PermissionService>;

  const line: FinansSiparisKalemi = {
    id: 21,
    isKaydiId: 11,
    sandikNo: 'A1',
    sandikAdi: 'Montaj',
    isTuru: 8,
    adet: 3,
    m3: 1.5,
    faturalananAdet: 0,
    faturalananM3: 0,
    kalanAdet: 3,
    kalanM3: 1.5,
    urunKodu: 'QA',
    urunAdi: 'Test',
    fiyatlandirmaBirimi: 3,
    fiyatlandirmaMiktari: 1,
    birimFiyat: 6000,
    paraBirimi: 'EUR',
    kdvOrani: 20,
    netTutar: 6000,
    kdvTutari: 1200,
    toplamTutar: 7200,
    fiyatManuelDegistirildi: false,
  };
  const po: FinansSiparis = {
    id: 7,
    kayitNo: 'S7',
    poNumarasi: 'PO-7',
    projeNo: 'PROJE-A',
    musteri: 'Test',
    isTurleri: ['Montaj'],
    siparisTarihi: '2026-09-19T12:00:00',
    sandikAdedi: 3,
    toplamM3: 1.5,
    faturalananM3: 0,
    kalanM3: 1.5,
    durum: 1,
    tutarlar: [],
    kalemler: [line],
  };
  const detail: FinansSiparisDetay = {
    ozet: po,
    kalemler: [line],
    belgeler: [],
    createdDate: '2026-09-19',
  };
  const invoice: FinansFatura = {
    id: 8,
    kayitNo: 'F8',
    faturaNumarasi: 'INV-8',
    faturaTarihi: '2026-09-19T12:00:00',
    poNumarasi: 'PO-7',
    projeNo: 'PROJE-A',
    isTurleri: ['Montaj'],
    sandikAdedi: 3,
    toplamM3: 1.5,
    durum: 1,
    kalemler: [
      {
        id: 801,
        siparisKalemiId: 21,
        isKaydiId: 11,
        netTutar: 3000,
        kdvTutari: 600,
        toplamTutar: 3600,
        paraBirimi: 'EUR',
        tutarBazli: true,
      },
    ],
  };
  const preview: FinansKaliciSilOnizleme = {
    varlikTuru: 'Gider',
    id: 31,
    referans: 'QA gider',
    surum: 'SERVER-HASH-V2',
    silinebilir: true,
    bagimliliklar: [],
    engeller: [],
  };
  const paraBirimleri: FinansParaBirimi[] = [
    { id: 1, kod: 'TRY', ad: 'Türk lirası', sembol: '₺', aktif: true, sira: 1 },
    { id: 2, kod: 'EUR', ad: 'Euro', sembol: '€', aktif: true, sira: 2 },
    { id: 3, kod: 'USD', ad: 'ABD doları', sembol: '$', aktif: false, sira: 3 },
  ];
  const work: FinansIsKaydi = {
    id: 31,
    projeId: null,
    projeNo: 'QA',
    musteri: 'Test',
    sandikNo: '',
    sandikAdi: 'Özel iş',
    isTuru: 8,
    adet: 1,
    birimM3: 0,
    toplamM3: 0,
    siparisAdedi: 0,
    siparisM3: 0,
    siparisBekleyenAdet: 1,
    siparisBekleyenM3: 0,
    faturalananAdet: 0,
    faturalananM3: 0,
    poNumaralari: [],
    faturaNumaralari: [],
    kaynakAktif: true,
    fiyatlandirmaBirimi: 4,
    birimFiyat: 0,
    paraBirimi: 'EUR',
    kdvOrani: 20,
    netTutar: 1200,
    manuelNetTutar: 1200,
    bilesenler: [
      { ad: 'Ahşap', yontem: 2, miktar: 0.5, birimFiyat: 400, malzeme: FinansSandikMalzemesi.Ahsap },
      { ad: 'İşçilik', yontem: 1, miktar: 2, birimFiyat: 500, malzeme: FinansSandikMalzemesi.Kontra },
      { ad: 'Sabit', yontem: 3, miktar: 1, birimFiyat: 200 },
    ],
  };

  beforeEach(() => {
    api = jasmine.createSpyObj<FinansService>('FinansService', [
      'siparisDetay',
      'faturaDetay',
      'siparisGuncelle',
      'faturaGuncelle',
      'kaliciSilOnizleme',
      'kaliciSil',
      'isDetay',
      'fiyatlandir',
      'hacimGir',
      'faturaOdeme',
      'paraBirimleri',
      'downloadErrorMessage',
    ]);
    api.siparisDetay.and.returnValue(of({ isSuccess: true, value: detail }));
    api.faturaDetay.and.returnValue(of({ isSuccess: true, value: invoice }));
    api.siparisGuncelle.and.returnValue(of({ isSuccess: true }));
    api.faturaGuncelle.and.returnValue(of({ isSuccess: true }));
    api.kaliciSilOnizleme.and.returnValue(of({ isSuccess: true, value: preview }));
    api.kaliciSil.and.returnValue(of({ isSuccess: true }));
    api.isDetay.and.returnValue(of({ isSuccess: true, value: work }));
    api.fiyatlandir.and.returnValue(of({ isSuccess: true }));
    api.hacimGir.and.returnValue(of({ isSuccess: true }));
    api.faturaOdeme.and.returnValue(of({ isSuccess: true }));
    api.paraBirimleri.and.returnValue(of({ isSuccess: true, value: paraBirimleri }));
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'info']);
    permissions = jasmine.createSpyObj<PermissionService>('PermissionService', [
      'hasAccess',
      'canWrite',
    ]);
    permissions.hasAccess.and.returnValue(true);
    permissions.canWrite.and.returnValue(true);
    TestBed.configureTestingModule({
      imports: [FinansKayitDetayComponent],
      providers: [
        { provide: FinansService, useValue: api },
        { provide: ToastService, useValue: toast },
        { provide: PermissionService, useValue: permissions },
      ],
    });
  });

  function setup(tur: FinansVarlikTuru = 'Gider') {
    const fixture = TestBed.createComponent(FinansKayitDetayComponent);
    fixture.componentRef.setInput('hedef', {
      tur,
      id: tur === 'Siparis' ? 7 : tur === 'Fatura' ? 8 : 31,
    });
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance };
  }

  function readyToDelete(component: FinansKayitDetayComponent) {
    component.silOnizleme();
    component.ikinciAdim.set(true);
    component.ikinciOnay = true;
    component.silmeNedeni = '  Yinelenmiş test kaydı  ';
  }

  it('fiyat formunda bileşenleri ve manuel net bedeli aynen yeniden açar; m³ dışı satırın malzemesini göndermez', () => {
    const { component } = setup('IsKaydi');
    component.tab('fiyat');
    expect(component.fiyat.manuelNetTutar).toBe(1200);
    expect(component.fiyat.bilesenler).toEqual(work.bilesenler!);
    component.fiyat.aciklama = 'Snapshot korunarak yeniden kayıt';
    component.fiyatKaydet();
    expect(api.fiyatlandir).toHaveBeenCalledOnceWith(
      31,
      jasmine.objectContaining({
        manuelNetTutar: 1200,
        bilesenler: [
          { ad: 'Ahşap', yontem: 2, miktar: 0.5, birimFiyat: 400, malzeme: FinansSandikMalzemesi.Ahsap },
          { ad: 'İşçilik', yontem: 1, miktar: 2, birimFiyat: 500, malzeme: null },
          { ad: 'Sabit', yontem: 3, miktar: 1, birimFiyat: 200, malzeme: null },
        ],
      }),
    );
  });

  describe('Hacim (ahşap / kontra m³)', () => {
    const kontraIs: FinansIsKaydi = {
      ...work, id: 41, sandikTipi: 'Kontrplak Sandık', sandikMalzemesi: FinansSandikMalzemesi.Kontra,
      adet: 2, birimM3: 0, toplamM3: 0, ahsapM3: 0, kontraM3: 0, fiyatlandirmaBirimi: 2, birimFiyat: 100,
    };

    it('kontrplak sandıkta hacim Fiyatlandırma sekmesinde girilir; tarife × bileşik önizlenir ve gerekçeyle gönderilir', () => {
      api.isDetay.and.returnValue(of({ isSuccess: true, value: kontraIs }));
      const { fixture, component } = setup('IsKaydi');
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('.finans-hacim-karti')).toBeNull();
      (el.querySelector('.hacim-bekliyor') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(component.sekme()).toBe('fiyat');
      expect((el.querySelector('.hacim-ahsap') as HTMLInputElement).readOnly).toBeFalse();
      component.hacim.ahsapM3 = 1.2;
      component.hacim.kontraM3 = 0.8;
      fixture.detectChanges();
      expect((el.querySelector('.hacim-bilesik') as HTMLInputElement).value).toBe('2');
      expect(el.querySelector('.hacim-onizleme')?.textContent).toContain('200.00');

      // Gerekçe isteğe bağlıdır: boşken de gönderilir, yazılırsa iletilir.
      component.hacimKaydet();
      expect(api.hacimGir).toHaveBeenCalledOnceWith(41, { ahsapM3: 1.2, kontraM3: 0.8, aciklama: undefined });
      // Kayıttan sonra form sunucudaki değerle yeniden açılır; ikinci girişte değerler tekrar yazılır.
      component.hacim = { ahsapM3: 1.2, kontraM3: 0.8, aciklama: ' Kontra ölçüsü girildi ' };
      component.hacimKaydet();
      expect(api.hacimGir).toHaveBeenCalledWith(41, { ahsapM3: 1.2, kontraM3: 0.8, aciklama: 'Kontra ölçüsü girildi' });
    });

    it('ahşap sandıkta hacim girişi yoktur; daha önce elle girilmişse ahşap m³ salt okunur ve geçersiz hacim gönderilmez', () => {
      api.isDetay.and.returnValue(of({ isSuccess: true, value: { ...kontraIs, sandikMalzemesi: FinansSandikMalzemesi.Ahsap, ahsapM3: 2.5 } }));
      const ilk = setup('IsKaydi');
      expect(ilk.component.hacimDuzenlenebilir()).toBeFalse();
      ilk.component.tab('fiyat');
      ilk.fixture.detectChanges();
      expect(ilk.fixture.nativeElement.querySelector('.finans-hacim-karti')).toBeNull();

      api.isDetay.and.returnValue(of({ isSuccess: true, value: { ...kontraIs, sandikMalzemesi: FinansSandikMalzemesi.Ahsap, ahsapM3: 2.5, hacimManuel: true } }));
      const { fixture, component } = setup('IsKaydi');
      component.tab('fiyat');
      fixture.detectChanges();
      expect((fixture.nativeElement.querySelector('.hacim-ahsap') as HTMLInputElement).readOnly).toBeTrue();
      expect(component.hacim.ahsapM3).toBe(2.5);
      component.hacim = { ahsapM3: 0, kontraM3: 0, aciklama: 'Geçersiz hacim' };
      component.hacimKaydet();
      expect(api.hacimGir).not.toHaveBeenCalled();
      expect(component.hata()).toBeTruthy();
    });

    it('malzemeli fiyatlı işte önizleme kontra m³ × kontra + ahşap m³ × ahşap fiyatıyla hesaplanır', () => {
      api.isDetay.and.returnValue(of({ isSuccess: true, value: { ...kontraIs, birimFiyat: 300, ahsapBirimFiyat: 150 } }));
      const { fixture, component } = setup('IsKaydi');
      component.tab('fiyat');
      component.hacim = { ahsapM3: 1.2, kontraM3: 0.8, aciklama: '' };
      fixture.detectChanges();
      expect(component.hacimOnizleme()?.tutar).toBe(420);
      expect((fixture.nativeElement as HTMLElement).querySelector('.hacim-onizleme')?.textContent).toContain('420.00');
      expect((fixture.nativeElement as HTMLElement).querySelector('.hacim-ahsap-tarifesiz')).toBeNull();
    });

    it('malzemeli fiyatta ahşap tarifesi yoksa (ahşap fiyatı 0) ahşap m³ girilince uyarı gösterilir', () => {
      api.isDetay.and.returnValue(of({ isSuccess: true, value: { ...kontraIs, birimFiyat: 300, ahsapBirimFiyat: 0 } }));
      const { fixture, component } = setup('IsKaydi');
      component.tab('fiyat');
      component.hacim = { ahsapM3: 1.2, kontraM3: 0.8, aciklama: '' };
      fixture.detectChanges();
      expect(component.hacimOnizleme()?.tutar).toBe(240);
      expect((fixture.nativeElement as HTMLElement).querySelector('.hacim-ahsap-tarifesiz')).not.toBeNull();
    });

    it('PO bağlı işte veya iş kaydı düzenleme (İş Takibi/Münferit İşler W) izni yokken bölüm açılmaz', () => {
      const fiyatSekmesinde = () => {
        const { fixture, component } = setup('IsKaydi');
        component.tab('fiyat');
        fixture.detectChanges();
        return fixture.nativeElement.querySelector('.finans-hacim-karti');
      };
      api.isDetay.and.returnValue(of({ isSuccess: true, value: { ...kontraIs, poNumaralari: ['PO-1'] } }));
      expect(fiyatSekmesinde()).toBeNull();

      api.isDetay.and.returnValue(of({ isSuccess: true, value: kontraIs }));
      expect(fiyatSekmesinde()).not.toBeNull();

      // Yalnız Münferit İşler W de iş kaydını düzenler; ikisi de yoksa bölüm kapanır.
      permissions.canWrite.and.callFake((kod: string) => kod !== FINANS_YETKI.SekmeIsTakibi);
      expect(fiyatSekmesinde()).not.toBeNull();
      permissions.canWrite.and.callFake((kod: string) => kod !== FINANS_YETKI.SekmeIsTakibi && kod !== FINANS_YETKI.SekmeMunferitIsler);
      expect(fiyatSekmesinde()).toBeNull();
    });

    it('adetle fiyatlanan katlanır işte m³ girilir ama tutarı değiştirmediği söylenir; elle fiyat kartı kendiliğinden açılmaz', () => {
      const katlanir = { ...kontraIs, sandikTipi: 'Katlanır Sandık', fiyatlandirmaBirimi: 1 as const };
      api.isDetay.and.returnValue(of({ isSuccess: true, value: katlanir }));
      const { fixture, component } = setup('IsKaydi');
      expect(component.fiyatDuzenlenebilir()).toBeTrue();
      const el = fixture.nativeElement as HTMLElement;
      (el.querySelector('.fiyat-sekmesi') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(el.querySelector('.hacim-adet-notu')).not.toBeNull();
      expect(el.querySelector('.v2-pricing-card')).toBeNull();
    });

    it('hacimle fiyatlanan işte birim m³ sorulmaz; elle fiyatlandırma kapalıdır ve yalnız bilinçli açılır', () => {
      api.isDetay.and.returnValue(of({ isSuccess: true, value: { ...kontraIs, hacimManuel: true, birimM3: 1, toplamM3: 2 } }));
      const { fixture, component } = setup('IsKaydi');
      component.tab('fiyat');
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('.finans-hacim-karti')).not.toBeNull();
      expect(el.querySelector('.v2-pricing-card')).toBeNull();
      expect(el.querySelector('.finans-birim-m3')).toBeNull();

      (el.querySelector('.elle-fiyat-ac') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(el.querySelector('.v2-pricing-card')).not.toBeNull();
      expect(el.querySelector('.elle-fiyat-uyari')).not.toBeNull();
      expect(el.querySelector('.finans-birim-m3')).toBeNull();
      (el.querySelector('.elle-fiyat-kapat') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(el.querySelector('.v2-pricing-card')).toBeNull();
    });

    it('hacimsiz (ahşap/özel) işte elle fiyatlandırma doğrudan açıktır ve birim m³ girilir', () => {
      api.isDetay.and.returnValue(of({ isSuccess: true, value: { ...kontraIs, sandikMalzemesi: FinansSandikMalzemesi.Ahsap } }));
      const { fixture, component } = setup('IsKaydi');
      component.tab('fiyat');
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('.v2-pricing-card')).not.toBeNull();
      expect((el.querySelector('.finans-birim-m3') as HTMLInputElement).readOnly).toBeFalse();
    });
  });

  it('bileşen özeti satır tutarlarını toplar ve m³ satırlarını malzemeye göre ayırır', () => {
    const { component } = setup('IsKaydi');
    component.fiyat.bilesenler = [
      ...work.bilesenler!,
      { ad: 'Kontra', yontem: 2, miktar: 0.25, birimFiyat: 800, malzeme: FinansSandikMalzemesi.Kontra },
      { ad: 'Sandığın malzemesi', yontem: 2, miktar: 0.1, birimFiyat: 100 },
    ];
    // Satırlar: 0,5×400 + 2×500 + 200 (sabit) + 0,25×800 + 0,1×100
    expect(component.bilesenOzeti()).toEqual({ tutar: 1610, ahsapM3: 0.5, kontraM3: 0.25, malzemesizM3: 0.1 });
  });

  it('formdaki bileşen düzenlemesi açılan değişmez snapshot nesnesini değiştirmez', () => {
    const { component } = setup('IsKaydi');
    component.fiyat.bilesenler![0].birimFiyat = 900;
    expect(component.kayit()?.bilesenler?.[0].birimFiyat).toBe(400);
  });

  it('para birimi seçenekleri tanım tablosundan gelir; kaydın pasif para birimi listede kalır', () => {
    const { component } = setup('IsKaydi');
    expect(api.paraBirimleri).toHaveBeenCalledTimes(1);
    expect(component.paraBirimleri.secenekler('EUR')).toEqual(['TRY', 'EUR']);
    expect(component.paraBirimleri.secenekler('USD')).toEqual(['TRY', 'EUR', 'USD']);
  });

  it('iş kaydı düzenleme (İş Takibi/Münferit İşler W) izni kaldırılınca alanlar görünse de fiyat değişikliği göndermez', () => {
    const { component } = setup('IsKaydi');
    expect(component.fiyatDuzenlenebilir()).toBeTrue();
    permissions.canWrite.and.callFake((kod: string) => kod !== FINANS_YETKI.SekmeIsTakibi && kod !== FINANS_YETKI.SekmeMunferitIsler);
    component.fiyat.aciklama = 'Yetki değişimi sonrası kayıt';
    component.fiyatKaydet();
    expect(api.fiyatlandir).not.toHaveBeenCalled();
    expect(component.hata()).toContain('İş Takibi veya Münferit İşler');
  });

  it('iptal ve kalıcı silme kaydın kendi sekmesinin W iznine bağlıdır', () => {
    permissions.canWrite.and.callFake((kod: string) => kod === FINANS_YETKI.SekmeGiderler);
    const gider = setup('Gider').component;
    expect(gider.iptalEdilebilir()).toBeTrue();
    expect(gider.kaliciSilinebilir()).toBeTrue();
    const siparis = setup('Siparis').component;
    expect(siparis.iptalEdilebilir()).toBeFalse();
    expect(siparis.kaliciSilinebilir()).toBeFalse();
    expect(siparis.belgeDuzenlemeIzni()).toBeFalse();

    // PO düzeltme/iptal/silme PO'lar alt sekmesine bağlıdır; Faturalar alt sekmesi yetmez.
    permissions.canWrite.and.callFake((kod: string) => kod === FINANS_YETKI.SekmePoFatura || kod === FINANS_YETKI.SekmePoFaturaFatura);
    expect(siparis.iptalEdilebilir()).toBeFalse();
    expect(siparis.kaliciSilinebilir()).toBeFalse();
    expect(siparis.belgeDuzenlemeIzni()).toBeFalse();
    const fatura = setup('Fatura').component;
    expect(fatura.iptalEdilebilir()).toBeTrue();
    expect(fatura.kaliciSilinebilir()).toBeTrue();
    expect(fatura.belgeDuzenlemeIzni()).toBeTrue();

    permissions.canWrite.and.callFake((kod: string) => kod === FINANS_YETKI.SekmePoFatura || kod === FINANS_YETKI.SekmePoFaturaPo);
    expect(siparis.iptalEdilebilir()).toBeTrue();
    expect(siparis.kaliciSilinebilir()).toBeTrue();
    expect(siparis.belgeDuzenlemeIzni()).toBeTrue();
    expect(fatura.iptalEdilebilir()).toBeFalse();
    expect(fatura.odemeKaydedilebilir()).toBeFalse();
    expect(gider.iptalEdilebilir()).toBeFalse();

    permissions.canWrite.and.callFake((kod: string) => kod === FINANS_YETKI.SekmeMunferitIsler);
    const is = setup('IsKaydi').component;
    expect(is.iptalEdilebilir()).toBeTrue();
    expect(is.kaliciSilinebilir()).toBeTrue();
  });

  it('değişiklik geçmişi kayıt sekmeleri veya Giderler sekmesinden biriyle görünür', () => {
    permissions.hasAccess.and.callFake((kod: string) => kod === FINANS_YETKI.Modul || kod === FINANS_YETKI.SekmeGiderler);
    expect(setup('Gider').component.gecmisGorunur()).toBeTrue();
    permissions.hasAccess.and.callFake((kod: string) => kod === FINANS_YETKI.Modul || kod === FINANS_YETKI.SekmeGiderKategorileri);
    expect(setup('Gider').component.gecmisGorunur()).toBeFalse();
  });

  it('PO revizyonunu gerekçe ve net tutarla, eski fiziksel miktarları taşımadan gönderir', () => {
    const { component } = setup('Siparis');
    expect(component.belgeForm.tarih).toBe('2026-09-19');
    component.belgeForm.numara = '  PO-REV  ';
    component.belgeForm.gerekce = '  Tutar mutabakatı  ';
    component.tutarlariDuzenle = true;
    component.belgeKalemleri[0].netTutar = 6500;
    component.belgeKaydet();
    expect(api.siparisGuncelle).toHaveBeenCalledOnceWith(7, {
      poNumarasi: 'PO-REV',
      siparisTarihi: '2026-09-19',
      aciklama: '',
      gerekce: 'Tutar mutabakatı',
      kalemler: [{ isKaydiId: 11, adet: 0, m3: 0, netTutar: 6500 }],
    });
    expect(line.adet).toBe(3);
    expect(line.m3).toBe(1.5);
  });

  it('fatura revizyonunda fatura kalemi yerine kaynak PO kalemi kimliğini kullanır', () => {
    const { component } = setup('Fatura');
    component.belgeForm.gerekce = 'Kısmi tutar düzeltmesi';
    component.tutarlariDuzenle = true;
    component.belgeKalemleri[0].netTutar = 4000;
    component.belgeKaydet();
    expect(api.faturaGuncelle).toHaveBeenCalledOnceWith(8, {
      faturaNumarasi: 'INV-8',
      faturaTarihi: '2026-09-19',
      vadeTarihi: null,
      aciklama: '',
      gerekce: 'Kısmi tutar düzeltmesi',
      belgeMutabakatiniKoru: false,
      kalemler: [{ siparisKalemiId: 21, adet: 0, m3: 0, netTutar: 4000 }],
    });
  });

  it('yalnız fatura başlığı değişiyorsa kalem revizyonu yollamaz ve belge mutabakatını korur', () => {
    const { component } = setup('Fatura');
    component.belgeForm.gerekce = 'Belge numarası düzeltmesi';
    component.belgeKaydet();
    const payload = api.faturaGuncelle.calls.mostRecent().args[1];
    expect(payload.belgeMutabakatiniKoru).toBeTrue();
    expect(payload.kalemler).toBeUndefined();
  });

  it('fatura revizyonunda vade tarihini gönderir; fatura tarihinden önceki vadeyi reddeder', () => {
    api.faturaDetay.and.returnValue(of({ isSuccess: true, value: { ...invoice, vadeTarihi: '2026-11-18T00:00:00' } }));
    const { component } = setup('Fatura');
    expect(component.belgeForm.vade).toBe('2026-11-18');
    component.belgeForm.gerekce = 'Vade düzeltmesi';
    component.belgeForm.vade = '2026-09-01';
    component.belgeKaydet();
    expect(api.faturaGuncelle).not.toHaveBeenCalled();
    expect(component.hata()).toBe(component.t('DUE_DATE_BEFORE_INVOICE'));
    component.belgeForm.vade = '2026-12-01';
    component.belgeKaydet();
    expect(api.faturaGuncelle.calls.mostRecent().args[1].vadeTarihi).toBe('2026-12-01');
  });

  describe('ödeme işareti', () => {
    const odenmemis: FinansFatura = { ...invoice, vadeTarihi: '2026-10-19T00:00:00', odendiMi: false, odemeDurumu: FinansOdemeDurumu.Bekliyor };
    const odenmis: FinansFatura = {
      ...invoice,
      vadeTarihi: '2026-10-19T00:00:00',
      odendiMi: true,
      odemeTarihi: '2026-10-10T00:00:00',
      odemeAciklamasi: 'Havale',
      odemeDurumu: FinansOdemeDurumu.ZamanindaOdendi,
    };

    it('ödendi işaretini ödeme tarihi ve açıklamayla gönderir', () => {
      api.faturaDetay.and.returnValue(of({ isSuccess: true, value: odenmemis }));
      const { component } = setup('Fatura');
      const changed = spyOn(component.degisti, 'emit');
      expect(component.odemeForm.odendi).toBeFalse();
      expect(component.odemeForm.tarih).toBe(component.bugun());
      component.odemeForm = { odendi: true, tarih: '2026-09-25', aciklama: '  Banka havalesi  ' };
      component.odemeKaydet();
      expect(api.faturaOdeme).toHaveBeenCalledOnceWith(8, {
        odendi: true,
        odemeTarihi: '2026-09-25',
        aciklama: 'Banka havalesi',
      });
      expect(changed).toHaveBeenCalledTimes(1);
    });

    it('gelecek tarihli ödemeyi göndermez', () => {
      api.faturaDetay.and.returnValue(of({ isSuccess: true, value: odenmemis }));
      const { component } = setup('Fatura');
      component.odemeForm = { odendi: true, tarih: '2999-01-01', aciklama: '' };
      component.odemeKaydet();
      expect(api.faturaOdeme).not.toHaveBeenCalled();
      expect(component.hata()).toBe(component.t('PAYMENT_DATE_ERROR'));
    });

    it('işaret kaldırma en az 5 karakterlik gerekçe ister ve ödeme tarihini göndermez', () => {
      api.faturaDetay.and.returnValue(of({ isSuccess: true, value: odenmis }));
      const { component } = setup('Fatura');
      expect(component.odemeForm).toEqual({ odendi: true, tarih: '2026-10-10', aciklama: 'Havale' });
      component.odemeForm.odendi = false;
      component.odemeForm.aciklama = ' abc ';
      component.odemeKaydet();
      expect(api.faturaOdeme).not.toHaveBeenCalled();
      expect(component.hata()).toBe(component.t('PAYMENT_UNMARK_REASON_ERROR'));
      component.odemeForm.aciklama = 'Yanlış faturaya işlendi';
      component.odemeKaydet();
      expect(api.faturaOdeme).toHaveBeenCalledOnceWith(8, {
        odendi: false,
        odemeTarihi: null,
        aciklama: 'Yanlış faturaya işlendi',
      });
    });

    it('PO/Fatura sekmesinde W izni yoksa veya fatura iptal edilmişse ödeme kaydı açılmaz', () => {
      api.faturaDetay.and.returnValue(of({ isSuccess: true, value: odenmemis }));
      permissions.canWrite.and.callFake((kod) => kod !== FINANS_YETKI.SekmePoFatura);
      const { component } = setup('Fatura');
      expect(component.odemeKaydedilebilir()).toBeFalse();
      component.odemeForm = { odendi: true, tarih: '2026-09-25', aciklama: '' };
      component.odemeKaydet();
      expect(api.faturaOdeme).not.toHaveBeenCalled();

      permissions.canWrite.and.returnValue(true);
      component.fatura.set({ ...odenmemis, iptalEdildi: true, durum: 2 });
      expect(component.odemeKaydedilebilir()).toBeFalse();
    });

    it('vade farkını kalan gün, gecikme ve ödeme zamanlamasıyla yazar', () => {
      const { component } = setup('Fatura');
      const metin = (f: Partial<FinansFatura>) => component.vadeFarkiMetni({ ...invoice, ...f });
      expect(metin({ odendiMi: false, vadeFarkiGun: 0 })).toBe(component.t('DUE_TODAY'));
      expect(metin({ odendiMi: false, vadeFarkiGun: 5 })).toBe(component.t('DUE_IN_DAYS').replace('{0}', '5'));
      expect(metin({ odendiMi: false, vadeFarkiGun: -3 })).toBe(component.t('OVERDUE_DAYS').replace('{0}', '3'));
      expect(metin({ odendiMi: true, vadeFarkiGun: -2 })).toBe(component.t('PAYMENT_PAID_ON_TIME'));
      expect(metin({ odendiMi: true, vadeFarkiGun: 4 })).toBe(
        component.t('PAYMENT_PAID_DAYS_LATE').replace('{0}', '4'),
      );
    });
  });

  for (const tur of ['Siparis', 'Fatura'] as const) {
    it(`${tur} değişikliğinde boş gerekçeyi reddeder`, () => {
      const { component } = setup(tur);
      component.belgeForm.gerekce = '  ';
      component.belgeKaydet();
      expect(api.siparisGuncelle).not.toHaveBeenCalled();
      expect(api.faturaGuncelle).not.toHaveBeenCalled();
      expect(component.hata()).toContain('gerekçesi zorunludur');
    });

    it(`${tur} 202 yanıtında başarı/yenileme/kapanma yaymaz; işlem bekliyor mesajını gösterir`, () => {
      api.siparisGuncelle.and.returnValue(of({ isSuccess: true, statusCode: 202 }));
      api.faturaGuncelle.and.returnValue(of({ isSuccess: true, statusCode: 202 }));
      const { component } = setup(tur);
      const changed = spyOn(component.degisti, 'emit');
      const closed = spyOn(component.kapat, 'emit');
      const reload = spyOn(component, 'yukle');
      component.belgeForm.gerekce = 'Onay gereken revizyon';
      component.belgeKaydet();
      expect(toast.info).toHaveBeenCalledOnceWith('İşlem onaya gönderildi; henüz uygulanmadı.');
      expect(toast.success).not.toHaveBeenCalled();
      expect(changed).not.toHaveBeenCalled();
      expect(closed).not.toHaveBeenCalled();
      expect(reload).not.toHaveBeenCalled();
      expect(component.saving()).toBeFalse();
    });
  }

  for (const net of [null, 0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    it(`geçersiz ${String(net)} net tutarı revizyon olarak göndermez`, () => {
      const { component } = setup('Fatura');
      component.belgeForm.gerekce = 'Tutar düzeltmesi';
      component.tutarlariDuzenle = true;
      component.belgeKalemleri[0].netTutar = net;
      component.belgeKaydet();
      expect(api.faturaGuncelle).not.toHaveBeenCalled();
      expect(component.hata()).toContain('pozitif net tutar');
    });
  }

  it('PO/Fatura sekmesinin W izni kalkmışsa revizyon göndermez', () => {
    const { component } = setup('Siparis');
    component.belgeForm.gerekce = 'Tutar düzeltmesi';
    component.tutarlariDuzenle = true;
    permissions.canWrite.and.callFake((kod) => kod !== FINANS_YETKI.SekmePoFatura);
    component.belgeKaydet();
    expect(api.siparisGuncelle).not.toHaveBeenCalled();
  });

  it('başarısız revizyonda backend hatasını gösterir ve düzenlenen tutarı kaybetmez', () => {
    api.faturaGuncelle.and.returnValue(of({ isSuccess: false, error: 'PO bakiyesi değişti.' }));
    const { component } = setup('Fatura');
    const changed = spyOn(component.degisti, 'emit');
    component.belgeForm.gerekce = 'Tutar düzeltmesi';
    component.tutarlariDuzenle = true;
    component.belgeKalemleri[0].netTutar = 6001;
    component.belgeKaydet();
    expect(component.hata()).toBe('PO bakiyesi değişti.');
    expect(component.belgeKalemleri[0].netTutar).toBe(6001);
    expect(changed).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('bağımlılıklar nedeniyle silinemeyen önizlemeyi ikinci onayla aşamaz', () => {
    api.kaliciSilOnizleme.and.returnValue(
      of({
        isSuccess: true,
        value: {
          ...preview,
          silinebilir: false,
          bagimliliklar: [{ varlikTuru: 'Belge', id: 61, referans: 'qa.pdf' }],
          engeller: ['Bağlı belge var.'],
        },
      }),
    );
    const { component } = setup();
    readyToDelete(component);
    component.sil();
    expect(api.kaliciSil).not.toHaveBeenCalled();
  });

  for (const missing of ['önizleme', 'ikinci adım', 'onay', 'gerekçe']) {
    it(`kalıcı silmede ${missing} eksikse isteği engeller`, () => {
      const { component } = setup();
      readyToDelete(component);
      if (missing === 'önizleme') component.preview.set(null);
      if (missing === 'ikinci adım') component.ikinciAdim.set(false);
      if (missing === 'onay') component.ikinciOnay = false;
      if (missing === 'gerekçe') component.silmeNedeni = '  ';
      component.sil();
      expect(api.kaliciSil).not.toHaveBeenCalled();
      expect(component.hata()).toContain('zorunludur');
    });
  }

  it('silme gönderildiğinde güncel sunucu sürümünü, ikinci onayı ve kırpılmış gerekçeyi kullanır', () => {
    const { component } = setup();
    const changed = spyOn(component.degisti, 'emit');
    const closed = spyOn(component.kapat, 'emit');
    readyToDelete(component);
    component.sil();
    expect(api.kaliciSilOnizleme).toHaveBeenCalledOnceWith('Gider', 31);
    expect(api.kaliciSil).toHaveBeenCalledOnceWith({
      varlikTuru: 'Gider',
      id: 31,
      surum: 'SERVER-HASH-V2',
      ikinciOnay: true,
      aciklama: 'Yinelenmiş test kaydı',
    });
    expect(changed).toHaveBeenCalledTimes(1);
    expect(closed).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalled();
  });

  it('önizleme yenilenirken eski sürümü ve iki onayı temizler; hata eski silme iznini geri getirmez', () => {
    const response = new Subject<ApiResult<FinansKaliciSilOnizleme>>();
    const { component } = setup();
    readyToDelete(component);
    api.kaliciSilOnizleme.and.returnValue(response);
    component.silOnizleme();
    expect(component.preview()).toBeNull();
    expect(component.ikinciAdim()).toBeFalse();
    expect(component.ikinciOnay).toBeFalse();
    response.next({ isSuccess: false, error: 'Önizleme yenilenemedi.' });
    response.complete();
    expect(component.preview()).toBeNull();
    expect(component.hata()).toBe('Önizleme yenilenemedi.');
    component.ikinciAdim.set(true);
    component.ikinciOnay = true;
    component.sil();
    expect(api.kaliciSil).not.toHaveBeenCalled();
  });

  it('silmenin 202 onay yanıtı kaydı silinmiş gibi kapatmaz', () => {
    api.kaliciSil.and.returnValue(of({ isSuccess: true, statusCode: 202 }));
    const { component } = setup();
    const changed = spyOn(component.degisti, 'emit');
    const closed = spyOn(component.kapat, 'emit');
    readyToDelete(component);
    component.sil();
    expect(toast.info).toHaveBeenCalledOnceWith('İşlem onaya gönderildi; henüz uygulanmadı.');
    expect(toast.success).not.toHaveBeenCalled();
    expect(changed).not.toHaveBeenCalled();
    expect(closed).not.toHaveBeenCalled();
  });

  it('sürüm çakışmasında modalı açık tutar; bekleyen istek bitince saving kilidini kaldırır', () => {
    const response = new Subject<ApiResult<void>>();
    api.kaliciSil.and.returnValue(response);
    const { component } = setup();
    const closed = spyOn(component.kapat, 'emit');
    readyToDelete(component);
    component.sil();
    expect(component.saving()).toBeTrue();
    response.next({
      isSuccess: false,
      statusCode: 409,
      error: 'Kayıt değişti; önizlemeyi yenileyin.',
    });
    response.complete();
    expect(component.saving()).toBeFalse();
    expect(component.hata()).toBe('Kayıt değişti; önizlemeyi yenileyin.');
    expect(closed).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });
});
