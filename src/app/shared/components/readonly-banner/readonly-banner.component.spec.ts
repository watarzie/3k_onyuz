import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { ReadOnlyBannerComponent } from './readonly-banner.component';
import { PermissionService } from '../../../core/services/permission.service';

@Component({
  standalone: true,
  imports: [ReadOnlyBannerComponent],
  template: `<app-readonly-banner [menuKod]="kod()" />`,
})
class BannerHost {
  kod = signal('salt-okunur-ekran');
}

describe('ReadOnlyBannerComponent', () => {
  function olustur(rotaMenuKod?: string) {
    TestBed.configureTestingModule({
      imports: [BannerHost],
      providers: [
        { provide: PermissionService, useValue: { isReadOnly: (kod: string) => kod === 'salt-okunur-ekran' } },
        { provide: ActivatedRoute, useValue: { snapshot: { data: rotaMenuKod ? { menuKod: rotaMenuKod } : {} } } },
      ],
    });
    const fixture = TestBed.createComponent(BannerHost);
    fixture.detectChanges();
    return fixture;
  }

  it('bağlanan menü kodu değişince rozeti yeniden değerlendirir', () => {
    const fixture = olustur();
    expect(fixture.nativeElement.querySelector('.readonly-badge')).not.toBeNull();

    fixture.componentInstance.kod.set('yazilabilir-ekran');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.readonly-badge')).toBeNull();
  });

  it('menü kodu verilmezse rotadaki menü kodunu kullanır', () => {
    const fixture = olustur('salt-okunur-ekran');
    fixture.componentInstance.kod.set('');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.readonly-badge')).not.toBeNull();
  });
});
