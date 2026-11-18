import { signal } from '@angular/core';
import { of } from 'rxjs';
import { GridDurum } from '../../../core/constants/enums';
import { ApiResult, UcKUrunDto } from '../../../shared/models/index';
import { UcKUrunlerComponent } from './uck-urunler.component';

describe('3K karşılama panelinde ürün bilgisi (seri no, SKT, lot)', () => {
  let component: UcKUrunlerComponent;
  let istekler: unknown[];
  let yanit: ApiResult<unknown>;
  let yazabilir: boolean;
  let sunucuListesi: UcKUrunDto[];
  let toast: jasmine.SpyObj<{ success: (m: string) => void; error: (m: string) => void }>;

  const urun = (values: Partial<UcKUrunDto> = {}): UcKUrunDto => ({
    cekiSatiriId: 67, sandikIcerikId: 401, sandikId: 30, sandikNo: '4', sandikSevkEdildiMi: false,
    aciklama: 'Radyatör FG-L', barkodNo: 'FCT01212023', urunBilgisi: 'seri no: 257890',
    ...values,
  } as UcKUrunDto);

  beforeEach(() => {
    istekler = [];
    yanit = { isSuccess: true, value: null };
    yazabilir = true;
    component = Object.create(UcKUrunlerComponent.prototype) as UcKUrunlerComponent;
    component.projeId = signal(10);
    component.panelUrun = signal<UcKUrunDto | null>(null);
    component.panelUrunBilgisi = signal('');
    component.urunBilgisiSaving = signal(false);
    component.urunler = signal([urun(), urun({ cekiSatiriId: 68, sandikIcerikId: 402, urunBilgisi: null })]);
    component.filtered = signal([]);
    component.filterTip = signal('');
    component.searchTerm = signal('');
    component.loading = signal(false);
    component.sandikId = signal<number | null>(null);
    component.sandikNo = signal('');
    component.urunBilgisiSatiri = signal<UcKUrunDto | null>(null);
    sunucuListesi = [];
    Object.defineProperty(component, 'urunBilgisiEnFazla', { value: 1000 });
    Object.defineProperty(component, 'canUcKWrite', { get: () => yazabilir });
    toast = jasmine.createSpyObj('ToastService', ['success', 'error']);
    const ozel = component as unknown as Record<string, unknown>;
    ozel['toast'] = toast;
    ozel['ts'] = { translate: (anahtar: string) => anahtar };
    ozel['sandikService'] = {
      icerikBilgisiGuncelle: (dto: unknown) => { istekler.push(dto); return of(yanit); },
    };
    ozel['uckService'] = { getUrunler: () => of({ isSuccess: true, value: sunucuListesi }) };
  });

  function paneliAc(u: UcKUrunDto) {
    component.panelUrun.set(u);
    component.panelUrunBilgisi.set(u.urunBilgisi ?? '');
  }

  it('bilgiyi satırın sandığı ve içeriği üzerinden kaydeder, listeyi ve paneli günceller', () => {
    paneliAc(component.urunler()[0]);
    expect(component.urunBilgisiDegisti()).toBeFalse();

    component.panelUrunBilgisi.set('  seri no: 257890, SKT: 03.2027  ');
    expect(component.urunBilgisiDegisti()).toBeTrue();
    component.urunBilgisiKaydet();

    expect(istekler).toEqual([{
      projeId: 10, sandikId: 30, sandikIcerikId: 401, urunBilgisi: 'seri no: 257890, SKT: 03.2027', oncekiUrunBilgisi: 'seri no: 257890',
    }]);
    expect(component.urunler()[0].urunBilgisi).toBe('seri no: 257890, SKT: 03.2027');
    expect(component.urunler()[1].urunBilgisi).toBeNull();
    expect(component.filtered()[0].urunBilgisi).toBe('seri no: 257890, SKT: 03.2027');
    expect(component.panelUrun()!.urunBilgisi).toBe('seri no: 257890, SKT: 03.2027');
    expect(component.urunBilgisiDegisti()).toBeFalse();
    expect(toast.success).toHaveBeenCalled();
  });

  it('boşaltılan bilgi null olarak gönderilir', () => {
    paneliAc(component.urunler()[0]);
    component.panelUrunBilgisi.set('   ');

    component.urunBilgisiKaydet();

    expect(istekler).toEqual([{ projeId: 10, sandikId: 30, sandikIcerikId: 401, urunBilgisi: null, oncekiUrunBilgisi: 'seri no: 257890' }]);
  });

  it('başkası arada değiştirdiyse (409) listeyi tazeler, panel güncel değeri gösterir', () => {
    yanit = { isSuccess: false, error: 'Ürün bilgisi siz düzenlerken değiştirildi.', statusCode: 409 };
    sunucuListesi = [urun({ urunBilgisi: 'SN: Grid-77' }), urun({ cekiSatiriId: 68, sandikIcerikId: 402, urunBilgisi: null })];
    paneliAc(component.urunler()[0]);
    component.panelUrunBilgisi.set('SN-2');

    component.urunBilgisiKaydet();

    expect(toast.error).toHaveBeenCalledWith('Ürün bilgisi siz düzenlerken değiştirildi.');
    expect(component.urunler()[0].urunBilgisi).toBe('SN: Grid-77');
    expect(component.panelUrun()!.urunBilgisi).toBe('SN: Grid-77');
    expect(component.panelUrunBilgisi()).toBe('SN: Grid-77');
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('satır düğmesi 3K paneli kilitli satırlarda da açılır; kayıt yalnız o sandık satırını günceller', () => {
    const iptal = urun({ gridDurumuId: GridDurum.Iptal, kaliteDurumMetni: 'Tadilatta', sahaTamamlamalari: [] });
    expect(component.isEditDisabled(iptal)).toBeTrue();
    expect(component.satirUrunBilgisiKaydedilebilir(iptal)).toBeTrue();
    expect(component.satirUrunBilgisiKaydedilebilir(urun({ sandikSevkEdildiMi: true }))).toBeFalse();
    yazabilir = false;
    expect(component.satirUrunBilgisiKaydedilebilir(iptal)).toBeFalse();
    component.urunBilgisiAc(iptal);
    expect(component.urunBilgisiSatiri()).toBeNull();
    yazabilir = true;

    component.urunBilgisiAc(component.urunler()[1]);
    component.urunBilgisiKaydedildi('SKT: 03.2027');

    expect(component.urunBilgisiSatiri()).toBeNull();
    expect(component.urunler()[0].urunBilgisi).toBe('seri no: 257890');
    expect(component.urunler()[1].urunBilgisi).toBe('SKT: 03.2027');
  });

  it('satır penceresinde çakışma olursa pencere kapanır ve liste tazelenir', () => {
    sunucuListesi = [urun({ urunBilgisi: 'SN: Grid-77' })];
    component.urunBilgisiAc(component.urunler()[0]);

    component.urunBilgisiCakisti();

    expect(component.urunBilgisiSatiri()).toBeNull();
    expect(component.urunler().map(u => u.urunBilgisi)).toEqual(['SN: Grid-77']);
  });

  it('sunucu reddinde listeyi değiştirmez ve hatayı gösterir', () => {
    yanit = { isSuccess: false, error: 'Sevk edilmiş sandık kilitlidir.' };
    paneliAc(component.urunler()[0]);
    component.panelUrunBilgisi.set('SN-2');

    component.urunBilgisiKaydet();

    expect(component.urunler()[0].urunBilgisi).toBe('seri no: 257890');
    expect(toast.error).toHaveBeenCalledWith('Sevk edilmiş sandık kilitlidir.');
  });

  it('sevk edilmiş sandıkta, tahsissiz satırda ve yazma izni yokken kaydetmez', () => {
    for (const [u, izin] of [
      [urun({ sandikSevkEdildiMi: true }), true],
      [urun({ sandikIcerikId: undefined }), true],
      [urun({ sandikId: null }), true],
      [urun(), false],
    ] as [UcKUrunDto, boolean][]) {
      yazabilir = izin;
      paneliAc(u);
      component.panelUrunBilgisi.set('SN-3');
      expect(component.urunBilgisiKaydedilebilir()).toBeFalse();
      component.urunBilgisiKaydet();
    }

    expect(istekler).toEqual([]);
  });

  it('kilit nedenini açıklar', () => {
    paneliAc(urun({ sandikSevkEdildiMi: true }));
    expect(component.urunBilgisiKilitNedeni()).toBe('MESSAGES.URUN_BILGISI_KILITLI');
    paneliAc(urun({ sandikIcerikId: undefined }));
    expect(component.urunBilgisiKilitNedeni()).toContain('sandık tahsisi');
    paneliAc(urun());
    expect(component.urunBilgisiKilitNedeni()).toBe('');
  });

  it('satır penceresi 3K açıklamasını düzenler; kaydedilen açıklama aynı ürünün sandık parçalarına yansır', () => {
    component.urunler.set([
      urun({ ucKAciklama: 'eski' }),
      urun({ sandikIcerikId: 405, sandikNo: '5', ucKAciklama: 'eski' }),
      urun({ cekiSatiriId: 68, sandikIcerikId: 402, ucKAciklama: 'başka ürün' }),
    ]);
    component.urunBilgisiSatiri.set(component.urunler()[0]);

    component.urunAciklamasiKaydedildi('3k deneme');

    expect(component.urunler().map(x => x.ucKAciklama)).toEqual(['3k deneme', '3k deneme', 'başka ürün']);
    expect(component.filtered().map(x => x.ucKAciklama)).toContain('3k deneme');
  });

});
