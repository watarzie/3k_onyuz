import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { API } from '../constants/api-endpoints';
import { LookupItem, LookupResponse } from '../../shared/models/lookup.model';

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

    return this.http.get<any>(API.LOOKUP.GET, { params }).pipe(
      map((result: any) => {
        // Backend ToActionResult() extension directly returns the value dict for OkObjectResult
        return result || {} as LookupResponse;
      })
    );
  }

  depoLokasyonOlustur(deger: string): Observable<LookupItem> {
    return this.http.post<LookupItem>(API.LOOKUP.DEPO_LOKASYON, { deger });
  }

  depoLokasyonSil(id: number): Observable<void> {
    return this.http.delete(API.LOOKUP.DEPO_LOKASYON_DELETE(id)).pipe(map(() => undefined));
  }
}
