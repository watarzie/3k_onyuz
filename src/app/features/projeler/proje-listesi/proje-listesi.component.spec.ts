import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ProjeTipi } from '../../../core/constants/enums';
import { YETKI } from '../../../core/constants/yetki-kodlari';
import { ConfirmService } from '../../../core/services/confirm.service';
import { PdfService } from '../../../core/services/pdf.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ProjeService } from '../../../core/services/proje.service';
import { SandikService } from '../../../core/services/sandik.service';
import { SevkiyatService } from '../../../core/services/sevkiyat.service';
import { ToastService } from '../../../core/services/toast.service';
import { ProjeBaglantiTuru, ProjeDto, SandikDto } from '../../../shared/models';
import { TopluSevkComponent } from '../toplu-sevk/toplu-sevk.component';
import { ProjeListesiComponent } from './proje-listesi.component';
import {
  fotografAciklamasiGecerli,
  fotografBaglantisiEtiketi,
  fotografBaglantisiGecerli,
  fotografBaglantisiNormalize,
  fotografSitesi,
} from './proje-fotograf-baglantisi';

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
  let listeOgeleri: ProjeDto[] = [saha, yedek];
  /** Verilirse liste bu boyla sayfalanır; arama proje numarasında eşleşenleri döndürür (sunucu davranışının taklidi). */
  let sayfaBoyu: number | null = null;
  let sandikApi: jasmine.SpyObj<SandikService>;
  let sevkiyatApi: jasmine.SpyObj<SevkiyatService>;
  let confirm: jasmine.SpyObj<ConfirmService>;

  function setup(data: Record<string, unknown>) {
    projeApi = jasmine.createSpyObj<ProjeService>('ProjeService', ['getProjeListesi', 'fotografBaglantisiEkle', 'fotografBaglantisiGuncelle', 'fotografBaglantisiSil']);
    projeApi.getProjeListesi.and.callFake((sayfa = 1, _boyut?: number, _tip?: number, arama?: string) => {
      const eslesen = arama ? listeOgeleri.filter(p => p.projeNo.includes(arama)) : listeOgeleri;
      const boy = sayfaBoyu ?? Math.max(eslesen.length, 1);
      const toplamSayfa = Math.ceil(eslesen.length / boy);
      return of({ isSuccess: true, value: {
        items: eslesen.slice((sayfa - 1) * boy, sayfa * boy), pageNumber: sayfa, pageSize: boy,
        totalCount: eslesen.length, totalPages: toplamSayfa, hasPreviousPage: sayfa > 1, hasNextPage: sayfa < toplamSayfa,
      } });
    });
    pdf = jasmine.createSpyObj<PdfService>('PdfService', ['topluTalepFormuExcel', 'topluEksikUrunlerPdf', 'downloadErrorMessage']);
    pdf.topluTalepFormuExcel.and.returnValue(of(new Blob(['x'])));
    pdf.topluEksikUrunlerPdf.and.returnValue(of(new Blob(['x'])));
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error', 'warning', 'info']);
    sandikApi = jasmine.createSpyObj<SandikService>('SandikService', ['getSandiklar']);
    sevkiyatApi = jasmine.createSpyObj<SevkiyatService>('SevkiyatService', ['topluSevk']);
    TestBed.configureTestingModule({
      imports: [ProjeListesiComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { data } } },
        { provide: ProjeService, useValue: projeApi },
        { provide: SandikService, useValue: sandikApi },
        { provide: SevkiyatService, useValue: sevkiyatApi },
        { provide: PdfService, useValue: pdf },
        { provide: ToastService, useValue: toast },
        { provide: ConfirmService, useValue: confirm },
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
    listeOgeleri = [saha, yedek];
    sayfaBoyu = null;
    confirm =jasmine.createSpyObj<ConfirmService>('ConfirmService', ['ask']);
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

  it('Sevk Edilen ve Aktif Projeler listesinden projenin kendi tipindeki Grid ve 3K ekranına kısayol; izin satırın proje tipine göre', () => {
    const normal = proje(1, ProjeTipi.Normal);
    listeOgeleri = [normal, saha, yedek];
    okuma.add(YETKI.SANDIK.GRID_MODULU);
    okuma.add(YETKI.SANDIK.UCK_MODULU);
    okuma.add(YETKI.SAHA.UCK_MODULU);
    const { fixture, c } = setup({ menuKod: YETKI.PROJE.SEVK_EDILEN });
    expect([c.listeGridRotasi(normal), c.liste3KRotasi(normal)]).toEqual(['/grid', '/uck']);
    expect([c.listeGridRotasi(saha), c.liste3KRotasi(saha)]).toEqual([null, '/saha-yonetimi/uck']);
    expect([c.listeGridRotasi(yedek), c.liste3KRotasi(yedek)]).toEqual([null, null]);
    expect(c.shouldShowActions(normal)).toBeTrue();

    const el = fixture.nativeElement as HTMLElement;
    const hrefler = Array.from(el.querySelectorAll<HTMLAnchorElement>('a.btn-action-grid, a.btn-action-3k')).map(a => a.getAttribute('href'));
    expect(hrefler).toEqual(['/grid/1', '/uck/1', '/saha-yonetimi/uck/2']);

    // Aktif Projeler de bütün tipleri listeler: aynı kısayol aynı izin kuralıyla çıkar.
    TestBed.resetTestingModule();
    const aktif = setup({ menuKod: YETKI.PROJE.AKTIF_PROJELER });
    expect([aktif.c.listeGridRotasi(normal), aktif.c.liste3KRotasi(saha), aktif.c.listeGridRotasi(yedek)]).toEqual(['/grid', '/saha-yonetimi/uck', null]);
    expect(aktif.c.shouldShowActions(normal)).toBeTrue();
    expect(Array.from((aktif.fixture.nativeElement as HTMLElement).querySelectorAll<HTMLAnchorElement>('a.btn-action-grid, a.btn-action-3k'))
      .map(a => a.getAttribute('href'))).toEqual(['/grid/1', '/uck/1', '/saha-yonetimi/uck/2']);

    // Sandık Yönetimi'nin kendi Grid/3K düğmeleri vardır; bu kısayol orada çıkmaz (çift düğme olmaz).
    TestBed.resetTestingModule();
    const sandik = setup({ menuKod: YETKI.SANDIK.YONETIMI, projeTipi: ProjeTipi.Normal }).c;
    expect(sandik.listeGridRotasi(normal)).toBeNull();
  });

  it('Gerçekleşen çeki menüsünde müşteri listesi PDF/Excel olarak iner; sevk edilmemiş projede sunucu iletisi gösterilir', fakeAsync(() => {
    okuma.add(YETKI.SAHA.GERCEKLESEN_CEKI_RAPORU);
    const { fixture, c } = setup({ menuKod: YETKI.PROJE.SEVK_EDILEN });
    (pdf as any).musteriCekiListesi = jasmine.createSpy('musteriCekiListesi').and.returnValue(of(new Blob(['x'])));
    spyOn(URL, 'createObjectURL').and.returnValue('blob:x');
    const tetik = document.createElement('button');
    document.body.appendChild(tetik);
    tetik.addEventListener('click', e => c.toggleReportMenu(e, 'gerceklesen-2', saha, 'gerceklesen'));
    tetik.click();
    tetik.remove();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const ogeler = Array.from(el.querySelectorAll('.report-download-menu-global .report-download-item')).map(b => b.textContent?.trim());
    expect(ogeler).toEqual(['PDF olarak indir', 'Excel olarak indir', 'Müşteri listesi (PDF)', 'Müşteri listesi (Excel)']);

    c.indirMusteriCekiListesi(saha, 'excel');
    expect((pdf as any).musteriCekiListesi).toHaveBeenCalledWith(saha.id, 'excel');
    expect(toast.success).toHaveBeenCalledWith('Müşteri çeki listesi indirildi.');
    expect(c.downloadingMusteriCeki()).toBeNull();

    (pdf as any).musteriCekiListesi.and.returnValue(new (class { subscribe(o: any) { o.error('400'); } })());
    pdf.downloadErrorMessage.and.resolveTo('Projenin sevk edilmiş sandığı yok.');
    c.indirMusteriCekiListesi(saha, 'pdf');
    tick();
    expect(toast.error).toHaveBeenCalledWith('Projenin sevk edilmiş sandığı yok.');
  }));

  it('Yedek Raporu menüsünde tüm sandıklar ve sevke hazır raporu iner; hazır sandık yoksa sunucunun nedeni gösterilir', fakeAsync(() => {
    listeOgeleri = [yedek];
    okuma.add(YETKI.YEDEK.RAPORU);
    const { fixture, c } = setup({ menuKod: YETKI.YEDEK.YONETIMI, projeTipi: ProjeTipi.Yedek });
    (pdf as any).sevkeHazirSandikRaporu = jasmine.createSpy('sevkeHazirSandikRaporu').and.returnValue(of(new Blob(['x'])));
    (pdf as any).sahaProjePdf = jasmine.createSpy('sahaProjePdf').and.returnValue(of(new Blob(['x'])));
    spyOn(URL, 'createObjectURL').and.returnValue('blob:x');
    const el = fixture.nativeElement as HTMLElement;
    const tetik = el.querySelector<HTMLButtonElement>('.report-download-trigger[title="Yedek Raporu"]')!;
    expect(tetik.textContent).toContain('Yedek Raporu');
    tetik.click();
    fixture.detectChanges();
    const ogeler = Array.from(el.querySelectorAll('.report-download-menu-global .report-download-item')).map(b => b.textContent?.trim());
    expect(ogeler).toEqual(['Tüm sandıklar (PDF)', 'Sevke hazır (PDF)', 'Sevke hazır (Excel)']);

    // Mevcut rapor aynı uçtan iner.
    c.indirSahaProjePdf(yedek);
    expect((pdf as any).sahaProjePdf).toHaveBeenCalledWith(yedek.id);
    expect(c.reportMenuKey()).toBeNull();

    c.indirSevkeHazirSandikRaporu(yedek, 'excel');
    expect((pdf as any).sevkeHazirSandikRaporu).toHaveBeenCalledWith(yedek.id, 'excel');
    expect(toast.success).toHaveBeenCalledWith('Sevke hazır sandık raporu indirildi.');
    expect(c.downloadingSevkeHazir()).toBeNull();

    (pdf as any).sevkeHazirSandikRaporu.and.returnValue(new (class { subscribe(o: any) { o.error('400'); } })());
    pdf.downloadErrorMessage.and.resolveTo('Sevke hazır sandık bulunamadı. 1 sandık kapanmadığı için listelenmedi (No: 3).');
    c.indirSevkeHazirSandikRaporu(yedek, 'pdf');
    tick();
    expect(toast.error).toHaveBeenCalledWith('Sevke hazır sandık bulunamadı. 1 sandık kapanmadığı için listelenmedi (No: 3).');
  }));

  it('Aktif Projeler satırın gerçek tipinin sevk iznine bakar; toplu sevk yalnız seçili projeleri pencereye verir (C-08)', () => {
    yazma.add(YETKI.SAHA.SEVK_ET);
    const { c, fixture } = setup({ menuKod: YETKI.PROJE.AKTIF_PROJELER });
    expect(c.canSevkEtProje(saha)).toBeTrue();
    expect(c.canSevkEtProje(yedek)).toBeFalse();
    expect(c.canSevkEtProje(proje(1, ProjeTipi.Normal))).toBeFalse();
    expect(c.canUseTopluSevk()).toBeTrue();
    expect(c.canUseBulkSecim()).toBeTrue();
    // Toplu işlem düğmeleri yalnız seçim varken çıkar.
    expect(fixture.nativeElement.querySelector('.toplu-sevk-trigger')).toBeNull();
    c.toggleEksikRaporProjeSelection(saha);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.toplu-sevk-trigger')).not.toBeNull();
    c.seciminiTemizle();

    c.openTopluSevk();
    expect(c.topluSevkProjeleri()).toBeNull();
    expect(toast.warning).toHaveBeenCalled();
    c.toggleEksikRaporProjeSelection(yedek);
    c.openTopluSevk();
    expect(c.topluSevkProjeleri()).toEqual([yedek]);

    c.onTopluSevkEdildi({ seferId: 1, seferNo: '2026-000001', projeSayisi: 1, sandikSayisi: 2, sevkEdilenProjeIds: [yedek.id] });
    expect(c.topluSevkProjeleri()).toBeNull();
    expect(toast.success).toHaveBeenCalledWith('Sefer 2026-000001: 1 projenin 2 sandığı sevk edildi.');
    expect(toast.warning).toHaveBeenCalledTimes(1);
    expect(projeApi.getProjeListesi).toHaveBeenCalledTimes(2);
    expect(c.selectedEksikRaporCount()).toBe(0);
  });

  describe('toplu işlem seçimi sayfa, arama ve filtreden bağımsızdır', () => {
    const normal = (id: number) => proje(id, ProjeTipi.Normal);
    const aktifProjeler = { menuKod: YETKI.PROJE.AKTIF_PROJELER };
    const seciliIdler = (c: ProjeListesiComponent) => [...c.seciliProjeler().keys()];
    const aramaYap = (c: ProjeListesiComponent, deger: string) => {
      c.onSearch({ target: { value: deger } } as unknown as Event);
      tick(400);
    };

    beforeEach(() => {
      // Sayfa 1: P-1..P-3, sayfa 2: P-4, P-5; P-9 yalnız aramayla ikinci sayfadan bulunur.
      listeOgeleri = [1, 2, 3, 4, 5, 9].map(normal);
      sayfaBoyu = 3;
      yazma.add(YETKI.PROJE.SEVK_ET);
    });

    it('sayfa değişimi, arama, aramayı temizleme ve tip filtresi seçimi sıfırlamaz; sayaç bütün seçimi gösterir', fakeAsync(() => {
      const { c, fixture } = setup(aktifProjeler);
      const el = fixture.nativeElement as HTMLElement;
      c.toggleEksikRaporProjeSelection(c.projeler()[0]);

      c.goToPage(2);
      expect(c.projeler().map(p => p.id)).toEqual([4, 5, 9]);
      c.toggleEksikRaporProjeSelection(c.projeler()[0]);
      expect(seciliIdler(c)).toEqual([1, 4]);
      expect(c.gorunmeyenSeciliSayisi()).toBe(1);

      aramaYap(c, 'P-9');
      expect(c.projeler().map(p => p.id)).toEqual([9]);
      c.toggleEksikRaporProjeSelection(c.projeler()[0]);
      aramaYap(c, '');
      expect(c.currentPage()).toBe(1);
      c.setProjeTipiFilter(ProjeTipi.Saha);
      c.setProjeTipiFilter(null);
      c.onPageSizeChange(25);

      expect(seciliIdler(c)).toEqual([1, 4, 9]);
      fixture.detectChanges();
      expect(el.querySelector('.toolbar-count')?.textContent?.trim()).toBe('3');
      expect(Array.from(el.querySelectorAll('.pl-secim__oge')).map(o => o.textContent?.trim())).toEqual(['P-1', 'P-4', 'P-9']);
      expect(el.querySelector('.pl-secim__not')?.textContent).toContain('2 tanesi bu sayfada değil');
      // Görünen ilk sayfada (P-1..P-3) satır kutusu yalnız P-1'de işaretlidir.
      const isaretliler = Array.from(el.querySelectorAll<HTMLInputElement>('tbody .bulk-report-select-column input'))
        .map(kutu => kutu.checked);
      expect(isaretliler).toEqual([true, false, false]);
    }));

    it('başlıktaki "tümünü seç" yalnız görünen sayfayı seçer ve bırakır; sınır aşılırsa seçimi değiştirmez', () => {
      const { c } = setup(aktifProjeler);
      c.goToPage(2);
      c.toggleEksikRaporProjeSelection(c.projeler()[1]);
      c.goToPage(1);

      c.toggleAllEksikRaporProjects();
      expect(seciliIdler(c)).toEqual([5, 1, 2, 3]);
      expect(c.allCurrentPageSelectedForEksikRapor()).toBeTrue();
      c.toggleAllEksikRaporProjects();
      expect(seciliIdler(c)).toEqual([5]);

      const dolu = new Map(Array.from({ length: 23 }, (_, i) => [100 + i, normal(100 + i)] as const));
      c.seciliProjeler.set(dolu);
      c.toggleAllEksikRaporProjects();
      expect(c.selectedEksikRaporCount()).toBe(23);
      expect(toast.warning).toHaveBeenCalledWith(jasmine.stringContaining('sınır aşılıyor'));
    });

    it('seçim şeridinden tek proje çıkarılır ve seçim temizlenir', () => {
      const { c, fixture } = setup(aktifProjeler);
      const el = fixture.nativeElement as HTMLElement;
      c.toggleAllEksikRaporProjects();
      c.goToPage(2);
      fixture.detectChanges();
      expect(el.querySelectorAll('.pl-secim__oge.is-gizli').length).toBe(3);

      (el.querySelector('.pl-secim__kaldir') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(seciliIdler(c)).toEqual([2, 3]);

      (el.querySelector('.pl-secim__temizle') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(c.selectedEksikRaporCount()).toBe(0);
      expect(el.querySelector('.pl-secim')).toBeNull();
    });

    it('toplu sevk farklı sayfalardaki bütün seçili projeleri gönderir; sevk edilenler seçimden çıkar, sefere girmeyen bildirilir', () => {
      const sandik = (id: number) =>
        ({ id, sandikNo: String(id), ad: `Sandık ${id}`, durumId: 3, durumMetni: 'Kapalı', urunSayisi: 1 }) as SandikDto;
      const { c, fixture } = setup(aktifProjeler);
      // P-5'te sevke hazır sandık yok; pencerede dışarıda kalır.
      sandikApi.getSandiklar.and.callFake((id: number) => of({ isSuccess: true, value: id === 5 ? [] : [sandik(id * 100 + 1)] }));
      sevkiyatApi.topluSevk.and.returnValue(of({ isSuccess: true, value: { seferId: 7, seferNo: '2026-000007', projeSayisi: 2, sandikSayisi: 2 } }));

      c.toggleEksikRaporProjeSelection(c.projeler()[0]);
      c.goToPage(2);
      c.toggleEksikRaporProjeSelection(c.projeler()[0]);
      c.toggleEksikRaporProjeSelection(c.projeler()[1]);
      c.openTopluSevk();
      fixture.detectChanges();
      expect(c.topluSevkProjeleri()!.map(p => p.id)).toEqual([1, 4, 5]);

      const pencere = fixture.debugElement.query(By.directive(TopluSevkComponent)).componentInstance as TopluSevkComponent;
      expect(sandikApi.getSandiklar.calls.allArgs().map(a => a[0])).toEqual([1, 4, 5]);
      expect(pencere.disaridaKalanlar().map(s => s.proje.id)).toEqual([5]);
      pencere.aracPlaka.set('34 ABC 123');
      pencere.gonder();
      expect(sevkiyatApi.topluSevk).toHaveBeenCalledOnceWith(jasmine.objectContaining({
        projeler: [{ projeId: 1, sandikIds: [101] }, { projeId: 4, sandikIds: [401] }],
      }));

      fixture.detectChanges();
      expect(c.topluSevkProjeleri()).toBeNull();
      expect(seciliIdler(c)).toEqual([5]);
      expect(toast.warning).toHaveBeenCalledWith('Sefere girmeyen 1 proje sevk edilmedi ve seçimde bırakıldı: P-5.');
      const uyari = (fixture.nativeElement as HTMLElement).querySelector('.pl-secim__oge.is-uyari');
      expect(uyari?.textContent?.trim()).toBe('P-5');

      c.seciminiTemizle();
      expect(c.sevkEdilmeyenProjeIds().size).toBe(0);
    });

    it('toplu eksik raporu ve talep formu farklı sayfalardaki bütün seçimi gönderir', () => {
      yazma.clear();
      okuma.add(YETKI.SANDIK.EKSIK_RAPORU);
      okuma.add(YETKI.SANDIK.GRID_MODULU);
      spyOn(URL, 'createObjectURL').and.returnValue('blob:toplu');
      spyOn(URL, 'revokeObjectURL');
      spyOn(HTMLAnchorElement.prototype, 'click');
      const { c } = setup({ menuKod: YETKI.SANDIK.YONETIMI, projeTipi: ProjeTipi.Normal });
      expect(c.canUseBulkEksikRapor()).toBeTrue();
      expect(c.canUseBulkTalepFormu()).toBeTrue();

      c.toggleEksikRaporProjeSelection(c.projeler()[2]);
      c.goToPage(2);
      c.toggleEksikRaporProjeSelection(c.projeler()[0]);

      c.indirTopluEksikRapor('pdf');
      expect(pdf.topluEksikUrunlerPdf).toHaveBeenCalledOnceWith([3, 4], ProjeTipi.Normal);
      c.indirTopluTalepFormu();
      expect(pdf.topluTalepFormuExcel).toHaveBeenCalledOnceWith([3, 4], ProjeTipi.Normal);
      // İndirme seçimi değiştirmez; kullanıcı aynı seçimle başka toplu işlem yapabilir.
      expect(seciliIdler(c)).toEqual([3, 4]);
    });
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

  it('Grid Sahası düğmesi Sandık Yönetimi ve Projeler listesinde, yalnız grid-saha-gorunumu izniyle çıkar (kenar menüde yoktur)', () => {
    const dugme = (f: { nativeElement: HTMLElement }) => f.nativeElement.querySelector<HTMLAnchorElement>('a.grid-saha-trigger');
    let { fixture } = setup({ menuKod: YETKI.SANDIK.YONETIMI, projeTipi: ProjeTipi.Normal });
    expect(dugme(fixture)).toBeNull();
    TestBed.resetTestingModule();

    okuma.add(YETKI.SANDIK.GRID_SAHA_GORUNUMU);
    for (const data of [{ menuKod: YETKI.SANDIK.YONETIMI, projeTipi: ProjeTipi.Normal }, { menuKod: YETKI.PROJE.AKTIF_PROJELER }]) {
      ({ fixture } = setup(data));
      expect(dugme(fixture)?.getAttribute('href')).withContext(data.menuKod).toBe('/grid-saha');
      TestBed.resetTestingModule();
    }
    ({ fixture } = setup({ menuKod: YETKI.SAHA.YONETIMI, projeTipi: ProjeTipi.Saha }));
    expect(dugme(fixture)).toBeNull();
  });

  it('3K ve Grid İş Listesi Sandık Yönetimi başlığında ayrı düğmedir, "Diğer" menüsünde değildir; her biri kendi izniyle', () => {
    const baslik = (f: { nativeElement: HTMLElement }, sec: string) => f.nativeElement.querySelector<HTMLAnchorElement>(`.pl-hero__eylem > ${sec}`);
    const menude = (f: { nativeElement: HTMLElement }, rota: string) => f.nativeElement.querySelector(`.pl-diger a[href="${rota}"]`);
    okuma.add(YETKI.SANDIK.UCK_IS_LISTESI);
    let { fixture } = setup({ menuKod: YETKI.SANDIK.YONETIMI, projeTipi: ProjeTipi.Normal });
    expect(baslik(fixture, 'a.pl-uck-is-listesi')?.getAttribute('href')).toBe('/uck-is-listesi');
    expect(baslik(fixture, 'a.pl-grid-is-listesi')).toBeNull();
    TestBed.resetTestingModule();

    okuma.add(YETKI.SANDIK.GRID_IS_LISTESI);
    ({ fixture } = setup({ menuKod: YETKI.SANDIK.YONETIMI, projeTipi: ProjeTipi.Normal }));
    expect(baslik(fixture, 'a.pl-grid-is-listesi')?.getAttribute('href')).toBe('/grid-is-listesi');
    expect(menude(fixture, '/uck-is-listesi')).toBeNull();
    expect(menude(fixture, '/grid-is-listesi')).toBeNull();
  });

  it('aktarımlar penceresinde seçilen ürünler (farklı sandıklardan) tek taşıma penceresine gider; sevkli satır seçilmez', () => {
    yazma.add(YETKI.SAHA.SAHAYA_AKTAR);
    const { c } = setup({ menuKod: YETKI.SAHA.YONETIMI, projeTipi: ProjeTipi.Saha });
    const satir = (id: number, sandikId: number, sevkEdildiMi = false) => ({
      sahaCekiSatiriId: id, sahaProjeId: saha.id, sahaProjeNo: saha.projeNo, sahaSandikId: sandikId, sahaSandikNo: String(sandikId),
      kaynakProjeId: 1, kaynakProjeNo: 'PA1', kaynakSandikNo: '24', siraNo: id, barkodNo: `B${id}`, aciklama: `Ürün ${id}`, miktar: 1,
      birim: 'Adet', durumMetni: '', sevkEdildiMi, islemGormusMu: false, geriAlinabilirMi: !sevkEdildiMi,
    });
    c.sahaAktarimProje.set(saha);
    c.sahaAktarimlari.set([satir(11, 1), satir(12, 1), satir(13, 1, true), satir(21, 2)]);

    expect(c.sahaTasimaSecilebilirIds()).toEqual([11, 12, 21]);
    const [grup1, grup2] = c.sahaAktarimGruplari();
    c.sahaTasimaGrubuSec(grup1, true);
    expect(c.sahaTasimaSeciliIds()).toEqual([11, 12]);
    expect(c.sahaTasimaGrupSecili(grup1)).toBeTrue();
    c.sahaTasimaSec(c.sahaAktarimlari()[2], true);
    expect(c.sahaTasimaSeciliIds()).toEqual([11, 12]);
    c.sahaTasimaSec(grup2.aktarimlar[0], true);
    expect(c.sahaTasimaTumuSecili()).toBeTrue();

    c.sahayaTasiSecilenler();
    expect(c.sahaTasimaSecimi()?.satirIds).toEqual([11, 12, 21]);
    expect(c.sahaTasimaSecimi()?.sandikId).toBeNull();

    c.sahaTasimaTumunuSec(false);
    expect(c.sahaTasimaSeciliIds()).toEqual([]);
  });

  it('tekil sevk toplu sevkteki sefer alanlarını gönderir; araç plakası zorunludur', () => {
    const { c } = setup({ menuKod: YETKI.SAHA.YONETIMI, projeTipi: ProjeTipi.Saha });
    projeApi.sevkEt = jasmine.createSpy('sevkEt').and.returnValue(of({ isSuccess: true, value: true }));
    c.sevkEtProje.set(saha);
    c.sevkEtTarihi.set('2026-10-30T10:00');
    c.selectedSevkSandikIds.set([5]);

    c.sevkEtAracPlaka.set(' - ');
    c.sevkEtOnayla();
    expect(projeApi.sevkEt).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Araç plakası girilmelidir.');

    c.sevkEtAracPlaka.set('34-abc-123');
    c.sevkEtSofor.set(' Ahmet ');
    c.sevkEtDorsePlaka.set('34 XYZ 99');
    c.sevkEtAciklama.set('Not');
    c.sevkEtOnayla();
    const [projeId, , sandikIds, aciklama, sefer] = (projeApi.sevkEt as jasmine.Spy).calls.mostRecent().args;
    expect([projeId, sandikIds, aciklama]).toEqual([saha.id, [5], 'Not']);
    expect(sefer).toEqual({ aracPlaka: '34-abc-123', sofor: 'Ahmet', dorsePlaka: '34 XYZ 99' });
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

    c.toggleEksikRaporProjeSelection(saha);
    c.toggleEksikRaporProjeSelection(yedek);
    spyOn(URL, 'createObjectURL').and.returnValue('blob:talep');
    spyOn(URL, 'revokeObjectURL');
    spyOn(HTMLAnchorElement.prototype, 'click');
    c.indirTopluTalepFormu();
    expect(pdf.topluTalepFormuExcel).toHaveBeenCalledOnceWith([saha.id, yedek.id], ProjeTipi.Saha);
    expect(c.topluTalepFormuIndiriliyor()).toBeFalse();
    expect(toast.success).toHaveBeenCalled();
  });

  describe('fotoğraf bağlantıları (proje-fotograf-baglantisi: R görür/açar, W ekler/düzenler/siler)', () => {
    it('gerçekleşen çeki sekmesi ayrı listelenir ve açık sekmenin türüyle ekler; çip adı türlere göre değişir', () => {
      const cekiBaglantisi = { id: 9, tur: ProjeBaglantiTuru.GerceklesenCeki, adres: 'https://drive.ornek.com/ceki', aciklama: 'Final' };
      listeOgeleri = [
        { ...saha, fotografBaglantilari: [{ id: 5, adres: 'https://foto.ornek.com/p-2' }, cekiBaglantisi] },
        { ...yedek, fotografBaglantilari: [cekiBaglantisi] },
      ];
      yazma.add(YETKI.PROJE.FOTOGRAF_BAGLANTISI);
      const { fixture, c } = setup({ menuKod: YETKI.SAHA.YONETIMI, projeTipi: ProjeTipi.Saha });
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('button.pl-foto--coklu span')?.textContent?.trim()).toBe('Fotoğraflar ve Gerçekleşen Çeki');
      expect(el.querySelector('a.pl-foto span')?.textContent?.trim()).toBe('Gerçekleşen Çeki');
      expect(el.querySelector('.pl-foto-duzenle')?.textContent?.trim()).toBe('Fotoğraflar ve Gerçekleşen Çeki');

      c.fotografPenceresiniAc(c.projeler()[0]);
      fixture.detectChanges();
      expect(el.querySelector('#pl-foto-baslik')?.textContent?.trim()).toBe('Fotoğraflar ve Gerçekleşen Çeki');
      const sekmeler = Array.from(el.querySelectorAll<HTMLButtonElement>('.pl-foto-sekme'));
      expect(sekmeler.map(b => b.textContent?.replace(/\s+/g, ' ').trim())).toEqual(['Fotoğraflar1', 'Gerçekleşen Çeki1']);
      expect(c.fotografPenceresiBaglantilari().map(b => b.id)).toEqual([5]);

      sekmeler[1].click();
      fixture.detectChanges();
      expect(c.fotografPenceresiBaglantilari().map(b => b.id)).toEqual([9]);
      projeApi.fotografBaglantisiEkle.and.returnValue(of({ isSuccess: true, value: [] }));
      c.fotografTaslak.set('drive.ornek.com/ceki-2');
      c.fotografBaglantisiKaydet();
      expect(projeApi.fotografBaglantisiEkle).toHaveBeenCalledOnceWith(saha.id,
        { adres: 'https://drive.ornek.com/ceki-2', aciklama: null, tur: ProjeBaglantiTuru.GerceklesenCeki });
      expect(toast.success).toHaveBeenCalledWith('Gerçekleşen çeki bağlantısı eklendi.');
    });

    const sahaYonetimi = { menuKod: YETKI.SAHA.YONETIMI, projeTipi: ProjeTipi.Saha };
    const foto = (id: number, adres: string, aciklama: string | null = null) => ({ id, adres, aciklama });
    const iki = [foto(5, 'https://foto.ornek.com/p-2'), foto(8, 'https://drive.ornek.com/sevk', 'Sevk günü')];

    it('adres kuralı sunucuyla aynıdır: şemasız adrese https eklenir; boş, http/https dışı ve boşluklu adres reddedilir', () => {
      expect(fotografBaglantisiNormalize('  foto.ornek.com/pa727 ')).toBe('https://foto.ornek.com/pa727');
      expect(fotografBaglantisiNormalize('   ')).toBeNull();
      expect(fotografBaglantisiGecerli('http://192.168.1.20/galeri')).toBeTrue();
      for (const kotu of ['', '   ', 'javascript:alert(1)', 'JAVASCRIPT://alert(1)', 'ftp://foto.ornek.com/a', 'https://foto ornek.com', 'https://']) {
        expect(fotografBaglantisiGecerli(kotu)).withContext(kotu).toBeFalse();
      }
      expect(fotografBaglantisiGecerli('https://ornek.com/' + 'a'.repeat(1000))).toBeFalse();
      expect(fotografAciklamasiGecerli(' ' + 'a'.repeat(100) + ' ')).toBeTrue();
      expect(fotografAciklamasiGecerli('a'.repeat(101))).toBeFalse();
      expect(fotografSitesi('https://www.foto.ornek.com/pa727?x=1')).toBe('foto.ornek.com');
      expect(fotografBaglantisiEtiketi(foto(1, 'https://www.foto.ornek.com/a'))).toBe('foto.ornek.com');
      expect(fotografBaglantisiEtiketi(foto(1, 'https://foto.ornek.com/a', ' Paketleme '))).toBe('Paketleme');
    });

    it('okuma izniyle tek bağlantı çipten yeni sekmede açılır, çok bağlantı çipin açtığı listeden; izin yoksa çip yoktur', () => {
      listeOgeleri = [{ ...saha, fotografBaglantilari: [iki[1]] }, { ...yedek, fotografBaglantilari: iki }];
      okuma.add(YETKI.PROJE.FOTOGRAF_BAGLANTISI);
      const { fixture, c } = setup(sahaYonetimi);
      const el = fixture.nativeElement as HTMLElement;
      const tek = el.querySelector('a.pl-foto') as HTMLAnchorElement;
      expect(el.querySelectorAll('a.pl-foto').length).toBe(1);
      expect(tek.getAttribute('href')).toBe('https://drive.ornek.com/sevk');
      expect(tek.target).toBe('_blank');
      expect(tek.rel).toBe('noopener noreferrer');
      expect(tek.title).toContain('Sevk günü');
      expect(el.querySelector('.pl-foto--ekle')).toBeNull();
      expect(el.querySelector('.pl-foto-duzenle')).toBeNull();

      const coklu = el.querySelector('button.pl-foto--coklu') as HTMLButtonElement;
      expect(coklu.querySelector('.pl-foto__sayi')?.textContent?.trim()).toBe('2');
      coklu.click();
      fixture.detectChanges();
      expect(c.fotografMenu()?.proje.id).toBe(yedek.id);
      const ogeler = Array.from(el.querySelectorAll<HTMLAnchorElement>('.pl-foto-menu a.pl-foto-menu__oge'));
      expect(ogeler.map(a => a.getAttribute('href'))).toEqual(['https://foto.ornek.com/p-2', 'https://drive.ornek.com/sevk']);
      expect(ogeler.map(a => a.querySelector('.pl-foto-menu__metin > span')?.textContent?.trim())).toEqual(['foto.ornek.com', 'Sevk günü']);
      expect(ogeler.every(a => a.target === '_blank' && a.rel === 'noopener noreferrer')).toBeTrue();
      // Okuma izni düzenleme girişi göstermez; belgeye tıklamak listeyi kapatır.
      expect(el.querySelector('.pl-foto-menu__yonet')).toBeNull();
      document.body.click();
      fixture.detectChanges();
      expect(el.querySelector('.pl-foto-menu')).toBeNull();

      TestBed.resetTestingModule();
      okuma.clear();
      const yetkisiz = setup(sahaYonetimi).fixture.nativeElement as HTMLElement;
      expect(yetkisiz.querySelector('.pl-foto')).toBeNull();
    });

    it('yazma izniyle bağlantısız projeye açıklamalı bağlantı eklenir: şemasız adres https ile gönderilir, satır ve pencere yerinde güncellenir', () => {
      yazma.add(YETKI.PROJE.FOTOGRAF_BAGLANTISI);
      const { fixture, c } = setup(sahaYonetimi);
      projeApi.fotografBaglantisiEkle.and.returnValue(of({ isSuccess: true, value: [foto(5, 'https://foto.ornek.com/p-2', 'Paketleme')] }));
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelectorAll('.pl-foto--ekle').length).toBe(2);

      (el.querySelector('.pl-foto--ekle') as HTMLButtonElement).click();
      fixture.detectChanges();
      const girdi = el.querySelector('.pl-foto-adres') as HTMLInputElement;
      const aciklama = el.querySelector('.pl-foto-aciklama') as HTMLInputElement;
      const kaydet = el.querySelector('.pl-foto-kaydet') as HTMLButtonElement;
      expect(el.querySelector('.pl-foto-bos')).not.toBeNull();
      expect(kaydet.disabled).toBeTrue();
      expect(el.querySelector('.pl-foto-hata')).toBeNull();

      girdi.value = 'javascript:alert(1)';
      girdi.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      expect(el.querySelector('.pl-foto-hata')).not.toBeNull();
      expect(kaydet.disabled).toBeTrue();

      girdi.value = ' foto.ornek.com/p-2 ';
      girdi.dispatchEvent(new Event('input'));
      aciklama.value = ' Paketleme ';
      aciklama.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      expect(el.querySelector('.pl-foto-onizleme')?.textContent).toContain('foto.ornek.com');
      kaydet.click();
      fixture.detectChanges();

      expect(projeApi.fotografBaglantisiEkle).toHaveBeenCalledOnceWith(saha.id, { adres: 'https://foto.ornek.com/p-2', aciklama: 'Paketleme', tur: ProjeBaglantiTuru.Fotograf });
      expect(c.projeler().find(p => p.id === saha.id)?.fotografBaglantilari).toEqual([foto(5, 'https://foto.ornek.com/p-2', 'Paketleme')]);
      expect(projeApi.getProjeListesi).toHaveBeenCalledTimes(1);
      expect(toast.success).toHaveBeenCalledWith('Fotoğraf bağlantısı eklendi.');
      // Pencere açık kalır, form boşalır; yeni bağlantı listede ve satırda görünür.
      expect(c.fotografProje()?.id).toBe(saha.id);
      expect((el.querySelector('.pl-foto-adres') as HTMLInputElement).value).toBe('');
      expect(el.querySelector('.pl-foto-liste__baglanti')?.getAttribute('href')).toBe('https://foto.ornek.com/p-2');
      expect(el.querySelector('.pl-foto-liste__baglanti')?.getAttribute('rel')).toBe('noopener noreferrer');
      expect((el.querySelector('a.pl-foto') as HTMLAnchorElement).getAttribute('href')).toBe('https://foto.ornek.com/p-2');
    });

    it('kayıtlı bağlantı düzenlenir ve onayla silinir; onay verilmezse istek gitmez', async () => {
      listeOgeleri = [{ ...saha, fotografBaglantilari: iki }];
      yazma.add(YETKI.PROJE.FOTOGRAF_BAGLANTISI);
      const { fixture, c } = setup(sahaYonetimi);
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('.pl-foto-duzenle')).not.toBeNull();
      c.fotografPenceresiniAc(c.projeler()[0]);
      fixture.detectChanges();
      expect(el.querySelectorAll('.pl-foto-liste__oge').length).toBe(2);

      (el.querySelectorAll('.pl-foto-liste__duzenle')[1] as HTMLButtonElement).click();
      fixture.detectChanges();
      const girdi = el.querySelector('.pl-foto-adres') as HTMLInputElement;
      expect(girdi.value).toBe('https://drive.ornek.com/sevk');
      expect((el.querySelector('.pl-foto-aciklama') as HTMLInputElement).value).toBe('Sevk günü');
      girdi.value = 'drive.ornek.com/sevk-2';
      girdi.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      const guncel = [iki[0], foto(8, 'https://drive.ornek.com/sevk-2', 'Sevk günü')];
      projeApi.fotografBaglantisiGuncelle.and.returnValue(of({ isSuccess: true, value: guncel }));
      (el.querySelector('.pl-foto-kaydet') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(projeApi.fotografBaglantisiGuncelle).toHaveBeenCalledOnceWith(saha.id, 8, { adres: 'https://drive.ornek.com/sevk-2', aciklama: 'Sevk günü' });
      expect(c.projeler()[0].fotografBaglantilari).toEqual(guncel);
      expect(c.fotografDuzenlenen()).toBeNull();

      projeApi.fotografBaglantisiSil.and.returnValue(of({ isSuccess: true, value: [guncel[1]] }));
      confirm.ask.and.resolveTo(false);
      await c.fotografBaglantisiSil(guncel[0]);
      expect(projeApi.fotografBaglantisiSil).not.toHaveBeenCalled();

      confirm.ask.and.resolveTo(true);
      await c.fotografBaglantisiSil(guncel[0]);
      expect(projeApi.fotografBaglantisiSil).toHaveBeenCalledOnceWith(saha.id, 5);
      expect(c.projeler()[0].fotografBaglantilari).toEqual([guncel[1]]);
      expect(toast.success).toHaveBeenCalledWith('Fotoğraf bağlantısı silindi.');
    });

    it('sınırda (20 bağlantı) yeni bağlantı eklenemez, var olan düzenlenebilir; sunucu reddi bildirilir', () => {
      const yirmi = Array.from({ length: 20 }, (_, i) => foto(i + 1, 'https://foto.ornek.com/' + i));
      listeOgeleri = [{ ...saha, fotografBaglantilari: yirmi }];
      yazma.add(YETKI.PROJE.FOTOGRAF_BAGLANTISI);
      const { fixture, c } = setup(sahaYonetimi);
      c.fotografPenceresiniAc(c.projeler()[0]);
      c.fotografTaslak.set('https://foto.ornek.com/fazla');
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('.pl-foto-hata')?.textContent).toContain('en fazla 20');
      expect((el.querySelector('.pl-foto-kaydet') as HTMLButtonElement).disabled).toBeTrue();
      c.fotografBaglantisiKaydet();
      expect(projeApi.fotografBaglantisiEkle).not.toHaveBeenCalled();

      c.fotografBaglantisiniDuzenle(yirmi[0]);
      c.fotografTaslak.set('https://foto.ornek.com/0-yeni');
      fixture.detectChanges();
      expect((el.querySelector('.pl-foto-kaydet') as HTMLButtonElement).disabled).toBeFalse();
      projeApi.fotografBaglantisiGuncelle.and.returnValue(of({ isSuccess: false, error: 'Bu adres projede zaten kayıtlı.' }));
      c.fotografBaglantisiKaydet();
      expect(toast.error).toHaveBeenCalledWith('Bu adres projede zaten kayıtlı.');
      expect(c.projeler()[0].fotografBaglantilari).toEqual(yirmi);
      expect(c.fotografDuzenlenen()).toEqual(yirmi[0]);
    });

    it('okuma izni bağlantıları düzenlemeyi açmaz', () => {
      okuma.add(YETKI.PROJE.FOTOGRAF_BAGLANTISI);
      const { c } = setup(sahaYonetimi);
      c.fotografPenceresiniAc(saha);
      expect(c.fotografProje()).toBeNull();
    });
  });
});
