import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'app-server-pager',
  standalone: true,
  templateUrl: './server-pager.component.html',
  styleUrl: './server-pager.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServerPagerComponent {
  readonly pageNumber = input(1);
  readonly pageSize = input(25);
  readonly totalCount = input(0);
  readonly totalPages = input(0);
  readonly hasPreviousPage = input(false);
  readonly hasNextPage = input(false);
  readonly pageSizeOptions = input<readonly number[]>([15, 25, 50]);

  readonly pageChange = output<number>();
  readonly pageSizeChange = output<number>();

  private readonly visiblePageLimit = 5;

  readonly safeTotalCount = computed(() => Math.max(0, Math.trunc(this.totalCount())));
  readonly safeTotalPages = computed(() => Math.max(0, Math.trunc(this.totalPages())));
  readonly safePageSize = computed(() => Math.max(1, Math.trunc(this.pageSize())));
  readonly activePage = computed(() => {
    const totalPages = this.safeTotalPages();
    return totalPages === 0
      ? 1
      : Math.min(Math.max(1, Math.trunc(this.pageNumber())), totalPages);
  });

  readonly startItem = computed(() => {
    if (this.safeTotalCount() === 0) {
      return 0;
    }

    return (this.activePage() - 1) * this.safePageSize() + 1;
  });

  readonly endItem = computed(() =>
    Math.min(this.activePage() * this.safePageSize(), this.safeTotalCount()),
  );

  readonly availablePageSizes = computed(() => {
    const sizes = this.pageSizeOptions()
      .map((size) => Math.trunc(size))
      .filter((size) => size > 0);

    sizes.push(this.safePageSize());
    return [...new Set(sizes)].sort((left, right) => left - right);
  });

  readonly visiblePages = computed(() => {
    const totalPages = this.safeTotalPages();
    const visibleCount = Math.min(this.visiblePageLimit, totalPages);

    if (visibleCount === 0) {
      return [];
    }

    const start = Math.max(
      1,
      Math.min(this.activePage() - Math.floor(visibleCount / 2), totalPages - visibleCount + 1),
    );

    return Array.from({ length: visibleCount }, (_, index) => start + index);
  });

  readonly canGoPrevious = computed(
    () => this.hasPreviousPage() && this.activePage() > 1,
  );

  readonly canGoNext = computed(
    () => this.hasNextPage() && this.activePage() < this.safeTotalPages(),
  );

  requestPreviousPage(): void {
    if (this.canGoPrevious()) {
      this.requestPage(this.activePage() - 1);
    }
  }

  requestNextPage(): void {
    if (this.canGoNext()) {
      this.requestPage(this.activePage() + 1);
    }
  }

  requestPage(page: number): void {
    const totalPages = this.safeTotalPages();
    if (totalPages === 0) {
      return;
    }

    const targetPage = Math.min(Math.max(1, Math.trunc(page)), totalPages);
    if (targetPage !== this.activePage()) {
      this.pageChange.emit(targetPage);
    }
  }

  onPageSizeSelect(event: Event): void {
    const selectedPageSize = Number((event.target as HTMLSelectElement).value);
    if (Number.isInteger(selectedPageSize) && selectedPageSize > 0) {
      this.requestPageSize(selectedPageSize);
    }
  }

  requestPageSize(pageSize: number): void {
    const targetPageSize = Math.trunc(pageSize);
    if (targetPageSize > 0 && targetPageSize !== this.safePageSize()) {
      this.pageSizeChange.emit(targetPageSize);
    }
  }
}
