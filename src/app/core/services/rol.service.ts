import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API } from '../constants/api-endpoints';
import { RolDto, RolDetayDto, RolGuncelleRequest } from '../../shared/models';

@Injectable({ providedIn: 'root' })
export class RolService {
  private http = inject(HttpClient);

  /** Tüm rolleri listeler */
  getRoller(): Observable<RolDto[]> {
    return this.http.get<any>(API.ROL.LIST).pipe(
      map(res => res.data ?? res)
    );
  }

  /** Tek rolün detayını (menü ağacı + yetkiler) getirir */
  getRolDetay(id: number): Observable<RolDetayDto> {
    return this.http.get<any>(API.ROL.DETAY(id)).pipe(
      map(res => res.data ?? res)
    );
  }

  /** Yeni rol oluşturur */
  rolOlustur(ad: string): Observable<RolDto> {
    return this.http.post<any>(API.ROL.CREATE, { ad }).pipe(
      map(res => res.data ?? res)
    );
  }

  /** Rol adı ve yetkilerini günceller */
  rolGuncelle(request: RolGuncelleRequest): Observable<RolDetayDto> {
    return this.http.put<any>(API.ROL.UPDATE, request).pipe(
      map(res => res.data ?? res)
    );
  }

  /** Rolü siler */
  rolSil(id: number): Observable<void> {
    return this.http.delete<any>(API.ROL.DELETE(id)).pipe(
      map(res => res.data ?? res)
    );
  }
}
