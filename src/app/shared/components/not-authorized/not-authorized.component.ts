import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-authorized',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="d-flex align-items-center justify-content-center vh-100 bg-light">
      <div class="text-center">
        <i class="ri-forbid-2-line text-danger" style="font-size: 8rem;"></i>
        <h1 class="display-4 fw-bold mt-3">403</h1>
        <h3 class="mb-3">Erişim Reddedildi</h3>
        <p class="text-muted mb-4">Bu sayfayı görüntülemek için yeterli yetkiniz bulunmuyor.<br>Bu bir hata ise sistem yöneticinizle iletişime geçin.</p>
        <button class="btn btn-primary px-4" routerLink="/dashboard">Ana Sayfaya Dön</button>
      </div>
    </div>
  `
})
export class NotAuthorizedComponent { }
