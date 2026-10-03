import { pdfMakeYukle } from './pdfmake-yukleyici';

describe('pdfMakeYukle', () => {
  it('pdfmake ve gömülü fontları isteğe bağlı yükler, Türkçe metinli PDF üretir', async () => {
    const pdfMake = await pdfMakeYukle();

    const blob = await pdfMake.createPdf({ content: ['Talep formu: ığüşöç İĞÜŞÖÇ'] }).getBlob();

    expect(blob.size).toBeGreaterThan(0);
    expect(await blob.slice(0, 5).text()).toBe('%PDF-');
    expect(await pdfMakeYukle()).toBe(pdfMake);
  });
});
