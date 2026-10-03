import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API } from '../constants/api-endpoints';
import { BaseApiService } from './base-api.service';
import { RolDto, RolDetayDto, RolGuncelleRequest, ApiResult, onayaAlindi } from '../../shared/models';

@Injectable({ providedIn: 'root' })
export class RolService {
  private api = inject(BaseApiService);

  getRoller(): Observable<RolDto[]> {
    return this.api.get<RolDto[]>(API.ROL.LIST).pipe(map(result => this.value(result)));
  }

  getRolDetay(id: number): Observable<RolDetayDto> {
    return this.api.get<RolDetayDto>(API.ROL.DETAY(id)).pipe(map(result => this.value(result)));
  }

  /** Rol izinsiz oluşturulur; izinler menü ağacından ayrıca verilir. */
  rolOlustur(ad: string): Observable<RolDto> {
    return this.api.post<RolDto>(API.ROL.CREATE, { ad }).pipe(map(result => this.value(result)));
  }

  rolGuncelle(request: RolGuncelleRequest): Observable<RolDetayDto> {
    return this.api.put<RolDetayDto>(API.ROL.UPDATE, request).pipe(map(result => this.value(result)));
  }

  rolSil(id: number): Observable<void> {
    return this.api.delete<boolean>(API.ROL.DELETE(id)).pipe(map(result => {
      this.value(result);
    }));
  }

  private value<T>(result: ApiResult<T>): T {
    if (!result.isSuccess || onayaAlindi(result) || result.value == null) {
      throw new Error(result.error || 'Rol işlemi tamamlanamadı.');
    }
    return result.value;
  }
}
