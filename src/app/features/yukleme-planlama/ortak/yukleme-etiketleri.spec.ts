import { sandikEtiketi } from './yukleme-etiketleri';

describe('sandikEtiketi (madde 8; sunucudaki YuklemePlaniKurali.SandikEtiketi ile aynı)', () => {
  it('tek projede yalnız sandık no, çok projede tam kod', () => {
    expect(sandikEtiketi('PA600-23-01', 'PA600-23', true)).toBe('01');
    expect(sandikEtiketi('PA600-23-01', 'PA600-23', false)).toBe('PA600-23-01');
    expect(sandikEtiketi('PA702-5010-2-2', 'PA702-5010', true)).toBe('2-2');
  });

  it('kodu proje no ile başlamayan ya da projesiz yük tam kodla yazılır', () => {
    expect(sandikEtiketi('TRAFO-1', 'PA600-23', true)).toBe('TRAFO-1');
    expect(sandikEtiketi('TRAFO-1', null, true)).toBe('TRAFO-1');
    expect(sandikEtiketi('PA600-23-', 'PA600-23', true)).toBe('PA600-23-');
  });
});
