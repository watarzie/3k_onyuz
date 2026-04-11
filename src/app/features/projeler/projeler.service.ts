import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseApiService } from '../../core/services/base-api.service';
import { API } from '../../core/constants/api-endpoints';
import { ApiResult, ProjeDto, CekiYuklemeResultDto } from '../../core/models/api-response.model';

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
    return this.api.postFormData<CekiYuklemeResultDto>(API.CEKI.YUKLE, formData);
  }
}
