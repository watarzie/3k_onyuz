import { signal } from '@angular/core';
import { of } from 'rxjs';
import { ApiResult, UcKUrunDto } from '../../../shared/models/index';
import { UcKUrunlerComponent } from './uck-urunler.component';

describe('3K karşılama panelinde ürün bilgisi (seri no, SKT, lot)', () => {
  let component: UcKUrunlerComponent;
  let istekler: unknown[];
  let yanit: ApiResult<unknown>;
  let yazabilir: boolean;
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
    Object.defineProperty(component, 'urunBilgisiEnFazla', { value: 1000 });
    Object.defineProperty(component, 'canUcKWrite', { get: () => yazabilir });
    toast = jasmine.createSpyObj('ToastService', ['success', 'error']);
    const ozel = component as unknown as Record<string, unknown>;
    ozel['toast'] = toast;
    ozel['ts'] = { translate: (anahtar: string) => anahtar };
    ozel['sandikService'] = {
      icerikBilgisiGuncelle: (dto: unknown) => { istekler.push(dto); return of(yanit); },
    };
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

    expect(istekler).toEqual([{ projeId: 10, sandikId: 30, sandikIcerikId: 401, urunBilgisi: 'seri no: 257890, SKT: 03.2027' }]);
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

    expect(istekler).toEqual([{ projeId: 10, sandikId: 30, sandikIcerikId: 401, urunBilgisi: null }]);
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
});
