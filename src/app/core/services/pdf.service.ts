import { Injectable, inject } from '@angular/core';
import { BaseApiService } from './base-api.service';
import { API } from '../constants/api-endpoints';
import { Observable } from 'rxjs';

/**
 * PdfController (2 endpoint) — dosya indirme:
 *  GET /api/pdf/indir/{projeId}   → PDF
 *  GET /api/pdf/excel/{projeId}   → Excel
 */
@Injectable({ providedIn: 'root' })
export class PdfService {
  private api = inject(BaseApiService);
  private readonly eksikRaporOptions = { headers: { 'X-Menu-Kod': 'eksik-raporu' } };
  private readonly gerceklesenRaporOptions = { headers: { 'X-Menu-Kod': 'gerceklesen-ceki-raporu' } };

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
    return this.api.downloadFile(API.PDF.EKSIK_URUNLER(projeId), this.eksikRaporOptions);
  }

  eksikUrunlerExcel(projeId: number): Observable<Blob> {
    return this.api.downloadFile(API.PDF.EKSIK_URUNLER_EXCEL(projeId), this.eksikRaporOptions);
  }

  gerceklesenCekiListesiPdf(projeId: number): Observable<Blob> {
    return this.api.downloadFile(API.PDF.GERCEKLESEN_CEKI_LISTESI(projeId), this.gerceklesenRaporOptions);
  }

  gerceklesenCekiListesiExcel(projeId: number): Observable<Blob> {
    return this.api.downloadFile(API.PDF.GERCEKLESEN_CEKI_LISTESI_EXCEL(projeId), this.gerceklesenRaporOptions);
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
