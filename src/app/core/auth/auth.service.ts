import { Injectable, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { BaseApiService } from '../services/base-api.service';
import { API } from '../constants/api-endpoints';
import { KullaniciDto, LoginDto, LoginResultDto, ApiResult } from '../models/api-response.model';

const TOKEN_KEY = '3k_token';
const USER_KEY = '3k_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = inject(BaseApiService);
  private router = inject(Router);

  currentUser = signal<KullaniciDto | null>(this.loadUser());
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
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.currentUser.set(null);
    this.router.navigate(['/auth/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  hasRole(...roles: string[]): boolean {
    const role = this.userRole();
    return roles.includes(role);
  }

  private setSession(data: LoginResultDto): void {
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.kullanici));
    this.currentUser.set(data.kullanici);
  }

  private loadUser(): KullaniciDto | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
}
