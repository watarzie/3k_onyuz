import { ProjeDurum, ProjeTipi } from '../../core/constants/enums';
import { ProjeDropdownDto, aktifSahaProjeleri } from './proje.model';

describe('aktifSahaProjeleri', () => {
  const proje = (projeNo: string, projeTipiId: ProjeTipi, durumId: ProjeDurum): ProjeDropdownDto =>
    ({ id: 0, projeNo, musteri: '', projeTipiId, durumId });

  it('sevk edilmemiş saha projelerini proje numarasına göre sıralı verir', () => {
    const sonuc = aktifSahaProjeleri([
      proje('PA600-18-SAHA', ProjeTipi.Saha, ProjeDurum.Devam),
      proje('PA571-01-SAHA', ProjeTipi.Saha, ProjeDurum.Hazirlaniyor),
      proje('PA572-01-SAHA', ProjeTipi.Saha, ProjeDurum.SevkEdildi),
      proje('PA573-01-SAHA', ProjeTipi.Saha, ProjeDurum.EksikSevkEdildi),
      proje('PA574-01', ProjeTipi.Normal, ProjeDurum.Devam),
      proje('PA575-01-SP', ProjeTipi.Yedek, ProjeDurum.Devam),
    ]);

    expect(sonuc.map(p => p.projeNo)).toEqual(['PA571-01-SAHA', 'PA600-18-SAHA']);
  });
});
