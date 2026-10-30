import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpParams } from '@angular/common/http';
import { BaseApiService } from './base-api.service';
import { API } from '../constants/api-endpoints';
import { ApiResult, PaginatedList, ProjeDto, ProjeOlusturDto, CekiYuklemeResultDto, CekiRevizyonApiResult, CekiRevizyonYuklemeYaniti, CekiRevizyonOnizlemeSonuc, ProjeDropdownDto, SevkiyatDto, EksiklerdenSahaProjesiOlusturDto, SandiklardanSahaProjesiOlusturDto, SahaAktarimDto, SahaSandikAktarimGeriAlResultDto, SahaAktarimiGeriAlSonucDto, OtomatikSahaAktarimOnizlemeDto, OtomatikSahaAktarimParametreleri, OtomatikSahayaAktarDto, OtomatikSahaAktarimSonucDto, SahadanSahayaTasimaTalebi, SahadanSahayaTasiDto, SahadanSahayaTasimaOnizlemeDto, SahadanSahayaTasimaSonucDto, ProjeFotografBaglantisi, ProjeFotografBaglantisiKaydetDto } from '../../shared/models/index';

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
    return this.api.post<ProjeDto>(API.PROJE.EKSIKLERDEN_SAHA_OLUSTUR, dto);
  }

  sandiklardanSahaProjesiOlustur(dto: SandiklardanSahaProjesiOlusturDto): Observable<ApiResult<ProjeDto>> {
    return this.api.post<ProjeDto>(
      API.PROJE.SANDIKLARDAN_SAHA_OLUSTUR,
      dto
    );
  }

  getSahaAktarimlari(projeId: number): Observable<ApiResult<SahaAktarimDto[]>> {
    return this.api.get<SahaAktarimDto[]>(API.PROJE.SAHA_AKTARIMLARI(projeId));
  }

  sahaAktarimGeriAl(sahaCekiSatiriId: number, aciklama?: string): Observable<ApiResult<boolean>> {
    return this.api.post<boolean>(
      API.PROJE.SAHA_AKTARIM_GERI_AL,
      {
        sahaCekiSatiriId,
        aciklama: aciklama?.trim() || null
      }
    );
  }

  sahaSandikAktarimlariGeriAl(sahaSandikId: number, aciklama?: string): Observable<ApiResult<SahaSandikAktarimGeriAlResultDto>> {
    return this.api.post<SahaSandikAktarimGeriAlResultDto>(
      API.PROJE.SAHA_SANDIK_AKTARIMLARI_GERI_AL,
      {
        sahaSandikId,
        aciklama: aciklama?.trim() || null
      }
    );
  }

  /** Bir saha aktarımının (otomatik ya da elle) bütün satırlarını hepsi-ya-hiçbiri geri alır. */
  sahaAktarimiGeriAl(sahaAktarimId: number, aciklama?: string): Observable<ApiResult<SahaAktarimiGeriAlSonucDto>> {
    return this.api.post<SahaAktarimiGeriAlSonucDto>(API.PROJE.SAHA_AKTARIMI_GERI_AL, {
      sahaAktarimId,
      aciklama: aciklama?.trim() || null
    });
  }

  /** Sevk edilmiş normal projenin kalanlarının otomatik sahaya aktarım önizlemesi (veri değiştirmez). */
  otomatikSahaAktarimOnizle(projeId: number, secim: OtomatikSahaAktarimParametreleri = {}): Observable<ApiResult<OtomatikSahaAktarimOnizlemeDto>> {
    let params = new HttpParams();
    if (secim.yeniProje) params = params.set('yeniProje', 'true');
    else if (secim.hedefSahaProjeId) params = params.set('hedefSahaProjeId', secim.hedefSahaProjeId.toString());
    return this.api.get<OtomatikSahaAktarimOnizlemeDto>(API.PROJE.OTOMATIK_SAHA_AKTARIM_ONIZLE(projeId), { params });
  }

  otomatikSahayaAktar(projeId: number, dto: OtomatikSahayaAktarDto): Observable<ApiResult<OtomatikSahaAktarimSonucDto>> {
    return this.api.post<OtomatikSahaAktarimSonucDto>(API.PROJE.OTOMATIK_SAHA_AKTARIM(projeId), dto);
  }

  /** Sahadan sahaya taşıma önizlemesi: satırlar, hedef sandık numarası ve engeller (veri değiştirmez). */
  sahadanSahayaTasimaOnizle(talep: SahadanSahayaTasimaTalebi): Observable<ApiResult<SahadanSahayaTasimaOnizlemeDto>> {
    return this.api.post<SahadanSahayaTasimaOnizlemeDto>(API.PROJE.SAHADAN_SAHAYA_TASIMA_ONIZLE, talep);
  }

  sahadanSahayaTasi(dto: SahadanSahayaTasiDto): Observable<ApiResult<SahadanSahayaTasimaSonucDto>> {
    return this.api.post<SahadanSahayaTasimaSonucDto>(API.PROJE.SAHADAN_SAHAYA_TASIMA, dto);
  }

  /** Kapatır ya da "Hazırlanıyor"a geri alır; geri almada sebep zorunlu, not isteğe bağlı. */
  sandikKapat(sandikId: number, kapali: boolean, acilmaSebebiId?: number | null, not?: string | null): Observable<ApiResult<boolean>> {
    return this.api.put<boolean>(API.PROJE.SANDIK_KAPAT, { sandikId, kapali, acilmaSebebiId: acilmaSebebiId ?? null, not: not ?? null });
  }

  /** Tekil sevk; sefer bilgileri (araç plakası zorunlu, şoför, dorse) toplu sevkteki alanlarla aynıdır. */
  sevkEt(
    projeId: number,
    sevkTarihi?: string,
    sandikIds?: number[],
    aciklama?: string,
    sefer?: { aracPlaka?: string; sofor?: string; dorsePlaka?: string },
  ): Observable<ApiResult<boolean>> {
    return this.api.post<boolean>(API.PROJE.SEVK_ET(projeId), {
      sevkTarihi: sevkTarihi || null,
      sandikIds: sandikIds ?? null,
      aciklama: aciklama?.trim() || null,
      aracPlaka: sefer?.aracPlaka?.trim() || null,
      sofor: sefer?.sofor?.trim() || null,
      dorsePlaka: sefer?.dorsePlaka?.trim() || null,
    });
  }

  getSevkiyatlar(projeId: number): Observable<ApiResult<SevkiyatDto[]>> {
    return this.api.get<SevkiyatDto[]>(API.PROJE.SEVKIYATLAR(projeId));
  }

  kilidiAc(
    projeId: number,
    payload: { kilitAcmaTipiId: number; projeNo?: string | null; aciklama?: string | null }
  ): Observable<ApiResult<boolean>> {
    return this.api.post<boolean>(
      API.PROJE.KILIDI_AC(projeId),
      {
        kilitAcmaTipiId: payload.kilitAcmaTipiId,
        projeNo: payload.projeNo?.trim() || null,
        aciklama: payload.aciklama?.trim() || null
      }
    );
  }

  /** Projeye fotoğraf bağlantısı ekler; yanıt projenin güncel bağlantı listesidir. */
  fotografBaglantisiEkle(projeId: number, istek: ProjeFotografBaglantisiKaydetDto): Observable<ApiResult<ProjeFotografBaglantisi[]>> {
    return this.api.post<ProjeFotografBaglantisi[]>(API.PROJE.FOTOGRAF_BAGLANTILARI(projeId), istek);
  }

  /** Bir fotoğraf bağlantısının adresini/açıklamasını değiştirir; yanıt projenin güncel bağlantı listesidir. */
  fotografBaglantisiGuncelle(projeId: number, baglantiId: number, istek: ProjeFotografBaglantisiKaydetDto): Observable<ApiResult<ProjeFotografBaglantisi[]>> {
    return this.api.put<ProjeFotografBaglantisi[]>(API.PROJE.FOTOGRAF_BAGLANTISI(projeId, baglantiId), istek);
  }

  /** Bir fotoğraf bağlantısını siler; yanıt projenin güncel bağlantı listesidir. */
  fotografBaglantisiSil(projeId: number, baglantiId: number): Observable<ApiResult<ProjeFotografBaglantisi[]>> {
    return this.api.delete<ProjeFotografBaglantisi[]>(API.PROJE.FOTOGRAF_BAGLANTISI(projeId, baglantiId));
  }

  sevkTarihiGuncelle(projeId: number, planlananSevkTarihi: string | null): Observable<ApiResult<boolean>> {
    return this.api.put<boolean>(
      API.PROJE.SEVK_TARIHI_GUNCELLE,
      { projeId, planlananSevkTarihi }
    );
  }

  projeSil(projeId: number): Observable<ApiResult<boolean>> {
    return this.api.delete<boolean>(API.PROJE.DELETE(projeId));
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
      formData
    );
  }

  yedekCekiYukle(dosya: File): Observable<ApiResult<CekiYuklemeResultDto>> {
    const formData = new FormData();
    formData.append('dosya', dosya);
    return this.api.postFormData<CekiYuklemeResultDto>(
      API.CEKI.YEDEK_YUKLE,
      formData
    );
  }

  cekiRevizyonOnizle(dosya: File): Observable<CekiRevizyonApiResult<CekiRevizyonOnizlemeSonuc>> {
    const formData = new FormData();
    formData.append('dosya', dosya);
    return this.api.postFormData<CekiRevizyonOnizlemeSonuc>(
      API.CEKI.REVIZYON_ONIZLE,
      formData
    );
  }

  cekiRevizyonYukle(dosya: File): Observable<CekiRevizyonApiResult<CekiRevizyonYuklemeYaniti>> {
    const formData = new FormData();
    formData.append('dosya', dosya);
    return this.api.postFormData<CekiRevizyonYuklemeYaniti>(
      API.CEKI.REVIZYON_YUKLE,
      formData
    );
  }
}
