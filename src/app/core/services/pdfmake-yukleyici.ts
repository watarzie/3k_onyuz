import type pdfMakeTuru from 'pdfmake/build/pdfmake';

export type PdfMake = typeof pdfMakeTuru;

let yukleme: Promise<PdfMake> | null = null;

/**
 * pdfmake ve gömülü fontları (~1,9 MB) yalnız istemcide PDF üreten bir işlem çalıştığında yükler;
 * uygulamanın ilk açılış paketine girmez. Yükleme bir kez yapılır, sonraki çağrılar onu paylaşır.
 */
export function pdfMakeYukle(): Promise<PdfMake> {
  yukleme ??= Promise.all([import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts')])
    .then(([{ default: pdfMake }, { default: vfs }]) => {
      pdfMake.addVirtualFileSystem(vfs);
      return pdfMake;
    })
    .catch((hata: unknown) => {
      yukleme = null;
      throw hata;
    });
  return yukleme;
}
