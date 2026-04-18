import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { MenuTreeDto, YetkiTipi } from '../../../shared/models';

@Component({
  selector: 'app-menu-tree',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './menu-tree.component.html',
  styleUrls: ['./menu-tree.component.scss'],
})
export class MenuTreeComponent {
  @Input() nodes: MenuTreeDto[] = [];

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

  /**
   * Checkbox tıklandığında yetki döngüsü:
   * N → R → W → N
   */
  onPermissionChange(node: MenuTreeDto): void {
    this.cyclePermission(node);

    // Children varsa aynı yetkiyi children'a da uygula
    if (node.children?.length) {
      this.setPermissionToChildren(node, node.yetkiTipi);
    }

    // Parent varsa yukarı doğru hesapla
    if (node.parent) {
      this.updateParentPermission(node.parent);
    }
  }

  /** N → R → W → N döngüsü */
  private cyclePermission(node: MenuTreeDto): void {
    if (node.yetkiTipi === 'N') {
      node.yetkiTipi = 'R';
    } else if (node.yetkiTipi === 'R') {
      node.yetkiTipi = 'W';
    } else {
      node.yetkiTipi = 'N';
    }
  }

  /** Tüm alt menülere aynı yetkiyi ata */
  private setPermissionToChildren(node: MenuTreeDto, flag: YetkiTipi): void {
    if (!node.children?.length) return;
    node.children.forEach(child => {
      child.yetkiTipi = flag;
      this.setPermissionToChildren(child, flag);
    });
  }

  /** Parent'ın yetkisini children'a göre hesapla */
  private updateParentPermission(parent: MenuTreeDto): void {
    const children = parent.children;
    if (!children?.length) return;

    const allW = children.every(c => c.yetkiTipi === 'W');
    const allN = children.every(c => c.yetkiTipi === 'N');

    if (allW) {
      parent.yetkiTipi = 'W';
    } else if (allN) {
      parent.yetkiTipi = 'N';
    } else {
      parent.yetkiTipi = 'R'; // karışık → indeterminate
    }

    // Yukarı devam
    if (parent.parent) {
      this.updateParentPermission(parent.parent);
    }
  }
}
