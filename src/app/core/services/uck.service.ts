import { Injectable, inject } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { BaseApiService } from './base-api.service';
import { API } from '../constants/api-endpoints';
import { ApiResult, UcKUrunDto, UcKDurumGuncelleDto, TopluTamGeldiDto, NotEkleDto, NotDto } from '../../shared/models/index';

/**
 * UcKController + Not endpoints:
 *  GET  /api/uck/{projeId}/urunler
 *  PUT  /api/uck/durum-guncelle
 *  POST /api/uck/toplu-tam-geldi
 *  POST /api/not/ekle
 *  GET  /api/not/{tip}/{id}/notlar
 */
@Injectable({ providedIn: 'root' })
export class UcKService {
  private api = inject(BaseApiService);

  private uckGuncellendi = new Subject<void>();
  public uckGuncellendi$ = this.uckGuncellendi.asObservable();
  private channel = new BroadcastChannel('uck_sync_channel');

  constructor() {
    this.channel.onmessage = (event) => {
      if (event.data === 'UCK_UPDATED') {
        this.uckGuncellendi.next();
      }
    };
  }

  notifyUckUpdated() {
    this.uckGuncellendi.next();
    this.channel.postMessage('UCK_UPDATED');
  }

  getUrunler(projeId: number): Observable<ApiResult<UcKUrunDto[]>> {
    return this.api.get<UcKUrunDto[]>(API.UCK.URUNLER(projeId));
  }

  durumGuncelle(dto: UcKDurumGuncelleDto): Observable<ApiResult<unknown>> {
    return this.api.put<unknown>(API.UCK.DURUM_GUNCELLE, dto);
  }

  topluTamGeldi(dto: TopluTamGeldiDto): Observable<ApiResult<unknown>> {
    return this.api.post<unknown>(API.UCK.TOPLU_TAM_GELDI, dto);
  }

  notEkle(dto: NotEkleDto): Observable<ApiResult<unknown>> {
    return this.api.post<unknown>(API.NOT.EKLE, dto);
  }

  getNotlar(bagliTip: string, bagliId: number): Observable<ApiResult<NotDto[]>> {
    return this.api.get<NotDto[]>(API.NOT.BY_REF(bagliTip, bagliId));
  }
}
