import { ApiResult } from './common.model';

// ===== Auth =====

export type { ApiResult };

export interface LoginDto {
  email: string;
  sifre: string;
  beniHatirla: boolean;
}

export interface RegisterDto {
  adSoyad: string;
  email: string;
  sifre: string;
  rolId: number;
}

export type LoginNextStep =
  | 'authenticated'
  | 'twoFactorRequired'
  | 'twoFactorSetupRequired';

export interface LoginResultDto {
  nextStep: LoginNextStep;
  token?: string | null;
  kullanici?: KullaniciAuthDto | null;
  challengeToken?: string | null;
  expiresInSeconds?: number | null;
  kurtarmaKodlari?: string[] | null;
}

export interface TwoFactorSetupStartRequest {
  challengeToken: string;
}

export interface TwoFactorCodeRequest {
  challengeToken: string;
  kod: string;
}

export interface TwoFactorRecoveryRequest {
  challengeToken: string;
  kurtarmaKodu: string;
}

export interface TwoFactorSetupDto {
  challengeToken: string;
  expiresInSeconds: number;
  qrCodeDataUri: string;
  manuelAnahtar: string;
}

export interface PendingTwoFactorChallenge {
  challengeToken: string;
  nextStep: Exclude<LoginNextStep, 'authenticated'>;
  expiresAt: number;
  rememberMe: boolean;
}

export interface KullaniciAuthDto {
  id: number;
  adSoyad: string;
  basHarf: string;
  rol: string;
  rolId: number;
  email: string;
}
