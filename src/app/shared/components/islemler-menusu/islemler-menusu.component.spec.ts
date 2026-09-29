import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IslemlerMenusuComponent } from './islemler-menusu.component';

@Component({
  standalone: true,
  imports: [IslemlerMenusuComponent],
  template: `
    <app-islemler-menusu [birincil]="birincil()" [ikon]="ikon()">
      @if (duzenle()) {
        <button type="button" class="duzenle" (click)="tiklanan.set('duzenle')">Düzenle</button>
      }
      @if (sil()) {
        <div class="sarmal" (click)="$event.stopPropagation()">
          <button type="button" class="sil" (click)="tiklanan.set('sil')">Sil</button>
        </div>
      }
    </app-islemler-menusu>
    <p class="disarisi">dış alan</p>
  `,
})
class TestHostComponent {
  readonly duzenle = signal(true);
  readonly sil = signal(true);
  readonly tiklanan = signal('');
  readonly birincil = signal(false);
  readonly ikon = signal('ri-more-2-fill');
}

describe('IslemlerMenusuComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: HTMLElement;

  const tetik = () => host.querySelector('.islemler-tetik') as HTMLButtonElement;
  const panelAcik = () => host.querySelector('.islemler-panel')!.classList.contains('acik');

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TestHostComponent] }).compileComponents();
    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.nativeElement;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('tetikleyiciyle açılır, dışarı tıklama ve Esc ile kapanır', () => {
    tetik().click();
    fixture.detectChanges();
    expect(panelAcik()).toBeTrue();
    expect(tetik().getAttribute('aria-expanded')).toBe('true');

    (host.querySelector('.disarisi') as HTMLElement).click();
    fixture.detectChanges();
    expect(panelAcik()).toBeFalse();

    tetik().click();
    fixture.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(panelAcik()).toBeFalse();
  });

  it('işleme tıklanınca işlem çalışır ve menü kapanır; işlem tıklamayı durdursa da', () => {
    tetik().click();
    fixture.detectChanges();
    (host.querySelector('.sil') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.componentInstance.tiklanan()).toBe('sil');
    expect(panelAcik()).toBeFalse();
  });

  it('birincil görünüm ve simge girdileri tetikleyiciye uygulanır', () => {
    expect(tetik().classList.contains('birincil')).toBeFalse();
    fixture.componentInstance.birincil.set(true);
    fixture.componentInstance.ikon.set('ri-file-add-line');
    fixture.detectChanges();
    expect(tetik().classList.contains('birincil')).toBeTrue();
    expect(tetik().querySelector('i')!.classList.contains('ri-file-add-line')).toBeTrue();
  });

  it('dışarıdaki bir kapsayıcı kaydırılınca menü kapanır; panelin kendi kaydırması kapatmaz', () => {
    tetik().click();
    fixture.detectChanges();
    host.querySelector('.islemler-panel')!.dispatchEvent(new Event('scroll'));
    fixture.detectChanges();
    expect(panelAcik()).toBeTrue();
    host.querySelector('.disarisi')!.dispatchEvent(new Event('scroll'));
    fixture.detectChanges();
    expect(panelAcik()).toBeFalse();
  });

  it('izinlerle bütün işlemler gizlenince tetikleyici de gizlenir', async () => {
    expect(tetik().classList.contains('d-none')).toBeFalse();
    fixture.componentInstance.duzenle.set(false);
    fixture.componentInstance.sil.set(false);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(tetik().classList.contains('d-none')).toBeTrue();
  });
});
