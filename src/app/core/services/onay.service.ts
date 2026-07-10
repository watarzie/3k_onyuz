import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseApiService } from './base-api.service';
import { API } from '../constants/api-endpoints';
import { ApiResult } from '../../shared/models/common.model';
import { OnayBekleyenIslemDto, IslemOnaylaCommand, IslemReddetCommand } from '../../shared/models/onay-bekleyen-islem.model';

export interface OnayKuraliDto {
  lookupUcKDurumId: number | null;
  islemKodu: string;
  islemAdi: string;
  onayGerektirirMi: boolean;
  onayGerektirirMiDegistirilebilir: boolean;
  yetkiliRolIdleri: number[];
}

export interface OnayKuraliGuncelleRequest {
  lookupUcKDurumId: number | null;
  islemKodu: string;
  onayGerektirirMi: boolean;
  yetkiliRolIdleri: number[];
}

@Injectable({
  providedIn: 'root'
})
export class OnayService {
  private api = inject(BaseApiService);

  getBekleyenler(): Observable<ApiResult<OnayBekleyenIslemDto[]>> {
    return this.api.get<OnayBekleyenIslemDto[]>(API.ONAY.BEKLEYENLER);
  }

  getBekleyenSayisi(): Observable<ApiResult<number>> {
    return this.api.get<number>(API.ONAY.BEKLEYEN_SAYISI);
  }

  onayla(command: IslemOnaylaCommand): Observable<ApiResult<any>> {
    return this.api.post<any>(API.ONAY.ONAYLA, command);
  }

  reddet(command: IslemReddetCommand): Observable<ApiResult<any>> {
    return this.api.post<any>(API.ONAY.REDDET, command);
  }

  getKurallar(): Observable<ApiResult<OnayKuraliDto[]>> {
    return this.api.get<OnayKuraliDto[]>(`${API.ONAY.BEKLEYENLER.replace('/bekleyenler', '')}/kurallar`);
  }

  updateKural(request: OnayKuraliGuncelleRequest): Observable<ApiResult<any>> {
    return this.api.put<any>(`${API.ONAY.BEKLEYENLER.replace('/bekleyenler', '')}/kural-guncelle`, request);
  }
}
