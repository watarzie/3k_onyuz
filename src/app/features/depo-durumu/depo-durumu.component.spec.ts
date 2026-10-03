import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { DepoDurumuComponent } from './depo-durumu.component';
import { TranslationService } from '../../core/services/translation.service';
import { ProjeService } from '../../core/services/proje.service';
import { SandikService } from '../../core/services/sandik.service';
import { PdfService } from '../../core/services/pdf.service';
import { ToastService } from '../../core/services/toast.service';
import { LookupService } from '../../core/services/lookup.service';
import { PermissionService } from '../../core/services/permission.service';
import { BaseApiService } from '../../core/services/base-api.service';

/** Test ve görsel kontrol için ortak kurulum: dört depo, üç proje tipi, birkaç proje. */
export function depoDurumuKur() {
  const dagilim = (pairs: [number, number][]) => pairs.map(([id, n]) => ({ depoLokasyonId: id, depoLokasyonMetni: '', sandikSayisi: n }));
  const ozet = {
    depoDagilimlari: dagilim([[2, 561], [4, 279], [5, 346], [9, 16]]),
    normalDepoDagilimlari: dagilim([[2, 492], [4, 236], [5, 323], [9, 16]]),
    sahaDepoDagilimlari: dagilim([[2, 42], [4, 1], [5, 23]]),
    yedekDepoDagilimlari: dagilim([[2, 27], [4, 42]]),
  };
  const proje = (id: number, projeNo: string, projeTipiId: number, pairs: [number, number][]) => ({
    id, projeNo, projeTipiId,
    depoSandikSayisi: pairs.reduce((a, [, n]) => a + n, 0),
    depoDagilimlari: dagilim(pairs),
  });
  const projeler = [
    proje(1, 'PA727-03-SAHA', 2, []),
    proje(2, 'PA727-03', 1, [[2, 4]]),
    proje(3, 'PA707-01', 1, [[2, 9], [4, 6], [5, 5]]),
    proje(4, 'PA641-01-YEDEK', 3, [[4, 7], [9, 2]]),
  ];
  const sandiklar = [
    { id: 11, sandikNo: 'S-2', durumMetni: 'Hazır', depoLokasyonMetni: '3K', urunSayisi: 3, depodaSayilacakMi: true },
    { id: 10, sandikNo: 'S-1', durumMetni: 'Depoda', depoLokasyonMetni: 'Seymen', urunSayisi: 5, depodaSayilacakMi: true },
    { id: 12, sandikNo: 'S-3', durumMetni: 'Depoda', depoLokasyonMetni: null, urunSayisi: 0, depodaSayilacakMi: true },
  ];
  TestBed.configureTestingModule({
    imports: [DepoDurumuComponent],
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { snapshot: { data: {} } } },
      { provide: TranslationService, useValue: { translate: (k: string) => ({ 'MENU.DEPO_DURUMU': 'Depo Durumu', 'LABELS.DEPO_DAGILIM': 'Depo Dağılım Grafiği' } as Record<string, string>)[k] ?? k } },
      { provide: ProjeService, useValue: { getProjeListesi: () => of({ isSuccess: true, value: { items: projeler, totalCount: 266, totalPages: 18 } }) } },
      { provide: SandikService, useValue: { getSandiklar: () => of({ isSuccess: true, value: sandiklar }) } },
      { provide: PdfService, useValue: jasmine.createSpyObj('PdfService', ['depoSandikPdf', 'projeDepoSandikPdf']) },
      { provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['success', 'error']) },
      { provide: LookupService, useValue: { getLookups: () => of({ LookupDepoLokasyon: [
        { id: 1, anahtar: 1, deger: 'Belirsiz' }, { id: 2, anahtar: 2, deger: '3K' }, { id: 4, anahtar: 4, deger: 'Seymen' },
        { id: 5, anahtar: 5, deger: 'Grid' }, { id: 9, anahtar: 9, deger: 'Öz Nakliyat' },
      ] }) } },
      { provide: PermissionService, useValue: { canWrite: () => true, hasAccess: () => true } },
      { provide: BaseApiService, useValue: { get: () => of({ isSuccess: true, value: ozet }) } },
    ],
  });
  const fixture = TestBed.createComponent(DepoDurumuComponent);
  fixture.detectChanges();
  return { fixture, c: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
}

describe('DepoDurumuComponent', () => {
  it('özet kartları kapsam toplamlarını ve depo paylarını gösterir', () => {
    const { el } = depoDurumuKur();
    const degerler = Array.from(el.querySelectorAll('.depo-kpi__value')).map((x) => x.firstChild!.textContent!.trim());
    expect(degerler).toEqual(['1202', '1067', '66', '69']);
    const ilk = el.querySelector('.depo-kpi')!;
    expect(ilk.querySelectorAll('.stack-bar span').length).toBe(4);
    expect(ilk.querySelector('.depo-kpi__list')!.textContent).toContain('Öz Nakliyat');
  });

  it('halka grafik dilimleri yüzde toplamı 100 olacak şekilde dizilir; depo × tip tablosu toplamları tutar', () => {
    const { c, el } = depoDurumuKur();
    const dilimler = c.donutDilimleri();
    expect(dilimler.length).toBe(4);
    expect(dilimler[0].offset).toBe(25);
    const oranToplami = c.genelKart().segmentler.reduce((a, s) => a + s.oran, 0);
    expect(Math.round(oranToplami)).toBe(100);
    const m = c.depoMatrisi();
    expect(m.toplamlar).toEqual([1067, 66, 69]);
    expect(m.genel).toBe(1202);
    expect(el.querySelectorAll('.depo-matrix tbody tr').length).toBe(4);
  });

  it('proje satırı depo sayılarını ve mini dağılımı gösterir; satır açılınca sandıklar sıralı ve renkli listelenir', () => {
    const { fixture, el } = depoDurumuKur();
    const satirlar = el.querySelectorAll<HTMLTableRowElement>('.project-row');
    expect(satirlar.length).toBe(4);
    expect(satirlar[0].querySelector('.mini-bar')).toBeNull();
    expect(satirlar[2].querySelectorAll('.mini-bar span').length).toBe(3);
    expect(satirlar[2].querySelectorAll('.depo-count-pill').length).toBe(3);

    satirlar[2].click();
    fixture.detectChanges();
    const sandikNolari = Array.from(el.querySelectorAll('.sandik-table tbody tr td:first-child')).map((x) => x.textContent!.trim());
    expect(sandikNolari).toEqual(['S-1', 'S-2', 'S-3']);
    expect(el.querySelector('.loc-chip.is-unknown')).not.toBeNull();
    expect((el.querySelector('.loc-chip:not(.is-unknown)') as HTMLElement).style.getPropertyValue('--renk')).toBeTruthy();
  });
});
