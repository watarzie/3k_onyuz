import { Injectable, inject } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { BaseApiService } from '../../core/services/base-api.service';
import { API } from '../../core/constants/api-endpoints';
import { ApiResult, GridUrunDto, GridDurumGuncelleDto, GridTopluSevkDto, GridDurumSifirlaDto } from '../../shared/models/index';

/**
 * GridController (3 endpoint):
 *  GET  /api/grid/urunler/{projeId}
 *  PUT  /api/grid/durum-guncelle
 *  PUT  /api/grid/durum-sifirla
 *  POST /api/grid/toplu-sevk
 */
@Injectable({ providedIn: 'root' })
export class GridService {
  private api = inject(BaseApiService);

  private gridGuncellendi = new Subject<void>();
  public gridGuncellendi$ = this.gridGuncellendi.asObservable();
  private channel = new BroadcastChannel('grid_sync_channel');

  constructor() {
    this.channel.onmessage = (event) => {
      if (event.data === 'GRID_UPDATED') {
        this.gridGuncellendi.next();
      }
    };
  }

  notifyGridUpdated() {
    this.gridGuncellendi.next();
    this.channel.postMessage('GRID_UPDATED');
  }

  /** Proje bazında tüm ürünlerin grid + 3K durumları */
  getUrunler(projeId: number): Observable<ApiResult<GridUrunDto[]>> {
    return this.api.get<GridUrunDto[]>(API.GRID.URUNLER(projeId));
  }

  /** Tekli ürün durumu güncelle (Üretimde → StokHazır → SevkEdildi vb.) */
  durumGuncelle(dto: GridDurumGuncelleDto): Observable<ApiResult<unknown>> {
    return this.api.put<unknown>(API.GRID.DURUM_GUNCELLE, dto);
  }

  /** Grid durumını sıfırla — çeki yüklenme öncesi ham duruma döndür */
  durumSifirla(dto: GridDurumSifirlaDto): Observable<ApiResult<unknown>> {
    return this.api.put<unknown>(API.GRID.DURUM_SIFIRLA, dto);
  }

  /** Birden fazla ürünü tek seferde SevkEdildi yap */
  topluSevk(dto: GridTopluSevkDto): Observable<ApiResult<unknown>> {
    return this.api.post<unknown>(API.GRID.TOPLU_SEVK, dto);
  }
}
