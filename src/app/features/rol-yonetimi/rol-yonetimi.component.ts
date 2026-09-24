import { Component, inject, signal, computed, OnInit, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { RolService } from '../../core/services/rol.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { RolDto, RolDetayDto, MenuTreeDto, RolYetkiItemDto, RolGuncelleRequest } from '../../shared/models';
import { MenuTreeComponent } from './menu-tree/menu-tree.component';
import { PermissionService } from '../../core/services/permission.service';
import { RolSablonu } from '../../shared/models';

@Component({
  selector: 'app-rol-yonetimi',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslatePipe, MenuTreeComponent],
  templateUrl: './rol-yonetimi.component.html',
  styleUrls: ['./rol-yonetimi.component.scss'],
})
export class RolYonetimiComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
  private permissions = inject(PermissionService);
  canManage = computed(() => this.permissions.canWrite('rol-yonetimi'));
  templates = signal<RolSablonu[]>([]);
  selectedTemplate = signal('');
  private detailVersion = 0;
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
    this.rolService.getSablonlar().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: items => this.templates.set(items),
      error: () => this.templates.set([]),
    });
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
    const version = ++this.detailVersion;
    this.isDetailLoading.set(true);
    this.rolService.getRolDetay(role.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (detay) => {
        if (version !== this.detailVersion) return;
        // Parent referanslarını set et (recursive)
        detay.menuAgaci.forEach(m => this.setParentRefs(m));
        this.selectedRole.set(detay);
        this.isDetailLoading.set(false);
      },
      error: () => {
        if (version !== this.detailVersion) return;
        this.isDetailLoading.set(false);
      },
    });
  }

  savePermissions(): void {
    if (!this.canManage() || this.isSaving()) return;
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
        this.permissions.notifyPermissionsChanged();
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
    if (!this.canManage()) return;
    this.selectedTemplate.set('');
    this.newRoleName.set('');
    this.showAddModal.set(true);
  }

  closeAddModal(): void {
    this.showAddModal.set(false);
  }

  addRole(): void {
    if (!this.canManage()) return;
    const name = this.newRoleName().trim();
    if (!name) return;

    this.rolService.rolOlustur(name, this.selectedTemplate() || undefined).subscribe({
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
    if (!this.canManage()) return;
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
      result.push({ menuTanimiId: node.id, yetkiTipiId: node.yetkiTipiId });
      if (node.children?.length) {
        this.collectPermissions(node.children, result);
      }
    }
  }
}
