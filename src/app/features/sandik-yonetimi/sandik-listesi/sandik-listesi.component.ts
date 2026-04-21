import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslationService } from '../../../core/services/translation.service';
import { SandikService } from '../../../core/services/sandik.service';
import { LookupService } from '../../../core/services/lookup.service';
import { ToastService } from '../../../core/services/toast.service';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { BreadcrumbComponent } from '../../../shared/components/breadcrumb/breadcrumb.component';
import { SandikDto } from '../../../shared/models/index';
import { SandikTipi, DepoLokasyon } from '../../../core/constants/enums';

@Component({
  selector: 'app-sandik-listesi',
  standalone: true,
  imports: [TranslatePipe, RouterLink, NgClass, FormsModule, StatusBadgeComponent, BreadcrumbComponent],
  templateUrl: './sandik-listesi.component.html',
  styleUrl: './sandik-listesi.component.scss',
})
export class SandikListesiComponent implements OnInit {
  ts = inject(TranslationService);
  private route = inject(ActivatedRoute);
  private sandikService = inject(SandikService);
  private lookupService = inject(LookupService);
  private toast = inject(ToastService);

  projeId = signal(0);
  sandiklar = signal<SandikDto[]>([]);
  filteredSandiklar = signal<SandikDto[]>([]);
  loading = signal(true);
  searchTerm = signal('');

  // Sandık Ekleme Modal
  showEkleModal = signal(false);
  yeniSandikNo = signal('');
  yeniTipId = signal(SandikTipi.Proje);
  yeniLokasyonId = signal(DepoLokasyon.UcK);
  eklemeSaving = signal(false);

  // Lookups
  lokasyonlar = signal<{id: number, deger: string}[]>([]);
  sandikTipleri = signal<{id: number, deger: string}[]>([]);

  breadcrumb: { label: string; link?: string }[] = [];

  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('projeId'));
    this.projeId.set(id);
    this.breadcrumb = [
      { label: this.ts.translate('MENU.DASHBOARD'), link: '/dashboard' },
      { label: this.ts.translate('MENU.SANDIK_YONETIMI') },
    ];
    this.loadLookups();
    this.loadSandiklar();
  }

  loadLookups() {
    this.lookupService.getLookups(['LookupDepoLokasyon', 'LookupSandikTipi']).subscribe(data => {
      if (data['LookupDepoLokasyon']) this.lokasyonlar.set(data['LookupDepoLokasyon']);
      if (data['LookupSandikTipi']) this.sandikTipleri.set(data['LookupSandikTipi']);
    });
  }

  loadSandiklar() {
    this.loading.set(true);
    this.sandikService.getSandiklar(this.projeId()).subscribe((res) => {
      this.loading.set(false);
      if (res.isSuccess && res.value) {
        this.sandiklar.set(res.value);
        this.filteredSandiklar.set(res.value);
      }
    });
  }

  onSearch(event: Event) {
    const term = (event.target as HTMLInputElement).value.toLowerCase();
    this.searchTerm.set(term);
    if (!term) {
      this.filteredSandiklar.set(this.sandiklar());
    } else {
      this.filteredSandiklar.set(
        this.sandiklar().filter(
          (s) =>
            s.sandikNo.toLowerCase().includes(term) ||
            s.durumMetni.toLowerCase().includes(term)
        )
      );
    }
  }

  getDurumLabel(durum: string): string {
    const map: Record<string, string> = {
      Aktif: this.ts.translate('STATUS.AKTIF'),
      Bekliyor: this.ts.translate('STATUS.BEKLIYOR'),
      Tamamlandi: this.ts.translate('STATUS.TAMAMLANDI'),
    };
    return map[durum] ?? durum;
  }

  // ===== Sandık Ekleme =====

  openEkleModal() {
    const maxNo = this.sandiklar().reduce((max, s) => {
      const num = parseInt(s.sandikNo.replace(/\D/g, ''), 10);
      return isNaN(num) ? max : Math.max(max, num);
    }, 0);
    this.yeniSandikNo.set((maxNo + 1).toString());
    this.yeniTipId.set(SandikTipi.Proje);
    this.yeniLokasyonId.set(DepoLokasyon.UcK);
    this.showEkleModal.set(true);
  }

  closeEkleModal() {
    this.showEkleModal.set(false);
  }

  sandikEkle() {
    const no = this.yeniSandikNo().trim();
    if (!no) {
      this.toast.error('Sandık numarası girilmelidir.');
      return;
    }
    this.eklemeSaving.set(true);
    this.sandikService.sandikEkle({
      projeId: this.projeId(),
      sandikNo: no,
      tipId: this.yeniTipId(),
      depoLokasyonId: this.yeniLokasyonId(),
    }).subscribe({
      next: (res) => {
        this.eklemeSaving.set(false);
        if (res.isSuccess) {
          this.toast.success(`Sandık "${no}" başarıyla oluşturuldu.`);
          this.closeEkleModal();
          this.loadSandiklar();
        } else {
          this.toast.error(res.error ?? 'Sandık eklenemedi.');
        }
      },
      error: () => {
        this.eklemeSaving.set(false);
        this.toast.error('Sandık eklenirken bir hata oluştu.');
      }
    });
  }
}
