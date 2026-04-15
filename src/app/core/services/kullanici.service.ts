import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseApiService } from './base-api.service';
import { API } from '../constants/api-endpoints';
import { ApiResult, RegisterDto } from '../../shared/models/index';
import { KullaniciDto, KullaniciGuncelleRequest } from '../../shared/models';

/**
 * Kullanıcı Yönetimi servisi.
 * Tüm endpoint'ler [Authorize] — sadece giriş yapmış kullanıcı erişebilir.
 * Dışarıdan register YOKTUR, kullanıcıyı admin oluşturur.
 *
 *  GET    /api/kullanici/liste
 *  POST   /api/kullanici/olustur
 *  PUT    /api/kullanici/guncelle
 *  DELETE /api/kullanici/{id}/sil
 */
@Injectable({ providedIn: 'root' })
export class KullaniciService {
  private api = inject(BaseApiService);

  getKullanicilar(): Observable<ApiResult<KullaniciDto[]>> {
    return this.api.get<KullaniciDto[]>(API.KULLANICI.LIST);
  }

  olustur(dto: RegisterDto): Observable<ApiResult<unknown>> {
    return this.api.post<unknown>(API.KULLANICI.CREATE, dto);
  }

  guncelle(request: KullaniciGuncelleRequest): Observable<ApiResult<KullaniciDto>> {
    return this.api.put<KullaniciDto>(API.KULLANICI.UPDATE, request);
  }

  sil(id: number): Observable<ApiResult<boolean>> {
    return this.api.delete<boolean>(API.KULLANICI.DELETE(id));
  }
}
