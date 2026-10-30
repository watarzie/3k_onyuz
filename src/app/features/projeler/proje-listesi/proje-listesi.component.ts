import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { Component, inject, signal, computed, OnInit, ChangeDetectionStrategy, HostListener, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { NgClass, DatePipe } from '@angular/common';
import { TranslationService } from '../../../core/services/translation.service';
import { ProjeService } from '../../../core/services/proje.service';
import { SandikService } from '../../../core/services/sandik.service';
import { PermissionService } from '../../../core/services/permission.service';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { BreadcrumbComponent } from '../../../shared/components/breadcrumb/breadcrumb.component';
import { IslemlerMenusuComponent } from '../../../shared/components/islemler-menusu/islemler-menusu.component';
import { CekiRevizyonOnizlemeComponent } from '../../../shared/components/ceki-revizyon-onizleme/ceki-revizyon-onizleme.component';
import { CekiRevizyonGecmisiComponent } from '../../../shared/components/ceki-revizyon-gecmisi/ceki-revizyon-gecmisi.component';
import { TopluSevkComponent, TopluSevkTamamlandi } from '../toplu-sevk/toplu-sevk.component';
import { OtomatikSahaAktarimComponent } from '../otomatik-saha-aktarim/otomatik-saha-aktarim.component';
import { SahaTasimaKaynagi, SahadanSahayaTasimaComponent } from '../../saha-yonetimi/sahadan-sahaya-tasima/sahadan-sahaya-tasima.component';
import {
  ApiResult,
  ARAC_PLAKA_EN_FAZLA,
  CekiRevizyonOnizlemeSonuc,
  CekiRevizyonOnayKuyruguYaniti,
  CekiRevizyonSorunu,
  CekiRevizyonYuklemeYaniti,
  OtomatikSahaAktarimSonucDto,
  ProjeDto,
  SahadanSahayaTasimaSonucDto,
  ProjeBaglantiTuru,
  ProjeFotografBaglantisi,
  SahaAktarimDto,
  SandikDto,
  SevkiyatDto,
  SEFER_ACIKLAMA_EN_FAZLA,
  SOFOR_EN_FAZLA,
  TOPLU_SEVK_EN_FAZLA_PROJE,
  aracPlakaBicimle,
  onayaAlindi,
  sandikSevkAdayiMi,
  sandikSevkEdildiMi,
} from '../../../shared/models/index';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmService, duzMetin } from '../../../core/services/confirm.service';
import { PdfService } from '../../../core/services/pdf.service';
import { ProjeDurum, ProjeTipi, SevkiyatKilitAcmaTipi } from '../../../core/constants/enums';
import { PROJE_TIPI_BAGLAMLARI, projeTipiBaglami, rotaProjeTipi } from '../../../core/constants/proje-tipi';
import { YETKI } from '../../../core/constants/yetki-kodlari';
import {
  FOTOGRAF_ACIKLAMASI_EN_FAZLA,
  FOTOGRAF_BAGLANTISI_SAYISI_EN_FAZLA,
  baglantiCipiAdi,
  baglantiTuru,
  baglantiTuruAdi,
  baglantilariSirala,
  fotografAciklamasiGecerli,
  fotografBaglantisiEtiketi,
  fotografBaglantisiGecerli,
  fotografBaglantisiNormalize,
  fotografSitesi,
} from './proje-fotograf-baglantisi';
import { dosyayiKaydet } from '../../../core/services/dosya-kaydet';

interface SahaAktarimGrubu {
  sahaSandikId: number | null;
  sahaSandikNo: string;
  aktarimlar: SahaAktarimDto[];
  geriAlinabilirMi: boolean;
  geriAlinamamaNedeni: string | null;
}

/** Aktarımlar penceresinde bir aktarım başlığı (otomatik ya da elle); tamamı tek işlemde geri alınır. */
interface SahaAktarimIslemi {
  sahaAktarimId: number;
  tarih: string | null;
  aciklama: string;
  satirSayisi: number;
  geriAlinabilirMi: boolean;
  /** Sahadan sahaya taşıma başlığı: tamamı geri alınmaz, ters yönde taşınır. */
  tasimaMi: boolean;
}

/** Aktarımlar penceresinden açılan sahadan sahaya taşıma: satırlar ya da bir saha sandığının tamamı. */
interface SahaTasimaSecimi {
  kaynak: SahaTasimaKaynagi;
  satirIds: number[];
  sandikId: number | null;
  baslik: string;
}

interface RevisionIssueViewModel {
  issue: CekiRevizyonSorunu;
  context: string[];
  categoryLabel: string;
}

/** Satırdaki rapor açılır menüsünün türü; 'saha' Saha/Yedek sandık raporu ve sevke hazır sandık raporudur. */
type RaporMenuTuru = 'eksik' | 'gerceklesen' | 'saha';

@Component({
  selector: 'app-proje-listesi',
  standalone: true,
  imports: [TranslatePipe, RouterLink, NgClass, StatusBadgeComponent, BreadcrumbComponent, CekiRevizyonOnizlemeComponent, CekiRevizyonGecmisiComponent, FormsModule, DatePipe, IslemlerMenusuComponent, TopluSevkComponent, OtomatikSahaAktarimComponent, SahadanSahayaTasimaComponent],
  templateUrl: './proje-listesi.component.html',
  styleUrl: './proje-listesi.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjeListesiComponent implements OnInit {
  ts = inject(TranslationService);
  private projeService = inject(ProjeService);
  private sandikService = inject(SandikService);
  permissions = inject(PermissionService);
  toastService = inject(ToastService);
  confirmService = inject(ConfirmService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private pdfService = inject(PdfService);
  private readonly sandikNoCollator = new Intl.Collator('tr', { numeric: true, sensitivity: 'base' });
  private readonly destroyRef = inject(DestroyRef);
  private projeListeIstekSurumu = 0;

  /** Yönetim ekranlarında route'un proje tipi; aktif ve sevk edilen proje listelerinde null. */
  private readonly rotaTipi = rotaProjeTipi(this.route.snapshot);
  /** Tip izinlerinin bağlamı; proje listelerinde normal proje izinleri geçerlidir. */
  private readonly projeTipi = projeTipiBaglami(this.rotaTipi);

  isSandikYonetimi = signal(false);
  isSevkEdilen = signal(false);
  isAktifProjeler = signal(false);
  isSahaYonetimi = signal(false);
  isYedekYonetimi = signal(false);
  protected readonly ProjeTipi = ProjeTipi;
  projeTipiFilter = signal<number | null>(null);
  readonly projeTipiFilterOptions: { label: string; value: number | null }[] = [
    { label: 'Tümü', value: null },
    { label: 'Normal', value: ProjeTipi.Normal },
    { label: 'Saha', value: ProjeTipi.Saha },
    { label: 'Yedek', value: ProjeTipi.Yedek },
  ];

  downloadingPdf = signal<number | null>(null);
  downloadingEksikPdf = signal<number | null>(null);
  downloadingEksikExcel = signal<number | null>(null);
  downloadingGerceklesenPdf = signal<number | null>(null);
  downloadingGerceklesenExcel = signal<number | null>(null);
  /** Müşteri çeki listesi indirilen proje ve biçim. */
  downloadingMusteriCeki = signal<{ projeId: number; format: 'pdf' | 'excel' } | null>(null);
  /** Sevke hazır sandık raporu indirilen proje ve biçim. */
  downloadingSevkeHazir = signal<{ projeId: number; format: 'pdf' | 'excel' } | null>(null);
  reportMenuKey = signal<string | null>(null);
  reportMenuPosition = signal<{ top: number; left: number } | null>(null);
  reportMenuContext = signal<{ key: string; proje: ProjeDto; type: RaporMenuTuru } | null>(null);
  bulkEksikRaporMenuPosition = signal<{ top: number; left: number } | null>(null);
  bulkEksikRaporDownloading = signal<'pdf' | 'excel' | null>(null);
  /** G4: seçili projelerin talep formu Excel'i indiriliyor. */
  topluTalepFormuIndiriliyor = signal(false);
  /**
   * Toplu işlem seçimi (eksik raporu, talep formu, toplu sevk): proje Id → seçim anındaki satır. Sayfa, arama ve tip
   * filtresi değişince korunur; toplu işlemler görünen sayfadan bağımsız olarak bütün seçimi gönderir. Seçili proje
   * yeniden listelenince satırı güncel haliyle yenilenir; sunucu her projeyi ayrıca doğrular.
   */
  seciliProjeler = signal<ReadonlyMap<number, ProjeDto>>(new Map());
  /** Son toplu sevkte sefere girmeyip seçimde bırakılan projeler; seçim şeridinde uyarıyla gösterilir. */
  sevkEdilmeyenProjeIds = signal<ReadonlySet<number>>(new Set());
  revizyonGecmisiProje = signal<ProjeDto | null>(null);
  /** Otomatik sahaya aktarım önizlemesi açık olan normal proje. */
  otomatikSahaAktarimProje = signal<ProjeDto | null>(null);
  /** Aktarımlar penceresinden açılan sahadan sahaya taşıma. */
  sahaTasimaSecimi = signal<SahaTasimaSecimi | null>(null);

  /**
   * Grid/3K buton gösterimi — Rol Yetki ekranından yönetilir.
   * MenuTanimi'deki "grid-modulu" ve "3k-modulu" kayıtlarına göre kontrol edilir.
   */
  canSeeGrid = computed(() => this.permissions.hasAccess(YETKI.SANDIK.GRID_MODULU));
  /** Sevkiyat kaydı korunarak açma (sevk sonrası düzeltme) ayrı, dar bir izin ister. */
  canSevkSonrasiDuzeltme = computed(() => this.permissions.canWrite(YETKI.SANDIK.SEVK_SONRASI_DUZELTME));
  canSee3K = computed(() => this.permissions.hasAccess(YETKI.SANDIK.UCK_MODULU));
  canSeeEksikRapor = computed(() => this.permissions.hasAccess(YETKI.SANDIK.EKSIK_RAPORU));
  canUseBulkEksikRapor = computed(() =>
    (this.isSandikYonetimi() && this.canSeeEksikRapor()) ||
    (this.isSahaYonetimi() && this.canSeeSahaSevkSonrasiEksikRapor()) ||
    (this.isYedekYonetimi() && this.canSeeYedekEksikRapor())
  );
  /** G4: talep formu Grid verisidir; ekranın proje tipindeki Grid okuma izni gerekir (sunucu her projeyi ayrıca doğrular). */
  canUseBulkTalepFormu = computed(() =>
    (this.isSandikYonetimi() || this.isSahaYonetimi() || this.isYedekYonetimi()) &&
    this.permissions.hasAccess(this.projeTipi.yetki.gridModulu)
  );
  /**
   * Toplu sevk (tır seferi): sevk edilmemiş proje listelerinde. Aktif Projeler bütün tipleri gösterir; herhangi bir tipin
   * sevk izni yeter, her proje pencerede kendi tipinin sevk iznine göre sefere eklenir (sunucu ayrıca doğrular).
   */
  canUseTopluSevk = computed(() =>
    (this.isAktifProjeler() && this.canSevkEtHerhangiTip()) ||
    ((this.isSahaYonetimi() || this.isYedekYonetimi()) && this.canSevkEtCurrent())
  );
  /** Proje seçim sütunu: toplu eksik raporu, toplu talep formu veya toplu sevk için. */
  canUseBulkSecim = computed(() => this.canUseBulkEksikRapor() || this.canUseBulkTalepFormu() || this.canUseTopluSevk());
  canSeeGerceklesenRapor = computed(() => this.permissions.hasAccess(YETKI.SANDIK.GERCEKLESEN_CEKI_RAPORU));
  canSee3KIsListesi = computed(() => this.isSandikYonetimi() && this.permissions.hasAccess(YETKI.SANDIK.UCK_IS_LISTESI));
  canSeeGridIsListesi = computed(() => this.isSandikYonetimi() && this.permissions.hasAccess(YETKI.SANDIK.GRID_IS_LISTESI));
  /** Grid Sahası kenar menüde yoktur; Sandık Yönetimi ve Projeler listesindeki düğmeyle açılır. */
  canSeeGridSaha = computed(() =>
    (this.isSandikYonetimi() || this.isAktifProjeler()) && this.permissions.hasAccess(YETKI.SANDIK.GRID_SAHA_GORUNUMU));
  /** Sandık açılış/kapanış istatistiği kenar menüde yoktur; Grid Sahası gibi bu listenin "Diğer" menüsünden açılır. */
  canSeeSandikAcilisIstatistigi = computed(() =>
    (this.isSandikYonetimi() || this.isAktifProjeler()) && this.permissions.hasAccess(YETKI.SANDIK.SANDIK_ACILIS_ISTATISTIGI));
  /** Barkod etiketi kenar menüde yoktur; bu listenin "Diğer" menüsünden açılır, proje ekranda seçilir. */
  canSeeBarkodEtiket = computed(() =>
    (this.isSandikYonetimi() || this.isAktifProjeler()) && this.permissions.hasAccess(YETKI.SANDIK.BARKOD_ETIKET));
  canUseEksikTamamlama = computed(() => this.permissions.canWrite(YETKI.SAHA.SAHAYA_AKTAR));
  canUploadCeki = computed(() => this.permissions.canWrite(YETKI.PROJE.CEKI_YUKLE));
  canSeeSahaGrid = computed(() => this.permissions.hasAccess(YETKI.SAHA.GRID_MODULU));
  canSeeSaha3K = computed(() => this.permissions.hasAccess(YETKI.SAHA.UCK_MODULU));
  canSeeSahaRapor = computed(() => this.permissions.hasAccess(YETKI.SAHA.RAPORU));
  canSeeSahaSevkSonrasiEksikRapor = computed(() => this.permissions.hasAccess(YETKI.SAHA.SEVK_SONRASI_EKSIK_RAPORU));
  canSeeSahaGerceklesenRapor = computed(() => this.permissions.hasAccess(YETKI.SAHA.GERCEKLESEN_CEKI_RAPORU));
  canSeeSahaSandiklar = computed(() => this.permissions.hasAccess(YETKI.SAHA.SANDIKLAR));
  canUploadYedekCeki = computed(() => this.permissions.canWrite(YETKI.YEDEK.CEKI_YUKLE));
  canSeeYedekGrid = computed(() => this.permissions.hasAccess(YETKI.YEDEK.GRID_MODULU));
  canSeeYedek3K = computed(() => this.permissions.hasAccess(YETKI.YEDEK.UCK_MODULU));
  canSeeYedekRapor = computed(() => this.permissions.hasAccess(YETKI.YEDEK.RAPORU));
  canSeeYedekEksikRapor = computed(() => this.permissions.hasAccess(YETKI.YEDEK.EKSIK_RAPORU));
  canSeeYedekGerceklesenRapor = computed(() => this.permissions.hasAccess(YETKI.YEDEK.GERCEKLESEN_CEKI_RAPORU));
  canSeeYedekSandiklar = computed(() => this.permissions.hasAccess(YETKI.YEDEK.SANDIKLAR));
  canManageSahaAktarimGeriAl = computed(() => this.permissions.hasAccess(YETKI.SAHA.AKTARIM_GERI_AL));
  canWriteSahaAktarimGeriAl = computed(() => this.permissions.canWrite(YETKI.SAHA.AKTARIM_GERI_AL));
  canSevkEtCurrent = computed(() => this.permissions.canWrite(this.projeTipi.yetki.sevkEt));
  /** Birden çok tipi gösteren listelerde (Aktif Projeler, Sevk Edilen) sevk işlemi sütunu için: herhangi bir tipin sevk izni. */
  canSevkEtHerhangiTip = computed(() =>
    Object.values(PROJE_TIPI_BAGLAMLARI).some(baglam => this.permissions.canWrite(baglam.yetki.sevkEt)));
  canUpdatePlanlananSevkTarihiHerhangiTip = computed(() =>
    Object.values(PROJE_TIPI_BAGLAMLARI).some(baglam => this.permissions.canWrite(baglam.yetki.planlananSevkTarihi)));
  canDeleteProjectCurrent = computed(() => this.permissions.canWrite(this.projeTipi.yetki.projeSil));
  canUpdatePlanlananSevkTarihiCurrent = computed(() =>
    this.permissions.canWrite(this.projeTipi.yetki.planlananSevkTarihi));
  hasSandikYonetimiActions = computed(() =>
    this.isSandikYonetimi() &&
    (this.canSeeGrid() || this.canSee3K() || this.canSeeEksikRapor() || this.canSevkEtCurrent() || this.canDeleteProjectCurrent())
  );
  hasSahaYonetimiActions = computed(() =>
    this.isSahaYonetimi() &&
    (this.canSeeSahaGrid() || this.canSeeSaha3K() || this.canSeeSahaRapor() || this.canSeeSahaSevkSonrasiEksikRapor() || this.canSeeSahaGerceklesenRapor() || this.canSeeSahaSandiklar() || this.canManageSahaAktarimGeriAl() || this.canSevkEtCurrent() || this.canUpdatePlanlananSevkTarihiCurrent() || this.canDeleteProjectCurrent())
  );
  hasYedekYonetimiActions = computed(() =>
    this.isYedekYonetimi() &&
    (this.canSeeYedekGrid() || this.canSeeYedek3K() || this.canSeeYedekRapor() ||
      this.canSeeYedekEksikRapor() || this.canSeeYedekGerceklesenRapor() ||
      this.canSeeYedekSandiklar() || this.canSevkEtCurrent() ||
      this.canUpdatePlanlananSevkTarihiCurrent() || this.canDeleteProjectCurrent())
  );
  hasActionColumn = computed(() =>
    (this.fotografBaglantisiDuzenlenebilir() && this.projeler().some(p => this.fotografBaglantilari(p).length > 0)) ||
    this.projeler().some(proje => this.canSeeRevizyonGecmisi(proje)) ||
    this.hasSandikYonetimiActions() ||
    this.hasSahaYonetimiActions() ||
    this.hasYedekYonetimiActions() ||
    (this.isSevkEdilen() && this.canSeeGerceklesenRapor()) ||
    (this.isSahaYonetimi() && this.canSeeSahaGerceklesenRapor()) ||
    (!this.isSandikMode() && this.projeler().some(p => this.canSevkEtProje(p) || this.canUpdatePlanlananSevkTarihiProje(p))) ||
    (!this.isSandikMode() && this.hasAnySevkiyatGecmisi()) ||
    this.isSevkEdilen() ||
    this.projeler().some(p => this.listeGridRotasi(p) !== null || this.liste3KRotasi(p) !== null) ||
    (!this.isSandikMode() && this.canDeleteProjectCurrent())
  );
  canWriteCurrentMenu = computed(() => {
    const menuKod = this.route.snapshot.data['menuKod'];
    return typeof menuKod === 'string' && this.permissions.canWrite(menuKod);
  });
  canUploadRevision = computed(() =>
    !this.isSevkEdilen() &&
    !this.isSahaYonetimi() &&
    !this.isYedekYonetimi() &&
    this.permissions.canWrite(YETKI.SANDIK.CEKI_REVIZYON_YUKLE)
  );

  projeler = signal<ProjeDto[]>([]);
  loading = signal(true);
  selectedEksikRaporCount = computed(() => this.seciliProjeler().size);
  seciliProjeListesi = computed(() => Array.from(this.seciliProjeler().values()));
  gorunenProjeIds = computed(() => new Set(this.projeler().map(proje => proje.id)));
  /** Seçili olup görünen sayfada bulunmayan (başka sayfa, arama veya filtrede kalan) proje sayısı. */
  gorunmeyenSeciliSayisi = computed(() => {
    const gorunen = this.gorunenProjeIds();
    return this.seciliProjeListesi().filter(proje => !gorunen.has(proje.id)).length;
  });
  allCurrentPageSelectedForEksikRapor = computed(() => {
    const projeler = this.projeler();
    const selected = this.seciliProjeler();
    return projeler.length > 0 && projeler.length <= 25 && projeler.every(proje => selected.has(proje.id));
  });
  someCurrentPageSelectedForEksikRapor = computed(() => {
    const selected = this.seciliProjeler();
    return !this.allCurrentPageSelectedForEksikRapor() && this.projeler().some(proje => selected.has(proje.id));
  });

  // Server-side pagination
  searchTerm = signal('');
  currentPage = signal(1);
  pageSize = signal(15);
  pageSizeOptions = [15, 25, 50];
  totalCount = signal(0);
  totalPages = signal(0);

  private searchSubject = new Subject<string>();

  // Çeki yükleme
  showUploadModal = signal(false);
  uploadMode = signal<'normal' | 'revizyon' | 'yedek'>('normal');
  isYedekUpload = computed(() => this.uploadMode() === 'yedek');
  selectedFile = signal<File | null>(null);
  uploading = signal(false);
  previewingRevision = signal(false);
  revisionPreview = signal<CekiRevizyonOnizlemeSonuc | null>(null);
  revisionServerIssues = signal<CekiRevizyonSorunu[]>([]);
  revisionServerIssueViewModels = computed<RevisionIssueViewModel[]>(() =>
    this.revisionServerIssues().map(issue => ({
      issue,
      context: this.buildRevisionIssueContext(issue),
      categoryLabel: issue.kategori === 'DurumCakismasi' ? 'Durum çakışması' : 'Doğrulama',
    }))
  );
  uploadResult = signal<{ success: boolean; message: string } | null>(null);
  dragOver = signal(false);

  // Proje Oluştur (Saha/Yedek)
  showProjeOlusturModal = signal(false);
  creatingProje = signal(false);
  yeniProjeForm = signal({ projeNo: '', musteri: '', lokasyon: '' });

  // Sevk Tarihi Güncelle Modal
  showSevkTarihiModal = signal(false);
  selectedProjeId = signal(0);
  sevkTarihiProje = signal<ProjeDto | null>(null);
  guncelSevkTarihi = signal('');
  planlananSevkTarihiGecerli = computed(() => {
    const value = this.guncelSevkTarihi().trim();
    const dateTimeLocalPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/;

    return dateTimeLocalPattern.test(value) && !Number.isNaN(new Date(value).getTime());
  });
  sevkTarihiSaving = signal(false);

  // Sevk Et Modal
  showSevkEtModal = signal(false);
  sevkEtProje = signal<ProjeDto | null>(null);
  sevkEtTarihi = signal('');
  sevkEtAciklama = signal('');
  sevkEtAracPlaka = signal('');
  sevkEtSofor = signal('');
  sevkEtDorsePlaka = signal('');
  /** Sunucunun kaydedeceği plaka biçimi; boşsa plaka geçersizdir (toplu sevkle aynı kural). */
  readonly sevkEtPlakaOnizleme = computed(() => aracPlakaBicimle(this.sevkEtAracPlaka()));
  protected readonly sevkPlakaEnFazla = ARAC_PLAKA_EN_FAZLA;
  protected readonly sevkSoforEnFazla = SOFOR_EN_FAZLA;
  protected readonly sevkAciklamaEnFazla = SEFER_ACIKLAMA_EN_FAZLA;
  sevkEtSaving = signal(false);
  sevkEtSandiklar = signal<SandikDto[]>([]);
  sevkEtSandikLoading = signal(false);
  selectedSevkSandikIds = signal<number[]>([]);
  sevkGecmisi = signal<SevkiyatDto[]>([]);
  sevkGecmisiLoading = signal(false);
  showSevkGecmisiModal = signal(false);
  sevkGecmisiProje = signal<ProjeDto | null>(null);
  showKilitAcModal = signal(false);
  kilitAcProje = signal<ProjeDto | null>(null);
  kilitAcmaTipiId = signal<SevkiyatKilitAcmaTipi>(SevkiyatKilitAcmaTipi.SevkiyatKaydiKorunarakAc);
  kilitAcAciklama = signal('');
  kilitAcSaving = signal(false);
  showSahaAktarimModal = signal(false);
  sahaAktarimProje = signal<ProjeDto | null>(null);
  sahaAktarimlari = signal<SahaAktarimDto[]>([]);
  sahaAktarimLoading = signal(false);
  sahaAktarimGeriAlSaving = signal<number | null>(null);
  sahaSandikAktarimGeriAlSaving = signal<number | null>(null);
  sahaAktarimIslemiGeriAlSaving = signal<number | null>(null);
  sahaAktarimIslemVar = computed(() =>
    this.sahaAktarimGeriAlSaving() !== null || this.sahaSandikAktarimGeriAlSaving() !== null ||
    this.sahaAktarimIslemiGeriAlSaving() !== null
  );
  /**
   * Toplu sahadan sahaya taşıma seçimi (saha satırı kimlikleri). Sevk edilmiş satır seçilemez; seçilenler tek işlemde,
   * hepsi ya da hiçbiri taşınır (sunucu önizlemesi engelleri gösterir). Liste her yüklendiğinde seçim sıfırlanır.
   */
  sahaTasimaSeciliIds = signal<number[]>([]);
  sahaTasimaSecilebilirIds = computed(() =>
    this.sahaAktarimlari().filter(a => !a.sevkEdildiMi).map(a => a.sahaCekiSatiriId));
  sahaTasimaTumuSecili = computed(() => {
    const secilebilir = this.sahaTasimaSecilebilirIds();
    const secili = new Set(this.sahaTasimaSeciliIds());
    return secilebilir.length > 0 && secilebilir.every(id => secili.has(id));
  });
  /** Aktarımlar penceresindeki satırların aktarım başlıkları (otomatik ya da elle); en yeni üstte. */
  sahaAktarimIslemleri = computed<SahaAktarimIslemi[]>(() => {
    const islemler = new Map<number, SahaAktarimIslemi>();
    for (const aktarim of this.sahaAktarimlari()) {
      if (!aktarim.sahaAktarimId) continue;
      const mevcut = islemler.get(aktarim.sahaAktarimId);
      if (mevcut) {
        mevcut.satirSayisi++;
        mevcut.geriAlinabilirMi = mevcut.geriAlinabilirMi && aktarim.geriAlinabilirMi;
        continue;
      }
      const tasimaMi = aktarim.sahaAktarimTasimaMi === true;
      islemler.set(aktarim.sahaAktarimId, {
        sahaAktarimId: aktarim.sahaAktarimId,
        tarih: aktarim.sahaAktarimTarihi ?? null,
        aciklama: aktarim.sahaAktarimAciklama?.trim() || `#${aktarim.sahaAktarimId}`,
        satirSayisi: 1,
        geriAlinabilirMi: aktarim.geriAlinabilirMi && !tasimaMi,
        tasimaMi,
      });
    }
    return [...islemler.values()].sort((a, b) => b.sahaAktarimId - a.sahaAktarimId);
  });
  sahaAktarimGruplari = computed<SahaAktarimGrubu[]>(() => {
    const gruplar = new Map<string, SahaAktarimGrubu>();

    for (const aktarim of this.sahaAktarimlari()) {
      const sahaSandikId = aktarim.sahaSandikId && aktarim.sahaSandikId > 0
        ? aktarim.sahaSandikId
        : null;
      const sahaSandikNo = (aktarim.sahaSandikNo ?? '').trim() || '-';
      const anahtar = sahaSandikId !== null ? `id:${sahaSandikId}` : `no:${sahaSandikNo}`;
      const mevcut = gruplar.get(anahtar);

      if (mevcut) {
        mevcut.aktarimlar.push(aktarim);
        continue;
      }

      gruplar.set(anahtar, {
        sahaSandikId,
        sahaSandikNo,
        aktarimlar: [aktarim],
        geriAlinabilirMi: false,
        geriAlinamamaNedeni: null
      });
    }

    return Array.from(gruplar.values())
      .map(grup => {
        const nedenler = Array.from(new Set(
          grup.aktarimlar
            .filter(aktarim => !aktarim.geriAlinabilirMi)
            .map(aktarim => aktarim.geriAlinamamaNedeni?.trim())
            .filter((neden): neden is string => !!neden)
        ));

        const sandikMevcutMu = grup.sahaSandikId !== null;
        const tumSatirlarGeriAlinabilirMi = grup.aktarimlar.every(aktarim => aktarim.geriAlinabilirMi);

        return {
          ...grup,
          geriAlinabilirMi: sandikMevcutMu && tumSatirlarGeriAlinabilirMi,
          geriAlinamamaNedeni: !sandikMevcutMu
            ? 'Saha sandığı kaydı bulunamadığı için toplu geri alma yapılamaz.'
            : nedenler.length > 0
              ? nedenler.join(' ')
              : tumSatirlarGeriAlinabilirMi
                ? null
                : 'Sandıktaki en az bir aktarım geri alınabilir durumda değil.'
        };
      })
      .sort((a, b) => this.sandikNoCollator.compare(a.sahaSandikNo, b.sahaSandikNo));
  });
  readonly kilitAcmaTipleri = SevkiyatKilitAcmaTipi;
  sevkGecmisiSevkiyatSayisi = computed(() => this.sevkGecmisi().filter(kayit => !kayit.isKilitAcma).length);
  sevkEtSelectableSandiklar = computed(() => this.sevkEtSandiklar().filter(s => this.isSandikSevkAdayi(s)));
  allSevkSandikSelected = computed(() => {
    const selectable = this.sevkEtSelectableSandiklar();
    const selected = this.selectedSevkSandikIds();
    return selectable.length > 0 && selectable.every(s => selected.includes(s.id));
  });
  hasAnySevkiyatGecmisi = computed(() => this.projeler().some(p => this.hasSevkiyatGecmisi(p)));

  breadcrumb: { label: string; link?: string }[] = [
    { label: 'Ana Kontrol Paneli', link: '/dashboard' },
    { label: 'Projeler' },
  ];

  /** Saha/Yedek modülleri sandık yönetimine benzer akış kullanır ama farklı routePrefix */
  routePrefix = '';

  ngOnInit() {
    const menuKod = this.route.snapshot.data['menuKod'];
    this.isSandikYonetimi.set(this.rotaTipi === ProjeTipi.Normal);
    this.isSevkEdilen.set(menuKod === YETKI.PROJE.SEVK_EDILEN);
    this.isAktifProjeler.set(menuKod === YETKI.PROJE.AKTIF_PROJELER);
    this.isSahaYonetimi.set(this.rotaTipi === ProjeTipi.Saha);
    this.isYedekYonetimi.set(this.rotaTipi === ProjeTipi.Yedek);

    if (this.rotaTipi !== null) {
      this.breadcrumb = [
        { label: 'Ana Kontrol Paneli', link: '/dashboard' },
        { label: this.ts.translate(this.projeTipi.baslik.yonetim) },
      ];
      this.routePrefix = this.projeTipi.yonetimRotasi;
    } else if (this.isSevkEdilen()) {
      this.breadcrumb = [
        { label: 'Ana Kontrol Paneli', link: '/dashboard' },
        { label: 'Sevk Edilen Projeler' },
      ];
    }
    
    this.loadProjeler();

    this.searchSubject.pipe(
      debounceTime(400),
      distinctUntilChanged()
    ).subscribe(term => {
      this.searchTerm.set(term);
      this.currentPage.set(1);
      this.loadProjeler();
    });
  }

  /** Sandık yönetimi moduna giren tüm modlar için ortak kontrol */
  isSandikMode = computed(() => this.isSandikYonetimi() || this.isSahaYonetimi() || this.isYedekYonetimi());
  showProjeTipiFilter = computed(() => this.isAktifProjeler() || this.isSevkEdilen());

  /** Sayfa başlığındaki ikon çipi ve vurgu rengi; yalnız görünümü etkiler. */
  sayfaGorunumu = computed(() => {
    if (this.isSahaYonetimi()) return { ikon: 'ri-tools-line', renk: '#16a34a' };
    if (this.isYedekYonetimi()) return { ikon: 'ri-box-3-line', renk: '#0ea5e9' };
    if (this.isSevkEdilen()) return { ikon: 'ri-truck-line', renk: '#e8890c' };
    if (this.isSandikYonetimi() && !this.isAktifProjeler()) return { ikon: 'ri-archive-line', renk: '#7c3aed' };
    return { ikon: 'ri-folder-3-line', renk: 'var(--primaryColor)' };
  });

  loadProjeler() {
    const istekSurumu = ++this.projeListeIstekSurumu;
    // Toplu işlem seçimi sayfa, arama ve filtre değişiminde korunur; yalnız işlem veya kullanıcı temizler.
    this.loading.set(true);

    // Mode'a gore parametreleri belirle
    let projeTipiId: number | undefined;
    let isSevkEdilen: boolean | undefined;

    if (this.showProjeTipiFilter()) {
      projeTipiId = this.projeTipiFilter() ?? undefined;
      isSevkEdilen = this.isSevkEdilen();
    } else if (this.isSahaYonetimi()) {
      // G1 / S-11: tamamen sevk edilen saha/yedek projesi modül listesinden çıkar, Sevk Edilen'de görünür.
      projeTipiId = ProjeTipi.Saha;
      isSevkEdilen = false;
    } else if (this.isYedekYonetimi()) {
      projeTipiId = ProjeTipi.Yedek;
      isSevkEdilen = false;
    } else if (this.isSevkEdilen()) {
      isSevkEdilen = true; // Tum tipler, sadece sevk edilmis
    } else {
      // Aktif Projeler veya Sandik Yonetimi — Normal projeler, sevk edilmemis
      projeTipiId = ProjeTipi.Normal;
      isSevkEdilen = false;
    }

    this.projeService.getProjeListesi(
      this.currentPage(),
      this.pageSize(),
      projeTipiId,
      this.searchTerm() || undefined,
      isSevkEdilen
    ).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(res => {
      if (istekSurumu !== this.projeListeIstekSurumu) return;
      this.loading.set(false);
      if (res.isSuccess && res.value) {
        this.projeler.set(res.value.items);
        this.seciliProjeleriYenile(res.value.items);
        this.totalCount.set(res.value.totalCount);
        this.totalPages.set(res.value.totalPages);
      } else {
        this.projeler.set([]);
        this.totalCount.set(0);
        this.totalPages.set(0);
        this.toastService.error(res.error || 'Proje listesi alınamadı.');
      }
    });
  }

  onSearch(event: Event) {
    const term = (event.target as HTMLInputElement).value;
    this.searchSubject.next(term);
  }

  setProjeTipiFilter(value: number | null) {
    if (this.projeTipiFilter() === value) return;
    this.projeTipiFilter.set(value);
    this.currentPage.set(1);
    this.loadProjeler();
  }

  // ===== Pagination Navigation =====
  goToPage(page: number | null) {
    if (page === null || page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
    this.loadProjeler();
  }
  prevPage() { this.goToPage(this.currentPage() - 1); }
  nextPage() { this.goToPage(this.currentPage() + 1); }

  onPageSizeChange(size: number) {
    this.pageSize.set(size);
    this.currentPage.set(1);
    this.loadProjeler();
  }

  mathMin(a: number, b: number): number {
    return Math.min(a, b);
  }

  private formatDateTimeLocal(date: Date): string {
    const pad = (value: number) => value.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  private toDateTimeLocalInputValue(value?: string | Date | null): string {
    if (!value) {
      return this.formatDateTimeLocal(new Date());
    }

    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? this.formatDateTimeLocal(new Date()) : this.formatDateTimeLocal(date);
  }

  private toApiDateTime(value: string): string | null {
    const normalizedValue = value.trim();
    if (!normalizedValue) return null;

    return normalizedValue.length === 16 ? `${normalizedValue}:00` : normalizedValue;
  }

  private compareSandikNo(a?: string | null, b?: string | null): number {
    const left = (a ?? '').trim();
    const right = (b ?? '').trim();
    const result = this.sandikNoCollator.compare(left, right);
    return result !== 0 ? result : left.localeCompare(right, 'tr');
  }

  private sortBySandikNo<T extends { sandikNo: string }>(items: T[]): T[] {
    return [...items].sort((a, b) => this.compareSandikNo(a.sandikNo, b.sandikNo));
  }

  private sortSevkiyatSandiklari(sevkiyatlar: SevkiyatDto[]): SevkiyatDto[] {
    return sevkiyatlar.map(sevkiyat => ({
      ...sevkiyat,
      sandiklar: this.sortBySandikNo(sevkiyat.sandiklar ?? [])
    }));
  }

  getTamamlanmaYuzdesi(p: ProjeDto): number {
    if (p.toplamUrunSayisi === 0) return 0;
    return Math.floor((p.tamamlananUrunSayisi / p.toplamUrunSayisi) * 100);
  }

  getDurumLabel(durum: string): string {
    const map: Record<string, string> = {
      Hazirlaniyor: 'Hazırlanıyor',
      DevamEdiyor: 'Devam Ediyor',
      Tamamlandi: 'Tamamlandı',
      EksikSevkEdildi: 'Kısmi Sevk',
      'Eksik Sevk Edildi': 'Kısmi Sevk',
    };
    return map[durum] ?? durum;
  }

  shouldShowActions(p: ProjeDto): boolean {
    // Bağlantısız projede ekleme satırdaki "+" düğmesindedir; bağlantısı olan projede yönetme (ekle/düzenle/sil) menüdedir.
    if ((this.fotografBaglantisiDuzenlenebilir() && this.fotografBaglantilari(p).length > 0) || this.canSeeRevizyonGecmisi(p)) return true;
    if (this.isSahaYonetimi()) return this.hasSahaYonetimiActions();
    if (this.isYedekYonetimi()) return this.hasYedekYonetimiActions();
    if (this.isSandikYonetimi()) return this.hasSandikYonetimiActions();

    return this.canShowGerceklesenRapor(p) ||
      this.listeGridRotasi(p) !== null ||
      this.liste3KRotasi(p) !== null ||
      this.otomatikSahaAktarimYapilabilir(p) ||
      (this.isSevkEdilen() && this.kilidiAcabilir(p)) ||
      (!this.isSandikMode() && this.hasSevkiyatGecmisi(p)) ||
      (!this.isSandikMode() && this.canSevkEtProje(p)) ||
      (!this.isSandikMode() && this.canUpdatePlanlananSevkTarihiProje(p)) ||
      this.canDeleteProjectCurrent();
  }

  /**
   * Sevk etme: sunucudaki Shipment kuralıyla aynı — projenin gerçek tipinin sevk etme (W) izni. Aktif Projeler bütün
   * tipleri listeler; ekranın (normal proje) izni saha/yedek satırı için geçerli değildir.
   */
  canSevkEtProje(p: ProjeDto): boolean {
    return this.permissions.canWrite(projeTipiBaglami(p.projeTipiId).yetki.sevkEt);
  }

  /** Planlanan sevk tarihi: sunucudaki PlannedShipmentDate kuralıyla aynı — projenin gerçek tipinin izni. */
  canUpdatePlanlananSevkTarihiProje(p: ProjeDto): boolean {
    return this.permissions.canWrite(projeTipiBaglami(p.projeTipiId).yetki.planlananSevkTarihi);
  }

  canSeeRevizyonGecmisi(proje: ProjeDto): boolean {
    return this.permissions.hasAccess(projeTipiBaglami(proje.projeTipiId).yetki.projeYonetimi) ||
      this.permissions.hasAccess(YETKI.SANDIK.CEKI_REVIZYON_YUKLE) ||
      this.permissions.hasAccess(YETKI.PROJE.SEVK_EDILEN);
  }

  projeTipiMetni(projeTipiId: number): string {
    return projeTipiBaglami(projeTipiId).ad;
  }

  canShowGerceklesenRapor(p: ProjeDto): boolean {
    if (this.isSahaYonetimi()) {
      return p.projeTipiId === ProjeTipi.Saha && this.canSeeSahaGerceklesenRapor() && this.hasSevkiyatGecmisi(p);
    }

    if (this.isYedekYonetimi()) {
      return p.projeTipiId === ProjeTipi.Yedek && this.canSeeYedekGerceklesenRapor() && this.hasSevkiyatGecmisi(p);
    }

    // G1: Sevk Edilen listesi bütün tipleri gösterir; rapor izni satırın kendi proje tipine göre denetlenir.
    return this.isSevkEdilen() && this.permissions.hasAccess(projeTipiBaglami(p.projeTipiId).yetki.gerceklesenCekiRaporu);
  }

  /** Bütün tipleri listeleyen ekranlar (Aktif Projeler, Sevk Edilen): Grid/3K kısayolu satırın tipine göre verilir. */
  private tumTiplerListesi = computed(() => this.isAktifProjeler() || this.isSevkEdilen());

  /**
   * Aktif Projeler ve Sevk Edilen listesinden projenin kendi tipindeki Grid ekranına kısayol (Sandık Yönetimi'ndeki Grid
   * düğmesinin karşılığı). İzin satırın proje tipine göre denetlenir; izin yoksa null.
   */
  listeGridRotasi(p: ProjeDto): string | null {
    const baglam = projeTipiBaglami(p.projeTipiId);
    return this.tumTiplerListesi() && this.permissions.hasAccess(baglam.yetki.gridModulu) ? baglam.gridRotasi : null;
  }

  /** Aktif Projeler ve Sevk Edilen listesinden projenin kendi tipindeki 3K ekranına kısayol; izin yoksa null. */
  liste3KRotasi(p: ProjeDto): string | null {
    const baglam = projeTipiBaglami(p.projeTipiId);
    return this.tumTiplerListesi() && this.permissions.hasAccess(baglam.yetki.ucKModulu) ? baglam.ucKRotasi : null;
  }

  /**
   * Sevkiyat kilidini açma: sunucudaki ProjectUnlock kuralıyla aynı — bütün listelerde projenin gerçek tipinin proje
   * yönetimi veya Sevk Edilen yazma izni. Sevk etme izni kilit açmaya yetmez (sunucu 403 döner).
   */
  kilidiAcabilir(p: ProjeDto): boolean {
    if (!p.fizikselSevkEdilmisSandikVarMi) return false;
    return this.permissions.canWrite(projeTipiBaglami(p.projeTipiId).yetki.projeYonetimi) ||
      this.permissions.canWrite(YETKI.PROJE.SEVK_EDILEN);
  }

  /** Saha raporu uçları: saha modülünde veya Sevk Edilen listesindeki saha satırında. */
  private sahaRaporuMu(proje: ProjeDto): boolean {
    return this.isSahaYonetimi() || (this.isSevkEdilen() && proje.projeTipiId === ProjeTipi.Saha);
  }
  @HostListener('document:click')
  closeReportMenu() {
    this.reportMenuKey.set(null);
    this.reportMenuPosition.set(null);
    this.reportMenuContext.set(null);
    this.bulkEksikRaporMenuPosition.set(null);
    this.fotografMenu.set(null);
  }

  toggleBulkEksikRaporMenu(event: MouseEvent) {
    event.stopPropagation();
    if (this.bulkEksikRaporDownloading() !== null || this.selectedEksikRaporCount() === 0) return;

    const wasOpen = this.bulkEksikRaporMenuPosition() !== null;
    this.closeReportMenu();
    if (wasOpen) return;

    const button = event.currentTarget as HTMLElement;
    const rect = button.getBoundingClientRect();
    const menuWidth = 230;
    const menuHeight = 118;
    const gap = 8;
    const left = Math.min(Math.max(8, rect.right - menuWidth), window.innerWidth - menuWidth - 8);
    const opensBelow = rect.bottom + gap + menuHeight <= window.innerHeight - 8;
    const top = opensBelow ? rect.bottom + gap : Math.max(8, rect.top - menuHeight - gap);

    this.bulkEksikRaporMenuPosition.set({ top, left });
  }

  isEksikRaporProjeSelected(projeId: number): boolean {
    return this.seciliProjeler().has(projeId);
  }

  toggleEksikRaporProjeSelection(proje: ProjeDto) {
    if (!this.canUseBulkSecim() || this.bulkEksikRaporDownloading() !== null) return;

    const next = new Map(this.seciliProjeler());
    if (next.has(proje.id)) {
      next.delete(proje.id);
    } else {
      if (next.size >= TOPLU_SEVK_EN_FAZLA_PROJE) {
        this.toastService.warning(`Toplu işlemler için en fazla ${TOPLU_SEVK_EN_FAZLA_PROJE} proje seçebilirsiniz.`);
        return;
      }
      next.set(proje.id, proje);
    }

    this.seciliProjeleriAyarla(next);
  }

  /** Başlık kutusu yalnız görünen sayfayı seçer veya bırakır; başka sayfalardaki seçim korunur. */
  toggleAllEksikRaporProjects() {
    if (!this.canUseBulkSecim() || this.bulkEksikRaporDownloading() !== null) return;

    const projeler = this.projeler();
    if (projeler.length > 25) {
      this.toastService.warning('Sayfada 25’ten fazla proje var. En fazla 25 projeyi tek tek seçebilirsiniz.');
      return;
    }

    const next = new Map(this.seciliProjeler());
    if (this.allCurrentPageSelectedForEksikRapor()) {
      for (const proje of projeler) next.delete(proje.id);
    } else {
      const eklenecekler = projeler.filter(proje => !next.has(proje.id));
      if (next.size + eklenecekler.length > TOPLU_SEVK_EN_FAZLA_PROJE) {
        this.toastService.warning(
          `Toplu işlemler için en fazla ${TOPLU_SEVK_EN_FAZLA_PROJE} proje seçebilirsiniz. ` +
          `${next.size} proje seçili; bu sayfadaki ${eklenecekler.length} proje eklenince sınır aşılıyor.`);
        return;
      }
      for (const proje of eklenecekler) next.set(proje.id, proje);
    }
    this.seciliProjeleriAyarla(next);
    this.bulkEksikRaporMenuPosition.set(null);
  }

  seciliProjeyiKaldir(projeId: number) {
    if (!this.seciliProjeler().has(projeId)) return;
    const next = new Map(this.seciliProjeler());
    next.delete(projeId);
    this.seciliProjeleriAyarla(next);
  }

  seciminiTemizle() {
    if (this.bulkEksikRaporDownloading() !== null) return;
    this.seciliProjeleriAyarla(new Map());
  }

  private seciliProjeleriAyarla(next: ReadonlyMap<number, ProjeDto>) {
    this.seciliProjeler.set(next);
    const sevkEdilmeyenler = this.sevkEdilmeyenProjeIds();
    if ([...sevkEdilmeyenler].some(id => !next.has(id))) {
      this.sevkEdilmeyenProjeIds.set(new Set([...sevkEdilmeyenler].filter(id => next.has(id))));
    }
    if (next.size === 0) {
      this.bulkEksikRaporMenuPosition.set(null);
    }
  }

  /** Yeni gelen sayfadaki seçili projelerin saklanan satırlarını güncel haliyle yeniler; seçim değişmez. */
  private seciliProjeleriYenile(projeler: readonly ProjeDto[]) {
    const secili = this.seciliProjeler();
    const guncel = projeler.filter(proje => secili.has(proje.id));
    if (guncel.length === 0) return;
    const next = new Map(secili);
    for (const proje of guncel) next.set(proje.id, proje);
    this.seciliProjeler.set(next);
  }

  indirTopluEksikRapor(format: 'pdf' | 'excel') {
    if (!this.canUseBulkEksikRapor() || this.bulkEksikRaporDownloading() !== null) return;

    const projeIds = Array.from(this.seciliProjeler().keys());
    if (projeIds.length === 0) {
      this.toastService.warning('Rapor için en az bir proje seçmelisiniz.');
      return;
    }
    if (projeIds.length > 25) {
      this.toastService.warning('Toplu eksik raporu için en fazla 25 proje seçebilirsiniz.');
      return;
    }

    this.bulkEksikRaporMenuPosition.set(null);
    this.bulkEksikRaporDownloading.set(format);
    const request$ = format === 'pdf'
      ? this.pdfService.topluEksikUrunlerPdf(projeIds, this.projeTipi.tip)
      : this.pdfService.topluEksikUrunlerExcel(projeIds, this.projeTipi.tip);

    request$.subscribe({
      next: (blob) => {
        this.bulkEksikRaporDownloading.set(null);
        this.downloadBlobFile(blob, `Toplu_Eksik_Raporlari_${this.todayFileStamp()}.zip`);
        this.toastService.success(`${projeIds.length} projenin eksik raporu ZIP olarak indirildi.`);
      },
      error: async (error: unknown) => {
        this.bulkEksikRaporDownloading.set(null);
        this.toastService.error(await this.pdfService.downloadErrorMessage(error, 'Toplu eksik raporu indirilirken bir hata oluştu.'));
      },
    });
  }

  /** G4 / G-110: seçili projelerde Grid eksiği olup 3K kalanı süren ürünler tek sayfalık talep formu Excel'i olarak indirilir. */
  indirTopluTalepFormu() {
    if (!this.canUseBulkTalepFormu() || this.topluTalepFormuIndiriliyor()) return;
    const projeIds = Array.from(this.seciliProjeler().keys());
    if (projeIds.length === 0) {
      this.toastService.warning('Talep formu için en az bir proje seçmelisiniz.');
      return;
    }
    this.topluTalepFormuIndiriliyor.set(true);
    this.pdfService.topluTalepFormuExcel(projeIds, this.projeTipi.tip).subscribe({
      next: (blob) => {
        this.topluTalepFormuIndiriliyor.set(false);
        this.downloadBlobFile(blob, `Talep_Formu_${this.todayFileStamp()}.xlsx`);
        this.toastService.success(`${projeIds.length} projenin talep formu Excel olarak indirildi.`);
      },
      error: async (error: unknown) => {
        this.topluTalepFormuIndiriliyor.set(false);
        this.toastService.error(await this.pdfService.downloadErrorMessage(error, 'Talep formu indirilirken bir hata oluştu.'));
      },
    });
  }

  // ===== Toplu Sevk (tır seferi) =====

  /**
   * Pencereye giden seçili projeler: bütün sayfalardaki seçim. Görünen sayfada olmayanlar seçim anındaki satırlarıyla
   * gider; pencere sandıkları güncel olarak yükler, sevk edilemeyeni nedeniyle dışarıda gösterir, sunucu ayrıca doğrular.
   */
  topluSevkProjeleri = signal<ProjeDto[] | null>(null);

  openTopluSevk() {
    if (!this.canUseTopluSevk()) return;
    const projeler = this.seciliProjeListesi();
    if (projeler.length === 0) {
      this.toastService.warning('Toplu sevk için en az bir proje seçmelisiniz.');
      return;
    }
    this.bulkEksikRaporMenuPosition.set(null);
    this.topluSevkProjeleri.set(projeler);
  }

  closeTopluSevk() {
    this.topluSevkProjeleri.set(null);
  }

  /** Sevk edilen projeler seçimden çıkar; sefere girmeyen seçili projeler seçimde kalır ve açıkça bildirilir. */
  onTopluSevkEdildi(sonuc: TopluSevkTamamlandi) {
    this.topluSevkProjeleri.set(null);
    const sevkEdilenler = new Set(sonuc.sevkEdilenProjeIds);
    const kalanlar = new Map([...this.seciliProjeler()].filter(([projeId]) => !sevkEdilenler.has(projeId)));
    this.seciliProjeleriAyarla(kalanlar);
    this.sevkEdilmeyenProjeIds.set(new Set(kalanlar.keys()));
    this.toastService.success(
      `Sefer ${sonuc.seferNo}: ${sonuc.projeSayisi} projenin ${sonuc.sandikSayisi} sandığı sevk edildi.`);
    if (kalanlar.size > 0) {
      const projeNolari = [...kalanlar.values()].map(proje => proje.projeNo).join(', ');
      this.toastService.warning(`Sefere girmeyen ${kalanlar.size} proje sevk edilmedi ve seçimde bırakıldı: ${projeNolari}.`);
    }
    this.loadProjeler();
  }

  private downloadBlobFile(blob: Blob, fileName: string) {
    dosyayiKaydet(blob, fileName);
  }

  private todayFileStamp(): string {
    const today = new Date();
    const pad = (value: number) => value.toString().padStart(2, '0');
    return `${today.getFullYear()}${pad(today.getMonth() + 1)}${pad(today.getDate())}`;
  }

  toggleReportMenu(event: MouseEvent, key: string, proje: ProjeDto, type: RaporMenuTuru) {
    event.stopPropagation();
    if (this.reportMenuKey() === key) {
      this.closeReportMenu();
      return;
    }
    this.bulkEksikRaporMenuPosition.set(null);
    this.fotografMenu.set(null);

    const button = event.currentTarget as HTMLElement;
    const rect = button.getBoundingClientRect();
    const menuWidth = 210;
    // Gerçekleşen çeki menüsünde müşteri listesi, saha/yedek raporunda sevke hazır raporu da vardır.
    const menuHeight = type === 'gerceklesen' ? 230 : type === 'saha' ? 190 : 118;
    const gap = 8;
    const left = Math.min(Math.max(8, rect.right - menuWidth), window.innerWidth - menuWidth - 8);
    const opensBelow = rect.bottom + gap + menuHeight <= window.innerHeight - 8;
    const top = opensBelow ? rect.bottom + gap : Math.max(8, rect.top - menuHeight - gap);

    this.reportMenuPosition.set({
      top,
      left,
    });
    this.reportMenuContext.set({ key, proje, type });
    this.reportMenuKey.set(key);
  }

  isReportMenuOpen(key: string): boolean {
    return this.reportMenuKey() === key;
  }

  isEksikDownloading(projeId: number): boolean {
    return this.downloadingEksikPdf() === projeId || this.downloadingEksikExcel() === projeId;
  }

  isGerceklesenDownloading(projeId: number): boolean {
    return this.downloadingGerceklesenPdf() === projeId || this.downloadingGerceklesenExcel() === projeId ||
      this.downloadingMusteriCeki()?.projeId === projeId;
  }

  isSahaRaporDownloading(projeId: number): boolean {
    return this.downloadingPdf() === projeId || this.downloadingSevkeHazir()?.projeId === projeId;
  }

  indirSahaProjePdf(proje: ProjeDto) {
    this.closeReportMenu();
    this.downloadingPdf.set(proje.id);
    const tipStr = this.isYedekYonetimi() ? 'YedekRaporu' : 'SahaRaporu';
    this.pdfService.sahaProjePdf(proje.id).subscribe({
      next: (blob) => {
        this.downloadingPdf.set(null);
        dosyayiKaydet(blob, `${proje.projeNo}_${tipStr}.pdf`);
        this.toastService.success(`${tipStr} başarıyla indirildi.`);
      },
      error: () => {
        this.downloadingPdf.set(null);
        this.toastService.error('Rapor indirilirken bir hata oluştu.');
      }
    });
  }

  /**
   * Beyanname için yalnız kapalı ve ölçü/ağırlığı girilmiş sandıklar; raporun başında listelenmeyen sandıkların nedeni
   * yazar. Hiç hazır sandık yoksa sunucunun açıklaması (hangi sandık neden) gösterilir.
   */
  indirSevkeHazirSandikRaporu(proje: ProjeDto, format: 'pdf' | 'excel') {
    this.closeReportMenu();
    this.downloadingSevkeHazir.set({ projeId: proje.id, format });
    const tipStr = this.isYedekYonetimi() ? 'YedekRaporu' : 'SahaRaporu';
    this.pdfService.sevkeHazirSandikRaporu(proje.id, format).subscribe({
      next: (blob) => {
        this.downloadingSevkeHazir.set(null);
        dosyayiKaydet(blob, `${proje.projeNo}_${tipStr}_SevkeHazir.${format === 'excel' ? 'xlsx' : 'pdf'}`);
        this.toastService.success('Sevke hazır sandık raporu indirildi.');
      },
      error: async (error) => {
        this.downloadingSevkeHazir.set(null);
        this.toastService.error(await this.pdfService.downloadErrorMessage(error, 'Sevke hazır sandık raporu indirilirken bir hata oluştu.'));
      }
    });
  }

  indirEksikUrunlerPdf(proje: ProjeDto) {
    this.closeReportMenu();
    this.downloadingEksikPdf.set(proje.id);
    const raporAdi = this.isSahaYonetimi() ? 'SevkSonrasiEksikRaporu' : 'EksikRaporu';
    const basariMesaji = this.isSahaYonetimi()
      ? 'Sevk sonrası eksik raporu indirildi.'
      : 'Eksik ürünler raporu indirildi.';
    this.pdfService.eksikUrunlerPdf(proje.id).subscribe({
      next: (blob) => {
        this.downloadingEksikPdf.set(null);
        dosyayiKaydet(blob, `${proje.projeNo}_${raporAdi}.pdf`);
        this.toastService.success(basariMesaji);
      },
      error: () => {
        this.downloadingEksikPdf.set(null);
        this.toastService.error('Rapor indirilirken bir hata oluştu.');
      }
    });
  }

  indirEksikUrunlerExcel(proje: ProjeDto) {
    this.closeReportMenu();
    this.downloadingEksikExcel.set(proje.id);
    const raporAdi = this.isSahaYonetimi() ? 'SevkSonrasiEksikRaporu' : 'EksikRaporu';
    const basariMesaji = this.isSahaYonetimi()
      ? 'Sevk sonrası eksik Excel raporu indirildi.'
      : 'Eksik ürünler Excel raporu indirildi.';
    this.pdfService.eksikUrunlerExcel(proje.id).subscribe({
      next: (blob) => {
        this.downloadingEksikExcel.set(null);
        dosyayiKaydet(blob, `${proje.projeNo}_${raporAdi}.xlsx`);
        this.toastService.success(basariMesaji);
      },
      error: () => {
        this.downloadingEksikExcel.set(null);
        this.toastService.error('Excel raporu indirilirken bir hata oluştu.');
      }
    });
  }

  /**
   * Müşteriye verilen gerçekleşen çeki listesi (TR/EN başlıklı, yalnız sevk edilen sandık ve ürünler). Sevk edilmiş
   * sandığı olmayan projede sunucunun açıklaması gösterilir.
   */
  indirMusteriCekiListesi(proje: ProjeDto, format: 'pdf' | 'excel') {
    this.closeReportMenu();
    this.downloadingMusteriCeki.set({ projeId: proje.id, format });
    this.pdfService.musteriCekiListesi(proje.id, format).subscribe({
      next: (blob) => {
        this.downloadingMusteriCeki.set(null);
        dosyayiKaydet(blob, `${proje.projeNo}_GerceklesenCekiListesi_Musteri.${format === 'excel' ? 'xlsx' : 'pdf'}`);
        this.toastService.success('Müşteri çeki listesi indirildi.');
      },
      error: async (error) => {
        this.downloadingMusteriCeki.set(null);
        this.toastService.error(await this.pdfService.downloadErrorMessage(error, 'Müşteri çeki listesi indirilirken bir hata oluştu.'));
      }
    });
  }

  // ===== Çeki Yükleme Modal =====

  indirGerceklesenCekiListesiPdf(proje: ProjeDto) {
    this.closeReportMenu();
    this.downloadingGerceklesenPdf.set(proje.id);
    const request$ = this.sahaRaporuMu(proje)
      ? this.pdfService.sahaGerceklesenCekiListesiPdf(proje.id)
      : this.pdfService.gerceklesenCekiListesiPdf(proje.id);
    request$.subscribe({
      next: (blob) => {
        this.downloadingGerceklesenPdf.set(null);
        dosyayiKaydet(blob, `${proje.projeNo}_GerceklesenCekiListesi.pdf`);
        this.toastService.success('Gerçekleşen çeki listesi raporu indirildi.');
      },
      error: () => {
        this.downloadingGerceklesenPdf.set(null);
        this.toastService.error('Rapor indirilirken bir hata oluştu.');
      }
    });
  }

  indirGerceklesenCekiListesiExcel(proje: ProjeDto) {
    this.closeReportMenu();
    this.downloadingGerceklesenExcel.set(proje.id);
    const request$ = this.sahaRaporuMu(proje)
      ? this.pdfService.sahaGerceklesenCekiListesiExcel(proje.id)
      : this.pdfService.gerceklesenCekiListesiExcel(proje.id);
    request$.subscribe({
      next: (blob) => {
        this.downloadingGerceklesenExcel.set(null);
        dosyayiKaydet(blob, `${proje.projeNo}_GerceklesenCekiListesi.xlsx`);
        this.toastService.success('Gerçekleşen çeki listesi Excel raporu indirildi.');
      },
      error: () => {
        this.downloadingGerceklesenExcel.set(null);
        this.toastService.error('Excel raporu indirilirken bir hata oluştu.');
      }
    });
  }

  openUploadModal(mode: 'normal' | 'revizyon' | 'yedek' = 'normal') {
    this.uploadMode.set(mode);
    this.showUploadModal.set(true);
    this.selectedFile.set(null);
    this.revisionPreview.set(null);
    this.revisionServerIssues.set([]);
    this.uploadResult.set(null);
  }

  closeUploadModal() {
    this.showUploadModal.set(false);
    this.selectedFile.set(null);
    this.revisionPreview.set(null);
    this.revisionServerIssues.set([]);
    this.uploadResult.set(null);
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectUploadFile(input.files[0]);
      input.value = '';
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.dragOver.set(true);
  }

  onDragLeave() {
    this.dragOver.set(false);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.dragOver.set(false);
    if (event.dataTransfer?.files.length) {
      this.selectUploadFile(event.dataTransfer.files[0]);
    }
  }

  private selectUploadFile(file: File) {
    const fileName = file.name.toLocaleLowerCase('tr-TR');
    const isXlsx = fileName.endsWith('.xlsx');

    if (!isXlsx) {
      this.selectedFile.set(null);
      this.uploadResult.set({
        success: false,
        message: this.isYedekUpload()
          ? 'Yedek çekisi için yalnızca .xlsx dosyaları kabul edilir.'
          : 'Sadece .xlsx dosyaları kabul edilir.'
      });
      return;
    }

    this.selectedFile.set(file);
    this.revisionPreview.set(null);
    this.revisionServerIssues.set([]);
    this.uploadResult.set(null);
  }

  previewRevision() {
    const file = this.selectedFile();
    if (!file) return;

    this.previewingRevision.set(true);
    this.uploadResult.set(null);
    this.revisionPreview.set(null);
    this.revisionServerIssues.set([]);

    this.projeService.cekiRevizyonOnizle(file).subscribe({
      next: (res) => {
        this.previewingRevision.set(false);
        if (res.isSuccess && res.value) {
          this.revisionPreview.set(res.value);
          if (res.value.uygulanabilirMi) {
            this.toastService.success(res.value.mesaj);
          } else {
            this.uploadResult.set({ success: false, message: res.value.mesaj });
            this.toastService.error(res.value.mesaj);
          }
        } else {
          this.revisionServerIssues.set(res.issues ?? []);
          this.uploadResult.set({ success: false, message: res.error ?? 'Revizyon ön izleme başarısız.' });
          this.toastService.error(res.error ?? 'Revizyon ön izleme başarısız. Lütfen dosyayı kontrol edin.');
        }
      },
      error: () => {
        this.previewingRevision.set(false);
        this.uploadResult.set({ success: false, message: 'Revizyon ön izleme sırasında hata oluştu.' });
        this.toastService.error('Sunucuyla bağlantı kurulurken hata oluştu.');
      },
    });
  }

  uploadCeki() {
    const file = this.selectedFile();
    if (!file) return;

    const mode = this.uploadMode();

    if (mode === 'revizyon' && !this.revisionPreview()) {
      this.previewRevision();
      return;
    }

    if (mode === 'revizyon' && this.revisionPreview() && !this.revisionPreview()!.uygulanabilirMi) {
      this.uploadResult.set({ success: false, message: 'Ön izlemede engelli satırlar var. Revizyon uygulanamaz.' });
      return;
    }

    this.uploading.set(true);
    this.uploadResult.set(null);
    this.revisionServerIssues.set([]);

    if (mode === 'revizyon') {
      this.uploadRevisionCeki(file);
      return;
    }

    const request$ = mode === 'yedek'
      ? this.projeService.yedekCekiYukle(file)
      : this.projeService.cekiYukle(file);

    request$.subscribe({
      next: (res) => {
        this.uploading.set(false);
        if (res.isSuccess && res.value) {
          const value = res.value;
          if (mode === 'yedek') {
            this.toastService.success(
              value.mesaj ?? `Yedek çekisi başarıyla yüklendi. ${value.satirSayisi} satır tek sandıkta oluşturuldu.`
            );
          } else {
            this.toastService.success(value.mesaj ?? `Çeki başarıyla yüklendi! ${value.satirSayisi} satır, ${value.sandikSayisi} sandık oluşturuldu.`);
          }
          this.closeUploadModal();
          this.loadProjeler(); // Listeyi yenile
        } else {
          this.uploadResult.set({ success: false, message: res.error ?? 'Yükleme başarısız.' });
          this.toastService.error(res.error ?? 'Yükleme başarısız. Lütfen dosyayı kontrol edin.');
        }
      },
      error: () => {
        this.uploading.set(false);
        this.uploadResult.set({ success: false, message: 'Yükleme sırasında hata oluştu.' });
        this.toastService.error('Sunucuyla bağlantı kurulurken hata oluştu.');
      },
    });
  }

  private uploadRevisionCeki(file: File): void {
    this.projeService.cekiRevizyonYukle(file).subscribe({
      next: (res) => {
        this.uploading.set(false);

        if (!res.isSuccess || !res.value) {
          this.revisionServerIssues.set(res.issues ?? []);
          const message = res.error ?? 'Revizyon yükleme başarısız.';
          this.uploadResult.set({ success: false, message });
          this.toastService.error(message);
          return;
        }

        const response = res.value;
        if (this.isRevisionApprovalQueueResponse(response)) {
          if (response.value.sonucTipi !== 'OnayBekliyor') {
            this.showUnexpectedRevisionResponse();
            return;
          }

          this.toastService.success(
            response.message || response.value.mesaj || 'Revizyon talebi başarıyla onaya gönderildi.'
          );
          this.closeUploadModal();
          return;
        }

        if (response.sonucTipi !== 'Uygulandi') {
          this.showUnexpectedRevisionResponse();
          return;
        }

        this.toastService.success(
          response.mesaj ||
          `Revizyon doğrudan uygulandı. Eklenen: ${response.eklenenSatirSayisi}, Güncellenen: ${response.guncellenenSatirSayisi}, Silinen: ${response.silinenSatirSayisi}.`
        );
        this.closeUploadModal();
        this.loadProjeler();
      },
      error: () => {
        this.uploading.set(false);
        this.uploadResult.set({ success: false, message: 'Revizyon yükleme sırasında hata oluştu.' });
        this.toastService.error('Sunucuyla bağlantı kurulurken hata oluştu.');
      },
    });
  }

  private isRevisionApprovalQueueResponse(
    response: CekiRevizyonYuklemeYaniti
  ): response is CekiRevizyonOnayKuyruguYaniti {
    return 'statusCode' in response && response.statusCode === 202 && !!response.value;
  }

  private showUnexpectedRevisionResponse(): void {
    const message = 'Revizyon işleminin sonucu doğrulanamadı. Lütfen sayfayı yenileyip işlem geçmişini kontrol edin.';
    this.uploadResult.set({ success: false, message });
    this.toastService.error(message);
  }

  removeFile() {
    this.selectedFile.set(null);
    this.revisionPreview.set(null);
    this.revisionServerIssues.set([]);
    this.uploadResult.set(null);
  }

  private buildRevisionIssueContext(issue: CekiRevizyonSorunu): string[] {
    const context: string[] = [];
    if (issue.excelSatirNo != null) context.push(`Excel satırı ${issue.excelSatirNo}`);
    if (issue.siraNo != null) context.push(`Sıra no ${issue.siraNo}`);
    if (issue.barkodNo?.trim()) context.push(`Barkod ${issue.barkodNo.trim()}`);
    if (issue.pozNo?.trim()) context.push(`Poz ${issue.pozNo.trim()}`);
    if (issue.sandikNo?.trim()) context.push(`Sandık ${issue.sandikNo.trim()}`);
    if (issue.checkKodu?.trim()) context.push(`CHECK ${issue.checkKodu.trim()}`);
    return context;
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  // ===== Fotoğraf ve Gerçekleşen Çeki Bağlantıları =====
  // Tek izin kodu, proje tipinden bağımsız: R bağlantıları görür ve açar, W ekler/düzenler/siler. Sunucu bağlantıları
  // listede yalnız R izniyle döndürür; ön yüz kontrolü yalnız görünürlük içindir. Tek bağlantı satırdaki çipten
  // doğrudan, birden çok bağlantı çipin açtığı listeden yeni sekmede açılır. Pencerede iki sekme vardır (Fotoğraflar,
  // Gerçekleşen Çeki); eklenen bağlantı açık sekmenin türünü alır, düzenlemede tür değişmez.

  readonly ProjeBaglantiTuru = ProjeBaglantiTuru;
  readonly BAGLANTI_TURLERI = [ProjeBaglantiTuru.Fotograf, ProjeBaglantiTuru.GerceklesenCeki] as const;
  readonly baglantiTuru = baglantiTuru;
  readonly baglantiTuruAdi = baglantiTuruAdi;
  readonly baglantiCipiAdi = baglantiCipiAdi;
  readonly fotografSitesi = fotografSitesi;
  readonly fotografBaglantisiEtiketi = fotografBaglantisiEtiketi;
  readonly FOTOGRAF_BAGLANTISI_SAYISI_EN_FAZLA = FOTOGRAF_BAGLANTISI_SAYISI_EN_FAZLA;
  readonly FOTOGRAF_ACIKLAMASI_EN_FAZLA = FOTOGRAF_ACIKLAMASI_EN_FAZLA;
  /** Çok bağlantılı satırın açılır listesi (sabit konumlu; belge tıklamasıyla kapanır). */
  readonly fotografMenu = signal<{ proje: ProjeDto; top: number; left: number; yukari: boolean } | null>(null);
  /** Bağlantıları yönetme penceresinin projesi. */
  readonly fotografProje = signal<ProjeDto | null>(null);
  /** Pencerenin açık sekmesi; yeni bağlantı bu türle eklenir. */
  readonly fotografSekme = signal<ProjeBaglantiTuru>(ProjeBaglantiTuru.Fotograf);
  /** Formda düzenlenen bağlantı; boşsa form yeni bağlantı ekler. */
  readonly fotografDuzenlenen = signal<ProjeFotografBaglantisi | null>(null);
  readonly fotografTaslak = signal('');
  readonly fotografAciklamaTaslak = signal('');
  readonly fotografKaydediliyor = signal(false);
  readonly fotografPenceresiBaglantilari = computed(() =>
    (this.fotografProje()?.fotografBaglantilari ?? []).filter(b => baglantiTuru(b) === this.fotografSekme()));
  /** Yazılan adresin kaydedilecek hali (şemasızsa https eklenmiş). */
  readonly fotografOnizleme = computed(() => fotografBaglantisiNormalize(this.fotografTaslak()));
  /** Boş adres uyarı göstermez (Kaydet kapalıdır); dolu ve geçersiz adres uyarı gösterir. */
  readonly fotografTaslakGecerli = computed(() => !this.fotografTaslak().trim() || fotografBaglantisiGecerli(this.fotografTaslak()));
  readonly fotografSinirda = computed(() =>
    !this.fotografDuzenlenen() && this.fotografPenceresiBaglantilari().length >= FOTOGRAF_BAGLANTISI_SAYISI_EN_FAZLA);
  readonly fotografKaydedilebilir = computed(() =>
    !this.fotografKaydediliyor() && !this.fotografSinirda() &&
    fotografBaglantisiGecerli(this.fotografTaslak()) && fotografAciklamasiGecerli(this.fotografAciklamaTaslak()));

  fotografBaglantisiGorunur(): boolean {
    return this.permissions.hasAccess(YETKI.PROJE.FOTOGRAF_BAGLANTISI);
  }

  fotografBaglantisiDuzenlenebilir(): boolean {
    return this.permissions.canWrite(YETKI.PROJE.FOTOGRAF_BAGLANTISI);
  }

  /** Satır çipi ve açılır liste için: fotoğraflar önce, sonra gerçekleşen çeki. */
  fotografBaglantilari(proje: ProjeDto): ProjeFotografBaglantisi[] {
    return baglantilariSirala(proje.fotografBaglantilari ?? []);
  }

  /** Penceredeki sekme başlığının sayacı. */
  fotografSekmeSayisi(tur: ProjeBaglantiTuru): number {
    return (this.fotografProje()?.fotografBaglantilari ?? []).filter(b => baglantiTuru(b) === tur).length;
  }

  fotografSekmeSec(tur: ProjeBaglantiTuru): void {
    if (this.fotografKaydediliyor() || this.fotografSekme() === tur) return;
    this.fotografSekme.set(tur);
    this.fotografFormunuSifirla();
  }

  fotografMenusunuAc(event: MouseEvent, proje: ProjeDto): void {
    event.stopPropagation();
    if (this.fotografMenu()?.proje.id === proje.id) {
      this.closeReportMenu();
      return;
    }
    this.closeReportMenu();

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const genislik = 280;
    const ogeSayisi = this.fotografBaglantilari(proje).length + (this.fotografBaglantisiDuzenlenebilir() ? 1 : 0);
    const yukseklik = Math.min(ogeSayisi * 48 + 14, 360);
    const bosluk = 8;
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - genislik - 8);
    const yukari = rect.bottom + bosluk + yukseklik > window.innerHeight - 8;
    const top = yukari ? Math.max(8, rect.top - yukseklik - bosluk) : rect.bottom + bosluk;
    this.fotografMenu.set({ proje, top, left, yukari });
  }

  fotografPenceresiniAc(proje: ProjeDto, tur = ProjeBaglantiTuru.Fotograf): void {
    if (!this.fotografBaglantisiDuzenlenebilir()) return;
    this.fotografMenu.set(null);
    this.fotografProje.set(proje);
    this.fotografSekme.set(tur);
    this.fotografFormunuSifirla();
  }

  fotografPenceresiniKapat(): void {
    if (this.fotografKaydediliyor()) return;
    this.fotografProje.set(null);
    this.fotografFormunuSifirla();
  }

  fotografBaglantisiniDuzenle(baglanti: ProjeFotografBaglantisi): void {
    if (this.fotografKaydediliyor()) return;
    this.fotografDuzenlenen.set(baglanti);
    this.fotografTaslak.set(baglanti.adres);
    this.fotografAciklamaTaslak.set(baglanti.aciklama ?? '');
  }

  fotografFormunuSifirla(): void {
    this.fotografDuzenlenen.set(null);
    this.fotografTaslak.set('');
    this.fotografAciklamaTaslak.set('');
  }

  fotografBaglantisiKaydet(): void {
    const proje = this.fotografProje();
    const adres = this.fotografOnizleme();
    if (!proje || !adres || !this.fotografKaydedilebilir()) return;
    const istek = { adres, aciklama: this.fotografAciklamaTaslak().trim() || null };
    const duzenlenen = this.fotografDuzenlenen();
    const ad = this.fotografSekme() === ProjeBaglantiTuru.GerceklesenCeki ? 'Gerçekleşen çeki bağlantısı' : 'Fotoğraf bağlantısı';
    this.fotografIstegiGonder(
      duzenlenen
        ? this.projeService.fotografBaglantisiGuncelle(proje.id, duzenlenen.id, istek)
        : this.projeService.fotografBaglantisiEkle(proje.id, { ...istek, tur: this.fotografSekme() }),
      duzenlenen ? `${ad} güncellendi.` : `${ad} eklendi.`);
  }

  async fotografBaglantisiSil(baglanti: ProjeFotografBaglantisi): Promise<void> {
    const proje = this.fotografProje();
    if (!proje || this.fotografKaydediliyor()) return;
    const cekiMi = baglantiTuru(baglanti) === ProjeBaglantiTuru.GerceklesenCeki;
    const onay = await this.confirmService.ask({
      title: cekiMi ? 'Gerçekleşen Çeki Bağlantısını Sil' : 'Fotoğraf Bağlantısını Sil',
      message: `${proje.projeNo} projesinin "${fotografBaglantisiEtiketi(baglanti)}" bağlantısı silinecek. ` +
        `${cekiMi ? 'Çeki listesi' : 'Fotoğraflar'} sitede kalır; yalnız bağlantı silinir.`,
      confirmText: 'Bağlantıyı Sil',
      cancelText: 'Vazgeç',
      type: 'warning'
    });
    if (!onay) return;
    this.fotografIstegiGonder(this.projeService.fotografBaglantisiSil(proje.id, baglanti.id),
      cekiMi ? 'Gerçekleşen çeki bağlantısı silindi.' : 'Fotoğraf bağlantısı silindi.');
  }

  private fotografIstegiGonder(istek: Observable<ApiResult<ProjeFotografBaglantisi[]>>, basariMesaji: string): void {
    const proje = this.fotografProje();
    if (!proje || !this.fotografBaglantisiDuzenlenebilir() || this.fotografKaydediliyor()) return;
    this.fotografKaydediliyor.set(true);
    istek.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.fotografKaydediliyor.set(false);
        if (!res.isSuccess) {
          this.toastService.error(res.error || 'Bağlantı kaydedilemedi.');
          return;
        }
        // Liste yeniden yüklenmeden satır ve pencere güncellenir (sayfa ve kaydırma yerinde kalır).
        const baglantilar = res.value ?? [];
        this.projeler.update(liste => liste.map(p => p.id === proje.id ? { ...p, fotografBaglantilari: baglantilar } : p));
        this.fotografProje.set({ ...proje, fotografBaglantilari: baglantilar });
        this.fotografFormunuSifirla();
        this.toastService.success(basariMesaji);
      },
      error: () => {
        this.fotografKaydediliyor.set(false);
        this.toastService.error('Sunucu hatası oluştu.');
      }
    });
  }

  // ===== Sevk Tarihi Güncelle =====
  
  openSevkTarihiModal(proje: ProjeDto) {
    if (!this.canUpdatePlanlananSevkTarihiProje(proje)) return;

    this.selectedProjeId.set(proje.id);
    this.sevkTarihiProje.set(proje);
    this.guncelSevkTarihi.set(proje.planlananSevkTarihi ? this.toDateTimeLocalInputValue(proje.planlananSevkTarihi) : '');
    this.showSevkTarihiModal.set(true);
  }

  closeSevkTarihiModal() {
    this.showSevkTarihiModal.set(false);
    this.selectedProjeId.set(0);
    this.sevkTarihiProje.set(null);
    this.guncelSevkTarihi.set('');
  }

  /** Açık planlanan sevk tarihi penceresindeki projenin gerçek tipine göre. */
  private sevkTarihiYazilabilir(): boolean {
    const proje = this.sevkTarihiProje();
    return !!proje && this.canUpdatePlanlananSevkTarihiProje(proje);
  }

  kaydetSevkTarihi() {
    if (!this.sevkTarihiYazilabilir() || this.sevkTarihiSaving()) return;

    const tarih = this.toApiDateTime(this.guncelSevkTarihi());

    if (!tarih || !this.planlananSevkTarihiGecerli()) {
      this.toastService.error('Lütfen geçerli bir planlanan sevk tarihi ve saati seçiniz.');
      return;
    }

    this.planlananSevkTarihiGuncelle(tarih, 'Planlanan sevk tarihi güncellendi.');
  }

  async planlananSevkTarihiKaldir(): Promise<void> {
    if (
      !this.sevkTarihiYazilabilir()
      || !this.sevkTarihiProje()?.planlananSevkTarihi
      || this.sevkTarihiSaving()
    ) return;

    const onay = await this.confirmService.ask({
      title: 'Planlanan Sevk Tarihini Kaldır',
      message: 'Bu projedeki kayıtlı planlanan sevk tarihi kaldırılacaktır.',
      confirmText: 'Tarihi Kaldır',
      cancelText: 'Vazgeç',
      type: 'warning'
    });

    if (!onay) return;

    this.planlananSevkTarihiGuncelle(null, 'Planlanan sevk tarihi kaldırıldı.');
  }

  private planlananSevkTarihiGuncelle(tarih: string | null, basariMesaji: string): void {
    const projeId = this.selectedProjeId();
    if (!this.sevkTarihiYazilabilir() || projeId <= 0 || this.sevkTarihiSaving()) return;

    this.sevkTarihiSaving.set(true);

    this.projeService.sevkTarihiGuncelle(
      projeId,
      tarih
    ).subscribe({
      next: (res) => {
        this.sevkTarihiSaving.set(false);
        if (res.isSuccess) {
          this.toastService.success(basariMesaji);
          this.closeSevkTarihiModal();
          this.loadProjeler();
        } else {
          this.toastService.error(res.error || 'İşlem başarısız.');
        }
      },
      error: () => {
        this.sevkTarihiSaving.set(false);
        this.toastService.error('Sunucu hatası oluştu.');
      }
    });
  }

  // ===== Proje Oluştur Modal (Saha/Yedek) =====

  openProjeOlusturModal() {
    this.yeniProjeForm.set({ projeNo: '', musteri: '', lokasyon: '' });
    this.showProjeOlusturModal.set(true);
  }

  closeProjeOlusturModal() {
    this.showProjeOlusturModal.set(false);
  }

  submitProjeOlustur() {
    const form = this.yeniProjeForm();
    if (!form.projeNo.trim()) {
      this.toastService.error('Proje No zorunludur.');
      return;
    }

    this.creatingProje.set(true);
    const tipId = this.isSahaYonetimi() ? 2 : 3;

    this.projeService.projeOlustur({
      projeNo: form.projeNo,
      musteri: form.musteri || '-',
      projeTipiId: tipId,
      sorumluKisi: '',
      lokasyon: form.lokasyon || '-'
    }).subscribe({
      next: (res) => {
        this.creatingProje.set(false);
        if (res.isSuccess) {
          const yeniProjeId = res.value?.id;
          this.toastService.success('Proje başarıyla oluşturuldu.');
          this.closeProjeOlusturModal();
          if (yeniProjeId) {
            this.router.navigate([this.routePrefix, yeniProjeId]);
          } else {
            this.loadProjeler();
          }
        } else {
          this.toastService.error(res.error || 'Proje oluşturulamadı.');
        }
      },
      error: () => {
        this.creatingProje.set(false);
        this.toastService.error('Sunucu hatası oluştu.');
      }
    });
  }

  openSahaAktarimModal(proje: ProjeDto) {
    if (!this.canManageSahaAktarimGeriAl()) return;

    this.sahaAktarimProje.set(proje);
    this.sahaAktarimlari.set([]);
    this.sahaAktarimLoading.set(false);
    this.sahaAktarimGeriAlSaving.set(null);
    this.sahaSandikAktarimGeriAlSaving.set(null);
    this.showSahaAktarimModal.set(true);
    this.loadSahaAktarimlari(proje.id);
  }

  closeSahaAktarimModal() {
    if (this.sahaAktarimIslemVar()) return;

    this.showSahaAktarimModal.set(false);
    this.sahaAktarimProje.set(null);
    this.sahaAktarimlari.set([]);
    this.sahaTasimaSeciliIds.set([]);
    this.sahaAktarimLoading.set(false);
  }

  private loadSahaAktarimlari(projeId: number) {
    this.sahaTasimaSeciliIds.set([]);
    this.sahaAktarimLoading.set(true);
    this.projeService.getSahaAktarimlari(projeId).subscribe({
      next: (res) => {
        this.sahaAktarimLoading.set(false);
        if (res.isSuccess && res.value) {
          this.sahaAktarimlari.set(res.value);
        } else {
          this.toastService.error(res.error || 'Saha aktarımları yüklenemedi.');
        }
      },
      error: () => {
        this.sahaAktarimLoading.set(false);
        this.toastService.error('Saha aktarımları yüklenirken sunucu hatası oluştu.');
      }
    });
  }

  formatAktarimMiktar(value: number): string {
    if (value == null) return '-';
    return Number.isInteger(value) ? value.toString() : value.toString().replace(/0+$/, '').replace(/\.$/, '');
  }

  formatAktarimBirim(value?: string | null): string {
    const normalized = (value ?? '').trim();
    return !normalized || normalized === '?' ? 'Adet' : normalized;
  }

  formatAktarimGrupMiktar(grup: SahaAktarimGrubu): string {
    const birimler = new Map<string, number>();

    for (const aktarim of grup.aktarimlar) {
      const birim = this.formatAktarimBirim(aktarim.birim);
      birimler.set(birim, (birimler.get(birim) ?? 0) + (Number(aktarim.miktar) || 0));
    }

    return Array.from(birimler.entries())
      .map(([birim, miktar]) => `${this.formatAktarimMiktar(miktar)} ${birim}`)
      .join(' + ');
  }

  /** Otomatik sahaya aktarım: yalnız sevk görmüş (tam/kısmi) normal projede, sahaya aktarma yazma izniyle. */
  otomatikSahaAktarimYapilabilir(p: ProjeDto): boolean {
    if (this.isSandikMode() || !this.canUseEksikTamamlama()) return false;
    if (p.projeTipiId !== ProjeTipi.Normal) return false;
    return p.fizikselSevkEdilmisSandikVarMi ||
      p.durumId === ProjeDurum.SevkEdildi ||
      p.durumId === ProjeDurum.EksikSevkEdildi;
  }

  otomatikSahaAktarildi(sonuc: OtomatikSahaAktarimSonucDto): void {
    this.otomatikSahaAktarimProje.set(null);
    this.loadProjeler();
    void this.router.navigate(['/saha-yonetimi', sonuc.sahaProjeId]);
  }

  async sahaAktarimIsleminiGeriAl(islem: SahaAktarimIslemi): Promise<void> {
    const proje = this.sahaAktarimProje();
    if (!proje || !this.canWriteSahaAktarimGeriAl() || !islem.geriAlinabilirMi || this.sahaAktarimIslemVar()) return;

    const onay = await this.confirmService.ask({
      title: this.ts.translate('SAHA_OTOMATIK.UNDO_TITLE'),
      message: `<strong>${duzMetin(islem.aciklama)}</strong> (${islem.satirSayisi})<br>${duzMetin(this.ts.translate('SAHA_OTOMATIK.UNDO_CONFIRM'))}`,
      confirmText: this.ts.translate('SAHA_OTOMATIK.UNDO_TRANSFER'),
      cancelText: this.ts.translate('SAHA_OTOMATIK.CANCEL'),
      type: 'warning'
    });
    if (!onay) return;

    this.sahaAktarimIslemiGeriAlSaving.set(islem.sahaAktarimId);
    this.projeService.sahaAktarimiGeriAl(islem.sahaAktarimId, 'Saha Yönetimi üzerinden aktarımın tamamı geri alındı.').subscribe({
      next: (res) => {
        this.sahaAktarimIslemiGeriAlSaving.set(null);
        if (res.isSuccess) {
          this.toastService.success(`${this.ts.translate('SAHA_OTOMATIK.UNDO_DONE')}: ${res.value?.geriAlinanSatirSayisi ?? islem.satirSayisi}`);
          this.loadSahaAktarimlari(proje.id);
          this.loadProjeler();
        } else {
          // 409 gövdesi engelleri listeler; hiçbir kayıt değişmemiştir.
          const issues = (res as { issues?: unknown }).issues;
          const ayrinti = Array.isArray(issues) && issues.length > 0 ? ` ${issues.map(String).join(' ')}` : '';
          this.toastService.error((res.error || this.ts.translate('SAHA_OTOMATIK.UNDO_DISABLED')) + ayrinti, 8000);
        }
      },
      error: () => {
        this.sahaAktarimIslemiGeriAlSaving.set(null);
        this.toastService.error(this.ts.translate('SAHA_OTOMATIK.UNDO_SERVER_ERROR'));
      }
    });
  }

  /** Aktarımlar penceresindeki tek satırı başka saha projesine taşır. */
  sahayaTasiSatir(aktarim: SahaAktarimDto): void {
    const proje = this.sahaAktarimProje();
    if (!proje || !this.canUseEksikTamamlama() || this.sahaAktarimIslemVar()) return;
    this.sahaTasimaSecimi.set({
      kaynak: { id: proje.id, projeNo: proje.projeNo },
      satirIds: [aktarim.sahaCekiSatiriId],
      sandikId: null,
      baslik: `#${aktarim.siraNo} ${aktarim.aciklama || aktarim.barkodNo}`,
    });
  }

  sahaTasimaSeciliMi(aktarim: SahaAktarimDto): boolean {
    return this.sahaTasimaSeciliIds().includes(aktarim.sahaCekiSatiriId);
  }

  sahaTasimaSec(aktarim: SahaAktarimDto, secili: boolean): void {
    if (aktarim.sevkEdildiMi) return;
    this.secimiGuncelle([aktarim.sahaCekiSatiriId], secili);
  }

  sahaTasimaTumunuSec(secili: boolean): void {
    this.sahaTasimaSeciliIds.set(secili ? [...this.sahaTasimaSecilebilirIds()] : []);
  }

  /** Sandığın taşınabilir (sevk edilmemiş) satırlarının hepsi seçili mi; seçilebilir satırı yoksa false. */
  sahaTasimaGrupSecili(grup: SahaAktarimGrubu): boolean {
    const ids = grup.aktarimlar.filter(a => !a.sevkEdildiMi).map(a => a.sahaCekiSatiriId);
    const secili = new Set(this.sahaTasimaSeciliIds());
    return ids.length > 0 && ids.every(id => secili.has(id));
  }

  sahaTasimaGrupSecilebilir(grup: SahaAktarimGrubu): boolean {
    return grup.aktarimlar.some(a => !a.sevkEdildiMi);
  }

  sahaTasimaGrubuSec(grup: SahaAktarimGrubu, secili: boolean): void {
    this.secimiGuncelle(grup.aktarimlar.filter(a => !a.sevkEdildiMi).map(a => a.sahaCekiSatiriId), secili);
  }

  /** Seçilen satırları tek taşıma penceresinde başka saha projesine taşır (farklı kaynak sandıklardan olabilir). */
  sahayaTasiSecilenler(): void {
    const proje = this.sahaAktarimProje();
    const secilebilir = new Set(this.sahaTasimaSecilebilirIds());
    const satirIds = this.sahaTasimaSeciliIds().filter(id => secilebilir.has(id));
    if (!proje || !this.canUseEksikTamamlama() || satirIds.length === 0 || this.sahaAktarimIslemVar()) return;
    this.sahaTasimaSecimi.set({
      kaynak: { id: proje.id, projeNo: proje.projeNo },
      satirIds,
      sandikId: null,
      baslik: `${this.ts.translate('SAHA_TASIMA.SELECTED_TITLE')}: ${satirIds.length}`,
    });
  }

  private secimiGuncelle(ids: number[], secili: boolean): void {
    const kume = new Set(this.sahaTasimaSeciliIds());
    for (const id of ids) {
      if (secili) kume.add(id);
      else kume.delete(id);
    }
    this.sahaTasimaSeciliIds.set([...kume]);
  }

  /** Saha sandığının bütün içeriğini (manuel içerikler dahil) başka saha projesine taşır. */
  sahayaTasiSandik(grup: SahaAktarimGrubu): void {
    const proje = this.sahaAktarimProje();
    if (!proje || !this.canUseEksikTamamlama() || grup.sahaSandikId === null || this.sahaAktarimIslemVar()) return;
    this.sahaTasimaSecimi.set({
      kaynak: { id: proje.id, projeNo: proje.projeNo },
      satirIds: [],
      sandikId: grup.sahaSandikId,
      baslik: `${this.ts.translate('SAHA_TASIMA.CRATE')} ${grup.sahaSandikNo}`,
    });
  }

  sahaTasindi(_sonuc: SahadanSahayaTasimaSonucDto): void {
    const proje = this.sahaAktarimProje();
    this.sahaTasimaSecimi.set(null);
    if (proje) this.loadSahaAktarimlari(proje.id);
    this.loadProjeler();
  }

  async sahaAktarimGeriAl(aktarim: SahaAktarimDto): Promise<void> {
    const proje = this.sahaAktarimProje();
    if (!proje || !this.canWriteSahaAktarimGeriAl() || !aktarim.geriAlinabilirMi || this.sahaAktarimIslemVar()) return;

    const onay = await this.confirmService.ask({
      title: 'Saha Aktarımını Geri Al',
      message: `<strong>${duzMetin(aktarim.kaynakProjeNo)}</strong> kaynak projesindeki <strong>#${aktarim.siraNo}</strong> satırının <strong>${this.formatAktarimMiktar(aktarim.miktar)} ${duzMetin(this.formatAktarimBirim(aktarim.birim))}</strong> saha aktarımı geri alınacak.<br>Ürün normal proje eksik takibine geri döner.`,
      confirmText: 'Geri Al',
      cancelText: 'Vazgeç',
      type: 'warning'
    });

    if (!onay) return;

    this.sahaAktarimGeriAlSaving.set(aktarim.sahaCekiSatiriId);
    this.projeService.sahaAktarimGeriAl(aktarim.sahaCekiSatiriId, 'Saha Yönetimi üzerinden aktarım geri alındı.').subscribe({
      next: (res) => {
        this.sahaAktarimGeriAlSaving.set(null);
        if (res.isSuccess) {
          this.toastService.success('Saha aktarımı geri alındı.');
          this.loadSahaAktarimlari(proje.id);
          this.loadProjeler();
        } else {
          this.toastService.error(res.error || 'Saha aktarımı geri alınamadı.');
        }
      },
      error: () => {
        this.sahaAktarimGeriAlSaving.set(null);
        this.toastService.error('Saha aktarımı geri alınırken sunucu hatası oluştu.');
      }
    });
  }

  async sahaSandikAktarimlariniGeriAl(grup: SahaAktarimGrubu): Promise<void> {
    const proje = this.sahaAktarimProje();
    if (
      !proje ||
      !this.canWriteSahaAktarimGeriAl() ||
      !grup.geriAlinabilirMi ||
      grup.sahaSandikId === null ||
      this.sahaAktarimIslemVar()
    ) {
      return;
    }

    const onay = await this.confirmService.ask({
      title: 'Sandıktaki Tüm Aktarımları Geri Al',
      message: `<strong>Saha Sandığı ${duzMetin(grup.sahaSandikNo)}</strong> içindeki <strong>${grup.aktarimlar.length} aktarım satırı</strong> (${duzMetin(this.formatAktarimGrupMiktar(grup))}) tek işlemde geri alınacak.<br>Ürünler kaynak normal projelerinin eksik takibine geri döner. İşlem sırasında herhangi bir satır geri alınamazsa hiçbir kayıt değiştirilmez.`,
      confirmText: 'Tümünü Geri Al',
      cancelText: 'Vazgeç',
      type: 'warning'
    });

    if (!onay) return;

    this.sahaSandikAktarimGeriAlSaving.set(grup.sahaSandikId);
    this.projeService.sahaSandikAktarimlariGeriAl(
      grup.sahaSandikId,
      `Saha Yönetimi üzerinden Saha Sandığı ${grup.sahaSandikNo} içindeki tüm aktarımlar geri alındı.`
    ).subscribe({
      next: (res) => {
        this.sahaSandikAktarimGeriAlSaving.set(null);
        if (res.isSuccess) {
          const sonuc = res.value;
          const mesaj = sonuc
            ? `${sonuc.geriAlinanSatirSayisi} aktarım satırı (${this.formatAktarimGrupMiktar(grup)}) geri alındı${sonuc.sandikBosaldiMi ? '; saha sandığı boşaldı.' : '.'}`
            : 'Sandıktaki tüm saha aktarımları geri alındı.';
          this.toastService.success(mesaj);
          this.loadSahaAktarimlari(proje.id);
          this.loadProjeler();
        } else {
          this.toastService.error(res.error || 'Sandıktaki aktarımlar geri alınamadı.');
        }
      },
      error: () => {
        this.sahaSandikAktarimGeriAlSaving.set(null);
        this.toastService.error('Sandıktaki aktarımlar geri alınırken sunucu hatası oluştu.');
      }
    });
  }

  // ===== Proje Sevk (Kilitleme) İşlemleri =====

  openSevkEtModal(proje: ProjeDto) {
    this.sevkEtProje.set(proje);
    this.sevkEtTarihi.set(this.toDateTimeLocalInputValue());
    this.sevkEtAciklama.set('');
    this.sevkEtAracPlaka.set('');
    this.sevkEtSofor.set('');
    this.sevkEtDorsePlaka.set('');
    this.sevkEtSandiklar.set([]);
    this.selectedSevkSandikIds.set([]);
    this.sevkGecmisi.set([]);
    this.sevkGecmisiLoading.set(false);
    this.showSevkEtModal.set(true);
    this.loadSevkEtSandiklar(proje.id);
    this.loadSevkiyatGecmisi(proje.id);
  }

  closeSevkEtModal() {
    this.showSevkEtModal.set(false);
    this.sevkEtProje.set(null);
    this.sevkEtTarihi.set('');
    this.sevkEtAciklama.set('');
    this.sevkEtAracPlaka.set('');
    this.sevkEtSofor.set('');
    this.sevkEtDorsePlaka.set('');
    this.sevkEtSandiklar.set([]);
    this.selectedSevkSandikIds.set([]);
    this.sevkEtSandikLoading.set(false);
    this.sevkGecmisi.set([]);
    this.sevkGecmisiLoading.set(false);
  }

  hasSevkiyatGecmisi(proje: ProjeDto): boolean {
    const durum = proje.durumMetni;
    return !!proje.gerceklesenSevkTarihi ||
      durum === 'SevkEdildi' ||
      durum === 'Sevk Edildi' ||
      durum === 'EksikSevkEdildi' ||
      durum === 'Eksik Sevk Edildi';
  }

  openSevkGecmisiModal(proje: ProjeDto) {
    this.sevkGecmisiProje.set(proje);
    this.sevkGecmisi.set([]);
    this.sevkGecmisiLoading.set(false);
    this.showSevkGecmisiModal.set(true);
    this.loadSevkiyatGecmisi(proje.id);
  }

  closeSevkGecmisiModal() {
    this.showSevkGecmisiModal.set(false);
    this.sevkGecmisiProje.set(null);
    this.sevkGecmisi.set([]);
    this.sevkGecmisiLoading.set(false);
  }

  private loadSevkiyatGecmisi(projeId: number) {
    this.sevkGecmisiLoading.set(true);
    this.projeService.getSevkiyatlar(projeId).subscribe({
      next: (res) => {
        this.sevkGecmisiLoading.set(false);
        if (res.isSuccess && res.value) {
          this.sevkGecmisi.set(this.sortSevkiyatSandiklari(res.value));
        }
      },
      error: () => {
        this.sevkGecmisiLoading.set(false);
        this.toastService.error('Sevkiyat geçmişi yüklenemedi.');
      }
    });
  }

  isSandikSevkEdildi(sandik: SandikDto): boolean {
    return sandikSevkEdildiMi(sandik);
  }

  /** Tekil ve toplu sevkte aynı kural (sandikSevkAdayiMi). */
  isSandikSevkAdayi(sandik: SandikDto): boolean {
    return sandikSevkAdayiMi(sandik);
  }

  isSandikDuzeltmeyeAcik(sandik: SandikDto): boolean {
    return sandik.sevkiyatDuzeltmeAcikMi === true;
  }

  isSandikKilitli(sandik: SandikDto): boolean {
    return this.isSandikSevkEdildi(sandik) && !this.isSandikDuzeltmeyeAcik(sandik);
  }

  private loadSevkEtSandiklar(projeId: number) {
    this.sevkEtSandikLoading.set(true);
    this.sandikService.getSandiklar(projeId).subscribe({
      next: (res) => {
        this.sevkEtSandikLoading.set(false);
        if (res.isSuccess && res.value) {
          const sandiklar = this.sortBySandikNo(res.value);
          this.sevkEtSandiklar.set(sandiklar);
          this.selectedSevkSandikIds.set(sandiklar.filter(s => this.isSandikSevkAdayi(s)).map(s => s.id));
        } else {
          this.toastService.error(res.error || 'Sandıklar yüklenemedi.');
        }
      },
      error: () => {
        this.sevkEtSandikLoading.set(false);
        this.toastService.error('Sandıklar yüklenirken sunucu hatası oluştu.');
      }
    });
  }

  toggleSevkSandik(sandikId: number, checked: boolean) {
    const selected = this.selectedSevkSandikIds();
    if (checked) {
      if (!selected.includes(sandikId)) {
        this.selectedSevkSandikIds.set([...selected, sandikId]);
      }
      return;
    }

    this.selectedSevkSandikIds.set(selected.filter(id => id !== sandikId));
  }

  toggleAllSevkSandiklar(checked: boolean) {
    if (!checked) {
      this.selectedSevkSandikIds.set([]);
      return;
    }

    this.selectedSevkSandikIds.set(this.sevkEtSelectableSandiklar().map(s => s.id));
  }

  sevkEtOnayla() {
    const proje = this.sevkEtProje();
    if (!proje) return;
    if (!this.sevkEtTarihi()) {
      this.toastService.error('Sevk tarihi girilmelidir.');
      return;
    }
    if (!this.sevkEtPlakaOnizleme()) {
      this.toastService.error('Araç plakası girilmelidir.');
      return;
    }
    if (this.selectedSevkSandikIds().length === 0) {
      this.toastService.error('Sevk edilecek en az bir sandık seçilmelidir.');
      return;
    }
    this.sevkEtSaving.set(true);
    const tarih = this.toApiDateTime(this.sevkEtTarihi())!;
    const aciklama = this.sevkEtAciklama().trim() || undefined;
    this.projeService.sevkEt(proje.id, tarih, this.selectedSevkSandikIds(), aciklama, {
      aracPlaka: this.sevkEtAracPlaka().trim(),
      sofor: this.sevkEtSofor().trim() || undefined,
      dorsePlaka: this.sevkEtDorsePlaka().trim() || undefined,
    }).subscribe({
      next: (res) => {
        this.sevkEtSaving.set(false);
        if (res.isSuccess) {
          this.toastService.success('Seçili sandıklar başarıyla sevk edildi.');
          this.closeSevkEtModal();
          this.loadProjeler();
        } else {
          this.toastService.error(res.error || 'İşlem başarısız.');
        }
      },
      error: () => {
        this.sevkEtSaving.set(false);
        this.toastService.error('Sunucu hatası oluştu.');
      }
    });
  }

  openKilitAcModal(proje: ProjeDto) {
    this.kilitAcProje.set(proje);
    this.kilitAcmaTipiId.set(this.canSevkSonrasiDuzeltme()
      ? SevkiyatKilitAcmaTipi.SevkiyatKaydiKorunarakAc
      : SevkiyatKilitAcmaTipi.SevkiyatGeriAlinarakAc);
    this.kilitAcAciklama.set('');
    this.showKilitAcModal.set(true);
  }

  closeKilitAcModal() {
    if (this.kilitAcSaving()) return;
    this.showKilitAcModal.set(false);
    this.kilitAcProje.set(null);
    this.kilitAcAciklama.set('');
  }

  kilidiAcOnayla() {
    const proje = this.kilitAcProje();
    if (!proje) return;

    const aciklama = this.kilitAcAciklama().trim();
    if (!aciklama) {
      this.toastService.error('Kilit açma gerekçesi girilmelidir.');
      return;
    }
    if (this.kilitAcmaTipiId() === SevkiyatKilitAcmaTipi.SevkiyatKaydiKorunarakAc && !this.canSevkSonrasiDuzeltme()) {
      this.toastService.error('Sevkiyat kaydı korunarak açma "Sevk Sonrası Düzeltme" yetkisi ister.');
      return;
    }

    this.kilitAcSaving.set(true);
    this.projeService.kilidiAc(
      proje.id,
      {
        kilitAcmaTipiId: this.kilitAcmaTipiId(),
        projeNo: proje.projeNo,
        aciklama
      }
    ).subscribe({
      next: (res) => {
        this.kilitAcSaving.set(false);
        if (res.isSuccess) {
          const queued = onayaAlindi(res);
          this.toastService.success(queued ? 'Kilit açma talebi onaya gönderildi.' : 'Proje kilidi başarıyla açıldı.');
          this.closeKilitAcModal();
          this.loadProjeler();
        } else {
          this.toastService.error(res.error || 'İşlem başarısız.');
        }
      },
      error: () => {
        this.kilitAcSaving.set(false);
        this.toastService.error('Sunucu hatası oluştu.');
      }
    });
  }

  // ===== Proje Sil =====

  async projeSil(proje: ProjeDto) {
    const onay = await this.confirmService.ask({
      title: 'Projeyi Sil',
      message: `<strong>${duzMetin(proje.projeNo)}</strong> numaralı projeyi silmek istediğinize emin misiniz?<br>
                <span class="text-danger">Bu işlem geri alınamaz! Projeye ait tüm sandıklar, ürünler ve veriler silinecektir.</span>`,
      confirmText: 'Evet, Sil',
      cancelText: 'Vazgeç',
      type: 'danger'
    });

    if (onay) {
      this.projeService.projeSil(proje.id).subscribe({
        next: (res) => {
          if (res.isSuccess) {
            this.toastService.success(`${proje.projeNo} projesi ve tüm verileri başarıyla silindi.`);
            this.seciliProjeyiKaldir(proje.id);
            this.loadProjeler();
          } else {
            this.toastService.error(res.error || 'Proje silinemedi.');
          }
        },
        error: () => this.toastService.error('Sunucu hatası oluştu.')
      });
    }
  }
}

