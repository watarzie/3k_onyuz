import { TestBed } from '@angular/core/testing';
import { TzSeciciComponent } from './tz-secici.component';

describe('TzSeciciComponent', () => {
  function kur(deger = '', secenekSayisi = 3) {
    TestBed.configureTestingModule({ imports: [TzSeciciComponent] });
    const fixture = TestBed.createComponent(TzSeciciComponent);
    fixture.componentRef.setInput('secenekler',
      Array.from({ length: secenekSayisi }, (_, i) => ({ deger: String(i + 1), etiket: `Sandık ${i + 1}`, sayi: i + 2 })));
    fixture.componentRef.setInput('etiket', 'Sandık');
    fixture.componentRef.setInput('tumuEtiketi', 'Tüm sandıklar');
    fixture.componentRef.setInput('tumuSayi', 9);
    fixture.componentRef.setInput('deger', deger);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const secilen: string[] = [];
    fixture.componentInstance.degisti.subscribe(v => secilen.push(v));
    return { fixture, el, c: fixture.componentInstance, secilen };
  }

  it('seçili değeri gösterir; açılınca "tümü" ve sayaçlı seçenekleri listeler', () => {
    const { fixture, el } = kur('2');
    expect(el.querySelector('.tz-secici__metin strong')!.textContent).toContain('Sandık 2');
    (el.querySelector('.tz-secici__tetik') as HTMLButtonElement).click();
    fixture.detectChanges();
    const satirlar = Array.from(el.querySelectorAll('.tz-secici__secenek'));
    expect(satirlar.length).toBe(4);
    expect(satirlar[0].textContent).toContain('Tüm sandıklar');
    expect(satirlar[0].textContent).toContain('9');
    expect(satirlar[2].classList).toContain('is-selected');
  });

  it('tıklanan seçeneği bildirir ve kapanır; temizle "tümü" seçer', () => {
    const { fixture, el, c, secilen } = kur('2');
    (el.querySelector('.tz-secici__tetik') as HTMLButtonElement).click();
    fixture.detectChanges();
    (el.querySelectorAll('.tz-secici__secenek')[3] as HTMLElement).click();
    expect(secilen).toEqual(['3']);
    expect(c.acik()).toBeFalse();

    fixture.detectChanges();
    (el.querySelector('.tz-secici__temizle') as HTMLElement).click();
    expect(secilen).toEqual(['3', '']);
  });

  it('klavye ile gezinip Enter ile seçer; çok seçenekte arama süzer', () => {
    const { fixture, el, c, secilen } = kur('', 12);
    const tetik = el.querySelector('.tz-secici__tetik') as HTMLButtonElement;
    tetik.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    fixture.detectChanges();
    expect(c.acik()).toBeTrue();
    expect(el.querySelector('.tz-secici__arama')).not.toBeNull();

    c.aramaDegisti('11');
    fixture.detectChanges();
    expect(el.querySelectorAll('.tz-secici__secenek').length).toBe(1);
    tetik.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(secilen).toEqual(['11']);
  });
});
