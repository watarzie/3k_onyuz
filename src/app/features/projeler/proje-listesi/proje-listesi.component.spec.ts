import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ProjeTipi } from '../../../core/constants/enums';
import { YETKI } from '../../../core/constants/yetki-kodlari';
import { ConfirmService } from '../../../core/services/confirm.service';
import { PdfService } from '../../../core/services/pdf.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ProjeService } from '../../../core/services/proje.service';
import { SandikService } from '../../../core/services/sandik.service';
import { ToastService } from '../../../core/services/toast.service';
import { ProjeDto } from '../../../shared/models';
import { ProjeListesiComponent } from './proje-listesi.component';

describe('Proje listesi: sevk edilen saha/yedek görünürlüğü (G1) ve toplu talep formu (G4)', () => {
  let projeApi: jasmine.SpyObj<ProjeService>;
  let pdf: jasmine.SpyObj<PdfService>;
  let toast: jasmine.SpyObj<ToastService>;
  const okuma = new Set<string>();
  const yazma = new Set<string>();
  const proje = (id: number, projeTipiId: ProjeTipi, ek: Partial<ProjeDto> = {}) =>
    ({
      id, projeNo: `P-${id}`, musteri: 'GE', durumId: 1, durumMetni: 'Aktif', projeTipiId, projeTipiMetni: '',
      fizikselSevkEdilmisSandikVarMi: true, sorumluKisi: '', sandikSayisi: 1, hazirSandikSayisi: 1, depoSandikSayisi: 0,
      depoUcKSandikSayisi: 0, depoSeymenSandikSayisi: 0, depoGridSandikSayisi: 0, toplamUrunSayisi: 0,
      tamamlananUrunSayisi: 0, ...ek,
    }) as ProjeDto;
  const saha = proje(2, ProjeTipi.Saha);
  const yedek = proje(3, ProjeTipi.Yedek);

  function setup(data: Record<string, unknown>) {
    projeApi = jasmine.createSpyObj<ProjeService>('ProjeService', ['getProjeListesi']);
    projeApi.getProjeListesi.and.returnValue(of({ isSuccess: true, value: {
      items: [saha, yedek], pageNumber: 1, pageSize: 15, totalCount: 2, totalPages: 1,
      hasPreviousPage: false, hasNextPage: false,
    } }));
    pdf = jasmine.createSpyObj<PdfService>('PdfService', ['topluTalepFormuExcel', 'downloadErrorMessage']);
    pdf.topluTalepFormuExcel.and.returnValue(of(new Blob(['x'])));
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error', 'warning', 'info']);
    TestBed.configureTestingModule({
      imports: [ProjeListesiComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { data } } },
        { provide: ProjeService, useValue: projeApi },
        { provide: SandikService, useValue: {} },
        { provide: PdfService, useValue: pdf },
        { provide: ToastService, useValue: toast },
        { provide: ConfirmService, useValue: jasmine.createSpyObj('ConfirmService', ['ask']) },
        { provide: PermissionService, useValue: {
          loaded: () => true,
          hasAccess: (k: string) => okuma.has(k) || yazma.has(k),
          canWrite: (k: string) => yazma.has(k),
        } },
      ],
    });
    const fixture = TestBed.createComponent(ProjeListesiComponent);
    fixture.detectChanges();
    return { fixture, c: fixture.componentInstance };
  }

  beforeEach(() => {
    okuma.clear();
    yazma.clear();
  });

  for (const [ad, data, tip] of [
    ['saha', { menuKod: YETKI.SAHA.YONETIMI, projeTipi: ProjeTipi.Saha }, ProjeTipi.Saha],
    ['yedek', { menuKod: YETKI.YEDEK.YONETIMI, projeTipi: ProjeTipi.Yedek }, ProjeTipi.Yedek],
  ] as const) {
    it(`${ad} modül listesi yalnız sevk edilmemiş projeleri ister (S-11)`, () => {
      setup(data);
      const [, , projeTipiId, , isSevkEdilen] = projeApi.getProjeListesi.calls.mostRecent().args;
      expect(projeTipiId).toBe(tip);
      expect(isSevkEdilen).toBeFalse();
    });
  }

  it('Sevk Edilen listesi bütün tipleri ister; rapor ve kilit açma izni satırın kendi proje tipine göre denetlenir', () => {
    okuma.add(YETKI.SAHA.GERCEKLESEN_CEKI_RAPORU);
    yazma.add(YETKI.YEDEK.YONETIMI);
    const { c } = setup({ menuKod: YETKI.PROJE.SEVK_EDILEN });
    const [, , projeTipiId, , isSevkEdilen] = projeApi.getProjeListesi.calls.mostRecent().args;
    expect(projeTipiId).toBeUndefined();
    expect(isSevkEdilen).toBeTrue();
    expect(c.canShowGerceklesenRapor(saha)).toBeTrue();
    expect(c.canShowGerceklesenRapor(yedek)).toBeFalse();
    expect(c.kilidiAcabilir(saha)).toBeFalse();
    expect(c.kilidiAcabilir(yedek)).toBeTrue();
    expect(c.kilidiAcabilir({ ...yedek, fizikselSevkEdilmisSandikVarMi: false })).toBeFalse();
    yazma.add(YETKI.PROJE.SEVK_EDILEN);
    expect(c.kilidiAcabilir(saha)).toBeTrue();
  });

  it('Aktif Projeler satırın gerçek tipinin sevk iznine bakar; toplu sevk yalnız seçili projeleri pencereye verir (C-08)', () => {
    yazma.add(YETKI.SAHA.SEVK_ET);
    const { c, fixture } = setup({ menuKod: YETKI.PROJE.AKTIF_PROJELER });
    expect(c.canSevkEtProje(saha)).toBeTrue();
    expect(c.canSevkEtProje(yedek)).toBeFalse();
    expect(c.canSevkEtProje(proje(1, ProjeTipi.Normal))).toBeFalse();
    expect(c.canUseTopluSevk()).toBeTrue();
    expect(c.canUseBulkSecim()).toBeTrue();
    expect(fixture.nativeElement.querySelector('.toplu-sevk-trigger')).not.toBeNull();

    c.openTopluSevk();
    expect(c.topluSevkProjeleri()).toBeNull();
    expect(toast.warning).toHaveBeenCalled();
    c.toggleEksikRaporProjeSelection(yedek.id);
    c.openTopluSevk();
    expect(c.topluSevkProjeleri()).toEqual([yedek]);

    c.onTopluSevkEdildi({ seferId: 1, seferNo: '2026-000001', projeSayisi: 1, sandikSayisi: 2 });
    expect(c.topluSevkProjeleri()).toBeNull();
    expect(toast.success).toHaveBeenCalledWith('Sefer 2026-000001: 1 projenin 2 sandığı sevk edildi.');
    expect(projeApi.getProjeListesi).toHaveBeenCalledTimes(2);
    expect(c.selectedEksikRaporCount()).toBe(0);
  });

  it('toplu sevk sevk edilmemiş saha/yedek listelerinde ekranın sevk izniyle açılır; normal sandık yönetimi ve Sevk Edilen dışarıda', () => {
    yazma.add(YETKI.PROJE.SEVK_ET);
    yazma.add(YETKI.SAHA.SEVK_ET);
    expect(setup({ menuKod: YETKI.SAHA.YONETIMI, projeTipi: ProjeTipi.Saha }).c.canUseTopluSevk()).toBeTrue();
    TestBed.resetTestingModule();
    expect(setup({ menuKod: YETKI.YEDEK.YONETIMI, projeTipi: ProjeTipi.Yedek }).c.canUseTopluSevk()).toBeFalse();
    TestBed.resetTestingModule();
    expect(setup({ menuKod: YETKI.SANDIK.YONETIMI, projeTipi: ProjeTipi.Normal }).c.canUseTopluSevk()).toBeFalse();
    TestBed.resetTestingModule();
    expect(setup({ menuKod: YETKI.PROJE.SEVK_EDILEN }).c.canUseTopluSevk()).toBeFalse();
  });

  it('modül listesinde kilit açma sunucu kuralına uyar: sevk izni yetmez, projenin tipinin proje yönetimi W gerekir', () => {
    yazma.add(YETKI.SAHA.SEVK_ET);
    const { c } = setup({ menuKod: YETKI.SAHA.YONETIMI, projeTipi: ProjeTipi.Saha });
    expect(c.kilidiAcabilir(saha)).toBeFalse();
    yazma.add(YETKI.SAHA.YONETIMI);
    expect(c.kilidiAcabilir(saha)).toBeTrue();
  });

  it('toplu talep formu ekranın proje tipindeki Grid iznini ister ve seçili projeleri tek istekte gönderir', () => {
    const kisitli = setup({ menuKod: YETKI.SAHA.YONETIMI, projeTipi: ProjeTipi.Saha }).c;
    expect(kisitli.canUseBulkTalepFormu()).toBeFalse();
    kisitli.indirTopluTalepFormu();
    expect(pdf.topluTalepFormuExcel).not.toHaveBeenCalled();

    TestBed.resetTestingModule();
    okuma.add(YETKI.SAHA.GRID_MODULU);
    const { c } = setup({ menuKod: YETKI.SAHA.YONETIMI, projeTipi: ProjeTipi.Saha });
    expect(c.canUseBulkTalepFormu()).toBeTrue();
    c.indirTopluTalepFormu();
    expect(pdf.topluTalepFormuExcel).not.toHaveBeenCalled();
    expect(toast.warning).toHaveBeenCalled();

    c.toggleEksikRaporProjeSelection(saha.id);
    c.toggleEksikRaporProjeSelection(yedek.id);
    spyOn(URL, 'createObjectURL').and.returnValue('blob:talep');
    spyOn(URL, 'revokeObjectURL');
    spyOn(HTMLAnchorElement.prototype, 'click');
    c.indirTopluTalepFormu();
    expect(pdf.topluTalepFormuExcel).toHaveBeenCalledOnceWith([saha.id, yedek.id], ProjeTipi.Saha);
    expect(c.topluTalepFormuIndiriliyor()).toBeFalse();
    expect(toast.success).toHaveBeenCalled();
  });
});
