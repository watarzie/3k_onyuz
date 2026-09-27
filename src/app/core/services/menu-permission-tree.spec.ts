import { MenuTreeDto } from '../../shared/models';
import { YetkiTipi } from '../constants/enums';
import { capMenuPermission, normalizeMenuTree } from './menu-permission-tree';

function node(id: number, permission: YetkiTipi, children: MenuTreeDto[] = []): MenuTreeDto {
  return {
    id,
    kod: `menu-${id}`,
    labelKey: '',
    icon: '',
    sira: id,
    yetkiTipiId: permission,
    yetkiTipiMetni: YetkiTipi[permission],
    children,
  };
}

describe('Menü yetkisi hiyerarşisi', () => {
  it('üst düğüm tavandır: üst R altında W düğüm R olur, mevcut N izni açılmaz', () => {
    const source = [node(1, YetkiTipi.R, [
      node(2, YetkiTipi.W, [node(3, YetkiTipi.W)]),
      node(4, YetkiTipi.W),
      node(5, YetkiTipi.N),
    ])];

    const [root] = normalizeMenuTree(source);
    expect(root.children.map(child => child.yetkiTipiId))
      .toEqual([YetkiTipi.R, YetkiTipi.R, YetkiTipi.N]);
    expect(root.children[0].children[0].yetkiTipiId).toBe(YetkiTipi.R);
    expect(source[0].children[0].yetkiTipiId).toBe(YetkiTipi.W);
  });

  it('üst W alt düğüme kendiliğinden izin vermez', () => {
    expect(capMenuPermission(YetkiTipi.N, YetkiTipi.W)).toBe(YetkiTipi.N);
    expect(capMenuPermission(YetkiTipi.R, YetkiTipi.W)).toBe(YetkiTipi.R);
    expect(capMenuPermission(YetkiTipi.W, YetkiTipi.W)).toBe(YetkiTipi.W);
    expect(capMenuPermission(YetkiTipi.W, YetkiTipi.N)).toBe(YetkiTipi.N);
  });

  it('üst N alt ağacı kapatır; görünür menü için dalı tamamen çıkarır', () => {
    const source = [node(1, YetkiTipi.N, [node(2, YetkiTipi.W)]), node(3, YetkiTipi.R)];

    const normalized = normalizeMenuTree(source);
    expect(normalized[0].children[0].yetkiTipiId).toBe(YetkiTipi.N);
    expect(normalizeMenuTree(source, true).map(item => item.id)).toEqual([3]);
  });
});
