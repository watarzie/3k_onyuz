import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { ConfirmService } from '../../../core/services/confirm.service';
import { ToastService } from '../../../core/services/toast.service';
import { YuklemePlanlamaService } from '../../../core/services/yukleme-planlama.service';
import {
  ApiResult,
  EkipmanAilesiModeli,
  EkipmanDogrulamaDurumu,
  EkipmanKategorisi,
  EkipmanKaynakTuru,
  EkipmanKonfigurasyonDetayi,
  EkipmanKonfigurasyonGuncellemesi,
  EkipmanKonfigurasyonKaydi,
  EkipmanTeknikVerisi,
  YuklemeYontemi,
} from '../../../shared/models/index';
import { Ekipman3dComponent } from './ekipman-3d.component';
import { EkipmanDuzenleComponent } from './ekipman-duzenle.component';

/** 3B sahnenin (WebGL) yerine geçen sahte bileşen: şablonun verdiği teknik veriyi okumak için. */
@Component({ selector: 'app-ekipman-3d', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush, template: '' })
class Sahte3dComponent {
  readonly veri = input<EkipmanTeknikVerisi | null>(null);
}

const TEKNIK: EkipmanTeknikVerisi = {
  semaSurumu: 1,
  disOlcu: { uzunlukMm: 13600, genislikMm: 2550, yukseklikMm: 4000 },
  daraKg: 7000,
  teknikKapasiteKg: 27000,
  yuzeyler: [{ kod: 'ANA', baslangicXMm: 0, uzunlukMm: 13600, genislikMm: 2480, yerdenYukseklikMm: 1200, kullanilabilirYukseklikMm: 2700 }],
  acikliklar: [{ taraf: 'arka', genislikMm: 2480, yukseklikMm: 2700 }],
  engeller: [],
  dingiller: [{ xMm: 10000, tur: 'tahriksiz', grupNo: 1, kapasiteKg: 9000 }, { xMm: 11300, tur: 'tahriksiz', grupNo: 1 }],
  baglamaNoktalari: [],
};

const tip = (id: number, ad: string): EkipmanAilesiModeli['tipler'][number] =>
  ({ id, kod: ad, ad, kategori: EkipmanKategorisi.Tenteli, yuklemeYontemleri: YuklemeYontemi.Arkadan, sandikTasimayaUygun: true, aktif: true });
const AILELER: EkipmanAilesiModeli[] = [
  { id: 1, kod: 'KONTEYNER', ad: 'Konteyner', sira: 1, tipler: [tip(11, 'K40HC')] },
  { id: 2, kod: 'TIR', ad: 'Tır', sira: 2, tipler: [tip(21, 'Tenteli'), tip(22, 'Lowbed')] },
];

function detay(revizyonNo = 3, teknikVeriJson = JSON.stringify(TEKNIK)): EkipmanKonfigurasyonDetayi {
  const revizyon = {
    revizyonNo, kaynakTuru: EkipmanKaynakTuru.TasiyiciFoyu, kaynakAciklama: 'Föy 12', kaynakTarihi: '2026-03-15T00:00:00', aciklama: null,
    dogrulamaDurumu: EkipmanDogrulamaDurumu.Dogrulanmadi, dogrulayan: null, dogrulamaTarihi: null, olusturan: null, tarih: '2026-03-16T09:00:00',
  };
  return {
    id: 7, kod: 'TNT-136', ad: 'Tenteli 13,6 m', aktif: true, aileAdi: 'Tır', tipId: 21, tipKodu: 'TENTELI', tipAdi: 'Tenteli',
    kategori: EkipmanKategorisi.Tenteli, yuklemeYontemleri: YuklemeYontemi.Arkadan, sandikTasimayaUygun: true, uretici: 'Jenerik',
    modelAdi: 'Standart', revizyon, teknikVeriJson, veriUyarilari: [], revizyonlar: [revizyon],
  };
}

const tamam = (d: EkipmanKonfigurasyonDetayi): ApiResult<EkipmanKonfigurasyonDetayi> => ({ isSuccess: true, value: d });

describe('EkipmanDuzenleComponent', () => {
  let api: jasmine.SpyObj<YuklemePlanlamaService>;
  let toast: jasmine.SpyObj<ToastService>;
  let confirm: jasmine.SpyObj<ConfirmService>;
  let fixture: ComponentFixture<EkipmanDuzenleComponent>;
  let kaydedilenler: EkipmanKonfigurasyonDetayi[];
  let kapanma: number;

  async function kur(ilk: EkipmanKonfigurasyonDetayi | null): Promise<EkipmanDuzenleComponent> {
    api = jasmine.createSpyObj<YuklemePlanlamaService>('YuklemePlanlamaService', ['ekipmanEkle', 'ekipmanGuncelle']);
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'info', 'error']);
    confirm = jasmine.createSpyObj<ConfirmService>('ConfirmService', ['ask']);
    TestBed.configureTestingModule({
      imports: [EkipmanDuzenleComponent],
      providers: [
        { provide: YuklemePlanlamaService, useValue: api },
        { provide: ToastService, useValue: toast },
        { provide: ConfirmService, useValue: confirm },
      ],
    });
    TestBed.overrideComponent(EkipmanDuzenleComponent, { remove: { imports: [Ekipman3dComponent] }, add: { imports: [Sahte3dComponent] } });
    fixture = TestBed.createComponent(EkipmanDuzenleComponent);
    fixture.componentRef.setInput('detay', ilk);
    fixture.componentRef.setInput('aileler', AILELER);
    kaydedilenler = [];
    kapanma = 0;
    fixture.componentInstance.kaydedildi.subscribe((d) => kaydedilenler.push(d));
    fixture.componentInstance.kapandi.subscribe(() => kapanma++);
    await ciz();
    return fixture.componentInstance;
  }

  // ngModel değeri alana bir sonraki mikro görevde yazar.
  async function ciz(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const kok = () => fixture.nativeElement as HTMLElement;
  const alan = (etiket: string) =>
    [...kok().querySelectorAll<HTMLLabelElement>('label.tz-field')].find((l) => l.querySelector('span')!.textContent!.trim().startsWith(etiket))!
      .querySelector<HTMLInputElement | HTMLSelectElement>('input, select')!;
  const satirlar = (liste: string) => [...kok().querySelectorAll<HTMLTableRowElement>(`[data-liste="${liste}"] tbody tr`)].filter((tr) => tr.querySelector('input'));
  const yaz = (girdi: HTMLInputElement, deger: string) => {
    girdi.value = deger;
    girdi.dispatchEvent(new Event('input'));
  };
  const kaydetTikla = () => kok().querySelector<HTMLButtonElement>('[data-kaydet]')!.click();
  const sahne = () => fixture.debugElement.query((d) => d.componentInstance instanceof Sahte3dComponent).componentInstance as Sahte3dComponent;

  it('mevcut kayıttan dolar: kod, aile, tip, üretici ve model salt okunur; satırlar ve 3B önizleme teknik veriden gelir', async () => {
    const c = await kur(detay());
    const saltOkunur = (etiket: string) => [alan(etiket).value, (alan(etiket) as HTMLInputElement).readOnly];
    expect(['Kod', 'Aile', 'Tip', 'Üretici', 'Model'].map(saltOkunur)).toEqual([
      ['TNT-136', true], ['Tır', true], ['Tenteli', true], ['Jenerik', true], ['Standart', true],
    ]);
    expect(kok().querySelectorAll('.ed-ust select').length).toBe(1);
    expect([alan('Ad').value, (alan('Ad') as HTMLInputElement).readOnly]).toEqual(['Tenteli 13,6 m', false]);
    expect([c.form().tipId, c.form().kaynakTuru]).toEqual([21, EkipmanKaynakTuru.TasiyiciFoyu]);
    // Seçim kutusu DOM'da da kayıtlı kaynak türünü gösterir (ngValue eşleşmesi).
    const kaynak = alan('Kaynak türü') as HTMLSelectElement;
    expect([kaynak.selectedOptions[0].textContent!.trim(), kaynak.selectedIndex]).toEqual(['Taşıyıcı föyü', 2]);
    expect([c.saltOkunur(), kok().querySelector('.ed-engel'), kok().querySelector<HTMLButtonElement>('[data-kaydet]')!.disabled]).toEqual([false, null, false]);
    expect([alan('Kaynak tarihi').value, alan('Dış uzunluk').value, alan('Dara').value, alan('Azami brüt').value]).toEqual(['2026-03-15', '13600', '7000', '']);
    expect(['yuzeyler', 'acikliklar', 'engeller', 'dingiller', 'baglamaNoktalari'].map((l) => satirlar(l).length)).toEqual([1, 1, 0, 2, 0]);
    expect(satirlar('yuzeyler')[0].querySelector<HTMLInputElement>('input')!.value).toBe('ANA');
    expect(sahne().veri()).toEqual(TEKNIK);
    expect(kok().textContent).toContain('yeni, doğrulanmamış revizyon oluşturur');
    expect(kok().textContent).toContain('Önceden hesaplanmış');
    expect(c.degisti()).toBeFalse();
  });

  it('satır eklenir ve silinir; önizleme yalnız tamamlanan satırı çizer', async () => {
    const c = await kur(detay());
    kok().querySelector<HTMLButtonElement>('[data-ekle="dingiller"]')!.click();
    await ciz();
    expect(satirlar('dingiller').length).toBe(3);
    expect(sahne().veri()!.dingiller!.length).toBe(2);
    expect(c.degisti()).toBeTrue();

    expect([...kok().querySelectorAll('[data-liste="dingiller"] button')].map((b) => b.getAttribute('aria-label'))).toEqual([
      'Dingil 1 sil', 'Dingil 2 sil', 'Dingil 3 sil',
    ]);
    satirlar('dingiller')[0].querySelector<HTMLButtonElement>('button[aria-label="Dingil 1 sil"]')!.click();
    await ciz();
    expect(satirlar('dingiller').length).toBe(2);
    expect(c.form().dingiller.map((d) => d.xMm)).toEqual([11300, null]);
    expect(sahne().veri()!.dingiller).toEqual([{ xMm: 11300, tur: 'tahriksiz', grupNo: 1 }]);
  });

  it('güncelleme gövdesi: beklenen revizyon ve teknik veri JSON\'u sunucu şemasında; boşaltılan sayı yazılmaz', async () => {
    const c = await kur(detay(3));
    yaz(alan('Dara') as HTMLInputElement, '');
    yaz(alan('Ad') as HTMLInputElement, 'Tenteli 13,6 m (yeni)');
    await ciz();
    expect(c.form().daraKg).toBeNull();

    api.ekipmanGuncelle.and.returnValue(of(tamam(detay(4))));
    kaydetTikla();

    expect(api.ekipmanEkle).not.toHaveBeenCalled();
    const [id, govde] = api.ekipmanGuncelle.calls.mostRecent().args as [number, EkipmanKonfigurasyonGuncellemesi];
    expect(id).toBe(7);
    const { teknikVeriJson, ...ustAlanlar } = govde;
    expect(ustAlanlar).toEqual({
      kod: 'TNT-136', ad: 'Tenteli 13,6 m (yeni)', tipId: 21, uretici: 'Jenerik', modelAdi: 'Standart',
      kaynakTuru: EkipmanKaynakTuru.TasiyiciFoyu, kaynakAciklama: 'Föy 12', kaynakTarihi: '2026-03-15', aciklama: null, beklenenRevizyonNo: 3,
    });
    const { daraKg, ...darasiz } = TEKNIK;
    expect(daraKg).toBe(7000);
    expect(JSON.parse(teknikVeriJson)).toEqual(darasiz);
    expect(teknikVeriJson).not.toContain('null');

    expect(toast.success.calls.mostRecent().args[0]).toContain('revizyon 4 oluştu; doğrulama gerekir');
    expect(kaydedilenler.map((d) => d.revizyon.revizyonNo)).toEqual([4]);
  });

  it('aynı revizyon dönerse "değişiklik yok" bilgisi verilir', async () => {
    await kur(detay(3));
    api.ekipmanGuncelle.and.returnValue(of(tamam(detay(3))));
    kaydetTikla();
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.info.calls.mostRecent().args[0]).toContain('revizyon gerektiren değişiklik yok');
    expect(kaydedilenler.length).toBe(1);
  });

  it('yalnız ad değiştiyse (aynı revizyon, yeni ad) "ad güncellendi; revizyon açılmadı" bilgisi verilir', async () => {
    await kur(detay(3));
    yaz(alan('Ad') as HTMLInputElement, 'Tenteli (yeni ad)');
    api.ekipmanGuncelle.and.returnValue(of(tamam({ ...detay(3), ad: 'Tenteli (yeni ad)' })));
    kaydetTikla();
    expect(toast.success.calls.mostRecent().args[0]).toBe('TNT-136: ad güncellendi; revizyon açılmadı.');
    expect(toast.info).not.toHaveBeenCalled();
    expect(kaydedilenler.map((d) => d.ad)).toEqual(['Tenteli (yeni ad)']);
  });

  it('kayıtlı teknik veri formla kayıpsız taşınamıyorsa salt okunur açılır: uyarı görünür, alanlar ve Kaydet kapalıdır', async () => {
    const c = await kur(detay(3, JSON.stringify({ ...TEKNIK, lastikBasinciBar: 9 })));
    expect(c.saltOkunur()).toBeTrue();
    const uyari = kok().querySelector('.ed-engel')!.textContent!;
    expect(uyari).toContain('Bu ekipmanın teknik verisi ekrandan düzenlenemiyor; Excel ile güncelleyin.');
    expect(uyari).toContain('lastikBasinciBar');
    expect(kok().querySelector<HTMLButtonElement>('[data-kaydet]')!.disabled).toBeTrue();
    expect(['Ad', 'Kaynak türü', 'Dara'].map((etiket) => alan(etiket).matches(':disabled'))).toEqual([true, true, true]);
    expect([...kok().querySelectorAll<HTMLButtonElement>('[data-ekle], [data-liste] button')].every((b) => b.matches(':disabled'))).toBeTrue();
    // Düğme kapalı olsa da kayıt yolu ayrıca korunur.
    c.kaydet();
    expect(api.ekipmanGuncelle).not.toHaveBeenCalled();
    // Düzenlenebilir alan yok: odak pencerenin kendisindedir, kapatma sormadan çalışır.
    expect(document.activeElement).toBe(kok().querySelector('[role="dialog"]'));
    await c.kapat();
    expect([confirm.ask.calls.count(), kapanma]).toEqual([0, 1]);
  });

  it('okunamayan teknik veri ve başka şema sürümü de salt okunur açılır', async () => {
    let c = await kur(detay(3, '{bozuk'));
    expect([c.saltOkunur(), kok().querySelector('.ed-engel')!.textContent!.includes('okunamadı')]).toEqual([true, true]);
    TestBed.resetTestingModule();
    c = await kur(detay(3, JSON.stringify({ ...TEKNIK, semaSurumu: 2 })));
    expect([c.saltOkunur(), kok().querySelector('.ed-engel')!.textContent!.includes('şema sürümü (2)')]).toEqual([true, true]);
    expect(kok().querySelector<HTMLButtonElement>('[data-kaydet]')!.disabled).toBeTrue();
  });

  it('kayıt sürerken ikinci Kaydet istek atmaz ve pencere kapanmaz; yanıt gelince sonuç bir kez bildirilir', async () => {
    const c = await kur(detay(3));
    const yanit = new Subject<ApiResult<EkipmanKonfigurasyonDetayi>>();
    api.ekipmanGuncelle.and.returnValue(yanit.asObservable());
    kaydetTikla();
    await ciz();
    expect(kok().querySelector<HTMLButtonElement>('[data-kaydet]')!.disabled).toBeTrue();
    c.kaydet();
    kaydetTikla();
    expect(api.ekipmanGuncelle).toHaveBeenCalledTimes(1);

    c.alan({ ad: 'Bekleyen değişiklik' });
    await c.kapat();
    kok().querySelector<HTMLElement>('.tz-modal-backdrop')!.click();
    await fixture.whenStable();
    expect([confirm.ask.calls.count(), kapanma, kaydedilenler.length]).toEqual([0, 0, 0]);

    yanit.next(tamam(detay(4)));
    yanit.complete();
    await ciz();
    expect([kaydedilenler.length, kapanma, api.ekipmanGuncelle.calls.count()]).toEqual([1, 0, 1]);
  });

  it('yeni ekipman: eksik formda istek gitmez, eksikler listelenir; dolu form POST gövdesine çevrilir', async () => {
    const c = await kur(null);
    expect(['Kod', 'Üretici', 'Model'].map((etiket) => (alan(etiket) as HTMLInputElement).readOnly)).toEqual([false, false, false]);
    expect((alan('Tip') as HTMLSelectElement).disabled).toBeTrue();
    kaydetTikla();
    await ciz();
    expect(api.ekipmanEkle).not.toHaveBeenCalled();
    expect([...kok().querySelectorAll('.ed-hata li')].map((li) => li.textContent!.trim())).toEqual([
      'Kod zorunludur.', 'Ad zorunludur.', 'Tip zorunludur.', 'Üretici zorunludur.', 'Model zorunludur.', 'Kaynak türü zorunludur.',
    ]);

    yaz(alan('Kod') as HTMLInputElement, ' lb-3d ');
    yaz(alan('Ad') as HTMLInputElement, 'Lowbed 3 dingil');
    yaz(alan('Üretici') as HTMLInputElement, 'Jenerik');
    yaz(alan('Model') as HTMLInputElement, 'LB');
    c.aileSec(2);
    c.alan({ tipId: 22, kaynakTuru: EkipmanKaynakTuru.SahadaOlculdu });
    c.satirEkle('yuzeyler');
    c.satir('yuzeyler', c.form().yuzeyler[0].satirId, { kod: 'HAVUZ', baslangicXMm: 3000, uzunlukMm: 7000, genislikMm: 2550, yerdenYukseklikMm: 900 });
    await ciz();
    expect([...alan('Tip').querySelectorAll('option')].map((o) => o.textContent!.trim())).toEqual(['Tip seçin', 'Tenteli', 'Lowbed']);

    api.ekipmanEkle.and.returnValue(of(tamam({ ...detay(1), id: 9, kod: 'LB-3D' })));
    kaydetTikla();
    await ciz();

    expect(api.ekipmanGuncelle).not.toHaveBeenCalled();
    const govde = api.ekipmanEkle.calls.mostRecent().args[0] as EkipmanKonfigurasyonKaydi;
    expect(Object.keys(govde)).not.toContain('beklenenRevizyonNo');
    expect([govde.kod, govde.tipId, govde.kaynakTuru, govde.kaynakAciklama, govde.kaynakTarihi]).toEqual(['lb-3d', 22, 4, null, null]);
    expect(JSON.parse(govde.teknikVeriJson)).toEqual({
      semaSurumu: 1,
      yuzeyler: [{ kod: 'HAVUZ', baslangicXMm: 3000, uzunlukMm: 7000, genislikMm: 2550, yerdenYukseklikMm: 900 }],
      acikliklar: [], engeller: [], dingiller: [], baglamaNoktalari: [],
    });
    expect(toast.success.calls.mostRecent().args[0]).toContain('LB-3D eklendi');
    expect(kaydedilenler.map((d) => d.id)).toEqual([9]);
    expect(kok().querySelector('.ed-hata')).toBeNull();
  });

  it('yeni kayıtta aile değişince o aileye ait olmayan tip seçimi kalkar', async () => {
    const c = await kur(null);
    c.aileSec(2);
    c.alan({ tipId: 21 });
    c.aileSec(2);
    expect(c.form().tipId).toBe(21);
    c.aileSec(1);
    expect([c.form().aileId, c.form().tipId]).toEqual([1, null]);
  });

  it('sunucu sorunları formun üstünde madde madde gösterilir; 409\'da mesaj görünür ve form kapanmaz', async () => {
    await kur(detay());
    const hata = (statusCode: number, error: string, issues?: unknown[]) =>
      of({ isSuccess: false, error, statusCode, ...(issues ? { issues } : {}) } as ApiResult<EkipmanKonfigurasyonDetayi>);

    api.ekipmanGuncelle.and.returnValue(hata(400, 'Teknik veri geçersiz.', ["Yüzey 'ANA' dış ölçülerin dışına taşıyor.", 'Dara büyük.']));
    kaydetTikla();
    await ciz();
    expect(kok().querySelector('.ed-hata strong')!.textContent).toBe('Teknik veri geçersiz.');
    expect([...kok().querySelectorAll('.ed-hata li')].map((li) => li.textContent!.trim())).toEqual(["Yüzey 'ANA' dış ölçülerin dışına taşıyor.", 'Dara büyük.']);

    api.ekipmanGuncelle.and.returnValue(hata(409, 'Kayıt arada değişti; sayfayı yenileyin. · Takip: abc-123'));
    kaydetTikla();
    await ciz();
    expect(kok().querySelector('.ed-hata strong')!.textContent).toContain('Kayıt arada değişti');
    // Çakışmada çıkış yolu söylenir: pencere kapanınca üst ekran güncel kaydı yeniden çeker.
    expect([...kok().querySelectorAll('.ed-hata li')].map((li) => li.textContent!.trim())).toEqual([
      'Pencereyi kapatıp "Düzenle" ile yeniden açın; güncel revizyon yüklenir ve değişikliklerinizi yeniden girmeniz gerekir.',
    ]);
    expect([kaydedilenler.length, kapanma, toast.success.calls.count()]).toEqual([0, 0, 0]);
    expect(kok().querySelector<HTMLButtonElement>('[data-kaydet]')!.disabled).toBeFalse();
  });

  it('onaya alınan (202) istekte başarı mesajı ve kayıt bildirimi yok', async () => {
    await kur(detay());
    api.ekipmanGuncelle.and.returnValue(of({ isSuccess: true, statusCode: 202, value: { statusCode: 202 } } as unknown as ApiResult<EkipmanKonfigurasyonDetayi>));
    kaydetTikla();
    expect([toast.success.calls.count(), kaydedilenler.length, kapanma]).toEqual([0, 0, 1]);
  });

  it('kaydedilmemiş değişiklik varken kapatma onay ister; değişiklik yoksa sormadan kapanır', async () => {
    const c = await kur(detay());
    await c.kapat();
    expect([confirm.ask.calls.count(), kapanma]).toEqual([0, 1]);

    c.alan({ ad: 'Başka ad' });
    confirm.ask.and.resolveTo(false);
    await c.kapat();
    expect([confirm.ask.calls.count(), kapanma]).toEqual([1, 1]);

    confirm.ask.and.resolveTo(true);
    kok().querySelector<HTMLElement>('.tz-modal-backdrop')!.click();
    await fixture.whenStable();
    expect([confirm.ask.calls.count(), kapanma]).toEqual([2, 2]);
  });

  it('açılışta odak ilk düzenlenebilir alana gelir: düzenlemede Ad, yeni kayıtta Kod', async () => {
    await kur(detay());
    expect(document.activeElement).toBe(alan('Ad'));
    TestBed.resetTestingModule();
    await kur(null);
    expect(document.activeElement).toBe(alan('Kod'));
  });

  it('Esc pencereyi kapatır; kaydedilmemiş değişiklikte onay ister ve onay açıkken ikinci Esc yeni onay açmaz', async () => {
    const c = await kur(detay());
    const esc = () => alan('Ad').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    esc();
    await fixture.whenStable();
    expect([confirm.ask.calls.count(), kapanma]).toEqual([0, 1]);

    c.alan({ ad: 'Başka ad' });
    let karar!: (onay: boolean) => void;
    confirm.ask.and.returnValue(new Promise<boolean>((coz) => (karar = coz)));
    esc();
    esc();
    expect([confirm.ask.calls.count(), kapanma]).toEqual([1, 1]);
    karar(false);
    await fixture.whenStable();
    expect(kapanma).toBe(1);

    confirm.ask.and.resolveTo(true);
    esc();
    await fixture.whenStable();
    expect([confirm.ask.calls.count(), kapanma]).toEqual([2, 2]);
  });
});
