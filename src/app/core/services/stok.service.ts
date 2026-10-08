import { Injectable, inject } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { HttpParams } from '@angular/common/http';
import { BaseApiService } from './base-api.service';
import { API } from '../constants/api-endpoints';
import { ApiResult, StokDurumSayilariDto, StokKaydiDto, StokKaydiOlusturDto } from '../../shared/models/index';
import { PaginatedList } from '../../shared/models/common.model';

/**
 * StokController (3 endpoint):
 *  GET  /api/stok
 *  POST /api/stok
 *  POST /api/stok/karsila
 */
@Injectable({ providedIn: 'root' })
export class StokService {
  private api = inject(BaseApiService);

  private stokListesiGuncellendi = new Subject<void>();
  public stokListesiGuncellendi$ = this.stokListesiGuncellendi.asObservable();
  private channel = new BroadcastChannel('stok_sync_channel');

  constructor() {
    this.channel.onmessage = (event) => {
      if (event.data === 'STOK_UPDATED') {
        this.stokListesiGuncellendi.next();
      }
    };
  }

  notifyStokUpdated() {
    this.stokListesiGuncellendi.next();
    this.channel.postMessage('STOK_UPDATED');
  }

  /** Sunucu sayfalı liste; durum verilirse yalnız o durumdaki kayıtlar döner, verilmezse hepsi. */
  getStokListesi(searchTerm?: string, pageNumber: number = 1, pageSize: number = 15, durumId?: number): Observable<ApiResult<PaginatedList<StokKaydiDto>>> {
    let params = new HttpParams()
      .set('pageNumber', pageNumber.toString())
      .set('pageSize', pageSize.toString());

    if (searchTerm) {
      params = params.set('searchTerm', searchTerm);
    }
    if (durumId) {
      params = params.set('durumId', durumId.toString());
    }
    
    // BaseApiService accepts params in HttpOptions 
    return this.api.get<PaginatedList<StokKaydiDto>>(API.STOK.LIST, { params });
  }

  /** Aktif Stok / Tükendiler sekme sayaçları; arama listeyle aynı uygulanır. */
  getStokSayilari(searchTerm?: string): Observable<ApiResult<StokDurumSayilariDto>> {
    const params = searchTerm ? new HttpParams().set('searchTerm', searchTerm) : undefined;
    return this.api.get<StokDurumSayilariDto>(API.STOK.SAYILAR, params ? { params } : undefined);
  }

  stokOlustur(dto: StokKaydiOlusturDto): Observable<ApiResult<unknown>> {
    return this.api.post<unknown>(API.STOK.CREATE, dto);
  }

  stokGuncelle(id: number, dto: any): Observable<ApiResult<unknown>> {
    return this.api.put<unknown>(`${API.STOK.CREATE}/${id}`, dto);
  }

  stokSil(id: number): Observable<ApiResult<unknown>> {
    return this.api.delete<unknown>(API.STOK.DELETE(id));
  }
}
