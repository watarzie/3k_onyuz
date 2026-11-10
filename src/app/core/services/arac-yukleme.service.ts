import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BaseApiService } from './base-api.service';
import { API } from '../constants/api-endpoints';
import {
  ApiResult,
  AracYuklemeAraci,
  AracYuklemeDurumu,
  AracYuklemePlanOzeti,
  PaginatedList,
  YukCozumu,
  YukIsaretSonucu,
  YukIsaretleIstegi,
} from '../../shared/models/index';

/**
 * Araç yükleme (saha) API istemcisi: yükleme oturumu ve barkodla "yüklendi" işaretleme (arac-yukleme R/W). Yükleme
 * işareti planlama kaydıdır; sandık durumunu ve sevki değiştirmez.
 */
@Injectable({ providedIn: 'root' })
export class AracYuklemeService extends BaseApiService {
  /** Yerleşimi olan ya da yüklemesi süren planlar (sayfalı). */
  planlar(arama: string, sayfa: number, boyut: number): Observable<ApiResult<PaginatedList<AracYuklemePlanOzeti>>> {
    let params = new HttpParams().set('sayfa', sayfa).set('boyut', boyut);
    const metin = arama.trim();
    if (metin) params = params.set('arama', metin);
    return this.get<PaginatedList<AracYuklemePlanOzeti>>(API.ARAC_YUKLEME.PLANLAR, { params });
  }

  durum(planId: number): Observable<ApiResult<AracYuklemeDurumu>> {
    return this.get<AracYuklemeDurumu>(API.ARAC_YUKLEME.PLAN(planId));
  }

  /** Planın son revizyonuyla oturum başlatır; plan arada revize edildiyse ya da süren oturum varsa 409. */
  baslat(planId: number, beklenenRevizyonNo: number): Observable<ApiResult<AracYuklemeDurumu>> {
    return this.post<AracYuklemeDurumu>(API.ARAC_YUKLEME.OTURUM_BASLAT(planId), { beklenenRevizyonNo });
  }

  arac(oturumId: number, aracNo: number): Observable<ApiResult<AracYuklemeAraci>> {
    return this.get<AracYuklemeAraci>(API.ARAC_YUKLEME.ARAC(oturumId, aracNo));
  }

  /** Okutulan sandık barkodunu çözer (durum değiştirmez). */
  cozumle(oturumId: number, barkod: string, aracNo: number): Observable<ApiResult<YukCozumu>> {
    return this.get<YukCozumu>(API.ARAC_YUKLEME.COZUMLE(oturumId), {
      params: new HttpParams().set('barkod', barkod).set('aracNo', aracNo),
    });
  }

  /** Yükü yüklendi işaretler; zaten yüklüyse yeni kayıt yazılmaz, sıra dışı yük onaysız 409 alır. */
  isaretle(oturumId: number, istek: YukIsaretleIstegi): Observable<ApiResult<YukIsaretSonucu>> {
    return this.post<YukIsaretSonucu>(API.ARAC_YUKLEME.YUKLEMELER(oturumId), istek);
  }

  geriAl(oturumId: number, isaretId: number, gerekce: string): Observable<ApiResult<AracYuklemeAraci>> {
    return this.post<AracYuklemeAraci>(API.ARAC_YUKLEME.GERI_AL(oturumId, isaretId), { gerekce });
  }

  /** Oturumu tamamlar; yüklenmemiş yük varsa gerekçe zorunludur. */
  tamamla(oturumId: number, gerekce: string | null): Observable<ApiResult<AracYuklemeDurumu>> {
    return this.post<AracYuklemeDurumu>(API.ARAC_YUKLEME.TAMAMLA(oturumId), { gerekce });
  }

  iptal(oturumId: number, gerekce: string): Observable<ApiResult<AracYuklemeDurumu>> {
    return this.post<AracYuklemeDurumu>(API.ARAC_YUKLEME.IPTAL(oturumId), { gerekce });
  }
}
