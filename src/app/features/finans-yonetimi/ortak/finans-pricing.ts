export interface FinansFiyatSonucu {
  netTutar: number;
  kdvTutari: number;
  toplamTutar: number;
}

export function finansFiyatiHesapla(miktar: number, birimFiyat: number, kdvOrani: number): FinansFiyatSonucu {
  const netTutar = paraYuvarla(miktar * birimFiyat);
  const kdvTutari = paraYuvarla(netTutar * kdvOrani / 100);
  return { netTutar, kdvTutari, toplamTutar: netTutar + kdvTutari };
}

function paraYuvarla(tutar: number): number {
  return Math.round((tutar + Number.EPSILON) * 100) / 100;
}
