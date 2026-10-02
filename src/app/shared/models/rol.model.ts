import { YetkiTipi } from '../../core/constants/enums';

/** GET /api/rol — liste */
export interface RolDto {
  id: number;
  ad: string;
}

/** GET /api/rol/:id — detay + menü ağacı */
export interface RolDetayDto {
  id: number;
  ad: string;
  menuAgaci: MenuTreeDto[];
}

/** Menü ağacı node'u — recursive */
export interface MenuTreeDto {
  id: number;
  kod: string;
  labelKey: string;
  icon: string;
  route?: string;
  sira: number;
  yetkiTipiId: number;
  yetkiTipiMetni: string;
  children: MenuTreeDto[];
  /** UI-only state: parent referansı (set edildikten sonra) */
  parent?: MenuTreeDto;
}

/** PUT /api/rol — yetki kayıt item */
export interface RolYetkiItemDto {
  menuTanimiId: number;
  yetkiTipiId: number;
}

/** PUT /api/rol — request body */
export interface RolGuncelleRequest {
  id: number;
  ad: string;
  yetkiler: RolYetkiItemDto[];
}
