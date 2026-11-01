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

  /** İş Takibi → Aylık görünüm ve PO/Fatura → PO'lar + Faturalar düğümleri (sekme alt sekmenin tavanıdır). */
  const aylikYazma = [FINANS_YETKI.SekmeIsTakibi, FINANS_YETKI.SekmeIsTakibiAylik];
  const poFaturaYazma = [FINANS_YETKI.SekmePoFatura, FINANS_YETKI.SekmePoFaturaPo, FINANS_YETKI.SekmePoFaturaFatura];

  beforeEach(() => {
    reads.set(new Set([FINANS_YETKI.Modul, ...aylikYazma, ...poFaturaYazma, FINANS_YETKI.VadeUyarisi]));
    writes.set(new Set([...aylikYazma, ...poFaturaYazma]));
    api = jasmine.createSpyObj('FinansService', ['aylikIsler', 'giderKategorileri', 'giderKalemleri', 'giderGuncelle', 'giderler', 'paraBirimleri', 'vadeUyarilari', 'faturalar', 'ozelIsAylikDegerGuncelle', 'genelArama', 'projeSandikKirilimi', 'siparisler']);
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

    // Aylık görünümde yalnız R olan kullanıcı aylık değeri düzenleyemez; İş Takibi W tek başına yetmez.
    writes.set(new Set([...poFaturaYazma, FINANS_YETKI.SekmeIsTakibi]));
    expect(c.aylikDegerDuzenlenebilir(satir)).toBeFalse();
  });

  it('kategori satırının sandıkları proje panelinin Sandıklar sekmesinde açılır; proje kırılımı bir kez yüklenir', () => {
    api.projeSandikKirilimi.and.returnValue(of({ isSuccess: true, value: kirilim() }));
    const { fixture, c, el } = setup();
    const [blok] = c.aylikProjeBloklari();
    c.projePaneliniAc(blok);
    fixture.detectChanges();
    const donem = c.seciliDonem();
    expect(api.projeSandikKirilimi).toHaveBeenCalledOnceWith(jasmine.objectContaining({
      projeId: 1, yil: donem.getFullYear(), ay: donem.getMonth() + 1, iptalEdilenleriDahilEt: false,
    }));

    // Kategori satırına tıklama: Sandıklar sekmesi yalnız o kategorinin kayıtlarıyla (sandık sırasıyla) açılır.
    (el.querySelectorAll('.project-drawer tr.project-detail-row')[0] as HTMLElement).click();
    fixture.detectChanges();
    expect(c.projePaneliSekmesi()).toBe('sandiklar');
    expect(c.panelKategoriKayitlari().map((x) => [x.sandik.sandikNo, x.kayit.id])).toEqual([['1', 11], ['2', 12]]);
    expect(el.querySelector('.project-drawer .drawer-chip')?.textContent?.trim()).toBe('Ana ambalaj');
    expect(el.querySelectorAll('.drawer-category-crates tbody tr').length).toBe(2);

    c.kategoriSandiklariniGoster(sarf);
    expect(c.panelKategoriKayitlari().map((x) => x.kayit.id)).toEqual([13]);
    (el.querySelector('.drawer-chip button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(c.panelKategori()).toBeNull();
    expect(el.querySelectorAll('.project-crates tr.crate-summary-row').length).toBe(2);
    expect(api.projeSandikKirilimi).toHaveBeenCalledTimes(1);
    expect(api.genelArama).not.toHaveBeenCalled();
  });

  it('Sandıklar sekmesi bütün sandıkları düz tabloda arama ve durum süzgeciyle gösterir; sandık açılınca NET/SARF kayıtları, kayıttan detay açılır', () => {
    const veri = kirilim(10);
    veri.sandiklar[0] = { ...veri.sandiklar[0], durum: 3, faturaNumaralari: [], poNumaralari: ['PO-77'] };
    veri.sandiklar[2] = { ...veri.sandiklar[2], fiyatBekleyenKayitSayisi: 1 };
    api.projeSandikKirilimi.and.returnValue(of({ isSuccess: true, value: veri }));
    const { fixture, c, el } = setup();
    (el.querySelector('tr.project-row') as HTMLElement).click();
    fixture.detectChanges();
    (el.querySelectorAll('.project-drawer-tabs button')[1] as HTMLButtonElement).click();
    fixture.detectChanges();
    const ozetSatirlari = () => el.querySelectorAll('.project-crates tr.crate-summary-row');
    expect(ozetSatirlari().length).toBe(12);
    expect(ozetSatirlari()[0].querySelector('strong')?.textContent?.trim()).toBe('1');
    expect(el.querySelector('.project-drawer-tabs button.active')?.textContent).toContain('12');

    // Süzgeç sayıları aramadan bağımsızdır: sandık 2 PO'lu (fatura bekliyor), sandık 10 fiyat bekliyor.
    expect(c.panelSandikSayilari()).toEqual(jasmine.objectContaining({ hepsi: 12, fiyat: 1, siparis: 11, fatura: 1, tamam: 0 }));
    c.panelSandikFiltresi.set('fatura');
    fixture.detectChanges();
    expect(Array.from(ozetSatirlari()).map((x) => x.querySelector('strong')?.textContent?.trim())).toEqual(['2']);
    c.panelSandikFiltresi.set('hepsi');
    c.panelSandikArama.set('po-77');
    fixture.detectChanges();
    expect(ozetSatirlari().length).toBe(1);
    c.panelSandikArama.set('1');
    fixture.detectChanges();
    expect(ozetSatirlari().length).toBe(11);
    c.panelSandikArama.set('yok');
    fixture.detectChanges();
    expect(ozetSatirlari().length).toBe(0);
    expect(el.querySelector('.project-drawer .crate-breakdown-empty')?.textContent).toContain('uyan sandık yok');
    c.panelSandikArama.set('');
    fixture.detectChanges();

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

  it('liste yenilenince kırılım önbelleği düşer; açık proje paneli yeni veriyle yeniden yüklenir, proje listeden düşerse kapanır', () => {
    api.projeSandikKirilimi.and.returnValue(of({ isSuccess: true, value: kirilim() }));
    const { fixture, c, el } = setup();
    const [blok] = c.aylikProjeBloklari();
    c.projePaneliniAc(blok);
    c.kategoriSandiklariniGoster(ana);
    expect(api.projeSandikKirilimi).toHaveBeenCalledTimes(1);
    c.aylikListeyiYukle();
    expect(api.projeSandikKirilimi).toHaveBeenCalledTimes(2);
    expect(c.projePaneli()?.anahtar).toBe('P:1');
    expect(c.panelKategoriKayitlari().map((x) => x.kayit.id)).toEqual([11, 12]);

    api.aylikIsler.and.returnValue(of({ isSuccess: true, value: {
      pageNumber: 1, pageSize: 25, totalCount: 1, totalPages: 1, hasPreviousPage: false, hasNextPage: false,
      items: [kira], projeler: [], finansOzeti: [], grupToplamlari: [],
    } }));
    c.aylikListeyiYukle();
    fixture.detectChanges();
    expect(c.projePaneli()).toBeNull();
    expect(c.projePaneliAnahtari()).toBeNull();
    expect(el.querySelector('.project-drawer')).toBeNull();
    expect(api.projeSandikKirilimi).toHaveBeenCalledTimes(2);
  });

  it('projeye bağlı özel iş proje bloğunun "Özel / Düzenli İşler" alt grubunda da listelenir; sandık düğmesi yoktur', () => {
    const projeOzel = satir({ kaynakTuru: 'OzelIs', ozelIsId: 60, isGrubu: 'Özel İş', isAdi: 'Forklift kiralama', isTuru: 8,
      kategori: FinansIsKategorisi.OzelIs, isKaydiIds: [60] });
    api.aylikIsler.and.returnValue(of({ isSuccess: true, value: {
      pageNumber: 1, pageSize: 25, totalCount: 3, totalPages: 1, hasPreviousPage: false, hasNextPage: false,
      items: [sarf, kira, ana, projeOzel], projeler: [ozet], projeOzelIsleri: [projeOzel], finansOzeti: [], grupToplamlari: [],
    } }));
    api.projeSandikKirilimi.and.returnValue(of({ isSuccess: true, value: kirilim() }));
    const { fixture, c, el } = setup();
    const [blok] = c.aylikProjeBloklari();
    expect(blok.ozelIsler.map((x) => x.ozelIsId)).toEqual([60]);
    expect(c.aylikGruplar().find((g) => g.ad === 'Özel ve Düzenli İşler')?.satirlar.map((x) => x.ozelIsId)).toEqual([60]);
    c.projePaneliniAc(blok);
    fixture.detectChanges();
    expect(el.querySelector('.project-drawer tr.project-subgroup-row')?.textContent).toContain('Özel / Düzenli İşler (1)');
    const detaylar = el.querySelectorAll('.project-drawer tr.project-detail-row');
    expect(detaylar.length).toBe(3);
    expect(detaylar[2].textContent).toContain('Forklift kiralama');
    expect(detaylar[2].querySelector('.crate-toggle')).toBeNull();
  });

  it('yedek/saha satırı ölçüye göre ayrı gelir; proje panelinde Özel İş gibi ölçü ve talep eden yazılır', () => {
    const yedek = (ids: number[], boy: number, en: number, yukseklik: number) => satir({ isTuru: 5, isGrubu: 'Yedek Sandık',
      isAdi: 'Yedek Sandık · Ahşap Kapalı', kategori: FinansIsKategorisi.Yedek, isKaydiIds: ids, sandikAdedi: ids.length,
      boy, en, yukseklik, talepEden: 'Hikmet Gültekin' });
    const projeOzel = satir({ kaynakTuru: 'OzelIs', ozelIsId: 60, isGrubu: 'Özel İş', isAdi: 'Özel kasa', isTuru: 8,
      kategori: FinansIsKategorisi.OzelIs, isKaydiIds: [60], boy: 1000, en: 500, yukseklik: 400, talepEden: 'Halit Kaplan' });
    api.aylikIsler.and.returnValue(of({ isSuccess: true, value: {
      pageNumber: 1, pageSize: 25, totalCount: 1, totalPages: 1, hasPreviousPage: false, hasNextPage: false,
      items: [ana, yedek([21, 22], 1800, 800, 800), yedek([23], 2200, 1000, 1100), projeOzel], projeler: [ozet],
      projeOzelIsleri: [projeOzel], finansOzeti: [], grupToplamlari: [],
    } }));
    api.projeSandikKirilimi.and.returnValue(of({ isSuccess: true, value: kirilim() }));
    const { fixture, c, el } = setup();
    expect(c.olcuMetni(ana)).toBeNull();
    c.projePaneliniAc(c.aylikProjeBloklari()[0]);
    fixture.detectChanges();
    const metinler = Array.from(el.querySelectorAll('.project-drawer tr.project-detail-row')).map((x) => x.textContent ?? '');
    expect(metinler.some((x) => x.includes('1.800 × 800 × 800 mm · Talep eden: Hikmet Gültekin'))).toBeTrue();
    expect(metinler.some((x) => x.includes('2.200 × 1.000 × 1.100 mm · Talep eden: Hikmet Gültekin'))).toBeTrue();
    expect(metinler.some((x) => x.includes('1.000 × 500 × 400 mm · Talep eden: Halit Kaplan'))).toBeTrue();
    expect(metinler.find((x) => x.includes('Ana Ambalaj'))).not.toContain('Talep eden');
  });

  it('vade uyarısı kendi izniyle gösterilir; uyarıdan vadesi geçen faturaların listesi açılır (D3)', () => {
    api.vadeUyarilari.and.returnValue(of({ isSuccess: true, value: { vadeUyariGunu: 7, vadesiGecenAdet: 2, yaklasanAdet: 1, kalemler: [] } }));
    const { fixture, c, el } = setup();
    expect(api.vadeUyarilari).toHaveBeenCalledOnceWith(10);
    const uyari = el.querySelector('.due-alert') as HTMLElement;
    expect(uyari.classList).toContain('is-overdue');
    expect(uyari.textContent).toContain('2 faturanın vadesi geçti');
    expect(uyari.textContent).toContain('Vadesi yaklaşan 1 fatura var');
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

  it('Faturalar alt sekmesi kapalı kullanıcı vade uyarısını görür; fatura listesine geçiş düğmeleri gösterilmez', () => {
    // PO/Fatura sekmesi ve PO'lar açık, Faturalar alt sekmesi kapalı.
    reads.set(new Set([FINANS_YETKI.Modul, ...aylikYazma, FINANS_YETKI.SekmePoFatura, FINANS_YETKI.SekmePoFaturaPo, FINANS_YETKI.VadeUyarisi]));
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
    // İş Takibi W: PO açma; tek seferlik iş Aylık görünüm W ister; fatura girişi Faturalar W (ve PO'lar R) ister.
    writes.set(new Set([FINANS_YETKI.SekmeIsTakibi]));
    fixture.detectChanges();
    expect(dugmeler(el)).toEqual(['Rapor', 'Sipariş Aç']);
    writes.set(new Set(aylikYazma));
    fixture.detectChanges();
    expect(dugmeler(el)).toEqual(['Rapor', 'Sipariş Aç', 'Tek Seferlik İş']);
    writes.set(new Set([...aylikYazma, FINANS_YETKI.SekmePoFatura, FINANS_YETKI.SekmePoFaturaFatura]));
    fixture.detectChanges();
    expect(dugmeler(el)).toEqual(['Rapor', 'Fatura Gir', 'Sipariş Aç', 'Tek Seferlik İş']);
  });

  it('liste yalnız proje satırlarıdır; projeye tıklayınca özetli proje paneli kategorilerle açılır, aynı satır veya kapat düğmesi kapatır', () => {
    api.projeSandikKirilimi.and.returnValue(of({ isSuccess: true, value: kirilim() }));
    const { fixture, c, el } = setup();
    const [blok] = c.aylikProjeBloklari();
    expect(c.aylikProjeBloklari().length).toBe(1);
    expect(blok.ozet).toEqual(ozet);
    expect(blok.satirlar.map(x => x.kategori)).toEqual([FinansIsKategorisi.AnaAmbalaj, FinansIsKategorisi.SarfKereste]);
    expect(c.aylikGruplar().map(g => [g.ad, g.satirlar.map(x => x.isAdi)])).toEqual([['Sabit İşler', ['3K Seymen Kira']]]);
    // Listede iç içe açılma yoktur (F5); proje durumu birleşik özetten gelir (F7).
    expect(el.querySelectorAll('tr.project-detail-row').length).toBe(0);
    expect(el.querySelector('tr.project-row')?.textContent).toContain('Kısmi sipariş');
    const satir = el.querySelector('tr.project-row') as HTMLElement;
    satir.click();
    fixture.detectChanges();
    const panel = el.querySelector('.project-drawer') as HTMLElement;
    expect(panel.querySelector('h2')?.textContent).toContain('PA727-03');
    expect(satir.classList).toContain('selected');
    // Özet: iş bedeli, PO'ya bağlanan, faturalanan ve kalan (PO bekleyen = 5375 − 4375, fatura bekleyen = 4375 − 0).
    const kutular = Array.from(panel.querySelectorAll('.summary-tile')).map(x => x.textContent ?? '');
    expect(kutular[0]).toMatch(/5.375.00 EUR/);
    expect(kutular[1]).toMatch(/4.375.00 EUR/);
    expect(kutular[1]).toContain('%81');
    expect(kutular[3]).toMatch(/1.000.00 EUR/);
    expect(kutular[3]).toMatch(/4.375.00 EUR/);
    expect(panel.querySelectorAll('tr.project-detail-row').length).toBe(2);
    satir.click();
    fixture.detectChanges();
    expect(el.querySelector('.project-drawer')).toBeNull();
    satir.click();
    fixture.detectChanges();
    (el.querySelector('.project-drawer-close') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('.project-drawer')).toBeNull();
  });

  it('PO / Fatura sekmesi projenin PO ve faturalarını yükler, bu ayınkileri işaretler; Faturalar alt sekmesi kapalıysa fatura istenmez', () => {
    api.projeSandikKirilimi.and.returnValue(of({ isSuccess: true, value: kirilim() }));
    const page = { pageNumber: 1, pageSize: 100, totalCount: 2, totalPages: 1, hasPreviousPage: false, hasNextPage: false };
    api.siparisler.and.returnValue(of({ isSuccess: true, value: { ...page, toplamlar: [], items: [
      { id: 7, kayitNo: 'S-7', poNumarasi: 'PO-1', projeNo: 'PA727-03', musteri: 'GE', isTurleri: [], siparisTarihi: '2026-09-02',
        sandikAdedi: 1, toplamM3: 1, faturalananM3: 0, kalanM3: 1, durum: 1, tutarlar: [], faturaNumaralari: [],
        netler: [{ paraBirimi: 'EUR', siparisNetTutar: 4375, faturalananNetTutar: 0, gider: 0, net: 4375, tahminiKar: null }] },
      { id: 8, kayitNo: 'S-8', poNumarasi: 'PO-ESKI', projeNo: 'PA727-03', musteri: 'GE', isTurleri: [], siparisTarihi: '2026-06-02',
        sandikAdedi: 1, toplamM3: 1, faturalananM3: 1, kalanM3: 0, durum: 3, tutarlar: [], faturaNumaralari: ['FT-9'] },
    ] } }));
    api.faturalar.and.returnValue(of({ isSuccess: true, value: { ...page, totalCount: 1, toplamlar: [], items: [
      { id: 9, kayitNo: 'F-9', faturaNumarasi: 'FT-9', faturaTarihi: '2026-06-20', poNumarasi: 'PO-ESKI', projeNo: 'PA727-03',
        isTurleri: [], sandikAdedi: 1, toplamM3: 1, durum: 1, odemeDurumu: 4 },
    ] } }));
    const { fixture, c, el } = setup();
    c.projePaneliniAc(c.aylikProjeBloklari()[0]);
    fixture.detectChanges();
    expect(api.siparisler).not.toHaveBeenCalled();
    (el.querySelectorAll('.project-drawer-tabs button')[2] as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(api.siparisler).toHaveBeenCalledOnceWith({ pageNumber: 1, pageSize: 100, projeNo: 'PA727-03' });
    expect(api.faturalar).toHaveBeenCalledOnceWith({ pageNumber: 1, pageSize: 100, projeNo: 'PA727-03' });
    const poSatirlari = el.querySelectorAll('.drawer-po-list tbody tr');
    expect(poSatirlari.length).toBe(2);
    expect(poSatirlari[0].querySelector('.this-month')?.textContent?.trim()).toBe('Bu ay');
    expect(poSatirlari[1].querySelector('.this-month')).toBeNull();
    expect(el.querySelectorAll('.drawer-invoice-list tbody tr').length).toBe(1);
    (poSatirlari[0].querySelector('button') as HTMLButtonElement).click();
    expect(c.detayHedef()).toEqual({ tur: 'Siparis', id: 7 });
    (el.querySelector('.drawer-invoice-list tbody tr button') as HTMLButtonElement).click();
    expect(c.detayHedef()).toEqual({ tur: 'Fatura', id: 9 });
    c.detayHedef.set(null);

    // Faturalar alt sekmesi kapalı: PO listesi (Faturalar'a da açık sunucu sorgusu) PO'lar ile okunur, fatura istenmez.
    reads.set(new Set([FINANS_YETKI.Modul, ...aylikYazma, FINANS_YETKI.SekmePoFatura, FINANS_YETKI.SekmePoFaturaPo]));
    api.siparisler.calls.reset();
    api.faturalar.calls.reset();
    // Panel kapanınca belge listesi kaldırılır; yeniden açılan panel listeyi baştan yükler.
    c.projePaneliniKapat();
    fixture.detectChanges();
    c.projePaneliniAc(c.aylikProjeBloklari()[0]);
    c.projePaneliSekmesiSec('belgeler');
    fixture.detectChanges();
    expect(api.siparisler).toHaveBeenCalledTimes(1);
    expect(api.faturalar).not.toHaveBeenCalled();
    expect(el.querySelector('.drawer-invoice-list')).toBeNull();

    // PO/Fatura sekmesi hiç okunamıyorsa panelde sekme yoktur.
    reads.set(new Set([FINANS_YETKI.Modul, ...aylikYazma]));
    fixture.detectChanges();
    expect(el.querySelectorAll('.project-drawer-tabs button').length).toBe(2);
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
