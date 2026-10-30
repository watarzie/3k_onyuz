import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { HttpParams, HttpResponse } from '@angular/common/http';
import { of } from 'rxjs';
import { API } from '../../../core/constants/api-endpoints';
import { BaseApiService } from '../../../core/services/base-api.service';
import { ToastService } from '../../../core/services/toast.service';
import { PdfYazdirService } from '../../../core/services/pdf-yazdir.service';
import { QzTrayCalismiyorHatasi, QzTrayService } from '../../../core/services/qz-tray.service';
import {
  BarkodEtiketBicimi,
  BarkodEtiketProjesi,
  BarkodEtiketSandikSatiri,
  BarkodEtiketUrunKaynagi,
  BarkodEtiketUrunSatiri,
  PaginatedList,
} from '../../../shared/models';
import { BarkodEtiketComponent, QZ_YAZICI_ANAHTARI, adetDuzelt, buAy, urunAnahtari } from './barkod-etiket.component';

describe('Barkod etiketi', () => {
  let api: jasmine.SpyObj<BaseApiService>;
  let yazici: jasmine.SpyObj<PdfYazdirService>;
  let qz: jasmine.SpyObj<QzTrayService>;

  const proje: BarkodEtiketProjesi = {
    projeId: 45, projeNo: 'PA600-22', projeTipiId: 1, seriNo: 'PA600-22', musteri: 'SONELGAZ', lokasyon: 'ALGERIA',
  };
  const sandik = (id: number, no: string): BarkodEtiketSandikSatiri => ({
    sandikId: id, sandikNo: no, ad: 'Aksesuar', adIngilizce: 'ACCESSORIES', durum: 'Kapandı', barkod: String(id).padStart(12, '0'), urunSayisi: 3,
  });
  const urun = (id: number, kaynak: BarkodEtiketUrunKaynagi, etiketBarkodu: string | null, miktar = 4,
    sandiktakiMiktar: number | null = null): BarkodEtiketUrunSatiri => ({
    kaynak, id, barkodNo: 'FCT00967433', etiketBarkodu, tanim: 'TEKERLEK', aciklama: 'Wheel Assembly', remarks: '38.39',
    sandikNolari: '8', miktar, sandiktakiMiktar, birim: 'Adet',
  });
  const sayfa = <T>(items: T[]): PaginatedList<T> => ({
    items, pageNumber: 1, pageSize: 25, totalCount: items.length, totalPages: 1, hasPreviousPage: false, hasNextPage: false,
  });

  function kur(sorgu: Record<string, string> = {}) {
    api = jasmine.createSpyObj<BaseApiService>('BaseApiService', ['get', 'downloadPostFileResponse', 'downloadErrorMessage']);
    api.get.and.callFake(((url: string) => {
      if (url === API.BARKOD_ETIKET.PROJE(45)) return of({ isSuccess: true, value: proje });
      if (url === API.BARKOD_ETIKET.PROJELER) return of({ isSuccess: true, value: sayfa([proje]) });
      if (url === API.BARKOD_ETIKET.SANDIKLAR(45)) return of({ isSuccess: true, value: sayfa([sandik(723, '8'), sandik(724, '9')]) });
      return of({ isSuccess: true, value: sayfa([urun(1, BarkodEtiketUrunKaynagi.CekiSatiri, '00000FCT00967433'),
        urun(1, BarkodEtiketUrunKaynagi.SandikIcerik, '0000000FC4324042'), urun(2, BarkodEtiketUrunKaynagi.CekiSatiri, null)]) });
    }) as any);
    yazici = jasmine.createSpyObj<PdfYazdirService>('PdfYazdirService', ['yazdir']);
    yazici.yazdir.and.resolveTo();
    qz = jasmine.createSpyObj<QzTrayService>('QzTrayService', ['yazicilar', 'hamGonder']);
    qz.yazicilar.and.resolveTo(['Microsoft Print to PDF', 'Godex Sandık']);
    qz.hamGonder.and.resolveTo();
    localStorage.removeItem(QZ_YAZICI_ANAHTARI);
    TestBed.configureTestingModule({
      imports: [BarkodEtiketComponent],
      providers: [
        provideRouter([]),
        { provide: BaseApiService, useValue: api },
        { provide: PdfYazdirService, useValue: yazici },
        { provide: QzTrayService, useValue: qz },
        { provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['error', 'success', 'info']) },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(sorgu) } } },
      ],
    });
    spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    const fixture = TestBed.createComponent(BarkodEtiketComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('adet 1–100 arasına çekilir; ay seçici bu ayla açılır; ürün anahtarı kaynağı ayırır', () => {
    expect([adetDuzelt('0'), adetDuzelt('7'), adetDuzelt(250), adetDuzelt('x'), adetDuzelt(2.9)]).toEqual([1, 7, 100, 1, 2]);
    expect(buAy(new Date(2026, 8, 3))).toBe('2026-09');
    expect(urunAnahtari({ kaynak: BarkodEtiketUrunKaynagi.CekiSatiri, id: 5 }))
      .not.toBe(urunAnahtari({ kaynak: BarkodEtiketUrunKaynagi.SandikIcerik, id: 5 }));
  });

  it('proje yoksa proje listesini gösterir; seçince sandıklar sunucudan sayfalı gelir', () => {
    const fixture = kur();
    expect(api.get.calls.mostRecent().args[0]).toBe(API.BARKOD_ETIKET.PROJELER);
    fixture.componentInstance.projeSec(proje);
    fixture.detectChanges();
    const sandikIstegi = api.get.calls.all().find(c => c.args[0] === API.BARKOD_ETIKET.SANDIKLAR(45)
      && (c.args[1] as { params: HttpParams }).params.get('boyut') === '25');
    expect(sandikIstegi).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('000000000723');
  });

  it('sandık seçimi ve adediyle tarih AA/YY için yıl/ay gönderilir; PDF iner', () => {
    const fixture = kur({ projeId: '45' });
    const c = fixture.componentInstance;
    expect(c.proje()?.projeNo).toBe('PA600-22');
    expect(c.olusturulabilir()).toBeFalse();

    c.sandikSecimDegistir(sandik(723, '8'), true);
    c.sandikAdediDegisti(sandik(723, '8'), '3');
    c.sandikSecimDegistir(sandik(724, '9'), true);
    c.sandikSecimDegistir(sandik(724, '9'), false);
    c.tarih.set('2026-09');
    expect(c.etiketSayisi()).toBe(3);

    api.downloadPostFileResponse.and.returnValue(of(new HttpResponse({ body: new Blob(['%PDF']) })));
    spyOn(URL, 'createObjectURL').and.returnValue('blob:x');
    c.indir(BarkodEtiketBicimi.Pdf);
    const [adres, govde] = api.downloadPostFileResponse.calls.mostRecent().args;
    expect(adres).toBe(API.BARKOD_ETIKET.SANDIK_ETIKETLERI(45));
    expect(govde).toEqual({ bicim: BarkodEtiketBicimi.Pdf, yil: 2026, ay: 9, secimler: [{ sandikId: 723, adet: 3 }] });
  });

  /** Blob.text() ve yazdırma servisi tarayıcının kendi async işlemleridir; çıktı bitene kadar beklenir. */
  async function ciktiBitsin(c: BarkodEtiketComponent): Promise<void> {
    for (let i = 0; i < 50 && c.olusturuluyor() !== null; i++) await new Promise(r => setTimeout(r, 5));
  }

  it('Yazdır: QZ Tray yoksa uyarı vermeden PDF dosyasını indirmeden yazdırma penceresine verir', async () => {
    const fixture = kur({ projeId: '45' });
    const c = fixture.componentInstance;
    const toast = TestBed.inject(ToastService) as jasmine.SpyObj<ToastService>;
    qz.yazicilar.and.rejectWith(new QzTrayCalismiyorHatasi());
    c.sandikSecimDegistir(sandik(723, '8'), true);
    const pdf = new Blob(['%PDF'], { type: 'application/pdf' });
    api.downloadPostFileResponse.and.returnValue(of(new HttpResponse({ body: pdf })));
    const indirme = spyOn(URL, 'createObjectURL').and.returnValue('blob:x');

    await c.yazdir();
    await ciktiBitsin(c);
    const [adres, govde] = api.downloadPostFileResponse.calls.mostRecent().args as [string, { bicim: BarkodEtiketBicimi }];
    expect(adres).toBe(API.BARKOD_ETIKET.SANDIK_ETIKETLERI(45));
    expect(govde.bicim).toBe(BarkodEtiketBicimi.Pdf);
    expect(yazici.yazdir).toHaveBeenCalledOnceWith(pdf);
    expect(qz.hamGonder).not.toHaveBeenCalled();
    expect(indirme).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(c.qzDurum()).toBe('yok');
    // QZ Tray bir kez bulunamayınca sonraki Yazdır'da yeniden yoklanmaz.
    await c.yazdir();
    expect(qz.yazicilar).toHaveBeenCalledTimes(1);
  });

  it('Yazdır: QZ Tray listesindeki tek Godex seçilir, EZPL metni o yazıcıya ham gider, seçim sekme başına hatırlanır', async () => {
    const fixture = kur({ projeId: '45' });
    const c = fixture.componentInstance;
    c.sandikSecimDegistir(sandik(723, '8'), true);
    const ezpl = '^Q75,3\r\n^L\r\nE\r\n';
    api.downloadPostFileResponse.and.returnValue(of(new HttpResponse({ body: new Blob([ezpl]) })));

    await c.yazdir();
    await ciktiBitsin(c);
    const [adres, govde] = api.downloadPostFileResponse.calls.mostRecent().args as [string, { bicim: BarkodEtiketBicimi }];
    expect(adres).toBe(API.BARKOD_ETIKET.SANDIK_ETIKETLERI(45));
    expect(govde.bicim).toBe(BarkodEtiketBicimi.Ezpl);
    expect(qz.hamGonder).toHaveBeenCalledOnceWith('Godex Sandık', ezpl);
    expect(yazici.yazdir).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem(QZ_YAZICI_ANAHTARI)!)).toEqual({ sandik: 'Godex Sandık' });
    // Ürün sekmesinin yazıcısı ayrıdır; henüz seçilmedi.
    c.sekmeSec('urun');
    expect(c.qzYazici()).toBe('');
    localStorage.removeItem(QZ_YAZICI_ANAHTARI);
  });

  it('Yazdır: kullanıcı "Yazdırma penceresi"ni seçtiyse Godex olsa da PDF penceresi açılır ve seçim korunur', async () => {
    const fixture = kur({ projeId: '45' });
    const c = fixture.componentInstance;
    c.sandikSecimDegistir(sandik(723, '8'), true);
    await c.qzYazicilariniGetir();
    expect(c.qzYazici()).toBe('Godex Sandık');
    c.qzYaziciSec('');
    // Liste yenilense de bilerek seçilen pencere yolu değişmez.
    await c.qzYazicilariniGetir();
    expect(c.qzYazici()).toBe('');
    const pdf = new Blob(['%PDF'], { type: 'application/pdf' });
    api.downloadPostFileResponse.and.returnValue(of(new HttpResponse({ body: pdf })));

    await c.yazdir();
    await ciktiBitsin(c);
    expect(yazici.yazdir).toHaveBeenCalledOnceWith(pdf);
    expect(qz.hamGonder).not.toHaveBeenCalled();
    localStorage.removeItem(QZ_YAZICI_ANAHTARI);
  });

  it('Yazdır: QZ Tray gönderim anında kapandıysa hata yerine yazdırma penceresine geçer', async () => {
    const fixture = kur({ projeId: '45' });
    const c = fixture.componentInstance;
    const toast = TestBed.inject(ToastService) as jasmine.SpyObj<ToastService>;
    qz.hamGonder.and.rejectWith(new QzTrayCalismiyorHatasi());
    c.sandikSecimDegistir(sandik(723, '8'), true);
    api.downloadPostFileResponse.and.returnValue(of(new HttpResponse({ body: new Blob(['x']) })));

    await c.yazdir();
    for (let i = 0; i < 50 && !yazici.yazdir.calls.count(); i++) await new Promise(r => setTimeout(r, 5));
    expect(yazici.yazdir).toHaveBeenCalledTimes(1);
    expect(toast.error).not.toHaveBeenCalled();
    expect(c.qzDurum()).toBe('yok');
    expect((api.downloadPostFileResponse.calls.mostRecent().args[1] as { bicim: BarkodEtiketBicimi }).bicim).toBe(BarkodEtiketBicimi.Pdf);
    localStorage.removeItem(QZ_YAZICI_ANAHTARI);
  });

  it('tümünü seç bütün sayfaları seçer (yalnız görünen sayfayı değil); ikinci tıklama bırakır; seçim sınırı aşılmaz', async () => {
    const fixture = kur({ projeId: '45' });
    const c = fixture.componentInstance;
    const toast = TestBed.inject(ToastService) as jasmine.SpyObj<ToastService>;
    // 130 sandıklık proje: 100'erli iki sayfa (ekranda 25'lik ilk sayfa görünür).
    const tumu = Array.from({ length: 130 }, (_, i) => sandik(1000 + i, String(i + 1)));
    const sayfali = (sayfaNo: number, boyut: number): PaginatedList<BarkodEtiketSandikSatiri> => {
      const toplamSayfa = Math.ceil(tumu.length / boyut);
      return {
        items: tumu.slice((sayfaNo - 1) * boyut, sayfaNo * boyut), pageNumber: sayfaNo, pageSize: boyut, totalCount: tumu.length,
        totalPages: toplamSayfa, hasPreviousPage: sayfaNo > 1, hasNextPage: sayfaNo < toplamSayfa,
      };
    };
    api.get.and.callFake(((url: string, secenek?: { params: HttpParams }) => url === API.BARKOD_ETIKET.SANDIKLAR(45)
      ? of({ isSuccess: true, value: sayfali(Number(secenek!.params.get('sayfa')), Number(secenek!.params.get('boyut'))) })
      : of({ isSuccess: true, value: proje })) as any);
    c.sayfaDegisti(1);
    expect(c.sandiklar()!.items.length).toBe(25);
    expect(c.tumuSecili()).toBeFalse();

    api.get.calls.reset();
    await c.tumunuSec();
    expect(c.sandikSecimleri().size).toBe(130);
    expect(c.tumuSecili()).toBeTrue();
    const istenenSayfalar = api.get.calls.all()
      .map(cagri => (cagri.args[1] as { params?: HttpParams } | undefined)?.params)
      .filter(p => p?.get('boyut') === '100').map(p => p!.get('sayfa'));
    expect(istenenSayfalar).toEqual(['1', '2']);

    // Bir satır kaldırılınca kutu boşalır; tekrar tıklanınca hepsi seçilir, bir daha tıklanınca bu süzgeçtekiler bırakılır.
    c.sandikSecimDegistir(tumu[129], false);
    expect(c.tumuSecili()).toBeFalse();
    await c.tumunuSec();
    expect(c.sandikSecimleri().size).toBe(130);
    await c.tumunuSec();
    expect(c.sandikSecimleri().size).toBe(0);

    // Seçim sayısının sınırı yok: 253 sandığın hepsi seçilir ve yazdırılabilir.
    tumu.push(...Array.from({ length: 123 }, (_, i) => sandik(2000 + i, String(200 + i))));
    await c.tumunuSec();
    expect(c.sandikSecimleri().size).toBe(253);
    expect(c.olusturulabilir()).toBeTrue();
    expect(toast.info).not.toHaveBeenCalled();

    // Yalnız tek dosyadaki etiket toplamı (1000) aşılmaz; kullanıcıya söylenir.
    await c.tumunuSec();
    tumu.push(...Array.from({ length: 800 }, (_, i) => sandik(5000 + i, String(500 + i))));
    await c.tumunuSec();
    expect(c.sandikSecimleri().size).toBe(1000);
    expect(c.etiketSayisi()).toBe(1000);
    expect(toast.info).toHaveBeenCalled();
  });

  it('ürün sekmesi: basılamayan barkod seçilmez, tümünü seç yalnız basılabilenleri alır; remarks ve EZPL gider', async () => {
    const fixture = kur({ projeId: '45', tur: 'urun' });
    const c = fixture.componentInstance;
    expect(c.sekme()).toBe('urun');
    await c.tumunuSec();
    expect(c.urunSecimleri().size).toBe(2);
    c.urunSecimDegistir(urun(2, BarkodEtiketUrunKaynagi.CekiSatiri, null), true);
    expect(c.urunSecimleri().size).toBe(2);

    const tekerlek = urun(1, BarkodEtiketUrunKaynagi.CekiSatiri, '00000FCT00967433');
    c.adediMiktarYap(tekerlek);
    c.urunRemarksDegisti(urun(1, BarkodEtiketUrunKaynagi.SandikIcerik, '0000000FC4324042'), '  ');
    api.downloadPostFileResponse.and.returnValue(of(new HttpResponse({ body: new Blob(['^Q40,3']) })));
    spyOn(URL, 'createObjectURL').and.returnValue('blob:x');
    // İndir menüsündeki "Godex dosyası (.prn)" seçeneği.
    c.indir(BarkodEtiketBicimi.Ezpl);
    const [adres, govde] = api.downloadPostFileResponse.calls.mostRecent().args;
    expect(adres).toBe(API.BARKOD_ETIKET.URUN_ETIKETLERI(45));
    expect(govde).toEqual({
      bicim: BarkodEtiketBicimi.Ezpl,
      secimler: [
        { kaynak: BarkodEtiketUrunKaynagi.CekiSatiri, id: 1, adet: 4, remarks: '38.39' },
        { kaynak: BarkodEtiketUrunKaynagi.SandikIcerik, id: 1, adet: 1, remarks: null },
      ],
    });

    // Sandıkla süzülmüş bölünmüş satırda "= miktar" o sandıktaki tahsisi alır (istenen 4, sandıkta 2).
    const bolunmus = urun(1, BarkodEtiketUrunKaynagi.CekiSatiri, '00000FCT00967433', 4, 2);
    c.adediMiktarYap(bolunmus);
    expect(c.urunAdedi(bolunmus)).toBe(2);

    // Tümünü seç ikinci kez tıklanınca seçilenleri kaldırır.
    await c.tumunuSec();
    expect(c.urunSecimleri().size).toBe(0);
  });
});
