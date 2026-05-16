import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseApiService } from './base-api.service';
import { API } from '../constants/api-endpoints';
import { ApiResult, ProjeDto, ProjeOlusturDto, CekiYuklemeResultDto, CekiSatiriDto, ProjeDropdownDto, ManuelCekiOlusturDto } from '../../shared/models/index';

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

  // ===== Proje =====

  getProjeListesi(): Observable<ApiResult<ProjeDto[]>> {
    return this.api.get<ProjeDto[]>(API.PROJE.LIST);
  }

  getProjeListesiByTip(projeTipiId: number): Observable<ApiResult<ProjeDto[]>> {
    return this.api.get<ProjeDto[]>(API.PROJE.LIST_BY_TIP(projeTipiId));
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

  sevkEt(projeId: number, sevkTarihi?: string): Observable<ApiResult<boolean>> {
    return this.api.post<boolean>(API.PROJE.SEVK_ET(projeId), { sevkTarihi: sevkTarihi || null });
  }

  kilidiAc(projeId: number): Observable<ApiResult<boolean>> {
    return this.api.post<boolean>(API.PROJE.KILIDI_AC(projeId), {});
  }

  sevkTarihiGuncelle(projeId: number, planlananSevkTarihi: string | null): Observable<ApiResult<boolean>> {
    return this.api.put<boolean>(API.PROJE.SEVK_TARIHI_GUNCELLE, { projeId, planlananSevkTarihi });
  }

  projeSil(projeId: number): Observable<ApiResult<boolean>> {
    return this.api.delete<boolean>(API.PROJE.DELETE(projeId));
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

  cekiManuelOlustur(payload: ManuelCekiOlusturDto): Observable<ApiResult<CekiYuklemeResultDto>> {
    return this.api.post<CekiYuklemeResultDto>(API.CEKI.MANUEL, payload);
  }

  getCekiSatirlari(cekiId: number): Observable<ApiResult<CekiSatiriDto[]>> {
    return this.api.get<CekiSatiriDto[]>(API.CEKI.SATIRLAR(cekiId));
  }
}
