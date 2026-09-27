import { MenuTreeDto } from '../../shared/models';
import { YetkiTipi } from '../constants/enums';

/**
 * Backend YetkiAgaci ile aynı kural: alt düğüm üst düğümden güçlü olamaz (üst düğüm tavandır).
 * Ekran, işlem ve alan kodları aynı N/R/W modeliyle değerlendirilir.
 */
export function capMenuPermission(own: number, parent: number): YetkiTipi {
  if (own < YetkiTipi.R || parent < YetkiTipi.R) return YetkiTipi.N;
  return Math.min(own, parent) as YetkiTipi;
}

/** Ağacı üst tavan kuralına göre normalleştirir; daha önce kapalı bir alt düğümü asla açmaz. */
export function normalizeMenuTree(
  nodes: MenuTreeDto[],
  removeUnauthorized = false,
): MenuTreeDto[] {
  const visit = (items: MenuTreeDto[], parentPermission: YetkiTipi): MenuTreeDto[] => {
    const result: MenuTreeDto[] = [];
    for (const node of items) {
      const permission = capMenuPermission(node.yetkiTipiId, parentPermission);
      if (removeUnauthorized && permission === YetkiTipi.N) continue;

      const normalized: MenuTreeDto = {
        ...node,
        yetkiTipiId: permission,
        yetkiTipiMetni: YetkiTipi[permission],
        children: visit(node.children ?? [], permission),
      };
      // Rol düzenleyici parent referansları kullanır; normalleştirilmiş ağaca işaret etmeli.
      delete normalized.parent;
      result.push(normalized);
    }
    return result;
  };

  return visit(nodes, YetkiTipi.W);
}
