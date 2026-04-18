export interface KullaniciDto {
  id: number;
  adSoyad: string;
  basHarf: string;
  rolId: number;
  rol: string;
  email: string;
}

export interface KullaniciGuncelleRequest {
  id: number;
  adSoyad: string;
  rolId: number;
}
