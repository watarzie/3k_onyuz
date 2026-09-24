import { TestBed } from '@angular/core/testing';
import { YetkiTipi } from '../../../core/constants/enums';
import { TranslationService } from '../../../core/services/translation.service';
import { MenuTreeDto } from '../../../shared/models';
import { MenuTreeComponent } from './menu-tree.component';

describe('MenuTreeComponent yetki göstergesi', () => {
  let nextNodeId = 1;

  beforeEach(() => {
    nextNodeId = 1;
    TestBed.configureTestingModule({
      imports: [MenuTreeComponent],
      providers: [{
        provide: TranslationService,
        useValue: { translate: (key: string) => ({
          'PERMISSIONS.READ_ACCESS': 'Okuma',
          'PERMISSIONS.WRITE_ACCESS': 'Yazma',
        })[key as 'PERMISSIONS.READ_ACCESS' | 'PERMISSIONS.WRITE_ACCESS'] ?? key },
      }],
    });
  });

  function render(yetkiTipiId: YetkiTipi, gerekenYetkiTipiId?: YetkiTipi) {
    const node: MenuTreeDto = {
      id: 1,
      kod: 'test-izin',
      labelKey: '',
      ad: 'Test izni',
      icon: '',
      sira: 1,
      yetkiTipiId,
      yetkiTipiMetni: YetkiTipi[yetkiTipiId],
      gerekenYetkiTipiId,
      children: [],
    };
    const fixture = TestBed.createComponent(MenuTreeComponent);
    fixture.componentInstance.nodes = [node];
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const checkbox = element.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    return { fixture, element, checkbox, node };
  }

  function nested(permission: YetkiTipi, required?: YetkiTipi): MenuTreeDto {
    return {
      id: ++nextNodeId,
      kod: 'test-izin',
      labelKey: '',
      ad: 'Test izni',
      icon: '',
      sira: 1,
      yetkiTipiId: permission,
      yetkiTipiMetni: YetkiTipi[permission],
      gerekenYetkiTipiId: required,
      children: [],
    };
  }

  it('okuma iznini tik değil çizgi, yazma iznini tik olarak gösterir', () => {
    const read = render(YetkiTipi.R, YetkiTipi.R);
    expect(read.checkbox.indeterminate).toBeTrue();
    expect(read.checkbox.checked).toBeFalse();
    expect(read.element.querySelector('.permission-type')).toBeNull();
    expect(read.element.textContent).not.toContain('Okuma');

    const write = render(YetkiTipi.W, YetkiTipi.W);
    expect(write.checkbox.indeterminate).toBeFalse();
    expect(write.checkbox.checked).toBeTrue();
    expect(write.element.querySelector('.permission-type')).toBeNull();
    expect(write.element.textContent).not.toContain('Yazma');
  });

  it('işlem bazlı izni kapalı durumdan yalnızca tanımlı seviyeye açar', () => {
    const read = render(YetkiTipi.N, YetkiTipi.R);
    expect(read.checkbox.checked).toBeFalse();
    expect(read.checkbox.indeterminate).toBeFalse();

    read.checkbox.click();
    read.fixture.detectChanges();
    expect(read.node.yetkiTipiId).toBe(YetkiTipi.R);
    expect(read.checkbox.indeterminate).toBeTrue();

    read.checkbox.click();
    read.fixture.detectChanges();
    expect(read.node.yetkiTipiId).toBe(YetkiTipi.N);
    expect(read.checkbox.indeterminate).toBeFalse();
    expect(read.checkbox.checked).toBeFalse();
  });

  it('eski üç durumlu menü yetkisi döngüsünü değiştirmez', () => {
    const menu = render(YetkiTipi.N);
    menu.checkbox.click();
    menu.fixture.detectChanges();
    expect(menu.checkbox.indeterminate).toBeTrue();

    menu.checkbox.click();
    menu.fixture.detectChanges();
    expect(menu.checkbox.checked).toBeTrue();

    menu.checkbox.click();
    menu.fixture.detectChanges();
    expect(menu.checkbox.checked).toBeFalse();
    expect(menu.checkbox.indeterminate).toBeFalse();

    menu.checkbox.click();
    menu.fixture.detectChanges();
    expect(menu.node.yetkiTipiId).toBe(YetkiTipi.R);
    menu.checkbox.click();
    menu.fixture.detectChanges();
    expect(menu.node.yetkiTipiId).toBe(YetkiTipi.W);
    menu.checkbox.click();
    menu.fixture.detectChanges();
    expect(menu.node.yetkiTipiId).toBe(YetkiTipi.N);
    expect(menu.checkbox.checked).toBeFalse();
    expect(menu.checkbox.indeterminate).toBeFalse();
  });

  it('üst N yapıldığında torunları kapatır; tekrar R olunca eski W izinlerini açmaz', () => {
    const root = nested(YetkiTipi.W);
    const child = nested(YetkiTipi.W);
    const grandchild = nested(YetkiTipi.W);
    const action = nested(YetkiTipi.W, YetkiTipi.W);
    root.children = [child, action];
    child.children = [grandchild];
    child.parent = root;
    action.parent = root;
    grandchild.parent = child;

    const fixture = TestBed.createComponent(MenuTreeComponent);
    fixture.componentInstance.nodes = [root];
    fixture.detectChanges();
    const checkboxes = (fixture.nativeElement as HTMLElement)
      .querySelectorAll<HTMLInputElement>('input[type="checkbox"]');

    checkboxes[0].click();
    fixture.detectChanges();
    expect([root, child, grandchild, action].map(item => item.yetkiTipiId))
      .toEqual([YetkiTipi.N, YetkiTipi.N, YetkiTipi.N, YetkiTipi.N]);
    expect(checkboxes[1].disabled).toBeTrue();

    checkboxes[0].click();
    fixture.detectChanges();
    expect(root.yetkiTipiId).toBe(YetkiTipi.R);
    expect([child, grandchild, action].every(item => item.yetkiTipiId === YetkiTipi.N))
      .toBeTrue();
    expect(checkboxes[1].disabled).toBeFalse();
    expect(checkboxes[3].disabled).toBeTrue();

    checkboxes[0].click();
    fixture.detectChanges();
    expect(root.yetkiTipiId).toBe(YetkiTipi.W);
    expect([child, grandchild, action].every(item => item.yetkiTipiId === YetkiTipi.N))
      .toBeTrue();
  });

  it('üst R altında normal çocuk N ile R arasında kalır ve W işlemi açılamaz', () => {
    const root = nested(YetkiTipi.R);
    const child = nested(YetkiTipi.R);
    const action = nested(YetkiTipi.N, YetkiTipi.W);
    root.children = [child, action];
    child.parent = root;
    action.parent = root;

    const fixture = TestBed.createComponent(MenuTreeComponent);
    fixture.componentInstance.nodes = [root];
    fixture.detectChanges();
    const checkboxes = (fixture.nativeElement as HTMLElement)
      .querySelectorAll<HTMLInputElement>('input[type="checkbox"]');

    checkboxes[1].click();
    fixture.detectChanges();
    expect(child.yetkiTipiId).toBe(YetkiTipi.N);
    expect(checkboxes[1].checked).toBeFalse();
    expect(checkboxes[1].indeterminate).toBeFalse();
    checkboxes[1].click();
    fixture.detectChanges();
    expect(child.yetkiTipiId).toBe(YetkiTipi.R);
    checkboxes[1].click();
    fixture.detectChanges();
    expect(child.yetkiTipiId).toBe(YetkiTipi.N);
    expect(checkboxes[2].disabled).toBeTrue();
    fixture.componentInstance.onPermissionChange(action);
    expect(action.yetkiTipiId).toBe(YetkiTipi.N);
  });
});
