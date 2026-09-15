import { signal } from '@angular/core';
import { GridDurum, GridSevkDurum, UcKDurum } from '../../../core/constants/enums';
import { UcKUrunDto } from '../../../shared/models/uck.model';
import { UcKUrunlerComponent } from './uck-urunler.component';

describe('3K aktif Grid sevk partisi', () => {
  let component: UcKUrunlerComponent;

  const urun = (values: Partial<UcKUrunDto> = {}): UcKUrunDto => ({
    cekiSatiriId: 69923,
    sahaTamamlamalari: [],
    siraNo: 23,
    barkodNo: 'FCT01181927',
    aciklama: 'Test ürünü',
    sandikNo: '23',
    sandikSevkEdildiMi: false,
    istenenAdet: 3,
    birimId: 1,
    birim: 'Adet',
    gridDurumuId: GridDurum.TamGeldi,
    gridDurumuMetni: 'Tam Geldi',
    gridGelenAdet: 3,
    trafoSevkAdet: 0,
    gridSevkDurumuId: GridSevkDurum.YenidenSevkGerekli,
    gridSevkDurumuMetni: 'Yeniden Sevk Gerekli',
    gridSevkMiktari: 1,
    ucKKarsilamaTipiId: UcKDurum.Bekliyor,
    ucKKarsilamaTipiMetni: 'Bekliyor',
    gelenMiktar: 2,
    karsilananMiktar: 0,
    hataliMiktar: 0,
    geriGonderilenMiktar: 0,
    stokKarsilanan: 0,
    projeKarsilanan: 0,
    projeGonderilen: 0,
    netKullanilabilir: 2,
    transferZinciriVar: false,
    transferZinciri: [],
    tedarikciKarsilanan: 0,
    eksikMiktar: 1,
    kalan: 1,
    kontrolUyari: '',
    genelDurumId: 1,
    genelDurumMetni: 'Bekliyor',
    isManuelEklenen: false,
    ...values,
  });

  beforeEach(() => {
    component = Object.create(UcKUrunlerComponent.prototype) as UcKUrunlerComponent;
    component.panelUrun = signal<UcKUrunDto | null>(null);
    component.showPanel = signal(false);
    component.panelTip = signal('');
    component.panelGelenAdet = signal(0);
    component.panelKaynakHedef = signal('');
    component.panelAciklama = signal('');
    component.panelUyari = signal('');
    component.panelError = signal('');
    component.panelKaynakCekiSatiriId = signal<number | null>(null);
    component.panelStokKaydiId = signal<number | null>(null);
    component.panelFazlaStogaAktar = signal(true);
    component.panelGeriGonderilmeSebebi = signal('');
    component.kaynakUrunler = signal([]);
    component.projeler = signal([]);
    component.stoklar = signal([]);
    component.urunler = signal([]);
    component.selectedRowKeys = signal(new Set<string>());
  });

  it('backend açık dediğinde YenidenSevkGerekli enumuna rağmen fiziksel tipleri açar', () => {
    const row = urun({
      aktifGridSevkPartisiTeslimeAcikMi: true,
      aktifGridSevkPartisiKalanMiktari: 1,
      aktifGridSevkPartisiFazlaTeslimeAcikMi: true,
    });
    component.panelUrun.set(row);

    for (const tip of ['Sevk Adeti Tam Geldi', 'Sevk Adeti Eksik Geldi', 'Gelmedi', 'Fazla Geldi']) {
      expect(component.isKarsilamaTipiDisabled(tip)).withContext(tip).toBeFalse();
    }

    component.panelTip.set('Sevk Adeti Tam Geldi');
    component.panelGelenAdet.set(1);
    expect(component.validatePanel()).toBeNull();
  });

  it('Tam Geldi miktarını aktif partinin sandık bazlı kalanından alır', () => {
    const row = urun({
      aktifGridSevkPartisiTeslimeAcikMi: true,
      aktifGridSevkPartisiKalanMiktari: 0.75,
    });
    component.panelUrun.set(row);

    component.onTipChange('Sevk Adeti Tam Geldi');

    expect(component.panelGelenAdet()).toBe(0.75);
  });

  it('Grid sevki 2 yerine mutlak 3 olarak güncellendiğinde panel güncel 3 adedi teslim alır', () => {
    const row = urun({
      istenenAdet: 3,
      gridSevkDurumuId: GridSevkDurum.SevkEdildi,
      gridSevkDurumuMetni: 'Sevk Edildi',
      gridSevkMiktari: 3,
      gelenMiktar: 0,
      kalan: 3,
      aktifGridSevkPartisiTeslimeAcikMi: true,
      aktifGridSevkPartisiKalanMiktari: 3,
    });

    component.openPanel(row);
    component.onTipChange('Sevk Adeti Tam Geldi');

    expect(component.panelGelenAdet()).toBe(3);
    expect(component.panelAdetUstSiniri).toBe(3);
  });

  it('Eksik Geldi alanını kümülatif gelenle doldurmaz ve aktif parti kalanıyla sınırlar', () => {
    const row = urun({
      gelenMiktar: 5,
      istenenAdet: 10,
      kalan: 5,
      aktifGridSevkPartisiTeslimeAcikMi: true,
      aktifGridSevkPartisiKalanMiktari: 2,
    });
    component.panelUrun.set(row);

    component.onTipChange('Sevk Adeti Eksik Geldi');

    expect(component.panelGelenAdet()).toBe(0);
    expect(component.panelAdetUstSiniri).toBe(2);

    component.panelGelenAdet.set(2.5);
    expect(component.validatePanel()).toContain('aktif Grid sevk partisinde bekleyen miktardan');
  });

  it('önceden işlenmiş olay satırını açınca kümülatif geleni yeni olay miktarı yapmaz', () => {
    for (const tip of ['Sevk Adeti Eksik Geldi', 'Fazla Geldi', 'Geri Gönderildi', 'Tedarikçiden Geldi']) {
      const row = urun({
        ucKKarsilamaTipiMetni: tip,
        gelenMiktar: 10,
        gridGeriGonderilebilirMiktar: 1,
        gridGeriGonderimeAcikMi: true,
      });

      component.openPanel(row);

      expect(component.panelTip()).withContext(tip).toBe(tip);
      expect(component.panelGelenAdet()).withContext(tip).toBe(0);
    }
  });

  it('yeni bekleyen partiyi Grid sevk kolonunda kümülatif gösterir', () => {
    const row = urun({
      gelenMiktar: 2,
      gridSevkMiktari: 1,
      aktifGridSevkPartisiTeslimeAcikMi: true,
      aktifGridSevkPartisiKalanMiktari: 1,
    });

    expect(component.getGridSevkGorunum(row)).toBe(3);
  });

  it('backend alanı false veya kalan sıfır ise enum SevkEdildi olsa da fiziksel teslimi açmaz', () => {
    for (const row of [
      urun({
        gridSevkDurumuId: GridSevkDurum.SevkEdildi,
        aktifGridSevkPartisiTeslimeAcikMi: false,
        aktifGridSevkPartisiKalanMiktari: 1,
      }),
      urun({
        gridSevkDurumuId: GridSevkDurum.SevkEdildi,
        aktifGridSevkPartisiTeslimeAcikMi: true,
        aktifGridSevkPartisiKalanMiktari: 0,
      }),
    ]) {
      component.panelUrun.set(row);
      expect(component.isKarsilamaTipiDisabled('Sevk Adeti Tam Geldi')).toBeTrue();
      expect(component.getTamGeldiOtomatikMiktari(row)).toBe(0);
    }
  });

  it('aktif parti tamamlandıktan sonra yalnız backend izin verirse Fazla Geldi akışını açık tutar', () => {
    const row = urun({
      gridSevkDurumuId: GridSevkDurum.SevkEdildi,
      aktifGridSevkPartisiTeslimeAcikMi: false,
      aktifGridSevkPartisiKalanMiktari: 0,
      aktifGridSevkPartisiFazlaTeslimeAcikMi: true,
      kalan: 0,
    });
    component.panelUrun.set(row);

    expect(component.isKarsilamaTipiDisabled('Sevk Adeti Tam Geldi')).toBeTrue();
    expect(component.isKarsilamaTipiDisabled('Sevk Adeti Eksik Geldi')).toBeTrue();
    expect(component.isKarsilamaTipiDisabled('Gelmedi')).toBeTrue();
    expect(component.isKarsilamaTipiDisabled('Fazla Geldi')).toBeFalse();

    component.panelTip.set('Fazla Geldi');
    component.panelGelenAdet.set(1);
    expect(component.validatePanel()).toBeNull();
  });

  it('Fazla Geldi backend kararı false ise eski enum SevkEdildi olsa bile kapalıdır', () => {
    const row = urun({
      gridSevkDurumuId: GridSevkDurum.SevkEdildi,
      aktifGridSevkPartisiTeslimeAcikMi: true,
      aktifGridSevkPartisiKalanMiktari: 1,
      aktifGridSevkPartisiFazlaTeslimeAcikMi: false,
    });
    component.panelUrun.set(row);

    expect(component.isKarsilamaTipiDisabled('Sevk Adeti Tam Geldi')).toBeFalse();
    expect(component.isKarsilamaTipiDisabled('Fazla Geldi')).toBeTrue();
  });

  it('Trafo satırında normal parti tamamlanmış olsa da açık fazla teslim kararı panel kilidini kaldırır', () => {
    const row = urun({
      gridDurumuId: GridDurum.TrafoSevk,
      gridSevkDurumuId: GridSevkDurum.SevkEdildi,
      aktifGridSevkPartisiTeslimeAcikMi: false,
      aktifGridSevkPartisiKalanMiktari: 0,
      aktifGridSevkPartisiFazlaTeslimeAcikMi: true,
      kalan: 0,
    });

    expect(component.isEditDisabled(row)).toBeFalse();
    component.panelUrun.set(row);
    expect(component.isKarsilamaTipiDisabled('Fazla Geldi')).toBeFalse();
  });

  it('backend alanları yoksa eski enum tabanlı davranışı korur', () => {
    const legacyAcik = urun({
      gridSevkDurumuId: GridSevkDurum.SevkEdildi,
      gridSevkMiktari: 1.5,
    });
    component.panelUrun.set(legacyAcik);
    expect(component.isKarsilamaTipiDisabled('Sevk Adeti Tam Geldi')).toBeFalse();
    expect(component.isKarsilamaTipiDisabled('Fazla Geldi')).toBeFalse();
    expect(component.getTamGeldiOtomatikMiktari(legacyAcik)).toBe(1.5);

    component.panelUrun.set(urun());
    expect(component.isKarsilamaTipiDisabled('Sevk Adeti Tam Geldi')).toBeTrue();
    expect(component.isKarsilamaTipiDisabled('Fazla Geldi')).toBeTrue();
  });

  it('geri gönderimde backend kararını ve sandık bazlı miktarı tek otorite kabul eder', () => {
    const row = urun({
      gelenMiktar: 3,
      gridGeriGonderilebilirMiktar: 1.25,
      gridGeriGonderimeAcikMi: true,
    });
    component.panelUrun.set(row);

    expect(component.isKarsilamaTipiDisabled('Geri Gönderildi')).toBeFalse();
    component.onTipChange('Geri Gönderildi');
    expect(component.panelGelenAdet()).toBe(1.25);
    expect(component.panelAdetUstSiniri).toBe(1.25);

    component.panelGeriGonderilmeSebebi.set('1');
    expect(component.validatePanel()).toBeNull();

    component.panelGelenAdet.set(1.5);
    expect(component.validatePanel()).toContain('geri gönderilebilir Grid miktarından');
  });

  it('geri gönderim backend tarafından kapalıysa kümülatif gelen olsa da aksiyon açılmaz', () => {
    const row = urun({
      gelenMiktar: 3,
      gridGeriGonderilebilirMiktar: 2,
      gridGeriGonderimeAcikMi: false,
    });
    component.panelUrun.set(row);
    component.panelTip.set('Geri Gönderildi');

    expect(component.isKarsilamaTipiDisabled('Geri Gönderildi')).toBeTrue();
    expect(component.validatePanel()).toContain('aktif sevk partisi henüz tamamlanmadı');
  });

  it('geri gönderim sözleşmesi hiç yoksa eski gelen miktar davranışını korur, yarım payload ise güvenli kapanır', () => {
    const legacy = urun({ gelenMiktar: 2 });
    component.panelUrun.set(legacy);
    expect(component.isKarsilamaTipiDisabled('Geri Gönderildi')).toBeFalse();
    component.onTipChange('Geri Gönderildi');
    expect(component.panelGelenAdet()).toBe(2);

    const yarimPayload = urun({
      gelenMiktar: 2,
      gridGeriGonderimeAcikMi: true,
      gridGeriGonderilebilirMiktar: undefined,
    });
    component.panelUrun.set(yarimPayload);
    expect(component.isKarsilamaTipiDisabled('Geri Gönderildi')).toBeTrue();
  });

  it('toplu Tam Geldi için açık parti ve pozitif parti kalanı ister, fiziksel sandık kilidini korur', () => {
    const setSecim = (row: UcKUrunDto) => {
      component.urunler.set([row]);
      component.selectedRowKeys.set(new Set([component.getRowKey(row)]));
    };

    setSecim(urun({
      aktifGridSevkPartisiTeslimeAcikMi: true,
      aktifGridSevkPartisiKalanMiktari: 1,
    }));
    expect(component.isTopluTamGeldiAllowed).toBeTrue();

    setSecim(urun({
      gridSevkDurumuId: GridSevkDurum.SevkEdildi,
      aktifGridSevkPartisiTeslimeAcikMi: false,
      aktifGridSevkPartisiKalanMiktari: 1,
    }));
    expect(component.isTopluTamGeldiAllowed).toBeFalse();

    setSecim(urun({
      sandikSevkEdildiMi: true,
      aktifGridSevkPartisiTeslimeAcikMi: true,
      aktifGridSevkPartisiKalanMiktari: 1,
    }));
    expect(component.isTopluTamGeldiAllowed).toBeFalse();
  });
});
