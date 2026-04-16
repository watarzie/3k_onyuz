import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { RolService } from '../../core/services/rol.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { RolDto, RolDetayDto, MenuTreeDto, RolYetkiItemDto, RolGuncelleRequest } from '../../shared/models';
import { MenuTreeComponent } from './menu-tree/menu-tree.component';

@Component({
  selector: 'app-rol-yonetimi',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslatePipe, MenuTreeComponent],
  templateUrl: './rol-yonetimi.component.html',
  styleUrls: ['./rol-yonetimi.component.scss'],
})
export class RolYonetimiComponent implements OnInit {
  private rolService = inject(RolService);
  private toast = inject(ToastService);
  private confirmSvc = inject(ConfirmService);

  isLoading = signal(false);
  isDetailLoading = signal(false);

  allRoles = signal<RolDto[]>([]);
  roleSearchTerm = signal('');
  selectedRole = signal<RolDetayDto | null>(null);
  isSaving = signal(false);

  /** Yeni rol ekleme modali */
  showAddModal = signal(false);
  newRoleName = signal('');

  displayedRoles = computed(() => {
    const list = this.allRoles();
    const term = this.roleSearchTerm().toLowerCase().trim();
    if (!term) return list;
    return list.filter(r => r.ad.toLowerCase().includes(term));
  });

  ngOnInit(): void {
    this.loadRoles();
  }

  loadRoles(): void {
    this.isLoading.set(true);
    this.rolService.getRoller().subscribe({
      next: (data) => {
        this.allRoles.set(data.sort((a, b) => a.ad.localeCompare(b.ad)));
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }

  onSelectRole(role: RolDto): void {
    this.isDetailLoading.set(true);
    this.rolService.getRolDetay(role.id).subscribe({
      next: (detay) => {
        // Parent referanslarını set et (recursive)
        detay.menuAgaci.forEach(m => this.setParentRefs(m));
        this.selectedRole.set(detay);
        this.isDetailLoading.set(false);
      },
      error: () => {
        this.isDetailLoading.set(false);
      },
    });
  }

  savePermissions(): void {
    const rol = this.selectedRole();
    if (!rol) return;

    this.isSaving.set(true);

    // Tüm menü node'larından yetki listesi çıkar (recursive)
    const yetkiler: RolYetkiItemDto[] = [];
    this.collectPermissions(rol.menuAgaci, yetkiler);

    const request: RolGuncelleRequest = {
      id: rol.id,
      ad: rol.ad,
      yetkiler,
    };

    this.rolService.rolGuncelle(request).subscribe({
      next: (updated) => {
        updated.menuAgaci.forEach(m => this.setParentRefs(m));
        this.selectedRole.set(updated);
        this.isSaving.set(false);
        this.toast.success('Yetki ayarları başarıyla kaydedildi.');
      },
      error: () => {
        this.isSaving.set(false);
        this.toast.error('Yetki ayarları kaydedilemedi.');
      },
    });
  }

  // ===== Yeni Rol Ekleme =====

  openAddModal(): void {
    this.newRoleName.set('');
    this.showAddModal.set(true);
  }

  closeAddModal(): void {
    this.showAddModal.set(false);
  }

  addRole(): void {
    const name = this.newRoleName().trim();
    if (!name) return;

    this.rolService.rolOlustur(name).subscribe({
      next: () => {
        this.toast.success(`"${name}" rolü başarıyla oluşturuldu.`);
        this.showAddModal.set(false);
        this.loadRoles();
      },
      error: () => {
        this.toast.error('Rol oluşturma başarısız.');
      },
    });
  }

  // ===== Rol Silme =====

  async deleteRole(role: RolDto, event: Event): Promise<void> {
    event.stopPropagation();
    const onay = await this.confirmSvc.ask({
      title: 'Rol Sil',
      message: `"${role.ad}" rolünü silmek istediğinize emin misiniz?`,
      confirmText: 'Sil',
      type: 'danger',
    });
    if (!onay) return;

    this.rolService.rolSil(role.id).subscribe({
      next: () => {
        this.toast.success(`"${role.ad}" rolü silindi.`);
        if (this.selectedRole()?.id === role.id) {
          this.selectedRole.set(null);
        }
        this.loadRoles();
      },
      error: () => {
        this.toast.error('Rol silinemedi.');
      },
    });
  }

  // ===== Private Helpers =====

  private setParentRefs(node: MenuTreeDto, parent?: MenuTreeDto): void {
    node.parent = parent;
    node.children?.forEach(c => this.setParentRefs(c, node));
  }

  private collectPermissions(nodes: MenuTreeDto[], result: RolYetkiItemDto[]): void {
    for (const node of nodes) {
      result.push({ menuTanimiId: node.id, yetkiTipi: node.yetkiTipi });
      if (node.children?.length) {
        this.collectPermissions(node.children, result);
      }
    }
  }
}
