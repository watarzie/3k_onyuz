import { Injectable, inject } from '@angular/core';
import { BaseApiService } from './base-api.service';
import { API } from '../constants/api-endpoints';
import { ProjeTipi } from '../constants/enums';
import { Observable } from 'rxjs';

/**
 * Rapor indirmeleri (PdfController). Hangi menü izninin gerektiğini sunucu projenin gerçek
 * tipinden çözer; istemci ekran bilgisi göndermez.
 */
@Injectable({ providedIn: 'root' })
export class PdfService {
  private api = inject(BaseApiService);

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
  topluEksikUrunlerPdf(projeIds: number[], projeTipi: ProjeTipi = ProjeTipi.Normal): Observable<Blob> {
    return this.api.downloadPostFile(API.PDF.TOPLU_EKSIK_URUNLER, { projeIds, projeTipi });
  }

  topluEksikUrunlerExcel(projeIds: number[], projeTipi: ProjeTipi = ProjeTipi.Normal): Observable<Blob> {
    return this.api.downloadPostFile(API.PDF.TOPLU_EKSIK_URUNLER_EXCEL, { projeIds, projeTipi });
  }

  /** G4 / G-110: seçili projelerde Grid eksiği olup 3K kalanı süren ürünler, kalan miktarıyla tek sayfalık talep formu Excel'inde (salt okunur). */
  topluTalepFormuExcel(projeIds: number[], projeTipi: ProjeTipi = ProjeTipi.Normal): Observable<Blob> {
    return this.api.downloadPostFile(API.PDF.TOPLU_TALEP_FORMU_EXCEL, { projeIds, projeTipi });
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

  /** Müşteri gerçekleşen çeki listesi; sevk edilmiş sandığı olmayan projede sunucu 400 ve açıklama döner. */
  musteriCekiListesi(projeId: number, format: 'pdf' | 'excel'): Observable<Blob> {
    return this.api.downloadFile(API.PDF.MUSTERI_CEKI_LISTESI(projeId, format));
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

  /** Stok raporu; durum verilirse yalnız o sekmenin kayıtları basılır. */
  stokPdf(durumId?: number | null): Observable<Blob> {
    return this.api.downloadFile(API.PDF.STOK(durumId));
  }

  depoSandikPdf(projeTipiId?: number | null): Observable<Blob> {
    return this.api.downloadFile(API.PDF.DEPO_SANDIK(projeTipiId));
  }

  projeDepoSandikPdf(projeId: number): Observable<Blob> {
    return this.api.downloadFile(API.PDF.DEPO_SANDIK_PROJE(projeId));
  }
}
