import { ComponentFixture, TestBed } from '@angular/core/testing';
import { YuklemePlanAyarlari, YuklemePlaniTanimlari } from '../../../shared/models/index';
import { PlanSecimleriComponent } from './plan-secimleri.component';

const TANIMLAR: YuklemePlaniTanimlari = {
  tasimaAileleri: [{ id: 1, ad: 'Konteyner' }, { id: 2, ad: 'Standart açık kasa / platform' }, { id: 8, ad: 'Lowbed / ağır yük' }],
  tasimaTipleri: [
    { id: 2, aileId: 1, ad: "40' standart (DV)", otomatikSecilir: true },
    { id: 3, aileId: 1, ad: "40' High Cube", otomatikSecilir: true },
    { id: 13, aileId: 1, ad: "40' Reefer High Cube", otomatikSecilir: false },
    { id: 17, aileId: 2, ad: 'Açık kasa', otomatikSecilir: true },
    { id: 21, aileId: 8, ad: 'Lowbed', otomatikSecilir: true },
  ],
  yukTurleri: [],
  lokasyonlar: [],
};

const AYARLAR: YuklemePlanAyarlari = {
  yerlesimBosluguMm: null, agirlikMerkeziSapmaYuzde: null, mevcutAraclar: [], tipIdleri: [],
};

describe('PlanSecimleriComponent (aile, tip ve yükler arası boşluk)', () => {
  let fixture: ComponentFixture<PlanSecimleriComponent>;
  let ayarlar: YuklemePlanAyarlari[];
  let aileler: number[];

  function kur(aileId: number, a: Partial<YuklemePlanAyarlari> = {}, kilitli = false): PlanSecimleriComponent {
    TestBed.configureTestingModule({ imports: [PlanSecimleriComponent] });
    fixture = TestBed.createComponent(PlanSecimleriComponent);
    fixture.componentRef.setInput('tanimlar', TANIMLAR);
    fixture.componentRef.setInput('aileId', aileId);
    fixture.componentRef.setInput('ayarlar', { ...AYARLAR, ...a });
    fixture.componentRef.setInput('kilitli', kilitli);
    ayarlar = [];
    aileler = [];
    fixture.componentInstance.ayarlarDegisti.subscribe((x) => ayarlar.push(x));
    fixture.componentInstance.aileDegisti.subscribe((x) => aileler.push(x));
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  const tipler = () => [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.ps-tip')];

  it('yalnız seçili ailenin tiplerini gösterir; Reefer "yalnız seçilince" etiketlidir', () => {
    kur(1, { tipIdleri: [3] });
    expect(tipler().map((b) => b.textContent?.trim())).toEqual(["40' standart (DV)", "40' High Cube", "40' Reefer High Cube · yalnız seçilince"]);
    expect(tipler().map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false']);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('yalnız seçilen tiplere');
  });

  it('tipe basmak seçimi açar ve kapatır', () => {
    kur(1, { tipIdleri: [3] });
    tipler()[0].click();
    tipler()[1].click();
    expect(ayarlar.map((a) => a.tipIdleri)).toEqual([[3, 2], []]);
  });

  it('aile değişince yeni aile bildirilir ve önceki ailenin tip seçimi sıfırlanır', () => {
    const c = kur(1, { tipIdleri: [3] });
    c.aileSec(2);
    expect(aileler).toEqual([2]);
    expect(ayarlar.map((a) => a.tipIdleri)).toEqual([[]]);
    // Girdi değişmeden aynı aile yeniden seçilirse bildirim gitmez.
    c.aileSec(1);
    expect(aileler).toEqual([2]);
  });

  it('yalnız isteğe bağlı boşluk alanı vardır; girilen değer yuvarlanır, boşaltılan alan varsayılana (null) döner', () => {
    const c = kur(1, { yerlesimBosluguMm: 40 });
    const kok = fixture.nativeElement as HTMLElement;
    const girdiler = kok.querySelectorAll<HTMLInputElement>('input');
    expect(girdiler.length).toBe(1);
    expect(girdiler[0].placeholder).toBe('30');
    expect(kok.textContent).not.toContain('payı');
    expect(kok.textContent).toContain('boş bırakılırsa 30 mm');
    c.boslukDegistir('25');
    c.boslukDegistir('');
    c.boslukDegistir('12.6');
    expect(ayarlar.map((a) => a.yerlesimBosluguMm)).toEqual([25, null, 13]);
  });

  it('kilitliyken aile, tip ve boşluk değiştirilemez', async () => {
    kur(1, {}, true);
    // ngModel devre dışı bırakmayı bir sonraki turda uygular.
    await fixture.whenStable();
    fixture.detectChanges();
    const kok = fixture.nativeElement as HTMLElement;
    expect(tipler().every((b) => b.disabled)).toBeTrue();
    expect([...kok.querySelectorAll<HTMLInputElement | HTMLSelectElement>('select, input')].every((e) => e.disabled)).toBeTrue();
  });
});
