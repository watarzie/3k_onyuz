import { FinansIsKaydi, FinansSandikKirilimKalemi, FinansSandikKirilimSatiri } from '../../../shared/models/finans.model';
import {
  aramaProjeGruplari,
  ilkSatirlar,
  kategoriKirilimKayitlari,
  kirilimSandiklari,
  projeAnahtari,
  sandikNoKarsilastir,
} from './finans-kirilim';

const kalem = (id: number, over: Partial<FinansSandikKirilimKalemi> = {}): FinansSandikKirilimKalemi => ({
  id, isTuru: 1, kategori: 1, kaynakBileseni: 'NET', isAdi: 'Normal Ambalaj', finansTarihi: '2026-09-20', adet: 1,
  toplamM3: 1, ahsapM3: 1, kontraM3: 0, paraBirimi: 'EUR', netTutar: 100, siparisNetTutar: 0, faturalananNetTutar: 0,
  durum: 1, aktif: true, poNumaralari: [], faturaNumaralari: [], ...over,
});
const sandik = (sandikNo: string | null, kayitlar: FinansSandikKirilimKalemi[], paraBirimi = 'EUR'): FinansSandikKirilimSatiri => ({
  anahtar: `${sandikNo}|${paraBirimi}`, sandikNo, sandikAdi: null, sandikTipi: null, sandikCinsi: null, sandikMalzemesi: 0,
  kayitSayisi: kayitlar.length, fiyatBekleyenKayitSayisi: 0, adet: 1, toplamM3: 1, ahsapM3: 1, kontraM3: 0, paraBirimi,
  netTutar: 100, siparisNetTutar: 0, faturalananNetTutar: 0, durum: 1, ilkTarih: '', sonTarih: '',
  poNumaralari: [], faturaNumaralari: [], kayitlar,
});
const isKaydi = (id: number, over: Partial<FinansIsKaydi>): FinansIsKaydi =>
  ({ id, projeId: null, projeNo: 'PA-1', musteri: 'GE', sandikNo: '', sandikAdi: '', isTuru: 1, kategori: 1, netTutar: 10,
     paraBirimi: 'EUR', poNumaralari: [], faturaNumaralari: [], ...over }) as FinansIsKaydi;

describe('Finans proje → sandık kırılımı yardımcıları', () => {
  it('sandık no doğal sırada, sandık no\'suz satır en sonda', () => {
    expect(['10', '', '2', 'S-10', 'S-9'].sort(sandikNoKarsilastir)).toEqual(['2', '10', 'S-9', 'S-10', '']);
    expect(kirilimSandiklari([sandik(null, []), sandik('10', []), sandik('2', [])]).map((x) => x.sandikNo)).toEqual(['2', '10', null]);
  });

  it('ilk sekiz satır gösterilir; tümü açıkken bütün liste', () => {
    const liste = Array.from({ length: 12 }, (_, i) => i);
    expect(ilkSatirlar(liste, false).length).toBe(8);
    expect(ilkSatirlar(liste, true).length).toBe(12);
    expect(ilkSatirlar([1, 2], false)).toEqual([1, 2]);
  });

  it('kategori satırı kırılımı yalnız o satırın kayıtlarını sandık sırasıyla verir', () => {
    const sonuc = kategoriKirilimKayitlari(
      [sandik('10', [kalem(1), kalem(2, { isTuru: 9, kaynakBileseni: 'SARF' })]), sandik('2', [kalem(3), kalem(4, { isTuru: 9 })])],
      [1, 3],
    );
    expect(sonuc.map((x) => [x.sandik.sandikNo, x.kayit.id])).toEqual([['2', 3], ['10', 1]]);
  });

  it('arama sonucu proje → sandık gruplanır; NET ve SARF aynı sandıkta, alt toplamlar para birimi bazında', () => {
    const gruplar = aramaProjeGruplari([
      isKaydi(1, { sandikNo: '10', kaynakKayitId: 'K10', netTutar: 400, finansTarihi: '2026-09-02' }),
      isKaydi(2, { sandikNo: '10', kaynakKayitId: 'K10', isTuru: 9, kategori: 2, kaynakBileseni: 'SARF', netTutar: 50 }),
      isKaydi(3, { sandikNo: '2', kaynakKayitId: 'K2', netTutar: 300, finansTarihi: '2026-09-01' }),
      isKaydi(4, { sandikNo: '', isTuru: 6, kategori: 7, netTutar: 20, paraBirimi: 'TRY' }),
      isKaydi(5, { projeId: 7, projeNo: 'PA-2', sandikNo: '1', kaynakKayitId: 'K1', netTutar: null }),
    ]);
    expect(gruplar.map((g) => g.anahtar)).toEqual(['M:PA-1\u001fGE', 'P:7']);
    const [pa1, pa2] = gruplar;
    expect(pa1.sandiklar.map((s) => [s.sandikNo, s.kalemler.map((k) => k.id)])).toEqual([['2', [3]], ['10', [1, 2]], ['', [4]]]);
    expect(pa1.sandiklar[1].toplamlar).toEqual([{ paraBirimi: 'EUR', net: 450 }]);
    expect(pa1.toplamlar).toEqual([{ paraBirimi: 'EUR', net: 750 }, { paraBirimi: 'TRY', net: 20 }]);
    expect([pa1.ilkTarih, pa1.sonTarih, pa1.kategoriSayisi]).toEqual(['2026-09-01', '2026-09-02', 3]);
    expect(pa1.kalemler.map((k) => k.id)).toEqual([3, 1, 2, 4]);
    expect(pa2.toplamlar).toEqual([]);
    expect(projeAnahtari({ projeId: 7, projeNo: 'X', musteri: 'Y' })).toBe('P:7');
  });
});
