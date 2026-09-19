import { inject, Injectable } from '@angular/core';
import { API } from '../constants/api-endpoints';
import { BaseApiService } from './base-api.service';
import { PaginatedList } from '../../shared/models/common.model';
import { CekiRevizyonGecmisiDetayi, CekiRevizyonGecmisiKaydi } from '../../shared/models/ceki-revizyon-gecmisi.model';

@Injectable({ providedIn: 'root' })
export class CekiRevizyonGecmisiService {
  private readonly api = inject(BaseApiService);

  listele(projeId: number, pageNumber: number) {
    return this.api.get<PaginatedList<CekiRevizyonGecmisiKaydi>>(
      API.CEKI.REVIZYON_GECMISI(projeId), { params: { pageNumber, pageSize: 10 } }
    );
  }

  detay(kayit: CekiRevizyonGecmisiKaydi) {
    return this.api.get<CekiRevizyonGecmisiDetayi>(
      API.CEKI.REVIZYON_DETAY(kayit.projeId, kayit.kaynak, kayit.kayitId)
    );
  }

  dosya(kayit: CekiRevizyonGecmisiKaydi) {
    return this.api.downloadFile(API.CEKI.REVIZYON_DOSYA(kayit.projeId, kayit.kaynak, kayit.kayitId));
  }

  dosyaHatasi(error: unknown, fallback: string) {
    return this.api.downloadErrorMessage(error, fallback);
  }
}
