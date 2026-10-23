import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ProjeTipi } from '../../../core/constants/enums';
import { YETKI } from '../../../core/constants/yetki-kodlari';
import { GridService } from '../../../core/services/grid.service';
import { PermissionService } from '../../../core/services/permission.service';
import { TranslationService } from '../../../core/services/translation.service';
import { GridMalKabulGecmisiDto, GridSahaUrunDto, GridSahaUrunleriDto } from '../../../shared/models';
import { GridSahaComponent } from './grid-saha.component';

describe('Grid Sahası görünümü', () => {
  let api: jasmine.SpyObj<GridService>;
  let permissions: jasmine.SpyObj<PermissionService>;

  const satir = (id: number, projeId: number, tip: ProjeTipi, ek: Partial<GridSahaUrunDto> = {}): GridSahaUrunDto => ({
    cekiSatiriId: id, projeId, projeNo: `PA-${projeId}`, projeTipiId: tip, musteri: 'Müşteri', sandikNo: '1', siraNo: id,
    barkodNo: `B-${id}`, olcuResmiPozNo: null, aciklama: `Ürün ${id}`, birim: 'Adet', istenenAdet: 10, gridGelenAdet: 10,
    ucKGelenMiktar: 2, yoldakiMiktar: 4, griddeBekleyenMiktar: 4, gridDurumuId: 8, gridDurumuMetni: 'Tam Geldi',
    gridSevkDurumuId: 1, gridSevkDurumuMetni: 'Sevk Edildi', sonMalKabulTarihi: '2026-10-19T09:00:00',
    sonMalKabulPersoneli: 'Ayşe Grid', sahayaAktarildiMi: false, gridAciklama: null, ...ek,
  });
  const urunler: GridSahaUrunleriDto = {
    ozet: { bekleyenSatir: 2, bekleyenAdet: 7.5, projeSayisi: 2, eksikGelenSatir: 1, bugunMalKabul: 4 },
    liste: {
      items: [
        satir(1, 10, ProjeTipi.Normal, { sahayaAktarildiMi: true }),
        satir(2, 11, ProjeTipi.Saha, {
          gridDurumuId: 9, gridDurumuMetni: 'Eksik Geldi', sonMalKabulTarihi: null, sonMalKabulPersoneli: null, griddeBekleyenMiktar: 3.5,
        }),
      ],
      pageNumber: 1, pageSize: 25, totalCount: 2, totalPages: 1, hasPreviousPage: false, hasNextPage: false,
    },
  };
  const malKabul: GridMalKabulGecmisiDto = {
    baslangic: '2026-09-22T00:00:00', bitis: '2026-10-22T00:00:00',
    liste: {
      items: [
        {
          anahtar: 'C-1', tarih: '2026-10-21T10:00:00', kullaniciId: 70, kullaniciAdi: 'Ayşe Grid', projeId: 10, projeNo: 'PA-10',
          projeTipiId: ProjeTipi.Normal, islemMetni: 'Tam Geldi', topluMu: false, cekiSatiriId: 1, urunMetni: 'B-1 - Kapak', sandikNo: '3',
          oncekiDurumMetni: 'Bekliyor', gelenAdet: 5, guncelGridGelenAdet: 5, topluUrunSayisi: null, aciklama: 'Durum: TamGeldi | Gelen: 5',
        },
        {
          anahtar: 'A-7', tarih: '2026-10-19T15:00:00', kullaniciId: 71, kullaniciAdi: 'Mehmet Grid', projeId: 11, projeNo: 'PA-11',
          projeTipiId: ProjeTipi.Saha, islemMetni: 'Toplu sevk', topluMu: true, cekiSatiriId: null, urunMetni: 'Toplu sevk (3 ürün)',
          sandikNo: null, oncekiDurumMetni: null, gelenAdet: null, guncelGridGelenAdet: null, topluUrunSayisi: 3, aciklama: 'sevk',
        },
        {
          anahtar: 'C-9', tarih: '2026-10-19T11:00:00', kullaniciId: 71, kullaniciAdi: 'Mehmet Grid', projeId: 10, projeNo: 'PA-10',
          projeTipiId: ProjeTipi.Normal, islemMetni: 'Eksik Geldi', topluMu: false, cekiSatiriId: 2, urunMetni: 'B-2 - Vida',
          sandikNo: '1', oncekiDurumMetni: 'Gelmedi', gelenAdet: null, guncelGridGelenAdet: 6, topluUrunSayisi: null, aciklama: null,
        },
      ],
      pageNumber: 1, pageSize: 25, totalCount: 3, totalPages: 1, hasPreviousPage: false, hasNextPage: false,
    },
    personelOzeti: [{ kullaniciId: 71, kullaniciAdi: 'Mehmet Grid', islemSayisi: 7 }, { kullaniciId: 70, kullaniciAdi: 'Ayşe Grid', islemSayisi: 3 }],
  };

  function setup(hata?: string) {
    api = jasmine.createSpyObj<GridService>('GridService', ['getSahaUrunleri', 'getMalKabulKayitlari']);
    api.getSahaUrunleri.and.returnValue(of(hata ? { isSuccess: false, error: hata } : { isSuccess: true, value: urunler }));
    api.getMalKabulKayitlari.and.returnValue(of({ isSuccess: true, value: malKabul }));
    permissions = jasmine.createSpyObj<PermissionService>('PermissionService', ['hasAccess', 'canWrite', 'isReadOnly']);
    // Normal projenin Grid ve sandık izni var, saha projesininkiler yok; ekran salt okunur.
    permissions.hasAccess.and.callFake(kod => kod !== YETKI.SAHA.GRID_MODULU && kod !== YETKI.SAHA.SANDIKLAR);
    permissions.canWrite.and.returnValue(false);
    permissions.isReadOnly.and.returnValue(true);
    TestBed.configureTestingModule({
      imports: [GridSahaComponent],
      providers: [provideRouter([]), { provide: GridService, useValue: api }, { provide: PermissionService, useValue: permissions }],
    });
    TestBed.inject(TranslationService).switchLanguage('tr');
    const fixture = TestBed.createComponent(GridSahaComponent);
    fixture.detectChanges();
    return { fixture, c: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
  }

  it('varsayılan "Grid\'de bekleyen" kapsamıyla yükler; KPI, satırlar, son mal kabul ve rozetler görünür', () => {
    const { el } = setup();
    expect(api.getSahaUrunleri).toHaveBeenCalledOnceWith(jasmine.objectContaining({
      pageNumber: 1, pageSize: 25, kapsam: 'bekleyen', arama: undefined, projeTipiId: null, gridDurumuId: null, siralama: 'proje', azalan: false,
    }));
    expect(api.getMalKabulKayitlari).not.toHaveBeenCalled();
    expect(el.querySelector('.gs-kpi')?.textContent).toMatch(/7[.,]5/); // ondalık ayraç test yereline bağlı
    expect(el.querySelector('.gs-kapsam-bekleyen')?.classList).toContain('active');
    const satirlar = el.querySelectorAll('.gs-urunler tbody tr.gs-satir');
    expect(satirlar.length).toBe(2);
    expect(satirlar[0].querySelector('.gs-rozet--saha')).not.toBeNull();
    expect(satirlar[0].textContent).toContain('Ayşe Grid');
    expect(satirlar[0].textContent).toContain('Sevk Edildi');
    expect(satirlar[1].textContent).toContain('Kayıt yok');
    expect(el.querySelector('.readonly-badge')).not.toBeNull();
  });

  it('"Grid\'e git" bağlantısı yalnız proje tipinin Grid izni varsa çıkar; izinsiz tipte proje numarası düz metin kalır', () => {
    const { el } = setup();
    const satirlar = el.querySelectorAll('.gs-urunler tbody tr.gs-satir');
    expect(satirlar[0].querySelector<HTMLAnchorElement>('.gs-proje-link')?.getAttribute('href')).toBe('/grid/10?focusCekiSatiriId=1');
    expect(satirlar[0].querySelector('.gs-islem-grid')).not.toBeNull();
    expect(satirlar[0].querySelector('.gs-islem-proje')).not.toBeNull();
    expect(satirlar[1].querySelector('.gs-proje-link')).toBeNull();
    expect(satirlar[1].querySelector('.gs-proje-metin')?.textContent).toContain('PA-11');
    expect(satirlar[1].querySelector('app-islemler-menusu')).toBeNull();
  });

  it('kapsam ve süzgeçler parametrelere eşlenir ve ilk sayfaya döner; arama beklemeyle gider', fakeAsync(() => {
    const { c } = setup();
    const son = () => api.getSahaUrunleri.calls.mostRecent().args[0]!;
    c.sayfaDegisti(3);
    expect(son().pageNumber).toBe(3);

    c.kapsamDegisti('tumu');
    expect(son()).toEqual(jasmine.objectContaining({ kapsam: 'tumu', pageNumber: 1 }));
    c.kapsamDegisti('tumu');
    expect(api.getSahaUrunleri).toHaveBeenCalledTimes(3);

    c.aramaDegisti('ab');
    c.aramaDegisti('abc');
    expect(api.getSahaUrunleri).toHaveBeenCalledTimes(3);
    tick(400);
    expect(api.getSahaUrunleri).toHaveBeenCalledTimes(4);
    expect(son()).toEqual(jasmine.objectContaining({ arama: 'abc', pageNumber: 1 }));

    c.projeTipiDegisti(String(ProjeTipi.Saha));
    expect(son().projeTipiId).toBe(ProjeTipi.Saha);
    c.durumDegisti(9);
    expect(son().gridDurumuId).toBe(9);
    c.durumDegisti(9);
    expect(son().gridDurumuId).toBeNull();
    c.siralamaDegisti('bekleyen');
    c.azalanDegistir();
    expect(son()).toEqual(jasmine.objectContaining({ siralama: 'bekleyen', azalan: true }));
    c.siralamaDegisti('bilinmeyen');
    expect(son().siralama).toBe('proje');

    c.filtreleriTemizle();
    expect(c.filtreVar()).toBeFalse();
    // Kapsam süzgeç değildir: temizleme "Tümü" seçimini korur.
    expect(son()).toEqual(jasmine.objectContaining({ arama: undefined, projeTipiId: null, gridDurumuId: null, kapsam: 'tumu', pageNumber: 1 }));

    c.sayfaBoyutuDegisti(50);
    expect(son()).toEqual(jasmine.objectContaining({ pageSize: 50, pageNumber: 1 }));
  }));

  it('mal kabul sekmesi ilk açılışta bir kez yüklenir; günlere göre gruplar, işlem, gelen adet, arşiv rozeti ve personel özeti görünür', () => {
    const { c, fixture, el } = setup();
    c.sekmeDegistir('malKabul');
    fixture.detectChanges();
    expect(api.getMalKabulKayitlari).toHaveBeenCalledOnceWith(jasmine.objectContaining({
      pageNumber: 1, pageSize: 25, tur: 'mal-kabul', baslangic: undefined, bitis: undefined, personelId: null, arama: undefined,
    }));
    expect(c.gunGruplari().map(g => [g.gun, g.hareketler.length])).toEqual([['2026-10-21', 1], ['2026-10-19', 2]]);
    expect(el.querySelectorAll('.gs-mal-kabul tr.gs-gun').length).toBe(2);
    const hareketler = el.querySelectorAll('.gs-mal-kabul tr.gs-hareket');
    expect(hareketler[0].textContent).toContain('Bekliyor');
    expect(hareketler[0].textContent).toContain('Tam Geldi');
    expect(hareketler[0].querySelector('.gs-proje-link')?.getAttribute('href')).toBe('/grid/10?focusCekiSatiriId=1');
    expect(hareketler[1].classList).toContain('is-arsiv');
    expect(hareketler[1].querySelector('.gs-rozet--arsiv')).not.toBeNull();
    expect(hareketler[1].querySelector('.gs-rozet--toplu')).not.toBeNull();
    expect(hareketler[1].textContent).toContain('3 ürün');
    expect(hareketler[1].querySelector('.gs-proje-link')).toBeNull();
    // Eski kayıtta gelen adet yok: satırın güncel Grid'e gelen miktarı yıldızla gösterilir.
    expect(hareketler[2].textContent).toContain('6*');
    const ozet = el.querySelectorAll('.gs-personel-listesi li');
    expect(ozet.length).toBe(2);
    expect(ozet[0].textContent).toContain('Mehmet Grid');
    expect(ozet[0].textContent).toContain('7');
    expect(el.querySelector('.gs-mk-personel option[value="70"]')?.textContent).toContain('Ayşe Grid');

    c.sekmeDegistir('urunler');
    c.sekmeDegistir('malKabul');
    expect(api.getMalKabulKayitlari).toHaveBeenCalledTimes(1);
    c.mkTarihDegisti('mkBaslangic', '2026-10-01');
    c.mkPersonelDegisti('71');
    c.mkTurDegisti('hepsi');
    expect(api.getMalKabulKayitlari.calls.mostRecent().args[0]!).toEqual(jasmine.objectContaining({
      baslangic: '2026-10-01', personelId: 71, tur: 'hepsi', pageNumber: 1,
    }));
    c.mkFiltreleriTemizle();
    expect(c.mkFiltreVar()).toBeFalse();
    expect(api.getMalKabulKayitlari.calls.mostRecent().args[0]!).toEqual(jasmine.objectContaining({ tur: 'mal-kabul', personelId: null, baslangic: undefined }));
  });

  it('sunucu hatası liste yerine hata durumu gösterir; tekrar dene yeniden yükler', () => {
    const { c, el } = setup('Yetkiniz yok.');
    expect(el.querySelector('.gs-state--hata')?.textContent).toContain('Yetkiniz yok.');
    expect(el.querySelector('.gs-urunler')).toBeNull();
    c.yukle();
    expect(api.getSahaUrunleri).toHaveBeenCalledTimes(2);
  });
});
