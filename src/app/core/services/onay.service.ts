import { Injectable, inject } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { BaseApiService } from './base-api.service';
import { AuthService } from '../auth/auth.service';
import { API } from '../constants/api-endpoints';
import { ApiResult } from '../../shared/models/common.model';
import { OnayBekleyenIslemDto, IslemOnaylaCommand, IslemReddetCommand } from '../../shared/models/onay-bekleyen-islem.model';

@Injectable({
  providedIn: 'root'
})
export class OnayService {
  private api = inject(BaseApiService);
  
  // Header component'i bilgilendirmek için Subject
  private onayIstendiSource = new Subject<void>();
  onayIstendi$ = this.onayIstendiSource.asObservable();

  private _auth = inject(AuthService); // Assuming AuthService is provided in root
  private sseCtrl: AbortController | null = null;
  private sseRetryCount = 0;
  private readonly MAX_SSE_RETRIES = 10;

  connectToApprovalStream() {
    if (this.sseCtrl) return; // Already connected
    const token = this._auth.getToken();
    if (!token) return;

    this.sseRetryCount = 0;
    this.sseCtrl = new AbortController();
    const url = API.ONAY.SSE_STREAM || 'http://localhost:5000/api/onay/sse-stream';

    import('@microsoft/fetch-event-source').then(({ fetchEventSource }) => {
      fetchEventSource(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`
        },
        signal: this.sseCtrl!.signal,
        onmessage: (ev) => {
          this.sseRetryCount = 0; // Başarılı mesaj → sayacı sıfırla
          if (ev.event === 'approval_update') {
            this.notifyHeaderForNewApproval();
          }
        },
        onerror: (err) => {
          this.sseRetryCount++;
          console.error(`SSE Error (${this.sseRetryCount}/${this.MAX_SSE_RETRIES}):`, err);
          if (this.sseRetryCount >= this.MAX_SSE_RETRIES) {
            console.warn('SSE: Maksimum deneme sayısına ulaşıldı, bağlantı kesiliyor.');
            this.disconnectStream();
            throw err; // fetchEventSource reconnect'i durdurur
          }
        }
      }).catch(err => console.error("Could not connect to SSE", err));
    });
  }

  disconnectStream() {
    if (this.sseCtrl) {
      this.sseCtrl.abort();
      this.sseCtrl = null;
    }
  }

  notifyHeaderForNewApproval() {
    this.onayIstendiSource.next();
  }

  getBekleyenler(): Observable<ApiResult<OnayBekleyenIslemDto[]>> {
    return this.api.get<OnayBekleyenIslemDto[]>(API.ONAY.BEKLEYENLER);
  }

  getBekleyenSayisi(): Observable<ApiResult<number>> {
    return this.api.get<number>(API.ONAY.BEKLEYEN_SAYISI);
  }

  onayla(command: IslemOnaylaCommand): Observable<ApiResult<any>> {
    return this.api.post<any>(API.ONAY.ONAYLA, command);
  }

  reddet(command: IslemReddetCommand): Observable<ApiResult<any>> {
    return this.api.post<any>(API.ONAY.REDDET, command);
  }

  getKurallar(): Observable<ApiResult<any[]>> {
    return this.api.get<any[]>(`${API.ONAY.BEKLEYENLER.replace('/bekleyenler', '')}/kurallar`);
  }

  updateKural(lookupUcKDurumId: number, onayGerektirirMi: boolean): Observable<ApiResult<any>> {
    return this.api.put<any>(`${API.ONAY.BEKLEYENLER.replace('/bekleyenler', '')}/kural-guncelle/${lookupUcKDurumId}`, onayGerektirirMi);
  }
}
