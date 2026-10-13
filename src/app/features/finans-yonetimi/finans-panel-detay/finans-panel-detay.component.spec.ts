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
  const proje = (no: string, isBedeli: number, para = 'EUR', ek: Partial<FinansPanelProjeOzeti> = {}): FinansPanelProjeOzeti => ({
    ...ek as object,
    projeNo: no, musteri: ek.musteri ?? 'GE', paraBirimi: para, isKaydi: 2, isBedeli, siparisNetTutar: isBedeli / 2,
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
    izinler.set([FINANS_YETKI.Modul, FINANS_YETKI.SekmePanel]);
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

  it('her grupta ilk 5 projeyi gösterir, "Tümünü göster" ile hepsini açar; panel R kullanıcısı tutar sütunlarını görür', () => {
    const fixture = olustur(Array.from({ length: 11 }, (_, i) => proje(`PA-${i + 1}`, 100 * (11 - i))));
    const satirlar = () => fixture.nativeElement.querySelectorAll('.project-row').length;
    expect(satirlar()).toBe(5);
    expect(fixture.nativeElement.textContent).toContain('İş bedeli');
    expect(fixture.nativeElement.textContent).toContain('1,100.00');
    (fixture.nativeElement.querySelector('.show-more') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(satirlar()).toBe(11);
  });

  it('projeye tıklayınca sağdan proje paneli açılır; kalemler dönem ve aktif kaynağa süzülür, kalemden kayıt detayı açılır', () => {
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

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.items-row')).toBeNull();
    (el.querySelector('.project-row') as HTMLElement).click();
    fixture.detectChanges();
    expect(api.genelArama).toHaveBeenCalledOnceWith(jasmine.objectContaining({ projeNo: 'PA-1', paraBirimi: 'EUR', pageSize: 250 }));
    const panel = el.querySelector('.project-drawer') as HTMLElement;
    expect(panel.querySelector('h2')?.textContent).toContain('PA-1');
    expect(el.querySelector('.project-row')?.classList).toContain('is-open');

    // Sandıklar sekmesi: dönem dışı (3) ve pasif (4) kalem yok; doğal sandık sırası.
    (panel.querySelectorAll('.project-drawer-tabs button')[1] as HTMLButtonElement).click();
    fixture.detectChanges();
    const sandiklar = Array.from(panel.querySelectorAll('.panel-sandiklar .crate-summary-row strong')).map((x) => x.textContent!.trim());
    expect(sandiklar).toEqual(['2', '10']);
    (panel.querySelector('.panel-sandiklar .crate-summary-row') as HTMLElement).click();
    fixture.detectChanges();
    (panel.querySelector('.kalem-detay') as HTMLButtonElement).click();
    expect(acilan).toHaveBeenCalledOnceWith({ tur: 'IsKaydi', id: 1 });

    // Aynı satır paneli kapatır; kapat düğmesi de.
    (el.querySelector('.project-row') as HTMLElement).click();
    fixture.detectChanges();
    expect(el.querySelector('.project-drawer')).toBeNull();
    (el.querySelector('.project-row') as HTMLElement).click();
    fixture.detectChanges();
    (el.querySelector('.project-drawer-close') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('.project-drawer')).toBeNull();
  });

  it('projeler Normal → Saha → Yedek → Bağımsız gruplarında ara toplamla gösterilir; boş grup yoktur', () => {
    const fixture = olustur([
      proje('PA-N', 300, 'EUR', { projeGrubu: 1 }), proje('PA-N2', 100, 'EUR', { projeGrubu: 1 }),
      proje('PA-Y', 500, 'EUR', { projeGrubu: 3 }),
      proje('BAĞIMSIZ', 70, 'EUR', { projeGrubu: 4, musteri: 'ACME' }), proje('BAĞIMSIZ', 50, 'EUR', { projeGrubu: 4, musteri: 'GE Vernova' }),
    ]);
    const el = fixture.nativeElement as HTMLElement;
    const basliklar = Array.from(el.querySelectorAll('.group-title')).map((x) => x.textContent!.trim());
    expect(basliklar).toEqual(['Normal projeler', 'Yedek projeleri', 'Bağımsız işler']);
    const normal = el.querySelector('.project-group[data-grup="1"] .group-row')!.textContent!;
    expect(normal).toContain('400.00');
    const bagimsiz = Array.from(el.querySelectorAll('.project-group[data-grup="4"] .project-cell small')).map((x) => x.textContent!.trim());
    expect(bagimsiz).toEqual(['ACME', 'GE Vernova']);
  });

  it('bağımsız satırın panelinde yalnız o müşterinin kalemleri vardır; PO / Fatura ve tüm dönemler yoktur', () => {
    api.genelArama.and.returnValue(of({ isSuccess: true, value: {
      items: [
        { id: 1, projeNo: 'BAĞIMSIZ', musteri: 'ACME', paraBirimi: 'EUR', sandikNo: '', isAdi: 'ACME işi', kaynakAktif: true, finansTarihi: '2026-09-12', kategori: 8, durum: 1, poNumaralari: [], faturaNumaralari: [] },
        { id: 2, projeNo: 'BAĞIMSIZ', musteri: 'GE Vernova', paraBirimi: 'EUR', sandikNo: '', isAdi: 'GE işi', kaynakAktif: true, finansTarihi: '2026-09-12', kategori: 8, durum: 1, poNumaralari: [], faturaNumaralari: [] },
      ],
      totalCount: 2, pageNumber: 1, pageSize: 250, totalPages: 1, hasPreviousPage: false, hasNextPage: false,
    } }) as never);
    const fixture = olustur([proje('BAĞIMSIZ', 70, 'EUR', { projeGrubu: 4, musteri: 'ACME' }), proje('BAĞIMSIZ', 50, 'EUR', { projeGrubu: 4, musteri: 'GE Vernova' })]);
    izinler.update((x) => [...x, FINANS_YETKI.SekmePoFatura, FINANS_YETKI.SekmePoFaturaPo]);
    (fixture.nativeElement.querySelector('.project-row') as HTMLElement).click();
    fixture.detectChanges();
    const panel = fixture.nativeElement.querySelector('.project-drawer') as HTMLElement;
    expect(panel.querySelectorAll('.project-drawer-tabs button').length).toBe(2);
    expect(panel.querySelector('.panel-tum-donemler')).toBeNull();
    (panel.querySelectorAll('.project-drawer-tabs button')[1] as HTMLButtonElement).click();
    fixture.detectChanges();
    (panel.querySelector('.panel-sandiklar .crate-summary-row') as HTMLElement).click();
    fixture.detectChanges();
    const kalemler = Array.from(panel.querySelectorAll('.crate-record-row td:first-child small') as NodeListOf<HTMLElement>).map((x) => x.textContent!.trim());
    expect(kalemler.length).toBe(1);
    expect(kalemler[0]).toContain('ACME işi');
  });

  it('kayıt sekmelerinden hiçbiri açık değilse proje satırı açılmaz; kategoriler iş bedeli payıyla sıralanır', () => {
    izinler.set([FINANS_YETKI.Modul, FINANS_YETKI.SekmeGiderler]);
    const fixture = olustur([proje('PA-1', 500)]);
    (fixture.nativeElement.querySelector('.project-row') as HTMLElement).click();
    fixture.detectChanges();
    expect(api.genelArama).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('.project-open-btn')).toBeNull();
    expect(fixture.nativeElement.querySelector('.project-drawer')).toBeNull();

    fixture.componentInstance.sekmeSec('kategoriler');
    fixture.detectChanges();
    const adlar = Array.from(fixture.nativeElement.querySelectorAll('.category-name strong') as NodeListOf<HTMLElement>).map((x) => x.textContent!.trim());
    expect(adlar).toEqual(['Ana ambalaj', 'Özel iş']);
    expect(fixture.componentInstance.kategoriler()[0].pay).toBe(75);
  });
});
