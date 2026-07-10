import { HttpParams } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, Subject, tap } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { API } from '../constants/api-endpoints';
import {
  BildirimAbonelikAyariDto,
  BildirimAbonelikleriniGuncelleRequest,
  BildirimDto,
  BildirimListeDto,
  BildirimListeFiltre,
  BildirimOzetDto,
} from '../../shared/models';
import { ApiResult } from '../../shared/models/common.model';
import { BaseApiService } from './base-api.service';

@Injectable({ providedIn: 'root' })
export class BildirimService {
  private readonly api = inject(BaseApiService);
  private readonly auth = inject(AuthService);
  private readonly approvalUpdateSource = new Subject<void>();
  private readonly notificationUpdateSource = new Subject<void>();

  private sseController: AbortController | null = null;
  private sseConnecting = false;
  private sseConnectionId = 0;
  private sseRetryCount = 0;
  private readonly maxSseRetries = 10;

  readonly bildirimler = signal<BildirimDto[]>([]);
  readonly toplamOkunmamis = signal(0);
  readonly loading = signal(false);
  readonly onayGuncellendi$ = this.approvalUpdateSource.asObservable();
  readonly bildirimGuncellendi$ = this.notificationUpdateSource.asObservable();
  readonly bildirimVarMi = computed(() => this.toplamOkunmamis() > 0);

  loadUnread(limit = 20): void {
    this.loading.set(true);
    this.api.get<BildirimOzetDto>(`${API.BILDIRIM.OKUNMAMIS}?limit=${limit}`).subscribe(res => {
      this.loading.set(false);
      if (!res.isSuccess || !res.value) return;

      this.bildirimler.set(res.value.bildirimler ?? []);
      this.toplamOkunmamis.set(res.value.toplamOkunmamis ?? 0);
    });
  }

  markAsRead(bildirimId: number): Observable<ApiResult<unknown>> {
    return this.api.put<unknown>(API.BILDIRIM.OKUNDU(bildirimId), {}).pipe(
      tap(res => {
        if (!res.isSuccess) return;
        this.bildirimler.update(items => items.filter(item => item.id !== bildirimId));
        this.toplamOkunmamis.update(value => Math.max(value - 1, 0));
      })
    );
  }

  markAllAsRead(): Observable<ApiResult<unknown>> {
    return this.api.put<unknown>(API.BILDIRIM.TUMUNU_OKUNDU, {}).pipe(
      tap(res => {
        if (!res.isSuccess) return;
        this.bildirimler.set([]);
        this.toplamOkunmamis.set(0);
      })
    );
  }

  getBildirimler(filtre: BildirimListeFiltre): Observable<ApiResult<BildirimListeDto>> {
    let params = new HttpParams()
      .set('durum', filtre.durum)
      .set('sayfa', filtre.sayfa)
      .set('sayfaBoyutu', filtre.sayfaBoyutu);

    if (filtre.baslangicTarihi) params = params.set('baslangicTarihi', filtre.baslangicTarihi);
    if (filtre.bitisTarihi) params = params.set('bitisTarihi', filtre.bitisTarihi);
    if (filtre.tipId != null) params = params.set('tipId', filtre.tipId);
    if (filtre.arama?.trim()) params = params.set('arama', filtre.arama.trim());

    return this.api.get<BildirimListeDto>(API.BILDIRIM.LIST, { params });
  }

  getBildirimDetayi(bildirimId: number): Observable<ApiResult<BildirimDto>> {
    return this.api.get<BildirimDto>(API.BILDIRIM.DETAY(bildirimId));
  }

  getAbonelikAyarlari(): Observable<ApiResult<BildirimAbonelikAyariDto[]>> {
    return this.api.get<BildirimAbonelikAyariDto[]>(API.BILDIRIM.ABONELIK_AYARLARI);
  }

  updateAbonelikAyarlari(
    request: BildirimAbonelikleriniGuncelleRequest
  ): Observable<ApiResult<unknown>> {
    return this.api.put<unknown>(API.BILDIRIM.ABONELIK_AYARLARI, request);
  }

  connectToStream(): void {
    if (this.sseController || this.sseConnecting) return;
    const token = this.auth.getToken();
    if (!token) return;

    this.sseRetryCount = 0;
    this.sseConnecting = true;
    this.sseController = new AbortController();
    const connectionId = ++this.sseConnectionId;

    import('@microsoft/fetch-event-source').then(({ fetchEventSource }) => {
      if (connectionId !== this.sseConnectionId || !this.sseController) {
        this.sseConnecting = false;
        return;
      }

      fetchEventSource(API.ONAY.SSE_STREAM, {
        method: 'GET',
        openWhenHidden: true,
        headers: { Authorization: `Bearer ${token}` },
        signal: this.sseController.signal,
        onopen: async response => {
          this.sseConnecting = false;
          if (!response.ok) throw new Error(`SSE connection failed: ${response.status}`);
          this.sseRetryCount = 0;
          this.loadUnread();
        },
        onmessage: event => {
          this.sseRetryCount = 0;
          if (event.event === 'notification_update') {
            this.loadUnread();
            this.notificationUpdateSource.next();
          }
          if (event.event === 'approval_update') this.approvalUpdateSource.next();
        },
        onclose: () => {
          if (connectionId === this.sseConnectionId && this.sseController) {
            throw new Error('SSE connection closed unexpectedly');
          }
        },
        onerror: error => {
          this.sseConnecting = false;
          this.sseRetryCount++;
          console.error(`SSE Error (${this.sseRetryCount}/${this.maxSseRetries}):`, error);
          if (this.sseRetryCount >= this.maxSseRetries) {
            this.disconnectStream();
            throw error;
          }
          return Math.min(this.sseRetryCount * 1000, 10000);
        },
      }).catch(error => {
        this.sseConnecting = false;
        if (connectionId === this.sseConnectionId && this.sseController) {
          console.error('SSE bağlantısı kurulamadı.', error);
          this.sseController = null;
        }
      });
    }).catch(error => {
      this.sseConnecting = false;
      if (connectionId === this.sseConnectionId) this.sseController = null;
      console.error('SSE istemcisi yüklenemedi.', error);
    });
  }

  disconnectStream(): void {
    this.sseConnectionId++;
    this.sseConnecting = false;
    this.sseController?.abort();
    this.sseController = null;
  }
}
