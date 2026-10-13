import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { FinansYonetimiComponent } from './finans-aylik.component';
import { FinansService } from '../../../core/services/finans.service';
import { AmbalajService } from '../../../core/services/ambalaj.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ToastService } from '../../../core/services/toast.service';
import { TranslationService } from '../../../core/services/translation.service';
import { FINANS_YETKI } from '../../../core/constants/yetki-kodlari';
import { FinansIsKategorisi, FinansKarsilanma, FinansOdemeFiltresi } from '../../../core/constants/enums';
import {
  FinansAylikIs,
  FinansAylikProjeOzeti,
  FinansGider,
  FinansProjeSandikKirilimi,
  FinansSandikKirilimKalemi,
  FinansSandikKirilimSatiri,
} from '../../../shared/models/finans.model';

function kalem(id: number, ek: Partial<FinansSandikKirilimKalemi> = {}): FinansSandikKirilimKalemi {
  return {
    id, isTuru: 1, kategori: FinansIsKategorisi.AnaAmbalaj, kaynakBileseni: 'NET', isAdi: 'Normal Ambalaj',
    finansTarihi: '2026-09-05', adet: 1, toplamM3: 1, ahsapM3: 1, kontraM3: 0, paraBirimi: 'EUR', netTutar: 350,
    siparisNetTutar: 0, faturalananNetTutar: 0, durum: 1, aktif: true, poNumaralari: [], faturaNumaralari: [], ...ek,
  };
}

function sandik(sandikNo: string, kayitlar: FinansSandikKirilimKalemi[]): FinansSandikKirilimSatiri {
  return {
    anahtar: sandikNo + '|EUR', sandikNo, sandikAdi: 'Sandık ' + sandikNo, sandikTipi: 'Ahşap Kapalı', sandikCinsi: 1,
    sandikMalzemesi: 1, kayitSayisi: kayitlar.length, fiyatBekleyenKayitSayisi: 0, adet: 1, toplamM3: 1, ahsapM3: 1,
    kontraM3: 0, paraBirimi: 'EUR', netTutar: 350, siparisNetTutar: 0, faturalananNetTutar: 0, durum: 1,
    ilkTarih: '2026-09-05', sonTarih: '2026-09-05', poNumaralari: [], faturaNumaralari: [], kayitlar,
  };
}

/** Proje 1'in kırılımı: sandık 1 = NET (11) + SARF (13), sandık 2 = NET (12); ek sandıklar yalnız satır sayısı için. */
function kirilim(ekSandik = 0): FinansProjeSandikKirilimi {
  return {
    projeId: 1, projeNo: 'PA727-03', musteri: 'GE', kayitSayisi: 3 + ekSandik,
    sandiklar: [
      sandik('2', [kalem(12)]),
      sandik('1', [kalem(11, { poNumaralari: ['PO-1'] }), kalem(13, { isTuru: 9, kategori: FinansIsKategorisi.SarfKereste, kaynakBileseni: 'SARF' })]),
      ...Array.from({ length: ekSandik }, (_, i) => sandik(String(10 + i), [kalem(100 + i)])),
    ],
  };
}

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
    reads.set(new Set([FINANS_YETKI.Modul, FINANS_YETKI.SekmeIsTakibi, FINANS_YETKI.SekmePoFatura, FINANS_YETKI.VadeUyarisi]));
    writes.set(new Set([FINANS_YETKI.SekmeIsTakibi, FINANS_YETKI.SekmePoFatura]));
    api = jasmine.createSpyObj('FinansService', ['aylikIsler', 'giderKategorileri', 'giderKalemleri', 'giderGuncelle', 'giderler', 'paraBirimleri', 'vadeUyarilari', 'faturalar', 'ozelIsAylikDegerGuncelle', 'genelArama', 'projeSandikKirilimi']);
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
    const { c } = setup();
    const satir = { ...kira, birim: 'Hizmet', miktar: 1, birimFiyat: 360000, miktarDuzenlenebilir: true, tutarDuzenlenebilir: true };
    c.aylikDegerDuzenle(satir);
    expect(c.aylikTarifeDuzenlenebilir(satir)).toBeTrue();
    expect(c.aylikTarife).toBe(360000);
    c.aylikTarife = 380000;
    expect(c.aylikNetOnizleme(satir)).toBe(380000);
    c.aylikDegerKaydet();
    expect(api.ozelIsAylikDegerGuncelle).toHaveBeenCalledOnceWith(50, { netBirimFiyat: 380000 });

    // İş Takibi'nde yalnız R olan kullanıcı aylık değeri düzenleyemez.
    writes.set(new Set([FINANS_YETKI.SekmePoFatura]));
    expect(c.aylikDegerDuzenlenebilir(satir)).toBeFalse();
  });

  it('kategori satırında sandıklar sunucu kırılımından gelir (250 sınırı yok); proje kırılımı bir kez yüklenir', () => {
    api.projeSandikKirilimi.and.returnValue(of({ isSuccess: true, value: kirilim() }));
    const { c } = setup();
    expect(c.sandiklarAcik(ana)).toBeFalse();
    c.sandiklariAcKapat(ana);
    const donem = c.seciliDonem();
    expect(api.projeSandikKirilimi).toHaveBeenCalledOnceWith(jasmine.objectContaining({
      projeId: 1, yil: donem.getFullYear(), ay: donem.getMonth() + 1, iptalEdilenleriDahilEt: false,
    }));
    expect(c.kategoriSandiklari(ana).map((x) => [x.sandik.sandikNo, x.kayit.id])).toEqual([['1', 11], ['2', 12]]);
    c.sandiklariAcKapat(ana);
    c.sandiklariAcKapat(sarf);
    expect(api.projeSandikKirilimi).toHaveBeenCalledTimes(1);
    expect(c.kategoriSandiklari(sarf).map((x) => x.kayit.id)).toEqual([13]);
    expect(api.genelArama).not.toHaveBeenCalled();
  });

  it('proje bloğunda "Sandıklar" ilk sekiz sandığı gösterir; sandık açılınca NET/SARF kayıtları, kayıttan detay açılır', () => {
    api.projeSandikKirilimi.and.returnValue(of({ isSuccess: true, value: kirilim(10) }));
    const { fixture, c, el } = setup();
    (el.querySelector('tr.project-row .project-crates-toggle') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(c.projeAcik('P:1')).toBeFalse();
    const ozetSatirlari = () => el.querySelectorAll('.project-crates tr.crate-summary-row');
    expect(ozetSatirlari().length).toBe(8);
    expect(ozetSatirlari()[0].querySelector('strong')?.textContent?.trim()).toBe('1');
    (el.querySelector('.crate-show-all') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(ozetSatirlari().length).toBe(12);

    (ozetSatirlari()[0].querySelector('.crate-row-toggle') as HTMLButtonElement).click();
    fixture.detectChanges();
    const kayitlar = el.querySelectorAll('.project-crates tr.crate-record-row');
    expect(kayitlar.length).toBe(2);
    expect(kayitlar[0].querySelector('.source-pill')?.textContent?.trim()).toBe('Sandık');
    expect(kayitlar[1].querySelector('.source-pill.is-sarf')?.textContent?.trim()).toBe('Sarf');
    expect(kayitlar[0].textContent).toContain('PO PO-1');
    (kayitlar[1].querySelector('button.btn-outline-primary') as HTMLButtonElement).click();
    expect(c.detayHedef()).toEqual({ tur: 'IsKaydi', id: 13 });
  });

  it('liste yenilenince kırılım önbelleği düşer; açık proje paneli yeni veriyle yeniden yüklenir', () => {
    api.projeSandikKirilimi.and.returnValue(of({ isSuccess: true, value: kirilim() }));
    const { c } = setup();
    const [blok] = c.aylikProjeBloklari();
    c.projeSandiklariAcKapat(blok);
    c.sandiklariAcKapat(ana);
    expect(api.projeSandikKirilimi).toHaveBeenCalledTimes(1);
    c.aylikListeyiYukle();
    expect(api.projeSandikKirilimi).toHaveBeenCalledTimes(2);
    expect(c.projeSandiklariAcik(blok)).toBeTrue();
    expect(c.sandiklarAcik(ana)).toBeFalse();
  });

  it('projeye bağlı özel iş proje bloğunun "Özel / Düzenli İşler" alt grubunda da listelenir; sandık düğmesi yoktur', () => {
    const projeOzel = satir({ kaynakTuru: 'OzelIs', ozelIsId: 60, isGrubu: 'Özel İş', isAdi: 'Forklift kiralama', isTuru: 8,
      kategori: FinansIsKategorisi.OzelIs, isKaydiIds: [60] });
    api.aylikIsler.and.returnValue(of({ isSuccess: true, value: {
      pageNumber: 1, pageSize: 25, totalCount: 3, totalPages: 1, hasPreviousPage: false, hasNextPage: false,
      items: [sarf, kira, ana, projeOzel], projeler: [ozet], projeOzelIsleri: [projeOzel], finansOzeti: [], grupToplamlari: [],
    } }));
    const { fixture, c, el } = setup();
    const [blok] = c.aylikProjeBloklari();
    expect(blok.ozelIsler.map((x) => x.ozelIsId)).toEqual([60]);
    expect(c.aylikGruplar().find((g) => g.ad === 'Özel ve Düzenli İşler')?.satirlar.map((x) => x.ozelIsId)).toEqual([60]);
    c.projeDegistir('P:1');
    fixture.detectChanges();
    expect(el.querySelector('tr.project-subgroup-row')?.textContent).toContain('Özel / Düzenli İşler (1)');
    const detaylar = el.querySelectorAll('tr.project-detail-row');
    expect(detaylar.length).toBe(3);
    expect(detaylar[2].textContent).toContain('Forklift kiralama');
    expect(detaylar[2].querySelector('.crate-toggle')).toBeNull();
  });

  it('vade uyarısı kendi izniyle gösterilir; uyarıdan vadesi geçen faturaların listesi açılır (D3)', () => {
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

  it('vadesi dolan fatura yoksa uyarı gösterilmez; vade uyarısı izni yoksa PO/Fatura sekmesi açık olsa da istenmez', () => {
    expect(setup().el.querySelector('.due-alert')).toBeNull();
    reads.update(x => new Set([...x].filter(k => k !== FINANS_YETKI.VadeUyarisi)));
    api.vadeUyarilari.calls.reset();
    setup();
    expect(api.vadeUyarilari).not.toHaveBeenCalled();
  });

  it('PO/Fatura sekmesi kapalı kullanıcı vade uyarısını görür; fatura listesine geçiş düğmeleri gösterilmez', () => {
    reads.set(new Set([FINANS_YETKI.Modul, FINANS_YETKI.SekmeIsTakibi, FINANS_YETKI.VadeUyarisi]));
    writes.set(new Set());
    api.vadeUyarilari.and.returnValue(of({ isSuccess: true, value: { vadeUyariGunu: 7, vadesiGecenAdet: 1, yaklasanAdet: 1, kalemler: [
      { faturaId: 5, faturaNumarasi: 'FT-5', poNumarasi: 'PO-5', projeNo: 'PA727-03', faturaTarihi: '2026-08-01',
        vadeTarihi: '2026-09-01', kalanGun: -3, odemeDurumu: 1, toplamTutar: 120, paraBirimi: 'EUR' },
    ] } }));
    const { c, el } = setup();
    const uyari = el.querySelector('.due-alert') as HTMLElement;
    expect(uyari).not.toBeNull();
    expect(uyari.querySelector('.btn-danger')).toBeNull();
    expect(uyari.querySelector('.btn-outline-warning')).toBeNull();
    c.vadeTakibiniAc(FinansOdemeFiltresi.VadesiGecen);
    expect(c.activeTab()).toBe('akis');
    // Fatura detayı kayıt sekmesi (İş Takibi) iznindedir; bağlantı açılır.
    (uyari.querySelector('.due-invoice') as HTMLButtonElement).click();
    expect(c.detayHedef()).toEqual({ tur: 'Fatura', id: 5 });
  });

  it('İş Takibi araç çubuğu: R kullanıcısı işlem düğmesi görmez; W düğmeleri sekme kurallarına göre açar', () => {
    const dugmeler = (el: HTMLElement) =>
      Array.from(el.querySelectorAll('.monthly-toolbar .toolbar-actions button')).map(x => x.textContent?.trim());
    writes.set(new Set());
    const { fixture, el } = setup();
    expect(dugmeler(el)).toEqual(['Rapor']);
    // İş Takibi W: PO açma ve tek seferlik iş; fatura girişi PO/Fatura W ister.
    writes.set(new Set([FINANS_YETKI.SekmeIsTakibi]));
    fixture.detectChanges();
    expect(dugmeler(el)).toEqual(['Rapor', 'Sipariş Aç', 'Tek Seferlik İş']);
    writes.set(new Set([FINANS_YETKI.SekmeIsTakibi, FINANS_YETKI.SekmePoFatura]));
    fixture.detectChanges();
    expect(dugmeler(el)).toEqual(['Rapor', 'Fatura Gir', 'Sipariş Aç', 'Tek Seferlik İş']);
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

  it('yalnız R izni olan kullanıcı PO ve fatura ekranını açamaz (sunucu izin aynası)', () => {
    writes.set(new Set());
    const { c } = setup();
    c.topluSiparisAc([11]);
    c.faturaAc(null);
    expect(c.dagitim()).toBeNull();
  });

  it('gider düzenlenirken PO bağlantısını korur', () => {
    reads.update(x => new Set([...x, FINANS_YETKI.SekmeGiderler]));
    writes.set(new Set([FINANS_YETKI.SekmeGiderler]));
    const { c } = setup();
    c.giderDuzenle({ id: 4, tarih: '2026-09-19', finansTarihi: '2026-09-19', kategoriId: 1, kategori: 'Araç', aciklama: 'Nakliye',
      miktar: 1, birim: 'Adet', birimFiyat: 100, tutar: 100, paraBirimi: 'EUR', kdvOrani: 20, kdvDahil: false, matrah: 100,
      kdvTutari: 20, toplamTutar: 120, projeNo: '', iptalEdildi: false, belgeSayisi: 0, finansSiparisId: 9, poNumarasi: 'PO-9' } as FinansGider);
    c.giderKaydet();
    expect(api.giderGuncelle).toHaveBeenCalledOnceWith(4, jasmine.objectContaining({ finansSiparisId: 9 }));
  });
});
