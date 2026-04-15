import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseApiService } from '../../core/services/base-api.service';
import { API } from '../../core/constants/api-endpoints';
import { ApiResult, SandikDto, SandikDetayDto } from '../../shared/models/index';

@Injectable({ providedIn: 'root' })
export class SandikService {
  private api = inject(BaseApiService);

  getSandiklar(projeId: number): Observable<ApiResult<SandikDto[]>> {
    return this.api.get<SandikDto[]>(API.SANDIK.BY_PROJE(projeId));
  }

  getSandikIcerik(sandikId: number): Observable<ApiResult<SandikDetayDto>> {
    return this.api.get<SandikDetayDto>(API.SANDIK.ICERIK(sandikId));
  }

  teslimAl(body: { cekiSatiriId: number; projeId: number; gelenMiktar: number; not?: string }): Observable<ApiResult<unknown>> {
    return this.api.put<unknown>(API.SANDIK.TESLIM_AL, body);
  }

  topluTeslimAl(body: { projeId: number; urunler: { cekiSatiriId: number; gelenMiktar: number }[]; not?: string }): Observable<ApiResult<unknown>> {
    return this.api.post<unknown>(API.SANDIK.TOPLU_TESLIM_AL, body);
  }

  urunGuncelle(body: unknown): Observable<ApiResult<unknown>> {
    return this.api.put<unknown>(API.SANDIK.URUN_GUNCELLE, body);
  }

  sandikDegistir(body: { cekiSatiriId: number; yeniFiiliSandikNo: string; projeId: number; kullaniciId: number }): Observable<ApiResult<unknown>> {
    return this.api.put<unknown>(API.SANDIK.DEGISTIR, body);
  }

  iptal(body: { cekiSatiriId: number; projeId: number; kullaniciId: number }): Observable<ApiResult<unknown>> {
    return this.api.post<unknown>(API.SANDIK.IPTAL, body);
  }

  stokKarsila(body: unknown): Observable<ApiResult<unknown>> {
    return this.api.post<unknown>(API.SANDIK.STOKTAN_KARSILA, body);
  }

  fbKarsila(body: unknown): Observable<ApiResult<unknown>> {
    return this.api.post<unknown>(API.SANDIK.FBDEN_KARSILA, body);
  }

  sandikEkle(body: { projeId: number; sandikNo: string; tip: string; depoLokasyonu: string }): Observable<ApiResult<unknown>> {
    return this.api.post<unknown>(API.SANDIK.EKLE, body);
  }

  getEksikUrunler(projeId: number): Observable<ApiResult<unknown>> {
    return this.api.get<unknown>(API.SANDIK.EKSIK_URUNLER(projeId));
  }
}
