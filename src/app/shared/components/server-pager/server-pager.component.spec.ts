import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ServerPagerComponent } from './server-pager.component';

describe('ServerPagerComponent', () => {
  let fixture: ComponentFixture<ServerPagerComponent>;
  let component: ServerPagerComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ServerPagerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ServerPagerComponent);
    component = fixture.componentInstance;
  });

  it('shows the server metadata range without accepting an item collection', () => {
    fixture.componentRef.setInput('pageNumber', 2);
    fixture.componentRef.setInput('pageSize', 25);
    fixture.componentRef.setInput('totalCount', 55);
    fixture.componentRef.setInput('totalPages', 3);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const summary = root.querySelector('.server-pager__summary')?.textContent ?? '';

    expect(summary.replace(/\s+/g, ' ').trim()).toContain('26-50 / 55 kayıt');
    expect('items' in component).toBeFalse();
  });

  it('limits page buttons to five and keeps the active page centered', () => {
    fixture.componentRef.setInput('pageNumber', 10);
    fixture.componentRef.setInput('totalPages', 20);
    fixture.detectChanges();

    expect(component.visiblePages()).toEqual([8, 9, 10, 11, 12]);

    const root = fixture.nativeElement as HTMLElement;
    const pageButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('.server-pager__page'));

    expect(pageButtons.length).toBe(5);
    expect(pageButtons[2].getAttribute('aria-current')).toBe('page');
  });

  it('emits only valid page requests from server navigation metadata', () => {
    const emittedPages: number[] = [];
    component.pageChange.subscribe((page) => emittedPages.push(page));

    fixture.componentRef.setInput('pageNumber', 2);
    fixture.componentRef.setInput('totalPages', 4);
    fixture.componentRef.setInput('hasPreviousPage', true);
    fixture.componentRef.setInput('hasNextPage', true);
    fixture.detectChanges();

    component.requestPreviousPage();
    component.requestNextPage();
    component.requestPage(4);
    component.requestPage(2);

    expect(emittedPages).toEqual([1, 3, 4]);
  });

  it('emits a selected page size without changing or slicing data', () => {
    const emittedPageSizes: number[] = [];
    component.pageSizeChange.subscribe((pageSize) => emittedPageSizes.push(pageSize));

    fixture.componentRef.setInput('pageSize', 25);
    fixture.componentRef.setInput('pageSizeOptions', [25, 50, 100]);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const select = root.querySelector<HTMLSelectElement>('select')!;
    select.value = '50';
    select.dispatchEvent(new Event('change'));

    expect(emittedPageSizes).toEqual([50]);
  });

  it('disables previous and next controls when the server says they are unavailable', () => {
    fixture.componentRef.setInput('pageNumber', 1);
    fixture.componentRef.setInput('totalPages', 1);
    fixture.componentRef.setInput('hasPreviousPage', false);
    fixture.componentRef.setInput('hasNextPage', false);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const previous = root.querySelector<HTMLButtonElement>('[aria-label="Önceki sayfa"]')!;
    const next = root.querySelector<HTMLButtonElement>('[aria-label="Sonraki sayfa"]')!;

    expect(previous.disabled).toBeTrue();
    expect(next.disabled).toBeTrue();
  });
});
