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
  private menuOptions(menuKod: string) { return { headers: { 'X-Menu-Kod': menuKod } }; }

  indirPdf(projeId: number): Observable<Blob> {
    return this.api.downloadFile(API.PDF.INDIR(projeId));
  }

  indirExcel(projeId: number): Observable<Blob> {
    return this.api.downloadFile(API.PDF.EXCEL(projeId));
  }

  sahaSandikPdf(sandikId: number, menuKod?: string): Observable<Blob> {
    return this.api.downloadFile(API.PDF.SAHA_SANDIK(sandikId), menuKod ? this.menuOptions(menuKod) : undefined);
  }

  sahaProjePdf(projeId: number, menuKod?: string): Observable<Blob> {
    return this.api.downloadFile(API.PDF.SAHA_PROJE(projeId), menuKod ? this.menuOptions(menuKod) : undefined);
  }

  eksikUrunlerPdf(projeId: number, menuKod = 'eksik-raporu'): Observable<Blob> {
    return this.api.downloadFile(API.PDF.EKSIK_URUNLER(projeId), this.menuOptions(menuKod));
  }

  eksikUrunlerExcel(projeId: number, menuKod = 'eksik-raporu'): Observable<Blob> {
    return this.api.downloadFile(API.PDF.EKSIK_URUNLER_EXCEL(projeId), this.menuOptions(menuKod));
  }

  gerceklesenCekiListesiPdf(projeId: number, menuKod = 'gerceklesen-ceki-raporu'): Observable<Blob> {
    return this.api.downloadFile(API.PDF.GERCEKLESEN_CEKI_LISTESI(projeId), this.menuOptions(menuKod));
  }

  gerceklesenCekiListesiExcel(projeId: number, menuKod = 'gerceklesen-ceki-raporu'): Observable<Blob> {
    return this.api.downloadFile(API.PDF.GERCEKLESEN_CEKI_LISTESI_EXCEL(projeId), this.menuOptions(menuKod));
  }

  uckSandikDurumPdf(projeId: number, menuKod = '3k-sandik-durum-raporu'): Observable<Blob> {
    return this.api.downloadFile(API.PDF.UCK_SANDIK_DURUM(projeId), this.menuOptions(menuKod));
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
