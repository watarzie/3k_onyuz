import { Injectable, inject } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { BaseApiService } from './base-api.service';
import { API } from '../constants/api-endpoints';
import { ApiResult, UcKUrunDto, UcKDurumGuncelleDto, TopluTamGeldiDto, UcKDurumSifirlaDto } from '../../shared/models/index';

/**
 * UcKController:
 *  GET  /api/uck/{projeId}/urunler
 *  PUT  /api/uck/durum-guncelle
 *  PUT  /api/uck/durum-sifirla
 *  POST /api/uck/toplu-tam-geldi
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

  durumSifirla(dto: UcKDurumSifirlaDto): Observable<ApiResult<unknown>> {
    return this.api.put<unknown>(API.UCK.DURUM_SIFIRLA, dto);
  }

  topluTamGeldi(dto: TopluTamGeldiDto): Observable<ApiResult<unknown>> {
    return this.api.post<unknown>(API.UCK.TOPLU_TAM_GELDI, dto);
  }
}
