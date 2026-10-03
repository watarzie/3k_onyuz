import { signal } from '@angular/core';
import { NEVER } from 'rxjs';
import { GridDurum, GridSevkDurum, UcKDurum } from '../../../core/constants/enums';
import { GridDurumGuncelleDto, GridUrunDto } from '../../../shared/models/grid.model';
import { GridUrunlerComponent } from './grid-urunler.component';

describe('Grid ürün yeniden sevk uygunluğu', () => {
  // Yalnızca saf iş kuralı yardımcıları sınanır; servisler oluşturulmaz ve HTTP çağrılmaz.
  const component = Object.create(GridUrunlerComponent.prototype) as GridUrunlerComponent;
  const urun = (values: Partial<GridUrunDto> = {}): GridUrunDto => ({
    cekiSatiriId: 69923,
    istenenAdet: 3,
    birim: 'Adet',
    gridDurumuId: GridDurum.TamGeldi,
    gridDurumuMetni: 'Tam Geldi',
    gridGelenAdet: 3,
    trafoSevkAdet: 0,
    gridSevkDurumuId: GridSevkDurum.SevkEdildi,
    gridSevkDurumuMetni: 'Sevk Edildi',
    gridSevkMiktari: 2,
    yenidenSevkGerekliAdet: 0,
    projeGonderilen: 0,
    gelenMiktar: 2,
    kalanMiktar: 1,
    ucKDurumuId: UcKDurum.TamGeldi,
    sandikSevkEdildiMi: false,
    ...values,
  } as GridUrunDto);

  const panelComponentOlustur = (): GridUrunlerComponent => {
    const result = Object.create(GridUrunlerComponent.prototype) as GridUrunlerComponent;
    result.projeId = signal(699);
    result.showPanel = signal(false);
    result.panelUrun = signal<GridUrunDto | null>(null);
    result.panelDurum = signal('');
    result.panelGelenAdet = signal(0);
    result.panelTrafoSevkAdet = signal(0);
    result.panelSevkDurumu = signal('Sevk Edilmedi');
    result.panelSevkAdet = signal(0);
    result.panelAciklama = signal('');
    result.panelSaving = signal(false);
    result.panelError = signal('');
    result.panelUyari = signal('');
    return result;
  };

  it('backend uygun bulduğu Tam Geldi satırını kalan sevke açar', () => {
    const row = urun({
      gridYenidenSevkEdilebilirMi: true,
      gridYenidenSevkUstSiniri: 1,
    });

    expect(component.isGridYenidenSevkAcikUrun(row)).toBeTrue();
    expect(component.getYenidenSevkLimit(row)).toBe(1);
    expect(component.isUcKIslemYapilmis(row)).toBeFalse();
  });

  it('miktar limitini istemci kalanından değil backend üst sınırından alır', () => {
    const row = urun({
      kalanMiktar: 5,
      gridYenidenSevkEdilebilirMi: true,
      gridYenidenSevkUstSiniri: 1,
    });

    expect(component.getYenidenSevkLimit(row)).toBe(1);
  });

  it('backend izin vermediğinde 3K işlemi bulunan Tam Geldi satırını kilitli tutar', () => {
    const row = urun({
      gridYenidenSevkEdilebilirMi: false,
      gridYenidenSevkUstSiniri: 0,
    });

    expect(component.isGridYenidenSevkAcikUrun(row)).toBeFalse();
    expect(component.isUcKIslemYapilmis(row)).toBeTrue();
  });

  it('backend kararı false ise eski Eksik Geldi fallback koşuluyla satırı yeniden açmaz', () => {
    const row = urun({
      gridDurumuId: GridDurum.EksikGeldi,
      gridYenidenSevkEdilebilirMi: false,
      gridYenidenSevkUstSiniri: 0,
    });

    expect(component.isParcaliEksikYenidenSevkUrun(row)).toBeTrue();
    expect(component.isGridYenidenSevkAcikUrun(row)).toBeFalse();
    expect(component.getYenidenSevkLimit(row)).toBe(0);
  });

  it('sevk edilmiş fiziksel sandık kilidini yeniden sevk izniyle kaldırmaz', () => {
    const row = urun({
      sandikSevkEdildiMi: true,
      gridYenidenSevkEdilebilirMi: true,
      gridYenidenSevkUstSiniri: 1,
    });

    expect(component.isSatirSevkKilidi(row)).toBeTrue();
  });

  it('eski Eksik Geldi parçalı sevk davranışını backend alanları olmadan korur', () => {
    const row = urun({
      gridDurumuId: GridDurum.EksikGeldi,
      gridYenidenSevkEdilebilirMi: undefined,
      gridYenidenSevkUstSiniri: undefined,
    });

    expect(component.isParcaliEksikYenidenSevkUrun(row)).toBeTrue();
    expect(component.isGridYenidenSevkAcikUrun(row)).toBeTrue();
    expect(component.getYenidenSevkLimit(row)).toBe(1);
  });

  it('3K karşılaması bekleyen ilk Eksik kaydı backend yeniden sevke kapalıyken Tam Geldi yapmaz', () => {
    const panelComponent = panelComponentOlustur();
    const row = urun({
      istenenAdet: 4,
      gridDurumuId: GridDurum.EksikGeldi,
      gridDurumuMetni: 'Eksik Geldi',
      gridGelenAdet: 2,
      gridSevkMiktari: 2,
      gelenMiktar: 0,
      kalanMiktar: 4,
      ucKDurumuId: UcKDurum.Bekliyor,
      gridYenidenSevkEdilebilirMi: false,
      gridYenidenSevkUstSiniri: 0,
    });

    panelComponent.openPanel(row);

    expect(panelComponent.panelDurum()).toBe('Eksik Geldi');
    expect(panelComponent.panelGelenAdet()).toBe(2);
    expect(panelComponent.isParcaliEksikYenidenSevk).toBeFalse();
  });

  it('3K öncesi Eksik miktar düzeltmesini toplamayarak 2 yerine mutlak 3 gönderir', () => {
    const panelComponent = panelComponentOlustur();
    const row = urun({
      istenenAdet: 4,
      gridDurumuId: GridDurum.EksikGeldi,
      gridDurumuMetni: 'Eksik Geldi',
      gridGelenAdet: 2,
      gridSevkMiktari: 2,
      gelenMiktar: 0,
      kalanMiktar: 4,
      ucKDurumuId: UcKDurum.Bekliyor,
      gridYenidenSevkEdilebilirMi: false,
      gridYenidenSevkUstSiniri: 0,
    });
    let gonderilen: GridDurumGuncelleDto | undefined;
    (panelComponent as any).gridService = {
      durumGuncelle: (dto: GridDurumGuncelleDto) => {
        gonderilen = dto;
        return NEVER;
      },
    };

    panelComponent.openPanel(row);
    panelComponent.panelGelenAdet.set(3);
    panelComponent.savePanel();

    expect(gonderilen).toEqual(jasmine.objectContaining({
      cekiSatiriId: 69923,
      projeId: 699,
      yeniDurumId: GridDurum.EksikGeldi,
      gridGelenAdet: 3,
      trafoSevkAdet: 0,
      gridSevkDurumuId: GridSevkDurum.SevkEdildi,
      sevkMiktari: 2,
    }));
  });

  it('3K karşılaması başlamadan sevk miktarını 2 üzerine eklemeyip mutlak 3 olarak günceller', () => {
    const panelComponent = panelComponentOlustur();
    const row = urun({
      istenenAdet: 3,
      gridDurumuId: GridDurum.TamGeldi,
      gridDurumuMetni: 'Tam Geldi',
      gridGelenAdet: 3,
      gridSevkMiktari: 2,
      gelenMiktar: 0,
      kalanMiktar: 3,
      ucKDurumuId: UcKDurum.Bekliyor,
      gridYenidenSevkEdilebilirMi: false,
      gridYenidenSevkUstSiniri: 0,
    });
    let gonderilen: GridDurumGuncelleDto | undefined;
    (panelComponent as any).gridService = {
      durumGuncelle: (dto: GridDurumGuncelleDto) => {
        gonderilen = dto;
        return NEVER;
      },
    };

    panelComponent.openPanel(row);

    expect(panelComponent.isGridYenidenSevkAcik).toBeFalse();
    expect(panelComponent.panelSevkAdet()).toBe(2);

    panelComponent.panelSevkAdet.set(3);
    panelComponent.savePanel();

    expect(gonderilen).toEqual(jasmine.objectContaining({
      cekiSatiriId: 69923,
      yeniDurumId: GridDurum.TamGeldi,
      gridGelenAdet: 3,
      sevkMiktari: 3,
    }));
  });

  it('çok sandıklı satırda Tam Geldi ve sevk satır toplamıyla gönderilir; sandık payıyla daraltılmaz', () => {
    // PA559-01: istenen 2, Sandık 10 ve Sandık 11 arasında 1+1 dağıtılmış; panel Sandık 11 satırından açılır.
    const panelComponent = panelComponentOlustur();
    const row = urun({
      istenenAdet: 1,
      anaIstenenAdet: 2,
      sandikMiktari: 1,
      sandikBazliDagitim: true,
      gridDurumuId: GridDurum.Bekliyor,
      gridDurumuMetni: 'Bekliyor',
      gridGelenAdet: 0,
      gridSevkDurumuId: GridSevkDurum.Bekliyor,
      gridSevkDurumuMetni: 'Bekliyor',
      gridSevkMiktari: undefined,
      gelenMiktar: 0,
      kalanMiktar: 1,
      toplamUcKGelenMiktar: 0,
      toplamKalanMiktar: 2,
      ucKDurumuId: UcKDurum.Bekliyor,
      gridYenidenSevkEdilebilirMi: false,
      gridYenidenSevkUstSiniri: 0,
    });
    let gonderilen: GridDurumGuncelleDto | undefined;
    (panelComponent as any).gridService = {
      durumGuncelle: (dto: GridDurumGuncelleDto) => {
        gonderilen = dto;
        return NEVER;
      },
    };

    panelComponent.openPanel(row);
    panelComponent.onDurumChange('Tam Geldi');
    panelComponent.onSevkDurumChange('Sevk Edildi');

    expect(panelComponent.panelGelenAdet()).toBe(2);
    expect(panelComponent.maxSevkAdet).toBe(2);
    expect(panelComponent.panelSevkAdet()).toBe(2);
    expect(panelComponent.panelEksik).toBe(0);
    panelComponent.savePanel();
    expect(gonderilen).toEqual(jasmine.objectContaining({ gridGelenAdet: 2, sevkMiktari: 2 }));
  });

  it('çok sandıklı satırda Grid sevk gösterimi ve 3K işlem kontrolü satır geleniyle yapılır', () => {
    // Sandık 11 boş (gelen 0) fakat satırda 1 adet 3K'ya ulaşmış: satır 3K işlemli sayılır.
    const row = urun({
      istenenAdet: 1,
      anaIstenenAdet: 2,
      sandikBazliDagitim: true,
      gridSevkMiktari: 1,
      gelenMiktar: 0,
      kalanMiktar: 1,
      toplamUcKGelenMiktar: 1,
      toplamKalanMiktar: 1,
      ucKDurumuId: UcKDurum.Bekliyor,
      gridSevkDurumuId: GridSevkDurum.SevkEdildi,
      gridYenidenSevkEdilebilirMi: false,
      gridYenidenSevkUstSiniri: 0,
    });

    expect(component.getSatirGelen(row)).toBe(1);
    expect(component.isUcKIslemYapilmis(row)).toBeTrue();
    expect(component.getGridSevkGorunum(row)).toBe(2);
  });
});
