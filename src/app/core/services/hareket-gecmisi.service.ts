import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpParams } from '@angular/common/http';
import { BaseApiService } from './base-api.service';
import { API } from '../constants/api-endpoints';
import { ApiResult, HareketGecmisiDto } from '../../shared/models/index';
import { PaginatedList } from '../../shared/models/common.model';

/**
 * HareketGecmisiController:
 *  GET /api/hareketgecmisi/proje/{projeId}?pageNumber=1&pageSize=15&searchTerm=abc&islemTipiId=3
 */
@Injectable({ providedIn: 'root' })
export class HareketGecmisiService {
  private api = inject(BaseApiService);

  getByProje(
    projeId: number,
    pageNumber: number = 1,
    pageSize: number = 15,
    searchTerm?: string,
    islemTipiId?: number
  ): Observable<ApiResult<PaginatedList<HareketGecmisiDto>>> {
    let params = new HttpParams()
      .set('pageNumber', pageNumber.toString())
      .set('pageSize', pageSize.toString());

    if (searchTerm) {
      params = params.set('searchTerm', searchTerm);
    }
    if (islemTipiId) {
      params = params.set('islemTipiId', islemTipiId.toString());
    }

    return this.api.get<PaginatedList<HareketGecmisiDto>>(API.HAREKET.BY_PROJE(projeId), { params });
  }
}
