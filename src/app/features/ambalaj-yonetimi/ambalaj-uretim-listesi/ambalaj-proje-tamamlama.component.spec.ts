import { TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AmbalajUretimListesiComponent } from './ambalaj-uretim-listesi.component';
import { AmbalajService } from '../../../core/services/ambalaj.service';
import { AmbalajYasamDongusuService } from '../../../core/services/ambalaj-yasam-dongusu.service';
import { ProjeService } from '../../../core/services/proje.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { TranslationService } from '../../../core/services/translation.service';
import { AmbalajProjeOzetDto, AmbalajUretimPlanDto } from '../../../shared/models';

describe('Ambalaj FB listesinden proje tamamlama ve Üretimi Tamamlanan sekmesi', () => {
  let api: jasmine.SpyObj<AmbalajService>;
  let confirm: jasmine.SpyObj<ConfirmService>;
  const allowed = new Set<string>();
  const proje = {
    projeId: 7, projeNo: 'PA727-03', fbNo: 'FB-1', musteri: 'GE', projeTipiId: 1, projeTipiMetni: 'Normal',
    toplamSandikAdedi: 3, olculuSandikSayisi: 3, eksikOlculuSandikSayisi: 0, eksikOlculuSandiklar: [], toplamHacimM3: 4,
    uretimeAlinanSandikAdedi: 3, ilaveSandikSayisi: 0, icSandikSayisi: 0, uretimHacimM3: 4, projeSandiklariDurumId: 2,
    ilaveSandiklarDurumId: 1, icSandiklarDurumId: 1, projeSandikSayisi: 3, projeSandiklariHacimM3: 4,
    ilaveSandiklarHacimM3: 0, icSandiklarHacimM3: 0, gerekliSandikAdedi: 3, tamamlananSandikAdedi: 1,
  } as AmbalajProjeOzetDto;
  const sayfa = { items: [proje], pageNumber: 1, pageSize: 15, totalCount: 1, totalPages: 1,
    filteredSummary: { projeSayisi: 1, toplamSandikAdedi: 3, toplamHacimM3: 4, eksikOlculuProjeSayisi: 0 } };

  beforeEach(() => {
    allowed.clear();
    // Proje kaynak sandıklı olduğundan sunucu kaynak müdahalesi yazma iznini de ister (ön yüz aynası).
    ['ambalaj-durum-duzenle', 'ambalaj-uretimi-tamamla', 'ambalaj-durumu-geri-al', 'ambalaj-uretimi-yeniden-ac', 'ambalaj-kaynak-mudahalesi'].forEach((x) => allowed.add(x));
    api = jasmine.createSpyObj('AmbalajService', ['getProjeler', 'projeUretimDurumu', 'getIcSandikSablonlari', 'getTalepEdenKullanicilar', 'getProjeSandikSecenekleri', 'getPlan']);
    api.getProjeler.and.returnValue(of({ isSuccess: true, value: sayfa }));
    api.projeUretimDurumu.and.returnValue(of({ isSuccess: true, value: { projeId: 7, degisenKayit: 2, projeDurumu: 3 } }));
    api.getIcSandikSablonlari.and.returnValue(of({ isSuccess: true, value: [] }));
    api.getTalepEdenKullanicilar.and.returnValue(of({ isSuccess: true, value: [] }));
    api.getProjeSandikSecenekleri.and.returnValue(of({ isSuccess: true, value: [
      { id: 61, sandikNo: '6', ad: 'Kaynak', boy: 1000, en: 800, yukseklik: 600, sandikTipi: 'Ahşap Kapalı' },
    ] }));
    confirm = jasmine.createSpyObj('ConfirmService', ['ask', 'askWithReason']);
    confirm.ask.and.returnValue(Promise.resolve(true));
    confirm.askWithReason.and.returnValue(Promise.resolve(''));
    TestBed.configureTestingModule({
      imports: [AmbalajUretimListesiComponent],
      providers: [
        provideRouter([]),
        { provide: AmbalajService, useValue: api },
        { provide: AmbalajYasamDongusuService, useValue: jasmine.createSpyObj('AmbalajYasamDongusuService', ['formlar', 'rapor']) },
        { provide: ProjeService, useValue: { getProjeDropdownListesi: () => of({ isSuccess: true, value: [] }) } },
        { provide: ConfirmService, useValue: confirm },
        { provide: PermissionService, useValue: { loaded: () => true, hasAccess: (k: string) => allowed.has(k), canWrite: (k: string) => allowed.has(k) } },
        { provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['success', 'error', 'info', 'warning']) },
      ],
    });
    TestBed.inject(TranslationService).switchLanguage('tr');
  });

  function setup() {
    const fixture = TestBed.createComponent(AmbalajUretimListesiComponent);
    fixture.detectChanges();
    return { fixture, c: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
  }

  /** Satırın İşlemler menüsünü açar ve metne göre işlem düğmesini döndürür. */
  function islem(fixture: ReturnType<typeof setup>['fixture'], el: HTMLElement, metin: string) {
    if (!el.querySelector('app-islemler-menusu .islemler-panel.acik')) {
      (el.querySelector('app-islemler-menusu .islemler-tetik') as HTMLButtonElement | null)?.click();
      fixture.detectChanges();
    }
    return Array.from(el.querySelectorAll<HTMLButtonElement>('app-islemler-menusu .islemler-panel.acik button')).find(
      (b) => b.textContent?.includes(metin),
    );
  }

  it('Normal sekmede üretim durumu filtresi sunucuya gider; tamamlanan sekmesinde gönderilmez', () => {
    const { c } = setup();
    expect(api.getProjeler.calls.mostRecent().args[0]?.uretimDurumu).toBeUndefined();
    c.uretimDurumuFiltresiDegistir(1);
    expect(api.getProjeler.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({ tamamlanan: false, uretimDurumu: 1, pageNumber: 1 }));
    c.uretimDurumuFiltresiDegistir(2);
    expect(api.getProjeler.calls.mostRecent().args[0]?.uretimDurumu).toBe(2);
    c.aktifKuyrukDegistir('tamamlanan');
    expect(api.getProjeler.calls.mostRecent().args[0]?.uretimDurumu).toBeUndefined();
  });

  it('Normal sekme tamamlananları hariç tutar, Üretimi Tamamlanan sekmesi yalnız onları ister (A3/A4)', () => {
    const { c } = setup();
    expect(api.getProjeler.calls.mostRecent().args[0]?.tamamlanan).toBeFalse();
    c.aktifKuyrukDegistir('tamamlanan');
    expect(api.getProjeler.calls.mostRecent().args[0]?.tamamlanan).toBeTrue();
    expect(c.kuyrukBasligi()).toBe('Üretimi Tamamlanan');
  });

  it('FB listesindeki Tamamla projenin bütün dahil sandıklarını tek istekte tamamlar (A2)', fakeAsync(() => {
    const { fixture, c, el } = setup();
    const buton = islem(fixture, el, 'Üretimi tamamla');
    expect(buton).toBeDefined();
    buton!.click();
    flushMicrotasks();
    fixture.detectChanges();
    expect(confirm.askWithReason).toHaveBeenCalled();
    expect(api.projeUretimDurumu).toHaveBeenCalledWith(7, true, '');
    expect(c.projeTamamlanabilir({ ...proje, tamamlananSandikAdedi: 3 })).toBeFalse();
    allowed.delete('ambalaj-uretimi-tamamla');
    expect(c.projeTamamlanabilir(proje)).toBeFalse();
  }));

  it('kaynak müdahalesi izni yoksa Tamamla görünür ama devre dışıdır; nedeni ipucunda yazılır', () => {
    allowed.delete('ambalaj-kaynak-mudahalesi');
    const { fixture, c, el } = setup();
    const buton = islem(fixture, el, 'Üretimi tamamla');
    expect(buton).toBeDefined();
    expect(buton!.disabled).toBeTrue();
    expect(buton!.title).toContain('kaynak müdahalesi');
    expect(c.projeTamamlanabilir(proje)).toBeFalse();
    expect(api.projeUretimDurumu).not.toHaveBeenCalled();
  });

  it('tamamlama reddindeki engelleyen sandıklar plan çekmecesinde vurgulanır (707-02)', fakeAsync(() => {
    const kalem = {
      id: 11, kaynakSandikId: 41, tur: 1 as const, turMetni: 'Proje Sandığı', uretimeAlindi: true, sandikNo: '1', ad: 'Ana',
      sandikTipi: 'Ahşap Kapalı' as const, adet: 1, boy: 2000, en: 1200, yukseklik: 1800, hacimM3: 1, ambalajaDahilMi: true,
      ambalajKarariOneriliyor: false, uretimDurumu: 2 as const, olcuHazir: true,
    };
    const plan: AmbalajUretimPlanDto = {
      projeId: 7, projeNo: 'PA727-03', musteri: 'GE', projeTipiId: 1, projeTipiMetni: 'Normal', projeSandiklariDurumId: 2,
      ilaveSandiklarDurumId: 1, icSandiklarDurumId: 1, seciliSandikAdedi: 1, seciliHacimM3: 1,
      kalemler: [kalem, { ...kalem, id: 31, kaynakSandikId: 51, tur: 2, turMetni: 'İlave Sandık', sandikNo: '12', uretimeAlindi: false, uretimDurumu: 1 }],
    };
    api.getPlan.and.returnValue(of({ isSuccess: true, value: plan }));
    api.projeUretimDurumu.and.returnValue(of({
      isSuccess: false, statusCode: 409, error: 'Üretim tamamlanamıyor. Üretim formu olmayan: 12 (İlave).',
      issues: [{ kayitId: 31, kaynakSandikId: 51, sandikNo: '12', grupMetni: 'İlave', ozelSandik: false, neden: 'FormYok' as const, mesaj: '12 (İlave): üretim formu yok' }],
    }));
    const { fixture, c, el } = setup();
    islem(fixture, el, 'Üretimi tamamla')!.click();
    flushMicrotasks();
    fixture.detectChanges();

    expect(api.getPlan).toHaveBeenCalledWith(7, undefined, 1);
    expect(c.planOpen()).toBeTrue();
    const vurgulu = el.querySelectorAll('.plan-drawer .crate-table tbody tr.blocking-row');
    expect(vurgulu.length).toBe(1);
    expect(vurgulu[0].textContent).toContain('12');
    expect(vurgulu[0].querySelector('.group-badge')!.textContent).toContain('İlave');
    expect(el.querySelector('.completion-blockers')!.textContent).toContain('12 (İlave): üretim formu yok');
  }));

  it('gerekli sandık sayacı grup kırılımını ipucunda gösterir', () => {
    api.getProjeler.and.returnValue(of({ isSuccess: true, value: { ...sayfa, items: [{ ...proje, gerekliSandikKirilimi: [
      { grup: 'Normal', adet: 2, tamamlananAdet: 1 }, { grup: 'İlave', adet: 1, tamamlananAdet: 0 },
    ] }] } }));
    const { el } = setup();
    expect(el.querySelector('.required-crates')!.getAttribute('title')).toBe('Normal: 1 / 2 · İlave: 0 / 1');
  });

  it('tamamlanan projenin geri alınması gerekçe ister; satır yeşil gösterilir (A3)', () => {
    const { fixture, c, el } = setup();
    c.aktifKuyrukDegistir('tamamlanan');
    fixture.detectChanges();
    expect(el.querySelector('tr.completed-project')).not.toBeNull();
    expect(islem(fixture, el, 'Üretimi tamamla')).toBeUndefined();
    expect(islem(fixture, el, 'Tamamlanmayı geri al')).toBeDefined();
    c.projeGeriAlmaFormunuAc(proje);
    c.projeGeriAl();
    expect(api.projeUretimDurumu).not.toHaveBeenCalled();
    c.geriAlGerekcesi = 'Hatalı tamamlama';
    c.projeGeriAl();
    expect(api.projeUretimDurumu).toHaveBeenCalledWith(7, false, 'Hatalı tamamlama');
    expect(c.geriAlinacakProje()).toBeNull();
  });

  it('özel sandıkta seçilen proje sandığının tipi forma gelir, Kontrplak varsayılanı ezmez (A7)', () => {
    const { c } = setup();
    c.bagimsizFormuAc();
    c.ozelTurDegisti(4);
    c.ozelProjeDegisti(7);
    c.ozelKaynakSandikDegisti(61);
    expect(c.ozelForm.sandikTipi).toBe('Ahşap Kapalı');
    expect(c.ozelForm.sandikNo).toBe('6');
  });
});
