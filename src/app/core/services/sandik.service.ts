import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseApiService } from './base-api.service';
import { API } from '../constants/api-endpoints';
import {
  ApiResult, SandikDto, SandikDetayDto, SandikEkleDto, ManuelUrunEkleDto,
  UrunGuncelleDto, SandikDegistirDto, TeslimAlDto, TopluTeslimAlDto,
  UrunIptalDto, StokKarsilamaDto, EksikUrunDto, UrunTasiDto
} from '../../shared/models/index';

/**
 * SandikController (13 endpoint):
 *  GET  /api/sandik/proje/{projeId}
 *  GET  /api/sandik/{sandikId}/icerik
 *  PUT  /api/sandik/urun-guncelle
 *  PUT  /api/sandik/degistir
 *  POST /api/sandik/manuel-ekle
 *  POST /api/sandik/iptal
 *  POST /api/sandik/stoktan-karsila
 *  POST /api/sandik/fbden-karsila
 *  POST /api/sandik/ekle
 *  PUT  /api/sandik/teslim-al
 *  POST /api/sandik/toplu-teslim-al
 *  GET  /api/sandik/eksik-urunler/{projeId}
 */
@Injectable({ providedIn: 'root' })
export class SandikService {
  private api = inject(BaseApiService);

  // ===== Sorgular =====

  getSandiklar(projeId: number): Observable<ApiResult<SandikDto[]>> {
    return this.api.get<SandikDto[]>(API.SANDIK.BY_PROJE(projeId));
  }

  getSandikIcerik(sandikId: number): Observable<ApiResult<SandikDetayDto>> {
    return this.api.get<SandikDetayDto>(API.SANDIK.ICERIK(sandikId));
  }

  getEksikUrunler(projeId: number): Observable<ApiResult<EksikUrunDto[]>> {
    return this.api.get<EksikUrunDto[]>(API.SANDIK.EKSIK_URUNLER(projeId));
  }

  // ===== 3K Teslim Alma =====

  teslimAl(dto: TeslimAlDto): Observable<ApiResult<unknown>> {
    return this.api.put<unknown>(API.SANDIK.TESLIM_AL, dto);
  }

  topluTeslimAl(dto: TopluTeslimAlDto): Observable<ApiResult<unknown>> {
    return this.api.post<unknown>(API.SANDIK.TOPLU_TESLIM_AL, dto);
  }

  // ===== Ürün / Sandık İşlemleri =====

  urunGuncelle(dto: UrunGuncelleDto): Observable<ApiResult<unknown>> {
    return this.api.put<unknown>(API.SANDIK.URUN_GUNCELLE, dto);
  }

  sandikDegistir(dto: SandikDegistirDto): Observable<ApiResult<unknown>> {
    return this.api.put<unknown>(API.SANDIK.DEGISTIR, dto);
  }

  urunIptal(dto: UrunIptalDto): Observable<ApiResult<unknown>> {
    return this.api.post<unknown>(API.SANDIK.IPTAL, dto);
  }

  // ===== Ekleme =====

  sandikEkle(dto: SandikEkleDto): Observable<ApiResult<unknown>> {
    return this.api.post<unknown>(API.SANDIK.EKLE, dto);
  }

  manuelUrunEkle(dto: ManuelUrunEkleDto): Observable<ApiResult<unknown>> {
    return this.api.post<unknown>(API.SANDIK.MANUEL_EKLE, dto);
  }

  // ===== Stok / FB Karşılama =====

  stoktanKarsila(dto: StokKarsilamaDto): Observable<ApiResult<unknown>> {
    return this.api.post<unknown>(API.SANDIK.STOKTAN_KARSILA, dto);
  }

  fbdenKarsila(dto: unknown): Observable<ApiResult<unknown>> {
    return this.api.post<unknown>(API.SANDIK.FBDEN_KARSILA, dto);
  }

  kapat(sandikId: number, forceClose: boolean = false): Observable<any> {
    return this.api.post<any>(API.SANDIK.KAPAT, { sandikId, forceClose });
  }

  topluKapat(sandikIds: number[], forceClose: boolean = false): Observable<any> {
    return this.api.post<any>(API.SANDIK.TOPLU_KAPAT, { sandikIds, forceClose });
  }

  lokasyonGuncelle(sandikIds: number[], depoLokasyonId: number): Observable<ApiResult<unknown>> {
    return this.api.put<unknown>(API.SANDIK.LOKASYON_GUNCELLE, { sandikIds, depoLokasyonId });
  }

  urunTasi(dto: UrunTasiDto): Observable<ApiResult<unknown>> {
    return this.api.post<unknown>(API.SANDIK.URUN_TASI, dto);
  }
}
