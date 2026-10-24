import { inject, Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API } from '../../core/constants/api-endpoints';
import { ProjeTipi } from '../../core/constants/enums';
import { projeTipiBaglami } from '../../core/constants/proje-tipi';
import { YETKI } from '../../core/constants/yetki-kodlari';
import { BaseApiService } from '../../core/services/base-api.service';
import { ApiResult, GenelAramaProje, GenelAramaSandik, GenelAramaSonucu, GenelAramaUrun } from '../../shared/models/index';

/** Sunucudaki GenelAramaKurali ile aynı sınırlar. */
export const GENEL_ARAMA_EN_AZ = 2;
export const GENEL_ARAMA_PANEL_LIMITI = 6;
export const GENEL_ARAMA_SAYFA_LIMITI = 50;

@Injectable({ providedIn: 'root' })
export class GenelAramaService {
  private readonly api = inject(BaseApiService);

  ara(q: string, limit = GENEL_ARAMA_PANEL_LIMITI): Observable<ApiResult<GenelAramaSonucu>> {
    return this.api.get<GenelAramaSonucu>(API.ARAMA, { params: new HttpParams().set('q', q.trim()).set('limit', String(limit)) });
  }
}

type IzinVar = (kod: string) => boolean;

/** Projenin sandık listesini açan izin: Normal sandık yönetimi, Saha/Yedek sandıklar (rota guard'ıyla aynı). */
function yonetimIzni(projeTipiId: number): string {
  const tip = projeTipiBaglami(projeTipiId).tip;
  return tip === ProjeTipi.Saha ? YETKI.SAHA.SANDIKLAR : tip === ProjeTipi.Yedek ? YETKI.YEDEK.SANDIKLAR : YETKI.SANDIK.YONETIMI;
}

/**
 * Proje sonucunun gideceği yer: izin varsa projenin sandık listesi, yoksa Grid, o da yoksa 3K ekranı; hiçbiri yoksa null
 * (sonuç görünür ama tıklanamaz).
 */
export function projeRotasi(p: Pick<GenelAramaProje, 'id' | 'projeTipiId'>, izinVar: IzinVar): unknown[] | null {
  const baglam = projeTipiBaglami(p.projeTipiId);
  if (izinVar(yonetimIzni(p.projeTipiId))) return [baglam.yonetimRotasi, p.id];
  if (izinVar(baglam.yetki.gridModulu)) return [baglam.gridRotasi, p.id];
  if (izinVar(baglam.yetki.ucKModulu)) return [baglam.ucKRotasi, p.id];
  return null;
}

/** Sandık sonucunun gideceği yer: sandık detayı (yönetim ekranından, yoksa 3K modülünden); izin yoksa null. */
export function sandikRotasi(s: Pick<GenelAramaSandik, 'id' | 'projeId' | 'projeTipiId'>, izinVar: IzinVar): unknown[] | null {
  const baglam = projeTipiBaglami(s.projeTipiId);
  if (izinVar(yonetimIzni(s.projeTipiId))) return [baglam.yonetimRotasi, s.projeId, s.id];
  if (izinVar(baglam.yetki.ucKModulu)) return [baglam.ucKRotasi, 'sandik', s.projeId, s.id];
  return null;
}

/** Barkod sonucu barkod arama ekranında tam eşleşmeyle açılır (sunucu yalnız barkod-urun-arama izniyle döndürür). */
export function urunRotasi(u: Pick<GenelAramaUrun, 'barkod'>): { commands: unknown[]; queryParams: Record<string, string> } {
  return { commands: ['/barkod-arama'], queryParams: { barkod: u.barkod } };
}
