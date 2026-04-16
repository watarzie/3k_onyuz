import { Injectable } from '@angular/core';

const TOKEN_KEY = '3k_token';
const LANG_KEY = '3k_lang';

// Eski key'ler — temizlenmesi gereken
const LEGACY_KEYS = ['3k_user', '3k_role', '3k_rolId'];

/**
 * Oturum bilgilerini merkezi olarak yöneten servis.
 *
 * GÜVENLİK:
 * - Sadece JWT token ve dil tercihi localStorage'da tutulur.
 * - Kullanıcı bilgileri (rol, ad, email) JWT'den decode edilir.
 * - Hassas bilgiler localStorage'da SAKLANMAZ.
 */
@Injectable({ providedIn: 'root' })
export class SessionManager {

  constructor() {
    // Uygulama başladığında eski key'leri temizle
    this.cleanLegacyKeys();
  }

  // ===== Token =====
  setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  }

  get token(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  // ===== Dil (güvenlik dışı) =====
  setLang(lang: string): void {
    localStorage.setItem(LANG_KEY, lang);
  }

  getLang(): string {
    return localStorage.getItem(LANG_KEY) ?? 'tr';
  }

  // ===== JWT Decode =====

  /**
   * JWT payload'ından claim'leri decode eder.
   * UTF-8 desteği ile — Türkçe karakterler (Ö, Ü, İ, Ş, Ç, Ğ) doğru okunur.
   */
  private decodeToken(): Record<string, string> | null {
    const token = this.token;
    if (!token) return null;
    try {
      const payload = token.split('.')[1];
      // Base64URL → Base64 dönüşümü
      const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
      // UTF-8 uyumlu decode
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch {
      return null;
    }
  }

  /** JWT'den RolId claim'ini okur */
  getRolId(): number | null {
    const payload = this.decodeToken();
    if (!payload?.['RolId']) return null;
    return parseInt(payload['RolId'], 10);
  }

  /** JWT'den rol adını okur */
  getRole(): string | null {
    const payload = this.decodeToken();
    return payload?.['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] ?? null;
  }

  /** JWT'den kullanıcı bilgilerini okur */
  getUser(): { id: number; adSoyad: string; basHarf: string; email: string; rol: string; rolId: number } | null {
    const payload = this.decodeToken();
    if (!payload) return null;
    return {
      id: parseInt(payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] ?? '0', 10),
      adSoyad: payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] ?? '',
      basHarf: payload['BasHarf'] ?? '',
      email: payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] ?? '',
      rol: payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] ?? '',
      rolId: parseInt(payload['RolId'] ?? '0', 10),
    };
  }

  /**
   * Token süresi dolmuş mu kontrol eder.
   * JWT'deki 'exp' claim'i (Unix timestamp) kullanılır.
   */
  isTokenExpired(): boolean {
    const payload = this.decodeToken();
    if (!payload?.['exp']) return true;
    const expiry = parseInt(payload['exp'], 10) * 1000; // ms
    return Date.now() > expiry;
  }

  /** Token expire tarihini döndürür */
  getTokenExpiryDate(): Date | null {
    const payload = this.decodeToken();
    if (!payload?.['exp']) return null;
    return new Date(parseInt(payload['exp'], 10) * 1000);
  }

  /** Oturum geçerli mi? (token var + süresi dolmamış) */
  isAuthenticated(): boolean {
    return !!this.token && !this.isTokenExpired();
  }

  /** Oturum bilgilerini temizle — eski key'ler dahil */
  clearAll(): void {
    localStorage.removeItem(TOKEN_KEY);
    this.cleanLegacyKeys();
    // 3k_lang bilerek temizlenmez — dil tercihi korunur
  }

  /** Eski oturum key'lerini temizle */
  private cleanLegacyKeys(): void {
    for (const key of LEGACY_KEYS) {
      localStorage.removeItem(key);
    }
  }

  // ===== Eski API uyumluluğu (deprecated — no-op) =====
  setUser(_user: unknown): void { /* JWT'den okunur */ }
  setRole(_role: string): void { /* JWT'den okunur */ }
  setRolId(_rolId: number): void { /* JWT'den okunur */ }

  getSession<T>(key: string): T | null {
    if (key === '3k_user') return this.getUser() as T | null;
    return null;
  }
}
