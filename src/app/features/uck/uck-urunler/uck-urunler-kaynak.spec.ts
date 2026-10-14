import { signal } from '@angular/core';
import { Subject } from 'rxjs';
import { ApiResult, ProjedenKarsilamaKaynakDto } from '../../../shared/models/index';
import { UcKUrunlerComponent } from './uck-urunler.component';

describe('3K projeden karşılama kaynak listesi', () => {
  let component: UcKUrunlerComponent;
  let istekler: { hedef: number; kaynak: number; yanit: Subject<ApiResult<ProjedenKarsilamaKaynakDto[]>> }[];

  const kaynak = (values: Partial<ProjedenKarsilamaKaynakDto> = {}): ProjedenKarsilamaKaynakDto => ({
    cekiSatiriId: 67,
    siraNo: 3,
    barkodNo: 'SMC45112',
    aciklama: 'Kollektör Konsolu \\Collector Support',
    gelenMiktar: 2,
    netKullanilabilir: 2,
    ...values,
  });

  beforeEach(() => {
    istekler = [];
    component = Object.create(UcKUrunlerComponent.prototype) as UcKUrunlerComponent;
    component.projeId = signal(24);
    component.projeler = signal([
      { id: 23, projeNo: 'PA600-23', musteri: 'SONELGAZ' },
      { id: 25, projeNo: 'PA600-25', musteri: 'SONELGAZ' },
    ]);
    component.panelKaynakHedef = signal('');
    component.panelKaynakCekiSatiriId = signal<number | null>(null);
    component.kaynakUrunler = signal([]);
    component.kaynakUrunlerYukleniyor = signal(false);
    component.kaynakUrunHatasi = signal('');
    // Grid servisi bilinçli olarak verilmez: kaynak listesi Grid uç noktasına gitmemelidir.
    (component as unknown as { uckService: unknown }).uckService = {
      getProjedenKarsilamaKaynaklari: (hedef: number, kaynakProjeId: number) => {
        const yanit = new Subject<ApiResult<ProjedenKarsilamaKaynakDto[]>>();
        istekler.push({ hedef, kaynak: kaynakProjeId, yanit });
        return yanit.asObservable();
      },
    };
  });

  it('kaynak ürünleri hedef projenin 3K uç noktasından okur, beklerken "ürün yok" göstermez', () => {
    component.onKaynakProjeChange('23');

    expect(istekler.map(x => [x.hedef, x.kaynak])).toEqual([[24, 23]]);
    expect(component.panelKaynakHedef()).toBe('PA600-23');
    expect(component.kaynakUrunlerYukleniyor()).toBeTrue();

    istekler[0].yanit.next({ isSuccess: true, value: [kaynak()] });

    expect(component.kaynakUrunlerYukleniyor()).toBeFalse();
    expect(component.kaynakUrunHatasi()).toBe('');
    expect(component.kaynakUrunler().map(x => x.cekiSatiriId)).toEqual([67]);
    expect(component.getKaynakNetKullanilabilir(component.kaynakUrunler()[0])).toBe(2);
  });

  it('sunucu reddini boş liste gibi yutmaz, mesajı takip koduyla gösterir', () => {
    component.onKaynakProjeChange('23');
    istekler[0].yanit.next({
      isSuccess: false,
      statusCode: 403,
      error: 'Bu işlem için yetkiniz yok. · Takip: abc123',
    });

    expect(component.kaynakUrunlerYukleniyor()).toBeFalse();
    expect(component.kaynakUrunler()).toEqual([]);
    expect(component.kaynakUrunHatasi()).toBe('Bu işlem için yetkiniz yok. · Takip: abc123');
  });

  it('proje değişince önceki projenin listesini ve seçili kaynak satırını bırakır', () => {
    component.onKaynakProjeChange('23');
    istekler[0].yanit.next({ isSuccess: true, value: [kaynak()] });
    component.panelKaynakCekiSatiriId.set(67);

    component.onKaynakProjeChange('25');

    expect(component.panelKaynakHedef()).toBe('PA600-25');
    expect(component.panelKaynakCekiSatiriId()).toBeNull();
    expect(component.kaynakUrunler()).toEqual([]);
    expect(component.kaynakUrunlerYukleniyor()).toBeTrue();
  });

  it('geç gelen önceki proje yanıtı yeni seçimin listesine yazılmaz', () => {
    component.onKaynakProjeChange('23');
    component.onKaynakProjeChange('25');

    istekler[0].yanit.next({ isSuccess: true, value: [kaynak({ cekiSatiriId: 99 })] });
    expect(component.kaynakUrunler()).toEqual([]);
    expect(component.kaynakUrunlerYukleniyor()).toBeTrue();

    istekler[1].yanit.next({ isSuccess: true, value: [kaynak({ cekiSatiriId: 81 })] });
    expect(component.kaynakUrunler().map(x => x.cekiSatiriId)).toEqual([81]);
    expect(component.kaynakUrunlerYukleniyor()).toBeFalse();
  });

  it('negatif kullanılabilir miktarı sıfır gösterir', () => {
    expect(component.getKaynakNetKullanilabilir(kaynak({ netKullanilabilir: -1 }))).toBe(0);
  });
});
