import { fakeAsync, tick } from '@angular/core/testing';
import { dosyayiKaydet } from './dosya-kaydet';

describe('dosyayiKaydet', () => {
  it('blobu verilen adla indirir, bağlantıyı kaldırır ve adresi bir sonraki turda serbest bırakır', fakeAsync(() => {
    const olustur = spyOn(URL, 'createObjectURL').and.returnValue('blob:test');
    const serbest = spyOn(URL, 'revokeObjectURL');
    let tiklanan: HTMLAnchorElement | undefined;
    spyOn(HTMLAnchorElement.prototype, 'click').and.callFake(function (this: HTMLAnchorElement) {
      tiklanan = this;
      expect(document.body.contains(this)).toBeTrue();
    });
    const icerik = new Blob(['%PDF-']);

    dosyayiKaydet(icerik, 'Rapor.pdf');

    expect(olustur).toHaveBeenCalledWith(icerik);
    expect(tiklanan?.download).toBe('Rapor.pdf');
    expect(tiklanan?.href).toBe('blob:test');
    expect(document.body.contains(tiklanan!)).toBeFalse();
    expect(serbest).not.toHaveBeenCalled();
    tick();
    expect(serbest).toHaveBeenCalledWith('blob:test');
  }));
});
