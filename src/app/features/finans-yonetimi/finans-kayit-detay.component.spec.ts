import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { AMBALAJ_YETKI, FINANS_YETKI } from '../../core/constants/yetki-kodlari';
import { FinansService } from '../../core/services/finans.service';
import { PermissionService } from '../../core/services/permission.service';
import { ToastService } from '../../core/services/toast.service';
import { ApiResult } from '../../shared/models/common.model';
import {
  FinansFatura,
  FinansIsKaydi,
  FinansSiparis,
  FinansSiparisDetay,
  FinansSiparisKalemi,
} from '../../shared/models/finans.model';
import {
  FinansBelge,
  FinansKaliciSilOnizleme,
  FinansSablon,
  FinansVarlikTuru,
} from '../../shared/models/finans-v2.model';
import { FinansKayitDetayComponent } from './finans-kayit-detay.component';

describe('Finans kayıt detayı revizyon ve kalıcı silme', () => {
  let api: jasmine.SpyObj<FinansService>;
  let toast: jasmine.SpyObj<ToastService>;
  let permissions: jasmine.SpyObj<PermissionService>;

  const line: FinansSiparisKalemi = {
    id: 21,
    isKaydiId: 11,
    sandikNo: 'A1',
    sandikAdi: 'Montaj',
    isTuru: 8,
    adet: 3,
    m3: 1.5,
    faturalananAdet: 0,
    faturalananM3: 0,
    kalanAdet: 3,
    kalanM3: 1.5,
    urunKodu: 'QA',
    urunAdi: 'Test',
    fiyatlandirmaBirimi: 3,
    fiyatlandirmaMiktari: 1,
    birimFiyat: 6000,
    paraBirimi: 'EUR',
    kdvOrani: 20,
    netTutar: 6000,
    kdvTutari: 1200,
    toplamTutar: 7200,
    fiyatManuelDegistirildi: false,
  };
  const po: FinansSiparis = {
    id: 7,
    kayitNo: 'S7',
    poNumarasi: 'PO-7',
    projeNo: 'PROJE-A',
    musteri: 'Test',
    isTurleri: ['Montaj'],
    siparisTarihi: '2026-09-19T12:00:00',
    sandikAdedi: 3,
    toplamM3: 1.5,
    faturalananM3: 0,
    kalanM3: 1.5,
    durum: 1,
    faturaDurumu: 1,
    belgeli: false,
    tutarlar: [],
    kalemler: [line],
  };
  const detail: FinansSiparisDetay = {
    ozet: po,
    kalemler: [line],
    belgeler: [],
    createdDate: '2026-09-19',
  };
  const invoice: FinansFatura = {
    id: 8,
    kayitNo: 'F8',
    faturaNumarasi: 'INV-8',
    faturaTarihi: '2026-09-19T12:00:00',
    poNumarasi: 'PO-7',
    projeNo: 'PROJE-A',
    isTurleri: ['Montaj'],
    sandikAdedi: 3,
    toplamM3: 1.5,
    durum: 1,
    belgeli: false,
    kalemler: [
      {
        id: 801,
        siparisKalemiId: 21,
        isKaydiId: 11,
        netTutar: 3000,
        kdvTutari: 600,
        toplamTutar: 3600,
        paraBirimi: 'EUR',
        tutarBazli: true,
      },
    ],
  };
  const preview: FinansKaliciSilOnizleme = {
    varlikTuru: 'Gider',
    id: 31,
    referans: 'QA gider',
    surum: 'SERVER-HASH-V2',
    silinebilir: true,
    bagimliliklar: [],
    engeller: [],
  };
  const oldTemplate: FinansSablon = {
    id: 3,
    kod: 'QA',
    ad: 'Eski tanım',
    aktif: true,
    surumId: 30,
    surum: 1,
    alanlar: [{ kod: 'uzunluk', ad: 'Uzunluk', veriTuru: 'sayi', zorunlu: true }],
  };
  const latestTemplate: FinansSablon = {
    ...oldTemplate,
    surumId: 31,
    surum: 2,
    alanlar: [{ kod: 'renk', ad: 'Renk', veriTuru: 'metin', zorunlu: true }],
  };
  const work: FinansIsKaydi = {
    id: 31,
    projeId: null,
    projeNo: 'QA',
    musteri: 'Test',
    sandikNo: '',
    sandikAdi: 'Özel iş',
    isTuru: 8,
    adet: 1,
    birimM3: 0,
    toplamM3: 0,
    siparisAdedi: 0,
    siparisM3: 0,
    siparisBekleyenAdet: 1,
    siparisBekleyenM3: 0,
    faturalananAdet: 0,
    faturalananM3: 0,
    poNumaralari: [],
    faturaNumaralari: [],
    kaynakAktif: true,
    fiyatlandirmaBirimi: 4,
    birimFiyat: 0,
    paraBirimi: 'EUR',
    kdvOrani: 20,
    netTutar: 1200,
    manuelNetTutar: 1200,
    sablonSurumId: 30,
    sablon: oldTemplate,
    alanDegerleri: { uzunluk: '2.5' },
    bilesenler: [
      { ad: 'İşçilik', yontem: 1, miktar: 2, birimFiyat: 500 },
      { ad: 'Sabit', yontem: 3, miktar: 1, birimFiyat: 200 },
    ],
  };

  beforeEach(() => {
    api = jasmine.createSpyObj<FinansService>('FinansService', [
      'siparisDetay',
      'faturaDetay',
      'siparisGuncelle',
      'faturaGuncelle',
      'kaliciSilOnizleme',
      'kaliciSil',
      'isDetay',
      'sablonlar',
      'fiyatlandir',
      'belgeIndir',
      'downloadErrorMessage',
    ]);
    api.siparisDetay.and.returnValue(of({ isSuccess: true, value: detail }));
    api.faturaDetay.and.returnValue(of({ isSuccess: true, value: invoice }));
    api.siparisGuncelle.and.returnValue(of({ isSuccess: true }));
    api.faturaGuncelle.and.returnValue(of({ isSuccess: true }));
    api.kaliciSilOnizleme.and.returnValue(of({ isSuccess: true, value: preview }));
    api.kaliciSil.and.returnValue(of({ isSuccess: true }));
    api.isDetay.and.returnValue(of({ isSuccess: true, value: work }));
    api.sablonlar.and.returnValue(of({ isSuccess: true, value: [latestTemplate] }));
    api.fiyatlandir.and.returnValue(of({ isSuccess: true }));
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'info']);
    permissions = jasmine.createSpyObj<PermissionService>('PermissionService', [
      'hasAccess',
      'canWrite',
    ]);
    permissions.hasAccess.and.returnValue(true);
    permissions.canWrite.and.returnValue(true);
    TestBed.configureTestingModule({
      imports: [FinansKayitDetayComponent],
      providers: [
        { provide: FinansService, useValue: api },
        { provide: ToastService, useValue: toast },
        { provide: PermissionService, useValue: permissions },
      ],
    });
  });

  function setup(tur: FinansVarlikTuru = 'Gider') {
    const fixture = TestBed.createComponent(FinansKayitDetayComponent);
    fixture.componentRef.setInput('hedef', {
      tur,
      id: tur === 'Siparis' ? 7 : tur === 'Fatura' ? 8 : 31,
    });
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance };
  }

  function readyToDelete(component: FinansKayitDetayComponent) {
    component.silOnizleme();
    component.ikinciAdim.set(true);
    component.ikinciOnay = true;
    component.silmeNedeni = '  Yinelenmiş test kaydı  ';
  }

  it('belge indirme hatasını Blob ayrıştırıcısından gelen sunucu mesajıyla gösterir', async () => {
    const failure = {
      error: new Blob(['{"message":"Belgeye erişim kaldırıldı."}'], { type: 'application/json' }),
    };
    api.belgeIndir.and.returnValue(throwError(() => failure));
    api.downloadErrorMessage.and.resolveTo('Belgeye erişim kaldırıldı.');
    const { component, fixture } = setup();
    component.belgeIndir({ id: 51, orijinalAd: 'test.pdf' } as FinansBelge);
    await fixture.whenStable();
    expect(api.downloadErrorMessage).toHaveBeenCalledWith(failure, jasmine.any(String));
    expect(component.hata()).toBe('Belgeye erişim kaldırıldı.');
  });

  it('fiyat formunda eski şablon sürümünü, bileşenleri ve manuel net bedeli aynen yeniden açar', () => {
    const { component } = setup('IsKaydi');
    component.tab('fiyat');
    expect(component.secilenSablonSurumId).toBe(30);
    expect(component.secilenSablon()?.surum).toBe(1);
    expect(component.secilenSablon()?.alanlar[0].kod).toBe('uzunluk');
    expect(component.sablonSecenekleri().map((x) => x.surumId)).toEqual([30, 31]);
    expect(component.fiyat.manuelNetTutar).toBe(1200);
    expect(component.fiyat.bilesenler).toEqual(work.bilesenler!);
    expect(component.fiyat.alanDegerleri).toEqual({ uzunluk: '2.5' });
    component.fiyat.aciklama = 'Snapshot korunarak yeniden kayıt';
    component.fiyatKaydet();
    expect(api.fiyatlandir).toHaveBeenCalledOnceWith(
      31,
      jasmine.objectContaining({
        sablonSurumId: 30,
        manuelNetTutar: 1200,
        bilesenler: work.bilesenler,
        alanDegerleri: { uzunluk: '2.5' },
      }),
    );
  });

  it('formdaki bileşen/alan düzenlemesi açılan değişmez snapshot nesnesini değiştirmez', () => {
    const { component } = setup('IsKaydi');
    component.fiyat.bilesenler![0].birimFiyat = 900;
    component.fiyat.alanDegerleri!['uzunluk'] = '9';
    expect(component.kayit()?.bilesenler?.[0].birimFiyat).toBe(500);
    expect(component.kayit()?.alanDegerleri?.['uzunluk']).toBe('2.5');
  });

  it('şablon ancak kullanıcı açıkça yeni sürümü seçince değişir ve eski alanlar temizlenir', () => {
    const { component } = setup('IsKaydi');
    component.tab('fiyat');
    component.secilenSablonSurumId = 31;
    component.sablonSec();
    expect(component.fiyat.sablonSurumId).toBe(31);
    expect(component.fiyat.alanDegerleri).toEqual({});
    expect(component.secilenSablon()?.alanlar[0].kod).toBe('renk');
    component.fiyat.aciklama = 'Yeni şablon sürümüne geçiş';
    component.fiyatKaydet();
    expect(api.fiyatlandir).not.toHaveBeenCalled();
    expect(component.hata()).toContain('zorunlu alanlarını');
  });

  for (const denied of [
    FINANS_YETKI.ParasalVeriGoruntule,
    FINANS_YETKI.BirimFiyatGoruntule,
    FINANS_YETKI.TutarGoruntule,
    FINANS_YETKI.GelirGoruntule,
    FINANS_YETKI.GiderGoruntule,
    FINANS_YETKI.KarlilikGoruntule,
    AMBALAJ_YETKI.OlcuGoruntule,
    AMBALAJ_YETKI.M3Goruntule,
    AMBALAJ_YETKI.SarfGoruntule,
  ]) {
    it(`fiyat formu açıkken ${denied} izni kalkarsa eski snapshot üzerine yazamaz`, () => {
      const { component } = setup('IsKaydi');
      expect(component.fiyatDuzenlenebilir()).toBeTrue();
      permissions.hasAccess.and.callFake((kod) => kod !== denied);
      component.fiyat.aciklama = 'Yetki değişiminden sonra kayıt';
      component.fiyatKaydet();
      expect(api.fiyatlandir).not.toHaveBeenCalled();
      expect(component.hata()).toContain('Gizlenmiş değerlerin üzerine yazılamaz');
    });
  }

  it('fiyat yazma izni kaldırılınca alanların tamamı görünse de değişiklik göndermez', () => {
    const { component } = setup('IsKaydi');
    permissions.canWrite.and.callFake((kod) => kod !== FINANS_YETKI.FiyatlandirmaDegistir);
    component.fiyat.aciklama = 'Yetki değişimi sonrası kayıt';
    component.fiyatKaydet();
    expect(api.fiyatlandir).not.toHaveBeenCalled();
  });

  it('PO revizyonunu gerekçe ve net tutarla, eski fiziksel miktarları taşımadan gönderir', () => {
    const { component } = setup('Siparis');
    expect(component.belgeForm.tarih).toBe('2026-09-19');
    component.belgeForm.numara = '  PO-REV  ';
    component.belgeForm.gerekce = '  Tutar mutabakatı  ';
    component.tutarlariDuzenle = true;
    component.belgeKalemleri[0].netTutar = 6500;
    component.belgeKaydet();
    expect(api.siparisGuncelle).toHaveBeenCalledOnceWith(7, {
      poNumarasi: 'PO-REV',
      siparisTarihi: '2026-09-19',
      aciklama: '',
      gerekce: 'Tutar mutabakatı',
      kalemler: [{ isKaydiId: 11, adet: 0, m3: 0, netTutar: 6500 }],
    });
    expect(line.adet).toBe(3);
    expect(line.m3).toBe(1.5);
  });

  it('fatura revizyonunda fatura kalemi yerine kaynak PO kalemi kimliğini kullanır', () => {
    const { component } = setup('Fatura');
    component.belgeForm.gerekce = 'Kısmi tutar düzeltmesi';
    component.tutarlariDuzenle = true;
    component.belgeKalemleri[0].netTutar = 4000;
    component.belgeKaydet();
    expect(api.faturaGuncelle).toHaveBeenCalledOnceWith(8, {
      faturaNumarasi: 'INV-8',
      faturaTarihi: '2026-09-19',
      aciklama: '',
      gerekce: 'Kısmi tutar düzeltmesi',
      belgeMutabakatiniKoru: false,
      kalemler: [{ siparisKalemiId: 21, adet: 0, m3: 0, netTutar: 4000 }],
    });
  });

  it('yalnız fatura başlığı değişiyorsa kalem revizyonu yollamaz ve belge mutabakatını korur', () => {
    const { component } = setup('Fatura');
    component.belgeForm.gerekce = 'Belge numarası düzeltmesi';
    component.belgeKaydet();
    const payload = api.faturaGuncelle.calls.mostRecent().args[1];
    expect(payload.belgeMutabakatiniKoru).toBeTrue();
    expect(payload.kalemler).toBeUndefined();
  });

  for (const tur of ['Siparis', 'Fatura'] as const) {
    it(`${tur} değişikliğinde boş gerekçeyi reddeder`, () => {
      const { component } = setup(tur);
      component.belgeForm.gerekce = '  ';
      component.belgeKaydet();
      expect(api.siparisGuncelle).not.toHaveBeenCalled();
      expect(api.faturaGuncelle).not.toHaveBeenCalled();
      expect(component.hata()).toContain('gerekçesi zorunludur');
    });

    it(`${tur} 202 yanıtında başarı/yenileme/kapanma yaymaz; işlem bekliyor mesajını gösterir`, () => {
      api.siparisGuncelle.and.returnValue(of({ isSuccess: true, statusCode: 202 }));
      api.faturaGuncelle.and.returnValue(of({ isSuccess: true, statusCode: 202 }));
      const { component } = setup(tur);
      const changed = spyOn(component.degisti, 'emit');
      const closed = spyOn(component.kapat, 'emit');
      const reload = spyOn(component, 'yukle');
      component.belgeForm.gerekce = 'Onay gereken revizyon';
      component.belgeKaydet();
      expect(toast.info).toHaveBeenCalledOnceWith('İşlem onaya gönderildi; henüz uygulanmadı.');
      expect(toast.success).not.toHaveBeenCalled();
      expect(changed).not.toHaveBeenCalled();
      expect(closed).not.toHaveBeenCalled();
      expect(reload).not.toHaveBeenCalled();
      expect(component.saving()).toBeFalse();
    });
  }

  for (const net of [null, 0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    it(`geçersiz/maskelenmiş ${String(net)} net tutarı revizyon olarak göndermez`, () => {
      const { component } = setup('Fatura');
      component.belgeForm.gerekce = 'Tutar düzeltmesi';
      component.tutarlariDuzenle = true;
      component.belgeKalemleri[0].netTutar = net;
      component.belgeKaydet();
      expect(api.faturaGuncelle).not.toHaveBeenCalled();
      expect(component.hata()).toContain('pozitif net tutar');
    });
  }

  it('ana parasal izni kalkmışsa görünen eski tutarla revizyon göndermez', () => {
    const { component } = setup('Siparis');
    component.belgeForm.gerekce = 'Tutar düzeltmesi';
    component.tutarlariDuzenle = true;
    permissions.hasAccess.and.callFake((kod) => kod !== component.izin.ParasalVeriGoruntule);
    component.belgeKaydet();
    expect(api.siparisGuncelle).not.toHaveBeenCalled();
  });

  it('başarısız revizyonda backend hatasını gösterir ve düzenlenen tutarı kaybetmez', () => {
    api.faturaGuncelle.and.returnValue(of({ isSuccess: false, error: 'PO bakiyesi değişti.' }));
    const { component } = setup('Fatura');
    const changed = spyOn(component.degisti, 'emit');
    component.belgeForm.gerekce = 'Tutar düzeltmesi';
    component.tutarlariDuzenle = true;
    component.belgeKalemleri[0].netTutar = 6001;
    component.belgeKaydet();
    expect(component.hata()).toBe('PO bakiyesi değişti.');
    expect(component.belgeKalemleri[0].netTutar).toBe(6001);
    expect(changed).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('bağımlılıklar nedeniyle silinemeyen önizlemeyi ikinci onayla aşamaz', () => {
    api.kaliciSilOnizleme.and.returnValue(
      of({
        isSuccess: true,
        value: {
          ...preview,
          silinebilir: false,
          bagimliliklar: [{ varlikTuru: 'Belge', id: 61, referans: 'qa.pdf' }],
          engeller: ['Bağlı belge var.'],
        },
      }),
    );
    const { component } = setup();
    readyToDelete(component);
    component.sil();
    expect(api.kaliciSil).not.toHaveBeenCalled();
  });

  for (const missing of ['önizleme', 'ikinci adım', 'onay', 'gerekçe']) {
    it(`kalıcı silmede ${missing} eksikse isteği engeller`, () => {
      const { component } = setup();
      readyToDelete(component);
      if (missing === 'önizleme') component.preview.set(null);
      if (missing === 'ikinci adım') component.ikinciAdim.set(false);
      if (missing === 'onay') component.ikinciOnay = false;
      if (missing === 'gerekçe') component.silmeNedeni = '  ';
      component.sil();
      expect(api.kaliciSil).not.toHaveBeenCalled();
      expect(component.hata()).toContain('zorunludur');
    });
  }

  it('silme gönderildiğinde güncel sunucu sürümünü, ikinci onayı ve kırpılmış gerekçeyi kullanır', () => {
    const { component } = setup();
    const changed = spyOn(component.degisti, 'emit');
    const closed = spyOn(component.kapat, 'emit');
    readyToDelete(component);
    component.sil();
    expect(api.kaliciSilOnizleme).toHaveBeenCalledOnceWith('Gider', 31);
    expect(api.kaliciSil).toHaveBeenCalledOnceWith({
      varlikTuru: 'Gider',
      id: 31,
      surum: 'SERVER-HASH-V2',
      ikinciOnay: true,
      aciklama: 'Yinelenmiş test kaydı',
    });
    expect(changed).toHaveBeenCalledTimes(1);
    expect(closed).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalled();
  });

  it('önizleme yenilenirken eski sürümü ve iki onayı temizler; hata eski silme iznini geri getirmez', () => {
    const response = new Subject<ApiResult<FinansKaliciSilOnizleme>>();
    const { component } = setup();
    readyToDelete(component);
    api.kaliciSilOnizleme.and.returnValue(response);
    component.silOnizleme();
    expect(component.preview()).toBeNull();
    expect(component.ikinciAdim()).toBeFalse();
    expect(component.ikinciOnay).toBeFalse();
    response.next({ isSuccess: false, error: 'Önizleme yenilenemedi.' });
    response.complete();
    expect(component.preview()).toBeNull();
    expect(component.hata()).toBe('Önizleme yenilenemedi.');
    component.ikinciAdim.set(true);
    component.ikinciOnay = true;
    component.sil();
    expect(api.kaliciSil).not.toHaveBeenCalled();
  });

  it('silmenin 202 onay yanıtı kaydı silinmiş gibi kapatmaz', () => {
    api.kaliciSil.and.returnValue(of({ isSuccess: true, statusCode: 202 }));
    const { component } = setup();
    const changed = spyOn(component.degisti, 'emit');
    const closed = spyOn(component.kapat, 'emit');
    readyToDelete(component);
    component.sil();
    expect(toast.info).toHaveBeenCalledOnceWith('İşlem onaya gönderildi; henüz uygulanmadı.');
    expect(toast.success).not.toHaveBeenCalled();
    expect(changed).not.toHaveBeenCalled();
    expect(closed).not.toHaveBeenCalled();
  });

  it('sürüm çakışmasında modalı açık tutar; bekleyen istek bitince saving kilidini kaldırır', () => {
    const response = new Subject<ApiResult<void>>();
    api.kaliciSil.and.returnValue(response);
    const { component } = setup();
    const closed = spyOn(component.kapat, 'emit');
    readyToDelete(component);
    component.sil();
    expect(component.saving()).toBeTrue();
    response.next({
      isSuccess: false,
      statusCode: 409,
      error: 'Kayıt değişti; önizlemeyi yenileyin.',
    });
    response.complete();
    expect(component.saving()).toBeFalse();
    expect(component.hata()).toBe('Kayıt değişti; önizlemeyi yenileyin.');
    expect(closed).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });
});
