import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ProjeTipi } from '../../../core/constants/enums';
import { YETKI } from '../../../core/constants/yetki-kodlari';
import { PermissionService } from '../../../core/services/permission.service';
import { SandikService } from '../../../core/services/sandik.service';
import { SevkiyatService } from '../../../core/services/sevkiyat.service';
import { TranslationService } from '../../../core/services/translation.service';
import { ProjeDto, SandikDto, TopluSevkIstegi } from '../../../shared/models';
import { TopluSevkComponent } from './toplu-sevk.component';

describe('Toplu sevk penceresi (tır seferi, C-08)', () => {
  let sandikApi: jasmine.SpyObj<SandikService>;
  let sevkiyatApi: jasmine.SpyObj<SevkiyatService>;
  const yazma = new Set<string>();
  const proje = (id: number, projeTipiId: ProjeTipi, projeNo = `P-${id}`) =>
    ({ id, projeNo, musteri: 'GE', durumMetni: 'Aktif', projeTipiId }) as ProjeDto;
  const sandik = (id: number, sandikNo: string, ek: Partial<SandikDto> = {}) =>
    ({ id, sandikNo, ad: `Sandık ${sandikNo}`, durumId: 3, durumMetni: 'Kapalı', urunSayisi: 2, ...ek }) as SandikDto;
  const normal = proje(1, ProjeTipi.Normal);
  const saha = proje(2, ProjeTipi.Saha);
  const yedek = proje(3, ProjeTipi.Yedek);
  const sandiklar: Record<number, SandikDto[]> = {
    1: [sandik(12, '10'), sandik(11, '2'), sandik(13, '3', { durumId: 2, durumMetni: 'Hazırlanıyor' }), sandik(14, '4', { durumId: 4 })],
    2: [sandik(21, '1', { sahayaAktarildiMi: true })],
    3: [sandik(31, '1')],
  };

  function setup(projeler: ProjeDto[]) {
    sandikApi = jasmine.createSpyObj<SandikService>('SandikService', ['getSandiklar']);
    sandikApi.getSandiklar.and.callFake((id: number) => of({ isSuccess: true, value: sandiklar[id] ?? [] }));
    sevkiyatApi = jasmine.createSpyObj<SevkiyatService>('SevkiyatService', ['topluSevk']);
    sevkiyatApi.topluSevk.and.returnValue(of({ isSuccess: true, value: { seferId: 5, seferNo: '2026-000005', projeSayisi: 1, sandikSayisi: 2 } }));
    TestBed.configureTestingModule({
      imports: [TopluSevkComponent],
      providers: [
        { provide: SandikService, useValue: sandikApi },
        { provide: SevkiyatService, useValue: sevkiyatApi },
        { provide: PermissionService, useValue: { canWrite: (k: string) => yazma.has(k), hasAccess: (k: string) => yazma.has(k) } },
      ],
    });
    TestBed.inject(TranslationService).switchLanguage('tr');
    const fixture = TestBed.createComponent(TopluSevkComponent);
    fixture.componentRef.setInput('projeler', projeler);
    fixture.detectChanges();
    return { fixture, c: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
  }

  function seferiDoldur(c: TopluSevkComponent) {
    c.aracPlaka.set(' 34-abc-123 ');
    c.sofor.set(' Ahmet ');
    c.sevkTarihi.set('2026-10-08T09:30');
  }

  beforeEach(() => {
    yazma.clear();
    yazma.add(YETKI.PROJE.SEVK_ET);
    yazma.add(YETKI.YEDEK.SEVK_ET);
  });

  it('yalnız sevk izni olan tiplerin sandıklarını yükler; sevke hazır sandıklar varsayılan seçilidir', () => {
    const { c, el } = setup([normal, saha, yedek]);
    expect(sandikApi.getSandiklar.calls.allArgs().map(a => a[0])).toEqual([1, 3]);
    expect(c.satirlar().find(s => s.proje.id === 1)!.adaylar.map(s => s.sandikNo)).toEqual(['2', '10']);
    expect(c.satirlar().find(s => s.proje.id === 1)!.digerSandikSayisi).toBe(2);
    expect(c.secimler()[1]).toEqual([11, 12]);
    expect(c.dahilSatirlar().map(s => s.proje.id)).toEqual([1, 3]);
    expect(c.toplamSandik()).toBe(3);
    // Saha projesi: yetki yok → dışarıda, nedeniyle listelenir.
    expect(c.disaridaKalanlar().map(s => s.proje.id)).toEqual([2]);
    expect(el.querySelector('.ts-disarida')?.textContent).toContain('sevk etme yetkiniz yok');
  });

  it('sevke hazır sandığı olmayan proje dışarıda kalır; proje seçimden çıkarılınca sefere girmez', () => {
    yazma.add(YETKI.SAHA.SEVK_ET);
    const { c } = setup([normal, saha]);
    expect(c.disaridaKalanlar().map(s => c.disaridaKalmaNedeni(s))).toEqual(['Sevke hazır kapalı sandık yok.']);
    c.projeDegistir(c.satirlar()[0], false);
    expect(c.dahilSatirlar()).toEqual([]);
    expect(c.engel()).toBe('Sevk edilecek en az bir proje ve sandık seçin.');
  });

  it('plaka boşken gönderilmez; sıralı istek tek seferde gider ve aynı istek aynı işlem anahtarını kullanır', () => {
    const { c, fixture, el } = setup([yedek, normal]);
    expect(c.engel()).toBe('Araç plakası zorunludur.');
    c.gonder();
    expect(sevkiyatApi.topluSevk).not.toHaveBeenCalled();

    seferiDoldur(c);
    c.sandikDegistir(1, 12, false);
    fixture.detectChanges();
    expect(el.querySelector('.ts-plaka + small')?.textContent).toContain('34 ABC 123');
    sevkiyatApi.topluSevk.and.returnValue(of({ isSuccess: false, error: 'Sunucuya bağlanılamıyor.', statusCode: 0 }));
    c.gonder();
    const ilk = sevkiyatApi.topluSevk.calls.mostRecent().args[0] as TopluSevkIstegi;
    expect(ilk).toEqual(jasmine.objectContaining({
      sevkTarihi: '2026-10-08T09:30:00', aracPlaka: '34-abc-123', sofor: 'Ahmet', dorsePlaka: undefined, aciklama: undefined,
      projeler: [{ projeId: 1, sandikIds: [11] }, { projeId: 3, sandikIds: [31] }],
    }));
    expect(ilk.islemAnahtari).toMatch(/^[0-9a-f-]{36}$/);

    c.gonder();
    expect((sevkiyatApi.topluSevk.calls.mostRecent().args[0] as TopluSevkIstegi).islemAnahtari).toBe(ilk.islemAnahtari);
    c.sandikDegistir(1, 12, true);
    c.gonder();
    expect((sevkiyatApi.topluSevk.calls.mostRecent().args[0] as TopluSevkIstegi).islemAnahtari).not.toBe(ilk.islemAnahtari);
  });

  it('409 engellerini proje ve sandık bazında gösterir; hiçbir şey sevk edilmiş sayılmaz', () => {
    const { c, fixture, el } = setup([normal, yedek]);
    const sevkEdildi = jasmine.createSpy('sevkEdildi');
    c.sevkEdildi.subscribe(sevkEdildi);
    seferiDoldur(c);
    c.acikProjeler.set(new Set());
    sevkiyatApi.topluSevk.and.returnValue(of({
      isSuccess: false, statusCode: 409, error: '1 projede sevk engeli var; hiçbir proje sevk edilmedi.',
      issues: [{ projeId: 1, projeNo: 'P-1', sandikIds: [12], mesaj: 'Kapanmamış sandık sevk edilemez.' }],
    }));
    c.gonder();
    fixture.detectChanges();

    expect(sevkEdildi).not.toHaveBeenCalled();
    expect(el.querySelector('.ts-sorunlar')?.textContent).toContain('hiçbir proje sevk edilmedi');
    expect(el.querySelector('.ts-sorunlar li')?.textContent).toContain('P-1');
    expect(c.acikProjeler().has(1)).toBeTrue();
    expect(el.querySelector('[data-proje-id="1"]')?.classList).toContain('has-issue');
    expect(el.querySelectorAll('.ts-sandik.has-issue').length).toBe(1);
  });

  it('başarıda sonucu bildirir; ağ hatasında tekrar denemenin güvenli olduğunu söyler', () => {
    const { c } = setup([normal]);
    const sevkEdildi = jasmine.createSpy('sevkEdildi');
    c.sevkEdildi.subscribe(sevkEdildi);
    seferiDoldur(c);
    sevkiyatApi.topluSevk.and.returnValue(throwError(() => new Error('ağ')));
    c.gonder();
    expect(c.hata()).toContain('iki kez oluşmaz');
    expect(c.gonderiliyor()).toBeFalse();

    sevkiyatApi.topluSevk.and.returnValue(of({ isSuccess: true, value: { seferId: 5, seferNo: '2026-000005', projeSayisi: 1, sandikSayisi: 2 } }));
    c.gonder();
    expect(sevkEdildi).toHaveBeenCalledOnceWith(jasmine.objectContaining({ seferNo: '2026-000005' }));
  });
});
