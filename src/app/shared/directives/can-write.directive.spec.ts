import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { PermissionService } from '../../core/services/permission.service';
import { CanWriteDirective } from './can-write.directive';

@Component({
  standalone: true,
  imports: [CanWriteDirective],
  template: '<button id="explicit" *appCanWrite="code()">İşlem</button><button id="route" *appCanWrite>Rota işlemi</button>',
})
class HostComponent {
  code = signal('finans-po-gir');
}

describe('CanWriteDirective', () => {
  const loaded = signal(false);
  const granted = signal(new Set<string>());
  let routeData: BehaviorSubject<Record<string, string>>;

  beforeEach(() => {
    loaded.set(false);
    granted.set(new Set());
    routeData = new BehaviorSubject<Record<string, string>>({});
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        { provide: PermissionService, useValue: { loaded, canWrite: (code: string) => granted().has(code) } },
        { provide: ActivatedRoute, useValue: { data: routeData, snapshot: { data: {} } } },
      ],
    });
  });

  it('yüklenmemiş izinleri ve boş rota bağlamını kapalı tutar', () => {
    granted.set(new Set(['finans-po-gir']));
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
    loaded.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#explicit')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('#route')).toBeNull();
  });

  it('izin iptalinde view kaldırılır ve geri verilince tek view oluşturulur', () => {
    loaded.set(true);
    granted.set(new Set(['finans-po-gir']));
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('#explicit').length).toBe(1);
    granted.set(new Set());
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#explicit')).toBeNull();
    granted.set(new Set(['finans-po-gir']));
    fixture.detectChanges();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('#explicit').length).toBe(1);
  });

  it('explicit kod değişir ve rota izni fallback olarak reaktif değerlendirilir', () => {
    loaded.set(true);
    granted.set(new Set(['finans-po-gir', 'grid-modulu']));
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    fixture.componentInstance.code.set('finans-kalici-sil');
    routeData.next({ menuKod: 'grid-modulu' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#explicit')).toBeNull();
    expect(fixture.nativeElement.querySelector('#route')).not.toBeNull();
    fixture.destroy();
    expect(routeData.observed).toBeFalse();
  });
});
