import { fakeAsync, tick } from '@angular/core/testing';
import { dosyaAdiBasliktan, dosyayiKaydet } from './dosya-kaydet';

describe('dosyaAdiBasliktan', () => {
  it('önce UTF-8 filename*, sonra filename okunur; başlık yoksa ya da ad yol içeriyorsa varsayılan döner', () => {
    expect(dosyaAdiBasliktan(
      "attachment; filename=finans-isleri.pdf; filename*=UTF-8''finans-i%C5%9Fleri-20261022.pdf", 'x.pdf',
    )).toBe('finans-işleri-20261022.pdf');
    expect(dosyaAdiBasliktan('attachment; filename="finans-giderleri-1.xlsx"', 'x.xlsx')).toBe('finans-giderleri-1.xlsx');
    expect(dosyaAdiBasliktan(null, 'Varsayilan.pdf')).toBe('Varsayilan.pdf');
    expect(dosyaAdiBasliktan('attachment; filename="../etc/passwd"', 'Guvenli.pdf')).toBe('Guvenli.pdf');
  });
});

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
