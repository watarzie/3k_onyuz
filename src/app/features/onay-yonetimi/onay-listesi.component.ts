import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { DatePipe, NgClass } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, Subject, Subscription } from 'rxjs';
import { BildirimService } from '../../core/services/bildirim.service';
import { OnayKuraliDto, OnayService } from '../../core/services/onay.service';
import { ToastService } from '../../core/services/toast.service';
import { PermissionService } from '../../core/services/permission.service';
import { RolService } from '../../core/services/rol.service';
import { OnayBekleyenIslemDto } from '../../shared/models/onay-bekleyen-islem.model';
import { RolDto } from '../../shared/models/rol.model';
import { BreadcrumbComponent } from '../../shared/components/breadcrumb/breadcrumb.component';

@Component({
  selector: 'app-onay-listesi',
  standalone: true,
  imports: [DatePipe, NgClass, BreadcrumbComponent],
  templateUrl: './onay-listesi.component.html',
  styleUrls: ['./onay-listesi.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OnayListesiComponent implements OnInit, OnDestroy {
  private onayService = inject(OnayService);
  private bildirimService = inject(BildirimService);
  private toast = inject(ToastService);
  private permissions = inject(PermissionService);
  private rolService = inject(RolService);
  private destroyRef = inject(DestroyRef);
  private readonly refreshRequests = new Subject<void>();
  private loadRequest?: Subscription;

  public canWrite = computed(() => this.permissions.canWrite('islem-onay-merkezi'));
  public canManageRules = computed(() => this.permissions.canWrite('onay-kurallari-yonet'));

  bekleyenler = signal<OnayBekleyenIslemDto[]>([]);
  kurallar = signal<OnayKuraliDto[]>([]);
  roller = signal<RolDto[]>([]);
  updatingKuralKodlari = signal<Set<string>>(new Set());
  loading = signal<boolean>(true);
  showKurallarModal = signal<boolean>(false);
  onayModalIslem = signal<OnayBekleyenIslemDto | null>(null);
  onaySubmitting = signal<boolean>(false);
  retModalIslem = signal<OnayBekleyenIslemDto | null>(null);
  redAciklamasi = signal<string>('');
  retSubmitting = signal<boolean>(false);

  breadcrumb = [
    { label: 'Ana Kontrol Paneli', link: '/dashboard' },
    { label: 'İşlem Onay Merkezi' }
  ];

  ngOnInit(): void {
    this.refreshRequests
      .pipe(debounceTime(120), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.fetchData());

    this.bildirimService.onayGuncellendi$
      .pipe(debounceTime(120), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadData());

    this.loadData();
    if (this.canManageRules()) {
      this.loadKurallar();
      this.loadRoller();
    }
  }

  ngOnDestroy(): void {
    this.loadRequest?.unsubscribe();
  }

  loadKurallar() {
    this.onayService.getKurallar().subscribe((res) => {
      if (res.isSuccess && res.value) {
        this.kurallar.set(res.value);
      }
    });
  }

  loadRoller() {
    this.rolService.getRoller().subscribe({
      next: (roller) => this.roller.set(roller),
      error: () => this.toast.error('Rol listesi yüklenemedi.')
    });
  }

  toggleKural(kural: OnayKuraliDto) {
    if (!kural.onayGerektirirMiDegistirilebilir || this.kuralUpdating(kural)) return;

    const previous = this.cloneKural(kural);
    const updated = { ...kural, onayGerektirirMi: !kural.onayGerektirirMi };

    this.updateLocalKural(updated);
    this.saveKural(updated, previous, 'Kural başarıyla güncellendi.');
  }

  toggleKuralRol(kural: OnayKuraliDto, rolId: number) {
    if (this.kuralUpdating(kural)) return;

    const previous = this.cloneKural(kural);
    const mevcutRoller = kural.yetkiliRolIdleri ?? [];
    const yetkiliRolIdleri = mevcutRoller.includes(rolId)
      ? mevcutRoller.filter(id => id !== rolId)
      : [...mevcutRoller, rolId].sort((a, b) => a - b);

    const updated = { ...kural, yetkiliRolIdleri };

    this.updateLocalKural(updated);
    this.saveKural(updated, previous, 'Onaycı roller güncellendi.');
  }

  kuralUpdating(kural: OnayKuraliDto): boolean {
    return this.updatingKuralKodlari().has(this.kuralKey(kural));
  }

  rolSeciliMi(kural: OnayKuraliDto, rolId: number): boolean {
    return (kural.yetkiliRolIdleri ?? []).includes(rolId);
  }

  private saveKural(kural: OnayKuraliDto, previous: OnayKuraliDto, successMessage: string) {
    this.setKuralUpdating(kural, true);

    this.onayService.updateKural({
      lookupUcKDurumId: kural.lookupUcKDurumId,
      islemKodu: kural.islemKodu,
      onayGerektirirMi: kural.onayGerektirirMi,
      yetkiliRolIdleri: kural.yetkiliRolIdleri ?? []
    }).subscribe({
      next: (res) => {
        this.setKuralUpdating(kural, false);
        if (res.isSuccess) {
          this.toast.success(successMessage);
        } else {
          this.updateLocalKural(previous);
          this.toast.error(res.error || 'Güncelleme başarısız!');
        }
      },
      error: () => {
        this.setKuralUpdating(kural, false);
        this.updateLocalKural(previous);
        this.toast.error('Güncelleme başarısız!');
      }
    });
  }

  private updateLocalKural(updated: OnayKuraliDto) {
    this.kurallar.set(this.kurallar().map(kural =>
      this.kuralKey(kural) === this.kuralKey(updated) ? updated : kural
    ));
  }

  private cloneKural(kural: OnayKuraliDto): OnayKuraliDto {
    return {
      ...kural,
      yetkiliRolIdleri: [...(kural.yetkiliRolIdleri ?? [])]
    };
  }

  private kuralKey(kural: OnayKuraliDto): string {
    return kural.islemKodu || `UCK_${kural.lookupUcKDurumId}`;
  }

  private setKuralUpdating(kural: OnayKuraliDto, updating: boolean) {
    const next = new Set(this.updatingKuralKodlari());
    const key = this.kuralKey(kural);

    if (updating) {
      next.add(key);
    } else {
      next.delete(key);
    }

    this.updatingKuralKodlari.set(next);
  }

  openSettingsModal() {
    if (!this.canManageRules()) return;

    this.loadKurallar();
    this.loadRoller();
    this.showKurallarModal.set(true);
  }

  closeSettingsModal() {
    this.showKurallarModal.set(false);
  }

  loadData() {
    this.refreshRequests.next();
  }

  private fetchData() {
    this.loadRequest?.unsubscribe();
    this.loading.set(true);
    this.loadRequest = this.onayService.getBekleyenler().subscribe((res) => {
      this.loading.set(false);
      if (res.isSuccess && res.value) {
        this.bekleyenler.set(res.value);
      } else {
        this.bekleyenler.set([]);
        this.toast.error(res.error || 'Veriler yüklenemedi.');
      }
    });
  }

  openOnayModal(islem: OnayBekleyenIslemDto) {
    this.onayModalIslem.set(islem);
  }

  closeOnayModal() {
    if (this.onaySubmitting()) return;
    this.onayModalIslem.set(null);
  }

  submitOnayModal() {
    const islem = this.onayModalIslem();

    if (!islem || this.onaySubmitting()) return;

    this.onaySubmitting.set(true);
    this.onayService.onayla({ onayBekleyenIslemId: islem.id }).subscribe({
      next: (res) => {
        this.onaySubmitting.set(false);
        this.onayModalIslem.set(null);
        this.loadData();
        if (res.isSuccess) {
          this.toast.success('İşlem başarıyla onaylandı ve çalıştırıldı.');
        } else {
          this.toast.error(res.error || 'Onay işlemi başarısız.');
        }
      },
      error: () => {
        this.onaySubmitting.set(false);
        this.onayModalIslem.set(null);
        this.loadData();
        this.toast.error('Onay işlemi başarısız.');
      }
    });
  }

  openRetModal(islem: OnayBekleyenIslemDto) {
    this.retModalIslem.set(islem);
    this.redAciklamasi.set('');
  }

  closeRetModal() {
    if (this.retSubmitting()) return;
    this.retModalIslem.set(null);
    this.redAciklamasi.set('');
  }

  updateRedAciklamasi(event: Event) {
    this.redAciklamasi.set((event.target as HTMLTextAreaElement).value);
  }

  submitRetModal() {
    const islem = this.retModalIslem();
    const reason = this.redAciklamasi().trim();

    if (!islem || this.retSubmitting()) return;

    if (!reason) {
      this.toast.warning('Reddetme sebebi zorunludur.');
      return;
    }

    this.retSubmitting.set(true);
    this.onayService.reddet({ onayBekleyenIslemId: islem.id, redAciklamasi: reason }).subscribe({
      next: (res) => {
        this.retSubmitting.set(false);
        this.retModalIslem.set(null);
        this.redAciklamasi.set('');
        this.loadData();
        if (res.isSuccess) {
          this.toast.success('İşlem isteği reddedildi.');
        } else {
          this.toast.error(res.error || 'Kayıt başarısız.');
        }
      },
      error: () => {
        this.retSubmitting.set(false);
        this.retModalIslem.set(null);
        this.redAciklamasi.set('');
        this.loadData();
        this.toast.error('Kayıt başarısız.');
      }
    });
  }
}
