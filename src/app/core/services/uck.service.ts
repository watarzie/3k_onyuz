import { Injectable, inject } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { BaseApiService } from './base-api.service';
import { API } from '../constants/api-endpoints';
import { ApiResult, UcKUrunDto, UcKDurumGuncelleDto, TopluTamGeldiDto, UcKDurumSifirlaDto, UcKIsListesiDto, UcKTopluSecimDto } from '../../shared/models/index';

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

  getUrunler(projeId: number, sandikId?: number | null, sandikNo?: string | null): Observable<ApiResult<UcKUrunDto[]>> {
    const endpoint = API.UCK.URUNLER(projeId);
    const query = new URLSearchParams();
    if (sandikId && sandikId > 0) query.set('sandikId', String(sandikId));
    if (sandikNo?.trim()) query.set('sandikNo', sandikNo.trim());
    const queryString = query.toString();
    const url = queryString ? `${endpoint}?${queryString}` : endpoint;

    return this.api.get<UcKUrunDto[]>(url);
  }

  getIsListesi(params: { page?: number; pageSize?: number; isTipi?: string; projeId?: number | null; sadeceBugun?: boolean } = {}): Observable<ApiResult<UcKIsListesiDto>> {
    const query = new URLSearchParams();
    query.set('page', String(params.page ?? 1));
    query.set('pageSize', String(params.pageSize ?? 25));

    if (params.isTipi && params.isTipi !== 'all') {
      query.set('isTipi', params.isTipi);
    }

    if (params.projeId) {
      query.set('projeId', String(params.projeId));
    }

    if (params.sadeceBugun) {
      query.set('sadeceBugun', 'true');
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
  topluSifirla(dto: { projeId: number; cekiSatiriIdler: number[]; secimler?: UcKTopluSecimDto[]; aciklama?: string }): Observable<ApiResult<unknown>> {
    return this.api.put<unknown>(API.UCK.TOPLU_SIFIRLA, dto);
  }
}
