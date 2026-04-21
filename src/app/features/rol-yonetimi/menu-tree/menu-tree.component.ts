import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { MenuTreeDto } from '../../../shared/models';
import { YetkiTipi } from '../../../core/constants/enums';

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
   * N(1) → R(2) → W(3) → N(1)
   */
  onPermissionChange(node: MenuTreeDto): void {
    this.cyclePermission(node);

    // Children varsa aynı yetkiyi children'a da uygula
    if (node.children?.length) {
      this.setPermissionToChildren(node, node.yetkiTipiId);
    }

    // Parent varsa yukarı doğru hesapla
    if (node.parent) {
      this.updateParentPermission(node.parent);
    }
  }

  /** N(1) → R(2) → W(3) → N(1) döngüsü */
  private cyclePermission(node: MenuTreeDto): void {
    if (node.yetkiTipiId === YetkiTipi.N) {
      node.yetkiTipiId = YetkiTipi.R;
      node.yetkiTipiMetni = 'R';
    } else if (node.yetkiTipiId === YetkiTipi.R) {
      node.yetkiTipiId = YetkiTipi.W;
      node.yetkiTipiMetni = 'W';
    } else {
      node.yetkiTipiId = YetkiTipi.N;
      node.yetkiTipiMetni = 'N';
    }
  }

  /** Tüm alt menülere aynı yetkiyi ata */
  private setPermissionToChildren(node: MenuTreeDto, flag: number): void {
    if (!node.children?.length) return;
    const metni = flag === YetkiTipi.W ? 'W' : flag === YetkiTipi.R ? 'R' : 'N';
    node.children.forEach(child => {
      child.yetkiTipiId = flag;
      child.yetkiTipiMetni = metni;
      this.setPermissionToChildren(child, flag);
    });
  }

  /** Parent'ın yetkisini children'a göre hesapla */
  private updateParentPermission(parent: MenuTreeDto): void {
    const children = parent.children;
    if (!children?.length) return;

    const allW = children.every(c => c.yetkiTipiId === YetkiTipi.W);
    const allN = children.every(c => c.yetkiTipiId === YetkiTipi.N);

    if (allW) {
      parent.yetkiTipiId = YetkiTipi.W;
      parent.yetkiTipiMetni = 'W';
    } else if (allN) {
      parent.yetkiTipiId = YetkiTipi.N;
      parent.yetkiTipiMetni = 'N';
    } else {
      parent.yetkiTipiId = YetkiTipi.R; // karışık → indeterminate
      parent.yetkiTipiMetni = 'R';
    }

    // Yukarı devam
    if (parent.parent) {
      this.updateParentPermission(parent.parent);
    }
  }
}
