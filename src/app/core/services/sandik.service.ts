import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseApiService } from './base-api.service';
import { API } from '../constants/api-endpoints';
import {
  ApiResult, SandikDto, SandikDetayDto, SandikEkleDto, ManuelUrunEkleDto,
  UrunGuncelleDto, SandikDegistirDto, TeslimAlDto, TopluTeslimAlDto,
  UrunIptalDto, StokKarsilamaDto, EksikUrunDto, UrunTasiDto, SandikOzellikGuncelleDto,
  CekiSatiriAnaVeriGuncelleDto, CekiSatirlariSilDto, CekiSatirlariSilResultDto
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
  private readonly cekiVerisiDuzenleOptions = { headers: { 'X-Menu-Kod': 'ceki-verisi-duzenle' } };
  private readonly cekiVerisiSilOptions = { headers: { 'X-Menu-Kod': 'ceki-verisi-sil' } };

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

  cekiSatiriAnaVeriGuncelle(dto: CekiSatiriAnaVeriGuncelleDto): Observable<ApiResult<unknown>> {
    return this.api.put<unknown>(API.SANDIK.CEKI_SATIRI_GUNCELLE, dto, this.cekiVerisiDuzenleOptions);
  }

  cekiSatirlariSil(cekiSatiriIds: number[]): Observable<ApiResult<CekiSatirlariSilResultDto>> {
    const dto: CekiSatirlariSilDto = { cekiSatiriIds };
    return this.api.post<CekiSatirlariSilResultDto>(API.SANDIK.CEKI_SATIRLARI_SIL, dto, this.cekiVerisiSilOptions);
  }

  ozellikGuncelle(dto: SandikOzellikGuncelleDto): Observable<ApiResult<unknown>> {
    return this.api.put<unknown>(API.SANDIK.OZELLIK_GUNCELLE, dto);
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

  // ===== Silme =====

  manuelUrunSil(projeId: number, cekiSatiriId?: number, sandikIcerikId?: number): Observable<ApiResult<unknown>> {
    let url = `${API.SANDIK.MANUEL_URUN_SIL}?projeId=${projeId}`;
    if (cekiSatiriId) url += `&cekiSatiriId=${cekiSatiriId}`;
    if (sandikIcerikId) url += `&sandikIcerikId=${sandikIcerikId}`;
    return this.api.delete<unknown>(url);
  }

  sandikSil(sandikId: number, projeId: number): Observable<ApiResult<unknown>> {
    return this.api.delete<unknown>(`${API.SANDIK.SIL}?sandikId=${sandikId}&projeId=${projeId}`);
  }

  getEksikUrunlerByProje(projeId: number): Observable<ApiResult<any[]>> {
    return this.api.get<any[]>(API.SANDIK.EKSIK_URUNLER_BY_PROJE(projeId));
  }
}
