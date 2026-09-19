import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { BaseApiService } from './base-api.service';
import { SandikService } from './sandik.service';
import { SandikUrunleriTopluTasiDto } from '../../shared/models/sandik-toplu-tasima.model';

describe('SandikService toplu taşıma sözleşmesi', () => {
  it('N tekil istek yerine tek toplu endpointi ve içerik kimliklerini gönderir', () => {
    const api = jasmine.createSpyObj<BaseApiService>('BaseApiService', ['post']);
    api.post.and.returnValue(of({ isSuccess: true }));
    TestBed.configureTestingModule({ providers: [SandikService, { provide: BaseApiService, useValue: api }] });
    const dto: SandikUrunleriTopluTasiDto = {
      projeId: 1, kaynakSandikId: 2, hedefSandikId: 3, islemAnahtari: 'test-key',
      satirlar: [{ kaynakSandikIcerikId: 4, tasinanAdet: 1.2345 }, { kaynakSandikIcerikId: 5, tasinanAdet: 2 }],
    };
    TestBed.inject(SandikService).urunleriTopluTasi(dto).subscribe();
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post.calls.mostRecent().args[0]).toContain('/api/sandik/urunleri-toplu-tasi');
    expect(api.post.calls.mostRecent().args[1]).toBe(dto);
  });
});
