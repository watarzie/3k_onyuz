import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseApiService } from './base-api.service';
import { API } from '../constants/api-endpoints';
import { ApiResult, FBTransferDto, FBTransferResultDto } from '../models/api-response.model';

/**
 * FBTransferController (1 endpoint):
 *  POST /api/fbtransfer
 */
@Injectable({ providedIn: 'root' })
export class FBTransferService {
  private api = inject(BaseApiService);

  olustur(dto: FBTransferDto): Observable<ApiResult<FBTransferResultDto>> {
    return this.api.post<FBTransferResultDto>(API.FB_TRANSFER.CREATE, dto);
  }
}
