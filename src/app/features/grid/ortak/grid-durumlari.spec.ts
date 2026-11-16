import { SurecDurum } from '../../../core/constants/enums';
import {
  KALITE_SECENEKLERI, SUREC_BOS_RENK, SUREC_SECENEKLERI, TALEP_SUREC_SECENEKLERI, kaliteDurumRengi, kaliteEtiketi,
  surecDurumRengi, surecEtiketi, talepSurecGruplari,
} from './grid-durumlari';

describe('Grid süreç durumları', () => {
  it('seçenekler sunucu enum sırası ve lookup adlarıyla birebirdir', () => {
    expect(SUREC_SECENEKLERI.map(s => [s.id, s.etiket])).toEqual([
      [SurecDurum.Ambar, 'Ambar'],
      [SurecDurum.Imalat, 'İmalat'],
      [SurecDurum.Tedarik, 'Tedarik'],
      [SurecDurum.Tedarik3KTeslim, 'Tedarik 3K Teslim'],
      [SurecDurum.Sipariste, 'Siparişte'],
      [SurecDurum.Tamamlandi, 'Tamamlandı'],
    ]);
  });

  it('rozet renkleri Grid tablosundaki renklerdir; boş ve bilinmeyen değer gridir', () => {
    expect(surecDurumRengi('Tamamlandı')).toBe('#25B003');
    expect(surecDurumRengi('Siparişte')).toBe('#D97706');
    expect(surecDurumRengi(undefined)).toBe(SUREC_BOS_RENK);
    expect(surecDurumRengi('Bilinmeyen')).toBe(SUREC_BOS_RENK);
  });

  it('talep formu Tamamlandı sürecini sunmaz', () => {
    expect(TALEP_SUREC_SECENEKLERI.some(s => s.id === SurecDurum.Tamamlandi)).toBeFalse();
    expect(TALEP_SUREC_SECENEKLERI.length).toBe(5);
  });

  it('süreç adı sayıdan bulunur; tanımsız sayı "-" döner', () => {
    expect(surecEtiketi(SurecDurum.Tedarik3KTeslim)).toBe('Tedarik 3K Teslim');
    expect(surecEtiketi(null)).toBe('-');
    expect(surecEtiketi(99)).toBe('-');
  });

  it('talep satırlarını sürece göre gruplar, bölünmüş satırın çeki satırını bir kez gönderir', () => {
    const gruplar = talepSurecGruplari([
      { cekiSatiriId: 10, surecDurumId: SurecDurum.Imalat },
      { cekiSatiriId: 11, surecDurumId: SurecDurum.Ambar },
      { cekiSatiriId: 10, surecDurumId: SurecDurum.Imalat },
      { cekiSatiriId: 12, surecDurumId: SurecDurum.Imalat },
    ]);

    expect(gruplar).toEqual([
      { surecDurumId: SurecDurum.Imalat, cekiSatiriIdler: [10, 12] },
      { surecDurumId: SurecDurum.Ambar, cekiSatiriIdler: [11] },
    ]);
  });

  it('kalite seçenekleri lookup sayılarıyla birebir; renk kuralı Grid tablosundaki kuraldır', () => {
    expect(KALITE_SECENEKLERI.map(s => [s.id, s.etiket])).toEqual([[1, 'Onaylandı'], [2, 'Tadilatta']]);
    expect(kaliteDurumRengi('Onaylandı')).toBe('#25B003');
    expect(kaliteDurumRengi('Tadilatta')).toBe('#E65100');
    expect(kaliteDurumRengi('Başka')).toBe('#E65100');
    expect(kaliteDurumRengi(null)).toBe(SUREC_BOS_RENK);
    expect(kaliteEtiketi(2)).toBe('Tadilatta');
    expect(kaliteEtiketi(undefined)).toBe('-');
  });
});
