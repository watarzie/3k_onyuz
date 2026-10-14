import { Injectable, inject } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { BaseApiService } from './base-api.service';
import { API } from '../constants/api-endpoints';
import { AmbalajFormOlusturRequest, AmbalajFormSurumu, AmbalajGerceklesme, AmbalajGerceklesenRapor } from '../../shared/models/ambalaj-yasam-dongusu.model';
import { AmbalajBagimsizSandikDto, AmbalajKayitGecmisi } from '../../shared/models';

@Injectable({ providedIn: 'root' })
export class AmbalajYasamDongusuService {
  private api = inject(BaseApiService);
  formOlustur(request: AmbalajFormOlusturRequest) {
    return this.api.post<AmbalajFormSurumu>(API.AMBALAJ.FORM_SURUMLERI, request);
  }
  formlar(kapsam: { projeId?: number; kayitId?: number }) {
    let params = new HttpParams();
    if (kapsam.projeId) params = params.set('projeId', kapsam.projeId);
    if (kapsam.kayitId) params = params.set('kayitId', kapsam.kayitId);
    return this.api.get<AmbalajFormSurumu[]>(API.AMBALAJ.FORM_SURUMLERI, { params });
  }
  formIndir(id: number, format: 'pdf' | 'xlsx') {
    return this.api.downloadFile(API.AMBALAJ.FORM_SURUM_DOSYA(id, format));
  }
  durum(id: number, durum: number, aciklama: string) {
    return this.api.put<unknown>(API.AMBALAJ.KAYIT_DURUM(id), { durum, aciklama });
  }
  /** Özel sandığı finansa aktarır (üretim formu yoktur); tarih boşsa aktarım günü finans tarihidir. */
  finansaAktar(id: number, finansTarihi: string | null) {
    return this.api.post<AmbalajBagimsizSandikDto>(API.AMBALAJ.OZEL_SANDIK_FINANSA_AKTAR(id), { finansTarihi });
  }
  /** Kaydın değişiklik geçmişi (kim, ne zaman, hangi işlemle neyi değiştirdi); en yeni üstte. */
  gecmis(id: number) {
    return this.api.get<AmbalajKayitGecmisi[]>(API.AMBALAJ.KAYIT_GECMIS(id));
  }
  /** Özel sandığı finanstan geri alır; finans kaydı PO'ya bağlıysa sunucu 409 döner. */
  finanstanGeriAl(id: number, gerekce: string) {
    return this.api.post<AmbalajBagimsizSandikDto>(API.AMBALAJ.OZEL_SANDIK_FINANSTAN_GERI_AL(id), { gerekce: gerekce || null });
  }
  rapor(baslangic: string, bitis: string, projeId?: number) {
    return this.api.get<AmbalajGerceklesenRapor>(API.AMBALAJ.GERCEKLESEN_RAPOR, { params: this.params(baslangic, bitis, projeId) });
  }
  raporIndir(baslangic: string, bitis: string, format: 'pdf' | 'xlsx', projeId?: number) {
    return this.api.downloadFile(`${API.AMBALAJ.GERCEKLESEN_RAPOR_DOSYA}?${this.params(baslangic, bitis, projeId).set('format', format)}`);
  }
  duzelt(kayit: AmbalajGerceklesme, gerekce: string) {
    return this.api.put<AmbalajGerceklesme>(API.AMBALAJ.GERCEKLESME(kayit.id), {
      beklenenSurum: kayit.surum, tarih: kayit.tarih, adet: kayit.adet,
      netM3: kayit.netM3, sarfM3: kayit.sarfM3, gerekce,
    });
  }
  private params(baslangic: string, bitis: string, projeId?: number) {
    let params = new HttpParams().set('baslangic', baslangic).set('bitis', bitis);
    if (projeId) params = params.set('projeId', projeId);
    return params;
  }
}
