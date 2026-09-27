import { Injectable, inject } from '@angular/core';
import { BaseApiService } from './base-api.service';
import { API } from '../constants/api-endpoints';
import { Observable } from 'rxjs';

/**
 * Rapor indirmeleri (PdfController). Hangi menü izninin gerektiğini sunucu projenin gerçek
 * tipinden çözer; istemci ekran bilgisi göndermez.
 */
@Injectable({ providedIn: 'root' })
export class PdfService {
  private api = inject(BaseApiService);

  indirPdf(projeId: number): Observable<Blob> {
    return this.api.downloadFile(API.PDF.INDIR(projeId));
  }

  indirExcel(projeId: number): Observable<Blob> {
    return this.api.downloadFile(API.PDF.EXCEL(projeId));
  }

  sahaSandikPdf(sandikId: number): Observable<Blob> {
    return this.api.downloadFile(API.PDF.SAHA_SANDIK(sandikId));
  }

  sahaProjePdf(projeId: number): Observable<Blob> {
    return this.api.downloadFile(API.PDF.SAHA_PROJE(projeId));
  }

  eksikUrunlerPdf(projeId: number): Observable<Blob> {
    return this.api.downloadFile(API.PDF.EKSIK_URUNLER(projeId));
  }

  eksikUrunlerExcel(projeId: number): Observable<Blob> {
    return this.api.downloadFile(API.PDF.EKSIK_URUNLER_EXCEL(projeId));
  }

  /** projeTipi raporun kapsamıdır; sunucu her projenin gerçek tipini ayrıca doğrular. */
  topluEksikUrunlerPdf(projeIds: number[], projeTipi: 1 | 2 | 3 = 1): Observable<Blob> {
    return this.api.downloadPostFile(API.PDF.TOPLU_EKSIK_URUNLER, { projeIds, projeTipi });
  }

  topluEksikUrunlerExcel(projeIds: number[], projeTipi: 1 | 2 | 3 = 1): Observable<Blob> {
    return this.api.downloadPostFile(API.PDF.TOPLU_EKSIK_URUNLER_EXCEL, { projeIds, projeTipi });
  }

  downloadErrorMessage(error: unknown, fallback: string): Promise<string> {
    return this.api.downloadErrorMessage(error, fallback);
  }

  gerceklesenCekiListesiPdf(projeId: number): Observable<Blob> {
    return this.api.downloadFile(API.PDF.GERCEKLESEN_CEKI_LISTESI(projeId));
  }

  gerceklesenCekiListesiExcel(projeId: number): Observable<Blob> {
    return this.api.downloadFile(API.PDF.GERCEKLESEN_CEKI_LISTESI_EXCEL(projeId));
  }

  sahaGerceklesenCekiListesiPdf(projeId: number): Observable<Blob> {
    return this.api.downloadFile(API.PDF.SAHA_GERCEKLESEN_CEKI_LISTESI(projeId));
  }

  sahaGerceklesenCekiListesiExcel(projeId: number): Observable<Blob> {
    return this.api.downloadFile(API.PDF.SAHA_GERCEKLESEN_CEKI_LISTESI_EXCEL(projeId));
  }

  uckSandikDurumPdf(projeId: number): Observable<Blob> {
    return this.api.downloadFile(API.PDF.UCK_SANDIK_DURUM(projeId));
  }

  stokPdf(): Observable<Blob> {
    return this.api.downloadFile(API.PDF.STOK);
  }

  depoSandikPdf(projeTipiId?: number | null): Observable<Blob> {
    return this.api.downloadFile(API.PDF.DEPO_SANDIK(projeTipiId));
  }

  projeDepoSandikPdf(projeId: number): Observable<Blob> {
    return this.api.downloadFile(API.PDF.DEPO_SANDIK_PROJE(projeId));
  }
}
