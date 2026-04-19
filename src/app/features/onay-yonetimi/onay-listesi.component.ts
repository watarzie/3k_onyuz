import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { DatePipe, NgClass } from '@angular/common';
import { OnayService } from '../../core/services/onay.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { AuthService } from '../../core/auth/auth.service';
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
  private confirm = inject(ConfirmService);
  private authService = inject(AuthService);

  public isAdmin = computed(() => this.authService.hasRole('Admin'));

  bekleyenler = signal<OnayBekleyenIslemDto[]>([]);
  kurallar = signal<any[]>([]);
  loading = signal<boolean>(true);
  showKurallarModal = signal<boolean>(false);

  breadcrumb = [
    { label: 'Ana Kontrol Paneli', link: '/dashboard' },
    { label: 'İşlem Onay Merkezi' }
  ];

  ngOnInit(): void {
    this.loadData();
    if (this.isAdmin()) {
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

  async openOnayModal(id: number) {
    const onay = await this.confirm.ask({
      title: 'Kritik İşlem Onayı',
      message: 'Bu kullanıcının sistemde dondurulan kritik isteğini onaylamak ve veritabanına işlemek üzeresiniz. Onaylıyor musunuz?',
      confirmText: 'Evet, İşlemi Çalıştır',
      cancelText: 'İptal',
      type: 'success'
    });
    
    if (onay) {
      this.onayService.onayla({ onayBekleyenIslemId: id }).subscribe((res) => {
        if (res.isSuccess) {
          this.toast.success('İşlem başarıyla onaylandı ve çalıştırıldı.');
          this.loadData();
        } else {
          this.toast.error(res.error || 'Onay işlemi başarısız.');
        }
      });
    }
  }

  async openRetModal(id: number) {
    const onay = await this.confirm.ask({
      title: 'Talebi Reddet',
      message: 'Bu işlemi iptal etmek istediğinize emin misiniz? Devam ederseniz personel red gerekçesini yazmanız istenecektir.',
      confirmText: 'Evet, Talebi Sil',
      cancelText: 'Vazgeç',
      type: 'danger'
    });

    if (onay) {
      // Use browser native prompt for reason instead of complex modal form
      const reason = window.prompt("Lütfen reddetme sebebini girin:");
      if (reason === null) {
        return; 
      }

      if (reason.trim() === '') {
        this.toast.warning('Reddetme sebebi zorunludur.');
        return;
      }

      this.onayService.reddet({ onayBekleyenIslemId: id, redAciklamasi: reason }).subscribe((res) => {
        if (res.isSuccess) {
          this.toast.success('İşlem isteği reddedildi.');
          this.loadData();
        } else {
          this.toast.error(res.error || 'Kayıt başarısız.');
        }
      });
    }
  }
}
