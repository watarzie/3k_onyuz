import { ApiResult } from './common.model';

// ===== Auth =====

export type { ApiResult };

export interface LoginDto {
  email: string;
  sifre: string;
}

export interface RegisterDto {
  adSoyad: string;
  email: string;
  sifre: string;
  rol: string;
}

export interface LoginResultDto {
  token: string;
  kullanici: KullaniciDto;
}

export interface KullaniciDto {
  id: number;
  adSoyad: string;
  basHarf: string;
  rol: string;
  email: string;
}

export interface KullaniciOlusturDto {
  adSoyad: string;
  email: string;
  sifre: string;
  rol: string;
}
