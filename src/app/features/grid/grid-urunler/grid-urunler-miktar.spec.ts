import { GridUrunDto } from '../../../shared/models/grid.model';
import { GridUrunlerComponent } from './grid-urunler.component';

describe('Grid ürün miktarı gösterimi', () => {
  // Yalnızca saf gösterim yardımcıları sınanır; servisler oluşturulmaz ve HTTP çağrılmaz.
  const component = Object.create(GridUrunlerComponent.prototype) as GridUrunlerComponent;
  const urun = (values: Partial<GridUrunDto>): GridUrunDto => ({
    istenenAdet: 3,
    anaIstenenAdet: 3,
    sandikMiktari: 1,
    sandikBazliDagitim: false,
    ...values,
  } as GridUrunDto);

  it('eski tahsis yerine güncel API miktarını başlıkta gösterir', () => {
    const row = urun({ orijinalIstenenAdet: 1 });
    expect(component.getGuncelMiktar(row)).toBe(3);
    expect(component.getSandikMiktari(row)).toBe(1);
    expect(component.hasMiktarDuzenlemesi(row)).toBeTrue();
  });

  it('sonraki güncellemelerde ilk miktarı güncel miktarla karıştırmaz', () => {
    for (const miktar of [3, 5, 2, 1]) {
      const row = urun({ istenenAdet: miktar, anaIstenenAdet: miktar, orijinalIstenenAdet: 1 });
      expect(component.getGuncelMiktar(row)).toBe(miktar);
      expect(component.hasMiktarDuzenlemesi(row)).toBeTrue();
      expect(row.orijinalIstenenAdet).toBe(1);
    }
  });

  it('ilk miktar bilinmiyorsa tahsisten sahte geçmiş üretmez', () => {
    for (const orijinalIstenenAdet of [undefined, null, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(component.hasMiktarDuzenlemesi(urun({ orijinalIstenenAdet }))).toBeFalse();
    }
  });

  it('güncel miktar eski miktara dönse de kayıtlı düzenleme bilgisini korur', () => {
    expect(component.hasMiktarDuzenlemesi(urun({ orijinalIstenenAdet: 3 }))).toBeTrue();
  });

  it('parçalı tahsiste satır miktarı ile gerçek ana toplamı ayrı tutar', () => {
    const row = urun({ istenenAdet: 4, sandikMiktari: 4, anaIstenenAdet: 10, sandikBazliDagitim: true, orijinalIstenenAdet: 8 });
    expect(component.getGuncelMiktar(row)).toBe(4);
    expect(component.getAnaIstenenAdet(row)).toBe(10);
    expect(component.hasAnaToplamFarki(row)).toBeTrue();
    expect(component.hasMiktarDuzenlemesi(row)).toBeTrue();
  });
  it('ilk düzenleme öncesi sıfır miktarını boş veya değişmemiş saymaz', () => {
    expect(component.hasMiktarDuzenlemesi(urun({ orijinalIstenenAdet: 0 }))).toBeTrue();
  });

  it('kayıtlı düzenleme yoksa çoklu sandık tahsisini miktar güncellemesi saymaz', () => {
    const row = urun({ istenenAdet: 4, sandikMiktari: 4, anaIstenenAdet: 10, sandikBazliDagitim: true, orijinalIstenenAdet: null });
    expect(component.hasAnaToplamFarki(row)).toBeTrue();
    expect(component.hasMiktarDuzenlemesi(row)).toBeFalse();
  });
});
