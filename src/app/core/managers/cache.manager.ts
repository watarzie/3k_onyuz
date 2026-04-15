import { Injectable } from '@angular/core';

/**
 * LocalStorage tabanlı cache yöneticisi.
 * TTL (Time-To-Live) desteği ile verileri otomatik expire eder.
 * befasoft-app referans mimarisinden adapte edildi.
 */
@Injectable({ providedIn: 'root' })
export class CacheManager {

  set<T>(key: string, value: T, ttlMinutes: number = 60): void {
    const record = {
      value,
      expiry: new Date().getTime() + ttlMinutes * 60 * 1000
    };
    localStorage.setItem(key, JSON.stringify(record));
  }

  get<T>(key: string): T | null {
    const record = localStorage.getItem(key);
    if (!record) return null;

    try {
      const parsed = JSON.parse(record);
      if (new Date().getTime() > parsed.expiry) {
        localStorage.removeItem(key);
        return null;
      }
      return parsed.value as T;
    } catch {
      localStorage.removeItem(key);
      return null;
    }
  }

  remove(key: string): void {
    localStorage.removeItem(key);
  }

  clear(): void {
    localStorage.clear();
  }
}
