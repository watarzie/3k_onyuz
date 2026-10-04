import { Injectable, inject } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { API } from '../constants/api-endpoints';
import {
  ApiResult,
  FinansAylikDegerRequest,
  FinansAylikIs,
  FinansAylikSayfaliSonuc,
  FinansDuzenliIs,
  FinansDuzenliIsListelemeRequest,
  FinansDuzenliIsKaydetRequest,
  FinansDonemOlusturSonuc,
  FinansFatura,
  FinansFaturaOlusturRequest,
  FinansFaturaGuncelleRequest,
  FinansSiparisGuncelleRequest,
  FinansGider,
  FinansGiderKategori,
  FinansGiderKalemi,
  FinansGiderKaydetRequest,
  FinansIsKaydi,
  FinansListelemeRequest,
  FinansOzelIsKaydetRequest,
  FinansSayfaliSonuc,
  FinansSiparis,
  FinansSiparisDetay,
  FinansSiparisGrubu,
  FinansSiparisGrupFiltre,
  FinansSiparisKalemEkleRequest,
  FinansSiparisOlusturRequest,
  FinansUrun,
  FinansUrunListelemeRequest,
  FinansUrunKaydetRequest,
} from '../../shared/models';
import { BaseApiService } from './base-api.service';
import {
  FinansPanel,
  FinansHareket,
  FinansBekleyen,
  FinansFiyatlandirma,
  FinansKaliciSil,
  FinansKaliciSilOnizleme,
  FinansBelge,
  FinansVarlikTuru,
  FinansDegisiklik,
  FinansBekleyenAsama,
  FinansOdemeKaydet,
  FinansParaBirimi,
  FinansRaporOnizleme,
  FinansParaBirimiKaydet,
  FinansParametreler,
  FinansVadeUyarilari,
  FinansYenidenFiyatlamaSonuc,
  FinansTarifeDuzeltmeOnizleme,
  FinansTarifeDuzeltmeSonuc,
  FinansTarifeDuzeltRequest,
} from '../../shared/models/finans-v2.model';
import { FinansIsKategorisi, FinansKarsilanma } from '../constants/enums';

@Injectable({ providedIn: 'root' })
export class FinansService {
  private api = inject(BaseApiService);

  panel(baslangic: string, bitis: string) {
    return this.api.get<FinansPanel>(API.FINANS.PANEL, {
      params: new HttpParams().set('baslangic', baslangic).set('bitis', bitis),
    });
  }
  hareketler(request: FinansListelemeRequest, tur?: string) {
    return this.api.get<FinansSayfaliSonuc<FinansHareket>>(API.FINANS.HAREKETLER, {
      params: tur
        ? this.listelemeParametreleri(request).set('tur', tur)
        : this.listelemeParametreleri(request),
    });
  }
  genelArama(request: FinansListelemeRequest) {
    return this.liste<FinansIsKaydi>(API.FINANS.GENEL_ARAMA, request);
  }
  /** Bekleme listesi; asama verilirse yalnız sipariş ya da fatura bekleyen kalemler (panel kovası tıklaması). */
  yaslandirma(request: FinansListelemeRequest, referansTarihi: string, minimumGun: number, asama?: FinansBekleyenAsama) {
    let params = this.listelemeParametreleri(request)
      .set('referansTarihi', referansTarihi)
      .set('minimumGun', minimumGun);
    if (asama) params = params.set('asama', asama);
    return this.api.get<FinansSayfaliSonuc<FinansBekleyen>>(API.FINANS.YASLANDIRMA, { params });
  }
  isDetay(id: number) {
    return this.api.get<FinansIsKaydi>(API.FINANS.IS_KAYDI(id));
  }
  finansTarihiDegistir(id: number, finansTarihi: string, aciklama: string) {
    return this.api.post<void>(API.FINANS.FINANS_TARIHI(id), { finansTarihi, aciklama });
  }
  fiyatlandir(id: number, request: FinansFiyatlandirma) {
    return this.api.post<void>(API.FINANS.FIYATLANDIRMA(id), request);
  }
  /** Para birimi tanımları (F1); seçim listeleri yalnız aktif olanları kullanır. */
  paraBirimleri(sadeceAktif = false) {
    return this.api.get<FinansParaBirimi[]>(API.FINANS.PARA_BIRIMLERI, {
      params: new HttpParams().set('sadeceAktif', sadeceAktif),
    });
  }
  paraBirimiKaydet(request: FinansParaBirimiKaydet, id?: number) {
    return id
      ? this.api.put<FinansParaBirimi>(API.FINANS.PARA_BIRIMI(id), request)
      : this.api.post<FinansParaBirimi>(API.FINANS.PARA_BIRIMLERI, request);
  }
  /** Vade parametreleri (D3): varsayılan vade günü ve vade uyarısı penceresi. */
  parametreler() {
    return this.api.get<FinansParametreler>(API.FINANS.PARAMETRELER);
  }
  parametreleriKaydet(request: FinansParametreler) {
    return this.api.put<FinansParametreler>(API.FINANS.PARAMETRELER, request);
  }
  /** Faturayı ödendi/ödenmedi işaretler; işaretin kaldırılması gerekçe ister. */
  faturaOdeme(id: number, request: FinansOdemeKaydet) {
    return this.api.put<FinansFatura>(API.FINANS.FATURA_ODEME(id), request);
  }
  vadeUyarilari(enFazlaKalem = 20) {
    return this.api.get<FinansVadeUyarilari>(API.FINANS.VADE_UYARILARI, {
      params: new HttpParams().set('enFazlaKalem', enFazlaKalem),
    });
  }
  /** D4: ürüne bağlı, PO'suz açık kalemleri finans tarihlerinde geçerli tarifeyle yeniden fiyatlar. */
  urunYenidenFiyatla(id: number, aciklama: string) {
    return this.api.post<FinansYenidenFiyatlamaSonuc>(API.FINANS.URUN_YENIDEN_FIYATLA(id), { aciklama });
  }
  /** Hatalı tarife düzeltmenin etkisini veriyi değiştirmeden gösterir: düzeltilecek/korunacak kalemler. */
  tarifeDuzeltmeOnizle(urunId: number, tarifeId: number, birimFiyat: number, kdvOrani: number) {
    return this.api.get<FinansTarifeDuzeltmeOnizleme>(API.FINANS.TARIFE_DUZELTME_ONIZLEME(urunId, tarifeId), {
      params: new HttpParams().set('birimFiyat', birimFiyat).set('kdvOrani', kdvOrani),
    });
  }
  /** Sürümün fiyatını gerekçeyle düzeltir; yalnız o sürümün tarife fiyatıyla fiyatlanmış açık kalemler değişir. */
  tarifeDuzelt(urunId: number, tarifeId: number, request: FinansTarifeDuzeltRequest) {
    return this.api.post<FinansTarifeDuzeltmeSonuc>(API.FINANS.TARIFE_DUZELT(urunId, tarifeId), request);
  }
  kaliciSilOnizleme(varlikTuru: FinansVarlikTuru, id: number) {
    return this.api.get<FinansKaliciSilOnizleme>(API.FINANS.KALICI_SIL_ONIZLEME, {
      params: new HttpParams().set('varlikTuru', varlikTuru).set('id', id),
    });
  }
  kaliciSil(request: FinansKaliciSil) {
    return this.api.post<void>(API.FINANS.KALICI_SIL, request);
  }
  belgeler(hedefTuru: FinansVarlikTuru, hedefId: number) {
    return this.api.get<FinansBelge[]>(API.FINANS.BELGELER, {
      params: new HttpParams().set('hedefTuru', hedefTuru).set('hedefId', hedefId),
    });
  }
  belgeYukle(hedefTuru: FinansVarlikTuru, hedefId: number, dosya: File) {
    const data = new FormData();
    data.set('hedefTuru', hedefTuru);
    data.set('hedefId', String(hedefId));
    data.set('dosya', dosya);
    return this.api.postFormData<FinansBelge>(API.FINANS.BELGELER, data);
  }
  belgeIndir(id: number) {
    return this.api.downloadFile(API.FINANS.BELGE_INDIR(id));
  }
  downloadErrorMessage(error: unknown, fallback: string): Promise<string> {
    return this.api.downloadErrorMessage(error, fallback);
  }
  denetim(varlikTuru: FinansVarlikTuru, varlikId: number, pageNumber = 1) {
    return this.api.get<FinansSayfaliSonuc<FinansDegisiklik>>(API.FINANS.DENETIM, {
      params: new HttpParams()
        .set('varlikTuru', varlikTuru)
        .set('varlikId', varlikId)
        .set('pageNumber', pageNumber)
        .set('pageSize', 25),
    });
  }
  siparisIptal(id: number, aciklama: string) {
    return this.api.post<void>(API.FINANS.SIPARIS_IPTAL(id), { aciklama });
  }
  faturaIptal(id: number, aciklama: string) {
    return this.api.post<void>(API.FINANS.FATURA_IPTAL(id), { aciklama });
  }
  isIptal(id: number, aciklama: string) {
    return this.api.post<void>(API.FINANS.IS_KAYDI_IPTAL(id), { aciklama });
  }

  isKayitlariSecim(ids: number[]) {
    return this.api.post<FinansIsKaydi[]>(API.FINANS.IS_KAYITLARI_SECIM, { ids });
  }
  siparisler(request: FinansListelemeRequest = this.varsayilanListeleme()) {
    return this.liste<FinansSiparis>(API.FINANS.SIPARISLER, request);
  }
  siparisOlustur(request: FinansSiparisOlusturRequest) {
    return this.api.post<FinansSiparis>(API.FINANS.SIPARISLER, request);
  }
  /** Mevcut aktif PO'ya yeni iş kalemi veya aynı işe ek tutar bağlar. */
  siparisKalemEkle(id: number, request: FinansSiparisKalemEkleRequest) {
    return this.api.post<FinansSiparis>(API.FINANS.SIPARIS_KALEMLER(id), request);
  }
  /** PO açma ekranı: proje × kategori / düzenli iş grupları (sunucu sayfalaması). */
  siparisGruplari(filtre: FinansSiparisGrupFiltre) {
    let params = new HttpParams()
      .set('pageNumber', filtre.pageNumber)
      .set('pageSize', filtre.pageSize)
      .set('sadeceSiparisBekleyen', filtre.sadeceSiparisBekleyen ?? true);
    if (filtre.arama?.trim()) params = params.set('arama', filtre.arama.trim());
    if (filtre.baslangic) params = params.set('baslangic', filtre.baslangic);
    if (filtre.bitis) params = params.set('bitis', filtre.bitis);
    if (filtre.paraBirimi) params = params.set('paraBirimi', filtre.paraBirimi);
    if (filtre.projeId) params = params.set('projeId', filtre.projeId);
    if (filtre.duzenliIsId) params = params.set('duzenliIsId', filtre.duzenliIsId);
    (filtre.kategoriler ?? []).forEach((kategori) => (params = params.append('kategoriler', kategori)));
    (filtre.isKaydiIds ?? []).forEach((id) => (params = params.append('isKaydiIds', id)));
    return this.api.get<FinansSayfaliSonuc<FinansSiparisGrubu>>(API.FINANS.SIPARIS_GRUPLARI, { params });
  }
  siparisDetay(id: number): Observable<ApiResult<FinansSiparisDetay>> {
    // API doğrudan FinansSiparisModel döndürür; özet sarmalaması istemci adaptörüdür.
    return this.api.get<FinansSiparis>(API.FINANS.SIPARIS(id)).pipe(
      map((result) => ({
        isSuccess: result.isSuccess,
        error: result.error,
        statusCode: result.statusCode,
        value: result.value
          ? {
              ozet: result.value,
              kalemler: result.value.kalemler ?? [],
              belgeler: [],
              createdDate: result.value.createdDate ?? '',
              createdBy: result.value.createdBy,
            }
          : undefined,
      })),
    );
  }
  siparisGuncelle(id: number, request: FinansSiparisGuncelleRequest) {
    return this.api.put<void>(API.FINANS.SIPARIS(id), request);
  }
  faturaDetay(id: number) {
    return this.api.get<FinansFatura>(API.FINANS.FATURA(id));
  }
  faturaGuncelle(id: number, request: FinansFaturaGuncelleRequest) {
    return this.api.put<void>(API.FINANS.FATURA(id), request);
  }
  faturalar(request: FinansListelemeRequest = this.varsayilanListeleme()) {
    return this.liste<FinansFatura>(API.FINANS.FATURALAR, request);
  }
  faturaOlustur(request: FinansFaturaOlusturRequest) {
    return this.api.post<FinansFatura>(API.FINANS.FATURALAR, request);
  }
  aylikIsler(
    yil: number,
    ay: number,
    request: FinansListelemeRequest = this.varsayilanListeleme(),
  ) {
    const params = this.listelemeParametreleri(request).set('yil', yil).set('ay', ay);
    return this.api.get<FinansAylikSayfaliSonuc>(API.FINANS.AYLIK_ISLER, { params });
  }
  ozelIsOlustur(request: FinansOzelIsKaydetRequest) {
    return this.api.post<FinansIsKaydi>(API.FINANS.OZEL_ISLER, request);
  }
  ozelIsAylikDegerGuncelle(id: number, request: FinansAylikDegerRequest) {
    return this.api.put<void>(API.FINANS.OZEL_IS_AYLIK_DEGER(id), request);
  }
  ozelIsIptal(id: number, aciklama: string) {
    return this.api.post<void>(API.FINANS.OZEL_IS_IPTAL(id), { aciklama });
  }
  ozelIsGeriAl(id: number) {
    return this.api.post<void>(API.FINANS.OZEL_IS_GERI_AL(id), {});
  }
  duzenliIsler(request: FinansDuzenliIsListelemeRequest = { pageNumber: 1, pageSize: 25 }) {
    let params = new HttpParams()
      .set('pageNumber', request.pageNumber)
      .set('pageSize', request.pageSize)
      .set('sadeceAktif', request.sadeceAktif ?? false);
    if (request.arama?.trim()) params = params.set('arama', request.arama.trim());
    return this.api.get<FinansSayfaliSonuc<FinansDuzenliIs>>(API.FINANS.DUZENLI_ISLER, { params });
  }
  duzenliIsOlustur(request: FinansDuzenliIsKaydetRequest) {
    return this.api.post<FinansDuzenliIs>(API.FINANS.DUZENLI_ISLER, request);
  }
  duzenliIsGuncelle(id: number, request: FinansDuzenliIsKaydetRequest) {
    return this.api.put<FinansDuzenliIs>(API.FINANS.DUZENLI_IS(id), request);
  }
  /** Düzenli işin verilen tarihe kadarki eksik aylarını üretir; aynı ay ikinci kez üretilmez. */
  duzenliIsDonemUret(id: number, bitisTarihi: string) {
    return this.api.post<FinansDonemOlusturSonuc>(API.FINANS.DUZENLI_IS_DONEMLER(id), { bitisTarihi });
  }
  giderler(request: FinansListelemeRequest = this.varsayilanListeleme()) {
    return this.liste<FinansGider>(API.FINANS.GIDERLER, request);
  }
  giderKategorileri() {
    return this.api.get<FinansGiderKategori[]>(API.FINANS.GIDER_KATEGORILERI);
  }
  giderKutuphaneKategorileri() {
    return this.api.get<FinansGiderKategori[]>(API.FINANS.GIDER_KUTUPHANE_KATEGORILERI);
  }
  giderKutuphaneKalemleri(kategoriId?: number) {
    const params = kategoriId ? new HttpParams().set('kategoriId', kategoriId) : new HttpParams();
    return this.api.get<FinansGiderKalemi[]>(API.FINANS.GIDER_KUTUPHANE_KALEMLERI, { params });
  }
  giderKalemleri(kategoriId?: number, sadeceAktif = false) {
    let params = new HttpParams().set('sadeceAktif', sadeceAktif);
    if (kategoriId) params = params.set('kategoriId', kategoriId);
    return this.api.get<FinansGiderKalemi[]>(API.FINANS.GIDER_KALEMLERI, { params });
  }
  giderKalemiKaydet(request: Omit<FinansGiderKalemi, 'id'>, id?: number) {
    return id
      ? this.api.put<FinansGiderKalemi>(API.FINANS.GIDER_KALEMI(id), request)
      : this.api.post<FinansGiderKalemi>(API.FINANS.GIDER_KALEMLERI, request);
  }
  giderKategoriKaydet(request: { ad: string; aktif: boolean }, id?: number) {
    return id
      ? this.api.put<FinansGiderKategori>(API.FINANS.GIDER_KATEGORISI(id), request)
      : this.api.post<FinansGiderKategori>(API.FINANS.GIDER_KATEGORILERI, request);
  }
  projeSecenekleri(arama: string, pageNumber = 1) {
    return this.api.get<FinansSayfaliSonuc<{ projeId: number; projeNo: string; musteri: string }>>(
      API.FINANS.PROJE_SECENEKLERI,
      {
        params: new HttpParams()
          .set('arama', arama)
          .set('pageNumber', pageNumber)
          .set('pageSize', 20),
      },
    );
  }
  giderOlustur(request: FinansGiderKaydetRequest) {
    return this.api.post<FinansGider>(API.FINANS.GIDERLER, request);
  }
  giderGuncelle(id: number, request: FinansGiderKaydetRequest) {
    return this.api.put<FinansGider>(API.FINANS.GIDER(id), request);
  }
  giderIptal(id: number, aciklama: string) {
    return this.api.post<void>(API.FINANS.GIDER_IPTAL(id), { aciklama });
  }
  urunler(request: FinansUrunListelemeRequest = { pageNumber: 1, pageSize: 25 }) {
    let params = new HttpParams()
      .set('pageNumber', request.pageNumber)
      .set('pageSize', request.pageSize)
      .set('sadeceAktif', request.sadeceAktif ?? false);
    if (request.arama?.trim()) params = params.set('arama', request.arama.trim());
    if (request.tarifeTarihi) params = params.set('tarifeTarihi', request.tarifeTarihi);
    return this.api.get<FinansSayfaliSonuc<FinansUrun>>(API.FINANS.URUNLER, { params });
  }
  urunOlustur(request: FinansUrunKaydetRequest) {
    return this.api.post<FinansUrun>(API.FINANS.URUNLER, request);
  }
  urunGuncelle(id: number, request: FinansUrunKaydetRequest) {
    return this.api.put<FinansUrun>(API.FINANS.URUN(id), request);
  }
  urunSil(id: number) {
    return this.api.delete<void>(API.FINANS.URUN(id));
  }
  isRaporu(format: 'pdf' | 'excel', request: FinansListelemeRequest = this.varsayilanListeleme()) {
    return this.api.downloadFile(
      format === 'pdf' ? API.FINANS.IS_RAPORU_PDF : API.FINANS.IS_RAPORU_EXCEL,
      { params: this.listelemeParametreleri(request) },
    );
  }
  giderRaporu(
    format: 'pdf' | 'excel',
    request: FinansListelemeRequest = this.varsayilanListeleme(),
  ) {
    return this.api.downloadFile(
      format === 'pdf' ? API.FINANS.GIDER_RAPOR_PDF : API.FINANS.GIDER_RAPOR_EXCEL,
      { params: this.listelemeParametreleri(request) },
    );
  }
  ozetRaporu(tur: string, format: 'pdf' | 'excel', request: FinansListelemeRequest) {
    return this.api.downloadFile(API.FINANS.OZET_RAPOR(tur, format), {
      params: this.listelemeParametreleri(request),
    });
  }
  /**
   * Sipariş durum raporu: satırlar seçilen sipariş/fatura karşılanmasındaki iş kalemleridir.
   * Durumlar sunucudaki karşılanma değerleriyle, iş grubu kategori listesiyle gönderilir.
   */
  siparisDurumRaporu(
    format: 'pdf' | 'excel',
    filtre: {
      baslangic?: string;
      bitis?: string;
      projeNo?: string;
      kategoriler?: FinansIsKategorisi[];
      siparisKarsilanma?: FinansKarsilanma;
      faturaKarsilanma?: FinansKarsilanma;
    },
  ) {
    const params = new URLSearchParams();
    if (filtre.baslangic) params.set('baslangic', filtre.baslangic);
    if (filtre.bitis) params.set('bitis', filtre.bitis);
    if (filtre.projeNo?.trim()) params.set('projeNo', filtre.projeNo.trim());
    (filtre.kategoriler ?? []).forEach((kategori) => params.append('kategoriler', String(kategori)));
    if (filtre.siparisKarsilanma !== undefined) params.set('siparisKarsilanma', String(filtre.siparisKarsilanma));
    if (filtre.faturaKarsilanma !== undefined) params.set('faturaKarsilanma', String(filtre.faturaKarsilanma));
    const endpoint =
      format === 'pdf' ? API.FINANS.SIPARIS_DURUM_RAPOR_PDF : API.FINANS.SIPARIS_DURUM_RAPOR_EXCEL;
    const sorgu = params.toString();
    return this.api.downloadFile(sorgu ? `${endpoint}?${sorgu}` : endpoint);
  }
  /** Rapor önizlemesi: dosyayla aynı başlık, sütunlar ve ilk satırlar (sunucuda aynı üreticiden). */
  raporOnizleme(tur: string, request: FinansListelemeRequest = this.varsayilanListeleme()) {
    return this.api.get<FinansRaporOnizleme>(API.FINANS.RAPOR_ONIZLEME(tur), {
      params: this.listelemeParametreleri(request),
    });
  }
  /** Alacak (vade/tahsilat) raporu: fatura listesiyle aynı filtreler. */
  alacakRaporu(format: 'pdf' | 'excel', request: FinansListelemeRequest = this.varsayilanListeleme()) {
    return this.api.downloadFile(format === 'pdf' ? API.FINANS.ALACAK_RAPOR_PDF : API.FINANS.ALACAK_RAPOR_EXCEL, {
      params: this.listelemeParametreleri(request),
    });
  }
  aylikRapor(format: 'pdf' | 'excel' | 'ayri', yil: number, ay: number, gruplar: string[]) {
    const params = new URLSearchParams({ yil: String(yil), ay: String(ay) });
    gruplar.forEach((grup) => params.append('gruplar', grup));
    const endpoint =
      format === 'pdf'
        ? API.FINANS.AYLIK_RAPOR_PDF
        : format === 'excel'
          ? API.FINANS.AYLIK_RAPOR_EXCEL
          : API.FINANS.AYLIK_RAPOR_AYRI;
    return this.api.downloadFile(`${endpoint}?${params}`);
  }

  private liste<T>(
    url: string,
    request: FinansListelemeRequest,
  ): Observable<ApiResult<FinansSayfaliSonuc<T>>> {
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
    for (const key of [
      'projeId',
      'isTuru',
      'durum',
      'paraBirimi',
      'talepEden',
      'siparisDurumu',
      'faturaDurumu',
      'faturaBekleyen',
      'faturaNumarasi',
      'firma',
      'sandikCinsi',
      'giderKategoriId',
      'faturalamaBekleyen',
      'siparisKarsilanma',
      'faturaKarsilanma',
      'odemeDurumu',
    ] as const) {
      const value = request[key];
      if (value !== undefined && value !== '') params = params.set(key, value);
    }
    (request.kategoriler ?? []).forEach((kategori) => (params = params.append('kategoriler', kategori)));
    if (request.iptalEdilenleriDahilEt !== undefined) {
      params = params.set('iptalEdilenleriDahilEt', request.iptalEdilenleriDahilEt);
    }
    return params;
  }

  private varsayilanListeleme(): FinansListelemeRequest {
    return { pageNumber: 1, pageSize: 25 };
  }
}
