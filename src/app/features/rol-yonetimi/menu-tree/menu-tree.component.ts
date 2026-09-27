import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { MenuTreeDto } from '../../../shared/models';
import { YetkiTipi } from '../../../core/constants/enums';
import { capMenuPermission } from '../../../core/services/menu-permission-tree';

/**
 * Rol izin ağacı. Bütün düğümler (ekran, işlem, alan) aynı N/R/W döngüsünü kullanır;
 * alt düğüm üst düğümün seviyesini aşamaz.
 */
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
    return this.disabled || parentPermission === YetkiTipi.N;
  }

  onPermissionChange(node: MenuTreeDto, checkbox?: HTMLInputElement): void {
    if (this.isPermissionDisabled(node)) return;
    this.cyclePermission(node, node.parent?.yetkiTipiId ?? YetkiTipi.W);
    this.capChildren(node);
    // Indeterminate bir checkbox'a tıklamak, Angular [checked] ifadesi false kalsa da
    // DOM'daki `checked` değerini değiştirir (R -> N). Görünen durum modelle aynı kalmalı.
    if (checkbox) {
      checkbox.checked = node.yetkiTipiId === YetkiTipi.W;
      checkbox.indeterminate = node.yetkiTipiId === YetkiTipi.R;
    }
  }

  /** Üst R altında N ↔ R, üst W altında N → R → W → N. */
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

  /** Mevcut N kararlarını koruyarak üst değişikliğinden sonra bütün alt düğümleri sınırlar. */
  private capChildren(node: MenuTreeDto): void {
    for (const child of node.children ?? []) {
      this.setPermission(child, capMenuPermission(child.yetkiTipiId, node.yetkiTipiId));
      this.capChildren(child);
    }
  }
}
