import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslationService } from '../../../core/services/translation.service';
import { SandikService } from '../../../core/services/sandik.service';
import { ToastService } from '../../../core/services/toast.service';
import { AuthService } from '../../../core/auth/auth.service';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { BreadcrumbComponent } from '../../../shared/components/breadcrumb/breadcrumb.component';
import { SandikDetayDto, SandikIcerikDto, SandikDto } from '../../../shared/models/index';

@Component({
  selector: 'app-sandik-detay',
  standalone: true,
  imports: [TranslatePipe, RouterLink, NgClass, FormsModule, StatusBadgeComponent, BreadcrumbComponent],
  templateUrl: './sandik-detay.component.html',
  styleUrl: './sandik-detay.component.scss',
})
export class SandikDetayComponent implements OnInit {
  ts = inject(TranslationService);
  private route = inject(ActivatedRoute);
  private sandikService = inject(SandikService);
  private toast = inject(ToastService);
  private auth = inject(AuthService);

  projeId = signal(0);
  sandikId = signal(0);
  sandik = signal<SandikDetayDto | null>(null);
  loading = signal(true);

  // Side panel (ürün detay)
  selectedUrun = signal<SandikIcerikDto | null>(null);
  showDetailPanel = signal(false);

  // Manuel ürün ekleme modal
  showUrunEkleModal = signal(false);
  yeniBarkod = signal('');
  yeniAciklama = signal('');
  yeniAdet = signal(1);
  yeniBirim = signal('ADET');
  yeniNeden = signal('');
  urunEklemeSaving = signal(false);

  // Ürün taşıma modal
  showTasiModal = signal(false);
  tasiUrun = signal<SandikIcerikDto | null>(null);
  hedefSandikId = signal(0);
  tasinanAdet = signal(1);
  tasiSaving = signal(false);
  projeSandiklari = signal<SandikDto[]>([]);

  // Konulma güncelleme
  guncelKonulanAdet = signal(0);
  guncelleSaving = signal(false);

  breadcrumb: { label: string; link?: string }[] = [];

  ngOnInit() {
    const pId = Number(this.route.snapshot.paramMap.get('projeId'));
    const sId = Number(this.route.snapshot.paramMap.get('sandikId'));
    this.projeId.set(pId);
    this.sandikId.set(sId);
    this.loadSandik();
    this.loadProjeSandiklari();
  }

  loadSandik() {
    this.loading.set(true);
    this.sandikService.getSandikIcerik(this.sandikId()).subscribe((res) => {
      this.loading.set(false);
      if (res.isSuccess && res.value) {
        this.sandik.set(res.value);
        this.breadcrumb = [
          { label: this.ts.translate('MENU.DASHBOARD'), link: '/dashboard' },
          { label: this.ts.translate('MENU.SANDIK_YONETIMI'), link: `/sandik-yonetimi/${this.projeId()}` },
          { label: `${res.value.sandikNo}` },
        ];
      }
    });
  }

  loadProjeSandiklari() {
    this.sandikService.getSandiklar(this.projeId()).subscribe((res) => {
      if (res.isSuccess && res.value) {
        // Mevcut sandığı hariç tut
        this.projeSandiklari.set(res.value.filter(s => s.id !== this.sandikId()));
      }
    });
  }

  getTamamlanmaYuzdesi(): number {
    const s = this.sandik();
    if (!s || s.icerikler.length === 0) return 0;
    const tamamlanan = s.icerikler.filter((i) =>
      i.durumMetni === 'TamGeldi' || i.durumMetni === 'Tam Geldi' ||
      i.durumMetni === 'Paketlendi' || i.durumMetni === 'KontrolEdildi' ||
      i.durumMetni === 'Tamamlandı'
    ).length;
    return Math.round((tamamlanan / s.icerikler.length) * 100);
  }

  getDurumLabel(durum: string): string {
    const map: Record<string, string> = {
      TamGeldi: this.ts.translate('STATUS.TAM_GELDI'), EksikGeldi: this.ts.translate('STATUS.EKSIK_GELDI'), Gelmedi: this.ts.translate('STATUS.GELMEDI'),
      Paketlendi: this.ts.translate('STATUS.PAKETLENDI'), KontrolEdildi: this.ts.translate('STATUS.KONTROL_EDILDI'),
      IadeEdildi: this.ts.translate('STATUS.IADE_EDILDI'), Bekliyor: this.ts.translate('STATUS.BEKLIYOR'),
    };
    return map[durum] ?? durum;
  }

  // ===== Side Panel =====

  selectUrun(item: SandikIcerikDto) {
    this.selectedUrun.set(item);
    this.guncelKonulanAdet.set(item.konulanAdet);
    this.showDetailPanel.set(true);
  }

  closePanel() {
    this.showDetailPanel.set(false);
    this.selectedUrun.set(null);
  }

  // ===== Manuel Ürün Ekleme =====

  openUrunEkleModal() {
    this.yeniBarkod.set('');
    this.yeniAciklama.set('');
    this.yeniAdet.set(1);
    this.yeniBirim.set('ADET');
    this.yeniNeden.set('');
    this.showUrunEkleModal.set(true);
  }

  closeUrunEkleModal() {
    this.showUrunEkleModal.set(false);
  }

  manuelUrunEkle() {
    if (!this.yeniAciklama().trim()) {
      this.toast.error('Açıklama girilmelidir.');
      return;
    }
    if (this.yeniAdet() <= 0) {
      this.toast.error('Adet 0\'dan büyük olmalıdır.');
      return;
    }
    this.urunEklemeSaving.set(true);
    this.sandikService.manuelUrunEkle({
      projeId: this.projeId(),
      sandikId: this.sandikId(),
      barkodNo: this.yeniBarkod().trim() || 'MANUEL',
      aciklama: this.yeniAciklama().trim(),
      istenenAdet: this.yeniAdet(),
      birim: this.yeniBirim(),
      eklemeNedeni: this.yeniNeden().trim() || undefined,
    }).subscribe({
      next: (res) => {
        this.urunEklemeSaving.set(false);
        if (res.isSuccess) {
          this.toast.success('Ürün başarıyla eklendi.');
          this.closeUrunEkleModal();
          this.loadSandik();
        } else {
          this.toast.error(res.error ?? 'Ürün eklenemedi.');
        }
      },
      error: () => {
        this.urunEklemeSaving.set(false);
        this.toast.error('Ürün eklenirken hata oluştu.');
      }
    });
  }

  // ===== Ürün Taşıma =====

  openTasiModal(item: SandikIcerikDto) {
    this.tasiUrun.set(item);
    this.tasinanAdet.set(item.konulanAdet);
    this.hedefSandikId.set(0);
    this.showTasiModal.set(true);
    this.closePanel();
  }

  closeTasiModal() {
    this.showTasiModal.set(false);
    this.tasiUrun.set(null);
  }

  urunTasi() {
    const urun = this.tasiUrun();
    if (!urun) return;
    if (this.hedefSandikId() <= 0) {
      this.toast.error('Hedef sandık seçiniz.');
      return;
    }
    if (this.tasinanAdet() <= 0 || this.tasinanAdet() > urun.konulanAdet) {
      this.toast.error(`Taşınacak adet 1 ile ${urun.konulanAdet} arasında olmalıdır.`);
      return;
    }
    this.tasiSaving.set(true);
    this.sandikService.urunTasi({
      kaynakSandikIcerikId: urun.id,
      hedefSandikId: this.hedefSandikId(),
      tasinanAdet: this.tasinanAdet(),
      projeId: this.projeId(),
    }).subscribe({
      next: (res) => {
        this.tasiSaving.set(false);
        if (res.isSuccess) {
          this.toast.success('Ürün başarıyla taşındı.');
          this.closeTasiModal();
          this.loadSandik();
        } else {
          this.toast.error(res.error ?? 'Ürün taşınamadı.');
        }
      },
      error: () => {
        this.tasiSaving.set(false);
        this.toast.error('Taşıma sırasında hata oluştu.');
      }
    });
  }

  // ===== Konulma Güncelleme =====

  konulanGuncelle() {
    const urun = this.selectedUrun();
    if (!urun) return;
    const yeniAdet = this.guncelKonulanAdet();
    if (yeniAdet < 0 || yeniAdet > urun.istenenAdet) {
      this.toast.error(`Konulan adet 0 ile ${urun.istenenAdet} arasında olmalıdır.`);
      return;
    }
    this.guncelleSaving.set(true);
    const user = this.auth.currentUser();
    this.sandikService.urunGuncelle({
      cekiSatiriId: urun.cekiSatiriId,
      sandikId: this.sandikId(),
      konulanAdet: yeniAdet,
      kullaniciId: user?.id ?? 0,
      projeId: this.projeId(),
    }).subscribe({
      next: (res) => {
        this.guncelleSaving.set(false);
        if (res.isSuccess) {
          this.toast.success('Konulan adet güncellendi.');
          this.closePanel();
          this.loadSandik();
        } else {
          this.toast.error(res.error ?? 'Güncelleme başarısız.');
        }
      },
      error: () => {
        this.guncelleSaving.set(false);
        this.toast.error('Güncelleme sırasında hata oluştu.');
      }
    });
  }
}
