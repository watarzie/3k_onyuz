import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { YETKI } from '../../../core/constants/yetki-kodlari';
import { PermissionService } from '../../../core/services/permission.service';
import { ToastService } from '../../../core/services/toast.service';
import { YuklemePlanlamaService } from '../../../core/services/yukleme-planlama.service';
import {
  ApiResult,
  EkipmanAilesiModeli,
  EkipmanDogrulamaDurumu,
  EkipmanKategorisi,
  EkipmanKaynakTuru,
  EkipmanKonfigurasyonDetayi,
  EkipmanKonfigurasyonOzeti,
  EkipmanTeknikVerisi,
  PaginatedList,
  YuklemeYontemi,
} from '../../../shared/models/index';
import { Ekipman3dComponent } from './ekipman-3d.component';
import { EkipmanDuzenleComponent } from './ekipman-duzenle.component';
import { EkipmanKitapligiComponent } from './ekipman-kitapligi.component';

@Component({ selector: 'app-ekipman-3d', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush, template: '' })
class Sahte3dComponent {
  readonly veri = input<EkipmanTeknikVerisi | null>(null);
}

/** Düzenleme formunun yerine geçen sahte bileşen: üst ekranın verdiği girdileri ve dinlediği olayları sınamak için. */
@Component({ selector: 'app-ekipman-duzenle', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush, template: '' })
class SahteDuzenleComponent {
  readonly detay = input<EkipmanKonfigurasyonDetayi | null>(null);
  readonly aileler = input.required<EkipmanAilesiModeli[]>();
  readonly kaydedildi = output<EkipmanKonfigurasyonDetayi>();
  readonly kapandi = output<void>();
}

const OZET: EkipmanKonfigurasyonOzeti = {
  id: 7, kod: 'TNT-136', ad: 'Tenteli 13,6 m', aileAdi: 'Tır', tipAdi: 'Tenteli', kategori: EkipmanKategorisi.Tenteli, uretici: 'Jenerik',
  modelAdi: 'Standart', aktif: true, revizyonNo: 3, dogrulamaDurumu: EkipmanDogrulamaDurumu.Dogrulanmadi,
  kaynakTuru: EkipmanKaynakTuru.TasiyiciFoyu, kaynakTarihi: null, disUzunlukMm: 13600, disGenislikMm: 2550, disYukseklikMm: 4000,
  teknikKapasiteKg: 27000,
};

function detay(revizyonNo = 3): EkipmanKonfigurasyonDetayi {
  const revizyon = {
    revizyonNo, kaynakTuru: EkipmanKaynakTuru.TasiyiciFoyu, kaynakAciklama: null, kaynakTarihi: null, aciklama: null,
    dogrulamaDurumu: EkipmanDogrulamaDurumu.Dogrulanmadi, dogrulayan: null, dogrulamaTarihi: null, olusturan: null, tarih: '2026-03-16T09:00:00',
  };
  return {
    id: 7, kod: 'TNT-136', ad: 'Tenteli 13,6 m', aktif: true, aileAdi: 'Tır', tipId: 21, tipKodu: 'TENTELI', tipAdi: 'Tenteli',
    kategori: EkipmanKategorisi.Tenteli, yuklemeYontemleri: YuklemeYontemi.Arkadan, sandikTasimayaUygun: true, uretici: 'Jenerik',
    modelAdi: 'Standart', revizyon, teknikVeriJson: '{"semaSurumu":1,"yuzeyler":[]}', veriUyarilari: [], revizyonlar: [revizyon],
  };
}

const AILELER_YANITI: ApiResult<EkipmanAilesiModeli[]> = { isSuccess: true, value: [{ id: 2, kod: 'TIR', ad: 'Tır', sira: 1, tipler: [] }] };

const sayfa = (items: EkipmanKonfigurasyonOzeti[]): PaginatedList<EkipmanKonfigurasyonOzeti> =>
  ({ items, pageNumber: 1, pageSize: 25, totalCount: items.length, totalPages: 1, hasPreviousPage: false, hasNextPage: false });

describe('EkipmanKitapligiComponent ekrandan ekleme ve düzenleme', () => {
  let api: jasmine.SpyObj<YuklemePlanlamaService>;
  let toast: jasmine.SpyObj<ToastService>;
  let fixture: ComponentFixture<EkipmanKitapligiComponent>;

  function kur(yazmaIzinleri: string[], ailelerYanit: ApiResult<EkipmanAilesiModeli[]> = AILELER_YANITI): EkipmanKitapligiComponent {
    api = jasmine.createSpyObj<YuklemePlanlamaService>('YuklemePlanlamaService', ['ekipmanAileleri', 'konfigurasyonlar', 'konfigurasyon']);
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error']);
    api.ekipmanAileleri.and.returnValue(of(ailelerYanit));
    api.konfigurasyonlar.and.returnValue(of({ isSuccess: true, value: sayfa([OZET]) }));
    api.konfigurasyon.and.returnValue(of({ isSuccess: true, value: detay() }));
    TestBed.configureTestingModule({
      imports: [EkipmanKitapligiComponent],
      providers: [
        provideRouter([]),
        { provide: YuklemePlanlamaService, useValue: api },
        { provide: ToastService, useValue: toast },
        { provide: PermissionService, useValue: { canWrite: (kod: string) => yazmaIzinleri.includes(kod) } },
      ],
    });
    TestBed.overrideComponent(EkipmanKitapligiComponent, {
      remove: { imports: [Ekipman3dComponent, EkipmanDuzenleComponent] },
      add: { imports: [Sahte3dComponent, SahteDuzenleComponent] },
    });
    fixture = TestBed.createComponent(EkipmanKitapligiComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  const kok = () => fixture.nativeElement as HTMLElement;
  const form = () => fixture.debugElement.query((d) => d.componentInstance instanceof SahteDuzenleComponent)?.componentInstance as SahteDuzenleComponent | undefined;
  const ayrintiAc = (c: EkipmanKitapligiComponent) => {
    c.ac(OZET);
    fixture.detectChanges();
  };

  it('ekipman-kitapligi W yokken "Yeni ekipman" ve "Düzenle" görünmez; doğrulama düğmesi kendi iznine bağlı kalır', () => {
    const c = kur([YETKI.YUKLEME_PLANLAMA.EKIPMAN_DOGRULAMA]);
    expect(kok().querySelector('[data-yeni-ekipman]')).toBeNull();
    ayrintiAc(c);
    expect(kok().querySelector('#ekipman-baslik')!.textContent).toContain('TNT-136');
    expect(kok().querySelector('[data-duzenle]')).toBeNull();
    expect(kok().textContent).toContain('Revizyonu doğrula');
  });

  it('ekipman-kitapligi W varken düğmeler görünür; doğrulama izni olmadan doğrulama düğmesi yine görünmez', () => {
    const c = kur([YETKI.YUKLEME_PLANLAMA.EKIPMAN_KITAPLIGI]);
    expect(kok().querySelector('[data-yeni-ekipman]')).not.toBeNull();
    ayrintiAc(c);
    expect(kok().querySelector('[data-duzenle]')).not.toBeNull();
    expect(kok().textContent).not.toContain('Revizyonu doğrula');
  });

  it('"Düzenle" formu ekrandaki kayıtla açar; kayıttan sonra ayrıntı güncel kayıtla döner ve liste yenilenir', () => {
    const c = kur([YETKI.YUKLEME_PLANLAMA.EKIPMAN_KITAPLIGI]);
    ayrintiAc(c);
    kok().querySelector<HTMLButtonElement>('[data-duzenle]')!.click();
    fixture.detectChanges();
    expect(form()!.detay()!.id).toBe(7);
    expect(form()!.aileler().map((a) => a.id)).toEqual([2]);
    // Form açıkken ayrıntı penceresi çizilmez.
    expect(kok().querySelector('#ekipman-baslik')).toBeNull();

    form()!.kaydedildi.emit(detay(4));
    fixture.detectChanges();
    expect(form()).toBeUndefined();
    expect(c.detay()!.revizyon.revizyonNo).toBe(4);
    expect(kok().textContent).toContain('Revizyon 4');
    expect(api.konfigurasyonlar).toHaveBeenCalledTimes(2);
  });

  it('düzenleme kaydetmeden kapanınca ayrıntı sunucudan yeniden çekilir; "Düzenle" güncel revizyonla açılır (409 çıkışı)', () => {
    const c = kur([YETKI.YUKLEME_PLANLAMA.EKIPMAN_KITAPLIGI]);
    ayrintiAc(c);
    kok().querySelector<HTMLButtonElement>('[data-duzenle]')!.click();
    fixture.detectChanges();
    expect(form()!.detay()!.revizyon.revizyonNo).toBe(3);

    // Arada başka biri kaydetti: sunucudaki son revizyon 5.
    api.konfigurasyon.and.returnValue(of({ isSuccess: true, value: detay(5) }));
    form()!.kapandi.emit();
    fixture.detectChanges();
    expect(api.konfigurasyon.calls.allArgs()).toEqual([[7], [7]]);
    expect([form(), c.detay()!.revizyon.revizyonNo]).toEqual([undefined, 5]);
    expect(kok().textContent).toContain('Revizyon 5');
    expect(api.konfigurasyonlar).toHaveBeenCalledTimes(1);

    kok().querySelector<HTMLButtonElement>('[data-duzenle]')!.click();
    fixture.detectChanges();
    expect(form()!.detay()!.revizyon.revizyonNo).toBe(5);
  });

  it('kapanış sonrası yeniden çekme başarısızsa hata bildirilir ve ekrandaki ayrıntı kalır', () => {
    const c = kur([YETKI.YUKLEME_PLANLAMA.EKIPMAN_KITAPLIGI]);
    ayrintiAc(c);
    c.duzenle();
    fixture.detectChanges();
    api.konfigurasyon.and.returnValue(of({ isSuccess: false, error: 'Konfigürasyon bulunamadı.', statusCode: 404 }));
    form()!.kapandi.emit();
    fixture.detectChanges();
    expect(toast.error).toHaveBeenCalledOnceWith('Konfigürasyon bulunamadı.');
    expect(c.detay()!.revizyon.revizyonNo).toBe(3);
  });

  it('aileler yüklenemezse hata bildirilir (yeni kayıtta tip seçilemez)', () => {
    const c = kur([YETKI.YUKLEME_PLANLAMA.EKIPMAN_KITAPLIGI], { isSuccess: false, error: 'Sunucuya bağlanılamıyor.' });
    expect(toast.error).toHaveBeenCalledOnceWith('Sunucuya bağlanılamıyor.');
    expect(c.aileler()).toEqual([]);
  });

  it('"Yeni ekipman" boş formu açar; vazgeçilince liste yenilenmez, kayıttan sonra yeni kaydın ayrıntısı açılır', () => {
    const c = kur([YETKI.YUKLEME_PLANLAMA.EKIPMAN_KITAPLIGI]);
    kok().querySelector<HTMLButtonElement>('[data-yeni-ekipman]')!.click();
    fixture.detectChanges();
    expect(form()!.detay()).toBeNull();

    form()!.kapandi.emit();
    fixture.detectChanges();
    expect([form(), c.detay(), api.konfigurasyonlar.calls.count(), api.konfigurasyon.calls.count()]).toEqual([undefined, null, 1, 0]);

    c.yeniEkipman();
    fixture.detectChanges();
    form()!.kaydedildi.emit({ ...detay(1), id: 9, kod: 'LB-3D' });
    fixture.detectChanges();
    expect(kok().querySelector('#ekipman-baslik')!.textContent).toContain('LB-3D');
    expect(api.konfigurasyonlar).toHaveBeenCalledTimes(2);
  });
});
