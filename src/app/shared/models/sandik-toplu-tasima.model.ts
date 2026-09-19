export interface SandikTopluTasimaSatiri {
  kaynakSandikIcerikId: number;
  tasinanAdet: number;
}

export interface SandikUrunleriTopluTasiDto {
  projeId: number;
  kaynakSandikId: number;
  hedefSandikId: number;
  islemAnahtari: string;
  satirlar: SandikTopluTasimaSatiri[];
}
