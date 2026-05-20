import { Injectable, inject } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { BaseApiService } from '../../core/services/base-api.service';
import { API } from '../../core/constants/api-endpoints';
import { ApiResult, GridUrunDto, GridDurumGuncelleDto, GridTopluSevkDto, GridDurumSifirlaDto, KaliteDurumGuncelleDto, SurecDurumGuncelleDto } from '../../shared/models/index';

/**
 * GridController endpoints:
 *  GET  /api/grid/urunler/{projeId}
 *  PUT  /api/grid/durum-guncelle
 *  PUT  /api/grid/durum-sifirla
 *  POST /api/grid/toplu-sevk
 *  PUT  /api/grid/kalite-durum
 *  PUT  /api/grid/surec-durum
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

  /** Tekli ürün durumu güncelle */
  durumGuncelle(dto: GridDurumGuncelleDto): Observable<ApiResult<unknown>> {
    return this.api.put<unknown>(API.GRID.DURUM_GUNCELLE, dto);
  }

  /** Grid durumını sıfırla */
  durumSifirla(dto: GridDurumSifirlaDto): Observable<ApiResult<unknown>> {
    return this.api.put<unknown>(API.GRID.DURUM_SIFIRLA, dto);
  }

  /** Birden fazla ürünü tek seferde SevkEdildi yap */
  topluSevk(dto: GridTopluSevkDto): Observable<ApiResult<unknown>> {
    return this.api.post<unknown>(API.GRID.TOPLU_SEVK, dto);
  }

  /** Grid sayfasından manuel ürün ekle */
  manuelUrunEkle(dto: any): Observable<ApiResult<unknown>> {
    return this.api.post<unknown>(API.GRID.MANUEL_EKLE, dto);
  }

  /** Kalite durumunu güncelle (tekli/toplu) */
  kaliteDurumGuncelle(dto: KaliteDurumGuncelleDto): Observable<ApiResult<unknown>> {
    return this.api.put<unknown>(API.GRID.KALITE_DURUM, dto, {
      headers: { 'X-Menu-Kod': 'kalite-modulu' }
    });
  }

  /** Süreç durumunu güncelle (tekli/toplu) */
  surecDurumGuncelle(dto: SurecDurumGuncelleDto): Observable<ApiResult<unknown>> {
    return this.api.put<unknown>(API.GRID.SUREC_DURUM, dto, {
      headers: { 'X-Menu-Kod': 'surec-modulu' }
    });
  }

  /** Toplu Grid durum güncelleme (Tam Geldi / Grid Kapandı / İptal) */
  topluDurumGuncelle(dto: { projeId: number; cekiSatiriIdler: number[]; hedefDurumId: number; aciklama?: string }): Observable<ApiResult<unknown>> {
    return this.api.put<unknown>(API.GRID.TOPLU_DURUM_GUNCELLE, dto);
  }

  /** Toplu Grid durumu sıfırlama (geri alma) */
  topluSifirla(dto: { projeId: number; cekiSatiriIdler: number[]; aciklama?: string }): Observable<ApiResult<unknown>> {
    return this.api.put<unknown>(API.GRID.TOPLU_SIFIRLA, dto);
  }
}

