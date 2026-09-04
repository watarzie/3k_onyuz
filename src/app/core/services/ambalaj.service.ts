import { Injectable, inject } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BaseApiService } from './base-api.service';
import { API } from '../constants/api-endpoints';
import {
  AmbalajBagimsizSandikDto,
  AmbalajBagimsizSandikListelemeRequest,
  AmbalajBagimsizSandiklarSayfasiDto,
  AmbalajGrup,
  AmbalajIcSandikSablonDto,
  AmbalajIcSandikSablonKaydetRequest,
  AmbalajIlaveSandikAdayDto,
  AmbalajKullaniciSecenegiDto,
  AmbalajKalemKaydetRequest,
  AmbalajOzelSandikKaydetRequest,
  AmbalajProjeListelemeRequest,
  AmbalajPlanlamaProjeleriSayfasiDto,
  AmbalajTalepEdenDto,
  AmbalajSandikSecenegiDto,
  AmbalajUretimKalemDto,
  AmbalajUretimPlanDto,
  ApiResult,
  OzelSandikTur,
  UretimDurumId,
} from '../../shared/models';

@Injectable({ providedIn: 'root' })
export class AmbalajService {
  private api = inject(BaseApiService);

  getProjeler(request: AmbalajProjeListelemeRequest = {
    grup: 1,
    pageNumber: 1,
    pageSize: 15,
  }): Observable<ApiResult<AmbalajPlanlamaProjeleriSayfasiDto>> {
    let params = new HttpParams()
      .set('grup', request.grup)
      .set('pageNumber', request.pageNumber)
      .set('pageSize', request.pageSize);
    if (request.arama?.trim()) params = params.set('arama', request.arama.trim());
    if (request.projeTipiId) params = params.set('projeTipiId', request.projeTipiId);
    if (request.includeSummary !== undefined) {
      params = params.set('includeSummary', request.includeSummary);
    }

    return this.api.get<AmbalajPlanlamaProjeleriSayfasiDto>(API.AMBALAJ.PROJELER, { params });
  }

  getPlan(projeId: number, kaynakProjeTipiId?: number, grup?: AmbalajGrup): Observable<ApiResult<AmbalajUretimPlanDto>> {
    return this.api.get<AmbalajUretimPlanDto>(API.AMBALAJ.PLAN(projeId, kaynakProjeTipiId, grup));
  }

  planKaydet(projeId: number, firinPartiNo: string, seciliKaynakSandikIds: number[], grup: AmbalajGrup, durumId: UretimDurumId, kaynakProjeTipiId?: number): Observable<ApiResult<AmbalajUretimPlanDto>> {
    return this.api.put<AmbalajUretimPlanDto>(API.AMBALAJ.PLAN(projeId, kaynakProjeTipiId, grup), { firinPartiNo, seciliKaynakSandikIds, grup, durumId });
  }

  ambalajKarariKaydet(sandikId: number, ambalajaDahilMi: boolean): Observable<ApiResult<AmbalajUretimPlanDto>> {
    return this.api.put<AmbalajUretimPlanDto>(API.AMBALAJ.AMBALAJ_KARARI(sandikId), { ambalajaDahilMi });
  }

  kalemEkle(projeId: number, request: AmbalajKalemKaydetRequest): Observable<ApiResult<AmbalajUretimKalemDto>> {
    return this.api.post<AmbalajUretimKalemDto>(API.AMBALAJ.KALEMLER(projeId), request);
  }

  kalemGuncelle(kalemId: number, request: AmbalajKalemKaydetRequest): Observable<ApiResult<AmbalajUretimKalemDto>> {
    return this.api.put<AmbalajUretimKalemDto>(API.AMBALAJ.KALEM(kalemId), request);
  }

  kalemSil(kalemId: number): Observable<ApiResult<void>> {
    return this.api.delete<void>(API.AMBALAJ.KALEM(kalemId));
  }

  getBagimsizSandiklar(request: AmbalajBagimsizSandikListelemeRequest = {
    pageNumber: 1,
    pageSize: 25,
  }): Observable<ApiResult<AmbalajBagimsizSandiklarSayfasiDto>> {
    let params = new HttpParams()
      .set('pageNumber', request.pageNumber)
      .set('pageSize', request.pageSize);
    if (request.arama?.trim()) params = params.set('arama', request.arama.trim());
    if (request.tur) params = params.set('tur', request.tur);
    if (request.includeSummary !== undefined) {
      params = params.set('includeSummary', request.includeSummary);
    }

    return this.api.get<AmbalajBagimsizSandiklarSayfasiDto>(
      API.AMBALAJ.BAGIMSIZ_SANDIKLAR(),
      { params },
    );
  }

  bagimsizSandikEkle(request: AmbalajOzelSandikKaydetRequest): Observable<ApiResult<AmbalajBagimsizSandikDto>> {
    return this.api.post<AmbalajBagimsizSandikDto>(API.AMBALAJ.BAGIMSIZ_SANDIKLAR(), request);
  }

  bagimsizSandikGuncelle(sandikId: number, request: AmbalajOzelSandikKaydetRequest): Observable<ApiResult<AmbalajBagimsizSandikDto>> {
    return this.api.put<AmbalajBagimsizSandikDto>(API.AMBALAJ.BAGIMSIZ_SANDIK(sandikId), request);
  }

  bagimsizSandikSil(sandikId: number): Observable<ApiResult<void>> {
    return this.api.delete<void>(API.AMBALAJ.BAGIMSIZ_SANDIK(sandikId));
  }

  getIlaveSandikAdaylari(projeId: number, mevcutKayitId?: number | null): Observable<ApiResult<AmbalajIlaveSandikAdayDto[]>> {
    return this.api.get<AmbalajIlaveSandikAdayDto[]>(API.AMBALAJ.ILAVE_SANDIK_ADAYLARI(projeId, mevcutKayitId));
  }

  getProjeSandikSecenekleri(projeId: number): Observable<ApiResult<AmbalajSandikSecenegiDto[]>> {
    return this.api.get<AmbalajSandikSecenegiDto[]>(API.AMBALAJ.SANDIK_SECENEKLERI(projeId));
  }

  getIcSandikSablonlari(): Observable<ApiResult<AmbalajIcSandikSablonDto[]>> {
    return this.api.get<AmbalajIcSandikSablonDto[]>(API.AMBALAJ.IC_SANDIK_SABLONLARI);
  }

  icSandikSablonuEkle(request: AmbalajIcSandikSablonKaydetRequest): Observable<ApiResult<AmbalajIcSandikSablonDto>> {
    return this.api.post<AmbalajIcSandikSablonDto>(API.AMBALAJ.IC_SANDIK_SABLONLARI, request);
  }

  icSandikSablonuSil(sablonId: number): Observable<ApiResult<void>> {
    return this.api.delete<void>(API.AMBALAJ.IC_SANDIK_SABLONU(sablonId));
  }

  getTalepEdenler(): Observable<ApiResult<AmbalajTalepEdenDto[]>> {
    return this.api.get<AmbalajTalepEdenDto[]>(API.AMBALAJ.TALEP_EDENLER);
  }

  getTalepEdenKullanicilar(): Observable<ApiResult<AmbalajKullaniciSecenegiDto[]>> {
    return this.api.get<AmbalajKullaniciSecenegiDto[]>(API.AMBALAJ.TALEP_EDEN_KULLANICILAR);
  }

  talepEdenEkle(ad: string): Observable<ApiResult<AmbalajTalepEdenDto>> {
    return this.api.post<AmbalajTalepEdenDto>(API.AMBALAJ.TALEP_EDENLER, { ad });
  }

  uretimFormuIndir(projeId: number, tur?: number | null): Observable<Blob> {
    return this.api.downloadFile(API.PDF.AMBALAJ_URETIM(projeId, tur));
  }

  ozelSandikRaporuIndir(tur: OzelSandikTur): Observable<Blob> {
    return this.api.downloadFile(API.PDF.OZEL_SANDIK(tur));
  }

  ozelSandikUretimFormuIndir(tur: OzelSandikTur, projeId: number): Observable<Blob> {
    return this.api.downloadFile(API.PDF.OZEL_SANDIK_URETIM_FORMU(tur, projeId));
  }
}
