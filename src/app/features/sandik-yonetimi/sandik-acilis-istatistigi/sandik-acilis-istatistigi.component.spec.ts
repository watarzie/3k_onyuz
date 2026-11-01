import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { HttpParams } from '@angular/common/http';
import { of } from 'rxjs';
import { SandikAcilisIstatistigiComponent, gunMetni, hazirAralik, oran } from './sandik-acilis-istatistigi.component';
import { BaseApiService } from '../../../core/services/base-api.service';
import { ToastService } from '../../../core/services/toast.service';
import { API } from '../../../core/constants/api-endpoints';
import { PaginatedList, SandikDurumIstatistigi, SandikDurumOlayKaynagi, SandikDurumOlayTuru } from '../../../shared/models';

describe('Sandık açılış/kapanış istatistiği', () => {
  const sonuc: SandikDurumIstatistigi = {
    kriter: {}, olusturmaTarihi: '2026-10-24T10:00:00',
    ozet: {
      kapanmaSayisi: 12, topluKapanmaSayisi: 3, otomatikKapanmaSayisi: 1, acilmaSayisi: 5, elleAcilmaSayisi: 3,
      otomatikAcilmaSayisi: 1, gecmistenAktarilanAcilmaSayisi: 1, acilanSandikSayisi: 4, projeSayisi: 260,
      musteriSayisi: 52, kisiSayisi: 7, olaySayisi: 17,
    },
    sebepler: [{ sebepId: 1, sebep: 'Trafo kurulum', sayi: 2 }, { sebepId: null, sebep: 'Sebepsiz – Otomatik', sayi: 1 }],
    enCokAcilanlar: [{ projeId: 1, projeNo: 'PA600', musteri: 'M', sandikNo: '4', acilmaSayisi: 3, elleAcilmaSayisi: 2, kapanmaSayisi: 4, sonAcilma: '2026-10-23T09:05:00' }],
  };
  const sayfa = <T>(items: T[], pageNumber = 1, totalCount = 260, pageSize = 25): PaginatedList<T> => ({
    items, pageNumber, pageSize, totalCount, totalPages: Math.ceil(totalCount / pageSize),
    hasPreviousPage: pageNumber > 1, hasNextPage: pageNumber * pageSize < totalCount,
  });
  let api: jasmine.SpyObj<BaseApiService>;

  beforeEach(() => {
    api = jasmine.createSpyObj('BaseApiService', ['get', 'downloadFileResponse', 'downloadErrorMessage']);
    api.get.and.callFake(((url: string, secenek: { params: HttpParams }) => {
      if (url === API.SANDIK_ISTATISTIK.GETIR) return of({ isSuccess: true, value: sonuc });
      if (url === API.SANDIK_ISTATISTIK.PROJELER) {
        const no = Number(secenek.params.get('sayfa'));
        return of({ isSuccess: true, value: sayfa([{ projeId: no, projeNo: `PA${no}`, musteri: 'M', kapanmaSayisi: 1, acilmaSayisi: 1, elleAcilmaSayisi: 1, acilanSandikSayisi: 1 }], no) });
      }
      if (url === API.SANDIK_ISTATISTIK.OLAYLAR) {
        return of({ isSuccess: true, value: sayfa([{
          id: 9, projeId: 1, projeNo: 'PA600', musteri: 'M', sandikNo: '4', tur: SandikDurumOlayTuru.Acildi, turMetni: 'Geri açıldı',
          kaynak: SandikDurumOlayKaynagi.Elle, kaynakMetni: 'Elle', yeniDurumMetni: 'Hazırlanıyor', sebepMetni: 'Tadilat', kullaniciAdi: 'Ali',
          tarih: '2026-10-23T09:05:00',
        }], 1, 17) });
      }
      return of({ isSuccess: true, value: sayfa([], 1, 0) });
    }) as never);
    TestBed.configureTestingModule({
      imports: [SandikAcilisIstatistigiComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({ proje: 'PA600', baslangic: '2026-10-01' }) } } },
        { provide: BaseApiService, useValue: api },
        { provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['error']) },
      ],
    });
    spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
  });

  function render() {
    const fixture = TestBed.createComponent(SandikAcilisIstatistigiComponent);
    fixture.detectChanges();
    return { fixture, c: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
  }

  const istekler = (url: string) => api.get.calls.all().filter(c => c.args[0] === url).map(c => (c.args[1] as { params: HttpParams }).params);

  it('adres çubuğundaki süzgeçle yalnız özeti yükler; sekme sayıları özetten gelir', () => {
    const { el } = render();
    const [ozet] = istekler(API.SANDIK_ISTATISTIK.GETIR);
    expect(ozet.get('projeArama')).toBe('PA600');
    expect(ozet.get('baslangic')).toBe('2026-10-01');
    expect(ozet.has('bitis')).toBeFalse();
    expect(istekler(API.SANDIK_ISTATISTIK.PROJELER).length).toBe(0);
    expect(el.querySelector('.sai-sekme--projeler .sai-sayac')!.textContent).toContain('260');
    expect(el.querySelector('.sai-sekme--musteriler .sai-sayac')!.textContent).toContain('52');
    expect(el.querySelector('.sai-kirilim')!.textContent).toContain('elle 3 · otomatik 1 · geçmişten 1');
    expect(el.querySelectorAll('.sai-cubuklar li').length).toBe(2);
    expect(el.querySelector('.sai-en-cok .sai-tarih')!.textContent).toContain('23.10.2026');
    expect(el.querySelector('.sai-en-cok .sai-tarih')!.textContent).toContain('09:05');
  });

  it('proje sekmesi açılınca ilk sayfayı, sayfalayıcıyla sonraki sayfayı aynı süzgeçle sunucudan ister', () => {
    const { fixture, c, el } = render();
    c.sekmeSec('projeler');
    fixture.detectChanges();
    let [ilk] = istekler(API.SANDIK_ISTATISTIK.PROJELER);
    expect([ilk.get('sayfa'), ilk.get('boyut'), ilk.get('projeArama')]).toEqual(['1', '25', 'PA600']);
    expect(el.querySelector('.sai-projeler')!.textContent).toContain('PA1');
    expect(el.querySelector('app-server-pager')).not.toBeNull();

    c.sayfaDegisti(c.projeler, 3);
    fixture.detectChanges();
    const son = istekler(API.SANDIK_ISTATISTIK.PROJELER).at(-1)!;
    expect(son.get('sayfa')).toBe('3');
    expect(el.querySelector('.sai-projeler')!.textContent).toContain('PA3');

    // Sekmeye dönmek yeniden istemez; boyut değişince ilk sayfaya döner.
    c.sekmeSec('ozet');
    c.sekmeSec('projeler');
    expect(istekler(API.SANDIK_ISTATISTIK.PROJELER).length).toBe(2);
    c.boyutDegisti(c.projeler, 50);
    [ilk] = istekler(API.SANDIK_ISTATISTIK.PROJELER).slice(-1);
    expect([ilk.get('sayfa'), ilk.get('boyut')]).toEqual(['1', '50']);
  });

  it('olay tablosu Hareket Geçmişi düzeninde: tarih/saat, kullanıcı avatarı, olay hapı ve sebep', () => {
    const { fixture, c, el } = render();
    c.sekmeSec('olaylar');
    fixture.detectChanges();
    const satir = el.querySelector('.sai-olaylar tbody tr')!;
    expect(satir.querySelector('.sai-tarih')!.textContent).toContain('23.10.2026');
    expect(satir.querySelector('.sai-avatar')!.textContent!.trim()).toBe('A');
    expect(satir.querySelector('.sai-hap[data-ton="warning"]')!.textContent).toContain('Geri açıldı');
    expect(satir.textContent).toContain('Tadilat');
    expect(c.basHarf(null)).toBe('S');
  });

  it('süzgeç uygulanınca tablolar başa döner ve açık sekme yeniden yüklenir', () => {
    const { c } = render();
    c.sekmeSec('olaylar');
    c.sayfaDegisti(c.olaylar, 2);
    c.musteri.set('Örnek');
    c.getir();
    const son = istekler(API.SANDIK_ISTATISTIK.OLAYLAR).at(-1)!;
    expect([son.get('sayfa'), son.get('musteri')]).toEqual(['1', 'Örnek']);
    expect(c.projeler.veri()).toBeNull();
  });

  it('başlangıç bitişten sonraysa istek göndermez', () => {
    const { c } = render();
    api.get.calls.reset();
    c.baslangic.set('2026-10-10');
    c.bitis.set('2026-10-01');
    c.getir();
    expect(c.tarihHatali()).toBeTrue();
    expect(api.get).not.toHaveBeenCalled();
  });

  it('hazır aralıklar ve sebep çubuğu oranı', () => {
    const bugun = new Date(2026, 9, 24);
    expect(hazirAralik('30', bugun)).toEqual({ baslangic: '2026-09-25', bitis: '2026-10-24' });
    expect(hazirAralik('yil', bugun)).toEqual({ baslangic: '2026-01-01', bitis: '2026-10-24' });
    expect(hazirAralik('tumu', bugun)).toEqual({ baslangic: '', bitis: '' });
    expect(gunMetni(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(oran(1, 4)).toBe(25);
    expect(oran(0, 0)).toBe(0);
  });
});
