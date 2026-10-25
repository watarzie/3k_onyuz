// Satır giriş animasyonu transform'u kalıcı tutarsa (fill-mode: both) Chrome satırı sabit konumlu menü panelinin
// kapsayıcısı yapar; panel tetikleyiciden kopup tablo kaydırma alanında kesilir. Bu test o geri dönüşü yakalar.
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ProjeTipi } from '../../../core/constants/enums';
import { YETKI } from '../../../core/constants/yetki-kodlari';
import { ConfirmService } from '../../../core/services/confirm.service';
import { PdfService } from '../../../core/services/pdf.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ProjeService } from '../../../core/services/proje.service';
import { SandikService } from '../../../core/services/sandik.service';
import { ToastService } from '../../../core/services/toast.service';
import { ProjeDto } from '../../../shared/models';
import { ProjeListesiComponent } from './proje-listesi.component';

describe('Proje listesi: İşlemler menüsü', () => {
  it('giriş animasyonundan sonra panel satıra hapsolmadan tetikleyicinin yanında açılır', async () => {
    const items = [1, 2, 3].map(id => ({
      id, projeNo: `PA${id}`, musteri: 'GE', durumId: 1, durumMetni: 'DevamEdiyor', projeTipiId: ProjeTipi.Normal, projeTipiMetni: '',
      fizikselSevkEdilmisSandikVarMi: false, sorumluKisi: '', sandikSayisi: 2, hazirSandikSayisi: 1, depoSandikSayisi: 0,
      depoUcKSandikSayisi: 0, depoSeymenSandikSayisi: 0, depoGridSandikSayisi: 0, toplamUrunSayisi: 10, tamamlananUrunSayisi: 5,
    }) as ProjeDto);
    TestBed.configureTestingModule({
      imports: [ProjeListesiComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { data: { menuKod: YETKI.SANDIK.YONETIMI, projeTipi: ProjeTipi.Normal } } } },
        { provide: ProjeService, useValue: { getProjeListesi: () => of({ isSuccess: true, value: {
          items, pageNumber: 1, pageSize: 15, totalCount: 3, totalPages: 1, hasPreviousPage: false, hasNextPage: false } }) } },
        { provide: SandikService, useValue: {} },
        { provide: PdfService, useValue: {} },
        { provide: ConfirmService, useValue: { ask: () => Promise.resolve(true) } },
        { provide: PermissionService, useValue: { loaded: () => true, hasAccess: () => true, canWrite: () => true } },
        { provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['success', 'error', 'warning', 'info']) },
      ],
    });
    const fixture = TestBed.createComponent(ProjeListesiComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    await new Promise(r => setTimeout(r, 1200)); // giriş animasyonları biter
    // Satırdaki İşlemler menüsü (başlıktaki "Diğer" menüsü satır animasyonundan etkilenmez).
    const tetik = fixture.nativeElement.querySelector('tbody tr .islemler-tetik') as HTMLButtonElement;
    tetik.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const panel = fixture.nativeElement.querySelector('.islemler-panel.acik') as HTMLElement;
    expect(panel).withContext('panel açık sınıfı').not.toBeNull();
    const kutu = panel.getBoundingClientRect();
    const tk = tetik.getBoundingClientRect();
    const yapisik = Math.abs(kutu.top - tk.bottom) < 16 || Math.abs(kutu.bottom - tk.top) < 16;
    expect(kutu.height).toBeGreaterThan(20);
    expect(panel.offsetParent).withContext('sabit panel bir ata öğeye hapsolmuş').toBeNull();
    expect(yapisik).withContext('panel tetikleyiciden kopuk').toBeTrue();
    fixture.nativeElement.remove();
  });
});
