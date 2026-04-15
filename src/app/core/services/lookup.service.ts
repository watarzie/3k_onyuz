import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { API } from '../constants/api-endpoints';
import { LookupResponse } from '../../shared/models/lookup.model';
import { ApiResult } from '../../shared/models/common.model';

/**
 * Dinamik Lookup/Parametre servisi.
 * Entity adlarını gönderir, backend reflection ile verileri döner.
 *
 * befasoft-app ParameterService referans mimarisinden adapte edildi.
 *
 * Kullanım:
 *   lookupService.getLookups(['LookupProjeDurum', 'LookupSandikDurum'])
 *     .subscribe(data => data['LookupProjeDurum'])
 */
@Injectable({
  providedIn: 'root'
})
export class LookupService {
  private http = inject(HttpClient);

  /**
   * Bir veya birden fazla lookup tablosunun verilerini çeker.
   * @param entities Lookup sınıf adları listesi
   * @returns Observable<LookupResponse> → { "LookupProjeDurum": [{id, anahtar, deger}, ...] }
   */
  getLookups(entities: string[]): Observable<LookupResponse> {
    let params = new HttpParams();
    entities.forEach(e => {
      params = params.append('entity', e);
    });

    return this.http.get<ApiResult<LookupResponse>>(API.LOOKUP.GET, { params }).pipe(
      map(result => {
        if (result.isSuccess && result.value) {
          return result.value;
        }
        console.error('[LookupService] Lookup yüklenemedi:', result.error);
        return {} as LookupResponse;
      })
    );
  }
}
