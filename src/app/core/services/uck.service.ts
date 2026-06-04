import { Injectable, inject } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { BaseApiService } from './base-api.service';
import { API } from '../constants/api-endpoints';
import { ApiResult, UcKUrunDto, UcKDurumGuncelleDto, TopluTamGeldiDto, UcKDurumSifirlaDto, UcKIsListesiDto } from '../../shared/models/index';

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

  getIsListesi(params: { page?: number; pageSize?: number; isTipi?: string; projeId?: number | null } = {}): Observable<ApiResult<UcKIsListesiDto>> {
    const query = new URLSearchParams();
    query.set('page', String(params.page ?? 1));
    query.set('pageSize', String(params.pageSize ?? 25));

    if (params.isTipi && params.isTipi !== 'all') {
      query.set('isTipi', params.isTipi);
    }

    if (params.projeId) {
      query.set('projeId', String(params.projeId));
    }

    return this.api.get<UcKIsListesiDto>(`${API.UCK.IS_LISTESI}?${query.toString()}`);
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

  topluTedarikci(dto: TopluTamGeldiDto): Observable<ApiResult<unknown>> {
    return this.api.post<unknown>(API.UCK.TOPLU_TEDARIKCI, dto);
  }

  /** Toplu 3K durumu sıfırlama (geri alma) */
  topluSifirla(dto: { projeId: number; cekiSatiriIdler: number[]; aciklama?: string }): Observable<ApiResult<unknown>> {
    return this.api.put<unknown>(API.UCK.TOPLU_SIFIRLA, dto);
  }
}
