import { Injectable, inject } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { BaseApiService } from '../../core/services/base-api.service';
import { API } from '../../core/constants/api-endpoints';
import { HttpParams } from '@angular/common/http';
import {
  ApiResult, GridUrunDto, GridDurumGuncelleDto, GridTopluSevkDto, GridDurumSifirlaDto, KaliteDurumGuncelleDto, SurecDurumGuncelleDto,
  GridIsListesiDto, GridSahaUrunleriParams, GridSahaUrunleriDto, GridMalKabulParams, GridMalKabulGecmisiDto,
} from '../../shared/models/index';

/**
 * GridController endpoints:
 *  GET  /api/grid/urunler/{projeId}
 *  GET  /api/grid/saha/urunler, GET /api/grid/saha/mal-kabul (Grid Sahası, salt okuma)
 *  PUT  /api/grid/durum-guncelle
 *  PUT  /api/grid/durum-sifirla
 *  POST /api/grid/toplu-sevk
 *  PUT  /api/grid/kalite-durum
 *  PUT  /api/grid/surec-durum
 */
@Injectable({ providedIn: 'root' })
export class GridService {
  private api = inject(BaseApiService);

  private gridGuncellendi = new Subject<void>();
  public gridGuncellendi$ = this.gridGuncellendi.asObservable();
  private channel = new BroadcastChannel('grid_sync_channel');

  constructor() {
    this.channel.onmessage = (event) => {
      if (event.data === 'GRID_UPDATED') {
        this.gridGuncellendi.next();
      }
    };
  }

  notifyGridUpdated() {
    this.gridGuncellendi.next();
    this.channel.postMessage('GRID_UPDATED');
  }

  /** Proje bazında tüm ürünlerin grid + 3K durumları */
  getUrunler(projeId: number): Observable<ApiResult<GridUrunDto[]>> {
    return this.api.get<GridUrunDto[]>(API.GRID.URUNLER(projeId));
  }

  getIsListesi(params: { page?: number; pageSize?: number; isTipi?: string; projeId?: number | null; sadeceBugun?: boolean } = {}): Observable<ApiResult<GridIsListesiDto>> {
    const query = new URLSearchParams();
    query.set('page', String(params.page ?? 1));
    query.set('pageSize', String(params.pageSize ?? 25));

    if (params.isTipi && params.isTipi !== 'all') {
      query.set('isTipi', params.isTipi);
    }

    if (params.projeId) {
      query.set('projeId', String(params.projeId));
    }

    if (params.sadeceBugun) {
      query.set('sadeceBugun', 'true');
    }

    return this.api.get<GridIsListesiDto>(`${API.GRID.IS_LISTESI}?${query.toString()}`);
  }

  /** Grid Sahası: Grid'e gelmiş ürünler (varsayılan Grid'de bekleyenler; proje tipinden bağımsız, sunucu sayfalı). */
  getSahaUrunleri(params: GridSahaUrunleriParams = {}): Observable<ApiResult<GridSahaUrunleriDto>> {
    let query = new HttpParams()
      .set('pageNumber', String(params.pageNumber ?? 1))
      .set('pageSize', String(params.pageSize ?? 25));
    if (params.kapsam === 'tumu') query = query.set('kapsam', 'tumu');
    query = metinEkle(query, 'arama', params.arama);
    query = sayiEkle(query, 'projeTipiId', params.projeTipiId);
    query = sayiEkle(query, 'projeId', params.projeId);
    query = sayiEkle(query, 'gridDurumuId', params.gridDurumuId);
    query = metinEkle(query, 'siralama', params.siralama);
    if (params.azalan) query = query.set('azalan', 'true');
    return this.api.get<GridSahaUrunleriDto>(API.GRID.SAHA_URUNLER, { params: query });
  }

  /** Grid Sahası: Grid personelinin mal kabul kayıtları (canlı ve arşiv hareketleri, sunucu sayfalı). */
  getMalKabulKayitlari(params: GridMalKabulParams = {}): Observable<ApiResult<GridMalKabulGecmisiDto>> {
    let query = new HttpParams()
      .set('pageNumber', String(params.pageNumber ?? 1))
      .set('pageSize', String(params.pageSize ?? 25));
    query = metinEkle(query, 'baslangic', params.baslangic);
    query = metinEkle(query, 'bitis', params.bitis);
    query = sayiEkle(query, 'personelId', params.personelId);
    query = sayiEkle(query, 'projeId', params.projeId);
    query = metinEkle(query, 'arama', params.arama);
    if (params.tur && params.tur !== 'mal-kabul') query = query.set('tur', params.tur);
    return this.api.get<GridMalKabulGecmisiDto>(API.GRID.SAHA_MAL_KABUL, { params: query });
  }

  /** Tekli ürün durumu güncelle */
  durumGuncelle(dto: GridDurumGuncelleDto): Observable<ApiResult<unknown>> {
    return this.api.put<unknown>(API.GRID.DURUM_GUNCELLE, dto);
  }

  /** Grid durumını sıfırla */
  durumSifirla(dto: GridDurumSifirlaDto): Observable<ApiResult<unknown>> {
    return this.api.put<unknown>(API.GRID.DURUM_SIFIRLA, dto);
  }

  /** Birden fazla ürünü tek seferde SevkEdildi yap */
  topluSevk(dto: GridTopluSevkDto): Observable<ApiResult<unknown>> {
    return this.api.post<unknown>(API.GRID.TOPLU_SEVK, dto);
  }

  /** Grid sayfasından manuel ürün ekle */
  manuelUrunEkle(dto: any): Observable<ApiResult<unknown>> {
    return this.api.post<unknown>(API.GRID.MANUEL_EKLE, dto);
  }

  /** Kalite durumunu güncelle (tekli/toplu) */
  kaliteDurumGuncelle(dto: KaliteDurumGuncelleDto): Observable<ApiResult<unknown>> {
    return this.api.put<unknown>(API.GRID.KALITE_DURUM, dto);
  }

  /** Süreç durumunu güncelle (tekli/toplu) */
  surecDurumGuncelle(dto: SurecDurumGuncelleDto): Observable<ApiResult<unknown>> {
    return this.api.put<unknown>(API.GRID.SUREC_DURUM, dto);
  }

  /** Toplu Grid durum güncelleme (Tam Geldi / Grid Kapandı / İptal) */
  topluDurumGuncelle(dto: { projeId: number; cekiSatiriIdler: number[]; hedefDurumId: number; aciklama?: string }): Observable<ApiResult<unknown>> {
    return this.api.put<unknown>(API.GRID.TOPLU_DURUM_GUNCELLE, dto);
  }

  /** Toplu Grid durumu sıfırlama (geri alma) */
  topluSifirla(dto: { projeId: number; cekiSatiriIdler: number[]; aciklama?: string }): Observable<ApiResult<unknown>> {
    return this.api.put<unknown>(API.GRID.TOPLU_SIFIRLA, dto);
  }
}


/** Boş/boşluk metin parametresi gönderilmez; değer kırpılır. */
function metinEkle(query: HttpParams, ad: string, deger: string | null | undefined): HttpParams {
  const kirpik = deger?.trim();
  return kirpik ? query.set(ad, kirpik) : query;
}

/** Yalnız pozitif sayı gönderilir. */
function sayiEkle(query: HttpParams, ad: string, deger: number | null | undefined): HttpParams {
  return deger && deger > 0 ? query.set(ad, String(deger)) : query;
}
