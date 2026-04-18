import { Injectable, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { BaseApiService } from '../services/base-api.service';
import { API } from '../constants/api-endpoints';
import { SessionManager } from '../managers/session.manager';
import { LoginDto, LoginResultDto, ApiResult } from '../../shared/models/auth.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = inject(BaseApiService);
  private router = inject(Router);
  private session = inject(SessionManager);

  /**
   * Kullanıcı bilgileri — JWT'den decode edilir.
   * localStorage'da hassas veri SAKLANMAZ.
   */
  currentUser = signal(this.session.getUser());
  isLoggedIn = computed(() => !!this.currentUser() && !this.session.isTokenExpired());
  userRole = computed(() => this.currentUser()?.rol ?? '');

  login(dto: LoginDto): Observable<ApiResult<LoginResultDto>> {
    return this.api.post<LoginResultDto>(API.AUTH.LOGIN, dto).pipe(
      tap((result) => {
        if (result.isSuccess && result.value) {
          // Sadece token'ı sakla — kullanıcı bilgileri JWT'den okunur
          this.session.setToken(result.value.token);
          this.currentUser.set(this.session.getUser());
        }
      })
    );
  }

  logout(): void {
    this.session.clearAll();
    this.currentUser.set(null);
    this.router.navigate(['/auth/login']);
  }

  getToken(): string | null {
    return this.session.token;
  }

  hasRole(...roles: string[]): boolean {
    const role = this.userRole();
    return roles.includes(role);
  }
}
