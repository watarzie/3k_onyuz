import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { OtomatikSahaAktarimComponent } from './otomatik-saha-aktarim.component';
import { ProjeService } from '../../../core/services/proje.service';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { TranslationService } from '../../../core/services/translation.service';
import { ApiResult, OtomatikSahaAktarimOnizlemeDto, OtomatikSahaAktarimSonucDto, ProjeDto } from '../../../shared/models';

describe('Otomatik sahaya aktarım penceresi', () => {
  let fixture: ComponentFixture<OtomatikSahaAktarimComponent>;
  let projeService: jasmine.SpyObj<ProjeService>;
  let toast: jasmine.SpyObj<ToastService>;
  let confirm: jasmine.SpyObj<ConfirmService>;

  const onizleme = (degisiklik: Partial<OtomatikSahaAktarimOnizlemeDto> = {}): OtomatikSahaAktarimOnizlemeDto => ({
    projeId: 7,
    projeNo: 'PA723-01',
    planOzeti: 'ozet-1',
    aktarilacakVarMi: true,
    aktarilacakSandikSayisi: 1,
    eksikSatirSayisi: 1,
    eksikToplamAdet: 4,
    atlananSayisi: 1,
    hedefSahaProjeId: null,
    hedefSahaProjeNo: 'PA723-01-SAHA',
    yeniSahaProjesi: true,
    hedefSecimiGerekli: false,
    yeniSahaProjeNoOnerisi: 'PA723-01-SAHA',
    hedefSecenekleri: [],
    sandiklar: [{ kaynakSandikId: 13, kaynakSandikNo: '3', sandikAdi: 'Sandık 3', hedefSandikNo: '3', mevcutSandigaEklenir: false, numaraDegisti: false, urunSayisi: 1, toplamAdet: 5, urunler: [] }],
    eksiklerSandigi: { sandikNo: '1', sandikAdi: 'Sevk sonrası eksikler', mevcutSandigaEklenir: false, toplamAdet: 4, urunler: [{ cekiSatiriId: 102, siraNo: 2, barkodNo: 'B2', aciklama: 'Ürün 2', kaynakSandikNo: '2', istenenAdet: 10, miktar: 4, birim: 'Adet' }] },
    atlananlar: [{
      sandikNo: '4',
      neden: 'Sandıkta işlem görmüş ürün var; sandık ana projede kalır. Eksik 1 ürünü sahaya eksik olarak aktarılır.',
      ayrintilar: ['Sandık 4 / Ürün 4 [B4]: sandık içeriği işlenmiş (konulan:2)'],
    }],
    ...degisiklik,
  });
  const basarili = <T>(value: T): ApiResult<T> => ({ isSuccess: true, value });

  const kur = (ilk: OtomatikSahaAktarimOnizlemeDto) => {
    projeService = jasmine.createSpyObj<ProjeService>('proje', ['otomatikSahaAktarimOnizle', 'otomatikSahayaAktar']);
    projeService.otomatikSahaAktarimOnizle.and.returnValue(of(basarili(ilk)));
    toast = jasmine.createSpyObj<ToastService>('toast', ['success', 'warning', 'error']);
    confirm = jasmine.createSpyObj<ConfirmService>('confirm', ['ask']);
    confirm.ask.and.resolveTo(true);
    TestBed.configureTestingModule({
      imports: [OtomatikSahaAktarimComponent],
      providers: [
        { provide: ProjeService, useValue: projeService },
        { provide: ToastService, useValue: toast },
        { provide: ConfirmService, useValue: confirm },
        { provide: TranslationService, useValue: { translate: (key: string) => key } },
      ],
    });
    fixture = TestBed.createComponent(OtomatikSahaAktarimComponent);
    fixture.componentRef.setInput('proje', { id: 7, projeNo: 'PA723-01' } as ProjeDto);
    fixture.detectChanges();
  };

  it('önizlemeyi açılışta ister; sandıkları, eksikler sandığını ve atlananları gösterir', () => {
    kur(onizleme());

    expect(projeService.otomatikSahaAktarimOnizle).toHaveBeenCalledWith(7, {});
    const metin = fixture.nativeElement.textContent as string;
    expect(metin).toContain('Ürün 2');
    expect(metin).toContain('sandık ana projede kalır');
    // Ürün ürün gerekçe kısa nedene karışmaz; kapalı açılır listededir.
    const ayrinti = fixture.nativeElement.querySelector('.osa-skipped__details') as HTMLDetailsElement;
    expect(ayrinti.open).toBeFalse();
    expect(ayrinti.querySelector('summary')!.textContent).toContain('SAHA_OTOMATIK.SKIPPED_DETAILS (1)');
    expect(ayrinti.querySelectorAll('li').length).toBe(1);
    expect(fixture.componentInstance.uygulanabilir()).toBeTrue();
  });

  it('aktarılacak kalem yoksa uygulama kapalıdır', () => {
    kur(onizleme({ aktarilacakVarMi: false, sandiklar: [], eksiklerSandigi: null, aktarilacakSandikSayisi: 0, eksikSatirSayisi: 0 }));

    expect(fixture.componentInstance.uygulanabilir()).toBeFalse();
    expect(fixture.nativeElement.textContent).toContain('SAHA_OTOMATIK.EMPTY');
  });

  it('birden çok hedef varken seçim yapılmadan uygulanamaz; seçim önizlemeyi o hedefle yeniler', () => {
    kur(onizleme({
      yeniSahaProjesi: false,
      hedefSecimiGerekli: true,
      hedefSahaProjeNo: null,
      hedefSecenekleri: [
        { sahaProjeId: 20, sahaProjeNo: 'PA723-01-SAHA', durumMetni: 'Hazırlanıyor', sandikSayisi: 2 },
        { sahaProjeId: 21, sahaProjeNo: 'PA723-01-SAHA-2', durumMetni: 'Hazırlanıyor', sandikSayisi: 1 },
      ],
    }));
    expect(fixture.componentInstance.uygulanabilir()).toBeFalse();

    fixture.componentInstance.hedefDegisti('21');

    expect(projeService.otomatikSahaAktarimOnizle).toHaveBeenCalledWith(7, { hedefSahaProjeId: 21 });
  });

  it('onaylanınca plan özetiyle uygular ve sonucu bildirir', async () => {
    kur(onizleme());
    const sonuc = { sahaProjeId: 30, sahaProjeNo: 'PA723-01-SAHA', sahaAktarimId: 5, aktarilanSandikSayisi: 1, eksikSatirSayisi: 1, toplamSatirSayisi: 2, toplamAdet: 9 } as OtomatikSahaAktarimSonucDto;
    projeService.otomatikSahayaAktar.and.returnValue(of(basarili(sonuc)));
    let yayilan: OtomatikSahaAktarimSonucDto | undefined;
    fixture.componentInstance.aktarildi.subscribe(x => (yayilan = x));

    await fixture.componentInstance.uygula();

    expect(projeService.otomatikSahayaAktar).toHaveBeenCalledWith(7, jasmine.objectContaining({ planOzeti: 'ozet-1', yeniProje: true }));
    expect(yayilan).toEqual(sonuc);
    expect(toast.success).toHaveBeenCalled();
  });

  it('plan değiştiyse (409 PLAN_DEGISTI) uygulamayı kilitler ve yenilemeyi ister', async () => {
    kur(onizleme());
    projeService.otomatikSahayaAktar.and.returnValue(of({ isSuccess: false, statusCode: 409, error: 'değişti', issues: { kod: 'PLAN_DEGISTI' } } as ApiResult<OtomatikSahaAktarimSonucDto>));

    await fixture.componentInstance.uygula();
    fixture.detectChanges();

    expect(fixture.componentInstance.planDegisti()).toBeTrue();
    expect(fixture.componentInstance.uygulanabilir()).toBeFalse();
    expect(toast.warning).toHaveBeenCalledWith('değişti');

    fixture.componentInstance.yenile();
    expect(projeService.otomatikSahaAktarimOnizle).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.planDegisti()).toBeFalse();
  });

  it('onay verilmezse istek gönderilmez', async () => {
    kur(onizleme());
    confirm.ask.and.resolveTo(false);

    await fixture.componentInstance.uygula();

    expect(projeService.otomatikSahayaAktar).not.toHaveBeenCalled();
  });
});
