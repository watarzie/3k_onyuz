import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { MenuTreeDto } from '../../../shared/models';
import { YetkiTipi } from '../../../core/constants/enums';
import { capMenuPermission } from '../../../core/services/menu-permission-tree';

@Component({
  selector: 'app-menu-tree',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './menu-tree.component.html',
  styleUrls: ['./menu-tree.component.scss'],
})
export class MenuTreeComponent {
  readonly yetkiTipi = YetkiTipi;

  @Input() nodes: MenuTreeDto[] = [];
  @Input() disabled = false;

  expandedState = new Map<number, boolean>();

  hasChildren(node: MenuTreeDto): boolean {
    return !!node.children?.length;
  }

  isExpanded(node: MenuTreeDto): boolean {
    return this.expandedState.get(node.id) ?? true; // default açık
  }

  toggle(node: MenuTreeDto): void {
    this.expandedState.set(node.id, !this.isExpanded(node));
  }

  isPermissionDisabled(node: MenuTreeDto): boolean {
    const parentPermission = node.parent?.yetkiTipiId ?? YetkiTipi.W;
    return this.disabled || parentPermission === YetkiTipi.N ||
      (parentPermission === YetkiTipi.R && node.gerekenYetkiTipiId === YetkiTipi.W);
  }

  /**
   * Menü iznini parent sınırında döndürür; işlem izinlerini yalnız tanımlı seviyede açar.
   */
  onPermissionChange(node: MenuTreeDto, checkbox?: HTMLInputElement): void {
    if (this.isPermissionDisabled(node)) return;
    const parentPermission = node.parent?.yetkiTipiId ?? YetkiTipi.W;
    if (node.gerekenYetkiTipiId) {
      const next = node.yetkiTipiId === YetkiTipi.N ? node.gerekenYetkiTipiId : YetkiTipi.N;
      this.setPermission(node, capMenuPermission(next, parentPermission, node.gerekenYetkiTipiId));
    } else {
      this.cyclePermission(node, parentPermission);
    }
    this.capChildren(node);
    // A native click on an indeterminate checkbox changes `checked` even when
    // Angular's [checked] expression remains false (R -> N). Restore the DOM
    // state explicitly so the displayed permission always matches the model.
    if (checkbox) {
      checkbox.checked = node.yetkiTipiId === YetkiTipi.W;
      checkbox.indeterminate = node.yetkiTipiId === YetkiTipi.R;
    }
  }

  /** Parent R altında N ↔ R, parent W altında N → R → W → N. */
  private cyclePermission(node: MenuTreeDto, parentPermission: number): void {
    if (node.yetkiTipiId === YetkiTipi.N) {
      this.setPermission(node, YetkiTipi.R);
    } else if (node.yetkiTipiId === YetkiTipi.R) {
      this.setPermission(node, parentPermission === YetkiTipi.W ? YetkiTipi.W : YetkiTipi.N);
    } else {
      this.setPermission(node, YetkiTipi.N);
    }
  }

  private setPermission(node: MenuTreeDto, permission: number): void {
    node.yetkiTipiId = permission;
    node.yetkiTipiMetni = YetkiTipi[permission];
  }

  /** Keep existing N decisions while capping every descendant after a parent change. */
  private capChildren(node: MenuTreeDto): void {
    for (const child of node.children ?? []) {
      this.setPermission(
        child,
        capMenuPermission(child.yetkiTipiId, node.yetkiTipiId, child.gerekenYetkiTipiId),
      );
      this.capChildren(child);
    }
  }
}
