import { Injectable } from '@angular/core';

const TOKEN_KEY = '3k_token';
const USER_KEY = '3k_user';
const ROLE_KEY = '3k_role';

/**
 * Oturum bilgilerini merkezi olarak yöneten servis.
 * Token, kullanıcı ve rol bilgilerini localStorage üzerinden yönetir.
 * befasoft-app referans mimarisinden adapte edildi.
 */
@Injectable({ providedIn: 'root' })
export class SessionManager {

  setSession<T>(key: string, data: T): void {
    localStorage.setItem(key, JSON.stringify(data));
  }

  setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  }

  setRole(role: string): void {
    localStorage.setItem(ROLE_KEY, role);
  }

  setUser(user: unknown): void {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  getSession<T>(key: string): T | null {
    const value = localStorage.getItem(key);
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  clear(key: string): void {
    localStorage.removeItem(key);
  }

  clearAll(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(ROLE_KEY);
  }

  get token(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  get role(): string | null {
    return localStorage.getItem(ROLE_KEY);
  }

  get user(): unknown | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  isAuthenticated(): boolean {
    return !!this.token;
  }
}
