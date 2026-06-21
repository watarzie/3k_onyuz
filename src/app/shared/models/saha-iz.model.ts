export interface SahaTamamlamaIzDto {
  kaynakCekiSatiriId: number;
  kaynakProjeId: number;
  kaynakProjeNo: string;
  kaynakSandikNo: string;
  kaynakSiraNo: number;
  kaynakUrunAdi: string;
  sahaProjeId: number;
  sahaProjeNo: string;
  sahaSandikId: number;
  sahaSandikNo: string;
  sahaCekiSatiriId: number;
  miktar: number;
  birimId: number;
  birim: string;
  durumId: number;
  durumMetni: string;
  sevkEdildiMi: boolean;
  sevkTarihi?: string;
}
