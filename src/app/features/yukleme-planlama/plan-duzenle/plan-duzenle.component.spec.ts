import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { Subject, of } from 'rxjs';
import { YuklemePlanlamaService } from '../../../core/services/yukleme-planlama.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import {
  ApiResult,
  PlanYukDurumu,
  PlanYukKaynagi,
  PlanYukSatiri,
  YuklemeCalismaBicimi,
  YuklemeLokasyonTercihi,
  YuklemePlaniDetayi,
  YuklemePlaniTanimlari,
  YuklemeProjeKarisimi,
} from '../../../shared/models/index';
import { PlanDuzenleComponent } from './plan-duzenle.component';
import { PlanYerlesimComponent } from './plan-yerlesim.component';

/** Yerleşim kartının (3B dahil) yerine geçen sahte bileşen: bu spec plan ekranının seçim ve hesap akışını sınar. */
@Component({ selector: 'app-plan-yerlesim', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush, template: '' })
class SahteYerlesimComponent {
  readonly plan = input<unknown>(null);
  readonly yazabilir = input(false);
  readonly kaydedilmemis = input(false);
  readonly hesaplaniyor = input(false);
  readonly hesapla = output<void>();
  readonly elleKaydedildi = output<unknown>();
  readonly duzenlemeDegisti = output<boolean>();
}

const TANIMLAR: YuklemePlaniTanimlari = {
  tasimaAileleri: [{ id: 1, ad: 'Konteyner' }, { id: 2, ad: 'Standart açık kasa / platform' }],
  tasimaTipleri: [
    { id: 2, aileId: 1, ad: "40' standart (DV)", otomatikSecilir: true },
    { id: 3, aileId: 1, ad: "40' High Cube", otomatikSecilir: true },
    { id: 17, aileId: 2, ad: 'Açık kasa', otomatikSecilir: true },
  ],
  yukTurleri: [],
  lokasyonlar: [],
};

function satir(no: string, durum: PlanYukDurumu): PlanYukSatiri {
  return {
    siraNo: Number(no), kaynak: PlanYukKaynagi.Sandik, sandikId: Number(no), manuelGrupNo: null, birimNo: 1, birimSayisi: 1,
    kod: `PA900-01-${no}`, aciklama: null, projeId: 7, projeNo: 'PA900-01', yukTuruId: 1, yukTuruAdi: 'Sandık', boyMm: 1000, enMm: 1000,
    yukseklikMm: 1000, brutKg: 500, lokasyonId: 1, lokasyonAdi: '3K', dahil: true, dondurulebilirMi: false, usteKonabilirMi: true,
    altaKalabilirMi: true, ustYukSiniriKg: 500, elleDegisenIzinler: 0, ozelTasimaNotu: null, durum, veriSorunlari: [], aracNo: null,
    yerlesimNotu: null,
  } as PlanYukSatiri;
}

function plan(revizyonNo = 2, tipIdleri: number[] = [3]): YuklemePlaniDetayi {
  return {
    id: 1, planNo: 'YP-2026-000001', ad: 'PA900-01', calismaBicimi: YuklemeCalismaBicimi.IhtiyacaGoreArac, tasimaAilesiId: 1, tasimaAilesiAdi: 'Konteyner',
    projeKarisimi: YuklemeProjeKarisimi.Karisik, lokasyonTercihi: YuklemeLokasyonTercihi.Karisik, yuklemeTarihi: null, aciklama: null,
    revizyonNo, revizyonTarihi: '2026-11-19T10:00:00', kaydeden: null, revizyonAciklamasi: 'Hesaplandı.',
    ayarlar: { yerlesimBosluguMm: null, mevcutAraclar: [], tipIdleri },
    projeler: [{ projeId: 7, projeNo: 'PA900-01', musteri: 'M', projeTipiId: 1 }, { projeId: 8, projeNo: 'PA900-02', musteri: 'M', projeTipiId: 1 }],
    yukler: [satir('1', PlanYukDurumu.Yerlesti), satir('2', PlanYukDurumu.EksikVeri)],
    sayaclar: { toplam: 2, secilen: 2, hesaplanabilir: 1, veriEksik: 1, haricTutulan: 0, yerlesen: 1, yerlesemeyen: 0 },
    kaynakFarklari: [], farkliLokasyonSayisi: 1, yerlesim: null, surenYukleme: null,
  };
}

const tamam = <T>(value: T): ApiResult<T> => ({ isSuccess: true, value }) as ApiResult<T>;

describe('PlanDuzenleComponent (tek adımlı hesap)', () => {
  let fixture: ComponentFixture<PlanDuzenleComponent>;
  let api: jasmine.SpyObj<YuklemePlanlamaService>;
  let confirm: jasmine.SpyObj<ConfirmService>;
  let toast: jasmine.SpyObj<ToastService>;

  function kur(p: YuklemePlaniDetayi, yazma = true): PlanDuzenleComponent {
    api = jasmine.createSpyObj<YuklemePlanlamaService>('YuklemePlanlamaService', ['plan', 'tanimlar', 'planHesapla', 'projeAdaylari']);
    api.plan.and.returnValue(of(tamam(p)));
    api.tanimlar.and.returnValue(of(tamam(TANIMLAR)));
    confirm = jasmine.createSpyObj<ConfirmService>('ConfirmService', ['ask']);
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['error', 'success']);
    TestBed.configureTestingModule({
      imports: [PlanDuzenleComponent],
      providers: [
        provideRouter([]),
        { provide: YuklemePlanlamaService, useValue: api },
        { provide: ToastService, useValue: toast },
        { provide: ConfirmService, useValue: confirm },
        { provide: PermissionService, useValue: { canWrite: () => yazma, hasAccess: () => true } },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: '1' })) } },
      ],
    });
    TestBed.overrideComponent(PlanDuzenleComponent, { remove: { imports: [PlanYerlesimComponent] }, add: { imports: [SahteYerlesimComponent] } });
    fixture = TestBed.createComponent(PlanDuzenleComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  const kok = () => fixture.nativeElement as HTMLElement;

  it('yük listesi salt okunurdur: kaydet, izin ve elle yük düğmeleri yoktur; sayaçlar sunucudan gelir', () => {
    kur(plan());
    expect(kok().querySelectorAll('.yp-yukler input').length).toBe(0);
    expect(kok().textContent).not.toContain('Kaydet');
    expect(kok().textContent).not.toContain('Elle yük ekle');
    expect(kok().textContent).not.toContain('Toplu izin');
    expect(kok().textContent).not.toContain('Sevkli');
    expect(kok().querySelectorAll('.yp-yukler tbody tr').length).toBe(2);
    expect(kok().querySelectorAll('.ps-tip').length).toBe(2);
  });

  it('Hesapla seçimlerle tek istek atar; sonuç yeni revizyon olarak yerleşir', async () => {
    const c = kur(plan());
    c.ayarlarDegistir({ ...c.ayarlar(), yerlesimBosluguMm: 50, tipIdleri: [2] });
    expect(c.degisti()).toBeTrue();
    api.planHesapla.and.returnValue(of(tamam(plan(3, [2]))));
    await c.hesapla();
    expect(api.planHesapla).toHaveBeenCalledOnceWith(jasmine.objectContaining({
      planId: 1, beklenenRevizyonNo: 2, projeIdleri: [7, 8], tasimaAilesiId: 1,
    }));
    const ayar = api.planHesapla.calls.mostRecent().args[0].ayarlar;
    expect([ayar.yerlesimBosluguMm, ayar.tipIdleri]).toEqual([50, [2]]);
    expect([c.plan()?.revizyonNo, c.degisti()]).toEqual([3, false]);
    expect(toast.success).toHaveBeenCalled();
  });

  it('aile değişince tip seçimi sıfırlanır ve seçimler değişmiş sayılır', () => {
    const c = kur(plan());
    const aile = kok().querySelector<HTMLSelectElement>('app-plan-secimleri select')!;
    aile.value = aile.options[1].value;
    aile.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect([c.tasimaAilesiId(), c.ayarlar().tipIdleri, c.degisti()]).toEqual([2, [], true]);
    expect([...kok().querySelectorAll('.ps-tip')].map((b) => b.textContent?.trim())).toEqual(['Açık kasa']);
  });

  it('proje çıkarma onayla yerelde uygulanır; Vazgeç son hesaba döndürür', async () => {
    const c = kur(plan());
    confirm.ask.and.resolveTo(true);
    await c.projeCikar(c.projeler()[1]);
    // Sunucu verisi onay penceresinde HTML olarak yorumlanmaz.
    expect(confirm.ask.calls.mostRecent().args[0].message).toContain('PA900-02 projesi plandan çıkacak');
    expect([c.projeIdleri(), c.degisti()]).toEqual([[7], true]);
    c.vazgec();
    expect([c.projeIdleri(), c.degisti()]).toEqual([[7, 8], false]);
  });

  it('başkası arada hesapladıysa (409) yenileme ister ve plan değişmez', async () => {
    const c = kur(plan());
    api.planHesapla.and.returnValue(of({ isSuccess: false, statusCode: 409, error: 'Plan arada değişti.' } as ApiResult<YuklemePlaniDetayi>));
    await c.hesapla();
    expect(toast.error).toHaveBeenCalledOnceWith('Sayfayı yenileyip tekrar deneyin. Plan arada değişti.');
    expect(c.plan()?.revizyonNo).toBe(2);
  });

  it('projesi kalmayan planda istek atılmaz; düzenleme izni yoksa seçimler kilitlidir', async () => {
    const c = kur(plan());
    confirm.ask.and.resolveTo(true);
    await c.projeCikar(c.projeler()[0]);
    await c.projeCikar(c.projeler()[0]);
    await c.hesapla();
    expect(api.planHesapla).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledOnceWith('Plana en az bir proje ekleyiniz.');

    TestBed.resetTestingModule();
    kur(plan(), false);
    expect([...kok().querySelectorAll<HTMLButtonElement>('.ps-tip')].every((b) => b.disabled)).toBeTrue();
    expect(kok().textContent).not.toContain('Proje ekle');
  });

  it('hesap sürerken ve elle düzenleme açıkken seçimler kilitlenir (yanıt seçimleri sessizce ezmez)', async () => {
    const c = kur(plan());
    const yanit = new Subject<ApiResult<YuklemePlaniDetayi>>();
    api.planHesapla.and.returnValue(yanit);
    await c.hesapla();
    expect(c.kilitli()).toBeTrue();
    c.adayEkle({ projeId: 9, projeNo: 'PA900-09', musteri: 'M', projeTipiId: 1, projeTipiAdi: 'Normal', planaGelecekSandikSayisi: 1 });
    expect(c.projeIdleri()).toEqual([7, 8]);
    yanit.next(tamam(plan(3)));
    expect(c.kilitli()).toBeFalse();

    const kart = fixture.debugElement.query((d) => d.componentInstance instanceof SahteYerlesimComponent).componentInstance as SahteYerlesimComponent;
    kart.duzenlemeDegisti.emit(true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(c.kilitli()).toBeTrue();
    expect([...kok().querySelectorAll<HTMLButtonElement>('.ps-tip')].every((b) => b.disabled)).toBeTrue();
    kart.duzenlemeDegisti.emit(false);
    expect(c.kilitli()).toBeFalse();
  });

  it('proje eklemek seçimleri değişmiş sayar', () => {
    const c = kur(plan());
    c.adayEkle({ projeId: 9, projeNo: 'PA900-09', musteri: 'M', projeTipiId: 1, projeTipiAdi: 'Normal', planaGelecekSandikSayisi: 1 });
    expect([c.projeIdleri(), c.degisti()]).toEqual([[7, 8, 9], true]);
  });

  it('elle düzenlenmiş yerleşim yeniden hesaplanmadan önce sorulur; vazgeçilirse istek atılmaz', async () => {
    const p = { ...plan(), yerlesim: { elleDuzenlendi: true, araclar: [] } } as unknown as YuklemePlaniDetayi;
    const c = kur(p);
    confirm.ask.and.resolveTo(false);
    await c.hesapla();
    expect(confirm.ask.calls.mostRecent().args[0].title).toBe('Yeniden hesapla');
    expect(api.planHesapla).not.toHaveBeenCalled();
  });
});
