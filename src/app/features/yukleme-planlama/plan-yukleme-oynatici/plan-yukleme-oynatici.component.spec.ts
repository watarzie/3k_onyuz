import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { PlanYukKonumu, YerlesimGirisYonu } from '../../../shared/models/yukleme-planlama.model';
import { YuklemeAdimi, yuklemeAdimlari } from '../ortak/yukleme-adimlari';
import { ADIM_SURESI_MS, PlanYuklemeOynaticiComponent } from './plan-yukleme-oynatici.component';

function konum(kod: string, sira: number, kat = 1): PlanYukKonumu {
  return {
    yukAnahtari: 's:' + kod, kod, projeNo: 'P1', brutKg: 500, xMm: 30, yMm: 73, zMm: 0, boyMm: 1000, enMm: 1000, yukseklikMm: 1000,
    donduruldu: false, yuzeyKodu: 'ANA', istifNo: sira, kat, yuklemeSirasi: sira, yuklemeYontemi: YerlesimGirisYonu.Arkadan,
  };
}

const ADIMLAR = yuklemeAdimlari([konum('A', 1), konum('B-ALT', 2), konum('B-UST', 2, 2), konum('C', 3)]);

describe('PlanYuklemeOynaticiComponent', () => {
  let fixture: ComponentFixture<PlanYuklemeOynaticiComponent>;
  let istenenler: number[];

  /** Üst bileşenin yaptığı gibi: istenen adım girdi olarak geri verilir. */
  function kur(adimlar: YuklemeAdimi[] = ADIMLAR, adim = 1) {
    TestBed.configureTestingModule({ imports: [PlanYuklemeOynaticiComponent] });
    fixture = TestBed.createComponent(PlanYuklemeOynaticiComponent);
    fixture.componentRef.setInput('adimlar', adimlar);
    fixture.componentRef.setInput('adim', adim);
    istenenler = [];
    fixture.componentInstance.adimDegisti.subscribe((a) => {
      istenenler.push(a);
      fixture.componentRef.setInput('adim', a);
      fixture.detectChanges();
    });
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  const metin = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const dugme = (etiket: string) => (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(`button[aria-label="${etiket}"]`)!;

  it('geçerli adımı, yük numarasını ve istif grubunu gösterir', () => {
    kur(ADIMLAR, 2);
    expect(metin()).toContain('Adım 2 / 3');
    expect(metin()).toContain('İstif grubu: 2 kat birlikte yüklenir');
    const numaralar = [...(fixture.nativeElement as HTMLElement).querySelectorAll('.oy__no')].map((n) => n.textContent?.trim());
    expect(numaralar).toEqual(['2', '3']);
    expect(metin()).toContain('B-ALT');
    expect(metin()).toContain('Arkadan yükleme');
  });

  it('ileri ve geri bir adım ister; uçlarda düğmeler kapalı görünür (odak kaybolmasın diye disabled değil) ve sınır dışı adım istenmez', () => {
    const c = kur();
    const kapali = (etiket: string) => [dugme(etiket).getAttribute('aria-disabled'), dugme(etiket).disabled];
    expect(kapali('Önceki adım')).toEqual(['true', false]);
    dugme('Önceki adım').click();
    expect(istenenler).toEqual([]);
    dugme('Sonraki adım').click();
    dugme('Son adım').click();
    expect(istenenler).toEqual([2, 3]);
    expect(kapali('Sonraki adım')).toEqual(['true', false]);
    expect(kapali('Önceki adım')).toEqual(['false', false]);
    c.git(99);
    c.git(3);
    expect(istenenler).toEqual([2, 3]);
    dugme('Başa dön').click();
    expect(istenenler).toEqual([2, 3, 1]);
  });

  it('oynat adımları sırayla ister ve son adımda durur; sondayken oynat baştan başlar', fakeAsync(() => {
    const c = kur();
    c.oynatDuraklat();
    expect(c.oynuyor()).toBeTrue();
    tick(ADIM_SURESI_MS * 2);
    expect(istenenler).toEqual([2, 3]);
    tick(ADIM_SURESI_MS);
    expect(c.oynuyor()).toBeFalse();
    tick(ADIM_SURESI_MS * 3);
    expect(istenenler).toEqual([2, 3]);

    c.oynatDuraklat();
    expect(istenenler).toEqual([2, 3, 1]);
    c.hizSec(2);
    tick(ADIM_SURESI_MS / 2);
    expect(istenenler).toEqual([2, 3, 1, 2]);
    c.oynatDuraklat();
    expect(c.oynuyor()).toBeFalse();
    tick(ADIM_SURESI_MS * 3);
    expect(istenenler).toEqual([2, 3, 1, 2]);
  }));

  it('elle gezinme ve adımların değişmesi (başka araç) oynatmayı durdurur', fakeAsync(() => {
    const c = kur();
    c.oynatDuraklat();
    c.elleGit(3);
    expect(c.oynuyor()).toBeFalse();

    c.elleGit(1);
    c.oynatDuraklat();
    expect(c.oynuyor()).toBeTrue();
    fixture.componentRef.setInput('adimlar', yuklemeAdimlari([konum('X', 1), konum('Y', 2)]));
    fixture.detectChanges();
    expect(c.oynuyor()).toBeFalse();
    const once = istenenler.length;
    tick(ADIM_SURESI_MS * 3);
    expect(istenenler.length).toBe(once);
  }));

  it('adım oynatıcının istemediği bir değere geçerse (tablodan satır seçimi) oynatma durur', fakeAsync(() => {
    const c = kur();
    c.oynatDuraklat();
    tick(ADIM_SURESI_MS);
    expect([c.oynuyor(), istenenler]).toEqual([true, [2]]);
    fixture.componentRef.setInput('adim', 1);
    fixture.detectChanges();
    expect(c.oynuyor()).toBeFalse();
    tick(ADIM_SURESI_MS * 3);
    expect(istenenler).toEqual([2]);
  }));

  it('yok edilince zamanlayıcı durur', fakeAsync(() => {
    const c = kur();
    c.oynatDuraklat();
    fixture.destroy();
    tick(ADIM_SURESI_MS * 3);
    expect(istenenler).toEqual([]);
  }));

  it('klavye: oklar ve Home/End adım değiştirir, boşluk oynatır; sürgü, hız seçimi ve düğme kendi tuşunu işler', fakeAsync(() => {
    const c = kur();
    const kok = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.oy')!;
    const bas = (hedef: HTMLElement, key: string) => {
      const olay = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      hedef.dispatchEvent(olay);
      return olay.defaultPrevented;
    };
    expect(bas(kok, 'ArrowRight')).toBeTrue();
    bas(kok, 'End');
    bas(kok, 'ArrowLeft');
    bas(kok, 'Home');
    expect(istenenler).toEqual([2, 3, 2, 1]);
    // Uçta devre dışı görünen düğme odaktayken de oklar çalışır.
    bas(dugme('Önceki adım'), 'ArrowRight');
    expect(istenenler).toEqual([2, 3, 2, 1, 2]);

    const surgu = kok.querySelector<HTMLInputElement>('input[type="range"]')!;
    const hiz = kok.querySelector<HTMLElement>('[role="radiogroup"] button')!;
    expect([bas(surgu, 'ArrowRight'), bas(hiz, 'ArrowRight'), bas(dugme('Sonraki adım'), ' ')]).toEqual([false, false, false]);
    expect(istenenler.length).toBe(5);

    expect(bas(kok, ' ')).toBeTrue();
    expect(c.oynuyor()).toBeTrue();
    bas(kok, ' ');
    expect(c.oynuyor()).toBeFalse();

    surgu.value = '3';
    surgu.dispatchEvent(new Event('input'));
    expect(istenenler[istenenler.length - 1]).toBe(3);
  }));

  it('tek adımlı araçta oynatma kapalıdır', () => {
    const c = kur(yuklemeAdimlari([konum('A', 1)]));
    c.oynatDuraklat();
    expect(c.oynuyor()).toBeFalse();
    expect(metin()).toContain('Adım 1 / 1');
  });
});
