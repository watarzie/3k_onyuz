export interface OnayBekleyenIslemDto {
  id: number;
  islemAciklamasi: string;
  talepEdenKisi: string;
  olusturulmaTarihi: string;
  durum: OnayDurumu;
}

export enum OnayDurumu {
  Bekliyor = 1,
  Onaylandi = 2,
  Reddedildi = 3
}

export interface IslemOnaylaCommand {
  onayBekleyenIslemId: number;
}

export interface IslemReddetCommand {
  onayBekleyenIslemId: number;
  redAciklamasi: string;
}
