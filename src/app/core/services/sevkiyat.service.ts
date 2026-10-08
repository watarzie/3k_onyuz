import { Injectable, inject } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BaseApiService } from './base-api.service';
import { API } from '../constants/api-endpoints';
import {
  ApiResult,
  PaginatedList,
  SevkSeferiDetay,
  SevkSeferiFiltre,
  SevkSeferiOzet,
  SevkiyatIstatistik,
  TopluSevkApiResult,
  TopluSevkIstegi,
  TopluSevkSonucu,
} from '../../shared/models/index';

/**
 * SevkiyatController:
 *  POST /api/sevkiyat/toplu-sevk               (her projenin gerçek tipinin sevk etme W izni)
 *  GET  /api/sevkiyat/seferler                 (sevkiyatlar R)
 *  GET  /api/sevkiyat/seferler/{id}/detay      (sevkiyatlar R)
 *  GET  /api/sevkiyat/seferler/eski-detay      (sevkiyatlar R; sefere bağlı olmayan eski sevkiyatlar)
 *  GET  /api/sevkiyat/istatistik               (sevkiyatlar R)
 */
@Injectable({ providedIn: 'root' })
export class SevkiyatService {
  private api = inject(BaseApiService);

  /** Hepsi ya da hiçbiri; 409 reddinde proje/sandık bazındaki engeller sonucun issues alanında gelir. */
  topluSevk(istek: TopluSevkIstegi): Observable<TopluSevkApiResult> {
    return this.api.post<TopluSevkSonucu>(API.SEVKIYAT.TOPLU_SEVK, istek);
  }

  seferler(filtre: SevkSeferiFiltre, pageNumber: number, pageSize: number): Observable<ApiResult<PaginatedList<SevkSeferiOzet>>> {
    let params = this.tarihParametreleri(filtre)
      .set('pageNumber', String(pageNumber))
      .set('pageSize', String(pageSize));
    const plaka = filtre.plaka?.trim();
    const projeNo = filtre.projeNo?.trim();
    if (plaka) params = params.set('plaka', plaka);
    if (projeNo) params = params.set('projeNo', projeNo);
    if (filtre.projeTipiId) params = params.set('projeTipiId', String(filtre.projeTipiId));
    return this.api.get<PaginatedList<SevkSeferiOzet>>(API.SEVKIYAT.SEFERLER, { params });
  }

  /** Gerçek sefer kimlikle; eski kayıt (sefere bağlı olmayan sevkiyatlar) plaka ve sevk günüyle okunur. */
  seferDetay(sefer: Pick<SevkSeferiOzet, 'seferId' | 'eskiKayit' | 'aracPlaka' | 'sevkTarihi'>): Observable<ApiResult<SevkSeferiDetay>> {
    if (!sefer.eskiKayit && sefer.seferId) {
      return this.api.get<SevkSeferiDetay>(API.SEVKIYAT.SEFER_DETAY(sefer.seferId));
    }
    let params = new HttpParams().set('tarih', sefer.sevkTarihi.slice(0, 10));
    if (sefer.aracPlaka) params = params.set('plaka', sefer.aracPlaka);
    return this.api.get<SevkSeferiDetay>(API.SEVKIYAT.ESKI_SEFER_DETAY, { params });
  }

  istatistik(filtre: Pick<SevkSeferiFiltre, 'baslangic' | 'bitis'>): Observable<ApiResult<SevkiyatIstatistik>> {
    return this.api.get<SevkiyatIstatistik>(API.SEVKIYAT.ISTATISTIK, { params: this.tarihParametreleri(filtre) });
  }

  private tarihParametreleri(filtre: Pick<SevkSeferiFiltre, 'baslangic' | 'bitis'>): HttpParams {
    let params = new HttpParams();
    if (filtre.baslangic) params = params.set('baslangic', filtre.baslangic);
    if (filtre.bitis) params = params.set('bitis', filtre.bitis);
    return params;
  }
}
