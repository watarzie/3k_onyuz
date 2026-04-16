import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgClass } from '@angular/common';
import { TranslationService } from '../../../core/services/translation.service';
import { SandikService } from '../../../core/services/sandik.service';
import { ProjeService } from '../../../core/services/proje.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { ToastService } from '../../../core/services/toast.service';
import { PermissionService } from '../../../core/services/permission.service';
import { AuthService } from '../../../core/auth/auth.service';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { BreadcrumbComponent } from '../../../shared/components/breadcrumb/breadcrumb.component';
import { StatCardComponent } from '../../../shared/components/stat-card/stat-card.component';
import { SandikDto } from '../../../shared/models/index';

@Component({
  selector: 'app-uck-sandiklar',
  standalone: true,
  imports: [RouterLink, NgClass, StatusBadgeComponent, BreadcrumbComponent, StatCardComponent],
  templateUrl: './uck-sandiklar.component.html',
  styleUrl: './uck-sandiklar.component.scss',
})
export class UcKSandiklarComponent implements OnInit {
  ts = inject(TranslationService);
  private route = inject(ActivatedRoute);
  private sandikService = inject(SandikService);
  private projeService = inject(ProjeService);
  private confirmService = inject(ConfirmService);
  private toast = inject(ToastService);
  private permissionService = inject(PermissionService);
  private auth = inject(AuthService);

  isAdmin = computed(() => this.auth.hasRole('Admin'));

  projeId = signal(0);
  sandiklar = signal<SandikDto[]>([]);
  filtered = signal<SandikDto[]>([]);
  loading = signal(true);
  searchTerm = signal('');

  breadcrumb: { label: string; link?: string }[] = [];

  // Stats
  get hazirCount(): number { return this.sandiklar().filter(s => s.durum === 'Hazir').length; }
  get hazirlaniyorCount(): number { return this.sandiklar().filter(s => s.durum === 'Hazirlaniyor').length; }
  get sevkedildiCount(): number { return this.sandiklar().filter(s => s.durum === 'Sevkedildi').length; }

  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('projeId'));
    this.projeId.set(id);
    this.breadcrumb = [
      { label: 'Ana Kontrol Paneli', link: '/dashboard' },
      { label: 'Projeler', link: '/projeler' },
      { label: '3K Modülü' },
    ];
    this.loadSandiklar();
  }

  loadSandiklar() {
    this.loading.set(true);
    this.sandikService.getSandiklar(this.projeId()).subscribe((res) => {
      this.loading.set(false);
      if (res.isSuccess && res.value) {
        const sorted = [...res.value].sort((a, b) => this.extractNumber(a.sandikNo) - this.extractNumber(b.sandikNo));
        this.sandiklar.set(sorted);
        this.filtered.set(sorted);
      }
    });
  }

  /** SandıkNo'dan numerik değer çıkar — "Sandik-3" → 3, "5" → 5 */
  private extractNumber(sandikNo: string): number {
    const match = sandikNo.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  /** Sadece numarayı göster */
  getDisplayNo(sandikNo: string): string {
    const match = sandikNo.match(/(\d+)/);
    return match ? match[1] : sandikNo;
  }

  onSearch(event: Event) {
    const term = (event.target as HTMLInputElement).value.toLowerCase();
    this.searchTerm.set(term);
    if (!term) {
      this.filtered.set(this.sandiklar());
    } else {
      this.filtered.set(
        this.sandiklar().filter(s =>
          s.sandikNo.toLowerCase().includes(term) ||
          s.durum.toLowerCase().includes(term)
        )
      );
    }
  }

  getDurumLabel(durum: string): string {
    const map: Record<string, string> = {
      Bos: 'BOŞ', Hazirlaniyor: 'HAZIRLANIYOR', Hazir: 'HAZIR', Sevkedildi: 'SEVK EDİLDİ',
    };
    return map[durum] ?? durum;
  }

  getDurumColor(durum: string): string {
    const map: Record<string, string> = {
      Bos: '#94A3B8', Hazirlaniyor: '#FD5812', Hazir: '#25B003', Sevkedildi: '#3584FC',
    };
    return map[durum] ?? '#94A3B8';
  }

  getDurumIcon(durum: string): string {
    const map: Record<string, string> = {
      Bos: 'ri-inbox-line', Hazirlaniyor: 'ri-loader-4-line', Hazir: 'ri-checkbox-circle-line', Sevkedildi: 'ri-truck-line',
    };
    return map[durum] ?? 'ri-inbox-line';
  }

  async toggleSandikDurum(event: Event, sandik: SandikDto) {
    event.preventDefault();
    event.stopPropagation();
    
    if (!this.isAdmin()) return;

    const isHazir = sandik.durum === 'Hazir';
    const actionText = isHazir ? 'Sandığı tekrar "Hazırlanıyor" durumuna almak' : 'Sandığı "Hazır" olarak işaretlemek';
    
    const confirm = await this.confirmService.ask({
      title: 'Sandık Durumu',
      message: `${actionText} istediğinize emin misiniz?`,
      confirmText: 'Evet, Değiştir',
      cancelText: 'İptal',
      type: isHazir ? 'warning' : 'info'
    });

    if (confirm) {
      this.projeService.sandikKapat(sandik.id, !isHazir).subscribe({
        next: (res) => {
          if (res.isSuccess) {
            this.toast.success(isHazir ? 'Sandık tekrar hazırlanıyor konumuna alındı.' : 'Sandık başarıyla hazır olarak işaretlendi.');
            this.loadSandiklar();
          } else {
            this.toast.error(res.error || 'İşlem başarısız oldu.');
          }
        },
        error: () => this.toast.error('Beklenmeyen bir hata oluştu.')
      });
    }
  }
}
