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

  indirPdf(projeId: number): Observable<Blob> {
    return this.api.downloadFile(API.PDF.INDIR(projeId));
  }

  indirExcel(projeId: number): Observable<Blob> {
    return this.api.downloadFile(API.PDF.EXCEL(projeId));
  }
}
