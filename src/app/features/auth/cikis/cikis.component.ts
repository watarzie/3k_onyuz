import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

/** Otomatik yönlendirmeye kadar geçen süre (sn). */
const YONLENDIRME_SURESI = 12;

/**
 * Kullanıcının kendi isteğiyle çıkışından sonra gösterilen veda sayfası. Oturum bu sayfaya gelmeden
 * önce AuthService.cikisYap içinde temizlenir; sayfa yalnız sonucu gösterir ve süre dolunca giriş
 * ekranına yönlendirir. Oturum açıkken açılırsa panele döner (çıkış yapılmadan gösterilmez).
 */
@Component({
  selector: 'app-cikis',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './cikis.component.html',
  styleUrl: './cikis.component.scss',
})
export class CikisComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  /** Çıkış yapan kullanıcının yalnız ilk adı; gezinme durumundan gelir, saklanmaz. */
  readonly ad = signal(this.ilkAd());
  readonly kalanSure = signal(YONLENDIRME_SURESI);
  readonly bekletildi = signal(false);
  readonly ilerleme = computed(() => (1 - this.kalanSure() / YONLENDIRME_SURESI) * 100);
  readonly saat = new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' }).format(new Date());

  private zamanlayici?: ReturnType<typeof setInterval>;

  ngOnInit(): void {
    if (this.auth.isLoggedIn()) {
      this.router.navigate(['/dashboard']);
      return;
    }
    this.zamanlayici = setInterval(() => {
      if (this.bekletildi()) return;
      const kalan = this.kalanSure() - 1;
      this.kalanSure.set(Math.max(kalan, 0));
      if (kalan <= 0) this.girisEkraninaGit();
    }, 1000);
    this.destroyRef.onDestroy(() => clearInterval(this.zamanlayici));
  }

  /** "Burada kal": otomatik yönlendirme durur; kullanıcı istediği zaman giriş ekranına geçer. */
  burayaKal(): void {
    this.bekletildi.set(true);
  }

  girisEkraninaGit(): void {
    clearInterval(this.zamanlayici);
    this.router.navigate(['/auth/login']);
  }

  private ilkAd(): string | null {
    const ad = (history.state?.ad as string | null | undefined)?.trim();
    if (!ad) return null;
    const ilk = ad.split(/\s+/)[0];
    return ilk.charAt(0).toLocaleUpperCase('tr-TR') + ilk.slice(1).toLocaleLowerCase('tr-TR');
  }
}
