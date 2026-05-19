import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgClass } from '@angular/common';
import { TranslationService } from '../../core/services/translation.service';
import { StatCardComponent } from '../../shared/components/stat-card/stat-card.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { BreadcrumbComponent } from '../../shared/components/breadcrumb/breadcrumb.component';
import { BaseApiService } from '../../core/services/base-api.service';
import { API } from '../../core/constants/api-endpoints';
import { ProjeDto, ApiResult } from '../../shared/models/index';

interface EksikUrun {
  barkodNo: string;
  aciklama: string;
  kalanMiktar: number;
  sandikNo: string;
  projeNo?: string;
}

interface SonIslem {
  islemMetni: string;
  kullaniciAdi: string;
  tarih: string;
  icon: string;
  color: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [TranslatePipe, StatCardComponent, StatusBadgeComponent, BreadcrumbComponent, RouterLink, NgClass],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  ts = inject(TranslationService);
  private api = inject(BaseApiService);

  projeler = signal<ProjeDto[]>([]);
  loading = signal(true);

  breadcrumb = [
    { label: 'Ana Kontrol Paneli' },
  ];

  // Stats
  toplamProje = signal(0);
  aktifProje = signal(0);
  toplamSandik = signal(0);
  eksikUrun = signal(0);
  sevkEdilen = signal(0);

  // Proje tablosu — ilk 6 kayıt
  projelerDisplay = computed(() => this.projeler().slice(0, 6));
  projelerPage = signal(1);
  projelerPageSize = 6;
  projelerToplam = computed(() => this.projeler().length);
  projelerSayfaSayisi = computed(() => Math.ceil(this.projeler().length / this.projelerPageSize) || 1);
  pagedProjeler = computed(() => {
    const start = (this.projelerPage() - 1) * this.projelerPageSize;
    return this.projeler().slice(start, start + this.projelerPageSize);
  });

  // Depo Dağılım (computed)
  toplamDepoSandik = computed(() => this.projeler().reduce((s, p) => s + (p.depoSandikSayisi ?? 0), 0));
  depo3K = computed(() => this.projeler().reduce((s, p) => s + (p.depoUcKSandikSayisi ?? 0), 0));
  depoSeymen = computed(() => this.projeler().reduce((s, p) => s + (p.depoSeymenSandikSayisi ?? 0), 0));
  depoGrid = computed(() => this.projeler().reduce((s, p) => s + (p.depoGridSandikSayisi ?? 0), 0));
  depoDiger = computed(() => this.toplamDepoSandik() - this.depo3K() - this.depoSeymen() - this.depoGrid());

  // Proje Özeti — lookup değerleri: "Hazırlanıyor", "Tamamlandı", "Beklemede", "Sevk Edildi", "Eksik Sevk Edildi"
  devamEden = computed(() => this.projeler().filter(p => p.durumMetni === 'Hazırlanıyor').length);
  tamamlanan = computed(() => this.projeler().filter(p => p.durumMetni === 'Tamamlandı').length);
  beklemede = computed(() => this.projeler().filter(p => p.durumMetni === 'Beklemede').length);

  // Yedek/Saha sandık sayıları
  yedekSandik = computed(() => this.projeler().filter(p => p.projeTipiId === 3).reduce((s, p) => s + p.sandikSayisi, 0));
  sahaSandik = computed(() => this.projeler().filter(p => p.projeTipiId === 2).reduce((s, p) => s + p.sandikSayisi, 0));
  normalSandik = computed(() => this.projeler().filter(p => p.projeTipiId === 1).reduce((s, p) => s + p.sandikSayisi, 0));

  // Tamamlanma yüzdesi - yedek ve saha
  yedekYuzde = computed(() => {
    const projs = this.projeler().filter(p => p.projeTipiId === 3);
    const total = projs.reduce((s, p) => s + p.toplamUrunSayisi, 0);
    const done = projs.reduce((s, p) => s + p.tamamlananUrunSayisi, 0);
    return total > 0 ? Math.floor((done / total) * 100) : 0;
  });
  sahaYuzde = computed(() => {
    const projs = this.projeler().filter(p => p.projeTipiId === 2);
    const total = projs.reduce((s, p) => s + p.toplamUrunSayisi, 0);
    const done = projs.reduce((s, p) => s + p.tamamlananUrunSayisi, 0);
    return total > 0 ? Math.floor((done / total) * 100) : 0;
  });

  // Kritik eksikler (en çok eksik olan projeler)
  kritikProjeler = computed(() => {
    return this.projeler()
      .map(p => ({
        projeNo: p.projeNo,
        eksik: p.toplamUrunSayisi - p.tamamlananUrunSayisi,
        toplam: p.toplamUrunSayisi,
        sandik: p.sandikSayisi,
      }))
      .filter(p => p.eksik > 0)
      .sort((a, b) => b.eksik - a.eksik)
      .slice(0, 5);
  });

  // Top eksik proje
  topEksikProje = computed(() => {
    return this.projeler()
      .map(p => ({
        projeNo: p.projeNo,
        lokasyon: p.lokasyon,
        eksikYuzde: p.toplamUrunSayisi > 0 ? Math.round(((p.toplamUrunSayisi - p.tamamlananUrunSayisi) / p.toplamUrunSayisi) * 100) : 0,
        eksikAdet: p.toplamUrunSayisi - p.tamamlananUrunSayisi,
      }))
      .filter(p => p.eksikAdet > 0)
      .sort((a, b) => b.eksikAdet - a.eksikAdet)
      .slice(0, 6);
  });

  ngOnInit() {
    this.api.get<ProjeDto[]>(API.PROJE.LIST).subscribe((res) => {
      this.loading.set(false);
      if (res.isSuccess && res.value) {
        this.projeler.set(res.value);
        this.toplamProje.set(res.value.length);
        // Lookup: "Hazırlanıyor" = aktif proje
        this.aktifProje.set(res.value.filter(p => p.durumMetni === 'Hazırlanıyor').length);
        this.toplamSandik.set(res.value.reduce((sum, p) => sum + p.sandikSayisi, 0));
        this.eksikUrun.set(res.value.reduce((sum, p) => sum + (p.toplamUrunSayisi - p.tamamlananUrunSayisi), 0));
        this.sevkEdilen.set(res.value.filter(p => p.durumMetni === 'Sevk Edildi' || p.durumMetni === 'Eksik Sevk Edildi').length);
      }
    });
  }

  getTamamlanmaYuzdesi(p: ProjeDto): number {
    if (p.toplamUrunSayisi === 0) return 0;
    return Math.floor((p.tamamlananUrunSayisi / p.toplamUrunSayisi) * 100);
  }

  formatBaslamaTarihi(value?: string): string {
    if (!value) return '-';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';

    return date.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  getCalismaMetni(p: ProjeDto): string {
    const gunSayisi = p.calismaGunSayisi ?? this.hesaplaCalismaGunu(p.baslamaTarihi, p.gerceklesenSevkTarihi);
    const sevkEdildi = !!p.gerceklesenSevkTarihi || p.durumMetni === 'Sevk Edildi' || p.durumMetni === 'Eksik Sevk Edildi';

    if (sevkEdildi) return `${gunSayisi} günde sevk edildi`;
    if (gunSayisi === 0) return 'Bugün başladı';

    return `${gunSayisi} gündür çalışma devam ediyor`;
  }

  getProgressColor(yuzde: number): string {
    if (yuzde >= 80) return '#22c55e';
    if (yuzde >= 50) return '#3b82f6';
    if (yuzde >= 25) return '#f59e0b';
    return '#ef4444';
  }

  projelerPrev() {
    if (this.projelerPage() > 1) this.projelerPage.set(this.projelerPage() - 1);
  }
  projelerNext() {
    if (this.projelerPage() < this.projelerSayfaSayisi()) this.projelerPage.set(this.projelerPage() + 1);
  }

  private hesaplaCalismaGunu(baslamaTarihi?: string, bitisTarihi?: string): number {
    if (!baslamaTarihi) return 0;

    const baslama = new Date(baslamaTarihi);
    const bitis = bitisTarihi ? new Date(bitisTarihi) : new Date();

    if (Number.isNaN(baslama.getTime()) || Number.isNaN(bitis.getTime())) return 0;

    baslama.setHours(0, 0, 0, 0);
    bitis.setHours(0, 0, 0, 0);

    return Math.max(0, Math.floor((bitis.getTime() - baslama.getTime()) / 86400000));
  }
}
