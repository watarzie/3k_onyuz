import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpParams } from '@angular/common/http';
import { BaseApiService } from './base-api.service';
import { API } from '../constants/api-endpoints';
import { ApiResult, PaginatedList, ProjeDto, ProjeOlusturDto, CekiYuklemeResultDto, CekiRevizyonOnizlemeSonuc, CekiRevizyonSonuc, CekiSatiriDto, ProjeDropdownDto, SevkiyatDto, EksiklerdenSahaProjesiOlusturDto, SandiklardanSahaProjesiOlusturDto, SahaAktarimDto, SahaSandikAktarimGeriAlResultDto } from '../../shared/models/index';

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
  private menuOptions(menuKod: string) { return { headers: { 'X-Menu-Kod': menuKod } }; }

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
  getProjeDropdownListesi(filters?: {
    projeTipiId?: number;
    searchTerm?: string;
    isSevkEdilen?: boolean;
    take?: number;
    includeIds?: number[];
  }): Observable<ApiResult<ProjeDropdownDto[]>> {
    let params = new HttpParams();

    if (filters?.projeTipiId !== undefined) params = params.set('projeTipiId', filters.projeTipiId.toString());
    if (filters?.searchTerm?.trim()) params = params.set('searchTerm', filters.searchTerm.trim());
    if (filters?.isSevkEdilen !== undefined) params = params.set('isSevkEdilen', filters.isSevkEdilen.toString());
    if (filters?.take !== undefined) params = params.set('take', filters.take.toString());
    filters?.includeIds?.forEach(id => {
      if (Number.isFinite(id) && id > 0) {
        params = params.append('includeIds', id.toString());
      }
    });

    return this.api.get<ProjeDropdownDto[]>(API.PROJE.DROPDOWN, { params });
  }

  projeOlustur(dto: ProjeOlusturDto): Observable<ApiResult<ProjeDto>> {
    return this.api.post<ProjeDto>(API.PROJE.CREATE, dto);
  }

  eksiklerdenSahaProjesiOlustur(dto: EksiklerdenSahaProjesiOlusturDto): Observable<ApiResult<ProjeDto>> {
    return this.api.post<ProjeDto>(API.PROJE.EKSIKLERDEN_SAHA_OLUSTUR, dto, this.menuOptions('sahaya-aktar'));
  }

  sandiklardanSahaProjesiOlustur(dto: SandiklardanSahaProjesiOlusturDto): Observable<ApiResult<ProjeDto>> {
    return this.api.post<ProjeDto>(
      API.PROJE.SANDIKLARDAN_SAHA_OLUSTUR,
      dto,
      this.menuOptions('sahaya-aktar')
    );
  }

  getSahaAktarimlari(projeId: number): Observable<ApiResult<SahaAktarimDto[]>> {
    return this.api.get<SahaAktarimDto[]>(API.PROJE.SAHA_AKTARIMLARI(projeId), this.menuOptions('saha-aktarim-geri-al'));
  }

  sahaAktarimGeriAl(sahaCekiSatiriId: number, aciklama?: string): Observable<ApiResult<boolean>> {
    return this.api.post<boolean>(
      API.PROJE.SAHA_AKTARIM_GERI_AL,
      {
        sahaCekiSatiriId,
        aciklama: aciklama?.trim() || null
      },
      this.menuOptions('saha-aktarim-geri-al')
    );
  }

  sahaSandikAktarimlariGeriAl(sahaSandikId: number, aciklama?: string): Observable<ApiResult<SahaSandikAktarimGeriAlResultDto>> {
    return this.api.post<SahaSandikAktarimGeriAlResultDto>(
      API.PROJE.SAHA_SANDIK_AKTARIMLARI_GERI_AL,
      {
        sahaSandikId,
        aciklama: aciklama?.trim() || null
      },
      this.menuOptions('saha-aktarim-geri-al')
    );
  }

  sandikKapat(sandikId: number, kapali: boolean): Observable<ApiResult<boolean>> {
    return this.api.put<boolean>(API.PROJE.SANDIK_KAPAT, { sandikId, kapali });
  }

  sevkEt(projeId: number, sevkTarihi?: string, sandikIds?: number[], aciklama?: string, aracPlaka?: string, menuKod?: string): Observable<ApiResult<boolean>> {
    return this.api.post<boolean>(API.PROJE.SEVK_ET(projeId), {
      sevkTarihi: sevkTarihi || null,
      sandikIds: sandikIds ?? null,
      aciklama: aciklama?.trim() || null,
      aracPlaka: aracPlaka?.trim() || null,
    }, menuKod ? this.menuOptions(menuKod) : undefined);
  }

  getSevkiyatlar(projeId: number): Observable<ApiResult<SevkiyatDto[]>> {
    return this.api.get<SevkiyatDto[]>(API.PROJE.SEVKIYATLAR(projeId));
  }

  kilidiAc(
    projeId: number,
    payload: { kilitAcmaTipiId: number; projeNo?: string | null; aciklama?: string | null },
    menuKod?: string
  ): Observable<ApiResult<boolean>> {
    return this.api.post<boolean>(
      API.PROJE.KILIDI_AC(projeId),
      {
        kilitAcmaTipiId: payload.kilitAcmaTipiId,
        projeNo: payload.projeNo?.trim() || null,
        aciklama: payload.aciklama?.trim() || null
      },
      menuKod ? this.menuOptions(menuKod) : undefined
    );
  }

  sevkTarihiGuncelle(projeId: number, planlananSevkTarihi: string | null, menuKod?: string): Observable<ApiResult<boolean>> {
    return this.api.put<boolean>(
      API.PROJE.SEVK_TARIHI_GUNCELLE,
      { projeId, planlananSevkTarihi },
      this.menuOptions(menuKod ?? 'planlanan-sevk-tarihi')
    );
  }

  projeSil(projeId: number, menuKod = 'proje-sil'): Observable<ApiResult<boolean>> {
    return this.api.delete<boolean>(API.PROJE.DELETE(projeId), this.menuOptions(menuKod));
  }

  // ===== Sandık Sevk =====

  sandikSevkEt(projeId: number, sandikId: number, aciklama?: string, aracPlaka?: string): Observable<ApiResult<boolean>> {
    return this.api.post<boolean>(API.SANDIK.SEVK_ET, {
      projeId,
      sandikId,
      aciklama: aciklama?.trim() || null,
      aracPlaka: aracPlaka?.trim() || null,
    });
  }

  // ===== Saha/Yedek Malzeme =====

  sahaYedekMalzemeEkle(payload: {
    projeId: number;
    sandikId: number;
    barkodNo?: string;
    isim: string;
    miktar: number;
    birim?: string;
    birimId?: number | null;
    cekiSatiriId?: number | null;
    kaynakProjeNo?: string;
    aciklama?: string;
  }): Observable<ApiResult<boolean>> {
    return this.api.post<boolean>(API.SANDIK.SAHA_YEDEK_MALZEME_EKLE, payload);
  }

  // ===== Ceki =====

  cekiYukle(dosya: File): Observable<ApiResult<CekiYuklemeResultDto>> {
    const formData = new FormData();
    formData.append('dosya', dosya);
    return this.api.postFormData<CekiYuklemeResultDto>(
      API.CEKI.YUKLE,
      formData,
      this.menuOptions('ceki-yukle')
    );
  }

  cekiRevizyonOnizle(dosya: File): Observable<ApiResult<CekiRevizyonOnizlemeSonuc>> {
    const formData = new FormData();
    formData.append('dosya', dosya);
    return this.api.postFormData<CekiRevizyonOnizlemeSonuc>(
      API.CEKI.REVIZYON_ONIZLE,
      formData,
      this.menuOptions('ceki-revizyon-yukle')
    );
  }

  cekiRevizyonYukle(dosya: File): Observable<ApiResult<CekiRevizyonSonuc>> {
    const formData = new FormData();
    formData.append('dosya', dosya);
    return this.api.postFormData<CekiRevizyonSonuc>(
      API.CEKI.REVIZYON_YUKLE,
      formData,
      this.menuOptions('ceki-revizyon-yukle')
    );
  }

  getCekiSatirlari(cekiId: number): Observable<ApiResult<CekiSatiriDto[]>> {
    return this.api.get<CekiSatiriDto[]>(API.CEKI.SATIRLAR(cekiId));
  }
}
