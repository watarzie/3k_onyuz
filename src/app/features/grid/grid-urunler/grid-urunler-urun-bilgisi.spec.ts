import { signal } from '@angular/core';
import { of } from 'rxjs';
import { GridDurum, GridSevkDurum, UcKDurum } from '../../../core/constants/enums';
import { GridUrunDto } from '../../../shared/models/grid.model';
import { GridUrunlerComponent } from './grid-urunler.component';

/**
 * U-249: Grid ekranı ürün bilgisini 3K ile aynı alandan gösterir ve aynı kuralla düzenler. Grid durum paneli
 * 3K işlemi yapılmış satırda kilitlidir; ürün bilgisi bu kilide bağlı değildir.
 */
describe('Grid ürün listesinde ürün bilgisi (seri no, SKT, lot)', () => {
  let component: GridUrunlerComponent;
  let yazabilir: boolean;
  let sunucuListesi: GridUrunDto[];

  const urun = (values: Partial<GridUrunDto> = {}): GridUrunDto => ({
    cekiSatiriId: 67, sandikIcerikId: 401, sandikId: 30, sandikNo: '4', sandikSevkEdildiMi: false,
    aciklama: 'Radyatör FG-L', barkodNo: 'FCT01212023', urunBilgisi: 'SN: A-1001', siraNo: 1,
    istenenAdet: 1, birim: 'Adet', gridDurumuId: GridDurum.TamGeldi, gridDurumuMetni: 'Tam Geldi',
    gridGelenAdet: 1, trafoSevkAdet: 0, gridSevkDurumuId: GridSevkDurum.SevkEdildi, gridSevkDurumuMetni: 'Sevk Edildi',
    gridSevkMiktari: 1, yenidenSevkGerekliAdet: 0, projeGonderilen: 0, gelenMiktar: 1, kalanMiktar: 0,
    ucKDurumuId: UcKDurum.TamGeldi, sahaTamamlamalari: [],
    ...values,
  } as GridUrunDto);

  beforeEach(() => {
    yazabilir = true;
    sunucuListesi = [];
    component = Object.create(GridUrunlerComponent.prototype) as GridUrunlerComponent;
    component.projeId = signal(10);
    component.urunler = signal([urun(), urun({ cekiSatiriId: 67, sandikIcerikId: 402, sandikId: 31, sandikNo: '5', urunBilgisi: null })]);
    component.filtered = signal([]);
    component.filterDurum = signal('');
    component.searchTerm = signal('');
    component.selectedSandikNo = signal('');
    component.selectedRowKeys = signal(new Set<string>());
    component.loading = signal(false);
    component.focusCekiSatiriId = signal<number | null>(null);
    component.urunBilgisiSatiri = signal<GridUrunDto | null>(null);
    Object.defineProperty(component, 'canGridWrite', { get: () => yazabilir });
    const ozel = component as unknown as Record<string, unknown>;
    ozel['ts'] = { translate: (anahtar: string) => anahtar };
    ozel['gridService'] = { getUrunler: () => of({ isSuccess: true, value: sunucuListesi }) };
  });

  it('3K işlemi yapılmış satırda Grid paneli kilitliyken ürün bilgisi düzenlenebilir', () => {
    const islenmis = urun();
    expect(component.isUcKIslemYapilmis(islenmis)).toBeTrue();
    expect(component.satirUrunBilgisiKaydedilebilir(islenmis)).toBeTrue();
    expect(component.satirUrunBilgisiKaydedilebilir(urun({ kaliteDurumMetni: 'Tadilatta' }))).toBeTrue();

    component.urunBilgisiAc(islenmis);
    expect(component.urunBilgisiSatiri()).toBe(islenmis);
  });

  it('sevk edilmiş sandıkta, tahsissiz satırda ve Grid yazma izni yokken açılmaz', () => {
    for (const [u, izin] of [
      [urun({ sandikSevkEdildiMi: true }), true],
      [urun({ sandikIcerikId: undefined }), true],
      [urun({ sandikId: null }), true],
      [urun(), false],
    ] as [GridUrunDto, boolean][]) {
      yazabilir = izin;
      expect(component.satirUrunBilgisiKaydedilebilir(u)).toBeFalse();
      component.urunBilgisiAc(u);
      expect(component.urunBilgisiSatiri()).toBeNull();
    }

    yazabilir = true;
    expect(component.satirUrunBilgisiKilitNedeni(urun({ sandikSevkEdildiMi: true }))).toBe('MESSAGES.URUN_BILGISI_KILITLI');
    expect(component.satirUrunBilgisiKilitNedeni(urun({ sandikIcerikId: undefined }))).toContain('sandık tahsisi');
    expect(component.satirUrunBilgisiKilitNedeni(urun())).toBe('');
  });

  it('kayıt yalnız o sandık satırını günceller; bölünmüş ürünün diğer sandığı değişmez', () => {
    component.urunBilgisiAc(component.urunler()[1]);

    component.urunBilgisiKaydedildi('SKT: 03.2027');

    expect(component.urunBilgisiSatiri()).toBeNull();
    expect(component.urunler().map(u => u.urunBilgisi)).toEqual(['SN: A-1001', 'SKT: 03.2027']);
    expect(component.filtered().map(u => u.urunBilgisi)).toEqual(['SN: A-1001', 'SKT: 03.2027']);
  });

  it('çakışmada (409) pencere kapanır ve 3K tarafının girdiği güncel bilgi listeye gelir', () => {
    sunucuListesi = [urun({ urunBilgisi: 'SN: 3K-55' })];
    component.urunBilgisiAc(component.urunler()[0]);

    component.urunBilgisiCakisti();

    expect(component.urunBilgisiSatiri()).toBeNull();
    expect(component.urunler().map(u => u.urunBilgisi)).toEqual(['SN: 3K-55']);
  });
});
