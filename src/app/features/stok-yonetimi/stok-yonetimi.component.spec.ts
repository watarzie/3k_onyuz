import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { StokYonetimiComponent } from './stok-yonetimi.component';
import { StokService } from '../../core/services/stok.service';
import { PdfService } from '../../core/services/pdf.service';
import { ProjeService } from '../../core/services/proje.service';
import { PermissionService } from '../../core/services/permission.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { ToastService } from '../../core/services/toast.service';
import { TranslationService } from '../../core/services/translation.service';
import { StokDurum } from '../../core/constants/enums';
import { StokKaydiDto } from '../../shared/models';

describe('Stok Yönetimi Aktif Stok / Tükendiler sekmeleri', () => {
  let stokApi: jasmine.SpyObj<StokService>;
  let pdfApi: jasmine.SpyObj<PdfService>;
  const stok = (durumId: number, miktar: number): StokKaydiDto => ({
    id: durumId * 10, malzemeKodu: 'BC-1', malzemeAdi: 'Conta', miktar, birimId: 1, birimMetni: 'Adet',
    durumId, durumMetni: durumId === StokDurum.Aktif ? 'Aktif' : 'Tukendi',
  });
  const sayfa = (items: StokKaydiDto[]) => ({
    items, pageNumber: 1, pageSize: 15, totalCount: items.length, totalPages: 1, hasPreviousPage: false, hasNextPage: false,
  });

  beforeEach(() => {
    stokApi = jasmine.createSpyObj('StokService', ['getStokListesi', 'getStokSayilari', 'stokSil', 'notifyStokUpdated']);
    stokApi.getStokListesi.and.callFake((_arama?: string, _sayfa?: number, _boyut?: number, durumId?: number) =>
      of({ isSuccess: true, value: sayfa([stok(durumId ?? StokDurum.Aktif, durumId === StokDurum.Tukendi ? 0 : 3)]) }));
    stokApi.getStokSayilari.and.returnValue(of({ isSuccess: true, value: { aktif: 12, tukendi: 4 } }));
    pdfApi = jasmine.createSpyObj('PdfService', ['stokPdf']);
    pdfApi.stokPdf.and.returnValue(of(new Blob()));
    TestBed.configureTestingModule({
      imports: [StokYonetimiComponent],
      providers: [
        provideRouter([]),
        { provide: StokService, useValue: stokApi },
        { provide: PdfService, useValue: pdfApi },
        { provide: ProjeService, useValue: { getProjeDropdownListesi: () => of({ isSuccess: true, value: [] }) } },
        { provide: PermissionService, useValue: { loaded: () => true, hasAccess: () => true, canWrite: () => true } },
        { provide: ConfirmService, useValue: jasmine.createSpyObj('ConfirmService', ['ask']) },
        { provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['success', 'error', 'info', 'warning']) },
      ],
    });
    TestBed.inject(TranslationService).switchLanguage('tr');
  });

  function render() {
    const fixture = TestBed.createComponent(StokYonetimiComponent);
    fixture.detectChanges();
    return { fixture, c: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
  }

  it('açılışta aktif sekmeyi sunucudan durum filtresiyle ister ve sayaçları gösterir', () => {
    const { el } = render();
    expect(stokApi.getStokListesi).toHaveBeenCalledWith('', 1, 15, StokDurum.Aktif);
    const sekmeler = el.querySelectorAll('.stock-tabs button');
    expect(sekmeler[0].textContent).toContain('12');
    expect(sekmeler[1].textContent).toContain('4');
    expect(sekmeler[0].classList).toContain('active');
  });

  it('Tükendiler sekmesine geçince sayfa 1e döner ve durum filtresi gönderilir; etiket çeviriden gelir', () => {
    const { fixture, c, el } = render();
    c.currentPage.set(3);
    (el.querySelectorAll('.stock-tabs button')[1] as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(c.currentPage()).toBe(1);
    expect(stokApi.getStokListesi.calls.mostRecent().args).toEqual(['', 1, 15, StokDurum.Tukendi]);
    const durum = el.querySelector('.stock-status')!.textContent!.trim();
    expect(durum).toBe('Tükendi');
    expect(el.querySelector('tr.is-depleted')).not.toBeNull();
  });

  it('arama sayaçları da yeniler; rapor seçili sekmenin durumuyla istenir', () => {
    const { c } = render();
    c.searchTerm.set('conta');
    c.onSearchChange();
    expect(stokApi.getStokSayilari).toHaveBeenCalledWith('conta');

    c.durumSekmesiDegistir(StokDurum.Tukendi);
    c.indirStokPdf();
    expect(pdfApi.stokPdf).toHaveBeenCalledWith(StokDurum.Tukendi);
  });
});
