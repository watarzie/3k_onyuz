import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseApiService } from '../../core/services/base-api.service';
import { API } from '../../core/constants/api-endpoints';
import { ApiResult, GridUrunDto, GridDurumGuncelleDto, GridTopluSevkDto } from '../../core/models/api-response.model';

/**
 * GridController (3 endpoint):
 *  GET  /api/grid/urunler/{projeId}
 *  PUT  /api/grid/durum-guncelle
 *  POST /api/grid/toplu-sevk
 */
@Injectable({ providedIn: 'root' })
export class GridService {
  private api = inject(BaseApiService);

  /** Proje bazında tüm ürünlerin grid + 3K durumları */
  getUrunler(projeId: number): Observable<ApiResult<GridUrunDto[]>> {
    return this.api.get<GridUrunDto[]>(API.GRID.URUNLER(projeId));
  }

  /** Tekli ürün durumu güncelle (Üretimde → StokHazır → SevkEdildi vb.) */
  durumGuncelle(dto: GridDurumGuncelleDto): Observable<ApiResult<unknown>> {
    return this.api.put<unknown>(API.GRID.DURUM_GUNCELLE, dto);
  }

  /** Birden fazla ürünü tek seferde SevkEdildi yap */
  topluSevk(dto: GridTopluSevkDto): Observable<ApiResult<unknown>> {
    return this.api.post<unknown>(API.GRID.TOPLU_SEVK, dto);
  }
}
