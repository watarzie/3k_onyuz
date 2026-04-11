import { Component, input } from '@angular/core';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [NgClass],
  template: `<span class="badge" [ngClass]="badgeClass()">{{ label() }}</span>`,
  styles: [`
    .badge { font-size: 12px; padding: 4px 10px; border-radius: 4px; font-weight: 500; }
    .badge-success { background: rgba(37,176,3,.15); color: #25B003; }
    .badge-danger { background: rgba(255,64,35,.15); color: #FF4023; }
    .badge-warning { background: rgba(255,193,7,.15); color: #e6a800; }
    .badge-info { background: rgba(53,132,252,.15); color: #3584FC; }
    .badge-secondary { background: rgba(100,116,139,.15); color: #64748B; }
    .badge-purple { background: rgba(173,99,246,.15); color: #AD63F6; }
  `],
})
export class StatusBadgeComponent {
  status = input.required<string>();
  label = input.required<string>();

  badgeClass = () => {
    const map: Record<string, string> = {
      TamGeldi: 'badge-success', Tamamlandi: 'badge-success', Paketlendi: 'badge-success',
      KontrolEdildi: 'badge-success', Aktif: 'badge-success', StokHazir: 'badge-success',
      Gelmedi: 'badge-danger', Kayip: 'badge-danger', IptalEdildi: 'badge-danger',
      IptalVeyaPasif: 'badge-danger',
      EksikGeldi: 'badge-warning', Eksik: 'badge-warning', KismiSevkEdildi: 'badge-warning',
      KismiGeldi: 'badge-warning', KismiTamamlandi: 'badge-warning',
      SevkEdildi: 'badge-info', Uretimde: 'badge-info',
      Bekliyor: 'badge-secondary', Bekletiliyor: 'badge-secondary',
      SonraGidecek: 'badge-purple', GeriGonderildi: 'badge-purple', IadeEdildi: 'badge-purple',
    };
    return map[this.status()] ?? 'badge-secondary';
  };
}
