import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { KullaniciService } from '../../core/services/kullanici.service';
import { RolService } from '../../core/services/rol.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { KullaniciDto, KullaniciGuncelleRequest, RolDto, RegisterDto } from '../../shared/models';

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

  isLoading = signal(false);
  kullanicilar = signal<KullaniciDto[]>([]);
  roller = signal<RolDto[]>([]);
  searchTerm = signal('');

  // Düzenleme modali
  showEditModal = signal(false);
  editData = signal<KullaniciGuncelleRequest>({ id: 0, adSoyad: '', rolId: 0 });
  isSaving = signal(false);

  // Yeni kullanıcı modali
  showAddModal = signal(false);
  newUser = signal<RegisterDto>({ adSoyad: '', email: '', sifre: '', rolId: 0 });

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
    this.isLoading.set(true);
    this.kullaniciService.getKullanicilar().subscribe({
      next: (res) => {
        this.kullanicilar.set(res.value ?? []);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
    this.rolService.getRoller().subscribe({
      next: (data) => this.roller.set(data),
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
        this.loadData();
      },
      error: () => this.isSaving.set(false),
    });
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
        this.loadData();
      },
      error: () => this.isSaving.set(false),
    });
  }

  // ===== Silme =====
  deleteUser(k: KullaniciDto): void {
    if (!confirm(`"${k.adSoyad}" kullanıcısını silmek istediğinize emin misiniz?`)) return;
    this.kullaniciService.sil(k.id).subscribe({
      next: () => this.loadData(),
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
}
