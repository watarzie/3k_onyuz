import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { DatePipe, NgClass } from '@angular/common';
import { OnayService } from '../../core/services/onay.service';
import { ToastService } from '../../core/services/toast.service';
import { PermissionService } from '../../core/services/permission.service';
import { OnayBekleyenIslemDto } from '../../shared/models/onay-bekleyen-islem.model';
import { BreadcrumbComponent } from '../../shared/components/breadcrumb/breadcrumb.component';

@Component({
  selector: 'app-onay-listesi',
  standalone: true,
  imports: [DatePipe, NgClass, BreadcrumbComponent],
  templateUrl: './onay-listesi.component.html',
  styleUrls: ['./onay-listesi.component.scss']
})
export class OnayListesiComponent implements OnInit {
  private onayService = inject(OnayService);
  private toast = inject(ToastService);
  private permissions = inject(PermissionService);

  public canWrite = computed(() => this.permissions.canWrite('islem-onay-merkezi'));

  bekleyenler = signal<OnayBekleyenIslemDto[]>([]);
  kurallar = signal<any[]>([]);
  loading = signal<boolean>(true);
  showKurallarModal = signal<boolean>(false);
  onayModalIslem = signal<OnayBekleyenIslemDto | null>(null);
  onaySubmitting = signal<boolean>(false);
  retModalIslem = signal<OnayBekleyenIslemDto | null>(null);
  redAciklamasi = signal<string>('');
  retSubmitting = signal<boolean>(false);

  breadcrumb = [
    { label: 'Ana Kontrol Paneli', link: '/dashboard' },
    { label: 'İşlem Onay Merkezi' }
  ];

  ngOnInit(): void {
    this.loadData();
    if (this.canWrite()) {
      this.loadKurallar();
    }
  }

  loadKurallar() {
    this.onayService.getKurallar().subscribe((res) => {
      if (res.isSuccess && res.value) {
        this.kurallar.set(res.value);
      }
    });
  }

  toggleKural(kural: any) {
    const newValue = !kural.onayGerektirirMi;
    // Optimistic update
    kural.onayGerektirirMi = newValue;
    this.kurallar.set([...this.kurallar()]);

    this.onayService.updateKural(kural.lookupUcKDurumId, newValue).subscribe(res => {
      if (res.isSuccess) {
        this.toast.success('Kural başarıyla güncellendi. Sistem saniyesinde adapte oldu.');
      } else {
        kural.onayGerektirirMi = !newValue;
        this.kurallar.set([...this.kurallar()]);
        this.toast.error(res.error || 'Güncelleme başarısız!');
      }
    });
  }

  openSettingsModal() {
    this.loadKurallar();
    this.showKurallarModal.set(true);
  }

  closeSettingsModal() {
    this.showKurallarModal.set(false);
  }

  loadData() {
    this.loading.set(true);
    this.onayService.getBekleyenler().subscribe((res) => {
      this.loading.set(false);
      if (res.isSuccess && res.value) {
        this.bekleyenler.set(res.value);
      } else {
        this.toast.error(res.error || 'Veriler yüklenemedi.');
      }
    });
  }

  openOnayModal(islem: OnayBekleyenIslemDto) {
    this.onayModalIslem.set(islem);
  }

  closeOnayModal() {
    if (this.onaySubmitting()) return;
    this.onayModalIslem.set(null);
  }

  submitOnayModal() {
    const islem = this.onayModalIslem();

    if (!islem || this.onaySubmitting()) return;

    this.onaySubmitting.set(true);
    this.onayService.onayla({ onayBekleyenIslemId: islem.id }).subscribe({
      next: (res) => {
        this.onaySubmitting.set(false);
        if (res.isSuccess) {
          this.toast.success('İşlem başarıyla onaylandı ve çalıştırıldı.');
          this.closeOnayModal();
          this.loadData();
        } else {
          this.toast.error(res.error || 'Onay işlemi başarısız.');
        }
      },
      error: () => {
        this.onaySubmitting.set(false);
        this.toast.error('Onay işlemi başarısız.');
      }
    });
  }

  openRetModal(islem: OnayBekleyenIslemDto) {
    this.retModalIslem.set(islem);
    this.redAciklamasi.set('');
  }

  closeRetModal() {
    if (this.retSubmitting()) return;
    this.retModalIslem.set(null);
    this.redAciklamasi.set('');
  }

  updateRedAciklamasi(event: Event) {
    this.redAciklamasi.set((event.target as HTMLTextAreaElement).value);
  }

  submitRetModal() {
    const islem = this.retModalIslem();
    const reason = this.redAciklamasi().trim();

    if (!islem || this.retSubmitting()) return;

    if (!reason) {
      this.toast.warning('Reddetme sebebi zorunludur.');
      return;
    }

    this.retSubmitting.set(true);
    this.onayService.reddet({ onayBekleyenIslemId: islem.id, redAciklamasi: reason }).subscribe({
      next: (res) => {
        this.retSubmitting.set(false);
        if (res.isSuccess) {
          this.toast.success('İşlem isteği reddedildi.');
          this.closeRetModal();
          this.loadData();
        } else {
          this.toast.error(res.error || 'Kayıt başarısız.');
        }
      },
      error: () => {
        this.retSubmitting.set(false);
        this.toast.error('Kayıt başarısız.');
      }
    });
  }
}
