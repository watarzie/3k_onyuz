import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { YuklemePlanlamaService } from '../../../core/services/yukleme-planlama.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  ApiResult,
  YuklemeCalismaBicimi,
  YuklemeLokasyonTercihi,
  YuklemePlaniDetayi,
  YuklemePlaniTanimlari,
  YuklemeProjeKarisimi,
} from '../../../shared/models/index';
import { PlanDuzenleComponent } from './plan-duzenle.component';
import { PlanYerlesimComponent } from './plan-yerlesim.component';

/** Yerleşim kartının (3B dahil) yerine geçen sahte bileşen: bu spec yalnız başlık formunu sınar. */
@Component({ selector: 'app-plan-yerlesim', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush, template: '' })
class SahteYerlesimComponent {
  readonly plan = input<unknown>(null);
  readonly yazabilir = input(false);
  readonly kaydedilmemis = input(false);
  readonly hesaplaniyor = input(false);
  readonly hesapla = output<unknown>();
  readonly elleKaydedildi = output<unknown>();
}

const TANIMLAR: YuklemePlaniTanimlari = {
  tasimaAileleri: [{ id: 1, ad: 'Konteyner' }, { id: 2, ad: 'Standart açık kasa / platform' }, { id: 8, ad: 'Lowbed / ağır yük' }],
  tasimaTipleri: [
    { id: 2, aileId: 1, ad: "40' standart (DV)", otomatikSecilir: true },
    { id: 3, aileId: 1, ad: "40' High Cube", otomatikSecilir: true },
    { id: 13, aileId: 1, ad: "40' Reefer High Cube", otomatikSecilir: false },
    { id: 17, aileId: 2, ad: 'Açık kasa', otomatikSecilir: true },
    { id: 21, aileId: 8, ad: 'Lowbed', otomatikSecilir: true },
  ],
  yukTurleri: [],
  lokasyonlar: [],
};

function plan(tipIdleri: number[]): YuklemePlaniDetayi {
  return {
    id: 1, planNo: 'YP-2026-000001', ad: 'P', calismaBicimi: YuklemeCalismaBicimi.IhtiyacaGoreArac, tasimaAilesiId: 1, tasimaAilesiAdi: 'Konteyner',
    projeKarisimi: YuklemeProjeKarisimi.Karisik, lokasyonTercihi: YuklemeLokasyonTercihi.HenuzSecilmedi, yuklemeTarihi: null, aciklama: null,
    revizyonNo: 2, revizyonTarihi: '2026-11-19T10:00:00', kaydeden: null, revizyonAciklamasi: null,
    ayarlar: { yerlesimBosluguMm: 30, yukseklikPayiMm: null, genislikPayiMm: null, uzunlukPayiMm: null, agirlikPayiKg: null, yuklemeHareketiPayiMm: null, mevcutAraclar: [], tipIdleri },
    projeler: [], yukler: [],
    sayaclar: { toplam: 0, secilen: 0, hesaplanabilir: 0, veriEksik: 0, haricTutulan: 0, sevkEdilmisSandik: 0, yerlesen: 0, yerlesemeyen: 0 },
    kaynakFarklari: [], farkliLokasyonSayisi: 1, yerlesim: null, surenYukleme: null,
  };
}

describe('PlanDuzenleComponent aile ve tip seçimi', () => {
  let fixture: ComponentFixture<PlanDuzenleComponent>;

  function kur(p: YuklemePlaniDetayi, yazma = true): PlanDuzenleComponent {
    const api = jasmine.createSpyObj<YuklemePlanlamaService>('YuklemePlanlamaService', ['plan', 'tanimlar']);
    api.plan.and.returnValue(of({ isSuccess: true, value: p } as ApiResult<YuklemePlaniDetayi>));
    api.tanimlar.and.returnValue(of({ isSuccess: true, value: TANIMLAR } as ApiResult<YuklemePlaniTanimlari>));
    TestBed.configureTestingModule({
      imports: [PlanDuzenleComponent],
      providers: [
        provideRouter([]),
        { provide: YuklemePlanlamaService, useValue: api },
        { provide: ToastService, useValue: jasmine.createSpyObj<ToastService>('ToastService', ['error', 'success']) },
        { provide: PermissionService, useValue: { canWrite: () => yazma, hasAccess: () => true } },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: '1' })) } },
      ],
    });
    TestBed.overrideComponent(PlanDuzenleComponent, { remove: { imports: [PlanYerlesimComponent] }, add: { imports: [SahteYerlesimComponent] } });
    fixture = TestBed.createComponent(PlanDuzenleComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  const tipDugmeleri = () => [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.yp-tip')];

  it('yalnız seçili ailenin tiplerini gösterir; kayıtlı seçim işaretli gelir', () => {
    kur(plan([3]));
    expect(tipDugmeleri().map((b) => b.textContent?.trim())).toEqual(["40' standart (DV)", "40' High Cube", "40' Reefer High Cube · yalnız seçilince"]);
    expect(tipDugmeleri().map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false']);
    expect((fixture.nativeElement as HTMLElement).querySelector('.yp-tipler__ipucu')?.textContent).toContain('yalnız seçilen tiplere');
  });

  it('tip seçimi açılıp kapanır ve planı değişmiş sayar', () => {
    const c = kur(plan([]));
    expect(c.degisti()).toBeFalse();
    c.tipDegistir(2);
    c.tipDegistir(13);
    expect(c.ayarlar().tipIdleri).toEqual([2, 13]);
    c.tipDegistir(2);
    expect(c.ayarlar().tipIdleri).toEqual([13]);
    expect(c.degisti()).toBeTrue();
  });

  it('aile değişince önceki ailenin tip seçimi silinir ve yeni ailenin tipleri gelir', () => {
    const c = kur(plan([3]));
    c.aileDegistir(2);
    fixture.detectChanges();
    expect(c.ayarlar().tipIdleri).toEqual([]);
    expect(tipDugmeleri().map((b) => b.textContent?.trim())).toEqual(['Açık kasa']);
    expect(c.aileTipleri().some((t) => t.ad === 'Lowbed')).toBeFalse();
    expect(c.degisti()).toBeTrue();
  });

  it('düzenleme izni yoksa tipler değiştirilemez', () => {
    kur(plan([3]), false);
    expect(tipDugmeleri().every((b) => b.disabled)).toBeTrue();
  });
});
