import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { FinansYonetimiComponent } from './finans-aylik.component';
import { FinansService } from '../../core/services/finans.service';
import { AmbalajService } from '../../core/services/ambalaj.service';
import { PermissionService } from '../../core/services/permission.service';
import { ToastService } from '../../core/services/toast.service';
import { AMBALAJ_YETKI, FINANS_YETKI } from '../../core/constants/yetki-kodlari';
import { FinansAylikFinansOzeti, FinansDuzenliIs, FinansGider } from '../../shared/models/finans.model';

describe('Finans aylık gerçek template negatif yetki kontrolleri', () => {
  const reads = signal(new Set<string>());
  const writes = signal(new Set<string>());
  let api: jasmine.SpyObj<FinansService>;
  beforeEach(() => {
    reads.set(new Set([FINANS_YETKI.Modul])); writes.set(new Set());
    api = jasmine.createSpyObj('FinansService', ['aylikIsler', 'duzenliIsler', 'urunler', 'giderKategorileri', 'giderKalemleri', 'giderGuncelle', 'giderOlustur']);
    const page = { items: [], toplamlar: [], pageNumber: 1, pageSize: 25, totalCount: 0, totalPages: 0, hasPreviousPage: false, hasNextPage: false };
    api.duzenliIsler.and.returnValue(of({ isSuccess: true, value: page }));
    api.urunler.and.returnValue(of({ isSuccess: true, value: page }));
    api.aylikIsler.and.returnValue(of({ isSuccess: true, value: { ...page, finansOzeti: [], grupToplamlari: [] } }));
    api.giderKategorileri.and.returnValue(of({ isSuccess: true, value: [{ id: 1, ad: 'Araç', aktif: true }] }));
    api.giderKalemleri.and.returnValue(of({ isSuccess: true, value: [] }));
    api.giderGuncelle.and.returnValue(of({ isSuccess: false, error: 'Test mutation guard' }));
    TestBed.configureTestingModule({ imports: [FinansYonetimiComponent], providers: [provideRouter([]),
      { provide: FinansService, useValue: api }, { provide: AmbalajService, useValue: {} },
      { provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['success', 'info', 'error']) },
      { provide: PermissionService, useValue: { loaded: signal(true), hasAccess: (k: string) => reads().has(k), canWrite: (k: string) => writes().has(k) } }
    ] });
  });
  function setup() {
    const fixture = TestBed.createComponent(FinansYonetimiComponent);
    fixture.componentInstance.activeTab.set('ayarlar'); fixture.detectChanges();
    return { fixture, c: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
  }
  it('ayarlar izni yoksa navigasyon düğmesini DOMa hiç eklemez', () => {
    const { el } = setup();
    expect(Array.from(el.querySelectorAll('.main-tabs button')).some(x => x.textContent?.includes('İş ve Tarife'))).toBeFalse();
  });
  it('yalnız tarife okuyan kullanıcı düzenli iş altsekmesini veya eski verisini göremez', () => {
    reads.update(x => new Set([...x, FINANS_YETKI.IsKutuphanesiYonet]));
    const { fixture, c, el } = setup(); c.selectTab('ayarlar');
    c.duzenliIsler.set([{ id: 1, isAdi: 'KALAN-GIZLI-IS', aktif: true } as FinansDuzenliIs]);
    c.ayarGorunumu.set('duzenli'); fixture.detectChanges();
    expect(Array.from(el.querySelectorAll('.segmented button')).some(x => x.textContent?.includes('Düzenli İşler'))).toBeFalse();
    expect(el.textContent).not.toContain('KALAN-GIZLI-IS');
    c.ayarGorunumuDegistir('duzenli'); expect(api.duzenliIsler).not.toHaveBeenCalled();
  });
  it('ayarlar R izni yeni kayıt düğmesi veya yazma isteği üretmez', () => {
    reads.update(x => new Set([...x, FINANS_YETKI.DuzenliIsYonet]));
    const { el } = setup();
    expect(el.querySelector('.settings-toolbar .btn-primary')).toBeNull();
  });
  it('maskelenmiş gider fiyatını toplamdan türetip miktarla yeniden çarparak göndermez', () => {
    reads.update(x => new Set([...x, FINANS_YETKI.GiderGoruntule, FINANS_YETKI.ParasalVeriGoruntule, FINANS_YETKI.TutarGoruntule]));
    writes.set(new Set([FINANS_YETKI.GiderDuzenle]));
    const { c } = setup();
    const expense = { id: 4, tarih: '2026-09-19', kategoriId: 1, kategori: 'Araç', aciklama: 'Yakıt',
      miktar: 5, birim: 'Litre', birimFiyat: null, tutar: 210, paraBirimi: 'EUR', kdvOrani: 20,
      kdvDahil: false, projeNo: '', iptalEdildi: false } as unknown as FinansGider;
    c.giderDuzenle(expense); c.giderKaydet();
    expect(api.giderGuncelle).not.toHaveBeenCalled();
  });
  it('gider/kâr ve m³ izinleri kaldırılınca yüklenmiş tutarları DOMdan kaldırır', () => {
    reads.set(new Set([FINANS_YETKI.Modul, FINANS_YETKI.KayitGoruntule, FINANS_YETKI.ParasalVeriGoruntule,
      FINANS_YETKI.TutarGoruntule, FINANS_YETKI.GiderGoruntule, FINANS_YETKI.KarlilikGoruntule,
      AMBALAJ_YETKI.M3Goruntule, AMBALAJ_YETKI.SarfGoruntule]));
    const { fixture, c, el } = setup(); c.activeTab.set('akis');
    c.aylikFinansOzeti.set([{ paraBirimi: 'EUR', gider: 889977, net: 667788 } as FinansAylikFinansOzeti]);
    fixture.detectChanges(); expect(el.textContent).toContain('889,977.00'); expect(el.textContent).toContain('667,788.00');
    reads.update(x => new Set([...x].filter(k => ![FINANS_YETKI.GiderGoruntule, FINANS_YETKI.KarlilikGoruntule, AMBALAJ_YETKI.M3Goruntule, AMBALAJ_YETKI.SarfGoruntule].includes(k as never))));
    fixture.detectChanges(); expect(el.textContent).not.toContain('889,977.00'); expect(el.textContent).not.toContain('667,788.00');
    expect(c.miktarGorebilir('m³')).toBeFalse(); expect(c.miktarGorebilir('Adet')).toBeTrue();
    reads.set(new Set()); fixture.detectChanges(); expect(el.querySelector('.finance-shell')).toBeNull();
  });
});
