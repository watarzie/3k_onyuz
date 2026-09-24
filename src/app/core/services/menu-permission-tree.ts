import { MenuTreeDto } from '../../shared/models';
import { YetkiTipi } from '../constants/enums';

/** A child can never have a stronger effective permission than its parent. */
export function capMenuPermission(
  own: number,
  parent: number,
  required?: number | null,
): YetkiTipi {
  if (own < YetkiTipi.R || parent < YetkiTipi.R) return YetkiTipi.N;

  // Action permissions are switches: a write-only action has no read state.
  if (required === YetkiTipi.W) {
    return own === YetkiTipi.W && parent === YetkiTipi.W ? YetkiTipi.W : YetkiTipi.N;
  }
  if (required === YetkiTipi.R) return YetkiTipi.R;

  return Math.min(own, parent) as YetkiTipi;
}

/** Normalize legacy grants without ever granting a previously denied child. */
export function normalizeMenuTree(
  nodes: MenuTreeDto[],
  removeUnauthorized = false,
): MenuTreeDto[] {
  const visit = (items: MenuTreeDto[], parentPermission: YetkiTipi): MenuTreeDto[] => {
    const result: MenuTreeDto[] = [];
    for (const node of items) {
      const permission = capMenuPermission(
        node.yetkiTipiId,
        parentPermission,
        node.gerekenYetkiTipiId,
      );
      if (removeUnauthorized && permission === YetkiTipi.N) continue;

      const normalized: MenuTreeDto = {
        ...node,
        yetkiTipiId: permission,
        yetkiTipiMetni: YetkiTipi[permission],
        children: visit(node.children ?? [], permission),
      };
      // Role editor uses parent references; they must point into the normalized tree.
      delete normalized.parent;
      result.push(normalized);
    }
    return result;
  };

  return visit(nodes, YetkiTipi.W);
}
