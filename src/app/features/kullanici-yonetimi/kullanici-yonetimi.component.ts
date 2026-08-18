import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { KullaniciService } from '../../core/services/kullanici.service';
import { RolService } from '../../core/services/rol.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { BildirimService } from '../../core/services/bildirim.service';
import { PermissionService } from '../../core/services/permission.service';
import { TranslationService } from '../../core/services/translation.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { BildirimAbonelikAyariDto, KullaniciDto, KullaniciGuncelleRequest, RolDto, RegisterDto } from '../../shared/models';

@Component({
  selector: 'app-kullanici-yonetimi',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslatePipe],
  templateUrl: './kullanici-yonetimi.component.html',
  styleUrls: ['./kullanici-yonetimi.component.scss'],
})
export class KullaniciYonetimiComponent implements OnInit {
  private kullaniciService = inject(KullaniciService);
  private rolService = inject(RolService);
  private toast = inject(ToastService);
  private confirmSvc = inject(ConfirmService);
  private bildirimService = inject(BildirimService);
  private permissions = inject(PermissionService);
  private translation = inject(TranslationService);

  canManageNotifications = computed(() => this.permissions.canWrite('kullanicilar'));
  canManageTwoFactor = computed(() => this.permissions.canWrite('kullanicilar'));

  isLoading = signal(false);
  kullanicilar = signal<KullaniciDto[]>([]);
  roller = signal<RolDto[]>([]);
  searchTerm = signal('');
  twoFactorPolicyPendingIds = signal<ReadonlySet<number>>(new Set<number>());
  twoFactorResetPendingIds = signal<ReadonlySet<number>>(new Set<number>());
  private twoFactorMutationVersions = new Map<number, number>();

  // Düzenleme modali
  showEditModal = signal(false);
  editData = signal<KullaniciGuncelleRequest>({ id: 0, adSoyad: '', rolId: 0 });
  isSaving = signal(false);

  // Yeni kullanıcı modali
  showAddModal = signal(false);
  newUser = signal<RegisterDto>({ adSoyad: '', email: '', sifre: '', rolId: 0 });

  // Bildirim alıcı ayarları
  showNotificationSettings = signal(false);
  notificationSettingsLoading = signal(false);
  notificationSettingsSaving = signal(false);
  notificationSettings = signal<BildirimAbonelikAyariDto[]>([]);

  filteredKullanicilar = computed(() => {
    const list = this.kullanicilar();
    const term = this.searchTerm().toLowerCase().trim();
    if (!term) return list;
    return list.filter(
      k =>
        k.adSoyad.toLowerCase().includes(term) ||
        k.email.toLowerCase().includes(term) ||
        k.rol.toLowerCase().includes(term)
    );
  });

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    const mutationVersionsAtRequest = new Map(this.twoFactorMutationVersions);
    this.isLoading.set(true);
    this.kullaniciService.getKullanicilar().subscribe({
      next: (res) => {
        if (res.isSuccess) {
          this.mergeLoadedUsers(res.value ?? [], mutationVersionsAtRequest);
        }
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
    this.rolService.getRoller().subscribe({
      next: (data) => this.roller.set(data),
    });
  }

  openNotificationSettings(): void {
    if (!this.canManageNotifications()) return;

    this.showNotificationSettings.set(true);
    this.notificationSettingsLoading.set(true);
    this.bildirimService.getAbonelikAyarlari().subscribe(res => {
      this.notificationSettingsLoading.set(false);
      if (res.isSuccess && res.value) {
        this.notificationSettings.set(res.value);
      } else {
        this.toast.error(res.error || 'Bildirim alıcıları yüklenemedi.');
      }
    });
  }

  closeNotificationSettings(): void {
    if (this.notificationSettingsSaving()) return;
    this.showNotificationSettings.set(false);
  }

  toggleNotificationSetting(
    kullaniciId: number,
    field: 'cekiYuklendiBildirimi' | 'cekiRevizyonuBildirimi'
  ): void {
    this.notificationSettings.update(items => items.map(item =>
      item.kullaniciId === kullaniciId ? { ...item, [field]: !item[field] } : item
    ));
  }

  saveNotificationSettings(): void {
    if (this.notificationSettingsSaving()) return;

    const settings = this.notificationSettings();
    this.notificationSettingsSaving.set(true);
    this.bildirimService.updateAbonelikAyarlari({
      cekiYuklendiAliciIdleri: settings
        .filter(item => item.cekiYuklendiBildirimi)
        .map(item => item.kullaniciId),
      cekiRevizyonuAliciIdleri: settings
        .filter(item => item.cekiRevizyonuBildirimi)
        .map(item => item.kullaniciId),
    }).subscribe(res => {
      this.notificationSettingsSaving.set(false);
      if (!res.isSuccess) {
        this.toast.error(res.error || 'Bildirim alıcıları kaydedilemedi.');
        return;
      }

      this.showNotificationSettings.set(false);
      this.toast.success('Bildirim alıcıları başarıyla güncellendi.');
    });
  }

  // ===== Düzenleme =====
  openEditModal(k: KullaniciDto): void {
    this.editData.set({ id: k.id, adSoyad: k.adSoyad, rolId: k.rolId });
    this.showEditModal.set(true);
  }

  closeEditModal(): void {
    this.showEditModal.set(false);
  }

  saveEdit(): void {
    this.isSaving.set(true);
    this.kullaniciService.guncelle(this.editData()).subscribe({
      next: () => {
        this.showEditModal.set(false);
        this.isSaving.set(false);
        this.toast.success('Kullanıcı başarıyla güncellendi.');
        this.loadData();
      },
      error: () => {
        this.isSaving.set(false);
        this.toast.error('Kullanıcı güncellenirken hata oluştu.');
      },
    });
  }

  // ===== Kullanıcı Bazlı 2FA =====
  isTwoFactorBusy(kullaniciId: number): boolean {
    return (
      this.twoFactorPolicyPendingIds().has(kullaniciId) ||
      this.twoFactorResetPendingIds().has(kullaniciId)
    );
  }

  updateTwoFactorRequirement(kullanici: KullaniciDto, zorunluMu: boolean): void {
    if (!this.canManageTwoFactor() || this.isTwoFactorBusy(kullanici.id)) return;

    const previousValue = kullanici.ikiFaktorZorunluMu;
    this.bumpTwoFactorMutationVersion(kullanici.id);
    this.setPolicyPending(kullanici.id, true);
    this.kullanicilar.update(items => items.map(item =>
      item.id === kullanici.id ? { ...item, ikiFaktorZorunluMu: zorunluMu } : item
    ));

    this.kullaniciService
      .ikiFaktorZorunlulugunuGuncelle(kullanici.id, zorunluMu)
      .subscribe(result => {
        this.setPolicyPending(kullanici.id, false);

        const status = result.value;
        if (!result.isSuccess || !status || status.kullaniciId !== kullanici.id) {
          this.bumpTwoFactorMutationVersion(kullanici.id);
          this.kullanicilar.update(items => items.map(item =>
            item.id === kullanici.id
              ? { ...item, ikiFaktorZorunluMu: previousValue }
              : item
          ));
          this.toast.error(
            result.error || this.translation.translate('USER.TWO_FACTOR_UPDATE_FAILED')
          );
          return;
        }

        this.bumpTwoFactorMutationVersion(kullanici.id);
        this.kullanicilar.update(items => items.map(item =>
          item.id === status.kullaniciId
            ? {
                ...item,
                ikiFaktorZorunluMu: status.ikiFaktorZorunluMu,
                ikiFaktorEtkinMi: status.ikiFaktorEtkinMi,
                ikiFaktorDogrulandiTarihiUtc: status.ikiFaktorDogrulandiTarihiUtc,
              }
            : item
        ));
        this.toast.success(
          this.translation.translate(
            status.ikiFaktorZorunluMu
              ? 'USER.TWO_FACTOR_ENABLED_SUCCESS'
              : 'USER.TWO_FACTOR_DISABLED_SUCCESS'
          )
        );
      });
  }

  async resetTwoFactor(kullanici: KullaniciDto): Promise<void> {
    if (
      !this.canManageTwoFactor() ||
      !kullanici.ikiFaktorEtkinMi ||
      this.isTwoFactorBusy(kullanici.id)
    ) {
      return;
    }

    const confirmed = await this.confirmSvc.ask({
      title: this.translation.translate('USER.TWO_FACTOR_RESET_TITLE'),
      message: this.translation
        .translate('USER.TWO_FACTOR_RESET_CONFIRM')
        .replace('{0}', kullanici.adSoyad),
      confirmText: this.translation.translate('USER.TWO_FACTOR_RESET_ACTION'),
      cancelText: this.translation.translate('COMMON.CANCEL'),
      type: 'warning',
    });
    if (!confirmed) return;

    const current = this.kullanicilar().find(item => item.id === kullanici.id);
    if (!current?.ikiFaktorEtkinMi || this.isTwoFactorBusy(kullanici.id)) return;

    this.setResetPending(kullanici.id, true);
    this.kullaniciService.ikiFaktorKurulumunuSifirla(kullanici.id).subscribe(result => {
      this.setResetPending(kullanici.id, false);
      if (!result.isSuccess) {
        this.toast.error(
          result.error || this.translation.translate('USER.TWO_FACTOR_RESET_FAILED')
        );
        return;
      }

      this.bumpTwoFactorMutationVersion(kullanici.id);
      this.kullanicilar.update(items => items.map(item =>
        item.id === kullanici.id
          ? {
              ...item,
              ikiFaktorEtkinMi: false,
              ikiFaktorDogrulandiTarihiUtc: null,
            }
          : item
      ));
      this.toast.success(this.translation.translate('USER.TWO_FACTOR_RESET_SUCCESS'));
    });
  }

  twoFactorStatusTitle(kullanici: KullaniciDto): string {
    if (!kullanici.ikiFaktorEtkinMi) {
      return this.translation.translate('USER.TWO_FACTOR_NOT_ENROLLED_HELP');
    }

    const verifiedAt = kullanici.ikiFaktorDogrulandiTarihiUtc;
    if (!verifiedAt) return this.translation.translate('USER.TWO_FACTOR_ENROLLED');

    const parsed = new Date(verifiedAt);
    if (Number.isNaN(parsed.getTime())) {
      return this.translation.translate('USER.TWO_FACTOR_ENROLLED');
    }

    const locale = this.translation.currentLang() === 'tr' ? 'tr-TR' : 'en-US';
    return this.translation
      .translate('USER.TWO_FACTOR_VERIFIED_AT')
      .replace('{0}', parsed.toLocaleString(locale));
  }

  // ===== Yeni Kullanıcı =====
  openAddModal(): void {
    this.newUser.set({ adSoyad: '', email: '', sifre: '', rolId: this.roller()[0]?.id ?? 0 });
    this.showAddModal.set(true);
  }

  closeAddModal(): void {
    this.showAddModal.set(false);
  }

  addUser(): void {
    this.isSaving.set(true);
    this.kullaniciService.olustur(this.newUser()).subscribe({
      next: () => {
        this.showAddModal.set(false);
        this.isSaving.set(false);
        this.toast.success('Kullanıcı başarıyla oluşturuldu.');
        this.loadData();
      },
      error: () => {
        this.isSaving.set(false);
        this.toast.error('Kullanıcı oluşturulurken hata oluştu.');
      },
    });
  }

  // ===== Silme =====
  async deleteUser(k: KullaniciDto): Promise<void> {
    const onay = await this.confirmSvc.ask({
      title: 'Kullanıcı Sil',
      message: `"${k.adSoyad}" kullanıcısını silmek istediğinize emin misiniz?`,
      confirmText: 'Sil',
      type: 'danger',
    });
    if (!onay) return;
    this.kullaniciService.sil(k.id).subscribe({
      next: () => {
        this.toast.success('Kullanıcı başarıyla silindi.');
        this.loadData();
      },
      error: () => this.toast.error('Kullanıcı silinirken hata oluştu.'),
    });
  }

  // ===== Şifre Değiştirme =====
  showPasswordModal = signal(false);
  passwordUserId = signal(0);
  passwordUserName = signal('');
  newPassword = signal('');
  confirmPassword = signal('');
  showNewPassword = signal(false);
  showConfirmPassword = signal(false);

  openPasswordModal(k: KullaniciDto): void {
    this.passwordUserId.set(k.id);
    this.passwordUserName.set(k.adSoyad);
    this.newPassword.set('');
    this.confirmPassword.set('');
    this.showNewPassword.set(false);
    this.showConfirmPassword.set(false);
    this.showPasswordModal.set(true);
  }

  closePasswordModal(): void {
    this.showPasswordModal.set(false);
  }

  toggleNewPassword(): void {
    this.showNewPassword.update(v => !v);
  }

  toggleConfirmPassword(): void {
    this.showConfirmPassword.update(v => !v);
  }

  savePassword(): void {
    const pw = this.newPassword().trim();
    const confirm = this.confirmPassword().trim();

    if (!pw || pw.length < 6) {
      this.toast.warning('Şifre en az 6 karakter olmalıdır.');
      return;
    }
    if (pw !== confirm) {
      this.toast.warning('Şifreler eşleşmiyor.');
      return;
    }

    this.isSaving.set(true);
    this.kullaniciService.sifreDegistir(this.passwordUserId(), pw).subscribe({
      next: () => {
        this.showPasswordModal.set(false);
        this.isSaving.set(false);
        this.toast.success('Şifre başarıyla değiştirildi.');
      },
      error: () => {
        this.isSaving.set(false);
        this.toast.error('Şifre değiştirilirken hata oluştu.');
      },
    });
  }

  // ===== Rol badge rengi =====
  getRolBadgeClass(rol: string): string {
    switch (rol) {
      case 'Admin':
        return 'badge-admin';
      case 'Yonetici':
        return 'badge-yonetici';
      case 'Personel3K':
        return 'badge-3k';
      case 'PersonelGrid':
        return 'badge-grid';
      default:
        return 'badge-default';
    }
  }

  updateEditField(field: keyof KullaniciGuncelleRequest, value: any): void {
    this.editData.update(d => ({ ...d, [field]: value }));
  }

  updateNewUserField(field: keyof RegisterDto, value: any): void {
    this.newUser.update(d => ({ ...d, [field]: value }));
  }

  private setPolicyPending(kullaniciId: number, pending: boolean): void {
    this.twoFactorPolicyPendingIds.update(current => {
      const next = new Set(current);
      pending ? next.add(kullaniciId) : next.delete(kullaniciId);
      return next;
    });
  }

  private setResetPending(kullaniciId: number, pending: boolean): void {
    this.twoFactorResetPendingIds.update(current => {
      const next = new Set(current);
      pending ? next.add(kullaniciId) : next.delete(kullaniciId);
      return next;
    });
  }

  private bumpTwoFactorMutationVersion(kullaniciId: number): void {
    this.twoFactorMutationVersions.set(
      kullaniciId,
      (this.twoFactorMutationVersions.get(kullaniciId) ?? 0) + 1
    );
  }

  private mergeLoadedUsers(
    loadedUsers: KullaniciDto[],
    mutationVersionsAtRequest: ReadonlyMap<number, number>
  ): void {
    const currentById = new Map(this.kullanicilar().map(item => [item.id, item]));
    const policyPending = this.twoFactorPolicyPendingIds();
    const resetPending = this.twoFactorResetPendingIds();

    this.kullanicilar.set(loadedUsers.map(loaded => {
      const current = currentById.get(loaded.id);
      if (!current) return loaded;

      const stateChangedDuringRequest =
        (this.twoFactorMutationVersions.get(loaded.id) ?? 0) !==
        (mutationVersionsAtRequest.get(loaded.id) ?? 0);
      const mutationPending = policyPending.has(loaded.id) || resetPending.has(loaded.id);
      if (!stateChangedDuringRequest && !mutationPending) return loaded;

      return {
        ...loaded,
        ikiFaktorZorunluMu: current.ikiFaktorZorunluMu,
        ikiFaktorEtkinMi: current.ikiFaktorEtkinMi,
        ikiFaktorDogrulandiTarihiUtc: current.ikiFaktorDogrulandiTarihiUtc,
      };
    }));
  }
}
