import { MenuTreeDto } from '../../shared/models';
import { YetkiTipi } from '../constants/enums';
import { normalizeMenuTree } from './menu-permission-tree';

function node(
  id: number,
  permission: YetkiTipi,
  children: MenuTreeDto[] = [],
  required?: YetkiTipi,
): MenuTreeDto {
  return {
    id,
    kod: `menu-${id}`,
    labelKey: '',
    icon: '',
    sira: id,
    yetkiTipiId: permission,
    yetkiTipiMetni: YetkiTipi[permission],
    children,
    gerekenYetkiTipiId: required,
  };
}

describe('Menü yetkisi hiyerarşisi', () => {
  it('üst R altında W menüyü R, W-only işlemi N yapar; mevcut N iznini açmaz', () => {
    const source = [node(1, YetkiTipi.R, [
      node(2, YetkiTipi.W, [node(3, YetkiTipi.W)]),
      node(4, YetkiTipi.W, [], YetkiTipi.W),
      node(5, YetkiTipi.N),
    ])];

    const [root] = normalizeMenuTree(source);
    expect(root.children[0].yetkiTipiId).toBe(YetkiTipi.R);
    expect(root.children[0].children[0].yetkiTipiId).toBe(YetkiTipi.R);
    expect(root.children[1].yetkiTipiId).toBe(YetkiTipi.N);
    expect(root.children[2].yetkiTipiId).toBe(YetkiTipi.N);
    expect(source[0].children[0].yetkiTipiId).toBe(YetkiTipi.W);
  });

  it('üst N alt ağacı kapatır; görünür menü için dalı tamamen çıkarır', () => {
    const source = [node(1, YetkiTipi.N, [node(2, YetkiTipi.W)]), node(3, YetkiTipi.R)];

    const normalized = normalizeMenuTree(source);
    expect(normalized[0].children[0].yetkiTipiId).toBe(YetkiTipi.N);
    expect(normalizeMenuTree(source, true).map(item => item.id)).toEqual([3]);
  });
});
