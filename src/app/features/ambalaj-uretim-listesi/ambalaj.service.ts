import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseApiService } from '../../core/services/base-api.service';
import { API } from '../../core/constants/api-endpoints';
import { ApiResult } from '../../shared/models';
import { AmbalajBagimsizSandikDto, AmbalajGrup, AmbalajIcSandikSablonDto, AmbalajIcSandikSablonKaydetRequest, AmbalajKalemKaydetRequest, AmbalajProjeOzetDto, AmbalajUretimKalemDto, AmbalajUretimPlanDto, UretimDurumId } from './models/ambalaj.model';

@Injectable({ providedIn: 'root' })
export class AmbalajService {
  private api = inject(BaseApiService);

  getProjeler(): Observable<ApiResult<AmbalajProjeOzetDto[]>> {
    return this.api.get<AmbalajProjeOzetDto[]>(API.AMBALAJ.PROJELER);
  }

  getPlan(projeId: number, kaynakProjeTipiId?: number, grup?: AmbalajGrup): Observable<ApiResult<AmbalajUretimPlanDto>> {
    return this.api.get<AmbalajUretimPlanDto>(API.AMBALAJ.PLAN(projeId, kaynakProjeTipiId, grup));
  }

  planKaydet(projeId: number, firinPartiNo: string, seciliKaynakSandikIds: number[], grup: AmbalajGrup, durumId: UretimDurumId, kaynakProjeTipiId?: number): Observable<ApiResult<AmbalajUretimPlanDto>> {
    return this.api.put<AmbalajUretimPlanDto>(API.AMBALAJ.PLAN(projeId, kaynakProjeTipiId, grup), { firinPartiNo, seciliKaynakSandikIds, grup, durumId });
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

  getBagimsizSandiklar(tur: 2 | 3): Observable<ApiResult<AmbalajBagimsizSandikDto[]>> {
    return this.api.get<AmbalajBagimsizSandikDto[]>(API.AMBALAJ.BAGIMSIZ_SANDIKLAR(tur));
  }

  bagimsizSandikEkle(request: AmbalajKalemKaydetRequest): Observable<ApiResult<AmbalajBagimsizSandikDto>> {
    return this.api.post<AmbalajBagimsizSandikDto>(API.AMBALAJ.BAGIMSIZ_SANDIKLAR(), request);
  }

  bagimsizSandikGuncelle(sandikId: number, request: AmbalajKalemKaydetRequest): Observable<ApiResult<AmbalajBagimsizSandikDto>> {
    return this.api.put<AmbalajBagimsizSandikDto>(API.AMBALAJ.BAGIMSIZ_SANDIK(sandikId), request);
  }

  bagimsizSandikSil(sandikId: number): Observable<ApiResult<void>> {
    return this.api.delete<void>(API.AMBALAJ.BAGIMSIZ_SANDIK(sandikId));
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

  uretimFormuIndir(projeId: number, tur?: number | null): Observable<Blob> {
    return this.api.downloadFile(API.PDF.AMBALAJ_URETIM(projeId, tur));
  }
}