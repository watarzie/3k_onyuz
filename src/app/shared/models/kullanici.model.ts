export interface KullaniciDto {
  id: number;
  adSoyad: string;
  basHarf: string;
  rolId: number;
  rol: string;
  email: string;
  ikiFaktorZorunluMu: boolean;
  ikiFaktorEtkinMi: boolean;
  ikiFaktorDogrulandiTarihiUtc: string | null;
}

export interface KullaniciIkiFaktorDurumDto {
  kullaniciId: number;
  ikiFaktorZorunluMu: boolean;
  ikiFaktorEtkinMi: boolean;
  ikiFaktorDogrulandiTarihiUtc: string | null;
}

export interface KullaniciGuncelleRequest {
  id: number;
  adSoyad: string;
  rolId: number;
}
