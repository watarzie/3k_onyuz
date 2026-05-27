import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpParams } from '@angular/common/http';
import { BaseApiService } from './base-api.service';
import { API } from '../constants/api-endpoints';
import { ApiResult, PaginatedList, ProjeDto, ProjeOlusturDto, CekiYuklemeResultDto, CekiSatiriDto, ProjeDropdownDto, SevkiyatDto } from '../../shared/models/index';

/**
 * ProjeController (2 endpoint) + CekiController (2 endpoint):
 *  GET  /api/proje
 *  POST /api/proje
 *  POST /api/ceki/yukle
 *  GET  /api/ceki/satirlar/{cekiId}
 */
@Injectable({ providedIn: 'root' })
export class ProjeService {
  private api = inject(BaseApiService);
  private readonly projeSilOptions = { headers: { 'X-Menu-Kod': 'proje-sil' } };

  // ===== Proje =====

  getProjeListesi(
    pageNumber: number = 1,
    pageSize: number = 15,
    projeTipiId?: number,
    searchTerm?: string,
    isSevkEdilen?: boolean
  ): Observable<ApiResult<PaginatedList<ProjeDto>>> {
    let params = new HttpParams()
      .set('pageNumber', pageNumber.toString())
      .set('pageSize', pageSize.toString());
    if (projeTipiId !== undefined) params = params.set('projeTipiId', projeTipiId.toString());
    if (searchTerm) params = params.set('searchTerm', searchTerm);
    if (isSevkEdilen !== undefined) params = params.set('isSevkEdilen', isSevkEdilen.toString());
    return this.api.get<PaginatedList<ProjeDto>>(API.PROJE.LIST, { params });
  }

  /** Dropdown'lar için hafif proje listesi — Include yok, sadece Id/ProjeNo/Musteri */
  getProjeDropdownListesi(): Observable<ApiResult<ProjeDropdownDto[]>> {
    return this.api.get<ProjeDropdownDto[]>(API.PROJE.DROPDOWN);
  }

  projeOlustur(dto: ProjeOlusturDto): Observable<ApiResult<unknown>> {
    return this.api.post<unknown>(API.PROJE.CREATE, dto);
  }

  sandikKapat(sandikId: number, kapali: boolean): Observable<ApiResult<boolean>> {
    return this.api.put<boolean>(API.PROJE.SANDIK_KAPAT, { sandikId, kapali });
  }

  sevkEt(projeId: number, sevkTarihi?: string, sandikIds?: number[], aciklama?: string): Observable<ApiResult<boolean>> {
    return this.api.post<boolean>(API.PROJE.SEVK_ET(projeId), {
      sevkTarihi: sevkTarihi || null,
      sandikIds: sandikIds ?? null,
      aciklama: aciklama?.trim() || null,
    });
  }

  getSevkiyatlar(projeId: number): Observable<ApiResult<SevkiyatDto[]>> {
    return this.api.get<SevkiyatDto[]>(API.PROJE.SEVKIYATLAR(projeId));
  }

  kilidiAc(projeId: number): Observable<ApiResult<boolean>> {
    return this.api.post<boolean>(API.PROJE.KILIDI_AC(projeId), {});
  }

  sevkTarihiGuncelle(projeId: number, planlananSevkTarihi: string | null): Observable<ApiResult<boolean>> {
    return this.api.put<boolean>(API.PROJE.SEVK_TARIHI_GUNCELLE, { projeId, planlananSevkTarihi });
  }

  projeSil(projeId: number): Observable<ApiResult<boolean>> {
    return this.api.delete<boolean>(API.PROJE.DELETE(projeId), this.projeSilOptions);
  }

  // ===== Sandık Sevk =====

  sandikSevkEt(projeId: number, sandikId: number): Observable<ApiResult<boolean>> {
    return this.api.post<boolean>(API.SANDIK.SEVK_ET, { projeId, sandikId });
  }

  // ===== Saha/Yedek Malzeme =====

  sahaYedekMalzemeEkle(payload: { projeId: number; sandikId: number; barkodNo?: string; isim: string; miktar: number; birim?: string }): Observable<ApiResult<boolean>> {
    return this.api.post<boolean>(API.SANDIK.SAHA_YEDEK_MALZEME_EKLE, payload);
  }

  // ===== Ceki =====

  cekiYukle(dosya: File): Observable<ApiResult<CekiYuklemeResultDto>> {
    const formData = new FormData();
    formData.append('dosya', dosya);
    return this.api.postFormData<CekiYuklemeResultDto>(API.CEKI.YUKLE, formData);
  }

  getCekiSatirlari(cekiId: number): Observable<ApiResult<CekiSatiriDto[]>> {
    return this.api.get<CekiSatiriDto[]>(API.CEKI.SATIRLAR(cekiId));
  }
}
