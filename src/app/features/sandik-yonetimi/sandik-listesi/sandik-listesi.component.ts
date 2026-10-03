import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslationService } from '../../../core/services/translation.service';
import { SandikService } from '../../../core/services/sandik.service';
import { LookupService } from '../../../core/services/lookup.service';
import { ToastService } from '../../../core/services/toast.service';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { BreadcrumbComponent } from '../../../shared/components/breadcrumb/breadcrumb.component';
import { SandikDto } from '../../../shared/models/index';
import { SandikTipi, DepoLokasyon, ProjeTipi } from '../../../core/constants/enums';
import { projeTipiBaglami, rotaProjeTipi } from '../../../core/constants/proje-tipi';
import { ConfirmService, duzMetin } from '../../../core/services/confirm.service';
import { PermissionService } from '../../../core/services/permission.service';
import { YETKI } from '../../../core/constants/yetki-kodlari';

@Component({
  selector: 'app-sandik-listesi',
  standalone: true,
  imports: [TranslatePipe, RouterLink, FormsModule, StatusBadgeComponent, BreadcrumbComponent],
  templateUrl: './sandik-listesi.component.html',
  styleUrl: './sandik-listesi.component.scss',
})
export class SandikListesiComponent implements OnInit {
  ts = inject(TranslationService);
  private route = inject(ActivatedRoute);
  private sandikService = inject(SandikService);
  private lookupService = inject(LookupService);
  private toast = inject(ToastService);
  private confirmService = inject(ConfirmService);
  private permissionService = inject(PermissionService);

  projeId = signal(0);
  sandiklar = signal<SandikDto[]>([]);
  filteredSandiklar = signal<SandikDto[]>([]);
  loading = signal(true);
  searchTerm = signal('');

  // Sandık Ekleme Modal
  showEkleModal = signal(false);
  yeniSandikNo = signal('');
  yeniSandikIsmi = signal('');
  /** Sandık tipi her proje türünde zorunludur (G2); kullanıcı açıkça seçer. */
  yeniTipId = signal<SandikTipi | null>(null);
  yeniLokasyonId = signal(DepoLokasyon.UcK);
  eklemeSaving = signal(false);
  yeniEn = signal<number | null>(null);
  yeniBoy = signal<number | null>(null);
  yeniYukseklik = signal<number | null>(null);
  yeniNetKg = signal<number | null>(null);
  yeniGrossKg = signal<number | null>(null);

  // Lookups
  lokasyonlar = signal<{id: number, deger: string}[]>([]);
  sandikTipleri = signal<{id: number, deger: string}[]>([]);

  breadcrumb: { label: string; link?: string }[] = [];
  private readonly projeTipi = projeTipiBaglami(rotaProjeTipi(this.route.snapshot));
  readonly routePrefix = this.projeTipi.yonetimRotasi;
  readonly isSahaYedek = this.projeTipi.tip !== ProjeTipi.Normal;
  canWriteSandik = computed(() => {
    const menuKod = this.route.snapshot.data['menuKod'] || YETKI.SANDIK.YONETIMI;
    return this.permissionService.canWrite(menuKod);
  });

  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('projeId'));
    this.projeId.set(id);

    this.breadcrumb = [
      { label: this.ts.translate('MENU.DASHBOARD'), link: '/dashboard' },
      { label: this.ts.translate(this.projeTipi.baslik.yonetim) },
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
            this.getEtkinDurumMetni(s).toLowerCase().includes(term)
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

  getEtkinDurumMetni(sandik: SandikDto): string {
    return sandik.sahaUzerindenSevkEdildiMi ? 'Sevk Edildi' : sandik.durumMetni;
  }

  getEtkinDurumLabel(sandik: SandikDto): string {
    return sandik.sahaUzerindenSevkEdildiMi
      ? 'Sevk Edildi (Saha)'
      : this.getDurumLabel(sandik.durumMetni);
  }

  // ===== Sandık Ekleme =====

  openEkleModal() {
    const maxNo = this.sandiklar().reduce((max, s) => {
      const num = parseInt(s.sandikNo.replace(/\D/g, ''), 10);
      return isNaN(num) ? max : Math.max(max, num);
    }, 0);
    this.yeniSandikNo.set((maxNo + 1).toString());
    this.yeniSandikIsmi.set('');
    this.yeniTipId.set(null);
    this.yeniLokasyonId.set(DepoLokasyon.UcK);
    this.yeniEn.set(null);
    this.yeniBoy.set(null);
    this.yeniYukseklik.set(null);
    this.yeniNetKg.set(null);
    this.yeniGrossKg.set(null);
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
    const tipId = this.yeniTipId();
    if (!tipId) {
      this.toast.error('Sandık tipi seçilmelidir.');
      return;
    }
    this.eklemeSaving.set(true);
    this.sandikService.sandikEkle({
      projeId: this.projeId(),
      sandikNo: no,
      sandikIsmi: this.yeniSandikIsmi().trim() || undefined,
      tipId,
      depoLokasyonId: this.yeniLokasyonId(),
      en: this.yeniEn() ?? undefined,
      boy: this.yeniBoy() ?? undefined,
      yukseklik: this.yeniYukseklik() ?? undefined,
      netKg: this.yeniNetKg() ?? undefined,
      grossKg: this.yeniGrossKg() ?? undefined
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

  // ===== Sandık Silme =====

  async sandikSil(s: SandikDto) {
    if (!this.canWriteSandik()) return;
    const silmeDetayi = s.isManuelSandik && s.urunSayisi > 0
      ? `<br><br><small class="text-muted">Bu manuel sandığın içindeki ${s.urunSayisi} manuel ürün de silinecek.</small>`
      : '';

    const onay = await this.confirmService.ask({
      title: 'Sandık Sil',
      message: `<strong>${duzMetin(s.sandikNo)}</strong> numaralı sandığı silmek istediğinize emin misiniz?${silmeDetayi}<br><br><small class="text-muted">Bu işlem geri alınamaz.</small>`,
      confirmText: 'Evet, Sil',
      cancelText: 'Vazgeç',
      type: 'danger'
    });

    if (onay) {
      this.sandikService.sandikSil(s.id, this.projeId()).subscribe({
        next: (res) => {
          if (res.isSuccess) {
            this.toast.success(`Sandık "${s.sandikNo}" başarıyla silindi.`);
            this.loadSandiklar();
          } else {
            this.toast.error(res.error ?? 'Sandık silinemedi.');
          }
        },
        error: () => this.toast.error('Silme sırasında hata oluştu.')
      });
    }
  }
}
