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

  connectToApprovalStream() {
    if (this.sseCtrl) return; // Already connected
    const token = this._auth.getToken();
    if (!token) return;

    this.sseCtrl = new AbortController();
    const url = API.ONAY.SSE_STREAM || 'http://localhost:5000/api/onay/sse-stream'; // Update mapping in endpoints

    import('@microsoft/fetch-event-source').then(({ fetchEventSource }) => {
      fetchEventSource(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`
        },
        signal: this.sseCtrl!.signal,
        onmessage: (ev) => {
          if (ev.event === 'approval_update') {
            // Signal Header to re-fetch immediately
            this.notifyHeaderForNewApproval();
          }
        },
        onerror: (err) => {
          console.error('SSE Error:', err);
          // Optional: rethrow to stop reconnection, or return nothing to let it autoreconnect
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
