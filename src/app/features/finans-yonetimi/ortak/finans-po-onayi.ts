import { ApiResult, FinansPoOnayGonderSonucu, onayaAlindi } from '../../../shared/models';

/** "Onaya gönder" sonucunun kullanıcıya gösterilecek bildirimi. */
export interface PoOnayBildirimi {
  tur: 'success' | 'info';
  anahtar: string;
  sayi: number;
}

/**
 * "Onaya gönder" yanıtının gövdesi. Kural açıksa sunucu 202 ile döner ve sonuç gövdedeki `value` alanındadır
 * (`{ message, statusCode: 202, value }`); kural kapalıysa sonuç doğrudan gövdedir.
 */
export function poOnayGonderimSonucu(
  result: ApiResult<FinansPoOnayGonderSonucu>,
): FinansPoOnayGonderSonucu | undefined {
  return onayaAlindi(result)
    ? (result.value as unknown as { value?: FinansPoOnayGonderSonucu } | undefined)?.value
    : result.value;
}

/**
 * Başarılı gönderimin bildirimleri: Onay Merkezi'ne düşen talepler (bilgi) veya kural kapalıyken hemen onaylanan
 * gruplar (başarı); onaylı, onayda, fiyatsız veya kapsam dışı olduğu için atlanan kalemler ayrıca bildirilir.
 */
export function poOnayBildirimleri(result: ApiResult<FinansPoOnayGonderSonucu>): PoOnayBildirimi[] {
  const sonuc = poOnayGonderimSonucu(result);
  const bildirimler: PoOnayBildirimi[] = onayaAlindi(result)
    ? [{ tur: 'info', anahtar: 'PO_APPROVAL_SENT', sayi: sonuc?.onayaAlinanTalepSayisi ?? 0 }]
    : [{ tur: 'success', anahtar: 'PO_APPROVAL_DIRECT', sayi: sonuc?.dogrudanOnaylananTalepSayisi ?? 0 }];
  if (sonuc?.atlananKalemSayisi) bildirimler.push({ tur: 'info', anahtar: 'PO_APPROVAL_SKIPPED', sayi: sonuc.atlananKalemSayisi });
  return bildirimler;
}
