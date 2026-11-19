import { PlanYukKaynagi } from '../../../shared/models/index';
import { satirAnahtari } from './plan-yuk-listesi';

describe('plan yük listesi satır anahtarı', () => {
  it('sandıkta sandık kimliği, elle eklenen yükte grup ve birim (sunucudaki yük anahtarıyla aynı)', () => {
    expect(satirAnahtari({ kaynak: PlanYukKaynagi.Sandik, sandikId: 42, manuelGrupNo: null, birimNo: 1 })).toBe('s:42');
    expect(satirAnahtari({ kaynak: PlanYukKaynagi.Manuel, sandikId: null, manuelGrupNo: 3, birimNo: 2 })).toBe('m:3:2');
  });
});
