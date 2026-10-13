import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ProjeTipi } from '../../../core/constants/enums';
import { SevkiyatService } from '../../../core/services/sevkiyat.service';
import { ToastService } from '../../../core/services/toast.service';
import { TranslationService } from '../../../core/services/translation.service';
import { SevkSeferiDetay, SevkSeferiOzet, SevkiyatIstatistik } from '../../../shared/models';
import { SevkiyatlarComponent } from './sevkiyatlar.component';

describe('Sevkiyatlar sayfası (C-10)', () => {
  let api: jasmine.SpyObj<SevkiyatService>;
  let toast: jasmine.SpyObj<ToastService>;
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
    api = jasmine.createSpyObj<SevkiyatService>('SevkiyatService', ['seferler', 'seferDetay', 'istatistik', 'donemRaporu', 'seferRaporu', 'indirmeHatasi']);
    api.donemRaporu.and.returnValue(of(new Blob(['rapor'])));
    api.seferRaporu.and.returnValue(of(new Blob(['sefer'])));
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error', 'warning', 'info']);
    api.seferler.and.returnValue(of({ isSuccess: true, value: {
      items: [yeni, eski], pageNumber: 1, pageSize: 25, totalCount: 2, totalPages: 1, hasPreviousPage: false, hasNextPage: false,
    } }));
    api.istatistik.and.returnValue(of({ isSuccess: true, value: istatistik }));
    api.seferDetay.and.returnValue(of({ isSuccess: true, value: detay }));
    TestBed.configureTestingModule({
      imports: [SevkiyatlarComponent],
      providers: [provideRouter([]), { provide: SevkiyatService, useValue: api }, { provide: ToastService, useValue: toast }],
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

  describe('raporlar', () => {
    let indirilen: string[];
    beforeEach(() => {
      indirilen = [];
      spyOn(URL, 'createObjectURL').and.returnValue('blob:rapor');
      spyOn(URL, 'revokeObjectURL');
      spyOn(HTMLAnchorElement.prototype, 'click').and.callFake(function (this: HTMLAnchorElement) { indirilen.push(this.download); });
    });

    it('sefer listesinde rapor ekrandaki bütün süzgeçlerle, istatistik görünümünde yalnız tarihle alınır', fakeAsync(() => {
      const { c, el } = setup();
      c.tarihDegisti('baslangic', '2026-10-01');
      c.metinFiltresiDegisti('plaka', '34 abc');
      c.projeTipiDegisti(String(ProjeTipi.Saha));
      tick(400);

      (el.querySelector('.sv-rapor-excel') as HTMLButtonElement).click();
      expect(api.donemRaporu).toHaveBeenCalledOnceWith('excel',
        jasmine.objectContaining({ baslangic: '2026-10-01', plaka: '34 abc', projeTipiId: ProjeTipi.Saha }));
      expect(indirilen[0]).toMatch(/^Sevkiyat_Raporu_\d{8}\.xlsx$/);
      expect(c.raporIndiriliyor()).toBeNull();

      c.gorunum.set('plaka');
      c.raporIndir('pdf');
      expect(api.donemRaporu.calls.mostRecent().args).toEqual(['pdf', { baslangic: '2026-10-01', bitis: undefined, projeTipiId: null }]);
      expect(indirilen[1]).toMatch(/^Sevkiyat_Raporu_\d{8}\.pdf$/);
    }));

    it('indirme hatasında sunucunun mesajı bildirilir; düğme yeniden kullanılabilir', fakeAsync(() => {
      const { c } = setup();
      api.donemRaporu.and.returnValue(throwError(() => new Error('404')));
      api.indirmeHatasi.and.resolveTo('Seçilen süzgeçlere uyan sevkiyat bulunamadı. · Takip: abc');
      c.raporIndir('pdf');
      tick();
      expect(toast.error).toHaveBeenCalledOnceWith('Seçilen süzgeçlere uyan sevkiyat bulunamadı. · Takip: abc');
      expect(c.raporIndiriliyor()).toBeNull();
      expect(indirilen).toEqual([]);
    }));

    it('sefer detayından sefer PDF\'i iner; eski kayıt plaka ve günle adlandırılır', () => {
      const { c, fixture, el } = setup();
      c.seferAcKapat(yeni);
      fixture.detectChanges();
      (el.querySelector('.sv-sefer-rapor') as HTMLButtonElement).click();
      expect(api.seferRaporu).toHaveBeenCalledOnceWith(yeni);
      expect(indirilen).toEqual(['Sefer_2026-000007.pdf']);

      c.seferRaporuIndir(eski);
      expect(api.seferRaporu.calls.mostRecent().args[0]).toBe(eski);
      expect(indirilen[1]).toBe('Sevkiyat_34ABC123_20260901.pdf');
    });
  });
});
