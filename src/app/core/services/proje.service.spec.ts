import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { API } from '../constants/api-endpoints';
import { ProjeService } from './proje.service';
import { birNumaraliSandikMi } from '../../shared/models';

describe('ProjeService otomatik sahaya aktarım uçları', () => {
  let service: ProjeService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ProjeService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('önizleme varsayılan hedefte parametresiz, seçimde hedef ya da yeni proje bayrağıyla istenir', () => {
    service.otomatikSahaAktarimOnizle(7).subscribe();
    const varsayilan = http.expectOne(r => r.url === API.PROJE.OTOMATIK_SAHA_AKTARIM_ONIZLE(7));
    expect(varsayilan.request.method).toBe('GET');
    expect(varsayilan.request.params.keys()).toEqual([]);
    varsayilan.flush({});

    service.otomatikSahaAktarimOnizle(7, { hedefSahaProjeId: 12 }).subscribe();
    const mevcut = http.expectOne(r => r.url === API.PROJE.OTOMATIK_SAHA_AKTARIM_ONIZLE(7));
    expect(mevcut.request.params.get('hedefSahaProjeId')).toBe('12');
    expect(mevcut.request.params.has('yeniProje')).toBeFalse();
    mevcut.flush({});

    service.otomatikSahaAktarimOnizle(7, { yeniProje: true, hedefSahaProjeId: 12 }).subscribe();
    const yeni = http.expectOne(r => r.url === API.PROJE.OTOMATIK_SAHA_AKTARIM_ONIZLE(7));
    expect(yeni.request.params.get('yeniProje')).toBe('true');
    expect(yeni.request.params.has('hedefSahaProjeId')).toBeFalse();
    yeni.flush({});
  });

  it('uygulama plan özetiyle, aktarımın geri alınması aktarım kimliğiyle gönderilir', () => {
    service.otomatikSahayaAktar(7, { yeniProje: false, hedefSahaProjeId: 12, planOzeti: 'abc' }).subscribe();
    const uygula = http.expectOne(API.PROJE.OTOMATIK_SAHA_AKTARIM(7));
    expect(uygula.request.method).toBe('POST');
    expect(uygula.request.body).toEqual({ yeniProje: false, hedefSahaProjeId: 12, planOzeti: 'abc' });
    uygula.flush({});

    service.sahaAktarimiGeriAl(41, '  ').subscribe();
    const geriAl = http.expectOne(API.PROJE.SAHA_AKTARIMI_GERI_AL);
    expect(geriAl.request.body).toEqual({ sahaAktarimId: 41, aciklama: null });
    geriAl.flush({});
  });

  it('1 numaralı sandık sunucudaki biçimle tanınır', () => {
    expect(birNumaraliSandikMi('1')).toBeTrue();
    expect(birNumaraliSandikMi('01')).toBeTrue();
    expect(birNumaraliSandikMi(' 1 ')).toBeTrue();
    expect(birNumaraliSandikMi('1.0')).toBeTrue();
    expect(birNumaraliSandikMi('10')).toBeFalse();
    expect(birNumaraliSandikMi('1-2')).toBeFalse();
    expect(birNumaraliSandikMi(null)).toBeFalse();
  });
});
