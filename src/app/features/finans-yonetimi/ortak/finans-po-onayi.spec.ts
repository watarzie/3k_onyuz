import { FinansPoOnayDurumu } from '../../../core/constants/enums';
import { ApiResult, FinansPoOnayGonderSonucu } from '../../../shared/models';
import { poOnayaGonderilebilir, poOnayDurumuAnahtari, poOnayDurumuSinifi } from './finans-etiketleri';
import { poOnayBildirimleri, poOnayGonderimSonucu } from './finans-po-onayi';

const sonuc: FinansPoOnayGonderSonucu = {
  talepler: [{ talepId: 4, projeNo: 'PA727-03', ad: 'Ana Ambalaj', kalemSayisi: 3, netTutar: 520.3, paraBirimi: 'EUR' }],
  kalemSayisi: 3,
  atlananKalemSayisi: 2,
  onayaAlinanTalepSayisi: 1,
  dogrudanOnaylananTalepSayisi: 0,
};

describe('Finans PO öncesi iş onayı yardımcıları', () => {
  it('202 yanıtında sonucu gövdenin value alanından okur, kuyruk ve atlanan kalemi bildirir', () => {
    const kuyrukta = {
      isSuccess: true,
      statusCode: 202,
      value: { message: 'İşleminiz yetkili onayına sunulmuştur.', statusCode: 202, value: sonuc },
    } as unknown as ApiResult<FinansPoOnayGonderSonucu>;
    expect(poOnayGonderimSonucu(kuyrukta)).toEqual(sonuc);
    expect(poOnayBildirimleri(kuyrukta)).toEqual([
      { tur: 'info', anahtar: 'PO_APPROVAL_SENT', sayi: 1 },
      { tur: 'info', anahtar: 'PO_APPROVAL_SKIPPED', sayi: 2 },
    ]);
  });

  it('kural kapalıyken (200) hemen onaylanan grupları başarı olarak bildirir', () => {
    const dogrudan: ApiResult<FinansPoOnayGonderSonucu> = {
      isSuccess: true,
      value: { ...sonuc, atlananKalemSayisi: 0, onayaAlinanTalepSayisi: 0, dogrudanOnaylananTalepSayisi: 1 },
    };
    expect(poOnayBildirimleri(dogrudan)).toEqual([{ tur: 'success', anahtar: 'PO_APPROVAL_DIRECT', sayi: 1 }]);
  });

  it('durum etiketi ve rengi: kapsam dışı rozetsiz, onaylı yeşil, ret/düşen kırmızı; yalnız sunulmamış/ret/düşen gönderilir', () => {
    expect(poOnayDurumuAnahtari(FinansPoOnayDurumu.Gerekmiyor)).toBeNull();
    expect(poOnayDurumuAnahtari(undefined)).toBeNull();
    expect(poOnayDurumuAnahtari(FinansPoOnayDurumu.OnayBekliyor)).toBe('PO_APPROVAL_PENDING');
    expect(poOnayDurumuSinifi(FinansPoOnayDurumu.Onaylandi)).toBe('is-active');
    expect(poOnayDurumuSinifi(FinansPoOnayDurumu.OnayDustu)).toBe('is-danger');
    expect(poOnayDurumuSinifi(FinansPoOnayDurumu.OnayaSunulmadi)).toBe('is-warning');
    expect(
      [0, 1, 2, 3, 4, 5].filter((durum) => poOnayaGonderilebilir(durum as FinansPoOnayDurumu)),
    ).toEqual([1, 4, 5]);
  });
});
