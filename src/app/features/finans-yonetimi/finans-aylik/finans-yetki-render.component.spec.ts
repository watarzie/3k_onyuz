import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { FinansYonetimiComponent } from './finans-aylik.component';
import { FinansService } from '../../../core/services/finans.service';
import { AmbalajService } from '../../../core/services/ambalaj.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ToastService } from '../../../core/services/toast.service';
import { FINANS_YETKI } from '../../../core/constants/yetki-kodlari';
import { FinansAylikFinansOzeti, FinansDuzenliIs, FinansGider } from '../../../shared/models/finans.model';

describe('Finans aylık gerçek template sekme yetkisi kontrolleri', () => {
  const reads = signal(new Set<string>());
  const writes = signal(new Set<string>());
  let api: jasmine.SpyObj<FinansService>;
  const gider = { id: 4, tarih: '2026-09-19', finansTarihi: '2026-09-19', kategoriId: 1, kategori: 'Araç', aciklama: 'Yakıt',
    miktar: 5, birim: 'Litre', birimFiyat: 42, tutar: 210, paraBirimi: 'EUR', kdvOrani: 20, kdvDahil: false, matrah: 210,
    kdvTutari: 42, toplamTutar: 252, projeNo: '', iptalEdildi: false, belgeSayisi: 0 } as FinansGider;
  beforeEach(() => {
    reads.set(new Set([FINANS_YETKI.Modul])); writes.set(new Set());
    api = jasmine.createSpyObj('FinansService', ['aylikIsler', 'duzenliIsler', 'urunler', 'giderKategorileri', 'giderKalemleri', 'giderGuncelle', 'giderOlustur', 'paraBirimleri', 'giderler', 'giderKutuphaneKategorileri', 'vadeUyarilari', 'genelArama', 'yaslandirma', 'parametreler']);
    api.parametreler.and.returnValue(of({ isSuccess: true, value: { varsayilanVadeGunu: 30, vadeUyariGunu: 7 } }) as never);
    const bosSayfa = { items: [], toplamlar: [], totalCount: 0, pageNumber: 1, pageSize: 25, totalPages: 0, hasPreviousPage: false, hasNextPage: false };
    api.genelArama.and.returnValue(of({ isSuccess: true, value: bosSayfa }));
    api.yaslandirma.and.returnValue(of({ isSuccess: true, value: bosSayfa }));
    api.paraBirimleri.and.returnValue(of({ isSuccess: true, value: [
      { id: 1, kod: 'TRY', ad: 'Türk lirası', sembol: '₺', aktif: true, sira: 1 },
      { id: 2, kod: 'EUR', ad: 'Euro', sembol: '€', aktif: true, sira: 2 },
    ] }));
    const page = { items: [], toplamlar: [], pageNumber: 1, pageSize: 25, totalCount: 0, totalPages: 0, hasPreviousPage: false, hasNextPage: false };
    api.duzenliIsler.and.returnValue(of({ isSuccess: true, value: page }));
    api.urunler.and.returnValue(of({ isSuccess: true, value: page }));
    api.giderler.and.returnValue(of({ isSuccess: true, value: page }));
    api.giderKutuphaneKategorileri.and.returnValue(of({ isSuccess: true, value: [] }));
    api.aylikIsler.and.returnValue(of({ isSuccess: true, value: { ...page, finansOzeti: [], grupToplamlari: [] } }));
    api.giderKategorileri.and.returnValue(of({ isSuccess: true, value: [{ id: 1, ad: 'Araç', aktif: true }] }));
    api.giderKalemleri.and.returnValue(of({ isSuccess: true, value: [] }));
    api.giderGuncelle.and.returnValue(of({ isSuccess: false, error: 'Test mutation guard' }));
    api.vadeUyarilari.and.returnValue(of({ isSuccess: true, value: { vadeUyariGunu: 7, vadesiGecenAdet: 0, yaklasanAdet: 0, kalemler: [] } }));
    TestBed.configureTestingModule({ imports: [FinansYonetimiComponent], providers: [provideRouter([]),
      { provide: FinansService, useValue: api }, { provide: AmbalajService, useValue: {} },
      { provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['success', 'info', 'error']) },
      { provide: PermissionService, useValue: { loaded: signal(true), hasAccess: (k: string) => reads().has(k) || writes().has(k), canWrite: (k: string) => writes().has(k) } }
    ] });
  });
  function setup(tab: 'ayarlar' | 'giderler' | 'akis' = 'ayarlar') {
    const fixture = TestBed.createComponent(FinansYonetimiComponent);
    fixture.componentInstance.activeTab.set(tab); fixture.detectChanges();
    return { fixture, c: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
  }
  const tanimAltSekmeleri = [FINANS_YETKI.SekmeTanimlarDuzenli, FINANS_YETKI.SekmeTanimlarTarifeler, FINANS_YETKI.SekmeTanimlarParaBirimi];
  const metinler = (el: HTMLElement, secici: string) => Array.from(el.querySelectorAll(secici)).map(x => x.textContent?.trim());

  it('ayarlar izni yoksa navigasyon düğmesini DOMa hiç eklemez', () => {
    const { el } = setup();
    expect(Array.from(el.querySelectorAll('.main-tabs button')).some(x => x.textContent?.includes('İş ve Tarife'))).toBeFalse();
  });

  it('tanımlar R kullanıcısı okunabilen üç alt görünümü görür; yeni kayıt, satır işlemi veya yazma isteği yoktur', () => {
    reads.update(x => new Set([...x, FINANS_YETKI.SekmeTanimlar, ...tanimAltSekmeleri]));
    const { fixture, c, el } = setup();
    expect(metinler(el, '.settings-toolbar .segmented button')).toEqual(['Düzenli İşler', 'Ürün ve Tarifeler', 'Para Birimi ve Vade']);
    expect(api.duzenliIsler).toHaveBeenCalled();
    c.duzenliIsler.set([{ id: 1, isAdi: 'Depo kirası', aktif: true, birimFiyat: 100, kdvOrani: 20, miktar: 1, birim: 'Ay' } as FinansDuzenliIs]);
    fixture.detectChanges();
    expect(el.textContent).toContain('Depo kirası');
    expect(el.textContent).toContain('100.00');
    expect(el.querySelector('.settings-toolbar .btn-primary')).toBeNull();
    expect(el.querySelectorAll('.row-actions button').length).toBe(0);
    c.yeniDuzenliIs(); c.yeniUrun();
    expect(c.duzenliIsAcik()).toBeFalse();
    expect(c.urunAcik()).toBeFalse();
    c.ayarGorunumuDegistir('tarifeler');
    expect(api.urunler).toHaveBeenCalled();
  });

  it('tanımlar W kullanıcısı alt sekmenin W izniyle yeni kayıt ve satır düzenleme düğmelerini görür', () => {
    writes.set(new Set([FINANS_YETKI.SekmeTanimlar, FINANS_YETKI.SekmeTanimlarDuzenli]));
    const { fixture, c, el } = setup();
    c.duzenliIsler.set([{ id: 1, isAdi: 'Depo kirası', aktif: true, birimFiyat: 100, kdvOrani: 20, miktar: 1, birim: 'Ay' } as FinansDuzenliIs]);
    fixture.detectChanges();
    expect(el.querySelector('.settings-toolbar .btn-primary')?.textContent).toContain('Yeni Düzenli İş');
    expect(Array.from(el.querySelectorAll('.row-actions button')).map(x => x.getAttribute('title'))).toEqual(['Düzenle', 'Dönemleri üret']);
    c.yeniDuzenliIs();
    expect(c.duzenliIsAcik()).toBeTrue();
  });

  it('Giderler R kullanıcısı tutarları ve gider raporunu görür; yeni gider, düzenleme ve kaydetme isteği yoktur', () => {
    reads.update(x => new Set([...x, FINANS_YETKI.SekmeGiderler]));
    const { fixture, c, el } = setup('giderler');
    c.giderler.set([gider]); fixture.detectChanges();
    expect(el.textContent).toContain('252.00');
    expect(metinler(el, '.expenses-workspace .toolbar-actions button')).toEqual(['PDF', 'Excel']);
    expect(el.querySelector('.expenses-workspace .row-actions button')).toBeNull();
    c.giderDuzenle(gider); c.giderKaydet();
    expect(c.giderAcik()).toBeFalse();
    expect(api.giderGuncelle).not.toHaveBeenCalled();
  });

  it('Giderler W kullanıcısı yeni gider ve düzenleme düğmelerini görür', () => {
    writes.set(new Set([FINANS_YETKI.SekmeGiderler]));
    const { fixture, c, el } = setup('giderler');
    c.giderler.set([gider]); fixture.detectChanges();
    expect(metinler(el, '.expenses-workspace .toolbar-actions button')).toContain('Yeni Gider');
    expect(el.querySelector('.expenses-workspace .row-actions button[title="Düzenle"]')).not.toBeNull();
    c.giderDuzenle(gider);
    expect(c.giderAcik()).toBeTrue();
  });

  it('tanımlar alt sekmeleri: yalnız okunabilen alt görünümler gösterilir, açılış ilk okunabilendir; işlemler alt sekmenin W iznine bağlıdır', () => {
    reads.update(x => new Set([...x, FINANS_YETKI.SekmeTanimlarTarifeler]));
    writes.set(new Set([FINANS_YETKI.SekmeTanimlar, FINANS_YETKI.SekmeTanimlarParaBirimi]));
    const { fixture, c, el } = setup();
    expect(metinler(el, '.settings-toolbar .segmented button')).toEqual(['Ürün ve Tarifeler', 'Para Birimi ve Vade']);
    expect(c.ayarGorunumu()).toBe('tarifeler');
    expect(api.urunler).toHaveBeenCalled();
    expect(api.duzenliIsler).not.toHaveBeenCalled();
    c.ayarGorunumuDegistir('duzenli');
    expect(c.ayarGorunumu()).toBe('tarifeler');
    // Ürün ve Tarifeler yalnız R: yeni tarife yok; Para Birimi ve Vade W: parametre bileşeni yazılabilir.
    expect(el.querySelector('.settings-toolbar .btn-primary')).toBeNull();
    c.yeniUrun();
    expect(c.urunAcik()).toBeFalse();
    expect(c.tanimYazilabilir('parametreler')).toBeTrue();
    expect(c.tanimYazilabilir('tarifeler')).toBeFalse();

    // Açık alt görünümün izni kalkınca okunabilen ilk alt görünüme geçilir.
    reads.update(x => new Set([...x].filter(k => k !== FINANS_YETKI.SekmeTanimlarTarifeler)));
    fixture.detectChanges();
    expect(c.ayarGorunumu()).toBe('parametreler');
  });

  it('İş Takibi alt sekmeleri: yalnız okunabilen görünümler gösterilir; aylık görünüm kapalıysa aylık liste istenmez', () => {
    reads.set(new Set([FINANS_YETKI.Modul, FINANS_YETKI.SekmeIsTakibi, FINANS_YETKI.SekmeIsTakibiArama, FINANS_YETKI.SekmeIsTakibiBekleyen]));
    const { fixture, c, el } = setup('akis');
    expect(metinler(el, '.workspace-views button')).toEqual(['Tüm dönemlerde ara', 'Bekleyen işler']);
    expect(c.akisAltSekmesi()).toBe('arama');
    expect(api.aylikIsler).not.toHaveBeenCalled();
    c.akisAltSekmesiniAc('aylik');
    expect(c.akisAltSekmesi()).toBe('arama');

    // Aylık görünüm açılınca seçilebilir; açık görünümün izni kalkınca okunabilen ilk görünüme geçilir.
    reads.update(x => new Set([...x, FINANS_YETKI.SekmeIsTakibiAylik]));
    fixture.detectChanges();
    c.akisAltSekmesiniAc('aylik');
    expect(c.akisAltSekmesi()).toBe('aylik');
    expect(api.aylikIsler).toHaveBeenCalled();
    reads.update(x => new Set([...x].filter(k => k !== FINANS_YETKI.SekmeIsTakibiAylik && k !== FINANS_YETKI.SekmeIsTakibiArama)));
    fixture.detectChanges();
    expect(c.akisAltSekmesi()).toBe('bekleyen');
  });

  it('İş Takibi sekmesi alt sekmesi okunamıyorsa görünmez', () => {
    reads.set(new Set([FINANS_YETKI.Modul, FINANS_YETKI.SekmeIsTakibi, FINANS_YETKI.SekmeGiderler]));
    const { el } = setup('akis');
    expect(metinler(el, '.main-tabs button')).toEqual(['Giderler']);
  });

  it('sekme düğümü kapalıysa sekme düğmesi ve gövdesi yoktur; açılış sekmesi erişilebilen ilk sekmedir', () => {
    reads.set(new Set([FINANS_YETKI.Modul, FINANS_YETKI.SekmeGiderler, FINANS_YETKI.VadeUyarisi]));
    const fixture = TestBed.createComponent(FinansYonetimiComponent);
    fixture.detectChanges();
    const c = fixture.componentInstance;
    const el = fixture.nativeElement as HTMLElement;
    const sekmeler = () => metinler(el, '.main-tabs button');
    // Vade uyarısı izni bir sekme açmaz; yalnız Giderler sekme düğümü açıktır.
    expect(sekmeler()).toEqual(['Giderler']);
    expect(c.activeTab()).toBe('giderler');
    c.selectTab('akis');
    expect(c.activeTab()).toBe('giderler');
    expect(api.aylikIsler).not.toHaveBeenCalled();

    // İzin oturumda kaldırılınca açık sekme kapanır ve erişilebilen ilk sekmeye geçilir.
    reads.update(x => new Set([...x, FINANS_YETKI.SekmeIsTakibi, FINANS_YETKI.SekmeIsTakibiAylik]));
    fixture.detectChanges();
    expect(sekmeler()).toEqual(['Finans İş Takibi', 'Giderler']);
    reads.update(x => new Set([...x].filter(k => k !== FINANS_YETKI.SekmeGiderler)));
    fixture.detectChanges();
    expect(c.activeTab()).toBe('akis');
    expect(api.aylikIsler).toHaveBeenCalled();
  });

  it('gider kategorileri sekmesi sekme düğümünün R izniyle açılır (yazma düğmeleri ayrıca W ister)', () => {
    reads.set(new Set([FINANS_YETKI.Modul, FINANS_YETKI.SekmeGiderKategorileri]));
    const fixture = TestBed.createComponent(FinansYonetimiComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.activeTab()).toBe('kategoriler');
    expect(metinler(fixture.nativeElement as HTMLElement, '.main-tabs button')).toEqual(['Gider Kategorileri']);
  });

  it('İş Takibi R kullanıcısı gider ve net dahil bütün tutarları görür; modül izni kalkınca ekran kapanır', () => {
    reads.set(new Set([FINANS_YETKI.Modul, FINANS_YETKI.SekmeIsTakibi, FINANS_YETKI.SekmeIsTakibiAylik]));
    const { fixture, c, el } = setup('akis');
    c.aylikFinansOzeti.set([{ paraBirimi: 'EUR', toplam: 112233, gider: 889977, net: 667788 } as FinansAylikFinansOzeti]);
    fixture.detectChanges();
    expect(el.textContent).toContain('112,233.00');
    expect(el.textContent).toContain('889,977.00');
    expect(el.textContent).toContain('667,788.00');
    reads.set(new Set()); fixture.detectChanges(); expect(el.querySelector('.finance-shell')).toBeNull();
  });
});
