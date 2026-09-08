import { UcKUrunDto } from '../../../shared/models/uck.model';
import { UcKUrunlerComponent } from './uck-urunler.component';

describe('3K ürün miktarı gösterimi', () => {
  // Yalnızca saf gösterim yardımcıları sınanır; fiziksel işlem limitleri değiştirilmez.
  const component = Object.create(UcKUrunlerComponent.prototype) as UcKUrunlerComponent;
  const urun = (values: Partial<UcKUrunDto>): UcKUrunDto => ({
    istenenAdet: 1,
    anaIstenenAdet: 3,
    sandikMiktari: 1,
    sandikBazliDagitim: false,
    ...values,
  } as UcKUrunDto);

  it('tek satırda güncel ana miktarı gösterir, fiziksel tahsis yardımcısını değiştirmez', () => {
    const row = urun({ orijinalIstenenAdet: 1 });
    expect(component.getGuncelMiktar(row)).toBe(3);
    expect(component.getSandikMiktari(row)).toBe(1);
    expect(component.hasMiktarDuzenlemesi(row)).toBeTrue();
  });

  it('parçalı satırda fiziksel sandık miktarını ve ana toplamı ayrı gösterir', () => {
    const row = urun({ sandikMiktari: 4, anaIstenenAdet: 10, sandikBazliDagitim: true, orijinalIstenenAdet: 8 });
    expect(component.getGuncelMiktar(row)).toBe(4);
    expect(component.getAnaIstenenAdet(row)).toBe(10);
    expect(component.hasAnaToplamFarki(row)).toBeTrue();
    expect(component.hasMiktarDuzenlemesi(row)).toBeTrue();
  });

  it('parçalı tahsis farkını miktar revizyonu sanmaz', () => {
    const row = urun({ sandikMiktari: 4, anaIstenenAdet: 10, sandikBazliDagitim: true, orijinalIstenenAdet: null });
    expect(component.hasAnaToplamFarki(row)).toBeTrue();
    expect(component.hasMiktarDuzenlemesi(row)).toBeFalse();
  });

  it('bilinmeyen ve geçersiz ilk miktar için eski tahsisi geçmiş gibi göstermez', () => {
    for (const orijinalIstenenAdet of [undefined, null, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(component.hasMiktarDuzenlemesi(urun({ orijinalIstenenAdet }))).toBeFalse();
    }
  });

  it('ondalık ilk düzenleme öncesi miktarı gösterim için korur', () => {
    const row = urun({ anaIstenenAdet: 3.625, orijinalIstenenAdet: 1.25 });
    expect(component.getGuncelMiktar(row)).toBe(3.625);
    expect(component.hasMiktarDuzenlemesi(row)).toBeTrue();
    expect(row.orijinalIstenenAdet).toBe(1.25);
  });
  it('miktar ilk değerine geri dönse de düzenleme göstergesini korur', () => {
    for (const anaIstenenAdet of [3, 1]) {
      const row = urun({ anaIstenenAdet, orijinalIstenenAdet: 1 });
      expect(component.getGuncelMiktar(row)).toBe(anaIstenenAdet);
      expect(component.hasMiktarDuzenlemesi(row)).toBeTrue();
    }
  });

  it('ilk düzenleme öncesi sıfır miktarı varsa düzenleme bilgisini gösterir', () => {
    expect(component.hasMiktarDuzenlemesi(urun({ orijinalIstenenAdet: 0 }))).toBeTrue();
  });
});
