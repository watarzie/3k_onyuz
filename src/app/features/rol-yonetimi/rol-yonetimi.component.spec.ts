import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ConfirmService } from '../../core/services/confirm.service';
import { PermissionService } from '../../core/services/permission.service';
import { RolService } from '../../core/services/rol.service';
import { ToastService } from '../../core/services/toast.service';
import { TranslationService } from '../../core/services/translation.service';
import { YetkiTipi } from '../../core/constants/enums';
import { MenuTreeDto, RolDetayDto } from '../../shared/models';
import { RolYonetimiComponent } from './rol-yonetimi.component';

describe('RolYonetimiComponent yetki kaydı', () => {
  it('eski W çocukları yüklemede göstermez ve kayıtta tekrar göndermez', () => {
    const item = (id: number, permission: YetkiTipi, children: MenuTreeDto[] = [],
      required?: YetkiTipi): MenuTreeDto => ({
      id, kod: `izin-${id}`, labelKey: '', ad: `İzin ${id}`, icon: '', sira: id,
      yetkiTipiId: permission, yetkiTipiMetni: YetkiTipi[permission],
      children, gerekenYetkiTipiId: required,
    });
    const detail: RolDetayDto = {
      id: 7,
      ad: 'Test rolü',
      menuAgaci: [item(1, YetkiTipi.R, [
        item(2, YetkiTipi.W),
        item(3, YetkiTipi.W, [], YetkiTipi.W),
      ])],
    };
    const rolService = jasmine.createSpyObj<RolService>('RolService', [
      'getRoller', 'getSablonlar', 'getRolDetay', 'rolGuncelle',
    ]);
    rolService.getRoller.and.returnValue(of([{ id: 7, ad: detail.ad }]));
    rolService.getSablonlar.and.returnValue(of([]));
    rolService.getRolDetay.and.returnValue(of(detail));
    rolService.rolGuncelle.and.returnValue(of(detail));
    const notifyPermissionsChanged = jasmine.createSpy('notifyPermissionsChanged');

    TestBed.configureTestingModule({
      imports: [RolYonetimiComponent],
      providers: [
        provideRouter([]),
        { provide: RolService, useValue: rolService },
        { provide: PermissionService, useValue: {
          canWrite: () => true, notifyPermissionsChanged,
        } },
        { provide: ToastService, useValue: { success: () => {}, error: () => {} } },
        { provide: ConfirmService, useValue: { ask: () => Promise.resolve(true) } },
        { provide: TranslationService, useValue: { translate: (key: string) => key } },
      ],
    });

    const fixture = TestBed.createComponent(RolYonetimiComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.onSelectRole({ id: 7, ad: detail.ad });
    fixture.detectChanges();

    const children = component.selectedRole()!.menuAgaci[0].children;
    expect(children.map(child => child.yetkiTipiId)).toEqual([YetkiTipi.R, YetkiTipi.N]);
    children[0].yetkiTipiId = YetkiTipi.W;
    children[1].yetkiTipiId = YetkiTipi.W;
    component.savePermissions();

    const sent = rolService.rolGuncelle.calls.mostRecent().args[0].yetkiler;
    expect(sent.map(item => item.yetkiTipiId)).toEqual([YetkiTipi.R, YetkiTipi.R, YetkiTipi.N]);
    expect(notifyPermissionsChanged).toHaveBeenCalled();
  });

  it('üst menü R iken normal alt menüyü N yapıp kaydeder ve yeniden yükler', () => {
    const item = (id: number, permission: YetkiTipi, children: MenuTreeDto[] = []): MenuTreeDto => ({
      id,
      kod: `izin-${id}`,
      labelKey: '',
      ad: `İzin ${id}`,
      icon: '',
      sira: id,
      yetkiTipiId: permission,
      yetkiTipiMetni: YetkiTipi[permission],
      children,
    });
    const detail: RolDetayDto = {
      id: 7,
      ad: 'Test rolü',
      menuAgaci: [item(5, YetkiTipi.R, [
        item(14, YetkiTipi.R),
        item(15, YetkiTipi.R),
        item(20, YetkiTipi.R),
      ])],
    };
    const rolService = jasmine.createSpyObj<RolService>('RolService', [
      'getRoller', 'getSablonlar', 'getRolDetay', 'rolGuncelle',
    ]);
    rolService.getRoller.and.returnValue(of([{ id: detail.id, ad: detail.ad }]));
    rolService.getSablonlar.and.returnValue(of([]));
    rolService.getRolDetay.and.callFake(() => of(detail));
    rolService.rolGuncelle.and.callFake(request => {
      for (const node of [detail.menuAgaci[0], ...detail.menuAgaci[0].children]) {
        node.yetkiTipiId = request.yetkiler.find(permission => permission.menuTanimiId === node.id)!
          .yetkiTipiId;
      }
      return of(detail);
    });

    TestBed.configureTestingModule({
      imports: [RolYonetimiComponent],
      providers: [
        provideRouter([]),
        { provide: RolService, useValue: rolService },
        { provide: PermissionService, useValue: {
          canWrite: () => true, notifyPermissionsChanged: () => {},
        } },
        { provide: ToastService, useValue: { success: () => {}, error: () => {} } },
        { provide: ConfirmService, useValue: { ask: () => Promise.resolve(true) } },
        { provide: TranslationService, useValue: { translate: (key: string) => key } },
      ],
    });

    const fixture = TestBed.createComponent(RolYonetimiComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.onSelectRole({ id: detail.id, ad: detail.ad });
    fixture.detectChanges();
    const checkboxes = (fixture.nativeElement as HTMLElement)
      .querySelectorAll<HTMLInputElement>('app-menu-tree input[type="checkbox"]');
    expect(checkboxes.length).toBe(4);
    expect(checkboxes[0].indeterminate).toBeTrue();
    expect(checkboxes[1].indeterminate).toBeTrue();
    expect(checkboxes[1].disabled).toBeFalse();

    checkboxes[1].click();
    fixture.detectChanges();
    expect(component.selectedRole()!.menuAgaci[0].children[0].yetkiTipiId).toBe(YetkiTipi.N);
    expect(checkboxes[1].indeterminate).toBeFalse();
    expect(checkboxes[1].checked).toBeFalse();
    component.savePermissions();
    expect(rolService.rolGuncelle.calls.mostRecent().args[0].yetkiler
      .map(permission => permission.yetkiTipiId))
      .toEqual([YetkiTipi.R, YetkiTipi.N, YetkiTipi.R, YetkiTipi.R]);

    component.onSelectRole({ id: detail.id, ad: detail.ad });
    fixture.detectChanges();
    expect(component.selectedRole()!.menuAgaci[0].children[0].yetkiTipiId).toBe(YetkiTipi.N);
    const reloadedCheckbox = (fixture.nativeElement as HTMLElement)
      .querySelectorAll<HTMLInputElement>('app-menu-tree input[type="checkbox"]')[1];
    expect(reloadedCheckbox.indeterminate).toBeFalse();
    expect(reloadedCheckbox.checked).toBeFalse();
  });
});
