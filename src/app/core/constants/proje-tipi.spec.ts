import { ActivatedRouteSnapshot, Route } from '@angular/router';
import { routes } from '../../app.routes';
import { ProjeTipi } from './enums';
import { PROJE_TIPI_BAGLAMLARI, projeTipiBaglami, rotaProjeTipi } from './proje-tipi';
import { YETKI } from './yetki-kodlari';

const rota = (data: Record<string, unknown>) => ({ data }) as unknown as ActivatedRouteSnapshot;
const ekranlar: Route[] = routes.flatMap(r => r.children ?? []);
const kokunde = (yol: string, kok: string) => yol === kok || yol.startsWith(`${kok}/`);
const kokleri = (tip: ProjeTipi) => {
  const b = PROJE_TIPI_BAGLAMLARI[tip];
  return [b.yonetimRotasi, b.gridRotasi, b.ucKRotasi];
};
const TIP_MENU_KODLARI: Record<ProjeTipi, string[]> = {
  [ProjeTipi.Normal]: Object.values(YETKI.SANDIK),
  [ProjeTipi.Saha]: Object.values(YETKI.SAHA),
  [ProjeTipi.Yedek]: Object.values(YETKI.YEDEK),
};

describe('Proje tipi bağlamı', () => {
  it('route verisindeki tipi okur; bildirilmemiş ya da tanımsız tip null olur', () => {
    expect(rotaProjeTipi(rota({ projeTipi: ProjeTipi.Saha }))).toBe(ProjeTipi.Saha);
    expect(rotaProjeTipi(rota({ menuKod: YETKI.PROJE.AKTIF_PROJELER }))).toBeNull();
    expect(rotaProjeTipi(rota({ projeTipi: 9 }))).toBeNull();
  });

  it('tanımsız tipi normal proje sayar', () => {
    expect(projeTipiBaglami(null).tip).toBe(ProjeTipi.Normal);
    expect(projeTipiBaglami(9).yetki.projeYonetimi).toBe(YETKI.SANDIK.YONETIMI);
    expect(projeTipiBaglami(ProjeTipi.Yedek).yetki.sevkEt).toBe(YETKI.YEDEK.SEVK_ET);
  });

  it('tipe bağlı her route kendi tipinin rota kökünde ve kendi tipinin menü koduyla tanımlıdır', () => {
    const tipli = ekranlar.filter(r => r.data?.['projeTipi'] !== undefined);

    expect(tipli.length).toBe(21);
    for (const r of tipli) {
      const tip = r.data!['projeTipi'] as ProjeTipi;
      const yol = `/${r.path}`;
      expect(kokleri(tip).some(kok => kokunde(yol, kok))).withContext(yol).toBeTrue();
      expect(TIP_MENU_KODLARI[tip]).withContext(yol).toContain(r.data!['menuKod']);
    }
  });

  it('yönetim, Grid ve 3K ekranlarının hiçbiri proje tipini bildirmeden tanımlanmaz', () => {
    const tumKokler = [ProjeTipi.Normal, ProjeTipi.Saha, ProjeTipi.Yedek].flatMap(kokleri);
    const tipsiz = ekranlar
      .map(r => ({ yol: `/${r.path}`, tip: r.data?.['projeTipi'] }))
      .filter(r => tumKokler.some(kok => kokunde(r.yol, kok)))
      .filter(r => r.tip === undefined && !kokunde(r.yol, '/saha-yonetimi/eksik-olustur'));

    expect(tipsiz).toEqual([]);
  });
});
