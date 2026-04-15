import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseApiService } from './base-api.service';
import { API } from '../constants/api-endpoints';
import { ApiResult, StokKaydiDto, StokKaydiOlusturDto, StokKarsilamaDto } from '../../shared/models/index';

/**
 * StokController (3 endpoint):
 *  GET  /api/stok
 *  POST /api/stok
 *  POST /api/stok/karsila
 */
@Injectable({ providedIn: 'root' })
export class StokService {
  private api = inject(BaseApiService);

  getStokListesi(malzemeKodu?: string): Observable<ApiResult<StokKaydiDto[]>> {
    const url = malzemeKodu ? `${API.STOK.LIST}?malzemeKodu=${malzemeKodu}` : API.STOK.LIST;
    return this.api.get<StokKaydiDto[]>(url);
  }

  stokOlustur(dto: StokKaydiOlusturDto): Observable<ApiResult<unknown>> {
    return this.api.post<unknown>(API.STOK.CREATE, dto);
  }

  stokKarsila(dto: StokKarsilamaDto): Observable<ApiResult<unknown>> {
    return this.api.post<unknown>(API.STOK.KARSILA, dto);
  }
}
