import { HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseApiService } from './base-api.service';
import { API } from '../constants/api-endpoints';
import { ApiResult } from '../../shared/models/common.model';
import { OnayBekleyenIslemDto, IslemOnaylaCommand, IslemReddetCommand } from '../../shared/models/onay-bekleyen-islem.model';
import {
  OnayGecmisiDto,
  OnayGecmisiListeDto,
  OnayGecmisiListeFiltre,
} from '../../shared/models/onay-gecmisi.model';

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

  getGecmis(filtre: OnayGecmisiListeFiltre): Observable<ApiResult<OnayGecmisiListeDto>> {
    let params = new HttpParams()
      .set('kapsam', filtre.kapsam)
      .set('sayfa', filtre.sayfa)
      .set('sayfaBoyutu', filtre.sayfaBoyutu);

    params = params
      .set('durum', filtre.durum)
      .set('calistirmaDurumu', filtre.calistirmaDurumu);
    if (filtre.baslangicTarihi) params = params.set('baslangicTarihi', filtre.baslangicTarihi);
    if (filtre.bitisTarihi) params = params.set('bitisTarihi', filtre.bitisTarihi);
    if (filtre.arama?.trim()) params = params.set('arama', filtre.arama.trim());

    return this.api.get<OnayGecmisiListeDto>(API.ONAY.GECMIS, { params });
  }

  getGecmisDetayi(id: number): Observable<ApiResult<OnayGecmisiDto>> {
    return this.api.get<OnayGecmisiDto>(API.ONAY.GECMIS_DETAY(id));
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
