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
        useValue: { translate: (key: string) => ({ 'MENU.TEST_IZIN': 'Test izni' })[key as 'MENU.TEST_IZIN'] ?? key },
      }],
    });
  });

  function node(permission: YetkiTipi): MenuTreeDto {
    return {
      id: ++nextNodeId,
      kod: 'test-izin',
      labelKey: 'MENU.TEST_IZIN',
      icon: '',
      sira: 1,
      yetkiTipiId: permission,
      yetkiTipiMetni: YetkiTipi[permission],
      children: [],
    };
  }

  function render(...roots: MenuTreeDto[]) {
    const fixture = TestBed.createComponent(MenuTreeComponent);
    fixture.componentInstance.nodes = roots;
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const checkboxes = element.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    const click = (index: number) => {
      checkboxes[index].click();
      fixture.detectChanges();
    };
    return { fixture, element, checkboxes, click };
  }

  it('okuma iznini çizgi, yazma iznini tik olarak gösterir; etiketi çevirir', () => {
    const read = render(node(YetkiTipi.R));
    expect(read.checkboxes[0].indeterminate).toBeTrue();
    expect(read.checkboxes[0].checked).toBeFalse();
    expect(read.element.textContent).toContain('Test izni');

    const write = render(node(YetkiTipi.W));
    expect(write.checkboxes[0].indeterminate).toBeFalse();
    expect(write.checkboxes[0].checked).toBeTrue();
  });

  it('kök düğüm N → R → W → N döngüsünü izler', () => {
    const root = node(YetkiTipi.N);
    const tree = render(root);
    const seen: number[] = [];
    for (let i = 0; i < 4; i++) {
      tree.click(0);
      seen.push(root.yetkiTipiId);
    }

    expect(seen).toEqual([YetkiTipi.R, YetkiTipi.W, YetkiTipi.N, YetkiTipi.R]);
    expect(tree.checkboxes[0].indeterminate).toBeTrue();
    expect(tree.checkboxes[0].checked).toBeFalse();
  });

  it('üst N yapıldığında torunları kapatır; tekrar açılınca eski izinleri geri açmaz', () => {
    const root = node(YetkiTipi.W);
    const child = node(YetkiTipi.W);
    const grandchild = node(YetkiTipi.W);
    const action = node(YetkiTipi.W);
    root.children = [child, action];
    child.children = [grandchild];
    child.parent = root;
    action.parent = root;
    grandchild.parent = child;
    const tree = render(root);

    tree.click(0);
    expect([root, child, grandchild, action].map(item => item.yetkiTipiId))
      .toEqual([YetkiTipi.N, YetkiTipi.N, YetkiTipi.N, YetkiTipi.N]);
    expect(tree.checkboxes[1].disabled).toBeTrue();

    tree.click(0);
    expect(root.yetkiTipiId).toBe(YetkiTipi.R);
    expect([child, grandchild, action].every(item => item.yetkiTipiId === YetkiTipi.N)).toBeTrue();
    expect(tree.checkboxes[1].disabled).toBeFalse();
    expect(tree.checkboxes[2].disabled).toBeTrue();
    expect(tree.checkboxes[3].disabled).toBeFalse();

    tree.click(0);
    expect(root.yetkiTipiId).toBe(YetkiTipi.W);
    expect([child, grandchild, action].every(item => item.yetkiTipiId === YetkiTipi.N)).toBeTrue();
  });

  it('üst R altında ekran ve işlem düğümleri aynı şekilde N ile R arasında kalır', () => {
    const root = node(YetkiTipi.R);
    const screen = node(YetkiTipi.R);
    const action = node(YetkiTipi.N);
    root.children = [screen, action];
    screen.parent = root;
    action.parent = root;
    const tree = render(root);

    tree.click(1);
    expect(screen.yetkiTipiId).toBe(YetkiTipi.N);
    expect(tree.checkboxes[1].checked).toBeFalse();
    expect(tree.checkboxes[1].indeterminate).toBeFalse();
    tree.click(1);
    expect(screen.yetkiTipiId).toBe(YetkiTipi.R);

    tree.click(2);
    expect(action.yetkiTipiId).toBe(YetkiTipi.R);
    tree.click(2);
    expect(action.yetkiTipiId).toBe(YetkiTipi.N);
  });

  it('üst W altında alt düğüm W olabilir; üst kapatılınca alt düğüm de kapanır', () => {
    const root = node(YetkiTipi.W);
    const action = node(YetkiTipi.R);
    root.children = [action];
    action.parent = root;
    const tree = render(root);

    tree.click(1);
    expect(action.yetkiTipiId).toBe(YetkiTipi.W);
    expect(tree.checkboxes[1].checked).toBeTrue();

    tree.click(0);
    expect(root.yetkiTipiId).toBe(YetkiTipi.N);
    expect(action.yetkiTipiId).toBe(YetkiTipi.N);
    expect(tree.checkboxes[1].disabled).toBeTrue();
  });

  it('disabled girdisinde hiçbir düğüm değiştirilemez', () => {
    const root = node(YetkiTipi.R);
    const fixture = TestBed.createComponent(MenuTreeComponent);
    fixture.componentInstance.nodes = [root];
    fixture.componentInstance.disabled = true;
    fixture.detectChanges();

    fixture.componentInstance.onPermissionChange(root);
    expect(root.yetkiTipiId).toBe(YetkiTipi.R);
    expect((fixture.nativeElement as HTMLElement).querySelector('input')!.disabled).toBeTrue();
  });
});
