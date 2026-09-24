import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { YetkiTipi } from '../../core/constants/enums';
import { PermissionService } from '../../core/services/permission.service';
import { TranslationService } from '../../core/services/translation.service';
import { MenuTreeDto } from '../../shared/models';
import { ToggleService } from '../header/toggle.service';
import { SidebarComponent } from './sidebar.component';

describe('SidebarComponent yetki filtresi', () => {
  it('N üst menüyü çocuk W olsa bile göstermez; N alt menüyü de çıkarır', () => {
    const item = (id: number, kod: string, permission: YetkiTipi,
      children: MenuTreeDto[] = []): MenuTreeDto => ({
      id, kod, labelKey: kod, icon: '', route: `/${kod}`, sira: id,
      yetkiTipiId: permission, yetkiTipiMetni: YetkiTipi[permission], children,
    });
    const menuAgaci = signal([
      item(1, 'sandik-yonetimi', YetkiTipi.N, [item(2, 'eski-w', YetkiTipi.W)]),
      item(3, 'projeler', YetkiTipi.R, [
        item(4, 'gizli-alt', YetkiTipi.N),
        item(5, 'gorunur-alt', YetkiTipi.R),
      ]),
    ]);
    TestBed.configureTestingModule({
      imports: [SidebarComponent],
      providers: [
        provideRouter([]),
        { provide: PermissionService, useValue: { menuAgaci } },
        { provide: TranslationService, useValue: {
          currentLang: signal('tr'), translate: (key: string) => key,
        } },
        { provide: ToggleService, useValue: { isSidebarToggled: signal(false), toggle: () => {} } },
      ],
    });

    const fixture = TestBed.createComponent(SidebarComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.menu().map(item => item.kod)).toEqual(['projeler']);
    expect(fixture.componentInstance.menu()[0].children?.map(item => item.kod))
      .toEqual(['gorunur-alt']);
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('sandik-yonetimi');
  });
});
