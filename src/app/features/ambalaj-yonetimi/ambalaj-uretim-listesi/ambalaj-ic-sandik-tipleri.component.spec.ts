import { TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AmbalajUretimListesiComponent } from './ambalaj-uretim-listesi.component';
import {
  IC_SANDIK_KATLANIR,
  aktifIcSandikTipleri,
  icSandikTipiFormSecenekleri,
  secilebilirIcSandikTipleri,
  turunSandikTipleri,
} from './ic-sandik-tipleri';
import { AmbalajService } from '../../../core/services/ambalaj.service';
import { AmbalajYasamDongusuService } from '../../../core/services/ambalaj-yasam-dongusu.service';
import { ProjeService } from '../../../core/services/proje.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { TranslationService } from '../../../core/services/translation.service';
import { AMBALAJ_YETKI } from '../../../core/constants/yetki-kodlari';
import {
  AmbalajBagimsizSandikDto,
  AmbalajIcSandikSablonDto,
  SandikTipi,
} from '../../../shared/models';

describe('Özel Sandıklar > İç sandık tipleri paneli', () => {
  let api: jasmine.SpyObj<AmbalajService>;
  let confirm: jasmine.SpyObj<ConfirmService>;
  let toast: jasmine.SpyObj<ToastService>;
  const allowed = new Set<string>();

  const aktifKullanilan: AmbalajIcSandikSablonDto = {
    id: 1, ad: 'Akım trafosu iç', sandikTipi: 'Ahşap Kapalı', boy: 1200, en: 800, yukseklik: 600,
    aktif: true, kullanimSayisi: 4,
  };
  const aktifKullanilmayan: AmbalajIcSandikSablonDto = {
    id: 2, ad: 'Katlanır iç', sandikTipi: IC_SANDIK_KATLANIR, boy: 900, en: 700, yukseklik: 500,
    aktif: true, kullanimSayisi: 0,
  };
  const pasif: AmbalajIcSandikSablonDto = {
    id: 3, ad: 'Eski tip', sandikTipi: 'Kontrplak Sandık', boy: 1000, en: 600, yukseklik: 400,
    aktif: false, kullanimSayisi: 2,
  };
  const tipler = [aktifKullanilan, aktifKullanilmayan, pasif];

  beforeEach(() => {
    allowed.clear();
    [AMBALAJ_YETKI.KayitDuzenle, AMBALAJ_YETKI.KayitSil, AMBALAJ_YETKI.OlcuGoruntule].forEach((k) =>
      allowed.add(k),
    );
    api = jasmine.createSpyObj('AmbalajService', [
      'getProjeler',
      'getBagimsizSandiklar',
      'getIcSandikSablonlari',
      'icSandikSablonuEkle',
      'icSandikSablonuGuncelle',
      'icSandikSablonuDurumu',
      'icSandikSablonuSil',
      'getTalepEdenKullanicilar',
      'getProjeSandikSecenekleri',
    ]);
    api.getProjeler.and.returnValue(of({ isSuccess: true, value: {
      items: [], pageNumber: 1, pageSize: 15, totalCount: 0, totalPages: 0,
    } }));
    api.getBagimsizSandiklar.and.returnValue(of({ isSuccess: true, value: {
      items: [], pageNumber: 1, pageSize: 25, totalCount: 0, totalPages: 0,
    } }));
    api.getIcSandikSablonlari.and.returnValue(of({ isSuccess: true, value: tipler }));
    api.getTalepEdenKullanicilar.and.returnValue(of({ isSuccess: true, value: [] }));
    api.getProjeSandikSecenekleri.and.returnValue(of({ isSuccess: true, value: [] }));
    confirm = jasmine.createSpyObj('ConfirmService', ['ask', 'askWithReason']);
    confirm.ask.and.returnValue(Promise.resolve(true));
    toast = jasmine.createSpyObj('ToastService', ['success', 'error', 'info', 'warning']);
    TestBed.configureTestingModule({
      imports: [AmbalajUretimListesiComponent],
      providers: [
        provideRouter([]),
        { provide: AmbalajService, useValue: api },
        {
          provide: AmbalajYasamDongusuService,
          useValue: jasmine.createSpyObj('AmbalajYasamDongusuService', ['formlar', 'rapor']),
        },
        {
          provide: ProjeService,
          useValue: { getProjeDropdownListesi: () => of({ isSuccess: true, value: [] }) },
        },
        { provide: ConfirmService, useValue: confirm },
        {
          provide: PermissionService,
          useValue: {
            loaded: () => true,
            hasAccess: (k: string) => allowed.has(k),
            canWrite: (k: string) => allowed.has(k),
          },
        },
        { provide: ToastService, useValue: toast },
      ],
    });
    TestBed.inject(TranslationService).switchLanguage('tr');
  });

  function setup() {
    const fixture = TestBed.createComponent(AmbalajUretimListesiComponent);
    fixture.detectChanges();
    const c = fixture.componentInstance;
    c.aktifKuyrukDegistir('ozel');
    fixture.detectChanges();
    return { fixture, c, el: fixture.nativeElement as HTMLElement };
  }

  function paneliAc(fixture: ReturnType<typeof setup>['fixture'], el: HTMLElement): void {
    const dugme = Array.from(el.querySelectorAll<HTMLButtonElement>('.list-actions button')).find((b) =>
      b.textContent?.includes('İç sandık tipi'),
    );
    dugme!.click();
    fixture.detectChanges();
  }

  function satir(el: HTMLElement, id: number): HTMLTableRowElement {
    return el.querySelector<HTMLTableRowElement>(`.ic-tip-table tr[data-sablon-id="${id}"]`)!;
  }

  it('İç Sandık Katlanır yalnız iç sandıkta (tür 3) listelenir', () => {
    const temel: SandikTipi[] = ['Ahşap Kapalı', 'Katlanır Sandık'];
    expect(turunSandikTipleri(temel, 3)).toEqual(['Ahşap Kapalı', 'Katlanır Sandık', IC_SANDIK_KATLANIR]);
    expect(turunSandikTipleri(temel, 2)).toEqual(temel);
    expect(turunSandikTipleri([...temel, IC_SANDIK_KATLANIR], 4)).not.toContain(IC_SANDIK_KATLANIR);

    const { c } = setup();
    expect(c.icSandikTipiSecenekleri).toContain(IC_SANDIK_KATLANIR);
    expect(c.sandikTipleri).not.toContain(IC_SANDIK_KATLANIR);
    expect(c.sandikTipleri).toContain('Katlanır Sandık');
    c.ozelForm.tur = 3;
    expect(c.ozelYapiSecenekleri()).toContain(IC_SANDIK_KATLANIR);
    c.ozelForm.tur = 2;
    expect(c.ozelYapiSecenekleri()).not.toContain(IC_SANDIK_KATLANIR);
    expect(c.ozelYapiSecenekleri()).toContain('Katlanır Sandık');
  });

  it('seçim listeleri yalnız aktif tipleri gösterir; kaydın bağlı olduğu pasif tip seçili kalır', () => {
    expect(aktifIcSandikTipleri(tipler).map((t) => t.id)).toEqual([1, 2]);
    expect(secilebilirIcSandikTipleri(tipler).map((t) => t.id)).toEqual([1, 2]);
    expect(secilebilirIcSandikTipleri(tipler, 3).map((t) => t.id)).toEqual([1, 2, 3]);

    const { c } = setup();
    expect(c.aktifIcSandikSablonlari().map((t) => t.id)).toEqual([1, 2]);
    expect(c.ozelSablonSecenekleri().map((t) => t.id)).toEqual([1, 2]);

    c.bagimsizFormuAc({
      id: 50, tur: 3, turMetni: 'İç Sandık', projeId: 9, ustKaynakSandikId: 70, icSandikSablonId: 3,
      uretimeAlindi: false, sandikNo: '7.1', ad: 'Eski tip', sandikTipi: 'Kontrplak Sandık', adet: 1,
      boy: 1000, en: 600, yukseklik: 400, talimatVeren: 'Ali', hacimM3: null,
    } as AmbalajBagimsizSandikDto);
    expect(c.ozelSablonSecenekleri().map((t) => t.id)).toEqual([1, 2, 3]);

    c.bagimsizFormuAc();
    expect(c.ozelSablonSecenekleri().map((t) => t.id)).toEqual([1, 2]);
  });

  it('panel tipleri listeler; sil yalnız kullanılmayan tipte, kullanılan tipte ipuçlu devre dışı', () => {
    const { fixture, el } = setup();
    expect(el.querySelector('.ic-tip-panel')).toBeNull();
    paneliAc(fixture, el);

    expect(el.querySelectorAll('.ic-tip-table tbody tr').length).toBe(3);
    expect(satir(el, 3).textContent).toContain('Pasif');
    expect(satir(el, 3).textContent).toContain('Aktif et');
    expect(satir(el, 1).textContent).toContain('Pasife al');
    expect(satir(el, 1).textContent).toContain('1200 × 800 × 600');

    const silinebilir = satir(el, 2).querySelector<HTMLButtonElement>('.ic-tip-delete')!;
    expect(silinebilir.disabled).toBeFalse();
    const kullanilan = satir(el, 1).querySelector<HTMLButtonElement>('.ic-tip-delete')!;
    expect(kullanilan.disabled).toBeTrue();
    expect(satir(el, 1).querySelector('.ic-tip-delete-locked')?.getAttribute('title')).toBe(
      'Kullanımda; pasife alın',
    );
  });

  it('yazma izni yoksa düzenle/durum/sil/yeni düğmeleri görünmez; liste görünür', () => {
    allowed.clear();
    const { fixture, el } = setup();
    paneliAc(fixture, el);

    expect(el.querySelectorAll('.ic-tip-table tbody tr').length).toBe(3);
    expect(el.querySelector('.ic-tip-edit')).toBeNull();
    expect(el.querySelector('.ic-tip-status')).toBeNull();
    expect(el.querySelector('.ic-tip-delete')).toBeNull();
    expect(el.querySelector('.ic-tip-panel .list-actions')?.textContent).not.toContain('Yeni iç sandık tipi');
    // Ölçü görme izni yoksa ölçü sütunu da yok.
    expect(el.querySelector('.ic-tip-table thead')?.textContent).not.toContain('Ölçüler');
  });

  it('boş listede bilgi metni gösterilir', () => {
    api.getIcSandikSablonlari.and.returnValue(of({ isSuccess: true, value: [] }));
    const { fixture, el } = setup();
    paneliAc(fixture, el);
    expect(el.querySelector('.ic-tip-table .empty-state')?.textContent).toContain(
      'Henüz kayıtlı iç sandık tipi yok.',
    );
  });

  it('düzenle formu doldurur ve Kaydet PUT çağırır (POST değil)', () => {
    api.icSandikSablonuGuncelle.and.returnValue(of({ isSuccess: true, value: { ...aktifKullanilan, ad: 'Yeni ad' } }));
    const { fixture, c, el } = setup();
    paneliAc(fixture, el);
    satir(el, 1).querySelector<HTMLButtonElement>('.ic-tip-edit')!.click();
    fixture.detectChanges();

    expect(el.querySelector('.ic-tip-panel .form-title')?.textContent).toContain('İç sandık tipini düzenle');
    expect(el.querySelector('.ic-tip-edit-note')?.textContent).toContain(
      'Değişiklik mevcut sandık kayıtlarını değiştirmez.',
    );
    expect(c.sablonForm).toEqual({ ad: 'Akım trafosu iç', sandikTipi: 'Ahşap Kapalı', boy: 1200, en: 800, yukseklik: 600 });

    c.sablonForm.ad = 'Yeni ad';
    c.sablonKaydet();

    expect(api.icSandikSablonuGuncelle).toHaveBeenCalledOnceWith(1, jasmine.objectContaining({ ad: 'Yeni ad' }));
    expect(api.icSandikSablonuEkle).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('İç sandık tipi güncellendi.');
    expect(c.duzenlenenSablonId()).toBeNull();
    expect(c.sablonFormOpen()).toBeFalse();
  });

  it('yeni tip formu POST çağırır', () => {
    api.icSandikSablonuEkle.and.returnValue(of({ isSuccess: true, value: aktifKullanilmayan }));
    const { fixture, c, el } = setup();
    paneliAc(fixture, el);
    c.sablonuDuzenle(aktifKullanilan);
    c.yeniSablonFormuAc();
    expect(c.duzenlenenSablonId()).toBeNull();
    expect(c.sablonForm.ad).toBe('');
    c.sablonForm = { ad: 'Yeni', sandikTipi: IC_SANDIK_KATLANIR, boy: 10, en: 10, yukseklik: 10 };
    c.sablonKaydet();
    expect(api.icSandikSablonuEkle).toHaveBeenCalledTimes(1);
    expect(api.icSandikSablonuGuncelle).not.toHaveBeenCalled();
  });

  it('202 dönen güncellemede başarı mesajı ve liste yenileme yok, form açık kalır', () => {
    api.icSandikSablonuGuncelle.and.returnValue(of({ isSuccess: true, statusCode: 202 }));
    const { fixture, c, el } = setup();
    paneliAc(fixture, el);
    const yuklemeSayisi = api.getIcSandikSablonlari.calls.count();
    c.sablonuDuzenle(aktifKullanilan);
    c.sablonKaydet();
    expect(toast.info).toHaveBeenCalledWith('İşlem onay bekliyor.');
    expect(toast.success).not.toHaveBeenCalled();
    expect(api.getIcSandikSablonlari.calls.count()).toBe(yuklemeSayisi);
    expect(c.sablonFormOpen()).toBeTrue();
  });

  it('pasife al durum ucunu çağırır ve satırı sunucunun döndürdüğüyle günceller', () => {
    api.icSandikSablonuDurumu.and.returnValue(of({ isSuccess: true, value: { ...aktifKullanilan, aktif: false } }));
    const { fixture, c, el } = setup();
    paneliAc(fixture, el);
    satir(el, 1).querySelector<HTMLButtonElement>('.ic-tip-status')!.click();
    fixture.detectChanges();

    expect(api.icSandikSablonuDurumu).toHaveBeenCalledOnceWith(1, false);
    expect(c.aktifIcSandikSablonlari().map((t) => t.id)).toEqual([2]);
    expect(satir(el, 1).textContent).toContain('Aktif et');
  });

  it('kullanılmayan tip onaydan sonra silinir', fakeAsync(() => {
    api.icSandikSablonuSil.and.returnValue(of({ isSuccess: true }));
    const { fixture, c, el } = setup();
    paneliAc(fixture, el);
    satir(el, 2).querySelector<HTMLButtonElement>('.ic-tip-delete')!.click();
    flushMicrotasks();
    fixture.detectChanges();

    expect(confirm.ask).toHaveBeenCalled();
    expect(api.icSandikSablonuSil).toHaveBeenCalledOnceWith(2);
    expect(c.icSandikSablonlari().map((t) => t.id)).toEqual([1, 3]);
    expect(toast.success).toHaveBeenCalledWith('İç sandık tipi silindi.');
  }));

  it('silme onayı tip adını kaçışlayarak gösterir', fakeAsync(() => {
    api.icSandikSablonuSil.and.returnValue(of({ isSuccess: true }));
    const { c } = setup();
    c.sablonSil({ ...aktifKullanilmayan, ad: '<b>x</b>' });
    flushMicrotasks();
    const secenek = confirm.ask.calls.mostRecent().args[0];
    expect(secenek.title).toBe('İç sandık tipini sil');
    expect(secenek.message).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(secenek.message).not.toContain('<b>x</b>');
  }));

  it('silme hata dönerse (409) liste yeniden yüklenir ve satır kalır', fakeAsync(() => {
    api.icSandikSablonuSil.and.returnValue(of({
      isSuccess: false, statusCode: 409,
      error: 'Bu iç sandık tipi kullanımda; silinemez. Pasife alabilirsiniz.',
    }));
    const { fixture, c, el } = setup();
    paneliAc(fixture, el);
    const yuklemeSayisi = api.getIcSandikSablonlari.calls.count();
    satir(el, 2).querySelector<HTMLButtonElement>('.ic-tip-delete')!.click();
    flushMicrotasks();

    expect(toast.error).toHaveBeenCalledWith('Bu iç sandık tipi kullanımda; silinemez. Pasife alabilirsiniz.');
    expect(api.getIcSandikSablonlari.calls.count()).toBe(yuklemeSayisi + 1);
    expect(c.icSandikSablonlari().map((t) => t.id)).toEqual([1, 2, 3]);
  }));

  describe('ölçü görme izni yok, KayitDuzenle var', () => {
    const olcusuz: AmbalajIcSandikSablonDto = {
      ...aktifKullanilan, boy: null, en: null, yukseklik: null,
    };

    beforeEach(() => {
      allowed.delete(AMBALAJ_YETKI.OlcuGoruntule);
      api.getIcSandikSablonlari.and.returnValue(of({ isSuccess: true, value: [olcusuz] }));
    });

    it('maskeli ölçülü tip düzenlenir: PUT ölçüleri 0 gönderir, uyarı verilmez', () => {
      api.icSandikSablonuGuncelle.and.returnValue(of({ isSuccess: true, value: olcusuz }));
      const { fixture, c, el } = setup();
      paneliAc(fixture, el);
      satir(el, 1).querySelector<HTMLButtonElement>('.ic-tip-edit')!.click();
      fixture.detectChanges();
      c.sablonKaydet();

      expect(toast.warning).not.toHaveBeenCalled();
      expect(api.icSandikSablonuGuncelle).toHaveBeenCalledOnceWith(
        1, jasmine.objectContaining({ boy: 0, en: 0, yukseklik: 0 }),
      );
    });

    it('yeni tip düğmesi görünmez; yeni tipte ölçü yoksa uyarı verilir ve POST çağrılmaz', () => {
      const { fixture, c, el } = setup();
      paneliAc(fixture, el);
      expect(el.querySelector('.ic-tip-new')).toBeNull();

      c.yeniSablonFormuAc();
      c.sablonForm.ad = 'Ölçüsüz yeni';
      c.sablonKaydet();

      expect(toast.warning).toHaveBeenCalledWith('Tip adı, sandık tipi ve ölçüler zorunludur.');
      expect(api.icSandikSablonuEkle).not.toHaveBeenCalled();
    });

    it('boş satır ölçü sütunu gizliyken 5 sütunu kaplar', () => {
      api.getIcSandikSablonlari.and.returnValue(of({ isSuccess: true, value: [] }));
      const { fixture, el } = setup();
      paneliAc(fixture, el);
      expect(el.querySelector('.ic-tip-table .empty-state')?.getAttribute('colspan')).toBe('5');
    });
  });

  it('ölçü izni varken boş satır 6 sütunu kaplar ve yeni tip düğmesi görünür', () => {
    api.getIcSandikSablonlari.and.returnValue(of({ isSuccess: true, value: [] }));
    const { fixture, el } = setup();
    paneliAc(fixture, el);
    expect(el.querySelector('.ic-tip-table .empty-state')?.getAttribute('colspan')).toBe('6');
    expect(el.querySelector('.ic-tip-new')).not.toBeNull();
  });

  it('kullanımdaki tipte İç Sandık Katlanır geçişi form seçeneklerinde yoktur', () => {
    expect(icSandikTipiFormSecenekleri(['Ahşap Kapalı'], null)).toEqual(['Ahşap Kapalı', IC_SANDIK_KATLANIR]);
    expect(icSandikTipiFormSecenekleri(['Ahşap Kapalı'], { sandikTipi: 'Ahşap Kapalı', kullanimSayisi: 0 }))
      .toEqual(['Ahşap Kapalı', IC_SANDIK_KATLANIR]);
    expect(icSandikTipiFormSecenekleri(['Ahşap Kapalı'], { sandikTipi: IC_SANDIK_KATLANIR, kullanimSayisi: 2 }))
      .toEqual([IC_SANDIK_KATLANIR]);

    const { c } = setup();
    expect(c.sablonFormuSandikTipleri()).toContain(IC_SANDIK_KATLANIR);
    c.sablonuDuzenle(aktifKullanilan);
    expect(c.sablonFormuSandikTipleri()).not.toContain(IC_SANDIK_KATLANIR);
    c.sablonuDuzenle(aktifKullanilmayan);
    expect(c.sablonFormuSandikTipleri()).toContain(IC_SANDIK_KATLANIR);
  });

  it('özel sekmeden çıkınca panel ve form kapanır, düzenleme sıfırlanır', () => {
    const { fixture, c, el } = setup();
    paneliAc(fixture, el);
    c.sablonuDuzenle(aktifKullanilan);
    fixture.detectChanges();

    c.aktifKuyrukDegistir('normal');
    fixture.detectChanges();

    expect(c.icSandikTipleriPanelAcik()).toBeFalse();
    expect(c.sablonFormOpen()).toBeFalse();
    expect(c.duzenlenenSablonId()).toBeNull();
    expect(c.sablonForm.ad).toBe('');
  });
});
