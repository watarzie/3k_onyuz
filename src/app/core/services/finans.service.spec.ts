import { TestBed } from '@angular/core/testing';
import { HttpParams } from '@angular/common/http';
import { of } from 'rxjs';
import { BaseApiService } from './base-api.service';
import { FinansService } from './finans.service';

describe('FinansService referans sözleşmesi', () => {
  let service: FinansService;
  let api: jasmine.SpyObj<BaseApiService>;

  beforeEach(() => {
    api = jasmine.createSpyObj<BaseApiService>('BaseApiService', ['get', 'post', 'downloadFile']);
    api.get.and.returnValue(of({ isSuccess: true, value: {
      items: [], toplamlar: [], pageNumber: 1, pageSize: 25, totalCount: 0, totalPages: 0,
      hasPreviousPage: false, hasNextPage: false,
    } }));
    api.downloadFile.and.returnValue(of(new Blob()));
    api.post.and.returnValue(of({ isSuccess: true, value: [] }));
    TestBed.configureTestingModule({ providers: [
      FinansService,
      { provide: BaseApiService, useValue: api },
    ] });
    service = TestBed.inject(FinansService);
  });

  it('iş kayıtlarını proje numarası ve sayfalama parametreleriyle alır', () => {
    service.isKayitlari('PA 682-40', { pageNumber: 2, pageSize: 25 }).subscribe();

    const [url, options] = api.get.calls.mostRecent().args;
    const params = (options as { params: HttpParams }).params;
    expect(url).toContain('/api/finans/is-kayitlari');
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
});
