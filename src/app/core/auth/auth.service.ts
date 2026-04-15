import { Injectable, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { BaseApiService } from '../services/base-api.service';
import { API } from '../constants/api-endpoints';
import { SessionManager } from '../managers/session.manager';
import { KullaniciAuthDto, LoginDto, LoginResultDto, ApiResult } from '../../shared/models/auth.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = inject(BaseApiService);
  private router = inject(Router);
  private session = inject(SessionManager);

  currentUser = signal<KullaniciAuthDto | null>(this.loadUser());
  isLoggedIn = computed(() => !!this.currentUser());
  userRole = computed(() => this.currentUser()?.rol ?? '');

  login(dto: LoginDto): Observable<ApiResult<LoginResultDto>> {
    return this.api.post<LoginResultDto>(API.AUTH.LOGIN, dto).pipe(
      tap((result) => {
        if (result.isSuccess && result.value) {
          this.setSession(result.value);
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

  private setSession(data: LoginResultDto): void {
    this.session.setToken(data.token);
    this.session.setUser(data.kullanici);
    this.session.setRole(data.kullanici.rol);
    this.currentUser.set(data.kullanici);
  }

  private loadUser(): KullaniciAuthDto | null {
    return this.session.getSession<KullaniciAuthDto>('3k_user');
  }
}
