import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ProjeTipi } from '../../../core/constants/enums';
import { SevkiyatService } from '../../../core/services/sevkiyat.service';
import { TranslationService } from '../../../core/services/translation.service';
import { SevkSeferiDetay, SevkSeferiOzet, SevkiyatIstatistik } from '../../../shared/models';
import { SevkiyatlarComponent } from './sevkiyatlar.component';

describe('Sevkiyatlar sayfası (C-10)', () => {
  let api: jasmine.SpyObj<SevkiyatService>;
  const sefer = (anahtar: string, ek: Partial<SevkSeferiOzet> = {}) =>
    ({ anahtar, seferId: 7, seferNo: '2026-000007', eskiKayit: false, aracPlaka: '34 ABC 123', sofor: 'Ahmet', dorsePlaka: null,
       sevkTarihi: '2026-10-08T09:30:00', projeSayisi: 2, sandikSayisi: 3, brutKg: 1250.5, duzeltmesiAcikSandikVar: false,
       projeNolari: ['P-1', 'P-2', 'P-3', 'P-4'], ...ek }) as SevkSeferiOzet;
  const yeni = sefer('S:7');
  const eski = sefer('E:34ABC123|2026-09-01', { seferId: null, seferNo: '', eskiKayit: true, sevkTarihi: '2026-09-01T00:00:00', projeNolari: ['P-9'] });
  const istatistik: SevkiyatIstatistik = {
    seferSayisi: 2, sandikSayisi: 4, projeSayisi: 3, buAySeferSayisi: 1, enCokKullanilanPlaka: '34 ABC 123',
    plakalar: [{ plaka: '34 ABC 123', seferSayisi: 2, sandikSayisi: 4, projeSayisi: 3, sonSevk: '2026-10-08T09:30:00' }],
    projeler: [{ projeId: 1, projeNo: 'P-1', projeTipiId: ProjeTipi.Normal, seferSayisi: 1, sandikSayisi: 2, seferNolari: ['2026-000007'], plakalar: ['34 ABC 123'] }],
    aylik: [{ yil: 2026, ay: 9, seferSayisi: 1, sandikSayisi: 1 }, { yil: 2026, ay: 10, seferSayisi: 2, sandikSayisi: 3 }],
  };
  const detay: SevkSeferiDetay = {
    sefer: yeni, aciklama: 'Gece yüklemesi', kullaniciAdSoyad: 'Depo Sorumlusu',
    projeler: [{ projeId: 1, projeNo: 'P-1', projeTipiId: ProjeTipi.Normal, sevkiyatNo: 2, sandiklar: [
      { sandikId: 11, sandikNo: '2', sandikAdi: 'Kanat', brutKg: 400, sevkiyatDuzeltmeAcikMi: true },
    ] }],
  };

  function setup() {
    api = jasmine.createSpyObj<SevkiyatService>('SevkiyatService', ['seferler', 'seferDetay', 'istatistik']);
    api.seferler.and.returnValue(of({ isSuccess: true, value: {
      items: [yeni, eski], pageNumber: 1, pageSize: 25, totalCount: 2, totalPages: 1, hasPreviousPage: false, hasNextPage: false,
    } }));
    api.istatistik.and.returnValue(of({ isSuccess: true, value: istatistik }));
    api.seferDetay.and.returnValue(of({ isSuccess: true, value: detay }));
    TestBed.configureTestingModule({
      imports: [SevkiyatlarComponent],
      providers: [provideRouter([]), { provide: SevkiyatService, useValue: api }],
    });
    TestBed.inject(TranslationService).switchLanguage('tr');
    const fixture = TestBed.createComponent(SevkiyatlarComponent);
    fixture.detectChanges();
    return { fixture, c: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
  }

  it('seferleri ve istatistikleri yükler; eski kayıt rozeti ve kısaltılmış proje listesi gösterilir', () => {
    const { el } = setup();
    expect(api.seferler).toHaveBeenCalledOnceWith(jasmine.objectContaining({ plaka: undefined, projeTipiId: null }), 1, 25);
    expect(api.istatistik).toHaveBeenCalledTimes(1);
    const satirlar = el.querySelectorAll('.sv-seferler tbody tr.sv-satir');
    expect(satirlar.length).toBe(2);
    expect(satirlar[0].textContent).toContain('2026-000007');
    expect(satirlar[0].querySelector('.sv-chip--more')?.textContent?.trim()).toBe('+1');
    expect(satirlar[1].querySelector('.sv-rozet--eski')?.textContent).toContain('Eski kayıt');
    expect(el.querySelector('.sv-kpi')?.textContent).toContain('34 ABC 123');
  });

  it('sefer satırı detayı bir kez yükler ve projeleri sandıklarıyla açar', () => {
    const { c, fixture, el } = setup();
    c.seferAcKapat(yeni);
    fixture.detectChanges();
    expect(api.seferDetay).toHaveBeenCalledOnceWith(yeni);
    expect(el.querySelector('.sv-detay')?.textContent).toContain('Gece yüklemesi');
    expect(el.querySelector('.sv-detay__proje')?.textContent).toContain('Proje sevkiyatı #2');
    expect(el.querySelector('.sv-sandik.is-duzeltme')).not.toBeNull();

    c.seferAcKapat(yeni);
    c.seferAcKapat(yeni);
    expect(api.seferDetay).toHaveBeenCalledTimes(1);
  });

  it('metin süzgeçleri beklemeyle, tarih süzgeci istatistikle birlikte uygulanır; ilk sayfaya döner', fakeAsync(() => {
    const { c } = setup();
    c.sayfaDegisti(2);
    c.metinFiltresiDegisti('plaka', '34abc');
    c.metinFiltresiDegisti('plaka', '34abc1');
    tick(400);
    expect(api.seferler.calls.mostRecent().args).toEqual([jasmine.objectContaining({ plaka: '34abc1' }), 1, 25]);
    expect(api.seferler).toHaveBeenCalledTimes(3);

    c.tarihDegisti('baslangic', '2026-10-01');
    expect(api.istatistik.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({ baslangic: '2026-10-01' }));
    c.projeTipiDegisti(String(ProjeTipi.Saha));
    expect(api.seferler.calls.mostRecent().args[0].projeTipiId).toBe(ProjeTipi.Saha);
  }));

  it('plaka ve proje istatistiğinden ilgili seferlere geçer; aylık görünüm en yeni ay üstte ölçeklenir', () => {
    const { c, fixture, el } = setup();
    c.gorunum.set('plaka');
    fixture.detectChanges();
    expect(el.querySelector('.sv-plakalar tbody tr')?.textContent).toContain('34 ABC 123');
    c.plakaSeferleri(istatistik.plakalar[0]);
    expect(c.gorunum()).toBe('seferler');
    expect(api.seferler.calls.mostRecent().args[0].plaka).toBe('34 ABC 123');

    c.projeSeferleri(istatistik.projeler[0]);
    expect(api.seferler.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({ projeNo: 'P-1', plaka: undefined }));

    expect(c.aylik().map(a => [a.ay, a.oran])).toEqual([[10, 100], [9, 50]]);
  });
});
