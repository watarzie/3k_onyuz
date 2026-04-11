import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgClass } from '@angular/common';
import { I18nService } from '../../../shared/i18n/i18n.service';
import { SandikService } from '../sandik.service';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { BreadcrumbComponent } from '../../../shared/components/breadcrumb/breadcrumb.component';
import { SandikDetayDto, SandikIcerikDto } from '../../../core/models/api-response.model';

@Component({
  selector: 'app-sandik-detay',
  standalone: true,
  imports: [RouterLink, NgClass, StatusBadgeComponent, BreadcrumbComponent],
  templateUrl: './sandik-detay.component.html',
  styleUrl: './sandik-detay.component.scss',
})
export class SandikDetayComponent implements OnInit {
  i18n = inject(I18nService);
  private route = inject(ActivatedRoute);
  private sandikService = inject(SandikService);

  projeId = signal(0);
  sandikId = signal(0);
  sandik = signal<SandikDetayDto | null>(null);
  loading = signal(true);
  selectedUrun = signal<SandikIcerikDto | null>(null);
  showDetailPanel = signal(false);

  breadcrumb: { label: string; link?: string }[] = [];

  ngOnInit() {
    const pId = Number(this.route.snapshot.paramMap.get('projeId'));
    const sId = Number(this.route.snapshot.paramMap.get('sandikId'));
    this.projeId.set(pId);
    this.sandikId.set(sId);
    this.loadSandik();
  }

  loadSandik() {
    this.loading.set(true);
    this.sandikService.getSandikIcerik(this.sandikId()).subscribe((res) => {
      this.loading.set(false);
      if (res.isSuccess && res.value) {
        this.sandik.set(res.value);
        this.breadcrumb = [
          { label: this.i18n.t().MENU.DASHBOARD, link: '/dashboard' },
          { label: this.i18n.t().MENU.SANDIK_YONETIMI, link: `/sandik-yonetimi/${this.projeId()}` },
          { label: `${res.value.sandikNo}` },
        ];
      }
    });
  }

  getTamamlanmaYuzdesi(): number {
    const s = this.sandik();
    if (!s || s.icerikler.length === 0) return 0;
    const tamamlanan = s.icerikler.filter((i) => i.durum === 'TamGeldi' || i.durum === 'Paketlendi' || i.durum === 'KontrolEdildi').length;
    return Math.round((tamamlanan / s.icerikler.length) * 100);
  }

  getGelenText(item: SandikIcerikDto): string {
    return `${item.konulanAdet} / ${item.istenenAdet}`;
  }

  getDurumLabel(durum: string): string {
    const t = this.i18n.t().STATUS;
    const map: Record<string, string> = {
      TamGeldi: t.TAM_GELDI, EksikGeldi: t.EKSIK_GELDI, Gelmedi: t.GELMEDI,
      Paketlendi: t.PAKETLENDI, KontrolEdildi: t.KONTROL_EDILDI,
      IadeEdildi: t.IADE_EDILDI, Bekliyor: t.BEKLIYOR,
    };
    return map[durum] ?? durum;
  }

  selectUrun(item: SandikIcerikDto) {
    this.selectedUrun.set(item);
    this.showDetailPanel.set(true);
  }

  closePanel() {
    this.showDetailPanel.set(false);
    this.selectedUrun.set(null);
  }

  onTamGeldi() {
    // TODO: Toplu teslim al
  }

  onEksikGeldi() {
    // TODO: Eksik geldi işlemi
  }

  onStokKarsila() {
    // TODO: Stoktan karşıla
  }

  onSandikDegistir() {
    // TODO: Sandık değiştir
  }
}
