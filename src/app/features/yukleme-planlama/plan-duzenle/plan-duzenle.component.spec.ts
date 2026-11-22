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
  PaginatedList,
  PlanKaynakFarkTuru,
  PlanProjeAdayi,
  PlanYukDurumu,
  PlanYukIzni,
  PlanYukKaynagi,
  PlanYukOnizlemesi,
  PlanYukSatiri,
  YuklemeCalismaBicimi,
  YuklemeLokasyonTercihi,
  YuklemePlaniDetayi,
  YuklemePlaniTanimlari,
  YuklemeProjeKarisimi,
} from '../../../shared/models/index';
import { PlanDuzenleComponent } from './plan-duzenle.component';
import { PlanYerlesimComponent } from './plan-yerlesim.component';

/** Yerleşim kartının (3B dahil) yerine geçen sahte bileşen: bu spec sayfanın seçim, önizleme ve hesap akışını sınar. */
@Component({ selector: 'app-plan-yerlesim', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush, template: '' })
class SahteYerlesimComponent {
  readonly plan = input<unknown>(null);
  readonly yazabilir = input(false);
  readonly kaydedilmemis = input(false);
  readonly hesaplaniyor = input(false);
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
  yukTurleri: [{ id: 1, ad: 'Sandık' }, { id: 2, ad: 'Trafo' }, { id: 3, ad: 'Diğer özel yük' }],
  lokasyonlar: [{ id: 1, ad: '3K' }, { id: 2, ad: 'Seymen' }],
};

const aday = (projeId: number): PlanProjeAdayi =>
  ({ projeId, projeNo: `PA900-0${projeId}`, musteri: 'M', projeTipiId: 1, projeTipiAdi: 'Normal', planaGelecekSandikSayisi: 2 });
const ADAYLAR: PaginatedList<PlanProjeAdayi> = {
  items: [aday(7), aday(8), aday(9)], pageNumber: 1, pageSize: 10, totalCount: 3, totalPages: 1, hasPreviousPage: false, hasNextPage: false,
};

function satir(sandikId: number, projeId: number, ek: Partial<PlanYukSatiri> = {}): PlanYukSatiri {
  return {
    siraNo: sandikId, kaynak: PlanYukKaynagi.Sandik, sandikId, manuelGrupNo: null, birimNo: 1, birimSayisi: 1,
    kod: `PA900-0${projeId}-${sandikId}`, aciklama: null, projeId, projeNo: `PA900-0${projeId}`, yukTuruId: 1, yukTuruAdi: 'Sandık', boyMm: 1000,
    enMm: 1000, yukseklikMm: 1000, brutKg: 500, lokasyonId: 1, lokasyonAdi: '3K', dahil: true, dondurulebilirMi: false, usteKonabilirMi: true,
    altaKalabilirMi: true, ustYukSiniriKg: 500, elleDegisenIzinler: 0, ozelTasimaNotu: null, durum: PlanYukDurumu.Bekliyor, veriSorunlari: [],
    aracNo: null, yerlesimNotu: null, ...ek,
  };
}

const onizleme = (yukler: PlanYukSatiri[], farkliLokasyonSayisi = 1): PlanYukOnizlemesi => ({ yukler, farkliLokasyonSayisi });

function sonuc(ek: Partial<YuklemePlaniDetayi> = {}): YuklemePlaniDetayi {
  return {
    id: 1, planNo: 'YP-2026-000001', ad: 'PA900-07', calismaBicimi: YuklemeCalismaBicimi.IhtiyacaGoreArac, tasimaAilesiId: 1, tasimaAilesiAdi: 'Konteyner',
    projeKarisimi: YuklemeProjeKarisimi.Karisik, lokasyonTercihi: YuklemeLokasyonTercihi.Karisik, yuklemeTarihi: null, aciklama: null,
    revizyonNo: 2, revizyonTarihi: '2026-11-20T10:00:00', kaydeden: null, revizyonAciklamasi: 'Hesaplandı.',
    ayarlar: { yerlesimBosluguMm: null, mevcutAraclar: [], tipIdleri: [3] },
    projeler: [{ projeId: 7, projeNo: 'PA900-07', musteri: 'M', projeTipiId: 1 }, { projeId: 8, projeNo: 'PA900-08', musteri: 'M', projeTipiId: 1 }],
    yukler: [satir(71, 7, { durum: PlanYukDurumu.Yerlesti, aracNo: 1 }), satir(81, 8, { durum: PlanYukDurumu.EksikVeri, veriSorunlari: ['Ölçü giriniz.'] })],
    sayaclar: { toplam: 2, secilen: 2, hesaplanabilir: 1, veriEksik: 1, haricTutulan: 0, yerlesen: 1, yerlesemeyen: 0 },
    kaynakFarklari: [], farkliLokasyonSayisi: 1, yerlesim: null, surenYukleme: null, ...ek,
  };
}

const tamam = <T>(value: T): ApiResult<T> => ({ isSuccess: true, value }) as ApiResult<T>;
const hata = <T>(statusCode: number, error: string): ApiResult<T> => ({ isSuccess: false, statusCode, error }) as ApiResult<T>;

describe('PlanDuzenleComponent (yükleme simülasyonu)', () => {
  let fixture: ComponentFixture<PlanDuzenleComponent>;
  let api: jasmine.SpyObj<YuklemePlanlamaService>;
  let confirm: jasmine.SpyObj<ConfirmService>;
  let toast: jasmine.SpyObj<ToastService>;

  /** `kayit` verilirse sayfa `/yukleme-planlari/:id` ile, verilmezse boş açılır. */
  function kur(secenek: { yazma?: boolean; kayit?: YuklemePlaniDetayi } = {}): PlanDuzenleComponent {
    api = jasmine.createSpyObj<YuklemePlanlamaService>('YuklemePlanlamaService', ['plan', 'tanimlar', 'planHesapla', 'projeAdaylari', 'yukOnizleme']);
    api.tanimlar.and.returnValue(of(tamam(TANIMLAR)));
    api.projeAdaylari.and.returnValue(of(tamam(ADAYLAR)));
    if (secenek.kayit) api.plan.and.returnValue(of(tamam(secenek.kayit)));
    confirm = jasmine.createSpyObj<ConfirmService>('ConfirmService', ['ask']);
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['error', 'success', 'info']);
    TestBed.configureTestingModule({
      imports: [PlanDuzenleComponent],
      providers: [
        provideRouter([]),
        { provide: YuklemePlanlamaService, useValue: api },
        { provide: ToastService, useValue: toast },
        { provide: ConfirmService, useValue: confirm },
        { provide: PermissionService, useValue: { canWrite: () => secenek.yazma ?? true, hasAccess: () => true } },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap(secenek.kayit ? { id: String(secenek.kayit.id) } : {})) } },
      ],
    });
    TestBed.overrideComponent(PlanDuzenleComponent, { remove: { imports: [PlanYerlesimComponent] }, add: { imports: [SahteYerlesimComponent] } });
    fixture = TestBed.createComponent(PlanDuzenleComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  const kok = () => fixture.nativeElement as HTMLElement;
  const hesaplaDugmesi = () => kok().querySelector<HTMLButtonElement>('.ys-hesap__dugme')!;
  const yukSatirlari = () => kok().querySelectorAll('.yp-yukler tbody tr');
  const gorunum = (c: PlanDuzenleComponent, sandikId: number) => c.gorunenler().find((g) => g.satir.sandikId === sandikId)!;
  const sonIstek = () => api.planHesapla.calls.mostRecent().args[0];

  it('boş başlar: kayıt ve önizleme istenmez, liste ve sonuç yoktur, "plan/kaydet/revizyon" yazmaz', () => {
    const c = kur();
    expect(api.plan).not.toHaveBeenCalled();
    expect(api.yukOnizleme).not.toHaveBeenCalled();
    expect(api.projeAdaylari).toHaveBeenCalledOnceWith('', 1, 10);
    expect([c.plan(), c.projeIdleri(), c.satirlar(), c.listeDurumu(), c.tasimaAilesiId()]).toEqual([null, [], [], 'bos', 1]);
    expect(kok().querySelector('h2')?.textContent).toContain('Yükleme Simülasyonu');
    expect(kok().querySelector('app-plan-yerlesim')).toBeNull();
    expect(kok().querySelectorAll('.ys-adaylar tbody tr').length).toBe(3);
    expect(kok().textContent).toContain('Proje seçince sandıklar burada listelenir.');
    const metin = kok().textContent!.toLocaleLowerCase('tr-TR');
    expect(['plan', 'kaydet', 'revizyon'].filter((s) => metin.includes(s))).toEqual([]);
    // Proje seçilmeden hesaplanamaz.
    expect(hesaplaDugmesi().disabled).toBeTrue();
  });

  it('proje seçince yük listesi sunucudan önizlemeyle gelir; seçim boşalınca çağrı atılmaz ve liste boşalır', () => {
    const c = kur();
    api.yukOnizleme.and.returnValues(of(tamam(onizleme([satir(71, 7)]))), of(tamam(onizleme([satir(71, 7), satir(81, 8)], 2))));

    kok().querySelector<HTMLTableRowElement>('.ys-adaylar tbody tr')!.click();
    fixture.detectChanges();
    expect(api.yukOnizleme).toHaveBeenCalledOnceWith([7]);
    expect([yukSatirlari().length, kok().querySelectorAll('.yp-cip').length, c.listeDurumu()]).toEqual([1, 1, 'hazir']);
    expect(hesaplaDugmesi().disabled).toBeFalse();

    c.projeDegistir(aday(8));
    expect(api.yukOnizleme.calls.mostRecent().args[0]).toEqual([7, 8]);
    expect([c.satirlar().length, c.farkliLokasyonSayisi()]).toEqual([2, 2]);

    api.yukOnizleme.and.returnValue(of(tamam(onizleme([satir(81, 8)]))));
    c.projeCikar(c.projeler()[0]);
    expect(api.yukOnizleme.calls.mostRecent().args[0]).toEqual([8]);
    api.yukOnizleme.calls.reset();
    c.projeDegistir(aday(8));
    expect(api.yukOnizleme).not.toHaveBeenCalled();
    expect([c.projeIdleri(), c.satirlar(), c.listeDurumu()]).toEqual([[], [], 'bos']);
  });

  it('proje seçimi hızlı değişirse eski önizleme yanıtı yenisini ezmez', () => {
    const c = kur();
    const ilk = new Subject<ApiResult<PlanYukOnizlemesi>>();
    const ikinci = new Subject<ApiResult<PlanYukOnizlemesi>>();
    api.yukOnizleme.and.returnValues(ilk, ikinci);

    c.projeDegistir(aday(7));
    c.projeDegistir(aday(8));
    expect(c.listeDurumu()).toBe('yukleniyor');
    expect(c.hesapEngeli()).toBe('Yük listesi yükleniyor…');
    ikinci.next(tamam(onizleme([satir(71, 7), satir(81, 8)])));
    ilk.next(tamam(onizleme([satir(71, 7)])));

    expect(ilk.observed).toBeFalse();
    expect(c.satirlar().map((s) => s.sandikId)).toEqual([71, 81]);
  });

  it('önizleme alınamazsa hesap kapalıdır; "Yeniden dene" listeyi yeniden ister', () => {
    const c = kur();
    api.yukOnizleme.and.returnValues(of(hata<PlanYukOnizlemesi>(500, 'Sunucu hatası.')), of(tamam(onizleme([satir(71, 7)]))));
    c.projeDegistir(aday(7));
    fixture.detectChanges();
    expect(toast.error).toHaveBeenCalledOnceWith('Sunucu hatası.');
    expect([c.listeDurumu(), hesaplaDugmesi().disabled]).toEqual(['hata', true]);

    kok().querySelector<HTMLButtonElement>('.ys-baglanti')!.click();
    fixture.detectChanges();
    expect([c.listeDurumu(), yukSatirlari().length, hesaplaDugmesi().disabled]).toEqual(['hazir', 1, false]);
  });

  it('sandıkta yapılan seçim, proje seçimi değişip liste yeniden gelse de sandık listede kaldıkça korunur', () => {
    const c = kur();
    api.yukOnizleme.and.returnValues(
      of(tamam(onizleme([satir(71, 7), satir(72, 7)]))),
      of(tamam(onizleme([satir(71, 7), satir(72, 7, { brutKg: 650, ustYukSiniriKg: 650 }), satir(81, 8)]))),
      of(tamam(onizleme([satir(81, 8)]))),
    );
    c.projeDegistir(aday(7));
    c.dahilDegistir(gorunum(c, 71));
    c.izinDegistir(gorunum(c, 72), 'dondurulebilirMi');

    c.projeDegistir(aday(8));
    const [s71, s72, s81] = c.satirlar();
    expect([s71.dahil, s71.durum]).toEqual([false, PlanYukDurumu.HaricTutuldu]);
    // Elle değişen izin korunur; elle değişmeyen üst yük sınırı ve ağırlık güncel kaynaktan gelir.
    expect([s72.dondurulebilirMi, s72.elleDegisenIzinler, s72.brutKg, s72.ustYukSiniriKg]).toEqual([true, PlanYukIzni.Dondurme, 650, 650]);
    expect([s81.dahil, s81.elleDegisenIzinler]).toEqual([true, 0]);

    // Projesi çıkarılan sandıklar listeden çıkar; seçimleri taşınmaz.
    c.projeCikar(c.projeler()[0]);
    expect(c.satirlar().map((s) => s.sandikId)).toEqual([81]);
  });

  it('Hesapla isteği: yükleme yeri, bütün sandık seçimleri; ilk hesapta kayıt kimliği yok, sonuç sayfada kalır', async () => {
    const c = kur();
    api.yukOnizleme.and.returnValue(of(tamam(onizleme([satir(71, 7), satir(72, 7)], 2))));
    c.projeDegistir(aday(7));
    c.dahilDegistir(gorunum(c, 72));
    fixture.detectChanges();
    const segment = [...kok().querySelectorAll<HTMLButtonElement>('.ys-yer [role="radio"]')];
    expect(segment.map((b) => [b.textContent?.trim(), b.getAttribute('aria-checked')])).toEqual([
      ['Tek yerden yüklenecek', 'true'], ['Lokasyona göre ayrı', 'false'],
    ]);
    segment[1].click();
    fixture.detectChanges();
    expect(kok().querySelector('.ys-yer .yp-ipucu')?.textContent).toContain('lokasyon başına araç sayısını');

    api.planHesapla.and.returnValue(of(tamam(sonuc({
      lokasyonTercihi: YuklemeLokasyonTercihi.LokasyonaGoreAyri,
      projeler: [{ projeId: 7, projeNo: 'PA900-07', musteri: 'M', projeTipiId: 1 }],
      yukler: [satir(71, 7, { durum: PlanYukDurumu.Yerlesti, aracNo: 1 }), satir(72, 7, { dahil: false, durum: PlanYukDurumu.HaricTutuldu })],
    }))));
    hesaplaDugmesi().click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(api.planHesapla).toHaveBeenCalledTimes(1);
    expect(sonIstek()).toEqual({
      planId: null, beklenenRevizyonNo: null, projeIdleri: [7], tasimaAilesiId: 1, lokasyonTercihi: YuklemeLokasyonTercihi.LokasyonaGoreAyri,
      ayarlar: { yerlesimBosluguMm: null, agirlikMerkeziSapmaYuzde: null, mevcutAraclar: [], tipIdleri: [] },
      sandikYukleri: [
        { sandikId: 71, dahil: true, dondurulebilirMi: false, usteKonabilirMi: true, altaKalabilirMi: true, ustYukSiniriKg: 500, elleDegisenIzinler: 0 },
        { sandikId: 72, dahil: false, dondurulebilirMi: false, usteKonabilirMi: true, altaKalabilirMi: true, ustYukSiniriKg: 500, elleDegisenIzinler: 0 },
      ],
      // Elle yük yokken de gider: sunucu boş diziyi "elle yük yok" sayar.
      manuelYukler: [],
    });
    // Liste sunucunun uyguladığı değerlerle güncellenir; sonuç kartı aynı sayfada açılır.
    expect([c.plan()?.id, c.degisti(), c.lokasyonTercihi()]).toEqual([1, false, YuklemeLokasyonTercihi.LokasyonaGoreAyri]);
    expect(c.satirlar().map((s) => [s.sandikId, s.durum])).toEqual([[71, PlanYukDurumu.Yerlesti], [72, PlanYukDurumu.HaricTutuldu]]);
    expect(kok().querySelector('app-plan-yerlesim')).not.toBeNull();
    expect(toast.success).toHaveBeenCalled();
  });

  it('proje kümesi aynıysa son sonucun kimliği ve sırası gider; küme değişince ikisi de boş gider', async () => {
    const c = kur({ kayit: sonuc() });
    c.lokasyonSec(YuklemeLokasyonTercihi.LokasyonaGoreAyri);
    expect(c.degisti()).toBeTrue();
    api.planHesapla.and.returnValue(of(tamam(sonuc({ revizyonNo: 3 }))));
    await c.hesapla();
    expect([sonIstek().planId, sonIstek().beklenenRevizyonNo, sonIstek().projeIdleri]).toEqual([1, 2, [7, 8]]);
    expect([c.plan()?.revizyonNo, c.degisti()]).toEqual([3, false]);

    api.yukOnizleme.and.returnValue(of(tamam(onizleme([satir(71, 7), satir(81, 8), satir(91, 9)]))));
    c.projeDegistir(aday(9));
    expect(c.ayniProjeKumesi()).toBeFalse();
    await c.hesapla();
    expect([sonIstek().planId, sonIstek().beklenenRevizyonNo, sonIstek().projeIdleri]).toEqual([null, null, [7, 8, 9]]);
    expect(sonIstek().sandikYukleri.map((y) => y.sandikId)).toEqual([71, 81, 91]);
  });

  it('bağlantıyla açılan kayıt seçimleri, yük listesini ve sonucu getirir; sandık verisi değiştiyse uyarır', () => {
    const c = kur({ kayit: sonuc({
      lokasyonTercihi: YuklemeLokasyonTercihi.LokasyonaGoreAyri, farkliLokasyonSayisi: 2,
      kaynakFarklari: [{ tur: PlanKaynakFarkTuru.AgirlikDegisti, sandikId: 71, kod: 'PA900-07-71', onceki: '500 kg', guncel: '650 kg' }],
    }) });
    expect(api.plan).toHaveBeenCalledOnceWith(1);
    expect(api.yukOnizleme).not.toHaveBeenCalled();
    expect([c.projeIdleri(), c.lokasyonTercihi(), c.ayarlar().tipIdleri, c.listeDurumu(), c.degisti()])
      .toEqual([[7, 8], YuklemeLokasyonTercihi.LokasyonaGoreAyri, [3], 'hazir', false]);
    expect(yukSatirlari().length).toBe(2);
    expect(kok().querySelector('app-plan-yerlesim')).not.toBeNull();
    expect(kok().querySelector('.yp-farklar')?.textContent).toContain('Sandık verisi son hesaptan sonra değişti (1)');
    // Verisi eksik satır rozetle ve nedeniyle bellidir.
    expect(yukSatirlari()[1].textContent).toContain('Veri eksik');
    expect(yukSatirlari()[1].textContent).toContain('Ölçü giriniz.');
  });

  it('yazma izni yokken Hesapla kapalıdır, yük seçimleri ve araç seçimi kilitlidir; proje seçip listeyi görmek serbesttir', async () => {
    const c = kur({ yazma: false });
    api.yukOnizleme.and.returnValue(of(tamam(onizleme([satir(71, 7)]))));
    kok().querySelector<HTMLTableRowElement>('.ys-adaylar tbody tr')!.click();
    fixture.detectChanges();

    expect(api.yukOnizleme).toHaveBeenCalledOnceWith([7]);
    expect(yukSatirlari().length).toBe(1);
    expect(hesaplaDugmesi().disabled).toBeTrue();
    expect(kok().querySelector('.ys-hesap')?.textContent).toContain('düzenleme yetkisi gerekir');
    expect([...kok().querySelectorAll<HTMLInputElement>('.yp-yukler input')].every((i) => i.disabled)).toBeTrue();
    expect([...kok().querySelectorAll<HTMLButtonElement>('.ps-tip, .ys-yer [role="radio"]')].every((b) => b.disabled)).toBeTrue();
    expect(kok().textContent).not.toContain('Toplu izin düzenle');

    c.dahilDegistir(gorunum(c, 71));
    c.lokasyonSec(YuklemeLokasyonTercihi.LokasyonaGoreAyri);
    await c.hesapla();
    expect([c.satirlar()[0].dahil, c.lokasyonTercihi()]).toEqual([true, YuklemeLokasyonTercihi.Karisik]);
    expect(api.planHesapla).not.toHaveBeenCalled();
  });

  it('başkası arada hesapladıysa (409) sunucunun mesajını gösterir ve ekrandaki sonuç değişmez', async () => {
    const c = kur({ kayit: sonuc() });
    api.planHesapla.and.returnValue(of(hata<YuklemePlaniDetayi>(409, 'Sonuç arada değişti.')));
    await c.hesapla();
    expect(toast.error).toHaveBeenCalledOnceWith('Sonuç arada değişti.');
    expect(c.plan()?.revizyonNo).toBe(2);
  });

  it('seçim değişince bunu belirtir; "Son hesaba dön" seçimleri ve yük listesini son sonuca döndürür', () => {
    const c = kur({ kayit: sonuc() });
    expect(kok().querySelector('.ys-hesap')?.textContent).toContain('Sonuç seçimlerle güncel');

    const bekleyen = new Subject<ApiResult<PlanYukOnizlemesi>>();
    api.yukOnizleme.and.returnValue(bekleyen);
    c.projeCikar(c.projeler()[1]);
    c.ayarlarDegistir({ ...c.ayarlar(), yerlesimBosluguMm: 50 });
    fixture.detectChanges();
    expect(c.degisti()).toBeTrue();
    const dugme = [...kok().querySelectorAll<HTMLButtonElement>('.ys-hesap button')].find((b) => b.textContent?.includes('Son hesaba dön'))!;

    dugme.click();
    // Yolda kalan önizleme yanıtı, geri alınan seçimin listesini ezmez.
    bekleyen.next(tamam(onizleme([satir(71, 7)])));
    expect([c.projeIdleri(), c.ayarlar().yerlesimBosluguMm, c.satirlar().length, c.degisti()]).toEqual([[7, 8], null, 2, false]);
  });

  it('aile değişince tip seçimi sıfırlanır ve seçimler değişmiş sayılır', () => {
    const c = kur({ kayit: sonuc() });
    const aile = kok().querySelector<HTMLSelectElement>('app-plan-secimleri select')!;
    aile.value = aile.options[1].value;
    aile.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect([c.tasimaAilesiId(), c.ayarlar().tipIdleri, c.degisti()]).toEqual([2, [], true]);
    expect([...kok().querySelectorAll('.ps-tip')].map((b) => b.textContent?.trim())).toEqual(['Açık kasa']);
  });

  it('toplu izin düzenle yalnız seçili sandıklara uygulanır; geçersiz üst yük sınırı reddedilir', () => {
    const c = kur();
    api.yukOnizleme.and.returnValue(of(tamam(onizleme([satir(71, 7), satir(72, 7), satir(73, 7)]))));
    c.projeDegistir(aday(7));
    c.secimDegistir(gorunum(c, 71));
    c.secimDegistir(gorunum(c, 73));
    c.topluAc();
    fixture.detectChanges();
    expect(kok().querySelector('#toplu-baslik')?.textContent).toContain('Toplu izin düzenle');
    expect(c.topluAlanlar().map((a) => a.ortak)).toEqual(['Şu an: hepsi açık', 'Şu an: hepsi kapalı', 'Şu an: hepsi açık', 'Şu an: hepsi açık']);

    c.topluAlanDegistir('usteKonma', 'pasif');
    c.topluUstYukTuru.set('deger');
    c.topluUstYukDegistir(-5);
    c.topluUygula();
    expect(toast.error).toHaveBeenCalledOnceWith('Üst yük sınırı sıfır veya pozitif olmalıdır.');
    expect(c.topluAcik()).toBeTrue();

    c.topluUstYukDegistir(1200);
    c.topluUygula();
    expect(c.satirlar().map((s) => [s.usteKonabilirMi, s.ustYukSiniriKg, s.elleDegisenIzinler])).toEqual([
      [false, 1200, PlanYukIzni.UsteKonma | PlanYukIzni.UstYukSiniri], [true, 500, 0], [false, 1200, PlanYukIzni.UsteKonma | PlanYukIzni.UstYukSiniri],
    ]);
    expect([c.topluAcik(), c.degisti()]).toEqual([false, true]);
    fixture.detectChanges();
    // Elle değişen izin hücrede işaretlenir.
    expect(yukSatirlari()[0].querySelectorAll('td.yp-elle').length).toBe(2);
    expect(yukSatirlari()[1].querySelectorAll('td.yp-elle').length).toBe(0);
  });

  it('üst yük sınırı kutusu: geçersiz değer reddedilir ve kutu eski değere döner; boş değer sınırı kaldırır', () => {
    const c = kur();
    api.yukOnizleme.and.returnValue(of(tamam(onizleme([satir(71, 7)]))));
    c.projeDegistir(aday(7));
    fixture.detectChanges();
    const kutu = kok().querySelector<HTMLInputElement>('.yp-ust-yuk')!;

    kutu.value = '-1';
    kutu.dispatchEvent(new Event('change'));
    expect([kutu.value, c.satirlar()[0].ustYukSiniriKg]).toEqual(['500', 500]);
    expect(toast.error).toHaveBeenCalledTimes(1);

    kutu.value = '';
    kutu.dispatchEvent(new Event('change'));
    expect([c.satirlar()[0].ustYukSiniriKg, c.satirlar()[0].elleDegisenIzinler]).toEqual([null, PlanYukIzni.UstYukSiniri]);
    c.varsayilanaDondur(gorunum(c, 71));
    expect([c.satirlar()[0].ustYukSiniriKg, c.satirlar()[0].elleDegisenIzinler]).toEqual([500, 0]);
  });

  it('hesap sürerken ve elle düzenleme açıkken seçimler kilitlenir (yanıt seçimleri sessizce ezmez)', async () => {
    const c = kur({ kayit: sonuc() });
    const yanit = new Subject<ApiResult<YuklemePlaniDetayi>>();
    api.planHesapla.and.returnValue(yanit);
    await c.hesapla();
    expect([c.kilitli(), c.mesgul()]).toEqual([true, true]);
    c.projeDegistir(aday(9));
    c.dahilDegistir(gorunum(c, 71));
    expect([c.projeIdleri(), c.satirlar()[0].dahil]).toEqual([[7, 8], true]);
    expect(api.yukOnizleme).not.toHaveBeenCalled();
    yanit.next(tamam(sonuc({ revizyonNo: 3 })));
    expect(c.kilitli()).toBeFalse();

    const kart = fixture.debugElement.query((d) => d.componentInstance instanceof SahteYerlesimComponent).componentInstance as SahteYerlesimComponent;
    kart.duzenlemeDegisti.emit(true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(c.kilitli()).toBeTrue();
    expect(hesaplaDugmesi().disabled).toBeTrue();
    expect([...kok().querySelectorAll<HTMLButtonElement>('.ps-tip')].every((b) => b.disabled)).toBeTrue();
    kart.duzenlemeDegisti.emit(false);
    expect(c.kilitli()).toBeFalse();
  });

  it('elle düzenlenmiş yerleşim yeniden hesaplanmadan önce sorulur; vazgeçilirse istek atılmaz', async () => {
    const c = kur({ kayit: { ...sonuc(), yerlesim: { elleDuzenlendi: true, araclar: [] } } as unknown as YuklemePlaniDetayi });
    confirm.ask.and.resolveTo(false);
    await c.hesapla();
    expect(confirm.ask.calls.mostRecent().args[0].title).toBe('Yeniden hesapla');
    expect(api.planHesapla).not.toHaveBeenCalled();
  });

  describe('elle yük', () => {
    const elleDugmesi = () => kok().querySelector<HTMLButtonElement>('.ys-elle-ekle');
    const pencere = () => kok().querySelector<HTMLElement>('.ys-elle-pencere');
    const kaydetDugmesi = () => kok().querySelector<HTMLButtonElement>('.ys-elle-kaydet')!;
    const elleSatirlar = () => [...yukSatirlari()].filter((tr) => tr.classList.contains('ys-satir--elle'));
    const elleGorunum = (c: PlanDuzenleComponent) => c.gorunenler().find((g) => g.elle && g.grupBasi)!;

    function doldur(c: PlanDuzenleComponent, ek: { adet?: number; projeId?: number | null; yukTuruId?: number } = {}): void {
      c.elleAlan('kod', 'Ek sandık 1');
      c.elleAlan('aciklama', 'Yedek parça');
      c.elleSayi('boyMm', 1200);
      c.elleSayi('enMm', 800);
      c.elleSayi('yukseklikMm', 900);
      c.elleSayi('brutKg', 450);
      c.elleSayi('adet', ek.adet ?? 2);
      c.elleAlan('yukTuruId', ek.yukTuruId ?? 1);
      c.elleAlan('projeId', ek.projeId === undefined ? 7 : ek.projeId);
      c.elleAlan('lokasyonId', 2);
    }

    /** Proje 7 seçili, iki sandıklı liste. */
    function projeliKur(): PlanDuzenleComponent {
      const c = kur();
      api.yukOnizleme.and.returnValue(of(tamam(onizleme([satir(71, 7), satir(72, 7)]))));
      c.projeDegistir(aday(7));
      fixture.detectChanges();
      return c;
    }

    it('pencere zorunlu alanları, tam sayıyı ve sıfırdan büyük değeri doğrular; hatalıyken listeye eklemez', () => {
      const c = projeliKur();
      elleDugmesi()!.click();
      fixture.detectChanges();
      expect(pencere()?.querySelector('#elle-baslik')?.textContent).toContain('Elle yük ekle');
      // Yük türü varsayılanı Sandık, adet 1; proje seçenekleri yalnız seçili projeler.
      expect([c.elleForm().yukTuruId, c.elleForm().adet]).toEqual([1, 1]);
      expect([...pencere()!.querySelectorAll<HTMLSelectElement>('select')[1].options].map((o) => o.textContent?.trim()))
        .toEqual(['Projesiz', 'PA900-07']);

      kaydetDugmesi().click();
      fixture.detectChanges();
      expect(pencere()).not.toBeNull();
      expect(pencere()!.querySelectorAll('.ys-hata').length).toBe(5);
      expect(c.satirlar().length).toBe(2);

      doldur(c);
      c.elleSayi('boyMm', 1200.5);
      c.elleSayi('brutKg', 0);
      kaydetDugmesi().click();
      fixture.detectChanges();
      expect(c.elleHatalar()).toEqual({ boyMm: 'Tam sayı (mm) girin.', brutKg: 'Sıfırdan büyük olmalı.' });
      expect(c.satirlar().length).toBe(2);

      c.elleAlan('yukTuruId', 2);
      fixture.detectChanges();
      expect(pencere()!.textContent).toContain('lowbed');
    });

    it('eklenen yük adet kadar satırla ve "Elle" rozetiyle listelenir; birimler sandık gibi düzenlenir; sayaçlar sayar', () => {
      const c = projeliKur();
      c.elleEkle();
      doldur(c, { adet: 3 });
      c.elleKaydet();
      fixture.detectChanges();

      expect([c.elleAcik(), c.degisti()]).toEqual([false, true]);
      expect(elleSatirlar().length).toBe(3);
      expect(elleSatirlar().every((tr) => tr.querySelector('.ys-rozet-elle')?.textContent?.includes('Elle'))).toBeTrue();
      expect(elleSatirlar()[0].textContent).toContain('1/3');
      expect(elleSatirlar()[0].textContent).toContain('Seymen');
      // Birimde izinler ve seçim açık (salt okunur değil); düzenle/sil yalnız grubun ilk satırında.
      expect([...elleSatirlar()[1].querySelectorAll<HTMLInputElement>('input')].every((i) => !i.disabled)).toBeTrue();
      expect(elleSatirlar().map((tr) => tr.querySelectorAll('.ys-elle-duzenle').length)).toEqual([1, 0, 0]);
      const [b1] = c.satirlar().filter((s) => s.kaynak === PlanYukKaynagi.Manuel);
      expect([b1.usteKonabilirMi, b1.altaKalabilirMi, b1.dondurulebilirMi, b1.ustYukSiniriKg]).toEqual([true, true, false, 450]);
      c.izinDegistir(c.gorunenler().find((g) => g.anahtar === 'm:1:2')!, 'dondurulebilirMi');
      expect(c.satirlar().find((s) => satirKimligi(s) === 'm:1:2')!.elleDegisenIzinler).toBe(PlanYukIzni.Dondurme);

      expect([c.sayaclar().toplam, c.sayaclar().hesaplanabilir, c.elleBirimSayisi()]).toEqual([5, 5, 3]);
      expect(kok().querySelector('.ys-hesap')?.textContent).toContain('5 yük hesaplanacak (3 elle eklenen dahil)');
      expect(kok().querySelector('.ys-sayac-elle')?.textContent).toContain('3');
    });

    it('grup kalemle dolu pencerede düzenlenir, onaylı silinir; vazgeçilirse kalır', async () => {
      const c = projeliKur();
      c.elleEkle();
      doldur(c);
      c.elleKaydet();
      c.izinDegistir(c.gorunenler().find((g) => g.anahtar === 'm:1:2')!, 'altaKalabilirMi');
      fixture.detectChanges();

      elleSatirlar()[0].querySelector<HTMLButtonElement>('.ys-elle-duzenle')!.click();
      fixture.detectChanges();
      expect(pencere()?.querySelector('#elle-baslik')?.textContent).toContain('Elle yükü düzenle');
      expect(c.elleForm()).toEqual(jasmine.objectContaining({
        grupNo: 1, kod: 'Ek sandık 1', aciklama: 'Yedek parça', boyMm: 1200, enMm: 800, yukseklikMm: 900, brutKg: 450, adet: 2,
        yukTuruId: 1, projeId: 7, lokasyonId: 2,
      }));
      c.elleSayi('adet', 3);
      c.elleSayi('brutKg', 600);
      kaydetDugmesi().click();
      fixture.detectChanges();
      const elleler = c.satirlar().filter((s) => s.kaynak === PlanYukKaynagi.Manuel);
      expect(elleler.map((s) => [s.birimNo, s.birimSayisi, s.brutKg, s.ustYukSiniriKg])).toEqual([[1, 3, 600, 600], [2, 3, 600, 600], [3, 3, 600, 600]]);
      // Elle değişen izin düzenlemede korunur.
      expect([elleler[1].altaKalabilirMi, elleler[1].elleDegisenIzinler]).toEqual([false, PlanYukIzni.AltaKalma]);

      confirm.ask.and.resolveTo(false);
      await c.elleSil(elleGorunum(c));
      expect(confirm.ask.calls.mostRecent().args[0].message).toContain('3 biriminin tamamı');
      expect(c.elleBirimSayisi()).toBe(3);
      confirm.ask.and.resolveTo(true);
      await c.elleSil(elleGorunum(c));
      expect([c.elleBirimSayisi(), c.satirlar().length]).toEqual([0, 2]);
    });

    it('proje seçimi değişip liste yeniden gelince elle yük kalır; projesi çıkarılan yük "Projesiz" olur ve bildirilir', () => {
      const c = projeliKur();
      c.elleEkle();
      doldur(c, { adet: 1 });
      c.elleKaydet();

      api.yukOnizleme.and.returnValue(of(tamam(onizleme([satir(71, 7), satir(81, 8)]))));
      c.projeDegistir(aday(8));
      expect(c.satirlar().map(satirKimligi)).toEqual(['s:71', 's:81', 'm:1:1']);
      expect(toast.info).not.toHaveBeenCalled();

      api.yukOnizleme.and.returnValue(of(tamam(onizleme([satir(81, 8)]))));
      c.projeCikar(c.projeler()[0]);
      expect(c.satirlar().map(satirKimligi)).toEqual(['s:81', 'm:1:1']);
      expect([c.satirlar()[1].projeId, c.satirlar()[1].projeNo]).toEqual([null, null]);
      expect(toast.info).toHaveBeenCalledTimes(1);

      // Bütün projeler çıksa da elle yük listede görünür; hesap için proje gerekir.
      c.projeCikar(c.projeler()[0]);
      fixture.detectChanges();
      expect([c.satirlar().map(satirKimligi), elleSatirlar().length]).toEqual([['m:1:1'], 1]);
      expect(c.hesapEngeli()).toBe('Önce en az bir proje seçin.');
    });

    it('hesap gövdesinde elle yükler gider; yanıttaki elle satırlar grup numarasıyla listeye geri kurulur', async () => {
      const c = projeliKur();
      c.elleEkle();
      doldur(c, { projeId: null });
      c.elleKaydet();
      c.dahilDegistir(c.gorunenler().find((g) => g.anahtar === 'm:1:2')!);

      api.planHesapla.and.returnValue(of(tamam(sonuc({
        projeler: [{ projeId: 7, projeNo: 'PA900-07', musteri: 'M', projeTipiId: 1 }],
        yukler: [
          satir(71, 7), satir(72, 7),
          satir(0, 7, elleSunucu(1, 1, 2, { durum: PlanYukDurumu.Yerlesti, aracNo: 1 })),
          satir(0, 7, elleSunucu(1, 2, 2, { dahil: false, durum: PlanYukDurumu.HaricTutuldu })),
        ],
      }))));
      await c.hesapla();
      expect(sonIstek().manuelYukler).toEqual([{
        kod: 'Ek sandık 1', aciklama: 'Yedek parça', yukTuruId: 1, boyMm: 1200, enMm: 800, yukseklikMm: 900, brutKg: 450, adet: 2,
        projeId: null, lokasyonId: 2, ozelTasimaNotu: null,
        birimler: [
          { birimNo: 1, dahil: true, dondurulebilirMi: false, usteKonabilirMi: true, altaKalabilirMi: true, ustYukSiniriKg: 450, elleDegisenIzinler: 0 },
          { birimNo: 2, dahil: false, dondurulebilirMi: false, usteKonabilirMi: true, altaKalabilirMi: true, ustYukSiniriKg: 450, elleDegisenIzinler: 0 },
        ],
      }]);
      expect(sonIstek().sandikYukleri.map((y) => y.sandikId)).toEqual([71, 72]);
      // Ekrandaki elle satırlar sunucunun döndürdüğüyle değişir.
      const elleler = c.satirlar().filter((s) => s.kaynak === PlanYukKaynagi.Manuel);
      expect(elleler.map((s) => [s.manuelGrupNo, s.birimNo, s.durum, s.aracNo])).toEqual([[1, 1, PlanYukDurumu.Yerlesti, 1], [1, 2, PlanYukDurumu.HaricTutuldu, null]]);
    });

    it('bağlantıyla açılan kayıttaki elle satırlar düzenlenebilir; pencere grubun bilgileriyle açılır', async () => {
      const c = kur({ kayit: sonuc({
        yukler: [satir(71, 7), satir(0, 8, elleSunucu(1, 1, 2)), satir(0, 8, elleSunucu(1, 2, 2)), satir(0, 7, elleSunucu(2, 1, 1, { kod: 'TRAFO-1', yukTuruId: 2 }))],
      }) });
      fixture.detectChanges();
      expect(elleSatirlar().length).toBe(3);
      expect([...elleSatirlar()[0].querySelectorAll<HTMLInputElement>('input')].every((i) => !i.disabled)).toBeTrue();
      expect(elleSatirlar().map((tr) => tr.querySelectorAll('.ys-elle-duzenle').length)).toEqual([1, 0, 1]);

      c.elleDuzenle(elleGorunum(c));
      expect(c.elleForm()).toEqual(jasmine.objectContaining({ grupNo: 1, kod: 'M-1', adet: 2, projeId: 8, boyMm: 1000 }));
      c.elleKapat();

      api.planHesapla.and.returnValue(of(tamam(sonuc())));
      await c.hesapla();
      expect(sonIstek().manuelYukler.map((m) => [m.kod, m.adet, m.projeId, m.birimler.length])).toEqual([['M-1', 2, 8, 2], ['TRAFO-1', 1, 7, 1]]);
    });

    it('yazma izni yokken "Elle yük ekle" ve satırdaki düzenle/sil görünmez', () => {
      kur({ yazma: false, kayit: sonuc({ yukler: [satir(71, 7), satir(0, 7, elleSunucu(1, 1, 1))] }) });
      fixture.detectChanges();
      expect(elleDugmesi()).toBeNull();
      expect(kok().querySelector('.ys-elle-duzenle, .ys-elle-sil')).toBeNull();
      expect(kok().textContent).not.toContain('Elle yük ekle');
      expect(elleSatirlar().length).toBe(1);
    });
  });
});

/** Sunucunun döndürdüğü elle satırın alanları (`kaynak = 2`, grup ve birim). */
function elleSunucu(grupNo: number, birimNo: number, birimSayisi: number, ek: Partial<PlanYukSatiri> = {}): Partial<PlanYukSatiri> {
  return {
    siraNo: 100 + grupNo * 10 + birimNo, kaynak: PlanYukKaynagi.Manuel, sandikId: null, manuelGrupNo: grupNo, birimNo, birimSayisi,
    kod: 'M-1', lokasyonId: null, lokasyonAdi: null, ...ek,
  };
}

function satirKimligi(s: PlanYukSatiri): string {
  return s.kaynak === PlanYukKaynagi.Sandik ? `s:${s.sandikId}` : `m:${s.manuelGrupNo}:${s.birimNo}`;
}
