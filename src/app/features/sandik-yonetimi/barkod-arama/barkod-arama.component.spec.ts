import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { HttpHeaders, HttpParams, HttpResponse } from '@angular/common/http';
import { of } from 'rxjs';
import { API } from '../../../core/constants/api-endpoints';
import { ProjeTipi } from '../../../core/constants/enums';
import { YETKI } from '../../../core/constants/yetki-kodlari';
import { BaseApiService } from '../../../core/services/base-api.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ToastService } from '../../../core/services/toast.service';
import { BarkodUrunAramaSonucu, BarkodUrunSatiri } from '../../../shared/models';
import { BarkodAramaComponent } from './barkod-arama.component';

describe('Barkodla ürün arama', () => {
  let api: jasmine.SpyObj<BaseApiService>;
  let permissions: jasmine.SpyObj<PermissionService>;

  const satir = (projeId: number, tip: ProjeTipi, eksik: number, ek: Partial<BarkodUrunSatiri> = {}): BarkodUrunSatiri => ({
    projeId, projeNo: `PA-${projeId}`, projeTipiId: tip, projeTipi: 'Normal', musteri: 'GCA', projeDurumu: 'Hazırlanıyor',
    sandikNo: '3, 10', siraNo: 2, pozNo: null, aciklama: 'Kablo Bağı', birim: 'Adet', istenen: 10, gridGelen: 4, ucKGelen: 4,
    eksik, gridDurumu: 'Eksik Geldi', ucKDurumu: 'Bekliyor', sevkDurumu: 'Sevk Edilmedi', elleEklenen: false, ...ek,
  });
  const sonuc = (satirlar: BarkodUrunSatiri[]): BarkodUrunAramaSonucu => ({
    barkod: 'FC1', aciklama: 'Kablo Bağı', yalnizEksikler: true, projeTipiId: null, olusturmaTarihi: '2026-10-24T10:00:00',
    satirlar, toplamSatir: 5, projeSayisi: 4, eksikSatir: 2, eksikProjeSayisi: 2, toplamEksik: 9, sinirli: false,
    filtreliSatir: satirlar.length, sayfa: 1, sayfaBoyutu: 25, toplamSayfa: 1,
  });

  function kur(sorgu: Record<string, string> = {}, gridIzinleri: string[] = [YETKI.SANDIK.GRID_MODULU]) {
    api = jasmine.createSpyObj<BaseApiService>('BaseApiService', ['get', 'downloadFileResponse', 'downloadErrorMessage']);
    api.get.and.returnValue(of({ isSuccess: true, value: sonuc([satir(10, ProjeTipi.Normal, 6), satir(11, ProjeTipi.Saha, 3)]) }) as any);
    permissions = jasmine.createSpyObj<PermissionService>('PermissionService', ['hasAccess']);
    permissions.hasAccess.and.callFake((kod: string) => gridIzinleri.includes(kod));
    TestBed.configureTestingModule({
      imports: [BarkodAramaComponent],
      providers: [
        provideRouter([]),
        { provide: BaseApiService, useValue: api },
        { provide: PermissionService, useValue: permissions },
        { provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['error', 'success']) },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(sorgu) } } },
      ],
    });
    spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    const fixture = TestBed.createComponent(BarkodAramaComponent);
    fixture.detectChanges();
    return fixture;
  }

  function sonParametreler(): HttpParams {
    return (api.get.calls.mostRecent().args[1] as { params: HttpParams }).params;
  }

  it('boş barkodla aramaz; yazılan barkodu kırpıp varsayılan yalnız eksiklerle arar', () => {
    const fixture = kur();
    const c = fixture.componentInstance;
    expect(api.get).not.toHaveBeenCalled();
    expect(c.aranabilir()).toBeFalse();

    c.barkodTaslak.set('  fc1 ');
    c.ara();
    expect(api.get.calls.mostRecent().args[0]).toBe(API.BARKOD_ARAMA.ARA);
    expect(sonParametreler().get('barkod')).toBe('fc1');
    expect(sonParametreler().get('yalnizEksikler')).toBe('true');
    expect(sonParametreler().has('projeTipiId')).toBeFalse();
  });

  it('adresteki barkodla açılır; satırlar proje no ile listelenir, Grid bağlantısı yalnız izinli tipte', () => {
    const fixture = kur({ barkod: 'FC1', tumu: '1', tip: String(ProjeTipi.Saha) });
    fixture.detectChanges();
    expect(sonParametreler().get('yalnizEksikler')).toBe('false');
    expect(sonParametreler().get('projeTipiId')).toBe(String(ProjeTipi.Saha));

    const satirlar = (fixture.nativeElement as HTMLElement).querySelectorAll('.ba-tablo tbody tr');
    expect(satirlar.length).toBe(2);
    expect(satirlar[0].classList).toContain('is-eksik');
    // Normal proje: Grid modülü izni var → bağlantı; Saha: saha Grid izni yok → düz metin.
    expect(satirlar[0].querySelector('.ba-proje a')?.textContent?.trim()).toBe('PA-10');
    expect(satirlar[1].querySelector('.ba-proje a')).toBeNull();
    expect(satirlar[1].querySelector('.ba-proje strong')?.textContent?.trim()).toBe('PA-11');
    // Proje tipi kendi rozetinde; proje, Grid, 3K ve Sevk durumları uygulamanın durum rozetleriyle renkli.
    expect(satirlar[1].querySelector('.ba-tip')?.getAttribute('data-tip')).toBe(String(ProjeTipi.Saha));
    const rozetler = Array.from(satirlar[0].querySelectorAll('app-status-badge .badge')).map(b => [b.textContent?.trim(), b.className]);
    expect(rozetler.map(r => r[0])).toEqual(['Hazırlanıyor', 'Eksik Geldi', 'Bekliyor', 'Sevk Edilmedi']);
    expect(rozetler[1][1]).toContain('badge-warning');
  });

  it('sevk metni rozet rengine çevrilir: edildi/trafoyla mavi, eksik sevk sarı, edilmedi gri', () => {
    const c = kur().componentInstance;
    expect(['Sevk Edildi', 'Trafoyla', 'Eksik Sevk (2/5)', 'Sevk Edilmedi', '-'].map(m => c.sevkRozeti(m)))
      .toEqual(['Sevk Edildi', 'Sevk Edildi', 'Eksik', 'Bekliyor', 'Bekliyor']);
  });

  it('süzgeç değişince son barkodla yeniden arar; rapor son aramanın ölçütleriyle iner', () => {
    const fixture = kur({ barkod: 'FC1' });
    const c = fixture.componentInstance;
    c.barkodTaslak.set('FC1');
    c.yalnizEksiklerDegisti(false);
    expect(sonParametreler().get('yalnizEksikler')).toBe('false');
    c.projeTipiDegisti(String(ProjeTipi.Yedek));
    expect(sonParametreler().get('projeTipiId')).toBe(String(ProjeTipi.Yedek));

    api.downloadFileResponse.and.returnValue(of(new HttpResponse({
      body: new Blob(['x']), headers: new HttpHeaders({ 'Content-Disposition': 'attachment; filename=BarkodArama_FC1.xlsx' }),
    })));
    spyOn(URL, 'createObjectURL').and.returnValue('blob:x');
    c.raporIndir('excel');
    const [adres, secenek] = api.downloadFileResponse.calls.mostRecent().args as [string, { params: HttpParams }];
    expect(adres).toBe(API.BARKOD_ARAMA.RAPOR('excel'));
    expect(secenek.params.get('barkod')).toBe('FC1');
    expect(secenek.params.get('projeTipiId')).toBe(String(ProjeTipi.Yedek));
  });

  it('sunucu sayfalaması: sayfa ve boyut istekte gider, özet kartları bütün sonucundur, rapor sayfasız iner', () => {
    const fixture = kur();
    api.get.and.returnValue(of({ isSuccess: true, value: {
      ...sonuc([satir(10, ProjeTipi.Normal, 6)]), filtreliSatir: 60, sayfa: 2, sayfaBoyutu: 25, toplamSayfa: 3, projeSayisi: 126,
    } }) as any);
    const c = fixture.componentInstance;
    c.barkodTaslak.set('FC1');
    c.ara();
    expect(sonParametreler().get('sayfa')).toBe('1');
    expect(sonParametreler().get('boyut')).toBe('25');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    // Kart bütün sonucun proje sayısı; sayfalayıcı süzülen satır sayısını gösterir.
    expect(el.querySelector('app-stat-card')?.textContent).toContain('126');
    expect(el.querySelector('app-server-pager')?.textContent).toContain('/ 60');

    c.sayfaDegisti(3);
    expect(sonParametreler().get('sayfa')).toBe('3');
    c.boyutDegisti(50);
    expect([sonParametreler().get('sayfa'), sonParametreler().get('boyut')]).toEqual(['1', '50']);

    api.downloadFileResponse.and.returnValue(of(new HttpResponse({ body: new Blob(['x']) })));
    spyOn(URL, 'createObjectURL').and.returnValue('blob:x');
    c.raporIndir('pdf');
    const [, secenek] = api.downloadFileResponse.calls.mostRecent().args as [string, { params: HttpParams }];
    expect(secenek.params.has('sayfa')).toBeFalse();
  });

  it('proje / müşteri süzgeci gecikmeyle sunucuya gider, ilk sayfaya döner ve rapora da girer', fakeAsync(() => {
    const fixture = kur({ barkod: 'FC1', proje: 'PA7', sayfa: '2' });
    const c = fixture.componentInstance;
    expect(sonParametreler().get('projeArama')).toBe('PA7');
    expect(sonParametreler().get('sayfa')).toBe('2');

    c.projeAramaDegisti(' GCA ');
    expect(sonParametreler().get('projeArama')).toBe('PA7');
    tick(300);
    expect(sonParametreler().get('projeArama')).toBe('GCA');
    expect(sonParametreler().get('sayfa')).toBe('1');

    api.downloadFileResponse.and.returnValue(of(new HttpResponse({ body: new Blob(['x']) })));
    spyOn(URL, 'createObjectURL').and.returnValue('blob:x');
    c.raporIndir('excel');
    const [, secenek] = api.downloadFileResponse.calls.mostRecent().args as [string, { params: HttpParams }];
    expect(secenek.params.get('projeArama')).toBe('GCA');
  }));

  it('satırı olmayan barkodda bilgi gösterir', () => {
    const fixture = kur();
    api.get.and.returnValue(of({ isSuccess: true, value: { ...sonuc([]), toplamSatir: 0 } }) as any);
    fixture.componentInstance.barkodTaslak.set('YOK');
    fixture.componentInstance.ara();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Bu barkod hiçbir projede yok.');
  });
});
