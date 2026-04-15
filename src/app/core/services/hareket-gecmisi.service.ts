import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseApiService } from './base-api.service';
import { API } from '../constants/api-endpoints';
import { ApiResult, HareketGecmisiDto } from '../../shared/models/index';

/**
 * HareketGecmisiController (1 endpoint):
 *  GET /api/hareketgecmisi/proje/{projeId}
 */
@Injectable({ providedIn: 'root' })
export class HareketGecmisiService {
  private api = inject(BaseApiService);

  getByProje(projeId: number): Observable<ApiResult<HareketGecmisiDto[]>> {
    return this.api.get<HareketGecmisiDto[]>(API.HAREKET.BY_PROJE(projeId));
  }
}
