import { TestBed } from '@angular/core/testing';
import { HttpParams, HttpResponse } from '@angular/common/http';
import { of } from 'rxjs';
import { BaseApiService } from './base-api.service';
import { FinansService } from './finans.service';
import {
  FinansGiderRaporuGruplamasi,
  FinansIsKategorisi,
  FinansIsRaporuKapsami,
  FinansKarsilanma,
  FinansOdemeFiltresi,
} from '../constants/enums';

describe('FinansService referans sözleşmesi', () => {
  let service: FinansService;
  let api: jasmine.SpyObj<BaseApiService>;

  it('rapor dosyası türüne göre uca gider; kapsam yalnız işlere, gruplama yalnız gidere eklenir', () => {
    api.downloadFileResponse.and.returnValue(of(new HttpResponse({ body: new Blob() })));
    const istek = { pageNumber: 1, pageSize: 25, projeNo: 'PA-1' };
    const secenek = { kapsam: FinansIsRaporuKapsami.SiparisiAcilmayan, gruplama: FinansGiderRaporuGruplamasi.Proje };
    const cagri = (tur: string, format: 'pdf' | 'excel') => {
      service.raporDosyasi(tur, format, istek, secenek).subscribe();
      const [url, options] = api.downloadFileResponse.calls.mostRecent().args;
      return { url, params: (options as { params: HttpParams }).params };
    };

    const is = cagri('is', 'excel');
    expect(is.url).toContain('/api/finans/raporlar/isler/excel');
    expect([is.params.get('kapsam'), is.params.has('gruplama'), is.params.get('projeNo')]).toEqual(['2', false, 'PA-1']);
    const gider = cagri('gider', 'pdf');
    expect(gider.url).toContain('/api/finans/raporlar/giderler/pdf');
    expect([gider.params.get('gruplama'), gider.params.has('kapsam')]).toEqual(['2', false]);
    const durum = cagri('finansal-durum', 'pdf');
    expect(durum.url).toContain('/api/finans/raporlar/finansal-durum/pdf');
    expect([durum.params.has('kapsam'), durum.params.has('gruplama')]).toEqual([false, false]);
    expect(cagri('proje-maliyet', 'excel').url).toContain('/api/finans/raporlar/ozet/proje-maliyet/excel');

    service.raporOnizleme('is', istek, secenek).subscribe();
    const [onizlemeUrl, onizlemeOptions] = api.get.calls.mostRecent().args;
    expect(onizlemeUrl).toContain('/api/finans/raporlar/onizleme/is');
    expect((onizlemeOptions as { params: HttpParams }).params.get('kapsam')).toBe('2');
  });

  beforeEach(() => {
    api = jasmine.createSpyObj<BaseApiService>('BaseApiService', ['get', 'post', 'put', 'downloadFile', 'downloadFileResponse']);
    api.get.and.returnValue(of({ isSuccess: true, value: {
      items: [], toplamlar: [], pageNumber: 1, pageSize: 25, totalCount: 0, totalPages: 0,
      hasPreviousPage: false, hasNextPage: false,
    } }));
    api.downloadFile.and.returnValue(of(new Blob()));
    api.post.and.returnValue(of({ isSuccess: true, value: [] }));
    api.put.and.returnValue(of({ isSuccess: true }));
    TestBed.configureTestingModule({ providers: [
      FinansService,
      { provide: BaseApiService, useValue: api },
    ] });
    service = TestBed.inject(FinansService);
  });

  it('genel aramayı proje numarası ve sayfalama parametreleriyle yapar', () => {
    service.genelArama({ pageNumber: 2, pageSize: 25, projeNo: 'PA 682-40' }).subscribe();

    const [url, options] = api.get.calls.mostRecent().args;
    const params = (options as { params: HttpParams }).params;
    expect(url).toContain('/api/finans/genel-arama');
    expect(params.get('projeNo')).toBe('PA 682-40');
    expect(params.get('pageNumber')).toBe('2');
    expect(params.get('pageSize')).toBe('25');
  });

  it('aylık liste arama, iptal ve sayfa filtresini backend sözleşmesiyle gönderir', () => {
    service.aylikIsler(2026, 9, {
      pageNumber: 3,
      pageSize: 50,
      arama: 'PA699',
      iptalEdilenleriDahilEt: true,
    }).subscribe();

    const [, options] = api.get.calls.mostRecent().args;
    const params = (options as { params: HttpParams }).params;
    expect(params.get('yil')).toBe('2026');
    expect(params.get('ay')).toBe('9');
    expect(params.get('arama')).toBe('PA699');
    expect(params.get('pageNumber')).toBe('3');
    expect(params.get('pageSize')).toBe('50');
    expect(params.get('iptalEdilenleriDahilEt')).toBe('true');
  });

  it('PO eşlemesi için siparişleri hedefli ve sayfalı sorgular', () => {
    service.siparisler({ pageNumber: 1, pageSize: 25, poNumarasi: 'PO-2026-41' }).subscribe();

    const [, options] = api.get.calls.mostRecent().args;
    const params = (options as { params: HttpParams }).params;
    expect(params.get('poNumarasi')).toBe('PO-2026-41');
    expect(params.get('pageNumber')).toBe('1');
    expect(params.get('pageSize')).toBe('25');
  });

  it('sipariş seçiminde 250 sınırına bağlı proje listesini değil tam iş kimliği listesini gönderir', () => {
    const ids = Array.from({ length: 300 }, (_, index) => index + 1);

    service.isKayitlariSecim(ids).subscribe();

    const [url, body] = api.post.calls.mostRecent().args;
    expect(url).toContain('/api/finans/is-kayitlari/secim');
    expect((body as { ids: number[] }).ids).toEqual(ids);
  });

  it('giderleri arama ve sayfalama parametreleriyle ister', () => {
    service.giderler({ pageNumber: 4, pageSize: 50, arama: 'nakliye' }).subscribe();

    const [, options] = api.get.calls.mostRecent().args;
    const params = (options as { params: HttpParams }).params;
    expect(params.get('arama')).toBe('nakliye');
    expect(params.get('pageNumber')).toBe('4');
    expect(params.get('pageSize')).toBe('50');
  });

  it('düzenli işleri backend pageNumber sözleşmesiyle filtreler', () => {
    service.duzenliIsler({ pageNumber: 2, pageSize: 25, arama: 'kira', sadeceAktif: true }).subscribe();

    const [, options] = api.get.calls.mostRecent().args;
    const params = (options as { params: HttpParams }).params;
    expect(params.get('arama')).toBe('kira');
    expect(params.get('pageNumber')).toBe('2');
    expect(params.get('pageSize')).toBe('25');
    expect(params.get('sadeceAktif')).toBe('true');
  });

  it('ürün ve tarifeleri arama ve sayfalama parametreleriyle ister', () => {
    service.urunler({ pageNumber: 3, pageSize: 100, arama: 'katlanır' }).subscribe();

    const [, options] = api.get.calls.mostRecent().args;
    const params = (options as { params: HttpParams }).params;
    expect(params.get('arama')).toBe('katlanır');
    expect(params.get('pageNumber')).toBe('3');
    expect(params.get('pageSize')).toBe('100');
  });

  it('sayfalı liste zarfını istemci tarafında dilimlemeden korur', () => {
    const envelope = {
      items: [{ id: 7 }],
      toplamlar: [{ paraBirimi: 'TRY', netTutar: 100, kdvTutari: 20, toplamTutar: 120 }],
      pageNumber: 2,
      pageSize: 25,
      totalCount: 31,
      totalPages: 2,
      hasPreviousPage: true,
      hasNextPage: false,
    };
    api.get.and.returnValue(of({ isSuccess: true, value: envelope }));

    service.giderler({ pageNumber: 2, pageSize: 25 }).subscribe(result => {
      expect(result.value as unknown).toBe(envelope);
    });
  });

  it('aylık ayrı raporda seçilen grupları tekrarlı query parametresi olarak gönderir', () => {
    service.aylikRapor('ayri', 2026, 8, ['Ambalaj', 'Özel İş']).subscribe();

    const url = api.downloadFile.calls.mostRecent().args[0] as string;
    expect(url).toContain('/api/finans/raporlar/aylik/ayri?yil=2026&ay=8');
    expect(url).toContain('gruplar=Ambalaj');
    expect(url).toContain('gruplar=%C3%96zel+%C4%B0%C5%9F');
  });

  it('PO grup seçicisini çoklu kategori, dönem ve iş kimlikleriyle sorgular', () => {
    service.siparisGruplari({
      pageNumber: 2, pageSize: 20, arama: ' PA727 ', kategoriler: [FinansIsKategorisi.SarfKereste, FinansIsKategorisi.Ilave],
      baslangic: '2026-09-01', bitis: '2026-09-30', paraBirimi: 'EUR', isKaydiIds: [11, 12], duzenliIsId: 5,
    }).subscribe();

    const [url, options] = api.get.calls.mostRecent().args;
    const params = (options as { params: HttpParams }).params;
    expect(url).toContain('/api/finans/siparis-gruplari');
    expect(params.getAll('kategoriler')).toEqual(['2', '3']);
    expect(params.getAll('isKaydiIds')).toEqual(['11', '12']);
    expect(params.get('arama')).toBe('PA727');
    expect(params.get('baslangic')).toBe('2026-09-01');
    expect(params.get('paraBirimi')).toBe('EUR');
    expect(params.get('duzenliIsId')).toBe('5');
    expect(params.get('sadeceSiparisBekleyen')).toBe('true');
  });

  it('mevcut PO kalem ekleme ve düzenli iş dönem üretimini kendi uçlarına gönderir', () => {
    service.siparisKalemEkle(7, { gruplar: [{ isKaydiIds: [11], netTutar: 100 }] }).subscribe();
    expect(api.post.calls.mostRecent().args).toEqual([
      jasmine.stringMatching('/api/finans/siparisler/7/kalemler'), { gruplar: [{ isKaydiIds: [11], netTutar: 100 }] },
    ]);
    service.duzenliIsDonemUret(5, '2026-12-31').subscribe();
    expect(api.post.calls.mostRecent().args).toEqual([
      jasmine.stringMatching('/api/finans/duzenli-isler/5/donemler'), { bitisTarihi: '2026-12-31' },
    ]);
  });

  it('sipariş durum raporunda durumu karşılanma değeri, iş grubunu kategori listesi olarak gönderir (RR Q5)', () => {
    service.siparisDurumRaporu('excel', {
      projeNo: ' PA1 ', kategoriler: [FinansIsKategorisi.Saha, FinansIsKategorisi.Yedek],
      siparisKarsilanma: FinansKarsilanma.Yok, faturaKarsilanma: FinansKarsilanma.Kismi,
    }).subscribe();

    const url = api.downloadFile.calls.mostRecent().args[0] as string;
    expect(url).toContain('/api/finans/raporlar/siparis-durumu/excel?');
    expect(url).toContain('projeNo=PA1');
    expect(url).toContain('kategoriler=5&kategoriler=6');
    expect(url).toContain('siparisKarsilanma=0');
    expect(url).toContain('faturaKarsilanma=1');
    expect(url).not.toContain('durum=');
    expect(url).not.toContain('isGrubu');
  });

  it('para birimi tanımlarını, vade parametrelerini ve ödeme işaretini kendi uçlarına gönderir (F1/D3)', () => {
    service.paraBirimleri(true).subscribe();
    const [url, options] = api.get.calls.mostRecent().args;
    expect(url).toMatch(/\/api\/finans\/para-birimleri$/);
    expect((options as { params: HttpParams }).params.get('sadeceAktif')).toBe('true');

    const usd = { kod: 'USD', ad: 'ABD doları', sembol: '$', aktif: true, sira: 3 };
    service.paraBirimiKaydet(usd).subscribe();
    expect(api.post.calls.mostRecent().args).toEqual([jasmine.stringMatching(/\/api\/finans\/para-birimleri$/), usd]);
    service.paraBirimiKaydet({ ...usd, aktif: false }, 3).subscribe();
    expect(api.put.calls.mostRecent().args).toEqual([
      jasmine.stringMatching(/\/api\/finans\/para-birimleri\/3$/), { ...usd, aktif: false },
    ]);

    service.parametreler().subscribe();
    expect(api.get.calls.mostRecent().args[0]).toMatch(/\/api\/finans\/parametreler$/);
    service.parametreleriKaydet({ varsayilanVadeGunu: 45, vadeUyariGunu: 5 }).subscribe();
    expect(api.put.calls.mostRecent().args).toEqual([
      jasmine.stringMatching(/\/api\/finans\/parametreler$/), { varsayilanVadeGunu: 45, vadeUyariGunu: 5 },
    ]);

    service.faturaOdeme(8, { odendi: true, odemeTarihi: '2026-09-20', aciklama: null }).subscribe();
    expect(api.put.calls.mostRecent().args).toEqual([
      jasmine.stringMatching('/api/finans/faturalar/8/odeme'), { odendi: true, odemeTarihi: '2026-09-20', aciklama: null },
    ]);

    service.vadeUyarilari(10).subscribe();
    const [uyariUrl, uyariOptions] = api.get.calls.mostRecent().args;
    expect(uyariUrl).toContain('/api/finans/vade-uyarilari');
    expect((uyariOptions as { params: HttpParams }).params.get('enFazlaKalem')).toBe('10');
  });

  it('fatura listesi ve alacak raporu ödeme filtresini aynı sözleşmeyle gönderir', () => {
    service.faturalar({ pageNumber: 1, pageSize: 25, odemeDurumu: FinansOdemeFiltresi.VadesiGecen }).subscribe();
    expect((api.get.calls.mostRecent().args[1] as { params: HttpParams }).params.get('odemeDurumu')).toBe('3');

    service.alacakRaporu('excel', {
      pageNumber: 1, pageSize: 25, odemeDurumu: FinansOdemeFiltresi.Odenmedi, paraBirimi: 'USD',
    }).subscribe();
    const [url, options] = api.downloadFile.calls.mostRecent().args;
    expect(url).toContain('/api/finans/raporlar/alacaklar/excel');
    const params = (options as { params: HttpParams }).params;
    expect(params.get('odemeDurumu')).toBe('1');
    expect(params.get('paraBirimi')).toBe('USD');
    service.alacakRaporu('pdf').subscribe();
    expect(api.downloadFile.calls.mostRecent().args[0]).toContain('/api/finans/raporlar/alacaklar/pdf');
  });

  it('bekleme listesini referans tarihi, eşik ve aşamayla; ürün yeniden fiyatlamayı gerekçeyle ister', () => {
    service.yaslandirma({ pageNumber: 1, pageSize: 25 }, '2026-09-29', 30, 'Fatura').subscribe();
    const params = (api.get.calls.mostRecent().args[1] as { params: HttpParams }).params;
    expect(params.get('referansTarihi')).toBe('2026-09-29');
    expect(params.get('minimumGun')).toBe('30');
    expect(params.get('asama')).toBe('Fatura');
    service.yaslandirma({ pageNumber: 1, pageSize: 25 }, '2026-09-29', 15).subscribe();
    expect((api.get.calls.mostRecent().args[1] as { params: HttpParams }).params.has('asama')).toBeFalse();

    service.urunYenidenFiyatla(4, 'Tarife güncellendi').subscribe();
    expect(api.post.calls.mostRecent().args).toEqual([
      jasmine.stringMatching('/api/finans/urunler/4/yeniden-fiyatla'), { aciklama: 'Tarife güncellendi' },
    ]);
  });

  it('liste filtresinde kategori ve karşılanma filtrelerini sunucu sözleşmesiyle gönderir', () => {
    service.siparisler({ pageNumber: 1, pageSize: 25, kategoriler: [FinansIsKategorisi.AnaAmbalaj], siparisKarsilanma: FinansKarsilanma.Tam }).subscribe();
    const params = (api.get.calls.mostRecent().args[1] as { params: HttpParams }).params;
    expect(params.getAll('kategoriler')).toEqual(['1']);
    expect(params.get('siparisKarsilanma')).toBe('2');
  });
});
