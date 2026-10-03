import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { NotAuthorizedComponent } from './not-authorized.component';
import { AuthService } from '../../../core/auth/auth.service';
import { ToastService } from '../../../core/services/toast.service';

describe('NotAuthorizedComponent — 403', () => {
  function kur(sayfa: string | null) {
    const toast = jasmine.createSpyObj('ToastService', ['success', 'error']);
    TestBed.configureTestingModule({
      imports: [NotAuthorizedComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { queryParamMap: of(convertToParamMap(sayfa ? { sayfa } : {})) } },
        { provide: AuthService, useValue: { currentUser: signal({ adSoyad: 'Ömer Yılmaz', email: 'o@x', rol: 'Depo' }) } },
        { provide: ToastService, useValue: toast },
      ],
    });
    const fixture = TestBed.createComponent(NotAuthorizedComponent);
    fixture.detectChanges();
    return { fixture, c: fixture.componentInstance, el: fixture.nativeElement as HTMLElement, toast };
  }

  it('istenen sayfayı ve rolü gösterir', () => {
    const { el } = kur('/finans-yonetimi?sekme=panel');
    expect(el.querySelector('h1')!.textContent).toContain('erişim izniniz yok');
    expect(el.querySelector('.yetkisiz-bilgi code')!.textContent).toBe('/finans-yonetimi');
    expect(el.querySelector('.yetkisiz-bilgi')!.textContent).toContain('Depo');
  });

  it('uygulama dışı adresi göstermez', () => {
    expect(kur('//kotu.example/x').c.sayfa()).toBeNull();
    TestBed.resetTestingModule();
    expect(kur('https://kotu.example').c.sayfa()).toBeNull();
  });

  it('yöneticiye iletilecek yetki talebi metnini kopyalar', async () => {
    const { c, toast } = kur('/rol-yonetimi');
    const yaz = spyOn(navigator.clipboard, 'writeText').and.resolveTo();
    await c.talepMetniniKopyala();
    const metin = yaz.calls.mostRecent().args[0] as string;
    expect(metin).toContain('"/rol-yonetimi" sayfasına erişim yetkisi talep ediyorum.');
    expect(metin).toContain('Kullanıcı: Ömer Yılmaz (o@x)');
    expect(metin).toContain('Mevcut rol: Depo');
    expect(toast.success).toHaveBeenCalled();
  });
});
