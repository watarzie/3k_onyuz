import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { Subject, of } from 'rxjs';
import { AracYuklemeService } from '../../../core/services/arac-yukleme.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  ApiResult,
  AracYuklemeAraci,
  PlanAraci,
  PlanYukKonumu,
  YerlesimGirisYonu,
  YerlesimKontrolSonucu,
  YukCozumSonucu,
  YukCozumu,
  YukIsareti,
  YukIsaretSonucu,
  YuklemeIsaretKaynagi,
  YuklemeOturumDurumu,
} from '../../../shared/models/index';
import { Ekipman3dComponent, Yuk3d } from '../ekipman-kitapligi/ekipman-3d.component';
import { ARAC_YENILEME_MS, AracYuklemeAracComponent } from './arac-yukleme-arac.component';

/** 3B sahnenin (WebGL) yerine geçen sahte bileşen: şablonun verdiği girdileri okumak için. */
@Component({ selector: 'app-ekipman-3d', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush, template: '' })
class Sahte3dComponent {
  readonly veri = input<unknown>(null);
  readonly yukler = input<Yuk3d[]>([]);
  readonly secili = input<string | null>(null);
  readonly gorunenler = input<ReadonlySet<string> | null>(null);
  readonly vurgulular = input<ReadonlySet<string> | null>(null);
  readonly yukSecildi = output<string | null>();
}

function konum(anahtar: string, sira: number, kat = 1): PlanYukKonumu {
  return {
    yukAnahtari: anahtar, kod: anahtar.toUpperCase(), projeNo: 'P1', brutKg: 500, xMm: 30 + (sira - 1) * 1100, yMm: 100, zMm: (kat - 1) * 1000,
    boyMm: 1000, enMm: 1000, yukseklikMm: 1000, donduruldu: false, yuzeyKodu: 'ANA', istifNo: sira, kat, yuklemeSirasi: sira,
    yuklemeYontemi: YerlesimGirisYonu.Arkadan,
  };
}

/** Üç adım, dört yük: 2. adım iki katlı istif grubudur (s:2 altta, s:3 üstte). */
const KONUMLAR = [konum('s:1', 1), konum('s:2', 2), konum('s:3', 2, 2), konum('s:4', 3)];

function planAraci(): PlanAraci {
  return {
    aracNo: 1, konfigurasyonId: 1, revizyonNo: 1, ekipmanKodu: 'K40', ekipmanAdi: '40 ft', aileAdi: 'Konteyner', tipAdi: 'Kapalı', aileDisi: false,
    zorunluOzelEkipman: false, aileDisiGerekce: null, projeNolari: ['P1'], lokasyonlar: ['3K'], konumlar: KONUMLAR, toplamKg: 2000,
    kapasiteKg: 26000, tabanDolulukYuzde: 10, agirlikMerkeziXMm: 500, yukluYukseklikMm: 2591, yukluGenislikMm: 2438, yukluUzunlukMm: 12192,
    solTasmaMm: 0, sagTasmaMm: 0, onTasmaMm: 0, arkaTasmaMm: 0, kontroller: [], sonuc: YerlesimKontrolSonucu.Uygun, yukSorunlari: [],
    teknikVeriJson: '{"disOlcu":{"uzunlukMm":12192,"genislikMm":2438,"yukseklikMm":2591}}',
  };
}

function isaret(id: number, anahtar: string, adimNo: number, ek: Partial<YukIsareti> = {}): YukIsareti {
  return {
    id, yukAnahtari: anahtar, adimNo, kaynak: YuklemeIsaretKaynagi.Barkod, siraDisi: false, yukleyen: 'Ayşe',
    yuklemeTarihi: '2026-11-09T09:10:00', ...ek,
  };
}

function model(isaretler: YukIsareti[], siradakiAdimNo: number | null, durum = YuklemeOturumDurumu.Acik, planDegisti = false): AracYuklemeAraci {
  return {
    planId: 7, planNo: 'YP-2026-000007', planAdi: 'Wasit sevki',
    oturum: {
      id: 5, revizyonNo: 3, durum, baslatan: 'Ayşe', baslamaTarihi: '2026-11-09T08:30:00', kapatan: null, kapanisTarihi: null,
      kapanisGerekcesi: null, aracSayisi: 2, toplamYuk: 14, yuklenenYuk: isaretler.length, planDegisti,
    },
    arac: planAraci(), isaretler, siradakiAdimNo,
  };
}

function cozum(sonuc: YukCozumSonucu, mesaj: string, anahtar: string | null = null): YukCozumu {
  return { sonuc, mesaj, yukAnahtari: anahtar, kod: anahtar?.toUpperCase() ?? null, aracNo: anahtar ? 1 : null, ekipmanKodu: null, adimNo: null, no: null, isaret: null };
}

const tamam = <T>(value: T): ApiResult<T> => ({ isSuccess: true, value }) as ApiResult<T>;
const hata = <T>(error: string): ApiResult<T> => ({ isSuccess: false, error }) as ApiResult<T>;

describe('AracYuklemeAracComponent', () => {
  let api: jasmine.SpyObj<AracYuklemeService>;
  let confirm: jasmine.SpyObj<ConfirmService>;
  let fixture: ComponentFixture<AracYuklemeAracComponent>;

  function kur(ilk: AracYuklemeAraci | null, yazma = true): AracYuklemeAracComponent {
    api = jasmine.createSpyObj<AracYuklemeService>('AracYuklemeService', ['arac', 'cozumle', 'isaretle', 'geriAl']);
    api.arac.and.returnValue(of(ilk ? tamam(ilk) : hata<AracYuklemeAraci>('Yükleme oturumu bulunamadı.')));
    confirm = jasmine.createSpyObj<ConfirmService>('ConfirmService', ['ask', 'askWithReason']);
    TestBed.configureTestingModule({
      imports: [AracYuklemeAracComponent],
      providers: [
        provideRouter([]),
        { provide: AracYuklemeService, useValue: api },
        { provide: ConfirmService, useValue: confirm },
        { provide: ToastService, useValue: jasmine.createSpyObj<ToastService>('ToastService', ['error']) },
        { provide: PermissionService, useValue: { canWrite: (kod: string) => yazma && kod === 'arac-yukleme' } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ oturumId: '5', aracNo: '1' }) } } },
      ],
    });
    TestBed.overrideComponent(AracYuklemeAracComponent, { remove: { imports: [Ekipman3dComponent] }, add: { imports: [Sahte3dComponent] } });
    fixture = TestBed.createComponent(AracYuklemeAracComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  async function okut(c: AracYuklemeAracComponent, barkod: string): Promise<void> {
    c.barkod.set(barkod);
    await c.okut();
  }

  const kok = () => fixture.nativeElement as HTMLElement;

  it('sıradaki adımı, numaraları ve 3B görünümünü işaretlerden türetir', () => {
    const c = kur(model([isaret(31, 's:1', 1), isaret(32, 's:2', 2)], 2));
    expect(api.arac).toHaveBeenCalledOnceWith(5, 1);
    expect(c.satirlar().map((s) => [s.no, s.adimNo, s.konum.yukAnahtari, !!s.isaret])).toEqual([
      [1, 1, 's:1', true], [2, 2, 's:2', true], [3, 2, 's:3', false], [4, 3, 's:4', false],
    ]);
    expect([c.yuklenenYuk(), c.toplamYuk()]).toEqual([2, 4]);
    // İstif grubunun alt katı yüklendi, üst katı bekliyor: adım hâlâ sıradaki, yalnız bekleyen yük parlak.
    expect(c.siradaki()?.adimNo).toBe(2);
    expect([...c.gorunenler()].sort()).toEqual(['s:1', 's:2', 's:3']);
    expect([...c.vurgulular()]).toEqual(['s:3']);

    const sahne = fixture.debugElement.query((d) => d.componentInstance instanceof Sahte3dComponent).componentInstance as Sahte3dComponent;
    expect(sahne.yukler().length).toBe(4);
    expect([...(sahne.vurgulular() ?? [])]).toEqual(['s:3']);
    expect(kok().querySelector('.aa-siradaki')?.textContent).toContain('İstif grubu: 2 kat birlikte yüklenir');
  });

  it('bütün yükler yüklenince sıradaki kartı tamamlandı iletisine döner', () => {
    const c = kur(model(KONUMLAR.map((k, i) => isaret(40 + i, k.yukAnahtari, k.yuklemeSirasi)), null));
    expect(c.siradaki()).toBeNull();
    expect(c.vurgulular().size).toBe(0);
    expect(kok().querySelector('.aa-tamam')?.textContent).toContain('Bu aracın bütün yükleri yüklendi');
  });

  it('sıradaki yükün barkodu okutulunca onay sormadan işaretler ve kutuyu boşaltır', async () => {
    const c = kur(model([], 1));
    api.cozumle.and.returnValue(of(tamam(cozum(YukCozumSonucu.Yuklenebilir, 'S:1: adım 1', 's:1'))));
    api.isaretle.and.returnValue(of(tamam<YukIsaretSonucu>({ zatenYuklendi: false, arac: model([isaret(31, 's:1', 1)], 2) })));
    await okut(c, ' 000000000001 ');
    expect(api.cozumle).toHaveBeenCalledOnceWith(5, '000000000001', 1);
    expect(confirm.ask).not.toHaveBeenCalled();
    expect(api.isaretle).toHaveBeenCalledOnceWith(5, { aracNo: 1, yukAnahtari: 's:1', kaynak: YuklemeIsaretKaynagi.Barkod, siraDisiOnayi: false, barkod: '000000000001' });
    expect(c.bildirim()).toEqual({ ton: 'success', metin: 'S:1 yüklendi.' });
    expect(c.barkod()).toBe('');
    expect(c.arac()?.siradakiAdimNo).toBe(2);
    expect(c.islemde()).toBeFalse();
  });

  it('sıra dışı yük onay ister: vazgeçilirse işaretlenmez, onaylanırsa onay bayrağıyla işaretlenir', async () => {
    const c = kur(model([], 1));
    api.cozumle.and.returnValue(of(tamam(cozum(YukCozumSonucu.SiraDisi, 'Sıradaki yük S:1 (adım 1); S:4 sıra dışı.', 's:4'))));
    confirm.ask.and.resolveTo(false);
    await okut(c, '000000000004');
    expect(confirm.ask.calls.mostRecent().args[0].message).toContain('Sıradaki yük S:1 (adım 1); S:4 sıra dışı.');
    expect(api.isaretle).not.toHaveBeenCalled();
    expect(c.bildirim()).toEqual({ ton: 'warning', metin: 'S:4 işaretlenmedi (sıra dışı).' });

    confirm.ask.and.resolveTo(true);
    api.isaretle.and.returnValue(of(tamam<YukIsaretSonucu>({ zatenYuklendi: false, arac: model([isaret(31, 's:4', 3, { siraDisi: true })], 1) })));
    await okut(c, '000000000004');
    expect(api.isaretle).toHaveBeenCalledOnceWith(5, { aracNo: 1, yukAnahtari: 's:4', kaynak: YuklemeIsaretKaynagi.Barkod, siraDisiOnayi: true, barkod: '000000000004' });
    expect(c.bildirim()?.ton).toBe('success');
    fixture.detectChanges();
    expect(kok().querySelector('tbody tr:nth-child(4)')?.textContent).toContain('Sıra dışı');
  });

  it('başka aracın yükü, plan dışı sandık ve geçersiz barkod işaretlenmez; sunucunun iletisi gösterilir', async () => {
    const c = kur(model([], 1));
    for (const [sonuc, mesaj] of [
      [YukCozumSonucu.BaskaAracta, 'S:9 bu aracın değil: Araç 2 (K40).'],
      [YukCozumSonucu.PlandaYok, 'Bu yük bu yükleme planının yerleşiminde yok.'],
      [YukCozumSonucu.GecersizBarkod, 'Okutulan barkod sandık barkodu değil (12 haneli olmalı).'],
    ] as const) {
      api.cozumle.and.returnValue(of(tamam(cozum(sonuc, mesaj, sonuc === YukCozumSonucu.BaskaAracta ? 's:9' : null))));
      await okut(c, 'X');
      expect(c.bildirim()).toEqual({ ton: 'danger', metin: mesaj });
    }
    expect(confirm.ask).not.toHaveBeenCalled();
    expect(api.isaretle).not.toHaveBeenCalled();
  });

  it('zaten yüklenmiş yük bilgi olarak bildirilir, yeniden işaretlenmez', async () => {
    const c = kur(model([isaret(31, 's:1', 1)], 2));
    api.cozumle.and.returnValue(of(tamam(cozum(YukCozumSonucu.ZatenYuklendi, 'S:1 zaten yüklendi: Araç 1, Ayşe.', 's:1'))));
    await okut(c, '000000000001');
    expect(c.bildirim()).toEqual({ ton: 'info', metin: 'S:1 zaten yüklendi: Araç 1, Ayşe.' });
    expect(api.isaretle).not.toHaveBeenCalled();
  });

  it('çözüm ya da işaretleme reddedilirse (4xx) sunucu iletisi gösterilir ve araç değişmez', async () => {
    const c = kur(model([], 1));
    api.cozumle.and.returnValue(of(hata<YukCozumu>('Yükleme oturumu kapalı.')));
    await okut(c, '000000000001');
    expect(c.bildirim()).toEqual({ ton: 'danger', metin: 'Yükleme oturumu kapalı.' });
    expect(api.isaretle).not.toHaveBeenCalled();

    api.cozumle.and.returnValue(of(tamam(cozum(YukCozumSonucu.Yuklenebilir, '', 's:1'))));
    api.isaretle.and.returnValue(of(hata<YukIsaretSonucu>('Sıra dışı yükleme onay ister.')));
    await okut(c, '000000000001');
    expect(c.bildirim()).toEqual({ ton: 'danger', metin: 'Sıra dışı yükleme onay ister.' });
    expect(c.arac()?.isaretler.length).toBe(0);
    expect(c.islemde()).toBeFalse();
  });

  it('başka tabletin az önce yüklediği yük için yeni kayıt yazılmadığını söyler', async () => {
    const c = kur(model([], 1));
    api.cozumle.and.returnValue(of(tamam(cozum(YukCozumSonucu.Yuklenebilir, '', 's:1'))));
    api.isaretle.and.returnValue(of(tamam<YukIsaretSonucu>({ zatenYuklendi: true, arac: model([isaret(31, 's:1', 1)], 2) })));
    await okut(c, '000000000001');
    expect(c.bildirim()).toEqual({ ton: 'info', metin: 'S:1 zaten yüklenmiş; yeni kayıt yazılmadı.' });
    expect(c.yuklenenYuk()).toBe(1);
  });

  it('boş barkod ve işlem izni olmayan kullanıcı istek atmaz', async () => {
    const yetkili = kur(model([], 1));
    await okut(yetkili, '   ');
    expect(api.cozumle).not.toHaveBeenCalled();

    TestBed.resetTestingModule();
    const izleyen = kur(model([isaret(31, 's:1', 1)], 2), false);
    await okut(izleyen, '000000000002');
    await izleyen.elleIsaretle(izleyen.satirlar()[1]);
    await izleyen.geriAl(izleyen.satirlar()[0]);
    expect(api.cozumle).not.toHaveBeenCalled();
    expect(confirm.ask).not.toHaveBeenCalled();
    expect(confirm.askWithReason).not.toHaveBeenCalled();
    // İzleyen kullanıcı ilerlemeyi görür; okutma kutusu ve satır işlemleri yoktur.
    expect(kok().querySelector('.aa-okut')).toBeNull();
    expect(kok().querySelector('.aa-islem')).toBeNull();
    expect(kok().textContent).toContain('araç yükleme işlem yetkisi gerekir');
    expect(kok().querySelector('tbody tr')?.textContent).toContain('Yüklendi');
  });

  it('kapalı oturum salt okunurdur', async () => {
    const c = kur(model([isaret(31, 's:1', 1)], 2, YuklemeOturumDurumu.Tamamlandi));
    expect(c.yazabilir()).toBeFalse();
    expect(kok().querySelector('.aa-okut')).toBeNull();
    expect(kok().textContent).toContain('Oturum kapalı; kayıt salt okunurdur.');
    await okut(c, '000000000002');
    expect(api.cozumle).not.toHaveBeenCalled();
  });

  it('elle işaret: sıradaki yük bilgi onayıyla, ilerideki yük sıra dışı uyarısı ve onay bayrağıyla gider', async () => {
    const c = kur(model([], 1));
    expect([...kok().querySelectorAll('.aa-islem button')].map((b) => b.textContent?.trim())).toEqual(Array(4).fill('Elle işaretle'));
    confirm.ask.and.resolveTo(true);
    api.isaretle.and.returnValue(of(tamam<YukIsaretSonucu>({ zatenYuklendi: false, arac: model([], 1) })));

    await c.elleIsaretle(c.satirlar()[0]);
    expect(confirm.ask.calls.mostRecent().args[0].type).toBe('info');
    expect(api.isaretle.calls.mostRecent().args).toEqual([5, { aracNo: 1, yukAnahtari: 's:1', kaynak: YuklemeIsaretKaynagi.Elle, siraDisiOnayi: false, barkod: null }]);

    await c.elleIsaretle(c.satirlar()[3]);
    const secenek = confirm.ask.calls.mostRecent().args[0];
    expect(secenek.title).toBe('Sıra dışı yükleme');
    expect(secenek.type).toBe('warning');
    expect(api.isaretle.calls.mostRecent().args).toEqual([5, { aracNo: 1, yukAnahtari: 's:4', kaynak: YuklemeIsaretKaynagi.Elle, siraDisiOnayi: true, barkod: null }]);

    api.isaretle.calls.reset();
    confirm.ask.and.resolveTo(false);
    await c.elleIsaretle(c.satirlar()[1]);
    expect(api.isaretle).not.toHaveBeenCalled();
  });

  it('geri alma gerekçe ister; gerekçe verilmezse istek atılmaz, sunucu reddederse ileti gösterilir', async () => {
    const c = kur(model([isaret(31, 's:1', 1)], 2));
    expect(kok().querySelector('tbody tr .aa-islem button')?.textContent?.trim()).toBe('Geri al');
    confirm.askWithReason.and.resolveTo(null);
    await c.geriAl(c.satirlar()[0]);
    expect(api.geriAl).not.toHaveBeenCalled();

    confirm.askWithReason.and.resolveTo('kısa');
    api.geriAl.and.returnValue(of(hata<AracYuklemeAraci>('Gerekçe en az 5 karakter olmalıdır.')));
    await c.geriAl(c.satirlar()[0]);
    expect(c.bildirim()).toEqual({ ton: 'danger', metin: 'Gerekçe en az 5 karakter olmalıdır.' });
    expect(c.yuklenenYuk()).toBe(1);

    confirm.askWithReason.and.resolveTo('Yanlış sandık okutuldu');
    api.geriAl.and.returnValue(of(tamam(model([], 1))));
    await c.geriAl(c.satirlar()[0]);
    expect(api.geriAl.calls.mostRecent().args).toEqual([5, 31, 'Yanlış sandık okutuldu']);
    expect(c.bildirim()).toEqual({ ton: 'info', metin: 'S:1 işareti geri alındı.' });
    expect(c.yuklenenYuk()).toBe(0);
    // Yüklenmemiş satırda geri alma çalışmaz.
    api.geriAl.calls.reset();
    await c.geriAl(c.satirlar()[0]);
    expect(api.geriAl).not.toHaveBeenCalled();
  });

  it('plan yükleme başladıktan sonra değiştiyse hangi revizyonla sürdüğünü söyler', () => {
    kur(model([], 1, YuklemeOturumDurumu.Acik, true));
    expect(kok().querySelector('.yp-uyari')?.textContent).toContain('Yükleme Revizyon 3 yerleşimiyle sürüyor');
  });

  it('oturum ya da araç bulunamazsa boş durum gösterir; "Araçlar" plan listesine döner', () => {
    const c = kur(null);
    expect(kok().querySelector('.yp-bos')?.textContent).toContain('Yükleme oturumu ya da araç bulunamadı.');
    const git = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    c.araclaraDon();
    expect(git).toHaveBeenCalledOnceWith(['/arac-yukleme']);
  });

  const yuklendi = (...isaretler: YukIsareti[]) => of(tamam<YukIsaretSonucu>({ zatenYuklendi: false, arac: model(isaretler, isaretler.length + 1) }));
  const bekle = () => new Promise<void>((bitti) => setTimeout(bitti));
  const tus = (key: string, hedef: EventTarget = document.body) => {
    const olay = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    hedef.dispatchEvent(olay);
    return olay;
  };

  it('işlem sürerken okutulan barkod kaybolmaz: sıraya girer ve sırayla işlenir', async () => {
    const c = kur(model([], 1));
    const ilkCozum = new Subject<ApiResult<YukCozumu>>();
    api.cozumle.and.returnValues(ilkCozum, of(tamam(cozum(YukCozumSonucu.Yuklenebilir, '', 's:2'))));
    api.isaretle.and.returnValues(yuklendi(isaret(31, 's:1', 1)), yuklendi(isaret(31, 's:1', 1), isaret(32, 's:2', 2)));

    c.barkod.set('000000000001');
    const birinci = c.okut();
    expect(c.islemde()).toBeTrue();
    // İstif grubunun ikinci sandığı, ilki işlenirken okutulur.
    c.barkod.set('000000000002');
    const ikinci = c.okut();
    expect([c.bekleyenOkutma(), c.barkod(), api.cozumle.calls.count()]).toEqual([1, '', 1]);
    fixture.detectChanges();
    expect(kok().querySelector('.aa-okut')?.textContent).toContain('Sırada 1 okutma');

    ilkCozum.next(tamam(cozum(YukCozumSonucu.Yuklenebilir, '', 's:1')));
    ilkCozum.complete();
    await Promise.all([birinci, ikinci]);
    expect(api.cozumle.calls.allArgs()).toEqual([[5, '000000000001', 1], [5, '000000000002', 1]]);
    expect(api.isaretle).toHaveBeenCalledTimes(2);
    // İki sonuç da ekranda kalır (en yenisi üstte).
    expect(c.bildirimler().map((b) => [b.ton, b.metin])).toEqual([['success', 'S:2 yüklendi.'], ['success', 'S:1 yüklendi.']]);
    expect([c.bekleyenOkutma(), c.islemde(), c.yuklenenYuk()]).toEqual([0, false, 2]);
  });

  it('reddedilen okutmanın iletisi sonraki başarılı okutmayla kaybolmaz', async () => {
    const c = kur(model([], 1));
    api.cozumle.and.returnValues(
      of(tamam(cozum(YukCozumSonucu.GecersizBarkod, 'Okutulan barkod sandık barkodu değil (12 haneli olmalı).'))),
      of(tamam(cozum(YukCozumSonucu.Yuklenebilir, '', 's:1'))));
    api.isaretle.and.returnValue(yuklendi(isaret(31, 's:1', 1)));
    await okut(c, 'FCT00967433');
    await okut(c, '000000000001');
    fixture.detectChanges();
    const satirlar = [...kok().querySelectorAll('.aa-bildirim')];
    expect(satirlar.map((s) => s.getAttribute('data-ton'))).toEqual(['success', 'danger']);
    expect(satirlar[1].textContent).toContain('sandık barkodu değil');
  });

  it('okuyucunun Enter\'ı işlem sürerken de okutmayı gönderir; gönder düğmesi işlemle kapanmaz', async () => {
    const c = kur(model([], 1));
    const ilkCozum = new Subject<ApiResult<YukCozumu>>();
    api.cozumle.and.returnValues(ilkCozum, of(tamam(cozum(YukCozumSonucu.ZatenYuklendi, 'S:1 zaten yüklendi.', 's:1'))));
    api.isaretle.and.returnValue(yuklendi(isaret(31, 's:1', 1)));
    const kutu = kok().querySelector<HTMLInputElement>('#aa-barkod')!;

    c.barkod.set('000000000001');
    tus('Enter', kutu);
    c.barkod.set('000000000001');
    fixture.detectChanges();
    expect(c.islemde()).toBeTrue();
    expect(kok().querySelector<HTMLButtonElement>('.aa-okut__dugme')!.disabled).toBeFalse();
    const ikinci = tus('Enter', kutu);
    expect([ikinci.defaultPrevented, c.bekleyenOkutma()]).toEqual([true, 1]);

    ilkCozum.next(tamam(cozum(YukCozumSonucu.Yuklenebilir, '', 's:1')));
    ilkCozum.complete();
    await bekle();
    expect(api.cozumle).toHaveBeenCalledTimes(2);
    expect(c.bildirim()).toEqual({ ton: 'info', metin: 'S:1 zaten yüklendi.' });
  });

  it('odak kutuda değilken okuyucunun yazdıkları yakalanır; yazı alanlarına ve boş Enter\'a dokunulmaz', async () => {
    const c = kur(model([], 1));
    api.cozumle.and.returnValue(of(tamam(cozum(YukCozumSonucu.Yuklenebilir, '', 's:1'))));
    api.isaretle.and.returnValue(yuklendi(isaret(31, 's:1', 1)));
    const dugme = kok().querySelector<HTMLButtonElement>('.aa-islem button')!;

    // Boş kutuda Enter odaktaki düğmenin işidir.
    expect(tus('Enter', dugme).defaultPrevented).toBeFalse();
    expect(api.cozumle).not.toHaveBeenCalled();
    // Gerekçe gibi bir yazı alanına yazılanlar barkod sayılmaz.
    const alan = document.createElement('textarea');
    document.body.appendChild(alan);
    tus('7', alan);
    alan.remove();
    expect(c.barkod()).toBe('');

    // Odak bir düğmedeyken okutma: haneler kutuya girer, Enter düğmeyi tıklamak yerine okutmayı gönderir.
    for (const hane of '000000000001') tus(hane, dugme);
    expect(c.barkod()).toBe('000000000001');
    expect(tus('Enter', dugme).defaultPrevented).toBeTrue();
    await bekle();
    expect(api.cozumle).toHaveBeenCalledOnceWith(5, '000000000001', 1);
    expect(confirm.ask).not.toHaveBeenCalled();
    expect(c.yuklenenYuk()).toBe(1);
  });

  it('işlem izni olmayan kullanıcıda kutunun dışındaki tuşlar yakalanmaz', () => {
    const c = kur(model([], 1), false);
    tus('1');
    expect(tus('Enter').defaultPrevented).toBeFalse();
    expect(c.barkod()).toBe('');
  });

  it('onay penceresi açıkken okutulan barkod pencereyi değiştirmez; karar verilince işlenir', async () => {
    const c = kur(model([], 1));
    let karar!: (onay: boolean) => void;
    confirm.ask.and.returnValue(new Promise<boolean>((coz) => (karar = coz)));
    api.cozumle.and.returnValue(of(tamam(cozum(YukCozumSonucu.Yuklenebilir, '', 's:1'))));
    api.isaretle.and.returnValue(yuklendi(isaret(31, 's:1', 1)));

    const elle = c.elleIsaretle(c.satirlar()[2]);
    expect(c.islemde()).toBeTrue();
    await okut(c, '000000000001');
    // Okutma bekler: ikinci bir onay açılmaz, istek atılmaz.
    expect([confirm.ask.calls.count(), api.cozumle.calls.count(), c.bekleyenOkutma()]).toEqual([1, 0, 1]);
    // Aynı anda ikinci bir satır işlemi de başlamaz.
    await c.elleIsaretle(c.satirlar()[3]);
    expect(confirm.ask).toHaveBeenCalledTimes(1);

    karar(false);
    await elle;
    expect(api.cozumle).toHaveBeenCalledOnceWith(5, '000000000001', 1);
    expect(api.isaretle.calls.mostRecent().args[1].yukAnahtari).toBe('s:1');
    expect([c.bekleyenOkutma(), c.islemde()]).toEqual([0, false]);
  });

  it('reddedilen işaretlemeden sonra aracı yeniden okur (başka tabletin değişikliği görünsün)', async () => {
    const c = kur(model([], 1));
    api.cozumle.and.returnValue(of(tamam(cozum(YukCozumSonucu.Yuklenebilir, '', 's:2'))));
    api.isaretle.and.returnValue(of(hata<YukIsaretSonucu>('Sıradaki yük S:1 (adım 1); S:2 sıra dışı. Sıra dışı yükleme onay ister.')));
    api.arac.and.returnValue(of(tamam(model([isaret(40, 's:4', 3, { siraDisi: true })], 1))));
    await okut(c, '000000000002');
    expect(api.arac).toHaveBeenCalledTimes(2);
    expect(c.bildirim()?.ton).toBe('danger');
    expect(c.arac()?.isaretler.map((i) => i.yukAnahtari)).toEqual(['s:4']);
  });

  it('işlem başlayınca uçuştaki yenileme iptal edilir: eski yanıt yeni işareti ezmez', fakeAsync(() => {
    const c = kur(model([], 1));
    tick();
    const gecikenYenileme = new Subject<ApiResult<AracYuklemeAraci>>();
    api.arac.and.returnValue(gecikenYenileme);
    tick(ARAC_YENILEME_MS);
    expect(api.arac).toHaveBeenCalledTimes(2);

    api.cozumle.and.returnValue(of(tamam(cozum(YukCozumSonucu.Yuklenebilir, '', 's:1'))));
    api.isaretle.and.returnValue(yuklendi(isaret(31, 's:1', 1)));
    c.barkod.set('000000000001');
    void c.okut();
    tick();
    expect(c.yuklenenYuk()).toBe(1);
    // İşaretten önce okunmuş eski durum geç gelir.
    gecikenYenileme.next(tamam(model([], 1)));
    tick();
    expect(c.yuklenenYuk()).toBe(1);
    fixture.destroy();
  }));

  it('yenilemede bir şey değişmediyse araç yerinde kalır (3B sahne yeniden kurulmaz)', fakeAsync(() => {
    const c = kur(model([isaret(31, 's:1', 1)], 2));
    tick();
    const ilk = c.arac();
    api.arac.and.returnValue(of(tamam(model([isaret(31, 's:1', 1)], 2))));
    tick(ARAC_YENILEME_MS);
    expect(api.arac).toHaveBeenCalledTimes(2);
    expect(c.arac()).toBe(ilk);
    fixture.destroy();
  }));

  it('ilk yükleme başarısızsa yeniden denenebilir', () => {
    const c = kur(null);
    api.arac.and.returnValue(of(tamam(model([], 1))));
    [...kok().querySelectorAll<HTMLButtonElement>('.yp-bos button')].find((b) => b.textContent?.includes('Yeniden dene'))!.click();
    fixture.detectChanges();
    expect(c.arac()?.planNo).toBe('YP-2026-000007');
    expect(kok().querySelector('.aa-okut')).not.toBeNull();
  });

  it('süren oturumda aracı aralıkla yeniler; kapalı oturumda istek atmaz', fakeAsync(() => {
    const c = kur(model([], 1));
    tick();
    api.arac.and.returnValue(of(tamam(model([isaret(31, 's:1', 1)], 2))));
    tick(ARAC_YENILEME_MS);
    expect(api.arac).toHaveBeenCalledTimes(2);
    expect(c.yuklenenYuk()).toBe(1);
    fixture.destroy();

    TestBed.resetTestingModule();
    kur(model([], 1, YuklemeOturumDurumu.IptalEdildi));
    tick(ARAC_YENILEME_MS * 2);
    expect(api.arac).toHaveBeenCalledTimes(1);
    fixture.destroy();
  }));
});
