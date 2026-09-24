import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CanAccessDirective } from './can-access.directive';
import { PermissionService } from '../../core/services/permission.service';

@Component({ standalone: true, imports: [CanAccessDirective],
  template: '<span class="sensitive" *appCanAccess="codes()">42.123 m³</span>' })
class PermissionHost {
  codes = signal<readonly string[]>(['ambalaj-m3-goruntule']);
}

describe('CanAccessDirective gerçek host görünümü', () => {
  let fixture: ComponentFixture<PermissionHost>;
  const grants = signal(new Set<string>());
  const rendered = () => fixture.nativeElement.querySelectorAll('.sensitive').length;
  beforeEach(() => {
    grants.set(new Set());
    TestBed.configureTestingModule({ imports: [PermissionHost], providers: [
      { provide: PermissionService, useValue: { hasAccess: (code: string) => grants().has(code) } },
    ] });
    fixture = TestBed.createComponent(PermissionHost); fixture.detectChanges();
  });
  it('izin sinyali sonradan geldiğinde alanı render eder ve tekrar grant görünümü çoğaltmaz', () => {
    expect(rendered()).toBe(0);
    grants.set(new Set(['ambalaj-m3-goruntule'])); fixture.detectChanges(); expect(rendered()).toBe(1);
    grants.set(new Set(['ambalaj-m3-goruntule'])); fixture.detectChanges(); expect(rendered()).toBe(1);
  });
  it('izin iptalinde mevcut hassas metni DOM üzerinden de kaldırır', () => {
    grants.set(new Set(['ambalaj-m3-goruntule'])); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('42.123');
    grants.set(new Set()); fixture.detectChanges();
    expect(rendered()).toBe(0); expect(fixture.nativeElement.textContent).not.toContain('42.123');
  });
  it('çoklu izinlerden yalnız biri yetmez; tümü AND ile aranır', () => {
    fixture.componentInstance.codes.set(['ambalaj-m3-goruntule', 'ambalaj-sarf-goruntule']);
    grants.set(new Set(['ambalaj-m3-goruntule'])); fixture.detectChanges(); expect(rendered()).toBe(0);
    grants.set(new Set(['ambalaj-m3-goruntule', 'ambalaj-sarf-goruntule'])); fixture.detectChanges(); expect(rendered()).toBe(1);
    grants.set(new Set(['ambalaj-sarf-goruntule'])); fixture.detectChanges(); expect(rendered()).toBe(0);
  });
  it('boş gereksinim ve boş kod fail-closed; input değişimi önceki alanı kaldırır', () => {
    grants.set(new Set(['ambalaj-m3-goruntule', ''])); fixture.detectChanges(); expect(rendered()).toBe(1);
    fixture.componentInstance.codes.set([]); fixture.detectChanges(); expect(rendered()).toBe(0);
    fixture.componentInstance.codes.set(['']); fixture.detectChanges(); expect(rendered()).toBe(0);
  });
});
