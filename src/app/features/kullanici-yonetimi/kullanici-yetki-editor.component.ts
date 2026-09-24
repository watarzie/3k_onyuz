import { Component, DestroyRef, Input, OnChanges, Output, EventEmitter, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { KullaniciService } from '../../core/services/kullanici.service';
import { PermissionService } from '../../core/services/permission.service';
import { ToastService } from '../../core/services/toast.service';
import { TranslationService } from '../../core/services/translation.service';
import { KullaniciDto, KullaniciYetkiModel } from '../../shared/models';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { YETKI_ATAMA } from '../../core/constants/yetki-kodlari';

@Component({
  selector: 'app-kullanici-yetki-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  template: `
    <div class="permission-overlay" role="dialog" aria-modal="true" aria-labelledby="permission-title">
      <section class="permission-dialog">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h5 id="permission-title">{{ 'PERMISSIONS.USER_TITLE' | translate }} — {{ user.adSoyad }}</h5>
          <button class="btn btn-outline-secondary" [disabled]="saving()" (click)="closed.emit()">{{ 'COMMON.CLOSE' | translate }}</button>
        </div>
        <p class="text-muted">{{ 'PERMISSIONS.PRIORITY_HELP' | translate }}</p>
        <input class="form-control mb-3" [ngModel]="search()" (ngModelChange)="search.set($event)" [placeholder]="'PERMISSIONS.SEARCH' | translate">
        <div *ngIf="loading()" class="text-center p-3"><span class="spinner-border"></span></div>
        <div *ngIf="error()" class="alert alert-danger">{{ error() }}</div>
        <div class="permission-table">
          <table class="table table-sm align-middle" *ngIf="!loading() && !error()">
            <thead><tr><th>{{ 'PERMISSIONS.PERMISSION' | translate }}</th><th>{{ 'PERMISSIONS.ROLE_ACCESS' | translate }}</th><th>{{ 'PERMISSIONS.PERSONAL_DECISION' | translate }}</th></tr></thead>
            <tbody><tr *ngFor="let row of filtered()">
              <td>{{ row.ad | translate }} <span *ngIf="row.kritik" class="badge text-bg-danger">{{ 'PERMISSIONS.CRITICAL' | translate }}</span><small class="d-block text-muted">{{ row.kod }}</small></td>
              <td>{{ row.rolYetkiTipiId === 3 ? 'W' : row.rolYetkiTipiId === 2 ? 'R' : 'N' }}</td>
              <td><select class="form-select form-select-sm" [ngModel]="decisionValue(row)" [disabled]="saving() || !canManage()" (ngModelChange)="setDecision(row.menuTanimiId, $event)">
                <option value="inherit">{{ 'PERMISSIONS.INHERIT' | translate }}</option>
                <option value="allow">{{ 'PERMISSIONS.ALLOW' | translate }}</option>
                <option value="deny">{{ 'PERMISSIONS.DENY' | translate }}</option>
              </select></td>
            </tr></tbody>
          </table>
        </div>
        <div class="d-flex justify-content-end mt-3">
          <button *ngIf="canManage()" class="btn btn-primary" [disabled]="loading() || saving() || !!error()" (click)="save()">{{ 'COMMON.SAVE' | translate }}</button>
        </div>
      </section>
    </div>
  `,
  styles: [`
    .permission-overlay { position: fixed; inset: 0; background: #0008; z-index: 1060; display: flex; align-items: center; justify-content: center; padding: 1rem; }
    .permission-dialog { background: var(--bs-body-bg, white); border-radius: .75rem; padding: 1.5rem; width: min(1050px, 100%); max-height: 92vh; display: flex; flex-direction: column; }
    .permission-table { overflow: auto; min-height: 0; } th { position: sticky; top: 0; background: var(--bs-body-bg, white); z-index: 1; } td:last-child { min-width: 180px; }
  `],
})
export class KullaniciYetkiEditorComponent implements OnChanges {
  @Input({ required: true }) user!: KullaniciDto;
  @Output() closed = new EventEmitter<void>();
  private service = inject(KullaniciService);
  private permissions = inject(PermissionService);
  private toast = inject(ToastService);
  private translate = inject(TranslationService);
  private destroyRef = inject(DestroyRef);
  private version = 0;
  rows = signal<KullaniciYetkiModel[]>([]);
  search = signal('');
  loading = signal(false);
  saving = signal(false);
  error = signal('');
  canManage = computed(() => this.permissions.canWrite(YETKI_ATAMA));
  filtered = computed(() => {
    const term = this.search().trim().toLocaleLowerCase('tr');
    return this.rows().filter(row => !term || (row.ad + ' ' + row.kod).toLocaleLowerCase('tr').includes(term));
  });

  ngOnChanges(): void {
    const version = ++this.version;
    this.rows.set([]);
    this.error.set('');
    this.loading.set(true);
    this.service.getYetkiler(this.user.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(result => {
      if (version !== this.version) return;
      this.loading.set(false);
      if (!result.isSuccess || !result.value) {
        this.error.set(result.error || this.translate.translate('PERMISSIONS.LOAD_FAILED'));
        return;
      }
      this.rows.set(result.value);
    });
  }

  decisionValue(row: KullaniciYetkiModel): string {
    return row.izinVerildi == null ? 'inherit' : row.izinVerildi ? 'allow' : 'deny';
  }

  setDecision(id: number, value: string): void {
    this.rows.update(rows => rows.map(row => row.menuTanimiId === id
      ? { ...row, izinVerildi: value === 'inherit' ? null : value === 'allow' } : row));
  }

  save(): void {
    if (!this.canManage() || this.saving()) return;
    this.saving.set(true);
    this.service.updateYetkiler(this.user.id, this.rows().map(({ menuTanimiId, izinVerildi }) => ({ menuTanimiId, izinVerildi })))
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe(result => {
        this.saving.set(false);
        if (!result.isSuccess || result.statusCode === 202) {
          this.toast.error(result.error || this.translate.translate('PERMISSIONS.SAVE_FAILED'));
          return;
        }
        this.permissions.notifyPermissionsChanged();
        this.toast.success(this.translate.translate('PERMISSIONS.SAVED'));
        this.closed.emit();
      });
  }
}
