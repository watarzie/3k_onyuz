import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SurecDurum } from '../../../core/constants/enums';
import { GridDurumSeciciComponent } from './grid-durum-secici.component';
import { KALITE_SECENEKLERI, SUREC_SECENEKLERI, surecDurumRengi } from '../ortak/grid-durumlari';

describe('GridDurumSeciciComponent (süreç)', () => {
  let fixture: ComponentFixture<GridDurumSeciciComponent>;
  let secilen: number[];

  const olustur = (metin: string | null, seciliId: number | null) => {
    TestBed.configureTestingModule({ imports: [GridDurumSeciciComponent] });
    fixture = TestBed.createComponent(GridDurumSeciciComponent);
    fixture.componentRef.setInput('secenekler', SUREC_SECENEKLERI);
    fixture.componentRef.setInput('baslik', 'Süreç Durumu');
    fixture.componentRef.setInput('renk', surecDurumRengi(metin));
    fixture.componentRef.setInput('metin', metin);
    fixture.componentRef.setInput('seciliId', seciliId);
    secilen = [];
    fixture.componentInstance.secildi.subscribe(id => secilen.push(id));
    fixture.detectChanges();
  };
  const el = () => fixture.nativeElement as HTMLElement;
  const tetik = () => el().querySelector<HTMLButtonElement>('.durum-tetik')!;
  const ogeler = () => Array.from(el().querySelectorAll<HTMLButtonElement>('.durum-panel__oge'));

  afterEach(() => fixture.destroy());

  it('atanmış süreci aynı rozet rengiyle ve açılır okla gösterir', () => {
    olustur('Siparişte', SurecDurum.Sipariste);

    expect(tetik().textContent).toContain('Siparişte');
    expect(tetik().classList).not.toContain('durum-tetik--bos');
    expect(tetik().style.color).toBe('rgb(217, 119, 6)');
    expect(tetik().querySelector('.ri-arrow-down-s-line')).not.toBeNull();
  });

  it('atanmamış süreçte "Seç" düğmesi gösterir', () => {
    olustur(null, null);

    expect(tetik().classList).toContain('durum-tetik--bos');
    expect(tetik().textContent).toContain('Seç');
  });

  it('tetikleyici menüyü açar ve tıklamayı satıra iletmez', () => {
    olustur('Ambar', SurecDurum.Ambar);
    // Satırın tıklama dinleyicisi bileşenin kapsayıcısındadır (tr); tetikleyici tıklaması oraya ulaşmamalı.
    const satirTiklandi = jasmine.createSpy('satirTiklandi');
    el().addEventListener('click', satirTiklandi);

    tetik().click();
    fixture.detectChanges();

    expect(el().querySelector('.durum-panel')!.classList).toContain('acik');
    expect(ogeler().length).toBe(6);
    expect(satirTiklandi).not.toHaveBeenCalled();
  });

  it('başka bir süreç seçilince bildirir ve menüyü kapatır', () => {
    olustur('Ambar', SurecDurum.Ambar);
    tetik().click();
    fixture.detectChanges();

    ogeler()[SurecDurum.Tedarik - 1].click();
    fixture.detectChanges();

    expect(secilen).toEqual([SurecDurum.Tedarik]);
    expect(el().querySelector('.durum-panel')!.classList).not.toContain('acik');
  });

  it('kayıtlı süreç işaretlidir ve yeniden seçilince bildirim yapılmaz', () => {
    olustur('İmalat', SurecDurum.Imalat);
    tetik().click();
    fixture.detectChanges();

    const secili = ogeler()[SurecDurum.Imalat - 1];
    expect(secili.classList).toContain('secili');
    secili.click();

    expect(secilen).toEqual([]);
  });

  it('kaydedilirken tetikleyici kapalıdır', () => {
    olustur('Ambar', SurecDurum.Ambar);
    fixture.componentRef.setInput('kaydediliyor', true);
    fixture.detectChanges();

    expect(tetik().disabled).toBeTrue();
    expect(tetik().querySelector('.spinner-border')).not.toBeNull();
  });
});

describe('GridDurumSeciciComponent (kalite)', () => {
  it('kalite seçeneklerini başlığıyla listeler ve seçimi bildirir', () => {
    TestBed.configureTestingModule({ imports: [GridDurumSeciciComponent] });
    const fixture = TestBed.createComponent(GridDurumSeciciComponent);
    fixture.componentRef.setInput('secenekler', KALITE_SECENEKLERI);
    fixture.componentRef.setInput('baslik', 'Kalite Durumu');
    fixture.componentRef.setInput('metin', null);
    const secilen: number[] = [];
    fixture.componentInstance.secildi.subscribe(id => secilen.push(id));
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    el.querySelector<HTMLButtonElement>('.durum-tetik--bos')!.click();
    fixture.detectChanges();

    expect(el.querySelector('.durum-panel__baslik')!.textContent).toContain('Kalite Durumu');
    const ogeler = Array.from(el.querySelectorAll<HTMLButtonElement>('.durum-panel__oge'));
    expect(ogeler.map(o => o.textContent!.trim())).toEqual(['Onaylandı', 'Tadilatta']);
    ogeler[1].click();
    expect(secilen).toEqual([2]);
    fixture.destroy();
  });
});
