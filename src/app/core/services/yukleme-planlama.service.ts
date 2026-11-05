import { Injectable } from '@angular/core';
import { HttpParams, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BaseApiService } from './base-api.service';
import { API } from '../constants/api-endpoints';
import {
  ApiResult,
  EkipmanAilesiModeli,
  ElleAracIstegi,
  EkipmanIceAktarimSonucu,
  EkipmanKonfigurasyonDetayi,
  EkipmanKonfigurasyonOzeti,
  EkipmanListeSuzgeci,
  MevzuatKuralSetiDetayi,
  MevzuatKuralSetiOzeti,
  PaginatedList,
  PlanProjeAdayi,
  PlanYerlesimi,
  YuklemeLokasyonTercihi,
  YuklemePlaniDetayi,
  YuklemePlaniKaydetIstegi,
  YuklemePlaniOlusturIstegi,
  YuklemePlaniOzeti,
  YuklemePlaniTanimlari,
} from '../../shared/models/index';

/** Yükleme planları, ekipman kitaplığı ve mevzuat kurallarının API istemcisi. */
@Injectable({ providedIn: 'root' })
export class YuklemePlanlamaService extends BaseApiService {
  // ----- Planlar -----

  tanimlar(): Observable<ApiResult<YuklemePlaniTanimlari>> {
    return this.get<YuklemePlaniTanimlari>(API.YUKLEME_PLANLARI.TANIMLAR);
  }

  projeAdaylari(arama: string, sayfa: number, boyut: number): Observable<ApiResult<PaginatedList<PlanProjeAdayi>>> {
    return this.get<PaginatedList<PlanProjeAdayi>>(API.YUKLEME_PLANLARI.PROJE_ADAYLARI, {
      params: sayfaParametreleri(arama, sayfa, boyut),
    });
  }

  planlar(arama: string, sayfa: number, boyut: number): Observable<ApiResult<PaginatedList<YuklemePlaniOzeti>>> {
    return this.get<PaginatedList<YuklemePlaniOzeti>>(API.YUKLEME_PLANLARI.LISTE, {
      params: sayfaParametreleri(arama, sayfa, boyut),
    });
  }

  plan(id: number): Observable<ApiResult<YuklemePlaniDetayi>> {
    return this.get<YuklemePlaniDetayi>(API.YUKLEME_PLANLARI.PLAN(id));
  }

  olustur(istek: YuklemePlaniOlusturIstegi): Observable<ApiResult<YuklemePlaniDetayi>> {
    return this.post<YuklemePlaniDetayi>(API.YUKLEME_PLANLARI.LISTE, istek);
  }

  kaydet(id: number, istek: YuklemePlaniKaydetIstegi): Observable<ApiResult<YuklemePlaniDetayi>> {
    return this.put<YuklemePlaniDetayi>(API.YUKLEME_PLANLARI.PLAN(id), istek);
  }

  kaynaktanGuncelle(id: number, beklenenRevizyonNo: number): Observable<ApiResult<YuklemePlaniDetayi>> {
    return this.post<YuklemePlaniDetayi>(API.YUKLEME_PLANLARI.KAYNAKTAN_GUNCELLE(id), { beklenenRevizyonNo });
  }

  /** Otomatik yerleşim: sonuç yeni revizyon olarak yazılır; arada başka biri kaydettiyse 409. */
  hesapla(id: number, beklenenRevizyonNo: number, lokasyonTercihi: YuklemeLokasyonTercihi): Observable<ApiResult<YuklemePlaniDetayi>> {
    return this.post<YuklemePlaniDetayi>(API.YUKLEME_PLANLARI.HESAPLA(id), { beklenenRevizyonNo, lokasyonTercihi });
  }

  /** Elle yerleşimi kaydetmeden denetler (sürükle-bırak sonrası anlık kontrol). */
  elleDenetle(id: number, araclar: ElleAracIstegi[]): Observable<ApiResult<PlanYerlesimi>> {
    return this.post<PlanYerlesimi>(API.YUKLEME_PLANLARI.YERLESIM_DENETLE(id), { araclar });
  }

  /** Elle düzenlenen yerleşimi yeni revizyon olarak kaydeder; arada başka biri kaydettiyse 409. */
  elleKaydet(id: number, beklenenRevizyonNo: number, araclar: ElleAracIstegi[]): Observable<ApiResult<YuklemePlaniDetayi>> {
    return this.put<YuklemePlaniDetayi>(API.YUKLEME_PLANLARI.YERLESIM(id), { beklenenRevizyonNo, araclar });
  }

  /** Araç talep ve planlama raporu (PDF); son kaydedilen revizyonun yerleşimiyle. */
  aracTalepRaporu(id: number): Observable<HttpResponse<Blob>> {
    return this.downloadFileResponse(API.YUKLEME_PLANLARI.RAPOR_ARAC_TALEBI(id));
  }

  /** Araç bazlı yükleme planı raporu (PDF); aynı plan, revizyon ve araç numaralarıyla. */
  yuklemePlaniRaporu(id: number): Observable<HttpResponse<Blob>> {
    return this.downloadFileResponse(API.YUKLEME_PLANLARI.RAPOR_YUKLEME_PLANI(id));
  }

  // ----- Ekipman kitaplığı -----

  ekipmanAileleri(): Observable<ApiResult<EkipmanAilesiModeli[]>> {
    return this.get<EkipmanAilesiModeli[]>(API.EKIPMAN_KITAPLIGI.AILELER);
  }

  konfigurasyonlar(suzgec: EkipmanListeSuzgeci): Observable<ApiResult<PaginatedList<EkipmanKonfigurasyonOzeti>>> {
    let params = sayfaParametreleri(suzgec.arama ?? '', suzgec.sayfa ?? 1, suzgec.boyut ?? 25);
    if (suzgec.aileId) params = params.set('aileId', suzgec.aileId);
    if (suzgec.tipId) params = params.set('tipId', suzgec.tipId);
    if (suzgec.dogrulamaDurumu) params = params.set('dogrulamaDurumu', suzgec.dogrulamaDurumu);
    if (suzgec.pasifleriGoster) params = params.set('pasifleriGoster', true);
    return this.get<PaginatedList<EkipmanKonfigurasyonOzeti>>(API.EKIPMAN_KITAPLIGI.KONFIGURASYONLAR, { params });
  }

  konfigurasyon(id: number): Observable<ApiResult<EkipmanKonfigurasyonDetayi>> {
    return this.get<EkipmanKonfigurasyonDetayi>(API.EKIPMAN_KITAPLIGI.KONFIGURASYON(id));
  }

  dogrula(id: number, revizyonNo: number): Observable<ApiResult<EkipmanKonfigurasyonDetayi>> {
    return this.post<EkipmanKonfigurasyonDetayi>(API.EKIPMAN_KITAPLIGI.DOGRULA(id), { revizyonNo });
  }

  sablonIndir(): Observable<HttpResponse<Blob>> {
    return this.downloadFileResponse(API.EKIPMAN_KITAPLIGI.SABLON);
  }

  disaAktar(): Observable<HttpResponse<Blob>> {
    return this.downloadFileResponse(API.EKIPMAN_KITAPLIGI.DISA_AKTAR);
  }

  /** Dosyayı yazmadan inceler: yeni / yeni revizyon / değişmeyen konfigürasyonlar ve sorunlar. */
  iceAktarOnizle(dosya: File): Observable<ApiResult<EkipmanIceAktarimSonucu>> {
    return this.postFormData<EkipmanIceAktarimSonucu>(API.EKIPMAN_KITAPLIGI.ICE_AKTAR_ONIZLE, dosyaFormu(dosya));
  }

  /** Dosyayı uygular; tek sorun varsa hiçbir şey yazılmaz ve sorunlar hata olarak döner. */
  iceAktar(dosya: File): Observable<ApiResult<EkipmanIceAktarimSonucu>> {
    return this.postFormData<EkipmanIceAktarimSonucu>(API.EKIPMAN_KITAPLIGI.ICE_AKTAR, dosyaFormu(dosya));
  }

  // ----- Mevzuat -----

  kuralSetleri(): Observable<ApiResult<MevzuatKuralSetiOzeti[]>> {
    return this.get<MevzuatKuralSetiOzeti[]>(API.MEVZUAT_KURALLARI.KURAL_SETLERI);
  }

  kuralSeti(id: number): Observable<ApiResult<MevzuatKuralSetiDetayi>> {
    return this.get<MevzuatKuralSetiDetayi>(API.MEVZUAT_KURALLARI.KURAL_SETI(id));
  }
}

function sayfaParametreleri(arama: string, sayfa: number, boyut: number): HttpParams {
  let params = new HttpParams().set('sayfa', sayfa).set('boyut', boyut);
  const metin = arama.trim();
  if (metin) params = params.set('arama', metin);
  return params;
}

function dosyaFormu(dosya: File): FormData {
  const form = new FormData();
  form.append('dosya', dosya, dosya.name);
  return form;
}
