import { signal } from '@angular/core';
import { of } from 'rxjs';
import { GridDurum, GridSevkDurum, SurecDurum, UcKDurum } from '../../../core/constants/enums';
import { GridUrunDto } from '../../../shared/models/grid.model';
import { ApiResult } from '../../../shared/models/common.model';
import { ConfirmService } from '../../../core/services/confirm.service';
import { GridService } from '../../../core/services/grid.service';
import { ToastService } from '../../../core/services/toast.service';
import { GridUrunlerComponent } from './grid-urunler.component';

describe('Grid ürün satırından süreç ve kalite ataması', () => {
  // Servisler sahte nesnelerdir; HTTP çağrılmaz. Bileşen prototipten kurulur (diğer Grid spec'leriyle aynı kalıp).
  const urun = (values: Partial<GridUrunDto> = {}): GridUrunDto => ({
    cekiSatiriId: 501,
    aciklama: 'Conservator',
    istenenAdet: 4,
    birim: 'Adet',
    gridDurumuId: GridDurum.Gelmedi,
    gridDurumuMetni: 'Gelmedi',
    gridGelenAdet: 0,
    gridEksikMiktar: 4,
    trafoSevkAdet: 0,
    gridSevkDurumuId: GridSevkDurum.SevkEdilmedi,
    gridSevkDurumuMetni: 'Sevk Edilmedi',
    ucKDurumuId: UcKDurum.Bekliyor,
    sandikSevkEdildiMi: false,
    surecDurumId: null,
    surecDurumMetni: null,
    ...values,
  } as unknown as GridUrunDto);

  let gridService: jasmine.SpyObj<GridService>;
  let confirmService: jasmine.SpyObj<ConfirmService>;
  let toast: jasmine.SpyObj<ToastService>;
  let surecYazabilir: boolean;

  const olustur = (): GridUrunlerComponent => {
    const c = Object.create(GridUrunlerComponent.prototype) as GridUrunlerComponent;
    gridService = jasmine.createSpyObj('GridService', ['surecDurumGuncelle', 'kaliteDurumGuncelle', 'notifyGridUpdated']);
    gridService.surecDurumGuncelle.and.returnValue(of({ isSuccess: true } as ApiResult<unknown>));
    gridService.kaliteDurumGuncelle.and.returnValue(of({ isSuccess: true } as ApiResult<unknown>));
    confirmService = jasmine.createSpyObj('ConfirmService', ['ask']);
    toast = jasmine.createSpyObj('ToastService', ['success', 'error', 'warning', 'info']);
    surecYazabilir = true;
    Object.assign(c, {
      gridService,
      confirmService,
      toast,
      permissions: { canWrite: () => surecYazabilir },
      projeId: signal(77),
      surecKaydedilenSatir: signal<number | null>(null),
      kaliteKaydedilenSatir: signal<number | null>(null),
      talepKaynakSecim: signal(1),
      ambarTalepItems: signal([]),
      loadUrunler: jasmine.createSpy('loadUrunler'),
    });
    return c;
  };

  it('izinli, seçilebilir ve tamamlanmamış satırda hücreden seçime açılır', () => {
    const c = olustur();
    expect(c.surecSatirdanDegistirilebilir(urun())).toBeTrue();
    expect(c.surecSatirdanDegistirilebilir(urun({ surecDurumId: SurecDurum.Sipariste, surecDurumMetni: 'Siparişte' })))
      .toBeTrue();
  });

  it('toplu atamanın kilitlerini korur: izin, tamamlanmış süreç, sevk edilmiş sandık, saha satırları', () => {
    const c = olustur();
    expect(c.surecSatirdanDegistirilebilir(urun({ surecDurumId: SurecDurum.Tamamlandi, surecDurumMetni: 'Tamamlandı' })))
      .withContext('Tamamlandı kilidi').toBeFalse();
    expect(c.surecSatirdanDegistirilebilir(urun({ gridDurumuId: GridDurum.TamGeldi, gridEksikMiktar: 0 })))
      .withContext('Grid eksiği kapanınca görünen Tamamlandı').toBeFalse();
    expect(c.surecSatirdanDegistirilebilir(urun({ sandikSevkEdildiMi: true })))
      .withContext('sevk kilidi').toBeFalse();
    expect(c.surecSatirdanDegistirilebilir(urun({ isSahaManuelSandikIcerigi: true } as Partial<GridUrunDto>)))
      .withContext('saha manuel içeriği').toBeFalse();

    surecYazabilir = false;
    expect(c.surecSatirdanDegistirilebilir(urun())).withContext('süreç yazma izni').toBeFalse();
  });

  it('seçilen süreci toplu atamayla aynı uca tek çeki satırıyla gönderir ve listeyi yeniler', async () => {
    const c = olustur();
    await c.satirSurecAta(urun(), SurecDurum.Imalat);

    expect(gridService.surecDurumGuncelle).toHaveBeenCalledOnceWith({
      projeId: 77, cekiSatiriIdler: [501], surecDurumId: SurecDurum.Imalat,
    });
    expect(confirmService.ask).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('Süreç durumu "İmalat" olarak güncellendi.');
    expect(gridService.notifyGridUpdated).toHaveBeenCalled();
    expect(c.surecKaydedilenSatir()).toBeNull();
  });

  it('sunucu reddederse hatayı gösterir, listeyi yenilemez', async () => {
    const c = olustur();
    gridService.surecDurumGuncelle.and.returnValue(of({ isSuccess: false, error: 'Sevk edilmiş sandık' } as ApiResult<unknown>));
    await c.satirSurecAta(urun(), SurecDurum.Ambar);

    expect(toast.error).toHaveBeenCalledWith('Sevk edilmiş sandık');
    expect(gridService.notifyGridUpdated).not.toHaveBeenCalled();
    expect(c.surecKaydedilenSatir()).toBeNull();
  });

  it('Tamamlandı seçimi kilit uyarısıyla onay ister; vazgeçilirse istek gitmez', async () => {
    const c = olustur();
    confirmService.ask.and.resolveTo(false);
    await c.satirSurecAta(urun(), SurecDurum.Tamamlandi);
    expect(confirmService.ask).toHaveBeenCalled();
    expect(gridService.surecDurumGuncelle).not.toHaveBeenCalled();

    confirmService.ask.and.resolveTo(true);
    await c.satirSurecAta(urun(), SurecDurum.Tamamlandi);
    expect(gridService.surecDurumGuncelle).toHaveBeenCalledTimes(1);
  });

  it('kilitli satırda veya aynı süreç seçilince istek göndermez', async () => {
    const c = olustur();
    await c.satirSurecAta(urun({ sandikSevkEdildiMi: true }), SurecDurum.Ambar);
    await c.satirSurecAta(urun({ surecDurumId: SurecDurum.Ambar, surecDurumMetni: 'Ambar' }), SurecDurum.Ambar);
    expect(gridService.surecDurumGuncelle).not.toHaveBeenCalled();
  });

  describe('kalite', () => {
    it('toplu kalite atamasının satır koşullarında açılır; süreç kilidi kaliteyi kilitlemez', () => {
      const c = olustur();
      expect(c.kaliteSatirdanDegistirilebilir(urun())).toBeTrue();
      expect(c.kaliteSatirdanDegistirilebilir(urun({ surecDurumId: SurecDurum.Tamamlandi, surecDurumMetni: 'Tamamlandı' })))
        .toBeTrue();
      expect(c.kaliteSatirdanDegistirilebilir(urun({ sandikSevkEdildiMi: true }))).withContext('sevk kilidi').toBeFalse();
      expect(c.kaliteSatirdanDegistirilebilir(urun({ isSahaManuelSandikIcerigi: true } as Partial<GridUrunDto>)))
        .withContext('saha manuel içeriği').toBeFalse();
      surecYazabilir = false;
      expect(c.kaliteSatirdanDegistirilebilir(urun())).withContext('kalite yazma izni').toBeFalse();
    });

    it('seçilen kaliteyi toplu atamayla aynı uca tek çeki satırıyla gönderir', () => {
      const c = olustur();
      c.satirKaliteAta(urun(), 2);

      expect(gridService.kaliteDurumGuncelle).toHaveBeenCalledOnceWith({
        projeId: 77, cekiSatiriIdler: [501], kaliteDurumId: 2,
      });
      expect(toast.success).toHaveBeenCalledWith('Kalite durumu "Tadilatta" olarak güncellendi.');
      expect(gridService.notifyGridUpdated).toHaveBeenCalled();
      expect(c.kaliteKaydedilenSatir()).toBeNull();
    });

    it('aynı kalite veya kilitli satırda istek göndermez; red mesajını gösterir', () => {
      const c = olustur();
      c.satirKaliteAta(urun({ kaliteDurumId: 1, kaliteDurumMetni: 'Onaylandı' }), 1);
      c.satirKaliteAta(urun({ sandikSevkEdildiMi: true }), 1);
      expect(gridService.kaliteDurumGuncelle).not.toHaveBeenCalled();

      gridService.kaliteDurumGuncelle.and.returnValue(of({ isSuccess: false, error: 'Saha aktarımı' } as ApiResult<unknown>));
      c.satirKaliteAta(urun(), 1);
      expect(toast.error).toHaveBeenCalledWith('Saha aktarımı');
      expect(gridService.notifyGridUpdated).not.toHaveBeenCalled();
    });
  });

  describe('talep formu satır süreci', () => {
    const talepSatiri = (cekiSatiriId: number, surecDurumId = 1) => ({
      cekiSatiriId, barkodNo: `B-${cekiSatiriId}`, aciklama: 'Ürün', istenenMiktar: 1, birim: 'Adet', surecDurumId,
    });

    it('talep kaynağı bütün satırların sürecini kaynağın karşılığına çeker', () => {
      const c = olustur();
      c.ambarTalepItems.set([talepSatiri(1), talepSatiri(2, SurecDurum.Sipariste)]);

      c.setTalepKaynak(SurecDurum.Tedarik);

      expect(c.talepKaynakSecim()).toBe(SurecDurum.Tedarik);
      expect(c.ambarTalepItems().map(i => i.surecDurumId)).toEqual([SurecDurum.Tedarik, SurecDurum.Tedarik]);
      expect(c.getTalepKaynakMetni(c.ambarTalepItems())).toBe('Tedarikçi');
    });

    it('satır süreci aynı çeki satırının bölünmüş satırlarına birlikte uygulanır', () => {
      const c = olustur();
      c.ambarTalepItems.set([talepSatiri(1), talepSatiri(2), talepSatiri(1)]);

      c.updateTalepSurec(0, SurecDurum.Sipariste);

      expect(c.ambarTalepItems().map(i => i.surecDurumId)).toEqual([SurecDurum.Sipariste, 1, SurecDurum.Sipariste]);
      expect(c.getTalepKaynakMetni(c.ambarTalepItems())).toBe('Satır bazında (Süreç sütunu)');
    });
  });
});
