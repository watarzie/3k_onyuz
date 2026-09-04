import { Injectable, inject } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { API } from '../constants/api-endpoints';
import {
  ApiResult,
  FinansAylikDegerRequest,
  FinansAylikIs,
  FinansAylikSayfaliSonuc,
  FinansDashboard,
  FinansDonemOlusturSonuc,
  FinansDuzenliIs,
  FinansDuzenliIsListelemeRequest,
  FinansDuzenliIsKaydetRequest,
  FinansFatura,
  FinansFaturaOlusturRequest,
  FinansGider,
  FinansGiderKategori,
  FinansGiderKaydetRequest,
  FinansIsKaydi,
  FinansListelemeRequest,
  FinansOzelIs,
  FinansOzelIsKaydetRequest,
  FinansProjeOzet,
  FinansSayfaliSonuc,
  FinansSiparis,
  FinansSiparisDetay,
  FinansSiparisOlusturRequest,
  FinansUrun,
  FinansUrunListelemeRequest,
  FinansUrunKaydetRequest,
} from '../../shared/models';
import { BaseApiService } from './base-api.service';

@Injectable({ providedIn: 'root' })
export class FinansService {
  private api = inject(BaseApiService);

  dashboard() { return this.api.get<FinansDashboard>(API.FINANS.DASHBOARD); }
  projeler(request: FinansListelemeRequest = this.varsayilanListeleme()) { return this.liste<FinansProjeOzet>(API.FINANS.PROJELER, request); }
  projeDetay(projeId: number): Observable<ApiResult<FinansIsKaydi[]>> {
    return this.api.get<FinansSayfaliSonuc<FinansIsKaydi>>(API.FINANS.PROJE(projeId)).pipe(
      map(result => (result.isSuccess
        ? { ...result, value: result.value?.items ?? [] }
        : result) as ApiResult<FinansIsKaydi[]>),
    );
  }
  isKayitlari(projeNo: string, request: FinansListelemeRequest = this.varsayilanListeleme()) {
    return this.liste<FinansIsKaydi>(API.FINANS.IS_KAYITLARI, { ...request, projeNo });
  }
  isKayitlariSecim(ids: number[]) {
    return this.api.post<FinansIsKaydi[]>(API.FINANS.IS_KAYITLARI_SECIM, { ids });
  }
  siparisler(request: FinansListelemeRequest = this.varsayilanListeleme()) { return this.liste<FinansSiparis>(API.FINANS.SIPARISLER, request); }
  siparisOlustur(request: FinansSiparisOlusturRequest) { return this.api.post<FinansSiparis>(API.FINANS.SIPARISLER, request); }
  siparisDetay(id: number) { return this.api.get<FinansSiparisDetay>(`${API.FINANS.SIPARISLER}/${id}`); }
  faturalar(request: FinansListelemeRequest = this.varsayilanListeleme()) { return this.liste<FinansFatura>(API.FINANS.FATURALAR, request); }
  faturaOlustur(request: FinansFaturaOlusturRequest) { return this.api.post<FinansFatura>(API.FINANS.FATURALAR, request); }
  aylikIsler(yil: number, ay: number, request: FinansListelemeRequest = this.varsayilanListeleme()) {
    const params = this.listelemeParametreleri(request)
      .set('yil', yil)
      .set('ay', ay);
    return this.api.get<FinansAylikSayfaliSonuc>(API.FINANS.AYLIK_ISLER, { params });
  }
  ozelIsler(request: FinansListelemeRequest = this.varsayilanListeleme()) { return this.liste<FinansOzelIs>(API.FINANS.OZEL_ISLER, request); }
  ozelIsOlustur(request: FinansOzelIsKaydetRequest) { return this.api.post<FinansOzelIs>(API.FINANS.OZEL_ISLER, request); }
  ozelIsAylikDegerGuncelle(id: number, request: FinansAylikDegerRequest) { return this.api.put<void>(API.FINANS.OZEL_IS_AYLIK_DEGER(id), request); }
  ozelIsIptal(id: number, aciklama: string) { return this.api.post<void>(API.FINANS.OZEL_IS_IPTAL(id), { aciklama }); }
  ozelIsGeriAl(id: number) { return this.api.post<void>(API.FINANS.OZEL_IS_GERI_AL(id), {}); }
  duzenliIsler(request: FinansDuzenliIsListelemeRequest = { pageNumber: 1, pageSize: 25 }) {
    let params = new HttpParams()
      .set('pageNumber', request.pageNumber)
      .set('pageSize', request.pageSize)
      .set('sadeceAktif', request.sadeceAktif ?? false);
    if (request.arama?.trim()) params = params.set('arama', request.arama.trim());
    return this.api.get<FinansSayfaliSonuc<FinansDuzenliIs>>(API.FINANS.DUZENLI_ISLER, { params });
  }
  duzenliIsOlustur(request: FinansDuzenliIsKaydetRequest) { return this.api.post<FinansDuzenliIs>(API.FINANS.DUZENLI_ISLER, request); }
  duzenliIsGuncelle(id: number, request: FinansDuzenliIsKaydetRequest) { return this.api.put<FinansDuzenliIs>(API.FINANS.DUZENLI_IS(id), request); }
  duzenliIsDonemOlustur(referansTarihi?: string) { return this.api.post<FinansDonemOlusturSonuc>(`${API.FINANS.DUZENLI_IS_DONEM_OLUSTUR}${referansTarihi ? `?referansTarihi=${referansTarihi}` : ''}`, {}); }
  giderler(request: FinansListelemeRequest = this.varsayilanListeleme()) { return this.liste<FinansGider>(API.FINANS.GIDERLER, request); }
  giderKategorileri() { return this.api.get<FinansGiderKategori[]>(API.FINANS.GIDER_KATEGORILERI); }
  giderOlustur(request: FinansGiderKaydetRequest) { return this.api.post<FinansGider>(API.FINANS.GIDERLER, request); }
  giderGuncelle(id: number, request: FinansGiderKaydetRequest) { return this.api.put<FinansGider>(API.FINANS.GIDER(id), request); }
  giderIptal(id: number, aciklama: string) { return this.api.post<void>(API.FINANS.GIDER_IPTAL(id), { aciklama }); }
  urunler(request: FinansUrunListelemeRequest = { pageNumber: 1, pageSize: 25 }) {
    let params = new HttpParams()
      .set('pageNumber', request.pageNumber)
      .set('pageSize', request.pageSize)
      .set('sadeceAktif', request.sadeceAktif ?? false);
    if (request.arama?.trim()) params = params.set('arama', request.arama.trim());
    if (request.tarifeTarihi) params = params.set('tarifeTarihi', request.tarifeTarihi);
    return this.api.get<FinansSayfaliSonuc<FinansUrun>>(API.FINANS.URUNLER, { params });
  }
  urunOlustur(request: FinansUrunKaydetRequest) { return this.api.post<FinansUrun>(API.FINANS.URUNLER, request); }
  urunGuncelle(id: number, request: FinansUrunKaydetRequest) { return this.api.put<FinansUrun>(API.FINANS.URUN(id), request); }
  urunSil(id: number) { return this.api.delete<void>(API.FINANS.URUN(id)); }
  isRaporu(format: 'pdf' | 'excel') { return this.api.downloadFile(format === 'pdf' ? API.FINANS.IS_RAPORU_PDF : API.FINANS.IS_RAPORU_EXCEL); }
  giderRaporu(format: 'pdf' | 'excel') { return this.api.downloadFile(format === 'pdf' ? API.FINANS.GIDER_RAPOR_PDF : API.FINANS.GIDER_RAPOR_EXCEL); }
  siparisDurumRaporu(format: 'pdf' | 'excel', filtre: { baslangic?: string; bitis?: string; projeNo?: string; isGrubu?: string; durum?: string }) {
    const params = new URLSearchParams();
    Object.entries(filtre).forEach(([anahtar, deger]) => { if (deger) params.set(anahtar, deger); });
    const endpoint = format === 'pdf' ? API.FINANS.SIPARIS_DURUM_RAPOR_PDF : API.FINANS.SIPARIS_DURUM_RAPOR_EXCEL;
    return this.api.downloadFile(`${endpoint}?${params}`);
  }
  aylikRapor(format: 'pdf' | 'excel' | 'ayri', yil: number, ay: number, gruplar: string[]) {
    const params = new URLSearchParams({ yil: String(yil), ay: String(ay) });
    gruplar.forEach(grup => params.append('gruplar', grup));
    const endpoint = format === 'pdf' ? API.FINANS.AYLIK_RAPOR_PDF : format === 'excel' ? API.FINANS.AYLIK_RAPOR_EXCEL : API.FINANS.AYLIK_RAPOR_AYRI;
    return this.api.downloadFile(`${endpoint}?${params}`);
  }

  private liste<T>(url: string, request: FinansListelemeRequest): Observable<ApiResult<FinansSayfaliSonuc<T>>> {
    return this.api.get<FinansSayfaliSonuc<T>>(url, {
      params: this.listelemeParametreleri(request),
    });
  }

  private listelemeParametreleri(request: FinansListelemeRequest): HttpParams {
    let params = new HttpParams()
      .set('pageNumber', request.pageNumber)
      .set('pageSize', request.pageSize);
    if (request.arama?.trim()) params = params.set('arama', request.arama.trim());
    if (request.projeNo?.trim()) params = params.set('projeNo', request.projeNo.trim());
    if (request.poNumarasi?.trim()) params = params.set('poNumarasi', request.poNumarasi.trim());
    if (request.baslangic) params = params.set('baslangic', request.baslangic);
    if (request.bitis) params = params.set('bitis', request.bitis);
    if (request.iptalEdilenleriDahilEt !== undefined) {
      params = params.set('iptalEdilenleriDahilEt', request.iptalEdilenleriDahilEt);
    }
    return params;
  }

  private varsayilanListeleme(): FinansListelemeRequest {
    return { pageNumber: 1, pageSize: 25 };
  }
}
