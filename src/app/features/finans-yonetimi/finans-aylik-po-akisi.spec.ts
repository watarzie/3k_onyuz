import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { FinansYonetimiComponent } from './finans-aylik.component';
import { FinansService } from '../../core/services/finans.service';
import { AmbalajService } from '../../core/services/ambalaj.service';
import { PermissionService } from '../../core/services/permission.service';
import { ToastService } from '../../core/services/toast.service';
import { TranslationService } from '../../core/services/translation.service';
import { FINANS_YETKI } from '../../core/constants/yetki-kodlari';
import { FinansIsKategorisi, FinansKarsilanma, FinansOdemeFiltresi } from '../../core/constants/enums';
import { FinansAylikIs, FinansAylikProjeOzeti, FinansGider } from '../../shared/models/finans.model';

function satir(ek: Partial<FinansAylikIs>): FinansAylikIs {
  return {
    kaynakTuru: 'Proje', ozelIsId: null, projeId: 1, projeBirimAnahtari: 'P:1', musteri: 'GE', isTuru: 1,
    isGrubu: 'Ana Ambalaj', projeNo: 'PA727-03', isAdi: 'Ana Ambalaj', sandikTipi: null, boy: null, en: null,
    yukseklik: null, uretimBaslangic: '2026-09-01', uretimBitis: '2026-09-10', sandikAdedi: 4, miktar: 12.5,
    birim: 'm³', birimFiyat: 350, kdvOrani: 20, netTutar: 4375, kdvTutari: 875, toplamTutar: 5250, paraBirimi: 'EUR',
    siparisMiktari: 0, faturalananMiktar: 0, siparisToplamTutar: 0, faturalananToplamTutar: 0, isKaydiIds: [11, 12],
    poNumaralari: [], faturaNumaralari: [], durum: 'Sipariş Bekliyor', miktarDuzenlenebilir: false,
    tutarDuzenlenebilir: false, iptalEdildi: false, iptalAciklamasi: null, kategori: FinansIsKategorisi.AnaAmbalaj,
    siparisKarsilanma: FinansKarsilanma.Yok, faturaKarsilanma: FinansKarsilanma.Yok, kalanSiparisNetTutar: 4375,
    kalanFaturaNetTutar: 0, ...ek,
  };
}

describe('Finans aylık görünüm PO/fatura akışı', () => {
  const reads = signal(new Set<string>());
  const writes = signal(new Set<string>());
  let api: jasmine.SpyObj<FinansService>;
  const ozet: FinansAylikProjeOzeti = {
    projeBirimAnahtari: 'P:1', projeId: 1, projeNo: 'PA727-03', musteri: 'GE',
    siparisKarsilanma: FinansKarsilanma.Kismi, faturaKarsilanma: FinansKarsilanma.Yok, durum: 2, gerekliKalem: 2,
    fiyatBekleyenKalem: 0, ahsapM3: 12.5, kontraM3: 0,
    tutarlar: [{ paraBirimi: 'EUR', netTutar: 5375, siparisNetTutar: 4375, faturalananNetTutar: 0 }],
  };
  const ana = satir({ poNumaralari: ['PO-1'], siparisKarsilanma: FinansKarsilanma.Tam, kalanSiparisNetTutar: 0,
    kalanFaturaNetTutar: 4375, durum: 'Fatura Bekliyor' });
  const sarf = satir({ isTuru: 9, isGrubu: 'Sarf Kereste', isAdi: 'Sarf Kereste', kategori: FinansIsKategorisi.SarfKereste,
    isKaydiIds: [13], netTutar: 1000, kalanSiparisNetTutar: 1000 });
  const kira = satir({ kaynakTuru: 'OzelIs', ozelIsId: 50, projeId: null, projeBirimAnahtari: 'M:BAĞIMSIZ', projeNo: '',
    isGrubu: 'Kira', isAdi: '3K Seymen Kira', isTuru: 8, kategori: FinansIsKategorisi.DuzenliIs, isKaydiIds: [50] });

  beforeEach(() => {
    reads.set(new Set([FINANS_YETKI.Modul, FINANS_YETKI.KayitGoruntule, FINANS_YETKI.SiparisOperasyonGoruntule]));
    writes.set(new Set([FINANS_YETKI.PoGir, FINANS_YETKI.FaturaGir]));
    api = jasmine.createSpyObj('FinansService', ['aylikIsler', 'giderKategorileri', 'giderKalemleri', 'giderGuncelle', 'giderler', 'paraBirimleri', 'vadeUyarilari', 'faturalar', 'ozelIsAylikDegerGuncelle']);
    api.ozelIsAylikDegerGuncelle.and.returnValue(of({ isSuccess: true }));
    api.vadeUyarilari.and.returnValue(of({ isSuccess: true, value: { vadeUyariGunu: 7, vadesiGecenAdet: 0, yaklasanAdet: 0, kalemler: [] } }));
    api.paraBirimleri.and.returnValue(of({ isSuccess: true, value: [
      { id: 1, kod: 'TRY', ad: 'Türk lirası', sembol: '₺', aktif: true, sira: 1 },
      { id: 2, kod: 'EUR', ad: 'Euro', sembol: '€', aktif: true, sira: 2 },
    ] }));
    const page = { pageNumber: 1, pageSize: 25, totalCount: 2, totalPages: 1, hasPreviousPage: false, hasNextPage: false };
    api.aylikIsler.and.returnValue(of({ isSuccess: true, value: { ...page, items: [sarf, kira, ana], projeler: [ozet], finansOzeti: [], grupToplamlari: [] } }));
    api.giderKategorileri.and.returnValue(of({ isSuccess: true, value: [{ id: 1, ad: 'Araç', aktif: true }] }));
    api.giderKalemleri.and.returnValue(of({ isSuccess: true, value: [] }));
    api.giderGuncelle.and.returnValue(of({ isSuccess: true, value: { id: 4 } as FinansGider }));
    api.giderler.and.returnValue(of({ isSuccess: true, value: { ...page, items: [], toplamlar: [] } }));
    api.faturalar.and.returnValue(of({ isSuccess: true, value: { ...page, totalCount: 0, items: [], toplamlar: [] } }));
    TestBed.configureTestingModule({ imports: [FinansYonetimiComponent], providers: [provideRouter([]),
      { provide: FinansService, useValue: api }, { provide: AmbalajService, useValue: {} },
      { provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['success', 'info', 'error']) },
      { provide: PermissionService, useValue: { loaded: signal(true), hasAccess: (k: string) => reads().has(k), canWrite: (k: string) => writes().has(k) } },
    ] });
    // Diğer specler dili değiştirebilir; etiket beklentileri Türkçedir.
    TestBed.inject(TranslationService).switchLanguage('tr');
  });

  function setup() {
    const fixture = TestBed.createComponent(FinansYonetimiComponent);
    const c = fixture.componentInstance;
    c.activeTab.set('akis');
    fixture.detectChanges();
    c.aylikListeyiYukle();
    fixture.detectChanges();
    return { fixture, c, el: fixture.nativeElement as HTMLElement };
  }

  it('özel/düzenli işte bu ayın miktarı ve tarifesi birlikte düzenlenir; yalnız değişen değer gönderilir', () => {
    reads.set(new Set([...reads(), FINANS_YETKI.ParasalVeriGoruntule, FINANS_YETKI.BirimFiyatGoruntule, FINANS_YETKI.TutarGoruntule]));
    writes.set(new Set([...writes(), FINANS_YETKI.FiyatlandirmaDegistir, FINANS_YETKI.BirimFiyatDegistir]));
    const { c } = setup();
    const satir = { ...kira, birim: 'Hizmet', miktar: 1, birimFiyat: 360000, miktarDuzenlenebilir: true, tutarDuzenlenebilir: true };
    c.aylikDegerDuzenle(satir);
    expect(c.aylikTarifeDuzenlenebilir(satir)).toBeTrue();
    expect(c.aylikTarife).toBe(360000);
    c.aylikTarife = 380000;
    expect(c.aylikNetOnizleme(satir)).toBe(380000);
    c.aylikDegerKaydet();
    expect(api.ozelIsAylikDegerGuncelle).toHaveBeenCalledOnceWith(50, { netBirimFiyat: 380000 });

    writes.set(new Set([FINANS_YETKI.FiyatlandirmaDegistir]));
    expect(c.aylikTarifeDuzenlenebilir(satir)).toBeFalse();
  });

  it('vade uyarısı fatura okuyana gösterilir; uyarıdan vadesi geçen faturaların listesi açılır (D3)', () => {
    api.vadeUyarilari.and.returnValue(of({ isSuccess: true, value: { vadeUyariGunu: 7, vadesiGecenAdet: 2, yaklasanAdet: 1, kalemler: [] } }));
    const { fixture, c, el } = setup();
    expect(api.vadeUyarilari).toHaveBeenCalledOnceWith(10);
    const uyari = el.querySelector('.due-alert') as HTMLElement;
    expect(uyari.classList).toContain('is-overdue');
    expect(uyari.textContent).toContain('2 faturanın vadesi geçti');
    expect(uyari.textContent).toContain('1 faturanın vadesi 7 gün içinde doluyor');
    (uyari.querySelector('.btn-danger') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(c.activeTab()).toBe('belgeler');
    expect(c.belgeGorunumu()).toEqual(jasmine.objectContaining({ tur: 'Fatura', odeme: FinansOdemeFiltresi.VadesiGecen }));
    expect(api.faturalar.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({ odemeDurumu: FinansOdemeFiltresi.VadesiGecen }));
  });

  it('vadesi dolan fatura yoksa uyarı gösterilmez; fatura okuma izni yoksa uyarı istenmez', () => {
    expect(setup().el.querySelector('.due-alert')).toBeNull();
    reads.set(new Set([FINANS_YETKI.Modul, FINANS_YETKI.KayitGoruntule]));
    api.vadeUyarilari.calls.reset();
    setup();
    expect(api.vadeUyarilari).not.toHaveBeenCalled();
  });

  it('projeyi satır, kategorileri alt satır olarak gösterir; özel/düzenli işler ayrı gruptadır', () => {
    const { fixture, c, el } = setup();
    const [blok] = c.aylikProjeBloklari();
    expect(c.aylikProjeBloklari().length).toBe(1);
    expect(blok.ozet).toEqual(ozet);
    expect(blok.satirlar.map(x => x.kategori)).toEqual([FinansIsKategorisi.AnaAmbalaj, FinansIsKategorisi.SarfKereste]);
    expect(c.aylikGruplar().map(g => [g.ad, g.satirlar.map(x => x.isAdi)])).toEqual([['Sabit İşler', ['3K Seymen Kira']]]);
    // Kategori satırları proje açılınca görünür (F5); proje durumu birleşik özetten gelir (F7).
    expect(el.querySelectorAll('tr.project-detail-row').length).toBe(0);
    expect(el.querySelector('tr.project-row')?.textContent).toContain('Kısmi sipariş');
    c.projeDegistir('P:1');
    fixture.detectChanges();
    expect(el.querySelectorAll('tr.project-detail-row').length).toBe(2);
  });

  it('kısmi PO veya faturada da işlem açılır; tamamlanan veya fiyat bekleyen satırda açılmaz', () => {
    const { c } = setup();
    expect(c.poAcilabilir(satir({ poNumaralari: ['PO-1'], siparisKarsilanma: FinansKarsilanma.Kismi, kalanSiparisNetTutar: 100 }))).toBeTrue();
    expect(c.faturaGirilebilir(satir({ poNumaralari: ['PO-1'], faturaKarsilanma: FinansKarsilanma.Kismi, kalanFaturaNetTutar: 50 }))).toBeTrue();
    expect(c.poAcilabilir(ana)).toBeFalse();
    expect(c.faturaGirilebilir(satir({ poNumaralari: ['PO-1'], faturaKarsilanma: FinansKarsilanma.Tam, kalanFaturaNetTutar: 0 }))).toBeFalse();
    expect(c.poAcilabilir(satir({ durum: 'Fiyatlandırma Bekliyor' }))).toBeFalse();
    expect(c.poAcilabilir(satir({ iptalEdildi: true }))).toBeFalse();
  });

  it('proje PO ekranı yalnız sipariş bekleyen kategorilerin işlerini, fatura tek PO numarasını taşır', () => {
    const { c } = setup();
    const [blok] = c.aylikProjeBloklari();
    c.projeSiparisAc(blok);
    expect(c.dagitim()).toEqual({ tur: 'Siparis', ids: [13], siparisId: null });
    c.projeFaturaAc(blok);
    expect(c.dagitim()).toEqual(jasmine.objectContaining({ tur: 'Fatura', siparisId: null, poNumarasi: 'PO-1' }));
    c.siparisAc();
    expect(c.dagitim()?.donem).toEqual({ baslangic: c.donemBaslangici(), bitis: c.donemBitisi() });
  });

  it('PO veya kayıt görüntüleme izni yoksa PO ekranı açılmaz (sunucu izin aynası)', () => {
    reads.update(x => new Set([...x].filter(k => k !== FINANS_YETKI.SiparisOperasyonGoruntule)));
    const { c } = setup();
    c.topluSiparisAc([11]);
    c.faturaAc(null);
    expect(c.dagitim()).toBeNull();
  });

  it('gider düzenlenirken PO bağlantısını korur', () => {
    reads.update(x => new Set([...x, FINANS_YETKI.GiderGoruntule, FINANS_YETKI.ParasalVeriGoruntule, FINANS_YETKI.BirimFiyatGoruntule, FINANS_YETKI.TutarGoruntule]));
    writes.set(new Set([FINANS_YETKI.GiderDuzenle]));
    const { c } = setup();
    c.giderDuzenle({ id: 4, tarih: '2026-09-19', finansTarihi: '2026-09-19', kategoriId: 1, kategori: 'Araç', aciklama: 'Nakliye',
      miktar: 1, birim: 'Adet', birimFiyat: 100, tutar: 100, paraBirimi: 'EUR', kdvOrani: 20, kdvDahil: false, matrah: 100,
      kdvTutari: 20, toplamTutar: 120, projeNo: '', iptalEdildi: false, belgeSayisi: 0, finansSiparisId: 9, poNumarasi: 'PO-9' } as FinansGider);
    c.giderKaydet();
    expect(api.giderGuncelle).toHaveBeenCalledOnceWith(4, jasmine.objectContaining({ finansSiparisId: 9 }));
  });
});
