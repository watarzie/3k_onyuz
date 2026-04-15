import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseApiService } from './base-api.service';
import { API } from '../constants/api-endpoints';
import { ApiResult, UcKUrunDto, UcKDurumGuncelleDto } from '../../shared/models/index';

/**
 * UcKController (2 endpoint):
 *  GET  /api/uck/urunler/{projeId}
 *  PUT  /api/uck/durum-guncelle
 */
@Injectable({ providedIn: 'root' })
export class UcKService {
  private api = inject(BaseApiService);

  getUrunler(projeId: number): Observable<ApiResult<UcKUrunDto[]>> {
    return this.api.get<UcKUrunDto[]>(API.UCK.URUNLER(projeId));
  }

  durumGuncelle(dto: UcKDurumGuncelleDto): Observable<ApiResult<unknown>> {
    return this.api.put<unknown>(API.UCK.DURUM_GUNCELLE, dto);
  }
}
