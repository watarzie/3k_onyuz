import { onayaAlindi } from './common.model';

describe('onayaAlindi (202 onay kuyruğu)', () => {
  it('sonuç veya yanıt gövdesi 202 taşıyorsa işlem uygulanmamış sayılır', () => {
    expect(onayaAlindi({ statusCode: 202 })).toBeTrue();
    expect(onayaAlindi({ value: { statusCode: 202, message: 'Onaya alındı' } })).toBeTrue();
  });

  it('uygulanmış veya başarısız sonuçlar onay kuyruğu değildir', () => {
    expect(onayaAlindi({ statusCode: 200, value: { id: 1 } })).toBeFalse();
    expect(onayaAlindi({ statusCode: 409 })).toBeFalse();
    expect(onayaAlindi({ value: 'metin' })).toBeFalse();
    expect(onayaAlindi(null)).toBeFalse();
    expect(onayaAlindi(undefined)).toBeFalse();
  });
});
