import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { FinansDagitimComponent, faturaGruplariniOlustur } from './finans-dagitim.component';
import { FinansService } from '../../../core/services/finans.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  FinansSayfaliSonuc,
  FinansSiparisDetay,
  FinansSiparisGrubu,
  FinansSiparisKalemi,
} from '../../../shared/models/finans.model';
import { FinansIsKategorisi, FinansKarsilanma, FinansPoOnayDurumu } from '../../../core/constants/enums';

function grup(ek: Partial<FinansSiparisGrubu> = {}): FinansSiparisGrubu {
  return {
    anahtar: 'P:1:1:EUR',
    projeId: 1,
    projeNo: 'PA727-03',
    musteri: 'GE',
    kategori: FinansIsKategorisi.AnaAmbalaj,
    isTuru: 1,
    duzenliIsId: null,
    ad: 'Ana Ambalaj',
    paraBirimi: 'EUR',
    ilkTarih: '2026-09-01',
    sonTarih: '2026-09-10',
    kalemSayisi: 2,
    isKaydiIds: [11, 12],
    netTutar: 10000,
    siparisNetTutar: 0,
    kalanSiparisNetTutar: 10000,
    faturalananNetTutar: 0,
    ahsapM3: 12.5,
    kontraM3: 0,
    siparisKarsilanma: FinansKarsilanma.Yok,
    faturaKarsilanma: FinansKarsilanma.Yok,
    fiyatBekleyenKalem: 0,
    ...ek,
  };
}

function sayfa<T>(items: T[]): FinansSayfaliSonuc<T> {
  return {
    items,
    toplamlar: [],
    pageNumber: 1,
    pageSize: 20,
    totalCount: items.length,
    totalPages: 1,
    hasPreviousPage: false,
    hasNextPage: false,
  };
}

function kalem(ek: Partial<FinansSiparisKalemi>): FinansSiparisKalemi {
  return {
    id: 21,
    isKaydiId: 11,
    projeId: 1,
    projeNo: 'PA727-03',
    isAdi: 'Sandık 1',
    kategori: FinansIsKategorisi.AnaAmbalaj,
    sandikNo: '1',
    sandikAdi: 'Sandık 1',
    isTuru: 1,
    adet: 0,
    m3: 0,
    faturalananAdet: 0,
    faturalananM3: 0,
    kalanAdet: 0,
    kalanM3: 0,
    urunKodu: '',
    urunAdi: '',
    fiyatlandirmaBirimi: 2,
    fiyatlandirmaMiktari: 0,
    birimFiyat: 0,
    paraBirimi: 'EUR',
    kdvOrani: 20,
    netTutar: 3000,
    kdvTutari: 600,
    toplamTutar: 3600,
    fiyatManuelDegistirildi: false,
    faturalananNetTutar: 0,
    kalanFaturaNetTutar: 3000,
    ...ek,
  };
}

describe('Finans PO ve fatura girişi', () => {
  let api: jasmine.SpyObj<FinansService>;
  let toast: jasmine.SpyObj<ToastService>;
  const poDetay = {
    ozet: { id: 7, poNumarasi: 'PO-1', paraBirimi: 'EUR', siparisTarihi: '2026-09-15', tutarlar: [] },
    kalemler: [kalem({ id: 21, isKaydiId: 11 }), kalem({ id: 22, isKaydiId: 12 })],
  } as unknown as FinansSiparisDetay;

  beforeEach(() => {
    api = jasmine.createSpyObj('FinansService', [
      'siparisGruplari',
      'siparisOlustur',
      'siparisKalemEkle',
      'faturaOlustur',
      'siparisler',
      'siparisDetay',
      'paraBirimleri',
      'parametreler',
      'poOnayinaGonder',
    ]);
    api.parametreler.and.returnValue(of({ isSuccess: true, value: { varsayilanVadeGunu: 60, vadeUyariGunu: 7 } }));
    toast = jasmine.createSpyObj('ToastService', ['success', 'info']);
    api.paraBirimleri.and.returnValue(of({ isSuccess: true, value: [
      { id: 1, kod: 'TRY', ad: 'Türk lirası', sembol: '₺', aktif: true, sira: 1 },
      { id: 2, kod: 'EUR', ad: 'Euro', sembol: '€', aktif: true, sira: 2 },
    ] }));
    api.siparisGruplari.and.returnValue(of({ isSuccess: true, value: sayfa([grup()]) }));
    api.siparisOlustur.and.returnValue(of({ isSuccess: true, value: { id: 7 } as never }));
    api.siparisKalemEkle.and.returnValue(of({ isSuccess: true, value: { id: 7 } as never }));
    api.faturaOlustur.and.returnValue(of({ isSuccess: true, value: { id: 8 } as never }));
    api.siparisler.and.returnValue(of({ isSuccess: true, value: sayfa([]) as never }));
    api.siparisDetay.and.returnValue(of({ isSuccess: true, value: poDetay }));
    TestBed.configureTestingModule({
      imports: [FinansDagitimComponent],
      providers: [
        { provide: FinansService, useValue: api },
        { provide: ToastService, useValue: toast },
        { provide: PermissionService, useValue: { canWrite: () => true, hasAccess: () => true } },
      ],
    });
  });

  function setup(tur: 'Siparis' | 'Fatura' = 'Siparis', ayar: { po?: number; ids?: number[] } = {}) {
    const fixture = TestBed.createComponent(FinansDagitimComponent);
    fixture.componentRef.setInput('tur', tur);
    fixture.componentRef.setInput('isKaydiIds', ayar.ids ?? [11, 12]);
    if (ayar.po) fixture.componentRef.setInput('siparisId', ayar.po);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.numara = 'PO-2026-1';
    component.tarih = '2026-09-19';
    return { fixture, component };
  }

  it('belge istemeden yeni PO açar; satırın proje × kategori grubu kalan tutarla seçili gelir', () => {
    const { component } = setup();
    expect(api.siparisGruplari.calls.mostRecent().args[0].isKaydiIds).toEqual([11, 12]);
    expect(component.grupTutari(grup())).toBe(10000);
    component.grupTutariDegisti(grup(), 6000);
    component.kaydet();
    const request = api.siparisOlustur.calls.mostRecent().args[0];
    expect(request.poNumarasi).toBe('PO-2026-1');
    expect(request.paraBirimi).toBe('EUR');
    expect(request.kalemler).toEqual([]);
    expect(request.gruplar).toEqual([{ isKaydiIds: [11, 12], netTutar: 6000 }]);
  });

  it('PO numarası olmadan veya kalan tutarı aşan grup tutarıyla kaydetmez', () => {
    const { component } = setup();
    component.numara = ' ';
    component.kaydet();
    component.numara = 'PO-2';
    component.grupTutariDegisti(grup(), 10000.01);
    component.kaydet();
    component.grupTutariDegisti(grup(), 1.234);
    component.kaydet();
    expect(api.siparisOlustur).not.toHaveBeenCalled();
  });

  it('seçimden sonra farklı para birimli grup seçilemez (PO-2)', () => {
    const { component } = setup();
    const usd = grup({ anahtar: 'P:2:1:USD', projeNo: 'PA1', paraBirimi: 'USD', isKaydiIds: [31] });
    expect(component.grupSecilebilir(usd)).toBeFalse();
    component.grupSecimiDegistir(usd, true);
    expect(component.secimListesi().length).toBe(1);
  });

  it('seçilemeyen satır nedenini kullanıcıya yazar: tamamen faturalandı, gizli tutar, farklı para birimi', () => {
    const { component, fixture } = setup('Fatura', { po: 7 });
    const [faturaGrubu] = component.faturaGruplari();
    expect(component.faturaGrubuEngeli(faturaGrubu)).toBeNull();
    expect(component.tumuFaturalandi()).toBeFalse();
    component.faturaGruplari.set([{ ...faturaGrubu, kalan: 0, faturalananNetTutar: 5748.12 }]);
    fixture.detectChanges();
    expect(component.tumuFaturalandi()).toBeTrue();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.v2-block-reason')!.textContent).toContain('5.748,12 EUR');
    expect(el.querySelector('.v2-warning-banner')).not.toBeNull();
    expect(component.faturaGrubuEngeli({ ...faturaGrubu, kalan: null })).toBe(component.t('ALLOC_BLOCK_HIDDEN'));

    const po = setup().component;
    const usd = grup({ anahtar: 'P:2:1:USD', projeNo: 'PA1', paraBirimi: 'USD', isKaydiIds: [31] });
    expect(po.grupEngeli(usd)).toContain('USD');
    expect(po.grupEngeli(grup({ anahtar: 'X', kalanSiparisNetTutar: 0, siparisNetTutar: 100 }))).toContain('100,00');
  });

  it('mevcut PO seçilince işler aynı PO numarasına kalem olarak eklenir', () => {
    const { component } = setup('Siparis', { po: 7, ids: [] });
    expect(component.hedef()).toBe('mevcut');
    expect(api.siparisGruplari.calls.mostRecent().args[0].paraBirimi).toBe('EUR');
    component.grupSecimiDegistir(grup(), true);
    component.kaydet();
    expect(api.siparisOlustur).not.toHaveBeenCalled();
    expect(api.siparisKalemEkle).toHaveBeenCalledWith(7, {
      gruplar: [{ isKaydiIds: [11, 12], netTutar: 10000 }],
    });
  });

  it('fatura PO kalemlerini proje × kategori grubunda toplar ve grup tutarını gönderir', () => {
    const { component } = setup('Fatura', { po: 7 });
    const [faturaGrubu] = component.faturaGruplari();
    expect(component.faturaGruplari().length).toBe(1);
    expect(faturaGrubu.siparisKalemiIds).toEqual([21, 22]);
    expect(faturaGrubu.kalan).toBe(6000);
    component.faturaGrubuDegisti(faturaGrubu, true);
    faturaGrubu.tutar = 4000;
    component.numara = 'FTR-1';
    component.kaydet();
    const request = api.faturaOlustur.calls.mostRecent().args[0];
    expect(request.siparisId).toBe(7);
    expect(request.faturaNumarasi).toBe('FTR-1');
    expect(request.kalemler).toEqual([]);
    expect(request.gruplar).toEqual([{ siparisKalemiIds: [21, 22], netTutar: 4000 }]);
  });

  it('6.000 EUR açık PO grubunda 6.001 fatura göndermeyi engeller', () => {
    const { component } = setup('Fatura', { po: 7 });
    const [faturaGrubu] = component.faturaGruplari();
    component.faturaGrubuDegisti(faturaGrubu, true);
    faturaGrubu.tutar = 6001;
    component.kaydet();
    expect(api.faturaOlustur).not.toHaveBeenCalled();
  });

  it('PO seçilmeden fatura oluşturmaz', () => {
    const { component } = setup('Fatura');
    component.kaydet();
    expect(api.faturaOlustur).not.toHaveBeenCalled();
  });

  it('202 onay yanıtını uygulanmış kayıt saymaz', () => {
    api.siparisOlustur.and.returnValue(of({ isSuccess: true, statusCode: 202 }));
    const { component } = setup();
    const done = spyOn(component.kaydedildi, 'emit');
    component.kaydet();
    expect(done).not.toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('HTTP başarı içinde isSuccess false ise modalı açık tutar', () => {
    api.siparisOlustur.and.returnValue(of({ isSuccess: false, error: 'Bakiye değişti' }));
    const { component } = setup();
    const done = spyOn(component.kaydedildi, 'emit');
    component.kaydet();
    expect(component.hata()).toBe('Bakiye değişti');
    expect(done).not.toHaveBeenCalled();
  });

  it('yetkisiz kalan tutar null ise grup seçilemez ve sahte tutar gönderilmez', () => {
    api.siparisGruplari.and.returnValue(
      of({ isSuccess: true, value: sayfa([grup({ netTutar: null, kalanSiparisNetTutar: null })]) }),
    );
    const { component } = setup();
    expect(component.secimListesi().length).toBe(0);
    component.kaydet();
    expect(api.siparisOlustur).not.toHaveBeenCalled();
  });

  it('PO öncesi onayı olmayan grup seçilemez ve nedeni yazılır; "Onaya gönder" kalemleri gönderir, listeyi yeniler', () => {
    const onaysiz = grup({
      poOnayDurumu: FinansPoOnayDurumu.OnayaSunulmadi,
      poyaBaglanabilir: false,
      poOnayaGonderilebilir: true,
    });
    const reddedilen = grup({
      anahtar: 'P:1:9:EUR:A4',
      kategori: FinansIsKategorisi.SarfKereste,
      isKaydiIds: [13],
      poOnayDurumu: FinansPoOnayDurumu.Reddedildi,
      poOnayAciklamasi: 'Sarf m³ kontrol edilsin.',
      poyaBaglanabilir: false,
      poOnayaGonderilebilir: true,
    });
    api.siparisGruplari.and.returnValue(of({ isSuccess: true, value: sayfa([onaysiz, reddedilen]) }));
    api.poOnayinaGonder.and.returnValue(
      of({
        isSuccess: true,
        statusCode: 202,
        value: {
          message: 'İşleminiz yetkili onayına sunulmuştur.',
          statusCode: 202,
          value: { talepler: [], kalemSayisi: 2, atlananKalemSayisi: 1, onayaAlinanTalepSayisi: 1, dogrudanOnaylananTalepSayisi: 0 },
        } as never,
      }),
    );
    const { component, fixture } = setup();

    // Satırdan açılışta onaysız grup ön seçilmez, elle de seçilemez.
    expect(component.secimListesi().length).toBe(0);
    expect(component.grupSecilebilir(onaysiz)).toBeFalse();
    component.grupSecimiDegistir(onaysiz, true);
    expect(component.secimListesi().length).toBe(0);
    expect(component.grupEngeli(onaysiz)).toContain(component.t('PO_APPROVAL_NOT_SUBMITTED'));
    expect(component.grupEngeli(reddedilen)).toContain('Sarf m³ kontrol edilsin.');
    const el = fixture.nativeElement as HTMLElement;
    expect(Array.from(el.querySelectorAll('.v2-po-approval .v2-status')).map((x) => x.textContent!.trim())).toEqual([
      component.t('PO_APPROVAL_NOT_SUBMITTED'),
      component.t('PO_APPROVAL_REJECTED'),
    ]);
    expect(el.querySelector('.v2-po-approval-note')).not.toBeNull();

    const oncekiYukleme = api.siparisGruplari.calls.count();
    component.onayaGonder([onaysiz]);
    expect(api.poOnayinaGonder).toHaveBeenCalledWith([11, 12]);
    expect(toast.info).toHaveBeenCalledWith(component.t('PO_APPROVAL_SENT').replace('{0}', '1'));
    expect(toast.info).toHaveBeenCalledWith(component.t('PO_APPROVAL_SKIPPED').replace('{0}', '1'));
    expect(api.siparisGruplari.calls.count()).toBe(oncekiYukleme + 1);
    component.kaydet();
    expect(api.siparisOlustur).not.toHaveBeenCalled();
  });

  it('onaylı grup ve onay alanı taşımayan grup seçilebilir; kural kapalıyken gönderme başarı bildirir', () => {
    api.poOnayinaGonder.and.returnValue(
      of({
        isSuccess: true,
        value: { talepler: [], kalemSayisi: 2, atlananKalemSayisi: 0, onayaAlinanTalepSayisi: 0, dogrudanOnaylananTalepSayisi: 1 },
      }),
    );
    const { component } = setup();
    expect(component.grupSecilebilir(grup({ poOnayDurumu: FinansPoOnayDurumu.Onaylandi, poyaBaglanabilir: true }))).toBeTrue();
    expect(component.grupSecilebilir(grup())).toBeTrue();
    component.onayaGonder([grup()]);
    expect(toast.success).toHaveBeenCalledWith(component.t('PO_APPROVAL_DIRECT').replace('{0}', '1'));
    expect(toast.info).not.toHaveBeenCalled();
  });

  it('fatura gruplarında gizli kalan tutar grubun kalanını da gizler', () => {
    const gruplar = faturaGruplariniOlustur([
      kalem({ id: 1 }),
      kalem({ id: 2, kalanFaturaNetTutar: null }),
      kalem({ id: 3, kategori: FinansIsKategorisi.SarfKereste, isKaydiId: 40 }),
    ]);
    expect(gruplar.map((x) => [x.siparisKalemiIds, x.kalan])).toEqual([
      [[1, 2], null],
      [[3], 3000],
    ]);
  });

  it('düzenli işin yıllık PO kalemlerini faturada ay ay ayrı satır yapar', () => {
    const gruplar = faturaGruplariniOlustur([
      kalem({ id: 1, projeId: null, duzenliIsId: 5, kategori: FinansIsKategorisi.DuzenliIs, finansTarihi: '2026-09-01T00:00:00', isAdi: 'Kira' }),
      kalem({ id: 2, projeId: null, duzenliIsId: 5, kategori: FinansIsKategorisi.DuzenliIs, finansTarihi: '2026-10-01T00:00:00', isAdi: 'Kira' }),
    ]);
    expect(gruplar.map((x) => [x.donem, x.siparisKalemiIds])).toEqual([
      ['2026-09', [1]],
      ['2026-10', [2]],
    ]);
  });
});
