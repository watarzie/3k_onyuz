import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { FinansYonetimiComponent } from './finans-aylik.component';
import { FinansService } from '../../../core/services/finans.service';
import { AmbalajService } from '../../../core/services/ambalaj.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { FINANS_YETKI } from '../../../core/constants/yetki-kodlari';
import { FinansTarifeSurumu, FinansUrun } from '../../../shared/models/finans.model';
import { FinansTarifeDuzeltmeOnizleme } from '../../../shared/models/finans-v2.model';

describe('Hatalı tarife düzeltme', () => {
  let api: jasmine.SpyObj<FinansService>;
  let toast: jasmine.SpyObj<ToastService>;
  const okuma = new Set<string>([FINANS_YETKI.Modul, FINANS_YETKI.SekmeTanimlar, FINANS_YETKI.SekmeTanimlarTarifeler]);
  const yazma = new Set<string>();

  const hatali: FinansTarifeSurumu = {
    id: 12, gecerlilikBaslangici: '2026-10-04T00:00:00', gecerlilikBitisi: '2200-12-31T00:00:00',
    birimFiyat: 500, paraBirimi: 'EUR', kdvOrani: 20,
  };
  const urun: FinansUrun = {
    id: 3, kod: '002', ad: 'AĞAÇ KERESTE', fiyatlandirmaBirimi: 2, birimFiyat: 500, paraBirimi: 'EUR', kdvOrani: 20, aktif: true, sira: 0,
    eslesmeler: [], tarifeler: [
      { id: 11, gecerlilikBaslangici: '2026-01-01T00:00:00', gecerlilikBitisi: '2026-10-03T00:00:00', birimFiyat: 565, paraBirimi: 'EUR', kdvOrani: 20 },
      hatali,
    ],
  };
  const onizleme: FinansTarifeDuzeltmeOnizleme = {
    tarifeId: 12, urunId: 3, urunAdi: 'AĞAÇ KERESTE', paraBirimi: 'EUR',
    gecerlilikBaslangici: hatali.gecerlilikBaslangici, gecerlilikBitisi: hatali.gecerlilikBitisi,
    mevcut: { birimFiyat: 500, kdvOrani: 20, netTutar: 1000 }, yeni: { birimFiyat: 565, kdvOrani: 20, netTutar: 1130 },
    duzeltilecekKalemSayisi: 1, korunanKalemSayisi: 1, kalemListesiKisaltildi: false,
    kalemler: [
      { isKaydiId: 2, projeNo: 'PA727-03', isAdi: 'Kereste 2', finansTarihi: '2026-10-04', kaynakTuru: 'AMBALAJURETIM', duzeltilir: false, korunmaNedeni: "PO'ya bağlı", netTutar: 1000 },
      { isKaydiId: 1, projeNo: 'PA727-03', isAdi: 'Kereste 1', finansTarihi: '2026-10-04', kaynakTuru: 'AMBALAJURETIM', duzeltilir: true, korunmaNedeni: null, netTutar: 1000 },
    ],
  };

  beforeEach(() => {
    yazma.clear();
    yazma.add(FINANS_YETKI.SekmeTanimlar);
    yazma.add(FINANS_YETKI.SekmeTanimlarTarifeler);
    api = jasmine.createSpyObj('FinansService', ['aylikIsler', 'urunler', 'giderKategorileri', 'tarifeDuzeltmeOnizle', 'tarifeDuzelt']);
    const sayfa = { items: [], toplamlar: [], pageNumber: 1, pageSize: 25, totalCount: 0, totalPages: 0, hasPreviousPage: false, hasNextPage: false };
    api.aylikIsler.and.returnValue(of({ isSuccess: true, value: { ...sayfa, finansOzeti: [], grupToplamlari: [] } }));
    api.urunler.and.returnValue(of({ isSuccess: true, value: sayfa }));
    api.giderKategorileri.and.returnValue(of({ isSuccess: true, value: [] }));
    api.tarifeDuzeltmeOnizle.and.returnValue(of({ isSuccess: true, value: onizleme }));
    toast = jasmine.createSpyObj('ToastService', ['success', 'info', 'error']);
    TestBed.configureTestingModule({
      imports: [FinansYonetimiComponent],
      providers: [
        provideRouter([]),
        { provide: FinansService, useValue: api },
        { provide: AmbalajService, useValue: {} },
        { provide: ToastService, useValue: toast },
        { provide: ConfirmService, useValue: jasmine.createSpyObj('ConfirmService', ['ask']) },
        {
          provide: PermissionService,
          useValue: { loaded: signal(true), hasAccess: (k: string) => okuma.has(k) || yazma.has(k), canWrite: (k: string) => yazma.has(k) },
        },
      ],
    });
  });

  function duzenlenenTarife() {
    const c = TestBed.createComponent(FinansYonetimiComponent).componentInstance;
    c.urunDuzenle(urun);
    return c;
  }

  it('Ürün ve Tarifeler alt sekmesinde yalnız R izni olan kullanıcı tarife düzeltmesini açamaz', () => {
    // Tanımlar sekmesi W olsa da alt sekmenin W izni yoksa düzenleme yoktur.
    yazma.delete(FINANS_YETKI.SekmeTanimlarTarifeler);
    const c = duzenlenenTarife();

    c.tarifeDuzeltmeAc(hatali);

    expect(c.tarifeDuzeltilebilir()).toBeFalse();
    expect(c.tarifeDuzeltmeSurumu()).toBeNull();
  });

  it('önce etkisi gösterilir; değer değişince önizleme düşer ve gerekçeyle görülen değer uygulanır', () => {
    api.tarifeDuzelt.and.returnValue(of({ isSuccess: true, value: { tarifeId: 12, duzeltilenKalemSayisi: 1, korunanKalemSayisi: 1 } }));
    const c = duzenlenenTarife();

    c.tarifeDuzeltmeAc(hatali);
    expect(c.tarifeDuzeltmeForm).toEqual({ birimFiyat: 500, kdvOrani: 20, aciklama: '' });

    c.tarifeDuzeltmeForm.birimFiyat = 565;
    c.tarifeDuzeltmeOnizle();
    expect(api.tarifeDuzeltmeOnizle).toHaveBeenCalledOnceWith(3, 12, 565, 20);
    expect(c.tarifeDuzeltmeOnizlemesi()).toBe(onizleme);

    // Önizlemeden sonra değer değişirse eski etki geçersizdir; önizleme olmadan uygulanmaz.
    c.tarifeDuzeltmeForm.birimFiyat = 566;
    c.tarifeDuzeltmeDegeriDegisti();
    c.tarifeDuzelt();
    expect(c.tarifeDuzeltmeOnizlemesi()).toBeNull();
    expect(api.tarifeDuzelt).not.toHaveBeenCalled();

    c.tarifeDuzeltmeForm.birimFiyat = 565;
    c.tarifeDuzeltmeOnizle();
    c.tarifeDuzeltmeForm.aciklama = 'kısa';
    c.tarifeDuzelt();
    expect(api.tarifeDuzelt).not.toHaveBeenCalled();
    expect(c.tarifeDuzeltmeHatasi()).toContain('gerekçe');

    c.tarifeDuzeltmeForm.aciklama = '  500 yanlışlıkla girildi  ';
    c.tarifeDuzelt();

    expect(api.tarifeDuzelt).toHaveBeenCalledOnceWith(3, 12, { birimFiyat: 565, kdvOrani: 20, aciklama: '500 yanlışlıkla girildi' });
    expect(c.tarifeDuzeltmeSurumu()).toBeNull();
    expect(c.urunAcik()).toBeFalse();
    expect(toast.success).toHaveBeenCalledWith('Tarife düzeltildi: 1 kalem yeni fiyata çekildi, 1 kalem korundu.');
  });

  it('geçersiz değerde önizleme istenmez; sunucu reddi panelde gösterilir', () => {
    api.tarifeDuzeltmeOnizle.and.returnValue(of({ isSuccess: false, error: 'Yeni birim fiyat ve KDV, sürümün mevcut değerleriyle aynı.' }));
    const c = duzenlenenTarife();
    c.tarifeDuzeltmeAc(hatali);

    c.tarifeDuzeltmeForm.kdvOrani = 120;
    c.tarifeDuzeltmeOnizle();
    expect(api.tarifeDuzeltmeOnizle).not.toHaveBeenCalled();

    c.tarifeDuzeltmeForm.kdvOrani = 20;
    c.tarifeDuzeltmeOnizle();
    expect(c.tarifeDuzeltmeOnizlemesi()).toBeNull();
    expect(c.tarifeDuzeltmeHatasi()).toContain('aynı');
  });

  it('onaya düşen düzeltme başarılı sayılmaz', () => {
    api.tarifeDuzelt.and.returnValue(of({ isSuccess: true, statusCode: 202 }));
    const c = duzenlenenTarife();
    c.tarifeDuzeltmeAc(hatali);
    c.tarifeDuzeltmeForm.birimFiyat = 565;
    c.tarifeDuzeltmeOnizle();
    c.tarifeDuzeltmeForm.aciklama = '500 yanlışlıkla girildi';

    c.tarifeDuzelt();

    expect(toast.info).toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });
});
