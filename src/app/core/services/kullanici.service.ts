import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseApiService } from './base-api.service';
import { API } from '../constants/api-endpoints';
import { ApiResult, KullaniciDto, RegisterDto } from '../../shared/models/index';

/**
 * KullaniciController (1 endpoint) + AuthController register:
 *  GET  /api/kullanici
 *  POST /api/auth/register
 */
@Injectable({ providedIn: 'root' })
export class KullaniciService {
  private api = inject(BaseApiService);

  getKullanicilar(): Observable<ApiResult<KullaniciDto[]>> {
    return this.api.get<KullaniciDto[]>(API.KULLANICI.LIST);
  }

  register(dto: RegisterDto): Observable<ApiResult<unknown>> {
    return this.api.post<unknown>(API.AUTH.REGISTER, dto);
  }
}
