import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { MenuTreeDto } from '../../../shared/models';
import { YetkiTipi } from '../../../core/constants/enums';
import { capMenuPermission } from '../../../core/services/menu-permission-tree';
import { TranslationService } from '../../../core/services/translation.service';

/**
 * Rol izin ağacı. Bütün düğümler (ekran, işlem, alan) aynı N/R/W döngüsünü kullanır;
 * alt düğüm üst düğümün seviyesini aşamaz. Arama verilirse yalnız eşleşen düğümler ve
 * onların üst düğümleri gösterilir (gösterim süzgecidir; izinler değişmez).
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
  private readonly ts = inject(TranslationService);

  @Input() nodes: MenuTreeDto[] = [];
  @Input() disabled = false;
  /** İzin adı veya koduna göre süzgeç. */
  @Input() arama = '';
  /** Ağaçtaki derinlik; kök düğümler grup başlığı gibi gösterilir. */
  @Input() derinlik = 0;

  expandedState = new Map<number, boolean>();

  hasChildren(node: MenuTreeDto): boolean {
    return !!node.children?.length;
  }

  isExpanded(node: MenuTreeDto): boolean {
    // Arama sürerken eşleşmeler görünsün diye bütün dallar açık kalır.
    if (this.aramaVar()) return true;
    return this.expandedState.get(node.id) ?? true; // default açık
  }

  toggle(node: MenuTreeDto): void {
    this.expandedState.set(node.id, !this.isExpanded(node));
  }

  /** Düğüm, kendisi veya bir alt düğümü aramayla eşleşiyorsa görünür. */
  gorunur(node: MenuTreeDto): boolean {
    if (!this.aramaVar()) return true;
    return this.eslesir(node) || (node.children ?? []).some(c => this.gorunur(c));
  }

  eslesir(node: MenuTreeDto): boolean {
    if (!this.aramaVar()) return false;
    const aranan = this.arama.trim().toLocaleLowerCase('tr');
    return this.ts.translate(node.labelKey).toLocaleLowerCase('tr').includes(aranan) ||
      (node.kod ?? '').toLocaleLowerCase('tr').includes(aranan);
  }

  seviyeAnahtari(node: MenuTreeDto): string {
    return node.yetkiTipiId === YetkiTipi.W
      ? 'PERMISSIONS.FULL_ACCESS'
      : node.yetkiTipiId === YetkiTipi.R
        ? 'PERMISSIONS.READ_ONLY'
        : 'PERMISSIONS.NO_ACCESS';
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

  private aramaVar(): boolean {
    return !!this.arama?.trim();
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
