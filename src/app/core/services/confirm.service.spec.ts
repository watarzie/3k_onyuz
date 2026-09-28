import { ConfirmService, duzMetin } from './confirm.service';

describe('ConfirmService', () => {
  it('onay ve vazgeçme kararını bekleyen çağrıya iletir', async () => {
    const servis = new ConfirmService();

    const onaylanan = servis.ask({ message: 'Silinsin mi?' });
    servis.confirm();
    const vazgecilen = servis.ask({ message: 'Silinsin mi?' });
    servis.cancel();

    expect(await onaylanan).toBeTrue();
    expect(await vazgecilen).toBeFalse();
    expect(servis.visible()).toBeFalse();
  });
});

describe('duzMetin', () => {
  it('HTML özel karakterlerini kaçışlar, düz metni değiştirmez', () => {
    expect(duzMetin(`Kapak <A> & "İç" 'Sandık'`)).toBe('Kapak &lt;A&gt; &amp; &quot;İç&quot; &#39;Sandık&#39;');
    expect(duzMetin('S-12 · Ölçü 1200×800')).toBe('S-12 · Ölçü 1200×800');
  });

  it('boş değeri boş metin, sayıyı metin olarak verir', () => {
    expect(duzMetin(null)).toBe('');
    expect(duzMetin(undefined)).toBe('');
    expect(duzMetin(42)).toBe('42');
  });
});
