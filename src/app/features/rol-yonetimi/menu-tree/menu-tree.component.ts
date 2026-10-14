import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { MenuTreeDto } from '../../../shared/models';
import { YetkiTipi } from '../../../core/constants/enums';
import { capMenuPermission } from '../../../core/services/menu-permission-tree';
import { TranslationService } from '../../../core/services/translation.service';
import { ConfirmService, duzMetin } from '../../../core/services/confirm.service';

/**
 * Rol izin ağacı. Bütün düğümler (ekran, sekme, işlem, alan) aynı N/R/W döngüsünü kullanır;
 * alt düğüm üst düğümün seviyesini aşamaz. Arama verilirse yalnız eşleşen düğümler ve
 * onların üst düğümleri gösterilir (gösterim süzgecidir; izinler değişmez). Kök düğümler açık,
 * alt düzeylerdeki dallar (ör. Finans sekmeleri) kapalı başlar.
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
  private readonly confirm = inject(ConfirmService);

  @Input() nodes: MenuTreeDto[] = [];
  @Input() disabled = false;
  /** İzin adı veya koduna göre süzgeç. */
  @Input() arama = '';
  /** Ağaçtaki derinlik; kök düğümler grup başlığı gibi gösterilir. */
  @Input() derinlik = 0;

  /** Aç/kapa durumu bütün alt ağaçlarla paylaşılır; "Tümünü aç/kapat" tek yerden uygulanır. */
  @Input() acikDurumlar = new Map<number, boolean>();

  hasChildren(node: MenuTreeDto): boolean {
    return !!node.children?.length;
  }

  isExpanded(node: MenuTreeDto): boolean {
    // Arama sürerken eşleşmeler görünsün diye bütün dallar açık kalır.
    if (this.aramaVar()) return true;
    return this.acikDurumlar.get(node.id) ?? this.derinlik === 0;
  }

  toggle(node: MenuTreeDto): void {
    this.acikDurumlar.set(node.id, !this.isExpanded(node));
  }

  /** Bütün dalları açar; kapatırken kök düğümler açık kalır, alt düzeyler kapanır. */
  tumunuAc(acik: boolean): void {
    const gez = (dugumler: MenuTreeDto[], derinlik: number) => {
      for (const dugum of dugumler) {
        if (!this.hasChildren(dugum)) continue;
        this.acikDurumlar.set(dugum.id, acik || derinlik === 0);
        gez(dugum.children, derinlik + 1);
      }
    };
    gez(this.nodes, this.derinlik);
  }

  /** Alt düzeylerdeki bütün dallar açık mı ("Tümünü aç/kapat" düğmesinin durumu). */
  hepsiAcik(): boolean {
    const altDallar: MenuTreeDto[] = [];
    const gez = (dugumler: MenuTreeDto[], derinlik: number) => {
      for (const dugum of dugumler.filter(d => this.hasChildren(d))) {
        if (derinlik > 0) altDallar.push(dugum);
        gez(dugum.children, derinlik + 1);
      }
    };
    gez(this.nodes, this.derinlik);
    return altDallar.length > 0 && altDallar.every(d => this.acikDurumlar.get(d.id) === true);
  }

  /** Sekme düğümü (ör. finans-sekme-po-fatura): R sekmeyi ve içindeki bütün verileri gösterir, W sekmedeki bütün işlemleri verir. */
  sekmeDugumu(node: MenuTreeDto): boolean {
    return (node.kod ?? '').includes('-sekme-');
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
    const sonraki = this.sonrakiSeviye(node.yetkiTipiId, node.parent?.yetkiTipiId ?? YetkiTipi.W);
    // Sekme kapatılırken altındaki seçimler de kapanır; kayıtta rolden silineceği için önce sorulur.
    if (sonraki === YetkiTipi.N && this.sekmeDugumu(node) && this.seciliAltVar(node)) {
      this.kutuyuEsitle(node, checkbox);
      void this.confirm.ask({
        title: this.ts.translate('PERMISSIONS.TAB_OFF_TITLE'),
        message: duzMetin(this.ts.translate('PERMISSIONS.TAB_OFF_MESSAGE')),
        confirmText: this.ts.translate('PERMISSIONS.TAB_OFF_CONFIRM'),
        type: 'warning',
      }).then(onay => {
        if (onay) this.uygula(node, sonraki, checkbox);
      });
      return;
    }
    this.uygula(node, sonraki, checkbox);
  }

  private uygula(node: MenuTreeDto, seviye: number, checkbox?: HTMLInputElement): void {
    const onceki = node.yetkiTipiId;
    this.setPermission(node, seviye);
    this.altSekmeleriYukselt(node, onceki, seviye);
    this.capChildren(node);
    this.kutuyuEsitle(node, checkbox);
  }

  /**
   * Sekme açılınca/yükseltilince sekmeyle aynı seviyedeki alt sekmeler (ör. finans-sekme-is-takibi-aylik) onu izler:
   * sekme R → W yapılınca R olan alt sekmeler W olur, N → R açılınca bütün alt sekmeler R olur. Sekme açıkken bilinçli
   * kapatılmış (N) alt sekme yükseltmede kapalı kalır. İşlem ve diğer modül düğümleri etkilenmez.
   */
  private altSekmeleriYukselt(node: MenuTreeDto, onceki: number, yeni: number): void {
    if (yeni <= onceki || !this.sekmeDugumu(node)) return;
    for (const alt of node.children ?? []) {
      if (this.sekmeDugumu(alt) && alt.yetkiTipiId === onceki) this.setPermission(alt, yeni);
    }
  }

  /**
   * Indeterminate bir checkbox'a tıklamak, Angular [checked] ifadesi false kalsa da DOM'daki `checked`
   * değerini değiştirir (R -> N). Görünen durum modelle aynı kalmalı.
   */
  private kutuyuEsitle(node: MenuTreeDto, checkbox?: HTMLInputElement): void {
    if (!checkbox) return;
    checkbox.checked = node.yetkiTipiId === YetkiTipi.W;
    checkbox.indeterminate = node.yetkiTipiId === YetkiTipi.R;
  }

  private seciliAltVar(node: MenuTreeDto): boolean {
    return (node.children ?? []).some(c => c.yetkiTipiId !== YetkiTipi.N || this.seciliAltVar(c));
  }

  private aramaVar(): boolean {
    return !!this.arama?.trim();
  }

  /** Üst R altında N ↔ R, üst W altında N → R → W → N. */
  private sonrakiSeviye(mevcut: number, parentPermission: number): number {
    if (mevcut === YetkiTipi.N) return YetkiTipi.R;
    if (mevcut === YetkiTipi.R) return parentPermission === YetkiTipi.W ? YetkiTipi.W : YetkiTipi.N;
    return YetkiTipi.N;
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
