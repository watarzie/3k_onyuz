import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { FinansPanelProjePaneliComponent } from './finans-panel-proje-paneli.component';
import { FinansService } from '../../../core/services/finans.service';
import { PermissionService } from '../../../core/services/permission.service';
import { TranslationService } from '../../../core/services/translation.service';
import { FINANS_YETKI } from '../../../core/constants/yetki-kodlari';
import { FinansIsKategorisi, FinansKarsilanma } from '../../../core/constants/enums';
import { FinansIsKaydi } from '../../../shared/models/finans.model';
import { FinansPanelProjeOzeti } from '../../../shared/models/finans-v2.model';

describe('Kontrol Paneli proje paneli', () => {
  let api: jasmine.SpyObj<FinansService>;
  const izinler = signal<string[]>([]);
  const proje: FinansPanelProjeOzeti = {
    projeNo: 'PA213-02', musteri: 'BAKIR BARA', paraBirimi: 'EUR', isKaydi: 4, isBedeli: 9000, siparisNetTutar: 3000,
    faturalananNetTutar: 1000, kalanSiparisNetTutar: 6000, kalanFaturaNetTutar: 2000, gider: 150,
    siparis: FinansKarsilanma.Kismi, fatura: FinansKarsilanma.Kismi, projeGrubu: 2,
  };
  const kalem = (id: number, sandikNo: string, ek: Partial<FinansIsKaydi> = {}) => ({
    id, projeNo: 'PA213-02', musteri: 'BAKIR BARA', paraBirimi: 'EUR', sandikNo, sandikAdi: 'Sandık ' + sandikNo, isAdi: 'Saha sandığı',
    kaynakAktif: true, finansTarihi: '2026-10-04', kategori: FinansIsKategorisi.Saha, durum: 1, netTutar: 1000, siparisNetTutar: 0,
    faturalananNetTutar: 0, poNumaralari: [], faturaNumaralari: [], ahsapM3: 1, kontraM3: 0.5, ...ek,
  });

  beforeEach(() => {
    izinler.set([FINANS_YETKI.Modul, FINANS_YETKI.SekmePanel, FINANS_YETKI.SekmePoFatura, FINANS_YETKI.SekmePoFaturaPo]);
    api = jasmine.createSpyObj('FinansService', ['genelArama', 'siparisler', 'faturalar']);
    api.genelArama.and.returnValue(of({ isSuccess: true, value: {
      items: [
        kalem(1, '10', { durum: 3, siparisNetTutar: 1000, poNumaralari: ['PO-7'] }),
        kalem(2, '2', { durum: 5, siparisNetTutar: 2000, faturalananNetTutar: 1000, poNumaralari: ['PO-7'], faturaNumaralari: ['FT-1'] }),
        kalem(3, '2', { kategori: FinansIsKategorisi.SarfKereste, kaynakBileseni: 'SARF', isTuru: 9, netTutar: 500, durum: 5 }),
        kalem(4, '3', { netTutar: null, ahsapM3: 2, kontraM3: 0 }),
        kalem(5, '4', { finansTarihi: '2026-08-01' }),
      ],
      totalCount: 5, pageNumber: 1, pageSize: 250, totalPages: 1, hasPreviousPage: false, hasNextPage: false,
    } }) as never);
    api.siparisler.and.returnValue(of({ isSuccess: true, value: { items: [
      { id: 7, kayitNo: 'S-7', poNumarasi: 'PO-7', projeNo: 'PA213-02', musteri: 'BAKIR BARA', isTurleri: [], siparisTarihi: '2026-10-05',
        sandikAdedi: 2, toplamM3: 3, faturalananM3: 1, kalanM3: 2, durum: 2, tutarlar: [], faturaNumaralari: ['FT-1'] },
    ], totalCount: 1, pageNumber: 1, pageSize: 100, totalPages: 1, hasPreviousPage: false, hasNextPage: false, toplamlar: [] } }) as never);
    TestBed.configureTestingModule({
      imports: [FinansPanelProjePaneliComponent],
      providers: [
        { provide: FinansService, useValue: api },
        { provide: PermissionService, useValue: { hasAccess: (kod: string) => izinler().includes(kod), canWrite: () => false } },
      ],
    });
    TestBed.inject(TranslationService).switchLanguage('tr');
  });

  function olustur(p: FinansPanelProjeOzeti = proje) {
    const fixture = TestBed.createComponent(FinansPanelProjePaneliComponent);
    fixture.componentRef.setInput('proje', p);
    fixture.componentRef.setInput('baslangic', '2026-10-01T00:00:00');
    fixture.componentRef.setInput('bitis', '2026-10-31T00:00:00');
    fixture.detectChanges();
    return { fixture, c: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
  }

  it('dönem özeti, kategoriler ve m³/fiyat bekleyen notları; dönem dışı kalem sayılmaz', () => {
    const { c, el } = olustur();
    expect(api.genelArama).toHaveBeenCalledOnceWith({ pageNumber: 1, pageSize: 250, projeNo: 'PA213-02', paraBirimi: 'EUR' });
    expect(el.querySelector('.project-drawer-title span')?.textContent).toContain('01.10.2026 – 31.10.2026');
    expect(el.querySelector('.project-drawer-title p')?.textContent).toContain('Saha projeleri');
    const kutular = Array.from(el.querySelectorAll('.summary-tile')).map((x) => x.textContent ?? '');
    expect(kutular[1]).toContain('%33');
    expect(kutular[3]).toMatch(/6.000.00 EUR/);
    expect(c.kalemler().map((k) => k.id)).toEqual([1, 2, 3, 4]);
    expect(c.kategoriler().map((k) => [k.kategori, k.kalemSayisi, k.sandikSayisi, k.net, k.durum]))
      .toEqual([[FinansIsKategorisi.SarfKereste, 1, 1, 500, 5], [FinansIsKategorisi.Saha, 3, 3, 2000, 1]].sort((a, b) => (a[0] as number) - (b[0] as number)));
    expect([c.ahsapM3(), c.kontraM3(), c.fiyatBekleyen()]).toEqual([5, 1.5, 1]);
    expect(el.querySelector('.note-chip.is-attention')?.textContent).toContain('1 kayıt fiyat bekliyor');
  });

  it('kategori satırı Sandıklar sekmesini o kategoriyle açar; süzgeç sayıları, arama ve sandık kalemleri', () => {
    const { c, fixture, el } = olustur();
    const sahaSatiri = Array.from(el.querySelectorAll('.panel-kategoriler tbody tr')).find((x) => x.textContent!.includes('Saha')) as HTMLElement;
    sahaSatiri.click();
    fixture.detectChanges();
    expect(c.sekme()).toBe('sandiklar');
    expect(el.querySelector('.drawer-chip')?.textContent).toContain('Saha');
    const nolar = () => Array.from(el.querySelectorAll('.panel-sandiklar .crate-summary-row strong')).map((x) => x.textContent!.trim());
    expect(nolar()).toEqual(['2', '3', '10']);
    expect(c.suzgecSayilari()).toEqual(jasmine.objectContaining({ hepsi: 3, fiyat: 1, siparis: 1, fatura: 1, tamam: 1 }));

    (el.querySelector('.drawer-chip button') as HTMLButtonElement).click();
    fixture.detectChanges();
    c.durumSuzgeci.set('tamam');
    fixture.detectChanges();
    expect(nolar()).toEqual(['2']);
    (el.querySelector('.panel-sandiklar .crate-summary-row') as HTMLElement).click();
    fixture.detectChanges();
    const kayitlar = el.querySelectorAll('.panel-sandiklar .crate-record-row');
    expect(kayitlar.length).toBe(2);
    expect(kayitlar[1].querySelector('.source-pill.is-sarf')).not.toBeNull();

    c.durumSuzgeci.set('hepsi');
    c.arama.set('po-7');
    fixture.detectChanges();
    expect(nolar()).toEqual(['2', '10']);
  });

  it('PO / Fatura sekmesi projenin belgelerini dönem işaretiyle gösterir; tüm dönemler proje detayını açar', () => {
    const { c, fixture, el } = olustur();
    const acilan = spyOn(c.kayitAc, 'emit');
    (el.querySelectorAll('.project-drawer-tabs button')[2] as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(api.siparisler).toHaveBeenCalledOnceWith({ pageNumber: 1, pageSize: 100, projeNo: 'PA213-02' });
    expect(api.faturalar).not.toHaveBeenCalled();
    const satir = el.querySelector('.drawer-po-list tbody tr') as HTMLElement;
    expect(satir.querySelector('.this-month')?.textContent?.trim()).toBe('Dönemde');
    (satir.querySelector('.belge-detay') as HTMLButtonElement).click();
    expect(acilan).toHaveBeenCalledOnceWith({ tur: 'Siparis', id: 7 });

    api.genelArama.calls.reset();
    (el.querySelector('.panel-tum-donemler') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('app-finans-proje-detay')).not.toBeNull();
  });
});
