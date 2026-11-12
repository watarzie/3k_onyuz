import { signal } from '@angular/core';
import { of, Subject } from 'rxjs';
import { YETKI } from '../../../core/constants/yetki-kodlari';
import { StokKaydiDto } from '../../../shared/models/index';
import { UcKUrunlerComponent } from './uck-urunler.component';

describe('3K ürünler stok listesi: yetki ve ihtiyaç anında yükleme', () => {
  let component: UcKUrunlerComponent;
  let erisimVar: boolean;
  let stokService: jasmine.SpyObj<{ getStokListesi: (...args: unknown[]) => unknown }>;

  beforeEach(() => {
    erisimVar = true;
    component = Object.create(UcKUrunlerComponent.prototype) as UcKUrunlerComponent;
    component.stoklar = signal<StokKaydiDto[]>([{ id: 9 } as StokKaydiDto]);
    component.stokListesiYukleniyor = signal(false);
    component.stokListesiGorebilir = (() => erisimVar) as UcKUrunlerComponent['stokListesiGorebilir'];
    stokService = jasmine.createSpyObj('StokService', ['getStokListesi']);
    stokService.getStokListesi.and.returnValue(of({
      isSuccess: true,
      value: { items: [{ id: 1, miktar: 3, durumId: 1 }, { id: 2, miktar: 0, durumId: 1 }] },
    }));
    const ozel = component as unknown as Record<string, unknown>;
    ozel['stokService'] = stokService;
    ozel['stokListesiYuklendi'] = false;
    ozel['permissions'] = { hasAccess: (kod: string) => kod === YETKI.STOK.KOK && erisimVar };
  });

  it('stok yetkisi yoksa listeyi istemez ve açılır listeyi boşaltır', () => {
    erisimVar = false;

    component.stokListesiniGerekirseYukle();

    expect(stokService.getStokListesi).not.toHaveBeenCalled();
    expect(component.stoklar()).toEqual([]);
  });

  it('stok yetkisi varsa aktif ve bakiyeli stokları yükler', () => {
    component.stokListesiniGerekirseYukle();

    expect(stokService.getStokListesi).toHaveBeenCalledTimes(1);
    expect(component.stoklar().map(s => s.id)).toEqual([1]);
    expect(component.stokListesiYukleniyor()).toBeFalse();
  });

  it('yüklenmiş listeyi ikinci seçimde yeniden istemez', () => {
    component.stokListesiniGerekirseYukle();
    component.stokListesiniGerekirseYukle();

    expect(stokService.getStokListesi).toHaveBeenCalledTimes(1);
  });

  it('istek sürerken ikinci istek atmaz', () => {
    const cevap = new Subject<unknown>();
    stokService.getStokListesi.and.returnValue(cevap);

    component.stokListesiniGerekirseYukle();
    expect(component.stokListesiYukleniyor()).toBeTrue();
    component.stokListesiniGerekirseYukle();

    expect(stokService.getStokListesi).toHaveBeenCalledTimes(1);
  });
});
