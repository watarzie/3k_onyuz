/** pdfmake 0.3 tarayıcı derlemesi için kullanılan en küçük tip tanımı. */
declare module 'pdfmake/build/pdfmake' {
  const pdfMake: {
    createPdf(tanim: unknown): { download(dosyaAdi?: string): Promise<void>; getBlob(): Promise<Blob> };
    addVirtualFileSystem(vfs: Record<string, string>): void;
  };
  export default pdfMake;
}

declare module 'pdfmake/build/vfs_fonts' {
  const vfs: Record<string, string>;
  export default vfs;
}
