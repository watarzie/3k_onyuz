import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ProjeTipi } from '../../core/constants/enums';
import { YETKI } from '../../core/constants/yetki-kodlari';
import { PermissionService } from '../../core/services/permission.service';
import { GenelAramaSonucu } from '../../shared/models';
import { GenelAramaComponent } from './genel-arama.component';
import { GenelAramaService, projeRotasi, sandikRotasi, urunRotasi } from './genel-arama';

describe('Genel arama (üst çubuk)', () => {
  const sonuc: GenelAramaSonucu = {
    q: 'PA7', projeAranabilir: true, sandikAranabilir: true, urunAranabilir: false,
    projeler: [
      { id: 10, projeNo: 'PA727-03', musteri: 'GCA', projeTipiId: ProjeTipi.Normal, durumMetni: 'Hazırlanıyor', sandikSayisi: 4 },
      { id: 11, projeNo: 'PA727-03-SAHA', musteri: 'GCA', projeTipiId: ProjeTipi.Saha, durumMetni: null, sandikSayisi: 1 },
    ],
    urunler: [{ barkod: 'FC1', aciklama: 'Gizli', projeSayisi: 1 }],
    sandiklar: [{ id: 5, sandikNo: '7', ad: 'Aksesuar', projeId: 10, projeNo: 'PA727-03', projeTipiId: ProjeTipi.Normal }],
  };
  let service: jasmine.SpyObj<GenelAramaService>;
  const izinler = new Set<string>();

  function kur() {
    service = jasmine.createSpyObj<GenelAramaService>('GenelAramaService', ['ara']);
    service.ara.and.returnValue(of({ isSuccess: true, value: sonuc }));
    TestBed.configureTestingModule({
      imports: [GenelAramaComponent],
      providers: [
        provideRouter([]),
        { provide: GenelAramaService, useValue: service },
        { provide: PermissionService, useValue: { hasAccess: (k: string) => izinler.has(k) } },
      ],
    });
    const fixture = TestBed.createComponent(GenelAramaComponent);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => izinler.clear());

  it('rotalar izne göre: proje sandık listesine, yoksa Grid/3K ekranına; sandık detaya; barkod barkod aramaya', () => {
    const var_ = (k: string) => izinler.has(k);
    izinler.add(YETKI.SANDIK.YONETIMI);
    expect(projeRotasi({ id: 10, projeTipiId: ProjeTipi.Normal }, var_)).toEqual(['/sandik-yonetimi', 10]);
    expect(sandikRotasi({ id: 5, projeId: 10, projeTipiId: ProjeTipi.Normal }, var_)).toEqual(['/sandik-yonetimi', 10, 5]);
    expect(projeRotasi({ id: 11, projeTipiId: ProjeTipi.Saha }, var_)).toBeNull();
    izinler.add(YETKI.SAHA.UCK_MODULU);
    expect(projeRotasi({ id: 11, projeTipiId: ProjeTipi.Saha }, var_)).toEqual(['/saha-yonetimi/uck', 11]);
    expect(sandikRotasi({ id: 6, projeId: 11, projeTipiId: ProjeTipi.Saha }, var_)).toEqual(['/saha-yonetimi/uck', 'sandik', 11, 6]);
    expect(urunRotasi({ barkod: 'FC1' })).toEqual({ commands: ['/barkod-arama'], queryParams: { barkod: 'FC1' } });
  });

  it('en az iki karakterle arar; yalnız aranabilen grupları gösterir, izni olmayan sonuç tıklanamaz', fakeAsync(() => {
    izinler.add(YETKI.SANDIK.YONETIMI);
    const fixture = kur();
    const c = fixture.componentInstance;
    c.yazildi('P');
    tick(300);
    expect(service.ara).not.toHaveBeenCalled();

    c.yazildi(' PA7 ');
    tick(300);
    fixture.detectChanges();
    expect(service.ara).toHaveBeenCalledOnceWith(' PA7 ');
    const el = fixture.nativeElement as HTMLElement;
    expect(Array.from(el.querySelectorAll('.ga__grup-baslik')).map(e => e.textContent?.trim())).toEqual(['Projeler', 'Sandıklar']);
    const ogeler = Array.from(el.querySelectorAll<HTMLButtonElement>('.ga__oge'));
    expect(ogeler.map(o => o.querySelector('strong')?.textContent?.trim())).toEqual(['PA727-03', 'PA727-03-SAHA', 'PA727-03 · Sandık 7']);
    expect(ogeler[1].disabled).toBeTrue();
    // Klavyede yalnız tıklanabilen sonuçlar gezilir.
    expect(c.secilebilir().map(o => o.anahtar)).toEqual(['p-10', 's-5']);
  }));

  it('ok tuşu ve Enter seçili sonuca, seçili yoksa tam sonuç sayfasına götürür; Ctrl+K kutuya odaklanır', fakeAsync(() => {
    izinler.add(YETKI.SANDIK.YONETIMI);
    const fixture = kur();
    const c = fixture.componentInstance;
    const router = TestBed.inject(Router);
    const git = spyOn(router, 'navigate').and.resolveTo(true);
    c.yazildi('PA7');
    tick(300);
    fixture.detectChanges();

    c.tusBasildi(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    c.tusBasildi(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    c.tusBasildi(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(git).toHaveBeenCalledWith(['/sandik-yonetimi', 10, 5], { queryParams: undefined });

    c.aktif.set(-1);
    c.tusBasildi(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(git).toHaveBeenCalledWith(['/arama'], { queryParams: { q: 'PA7' } });

    document.body.appendChild(fixture.nativeElement);
    const girdi = (fixture.nativeElement as HTMLElement).querySelector('input') as HTMLInputElement;
    girdi.blur();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
    expect(document.activeElement).toBe(girdi);
    (fixture.nativeElement as HTMLElement).remove();
  }));
});
