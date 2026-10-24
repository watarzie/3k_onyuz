import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { of } from 'rxjs';
import { SahadanSahayaTasimaComponent } from './sahadan-sahaya-tasima.component';
import { ProjeService } from '../../../core/services/proje.service';
import { SandikService } from '../../../core/services/sandik.service';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { TranslationService } from '../../../core/services/translation.service';
import { ProjeTipi, ProjeDurum, SandikDurum } from '../../../core/constants/enums';
import { ApiResult, SahadanSahayaTasimaOnizlemeDto, SahadanSahayaTasimaSonucDto, SandikDto } from '../../../shared/models';

describe('Sahadan sahaya taşıma penceresi', () => {
  let fixture: ComponentFixture<SahadanSahayaTasimaComponent>;
  let projeService: jasmine.SpyObj<ProjeService>;
  let sandikService: jasmine.SpyObj<SandikService>;
  let toast: jasmine.SpyObj<ToastService>;
  let confirm: jasmine.SpyObj<ConfirmService>;

  const onizleme = (degisiklik: Partial<SahadanSahayaTasimaOnizlemeDto> = {}): SahadanSahayaTasimaOnizlemeDto => ({
    kaynakSahaProjeNo: 'PA723-01-SAHA',
    hedefSahaProjeNo: 'PA573-01-SAHA',
    hedefSandikNo: '3',
    yeniSandik: false,
    numaraDegisti: false,
    tasinabilirMi: true,
    manuelIcerikSayisi: 0,
    toplamMiktar: 4,
    bosalacakSandikNolari: [],
    engeller: [],
    satirlar: [{ sahaCekiSatiriId: 201, kaynakProjeNo: 'PA723-01', siraNo: 1, barkodNo: 'B1', aciklama: 'Bushing', kaynakSandikNo: '1', miktar: 4, konulanAdet: 4, birim: 'Adet' }],
    ...degisiklik,
  });

  beforeEach(() => {
    projeService = jasmine.createSpyObj<ProjeService>('proje', ['getProjeDropdownListesi', 'sahadanSahayaTasimaOnizle', 'sahadanSahayaTasi']);
    projeService.getProjeDropdownListesi.and.returnValue(of({
      isSuccess: true,
      value: [
        { id: 2, projeNo: 'PA723-01-SAHA', musteri: 'M', projeTipiId: ProjeTipi.Saha, durumId: ProjeDurum.Hazirlaniyor },
        { id: 3, projeNo: 'PA573-01-SAHA', musteri: 'M', projeTipiId: ProjeTipi.Saha, durumId: ProjeDurum.Hazirlaniyor },
        { id: 4, projeNo: 'PA100-SAHA', musteri: 'M', projeTipiId: ProjeTipi.Saha, durumId: ProjeDurum.SevkEdildi },
        { id: 5, projeNo: 'PA600-42-SAHA', musteri: 'SONELGAZ', projeTipiId: ProjeTipi.Saha, durumId: ProjeDurum.EksikSevkEdildi },
      ],
    }));
    projeService.sahadanSahayaTasimaOnizle.and.returnValue(of({ isSuccess: true, value: onizleme() }));
    sandikService = jasmine.createSpyObj<SandikService>('sandik', ['getSandiklar']);
    sandikService.getSandiklar.and.returnValue(of({
      isSuccess: true,
      value: [
        { id: 31, sandikNo: '3', durumId: SandikDurum.Hazirlaniyor, urunSayisi: 2 } as SandikDto,
        { id: 32, sandikNo: '4', durumId: SandikDurum.Sevkedildi, urunSayisi: 1 } as SandikDto,
      ],
    }));
    toast = jasmine.createSpyObj<ToastService>('toast', ['success', 'error', 'warning']);
    confirm = jasmine.createSpyObj<ConfirmService>('confirm', ['ask']);
    confirm.ask.and.resolveTo(true);
    TestBed.configureTestingModule({
      imports: [SahadanSahayaTasimaComponent],
      providers: [
        { provide: ProjeService, useValue: projeService },
        { provide: SandikService, useValue: sandikService },
        { provide: ToastService, useValue: toast },
        { provide: ConfirmService, useValue: confirm },
        { provide: TranslationService, useValue: { translate: (key: string) => key } },
      ],
    });
    fixture = TestBed.createComponent(SahadanSahayaTasimaComponent);
    fixture.componentRef.setInput('kaynak', { id: 2, projeNo: 'PA723-01-SAHA' });
    fixture.componentRef.setInput('satirIds', [201]);
    fixture.detectChanges();
  });

  it('hedef listesinde kaynak saha ve tamamen sevk edilmiş sahalar yoktur, eksik sevk edilmiş saha vardır; sevkli hedef sandık seçilemez', () => {
    expect(fixture.componentInstance.hedefProjeler().map(p => p.id)).toEqual([3, 5]);

    fixture.componentInstance.hedefProjeSecildi('3');

    expect(sandikService.getSandiklar).toHaveBeenCalledWith(3);
    expect(fixture.componentInstance.hedefSandiklar().map(s => s.id)).toEqual([31]);
  });

  it('seçimler önizlemeye satır modunda gider; mevcut sandık seçilince yeni numara gönderilmez', () => {
    fixture.componentInstance.hedefProjeSecildi('3');
    fixture.componentInstance.hedefSandikSecildi('31');

    expect(projeService.sahadanSahayaTasimaOnizle).toHaveBeenCalledWith({
      kaynakSahaProjeId: 2,
      sahaCekiSatiriIds: [201],
      kaynakSandikId: null,
      hedefSahaProjeId: 3,
      hedefSandikId: 31,
      yeniSandikNo: null,
    });
  });

  it('yeni numara yazılınca taşıma güncel önizleme gelene kadar kapalıdır; önizleme beklemeli istenir', fakeAsync(() => {
    const c = fixture.componentInstance;
    c.hedefProjeSecildi('3');
    expect(c.tasinabilir()).toBeTrue();
    projeService.sahadanSahayaTasimaOnizle.calls.reset();

    c.yeniSandikNoDegisti('7');
    expect(c.tasinabilir()).toBeFalse();
    expect(projeService.sahadanSahayaTasimaOnizle).not.toHaveBeenCalled();
    tick(400);

    expect(projeService.sahadanSahayaTasimaOnizle).toHaveBeenCalledOnceWith(jasmine.objectContaining({ hedefSandikId: null, yeniSandikNo: '7' }));
    expect(c.tasinabilir()).toBeTrue();
  }));

  it('hedef saha araması sunucuda süzülür ve seçili saha listede tutulur', fakeAsync(() => {
    const c = fixture.componentInstance;
    c.hedefProjeSecildi('3');
    c.hedefAramaDegisti('PA5');
    tick(300);

    expect(projeService.getProjeDropdownListesi).toHaveBeenCalledWith(jasmine.objectContaining({ searchTerm: 'PA5', includeIds: [3] }));
  }));

  it('hedef seçici tek kutudur: arama listenin içindedir, seçim listeyi kapatır, Escape pencereyi kapatmaz', fakeAsync(() => {
    const c = fixture.componentInstance;
    const el = fixture.nativeElement as HTMLElement;
    let kapandi = false;
    c.closed.subscribe(() => (kapandi = true));
    // Ayrı arama kutusu ya da yerel <select> yoktur.
    expect(el.querySelector('select#sst-hedef')).toBeNull();
    expect(el.querySelector('.sst-ara')).toBeNull();

    el.querySelector<HTMLButtonElement>('.sst-combobox__toggle')!.click();
    fixture.detectChanges();
    tick();
    const arama = el.querySelector<HTMLInputElement>('.sst-combobox__search input')!;
    expect(arama).not.toBeNull();
    expect(document.activeElement).toBe(arama);
    expect(Array.from(el.querySelectorAll('.sst-combobox__option span')).map(x => x.textContent?.trim())).toEqual(['PA573-01-SAHA', 'PA600-42-SAHA']);
    expect(el.querySelector('.sst-combobox__hint')?.textContent).toContain('SAHA_TASIMA.TARGET_SHIPPED_HINT');

    arama.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(c.hedefAcik()).toBeFalse();
    expect(kapandi).toBeFalse();

    c.hedefListesiniAcKapat();
    fixture.detectChanges();
    tick();
    el.querySelector<HTMLButtonElement>('.sst-combobox__option')!.click();
    fixture.detectChanges();

    expect(c.hedefAcik()).toBeFalse();
    expect(c.hedefProjeId()).toBe(3);
    expect(sandikService.getSandiklar).toHaveBeenCalledWith(3);
    expect(el.querySelector('.sst-combobox__text strong')?.textContent).toContain('PA573-01-SAHA');

    // Dışarı tıklama listeyi kapatır.
    c.hedefListesiniAcKapat();
    tick();
    document.body.click();
    expect(c.hedefAcik()).toBeFalse();
  }));

  it('engel varsa taşıma kapalıdır ve engeller listelenir', () => {
    projeService.sahadanSahayaTasimaOnizle.and.returnValue(of({ isSuccess: true, value: onizleme({ tasinabilirMi: false, engeller: ['Sandık 1 sevk edilmiş'] }) }));

    fixture.componentInstance.hedefProjeSecildi('3');
    fixture.detectChanges();

    expect(fixture.componentInstance.tasinabilir()).toBeFalse();
    expect(fixture.nativeElement.textContent).toContain('Sandık 1 sevk edilmiş');
  });

  it('onaylanınca sabit işlem anahtarıyla taşır; 409 engelleri pencerede gösterilir', async () => {
    fixture.componentInstance.hedefProjeSecildi('3');
    projeService.sahadanSahayaTasi.and.returnValue(of({ isSuccess: false, statusCode: 409, error: 'Taşıma yapılamadı', issues: ['satır bölünmüş'] } as ApiResult<SahadanSahayaTasimaSonucDto>));

    await fixture.componentInstance.tasi();

    const istek = projeService.sahadanSahayaTasi.calls.mostRecent().args[0];
    expect(istek.islemAnahtari).toBe(fixture.componentInstance.islemAnahtari);
    expect(fixture.componentInstance.engeller()).toEqual(['satır bölünmüş']);
    expect(toast.error).toHaveBeenCalled();
  });

  it('başarılı taşıma sonucu yayar', async () => {
    fixture.componentInstance.hedefProjeSecildi('3');
    const sonuc = { sahaAktarimId: 9, hedefSahaProjeId: 3, hedefSahaProjeNo: 'PA573-01-SAHA', hedefSandikId: 31, hedefSandikNo: '3', tasinanSatirSayisi: 1, tasinanManuelIcerikSayisi: 0, toplamMiktar: 4, bosalanSandikNolari: [] };
    projeService.sahadanSahayaTasi.and.returnValue(of({ isSuccess: true, value: sonuc }));
    let yayilan: SahadanSahayaTasimaSonucDto | undefined;
    fixture.componentInstance.tasindi.subscribe(x => (yayilan = x));

    await fixture.componentInstance.tasi();

    expect(yayilan).toEqual(sonuc);
  });
});
