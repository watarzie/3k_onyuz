import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { KILAVUZ_BOLUMU } from './ekipman-kilavuzu-bolumleri';
import { KilavuzYardimiComponent } from './kilavuz-yardimi.component';

describe('KilavuzYardimiComponent', () => {
  it('kılavuzun ilgili bölümünü yeni sekmede açan, adı okunur bir bağlantı çizer', () => {
    TestBed.configureTestingModule({ imports: [KilavuzYardimiComponent], providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(KilavuzYardimiComponent);
    fixture.componentRef.setInput('bolum', KILAVUZ_BOLUMU.yuzeyler);
    fixture.detectChanges();

    const baglanti = (fixture.nativeElement as HTMLElement).querySelector('a')!;
    expect(baglanti.getAttribute('href')).toBe('/ekipman-kitapligi/kilavuz#yuzeyler');
    expect([baglanti.target, baglanti.rel]).toEqual(['_blank', 'noopener']);
    expect(baglanti.getAttribute('aria-label')).toBe('Yükleme yüzeyleri: alanlar ne demek? Kılavuzda aç (yeni sekme)');

    fixture.componentRef.setInput('bolum', KILAVUZ_BOLUMU.kingPin);
    fixture.detectChanges();
    expect(baglanti.getAttribute('href')).toBe('/ekipman-kitapligi/kilavuz#king-pin');
  });
});
