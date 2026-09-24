import { TestBed } from '@angular/core/testing';
import { YetkiTipi } from '../../../core/constants/enums';
import { TranslationService } from '../../../core/services/translation.service';
import { MenuTreeDto } from '../../../shared/models';
import { MenuTreeComponent } from './menu-tree.component';

describe('MenuTreeComponent yetki göstergesi', () => {
  beforeEach(() => {
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
  });
});
