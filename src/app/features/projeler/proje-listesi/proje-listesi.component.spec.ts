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
  let confirm: jasmine.SpyObj<ConfirmService>;

  function setup(data: Record<string, unknown>) {
    projeApi = jasmine.createSpyObj<ProjeService>('ProjeService', ['getProjeListesi', 'fotografBaglantisiEkle', 'fotografBaglantisiGuncelle', 'fotografBaglantisiSil']);
    projeApi.getProjeListesi.and.returnValue(of({ isSuccess: true, value: {
      items: listeOgeleri, pageNumber: 1, pageSize: 15, totalCount: listeOgeleri.length, totalPages: 1,
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
    confirm = jasmine.createSpyObj<ConfirmService>('ConfirmService', ['ask']);
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

  describe('fotoğraf bağlantıları (proje-fotograf-baglantisi: R görür/açar, W ekler/düzenler/siler)', () => {
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

      expect(projeApi.fotografBaglantisiEkle).toHaveBeenCalledOnceWith(saha.id, { adres: 'https://foto.ornek.com/p-2', aciklama: 'Paketleme' });
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
