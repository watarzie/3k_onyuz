import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseApiService } from '../../core/services/base-api.service';
import { API } from '../../core/constants/api-endpoints';
import { ApiResult, ProjeDto, CekiYuklemeResultDto, CekiRevizyonOnizlemeSonuc, CekiRevizyonSonuc } from '../../shared/models/index';

@Injectable({ providedIn: 'root' })
export class ProjeService {
  private api = inject(BaseApiService);

  getProjeListesi(): Observable<ApiResult<ProjeDto[]>> {
    return this.api.get<ProjeDto[]>(API.PROJE.LIST);
  }

  projeOlustur(body: unknown): Observable<ApiResult<unknown>> {
    return this.api.post<unknown>(API.PROJE.CREATE, body);
  }

  cekiYukle(dosya: File): Observable<ApiResult<CekiYuklemeResultDto>> {
    const formData = new FormData();
    formData.append('dosya', dosya);
    return this.api.postFormData<CekiYuklemeResultDto>(API.CEKI.YUKLE, formData, {
      headers: { 'X-Menu-Kod': 'ceki-yukle' },
    });
  }

  cekiRevizyonOnizle(dosya: File): Observable<ApiResult<CekiRevizyonOnizlemeSonuc>> {
    const formData = new FormData();
    formData.append('dosya', dosya);
    return this.api.postFormData<CekiRevizyonOnizlemeSonuc>(API.CEKI.REVIZYON_ONIZLE, formData, {
      headers: { 'X-Menu-Kod': 'ceki-revizyon-yukle' },
    });
  }

  cekiRevizyonYukle(dosya: File): Observable<ApiResult<CekiRevizyonSonuc>> {
    const formData = new FormData();
    formData.append('dosya', dosya);
    return this.api.postFormData<CekiRevizyonSonuc>(API.CEKI.REVIZYON_YUKLE, formData, {
      headers: { 'X-Menu-Kod': 'ceki-revizyon-yukle' },
    });
  }
}
