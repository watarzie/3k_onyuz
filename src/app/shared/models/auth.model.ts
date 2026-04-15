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
  rolId: number;
}

export interface LoginResultDto {
  token: string;
  kullanici: KullaniciAuthDto;
}

export interface KullaniciAuthDto {
  id: number;
  adSoyad: string;
  basHarf: string;
  rol: string;
  rolId: number;
  email: string;
}
