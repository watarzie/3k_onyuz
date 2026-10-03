import { Component, computed, inject } from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { ToastService } from '../../../core/services/toast.service';

/**
 * 403 — yetkisiz erişim sayfası. menuGuard girilmek istenen adresi `sayfa` sorgu parametresiyle taşır;
 * sayfa bunu, kullanıcının rolünü ve zamanı gösterir ve yöneticiye iletilecek yetki talebi metnini
 * panoya kopyalar. Yetki kararı sunucudadır; bu sayfa yalnız bilgilendirir.
 */
@Component({
  selector: 'app-not-authorized',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './not-authorized.component.html',
  styleUrl: './not-authorized.component.scss',
})
export class NotAuthorizedComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly sayfa = toSignal(
    this.route.queryParamMap.pipe(map(p => this.guvenliYol(p.get('sayfa')))),
    { initialValue: null as string | null },
  );
  readonly kullanici = computed(() => this.auth.currentUser());
  readonly zaman = new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date());

  geriGit(): void {
    this.location.back();
  }

  async talepMetniniKopyala(): Promise<void> {
    const k = this.kullanici();
    const satirlar = [
      'Merhaba,',
      `${this.sayfa() ? `"${this.sayfa()}" sayfasına` : 'Bir sayfaya'} erişim yetkisi talep ediyorum.`,
      k ? `Kullanıcı: ${k.adSoyad}${k.email ? ` (${k.email})` : ''}` : '',
      k?.rol ? `Mevcut rol: ${k.rol}` : '',
      `Zaman: ${this.zaman}`,
    ].filter(Boolean);
    try {
      await navigator.clipboard.writeText(satirlar.join('\n'));
      this.toast.success('Yetki talebi metni panoya kopyalandı.');
    } catch {
      this.toast.error('Pano erişimi engellendi; metni elle iletin.');
    }
  }

  /** Yalnız uygulama içi yol gösterilir (ör. "/finans"); dış adres veya beklenmeyen değer gösterilmez. */
  private guvenliYol(deger: string | null): string | null {
    if (!deger || !deger.startsWith('/') || deger.startsWith('//')) return null;
    return deger.split('?')[0].slice(0, 120);
  }
}
