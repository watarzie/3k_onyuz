import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { FinansPanelDetayComponent } from './finans-panel-detay.component';
import { FinansService } from '../../../core/services/finans.service';
import { PermissionService } from '../../../core/services/permission.service';
import { TranslationService } from '../../../core/services/translation.service';
import { FINANS_YETKI } from '../../../core/constants/yetki-kodlari';
import { FinansIsKategorisi, FinansKarsilanma } from '../../../core/constants/enums';
import { FinansPanel, FinansPanelProjeOzeti } from '../../../shared/models/finans-v2.model';

describe('Finans paneli detay dökümü', () => {
  let api: jasmine.SpyObj<FinansService>;
  const izinler = signal<string[]>([]);
  const proje = (no: string, isBedeli: number, para = 'EUR'): FinansPanelProjeOzeti => ({
    projeNo: no, musteri: 'GE', paraBirimi: para, isKaydi: 2, isBedeli, siparisNetTutar: isBedeli / 2,
    faturalananNetTutar: 0, kalanSiparisNetTutar: isBedeli / 2, kalanFaturaNetTutar: isBedeli / 2, gider: null,
    siparis: FinansKarsilanma.Kismi, fatura: FinansKarsilanma.Yok,
  });
  const panel = (projeler: FinansPanelProjeOzeti[]) =>
    ({
      baslangic: '2026-09-01T00:00:00', bitis: '2026-09-30T00:00:00', tutarlar: [], aylik: [], isTurleri: [], giderTurleri: [],
      siparisBekleyen: 0, kismiSiparis: 0, siparisTam: 0, kismiFatura: 0, tamamlanan: 0,
      projeOzetleri: projeler,
      kategoriOzetleri: [
        { kategori: FinansIsKategorisi.AnaAmbalaj, paraBirimi: 'EUR', isKaydi: 6, proje: 2, isBedeli: 300, siparisNetTutar: 0, faturalananNetTutar: 150 },
        { kategori: FinansIsKategorisi.OzelIs, paraBirimi: 'EUR', isKaydi: 2, proje: 1, isBedeli: 100, siparisNetTutar: 0, faturalananNetTutar: 0 },
      ],
    }) as unknown as FinansPanel;

  beforeEach(() => {
    izinler.set([FINANS_YETKI.KayitGoruntule]);
    api = jasmine.createSpyObj('FinansService', ['genelArama']);
    TestBed.configureTestingModule({
      imports: [FinansPanelDetayComponent],
      providers: [
        { provide: FinansService, useValue: api },
        { provide: PermissionService, useValue: { hasAccess: (kod: string) => izinler().includes(kod), canWrite: () => false } },
      ],
    });
    TestBed.inject(TranslationService).switchLanguage('tr');
  });

  function olustur(projeler: FinansPanelProjeOzeti[]) {
    const fixture = TestBed.createComponent(FinansPanelDetayComponent);
    fixture.componentRef.setInput('panel', panel(projeler));
    fixture.detectChanges();
    return fixture;
  }

  it('ilk 8 projeyi gösterir, "Tümünü göster" ile hepsini açar; tutar izni yoksa tutar sütunları yoktur', () => {
    const fixture = olustur(Array.from({ length: 11 }, (_, i) => proje(`PA-${i + 1}`, 100 * (11 - i))));
    const satirlar = () => fixture.nativeElement.querySelectorAll('.project-row').length;
    expect(satirlar()).toBe(8);
    expect(fixture.nativeElement.textContent).not.toContain('İş bedeli');
    (fixture.nativeElement.querySelector('.show-more') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(satirlar()).toBe(11);

    izinler.set([FINANS_YETKI.KayitGoruntule, FINANS_YETKI.ParasalVeriGoruntule, FINANS_YETKI.TutarGoruntule]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('İş bedeli');
  });

  it('proje açılınca kalemleri bir kez yükler, dönem dışı ve pasif kalemleri süzer, kalemden kayıt detayı açar', () => {
    api.genelArama.and.returnValue(of({ isSuccess: true, value: {
      items: [
        { id: 3, projeNo: 'PA-1', paraBirimi: 'EUR', sandikNo: '10', isAdi: 'Sandık 10', kaynakAktif: true, finansTarihi: '2026-09-12', kategori: 1, durum: 1, poNumaralari: [], faturaNumaralari: [] },
        { id: 1, projeNo: 'PA-1', paraBirimi: 'EUR', sandikNo: '2', isAdi: 'Sandık 2', kaynakAktif: true, finansTarihi: '2026-09-05', kategori: 1, durum: 5, poNumaralari: ['PO-1'], faturaNumaralari: ['F-1'] },
        { id: 2, projeNo: 'PA-1', paraBirimi: 'EUR', sandikNo: '3', isAdi: 'Eski dönem', kaynakAktif: true, finansTarihi: '2026-08-20', kategori: 1, durum: 1, poNumaralari: [], faturaNumaralari: [] },
        { id: 4, projeNo: 'PA-1', paraBirimi: 'EUR', sandikNo: '4', isAdi: 'Pasif', kaynakAktif: false, finansTarihi: '2026-09-07', kategori: 1, durum: 1, poNumaralari: [], faturaNumaralari: [] },
      ],
      totalCount: 4, pageNumber: 1, pageSize: 250, totalPages: 1, hasPreviousPage: false, hasNextPage: false,
    } }) as never);
    const fixture = olustur([proje('PA-1', 500)]);
    const acilan = spyOn(fixture.componentInstance.kayitAc, 'emit');

    (fixture.nativeElement.querySelector('.project-row') as HTMLElement).click();
    fixture.detectChanges();
    expect(api.genelArama).toHaveBeenCalledOnceWith(jasmine.objectContaining({ projeNo: 'PA-1', paraBirimi: 'EUR', pageSize: 250 }));
    const kalemler = Array.from(fixture.nativeElement.querySelectorAll('.item-crate') as NodeListOf<HTMLElement>).map((x) => x.textContent!.trim());
    expect(kalemler).toEqual(['2', '10']);

    (fixture.nativeElement.querySelector('.item-open') as HTMLButtonElement).click();
    expect(acilan).toHaveBeenCalledOnceWith({ tur: 'IsKaydi', id: 1 });

    (fixture.nativeElement.querySelector('.project-row') as HTMLElement).click();
    (fixture.nativeElement.querySelector('.project-row') as HTMLElement).click();
    fixture.detectChanges();
    expect(api.genelArama).toHaveBeenCalledTimes(1);
  });

  it('kayıt izni yoksa proje satırı açılmaz; kategoriler pay sırasıyla listelenir', () => {
    izinler.set([]);
    const fixture = olustur([proje('PA-1', 500)]);
    (fixture.nativeElement.querySelector('.project-row') as HTMLElement).click();
    fixture.detectChanges();
    expect(api.genelArama).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('.chevron-btn')).toBeNull();

    fixture.componentInstance.sekmeSec('kategoriler');
    fixture.detectChanges();
    const adlar = Array.from(fixture.nativeElement.querySelectorAll('.category-name strong') as NodeListOf<HTMLElement>).map((x) => x.textContent!.trim());
    expect(adlar).toEqual(['Ana ambalaj', 'Özel iş']);
    expect(fixture.componentInstance.kategoriler()[0].pay).toBe(75);
  });
});
