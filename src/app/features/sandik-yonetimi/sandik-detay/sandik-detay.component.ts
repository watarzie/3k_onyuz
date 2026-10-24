import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { Component, DestroyRef, inject, signal, computed, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslationService } from '../../../core/services/translation.service';
import { SandikService } from '../../../core/services/sandik.service';
import { ProjeService } from '../../../core/services/proje.service';
import { LookupService } from '../../../core/services/lookup.service';
import { ToastService } from '../../../core/services/toast.service';
import { AuthService } from '../../../core/auth/auth.service';
import { PermissionService } from '../../../core/services/permission.service';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { BreadcrumbComponent } from '../../../shared/components/breadcrumb/breadcrumb.component';
import { IslemlerMenusuComponent } from '../../../shared/components/islemler-menusu/islemler-menusu.component';
import {
  EksikUrunForSandikDto, SahaProjeBagDto, SandikDetayDto, SandikDuzeltmeDurumuDto, SandikIcerikDto, SandikDto,
  SandikDurumOlayi, SandikDurumOlayTuru, sandikTarihMetni
} from '../../../shared/models/index';
import { SandikGeriAcComponent } from '../../../shared/components/sandik-geri-ac/sandik-geri-ac.component';
import { Birim, ProjeTipi } from '../../../core/constants/enums';
import { projeTipiBaglami, rotaProjeTipi } from '../../../core/constants/proje-tipi';
import { SandikTopluTasiComponent } from '../sandik-toplu-tasi/sandik-toplu-tasi.component';

import { ConfirmService, duzMetin } from '../../../core/services/confirm.service';
import { firstValueFrom } from 'rxjs';
import { YETKI } from '../../../core/constants/yetki-kodlari';

@Component({
  selector: 'app-sandik-detay',
  standalone: true,
  imports: [TranslatePipe, NgClass, DatePipe, FormsModule, RouterLink, StatusBadgeComponent, BreadcrumbComponent, SandikTopluTasiComponent, IslemlerMenusuComponent, SandikGeriAcComponent],
  templateUrl: './sandik-detay.component.html',
  styleUrl: './sandik-detay.component.scss',
})
export class SandikDetayComponent implements OnInit {
  ts = inject(TranslationService);
  private route = inject(ActivatedRoute);
  private sandikService = inject(SandikService);
  private projeService = inject(ProjeService);
  private toast = inject(ToastService);
  private auth = inject(AuthService);
  private permissionService = inject(PermissionService);
  private confirmService = inject(ConfirmService);
  private lookupService = inject(LookupService);
  private readonly destroyRef = inject(DestroyRef);
  private sandikLoadVersion = 0;
  private hedefLoadVersion = 0;

  projeId = signal(0);
  sandikId = signal(0);
  sandik = signal<SandikDetayDto | null>(null);
  loading = signal(true);

  // Side panel (ürün detay)
  selectedUrun = signal<SandikIcerikDto | null>(null);
  showDetailPanel = signal(false);

  // Manuel ürün ekleme modal
  showUrunEkleModal = signal(false);
  yeniBarkod = signal('');
  yeniAciklama = signal('');
  yeniAdet = signal(1);
  yeniBirim = signal(Birim.Adet);
  yeniNeden = signal('');
  yeniEkAciklama = signal('');
  yeniKaynakProjeNo = signal('');
  urunEklemeSaving = signal(false);

  // Projeden Seç
  eklemeMode = signal<'manuel' | 'projeden'>('manuel');
  normalProjeler = signal<any[]>([]);
  secilenKaynakProjeId = signal(0);
  kaynakUrunler = signal<EksikUrunForSandikDto[]>([]);
  kaynakUrunlerLoading = signal(false);
  secilenKaynakUrunler = signal<Set<number>>(new Set());
  tamamlamaAdetleri = signal<Record<number, number>>({});

  // Özellik Güncelleme Modal State
  showOzellikModal = signal(false);
  ozellikSaving = signal(false);
  ozellikSandikIsmi = signal('');
  /** Sandık tipi güncellemede zorunludur (G2); mevcut tip önceden doldurulur. */
  ozellikTipId = signal<number | null>(null);
  sandikTipleri = signal<{ id: number; deger: string }[]>([]);
  ozellikEn = signal<number | null>(null);
  ozellikBoy = signal<number | null>(null);
  ozellikYukseklik = signal<number | null>(null);
  ozellikNetKg = signal<number | null>(null);
  ozellikGrossKg = signal<number | null>(null);

  // Ürün taşıma modal
  showTasiModal = signal(false);
  tasiUrun = signal<SandikIcerikDto | null>(null);
  hedefSandikId = signal(0);
  tasinanAdet = signal(1);
  tasiIslemAnahtari = signal('');
  tasiSaving = signal(false);
  projeSandiklari = signal<SandikDto[]>([]);
  seciliTasimaIcerikleri = signal<Set<number>>(new Set());
  showTopluTasiModal = signal(false);
  tasinabilirIcerikler = computed(() =>
    (this.sandik()?.icerikler ?? []).filter(item => this.getSandikMiktari(item) > 0));
  topluTasimaUrunleri = computed(() =>
    this.tasinabilirIcerikler().filter(item => this.seciliTasimaIcerikleri().has(item.id)));
  tumTasimaIcerikleriSecili = computed(() => this.tasinabilirIcerikler().length > 0 &&
    this.tasinabilirIcerikler().every(item => this.seciliTasimaIcerikleri().has(item.id)));

  // Konulma güncelleme
  guncelKonulanAdet = signal(0);
  guncelleSaving = signal(false);
  duzeltmeTamamlaSaving = signal(false);

  // Sevk sonrası düzeltme: gerekçe, açılıştan bu yana değişiklikler ve geçmiş
  duzeltmeDurumu = signal<SandikDuzeltmeDurumuDto | null>(null);

  // Açılış/kapanış zaman çizelgesi ve sebep penceresiyle geri açma
  durumGecmisi = signal<SandikDurumOlayi[]>([]);
  geriAcPenceresiAcik = signal(false);
  readonly SandikDurumOlayTuru = SandikDurumOlayTuru;
  readonly sandikTarihMetni = sandikTarihMetni;

  breadcrumb: { label: string; link?: string }[] = [];

  private readonly projeTipi = projeTipiBaglami(rotaProjeTipi(this.route.snapshot));
  /** 3K modülünden açılan sandık detayı başlığını ve geri bağlantısını 3K ekranından alır. */
  private readonly ucKModulunden = this.route.snapshot.data['menuKod'] === this.projeTipi.yetki.ucKModulu;
  readonly isSahaYedek = this.projeTipi.tip !== ProjeTipi.Normal;
  readonly isSahaYonetimi = this.projeTipi.tip === ProjeTipi.Saha;
  pageTitle = computed(() =>
    this.ts.translate(this.ucKModulunden ? this.projeTipi.baslik.ucK : this.projeTipi.baslik.yonetim));
  canWriteSandik = computed(() => {
    const menuKod = this.route.snapshot.data['menuKod'] || YETKI.SANDIK.YONETIMI;
    return this.permissionService.canWrite(menuKod);
  });
  canWriteSevk = computed(() => {
    const menuKod = this.route.snapshot.data['menuKod'] || YETKI.SANDIK.YONETIMI;
    return this.permissionService.canWrite(menuKod);
  });

  private ensureCanWriteSandik(): boolean {
    if (this.canWriteSandik()) return true;

    this.toast.error('Bu işlem için sandık yazma yetkiniz bulunmuyor.');
    return false;
  }

  isSandikSevkEdildi(): boolean {
    const s = this.sandik();
    if (!s) return false;

    return s.sahaUzerindenSevkEdildiMi === true ||
      s.durumId === 4 ||
      s.durumMetni === 'SevkEdildi' ||
      s.durumMetni === 'Sevk Edildi' ||
      s.durumMetni === 'Sevkedildi';
  }

  isSandikDuzeltmeyeAcik(): boolean {
    return this.sandik()?.sevkiyatDuzeltmeAcikMi === true;
  }

  isSandikKilitli(): boolean {
    const s = this.sandik();
    return s?.sahaUzerindenSevkEdildiMi === true ||
      s?.sahayaAktarildiMi === true ||
      (this.isSandikSevkEdildi() && !this.isSandikDuzeltmeyeAcik());
  }

  /** Sevkli sandık yalnız sevk sonrası düzeltmeye açıkken taşımaya katılır (sunucu da aynı kuralı uygular). */
  isSandikTasimayaKilitli(): boolean {
    return this.isSandikKilitli();
  }

  getSandikDurumMetni(): string {
    const s = this.sandik();
    return s?.sahaUzerindenSevkEdildiMi === true ? 'Sevk Edildi' : (s?.durumMetni ?? '');
  }

  async sandikDuzeltmeyiTamamla() {
    const s = this.sandik();
    if (!s || !this.canWriteSevk() || !this.isSandikDuzeltmeyeAcik() || this.duzeltmeTamamlaSaving()) {
      return;
    }

    // Onaydan önce açılıştan bu yana yapılan değişiklikler gösterilir; tamamlanınca düzeltme kaydına yazılır.
    const degisiklikler = this.duzeltmeDurumu()?.degisiklikler ?? [];
    const ozet = degisiklikler.length
      ? `<br><br><strong>Bu düzeltmedeki değişiklikler:</strong><ul class="text-start mb-0">${degisiklikler.map(d => `<li>${duzMetin(d)}</li>`).join('')}</ul>`
      : '';
    const onay = await this.confirmService.ask({
      title: 'Düzeltmeyi Tamamla',
      message: `<strong>${duzMetin(s.sandikNo)}</strong> numaralı sandık tekrar kilitlenecek. Sevkiyat kaydı korunmaya devam edecek ve yeni sevkiyat oluşturulmayacak. Onaylıyor musunuz?${ozet}`,
      confirmText: 'Evet, Tamamla',
      cancelText: 'Vazgeç',
      type: 'success'
    });

    if (!onay) return;

    this.duzeltmeTamamlaSaving.set(true);
    this.sandikService.sandikSevkiyatDuzeltmeTamamla(this.projeId(), s.id).subscribe({
      next: (res) => {
        this.duzeltmeTamamlaSaving.set(false);
        if (res.isSuccess) {
          this.toast.success('Sandık düzeltmesi tamamlandı ve kilitlendi.');
          this.loadSandik();
          this.loadProjeSandiklari();
        } else {
          this.toast.error(res.error ?? 'Düzeltme tamamlanamadı.');
        }
      },
      error: () => {
        this.duzeltmeTamamlaSaving.set(false);
        this.toast.error('Düzeltme tamamlanırken sunucu ile iletişim kurulamadı.');
      }
    });
  }

  private isSandikDtoSevkEdildi(sandik: SandikDto): boolean {
    return sandik.sahaUzerindenSevkEdildiMi === true ||
      sandik.durumId === 4 ||
      sandik.durumMetni === 'SevkEdildi' ||
      sandik.durumMetni === 'Sevk Edildi' ||
      sandik.durumMetni === 'Sevkedildi';
  }

  private isSandikDtoKilitli(sandik: SandikDto): boolean {
    return sandik.sahaUzerindenSevkEdildiMi === true ||
      sandik.sahayaAktarildiMi === true ||
      (this.isSandikDtoSevkEdildi(sandik) && sandik.sevkiyatDuzeltmeAcikMi !== true);
  }

  private isSandikDtoTasimayaKilitli(sandik: SandikDto): boolean {
    return this.isSandikDtoKilitli(sandik);
  }

  /** Ürün aktif olarak sahaya aktarıldıysa takip edildiği saha projeleri; ana projede değiştirilemez. */
  sahaProjeleri(item: SandikIcerikDto): SahaProjeBagDto[] {
    return item.aktifSahaProjeleri ?? [];
  }

  isSahadaTakipte(item: SandikIcerikDto | null): boolean {
    return !!item && this.sahaProjeleri(item).length > 0;
  }

  loadDurumGecmisi() {
    this.sandikService.durumGecmisi(this.sandikId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(res => this.durumGecmisi.set(res.isSuccess && res.value ? res.value : []));
  }

  sandikGeriAcildi() {
    this.geriAcPenceresiAcik.set(false);
    this.loadSandik();
  }

  loadDuzeltmeDurumu() {
    this.sandikService.sevkSonrasiDuzeltmeDurumu(this.sandikId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(res => this.duzeltmeDurumu.set(res.isSuccess && res.value ? res.value : null));
  }

  ngOnInit() {
    const pId = Number(this.route.snapshot.paramMap.get('projeId'));
    const sId = Number(this.route.snapshot.paramMap.get('sandikId'));
    this.projeId.set(pId);
    this.sandikId.set(sId);
    this.loadSandik();
    this.loadProjeSandiklari();
  }

  async sandikHazirla() {
    if (!this.ensureCanWriteSandik()) return;

    const s = this.sandik();
    if (!s) return;
    if (this.isSandikSevkEdildi()) {
      this.toast.error('Bu sandık sevk edildiği için durumu değiştirilemez.');
      return;
    }

    const onay = await this.confirmService.ask({
      title: 'Sandığı Kapat',
      message: `<strong>${duzMetin(s.sandikNo)}</strong> numaralı sandığı kapatmak istediğinize emin misiniz?<br><br>Bu işlem geri alınabilir.`,
      confirmText: 'Evet, Kapat',
      cancelText: 'Vazgeç',
      type: 'info'
    });

    if (onay) {
      this.projeService.sandikKapat(s.id, true).subscribe({
        next: (res) => {
          if (res.isSuccess) {
            this.toast.success('Sandık başarıyla kapatıldı.');
            this.loadSandik();
          } else {
            this.toast.error(res.error || 'İşlem başarısız.');
          }
        },
        error: () => this.toast.error('Sunucu hatası oluştu.')
      });
    }
  }

  loadSandik() {
    const version = ++this.sandikLoadVersion;
    this.loading.set(true);
    this.sandikService.getSandikIcerik(this.sandikId()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe((res) => {
      if (version !== this.sandikLoadVersion) return;
      this.loading.set(false);
      if (res.isSuccess && res.value) {
        this.sandik.set(res.value);
        this.loadDurumGecmisi();
        if (res.value.durumId === 4) {
          this.loadDuzeltmeDurumu();
        } else {
          this.duzeltmeDurumu.set(null);
        }
        const mevcutIdler = new Set(res.value.icerikler.map(item => item.id));
        this.seciliTasimaIcerikleri.update(ids => new Set([...ids].filter(id => mevcutIdler.has(id))));
        
        const ustRota = this.ucKModulunden ? this.projeTipi.ucKRotasi : this.projeTipi.yonetimRotasi;
        this.breadcrumb = [
          { label: this.ts.translate('MENU.DASHBOARD'), link: '/dashboard' },
          { label: this.pageTitle(), link: `${ustRota}/${this.projeId()}` },
          { label: `${res.value.sandikNo}` },
        ];
      }
    });
  }

  loadProjeSandiklari() {
    const version = ++this.hedefLoadVersion;
    this.sandikService.getSandiklar(this.projeId()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe((res) => {
      if (version !== this.hedefLoadVersion) return;
      if (res.isSuccess && res.value) {
        // Mevcut sandığı hariç tut
        this.projeSandiklari.set(res.value.filter(s => s.id !== this.sandikId() && !this.isSandikDtoTasimayaKilitli(s)));
      }
    });
  }

  getTamamlanmaYuzdesi(): number {
    const s = this.sandik();
    if (!s || s.icerikler.length === 0) return 0;
    const tamamlanan = s.icerikler.filter((i) =>
      i.durumMetni === 'TamGeldi' || i.durumMetni === 'Sevk Adeti Tam Geldi' ||
      i.durumMetni === 'Paketlendi' || i.durumMetni === 'KontrolEdildi' ||
      i.durumMetni === 'Tamamlandı'
    ).length;
    return Math.round((tamamlanan / s.icerikler.length) * 100);
  }

  getDurumLabel(durum: string): string {
    const map: Record<string, string> = {
      TamGeldi: this.ts.translate('STATUS.TAM_GELDI'), EksikGeldi: this.ts.translate('STATUS.EKSIK_GELDI'), Gelmedi: this.ts.translate('STATUS.GELMEDI'),
      Paketlendi: this.ts.translate('STATUS.PAKETLENDI'), KontrolEdildi: this.ts.translate('STATUS.KONTROL_EDILDI'),
      IadeEdildi: this.ts.translate('STATUS.IADE_EDILDI'), Bekliyor: this.ts.translate('STATUS.BEKLIYOR'),
    };
    return map[durum] ?? durum;
  }

  getSandikMiktari(item: SandikIcerikDto): number {
    return Math.max(Number(item.sandikMiktari ?? item.istenenAdet ?? item.miktar ?? 0), 0);
  }

  getAnaIstenenAdet(item: SandikIcerikDto): number {
    return Math.max(Number(item.anaIstenenAdet ?? item.istenenAdet ?? item.miktar ?? 0), 0);
  }

  hasAnaToplamFarki(item: SandikIcerikDto): boolean {
    return Math.abs(this.getAnaIstenenAdet(item) - this.getSandikMiktari(item)) > 0.0001;
  }

  getSandikTransferOzeti(item: SandikIcerikDto): string {
    const apiOzeti = item.sandikTransferOzeti?.trim();
    if (apiOzeti) return apiOzeti;

    const giris = Math.max(Number(item.sandikAktarilanGiris ?? 0), 0);
    const cikis = Math.max(Number(item.sandikAktarilanCikis ?? 0), 0);
    const ozetler: string[] = [];
    if (giris > 0) ozetler.push(`${this.formatMiktar(giris)} adet giriş`);
    if (cikis > 0) ozetler.push(`${this.formatMiktar(cikis)} adet çıkış`);
    return ozetler.join(' · ');
  }

  formatMiktar(value: number | null | undefined): string {
    const numericValue = Number(value ?? 0);
    return numericValue.toLocaleString('tr-TR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: Number.isInteger(numericValue) ? 0 : 3
    });
  }

  // ===== Side Panel =====

  selectUrun(item: SandikIcerikDto) {
    this.selectedUrun.set(item);
    this.guncelKonulanAdet.set(item.konulanAdet);
    this.showDetailPanel.set(true);
  }

  closePanel() {
    this.showDetailPanel.set(false);
    this.selectedUrun.set(null);
  }

  // ===== Manuel Ürün Ekleme =====

  openUrunEkleModal() {
    if (!this.ensureCanWriteSandik()) return;

    if (this.isSandikKilitli()) {
      this.toast.error('Bu sandık sevk edildiği için üzerinde işlem yapılamaz.');
      return;
    }

    this.yeniBarkod.set('');
    this.yeniAciklama.set('');
    this.yeniAdet.set(1);
    this.yeniBirim.set(Birim.Adet);
    this.yeniNeden.set('');
    this.yeniEkAciklama.set('');
    this.yeniKaynakProjeNo.set('');
    this.eklemeMode.set('manuel');
    this.secilenKaynakProjeId.set(0);
    this.kaynakUrunler.set([]);
    this.secilenKaynakUrunler.set(new Set());
    this.tamamlamaAdetleri.set({});
    this.showUrunEkleModal.set(true);

    // Projeden seçim yalnızca Saha projelerinde eksik tamamlama üretir.
    if (this.isSahaYonetimi) {
      this.projeService.getProjeListesi(1, 1000, ProjeTipi.Normal).subscribe(res => {
        if (res.isSuccess && res.value) {
          this.normalProjeler.set(res.value.items);
          const mevcutProje = res.value.items.find(p => p.id === this.projeId());
          if (mevcutProje) {
            this.secilenKaynakProjeId.set(mevcutProje.id);
            this.onKaynakProjeChange(mevcutProje.id);
          }
        }
      });
    }
  }

  closeUrunEkleModal() {
    this.showUrunEkleModal.set(false);
  }

  // ===== Projeden Ürün Seçme =====

  onKaynakProjeChange(projeId: number) {
    if (!this.canWriteSandik()) return;

    this.secilenKaynakProjeId.set(projeId);
    this.secilenKaynakUrunler.set(new Set());
    this.tamamlamaAdetleri.set({});
    if (projeId <= 0) {
      this.kaynakUrunler.set([]);
      return;
    }
    this.kaynakUrunlerLoading.set(true);
    this.sandikService.getEksikUrunlerByProje(projeId).subscribe({
      next: (res) => {
        this.kaynakUrunlerLoading.set(false);
        if (res.isSuccess && res.value) {
          const urunler = res.value as EksikUrunForSandikDto[];
          this.kaynakUrunler.set(urunler);
          this.tamamlamaAdetleri.set(urunler.reduce<Record<number, number>>((acc, u) => {
            acc[u.cekiSatiriId] = u.kalanMiktar;
            return acc;
          }, {}));
        } else {
          this.kaynakUrunler.set([]);
          this.toast.error(res.error ?? 'Ürünler yüklenemedi.');
        }
      },
      error: () => {
        this.kaynakUrunlerLoading.set(false);
        this.toast.error('Ürünler yüklenirken hata oluştu.');
      }
    });
  }

  toggleKaynakUrun(cekiSatiriId: number) {
    if (!this.canWriteSandik()) return;

    const set = new Set(this.secilenKaynakUrunler());
    if (set.has(cekiSatiriId)) set.delete(cekiSatiriId);
    else set.add(cekiSatiriId);
    this.secilenKaynakUrunler.set(set);
  }

  getTamamlamaAdet(cekiSatiriId: number): number {
    return this.tamamlamaAdetleri()[cekiSatiriId] ?? 0;
  }

  setTamamlamaAdet(cekiSatiriId: number, value: number, max: number) {
    if (!this.canWriteSandik()) return;

    const numericValue = Number(value);
    const safeValue = Number.isFinite(numericValue)
      ? Math.min(Math.max(numericValue, 0), max)
      : 0;

    this.tamamlamaAdetleri.set({
      ...this.tamamlamaAdetleri(),
      [cekiSatiriId]: safeValue
    });
  }

  async projedenUrunEkle() {
    if (!this.ensureCanWriteSandik()) return;

    if (this.isSandikKilitli()) {
      this.toast.error('Bu sandık sevk edildiği için üzerinde işlem yapılamaz.');
      return;
    }

    const secilen = this.secilenKaynakUrunler();
    if (secilen.size === 0) {
      this.toast.error('En az bir ürün seçiniz.');
      return;
    }
    this.urunEklemeSaving.set(true);
    const urunler = this.kaynakUrunler().filter(u => secilen.has(u.cekiSatiriId));
    const hataliAdetVar = urunler.some(u => {
      const adet = this.getTamamlamaAdet(u.cekiSatiriId);
      return adet <= 0 || adet > u.kalanMiktar;
    });

    if (hataliAdetVar) {
      this.urunEklemeSaving.set(false);
      this.toast.error('Seçilen ürünlerde tamamlama adedi 0 ile kalan adet arasında olmalıdır.');
      return;
    }

    let hata = 0;

    for (const u of urunler) {
      const tamamlanacakAdet = this.getTamamlamaAdet(u.cekiSatiriId);
      const payload = {
        projeId: this.projeId(),
        sandikId: this.sandikId(),
        barkodNo: u.barkodNo || '',
        isim: u.aciklama,
        miktar: tamamlanacakAdet,
        birimId: null,
        cekiSatiriId: u.cekiSatiriId,
        kaynakProjeNo: u.projeNo,
        aciklama: this.yeniEkAciklama().trim() || undefined
      };
      try {
        const res: any = await firstValueFrom(this.projeService.sahaYedekMalzemeEkle(payload));
        if (!res.isSuccess) hata++;
      } catch {
        hata++;
      }
    }

    this.urunEklemeSaving.set(false);
    if (hata === 0) {
      this.toast.success(`${urunler.length} ürün başarıyla eklendi.`);
      this.closeUrunEkleModal();
    } else {
      this.toast.error(`${hata} ürün eklenemedi.`);
    }
    this.loadSandik();
  }

  // ===== Özellik Güncelleme =====
  openOzellikGuncelleModal() {
    if (!this.ensureCanWriteSandik()) return;

    const s = this.sandik();
    if (!s) return;
    if (this.isSandikKilitli()) {
      this.toast.error('Bu sandık sevk edildiği için üzerinde işlem yapılamaz.');
      return;
    }

    this.ozellikSandikIsmi.set(s.ad ?? '');
    this.ozellikTipId.set(s.tipId ?? null);
    if (!this.sandikTipleri().length) {
      this.lookupService.getLookups(['LookupSandikTipi'])
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(data => this.sandikTipleri.set(data['LookupSandikTipi'] ?? []));
    }
    this.ozellikEn.set(s.en ?? null);
    this.ozellikBoy.set(s.boy ?? null);
    this.ozellikYukseklik.set(s.yukseklik ?? null);
    this.ozellikNetKg.set(s.netKg ?? null);
    this.ozellikGrossKg.set(s.grossKg ?? null);
    this.showOzellikModal.set(true);
  }

  closeOzellikModal() {
    this.showOzellikModal.set(false);
  }

  kaydetOzellikler() {
    if (!this.ensureCanWriteSandik()) return;

    if (this.isSandikKilitli()) {
      this.toast.error('Bu sandık sevk edildiği için üzerinde işlem yapılamaz.');
      return;
    }

    const tipId = this.ozellikTipId();
    if (!tipId) {
      this.toast.error('Sandık tipi seçilmelidir.');
      return;
    }

    this.ozellikSaving.set(true);
    this.sandikService.ozellikGuncelle({
      sandikId: this.sandikId(),
      sandikIsmi: this.ozellikSandikIsmi().trim() || undefined,
      tipId,
      en: this.ozellikEn() ?? undefined,
      boy: this.ozellikBoy() ?? undefined,
      yukseklik: this.ozellikYukseklik() ?? undefined,
      netKg: this.ozellikNetKg() ?? undefined,
      grossKg: this.ozellikGrossKg() ?? undefined
    }).subscribe({
      next: (res) => {
        this.ozellikSaving.set(false);
        if (res.isSuccess) {
          this.toast.success('Sandık özellikleri güncellendi.');
          this.closeOzellikModal();
          this.loadSandik();
        } else {
          this.toast.error(res.error ?? 'Güncellenemedi.');
        }
      },
      error: () => {
        this.ozellikSaving.set(false);
        this.toast.error('Hata oluştu.');
      }
    });
  }

  manuelUrunEkle() {
    if (!this.ensureCanWriteSandik()) return;

    if (this.isSandikKilitli()) {
      this.toast.error('Bu sandık sevk edildiği için üzerinde işlem yapılamaz.');
      return;
    }

    if (!this.yeniAciklama().trim()) {
      this.toast.error('Açıklama girilmelidir.');
      return;
    }
    if (this.yeniAdet() <= 0) {
      this.toast.error('Adet 0\'dan büyük olmalıdır.');
      return;
    }
    this.urunEklemeSaving.set(true);

    const isSahaYedek = this.isSahaYedek;
    const payload = {
      projeId: this.projeId(),
      sandikId: this.sandikId(),
      barkodNo: this.yeniBarkod().trim() || (isSahaYedek ? '' : 'MANUEL'),
      aciklama: this.yeniAciklama().trim(),
      istenenAdet: this.yeniAdet(),
      birimId: this.yeniBirim(),
      eklemeNedeni: this.yeniNeden().trim() || undefined,
    };
    
    // Rename property for SahaYedek API which expects 'isim' and 'miktar' instead of 'aciklama' and 'istenenAdet'
    const sahaYedekPayload = {
      ...payload,
      isim: payload.aciklama,
      miktar: payload.istenenAdet,
      kaynakProjeNo: this.yeniKaynakProjeNo().trim() || undefined,
      aciklama: this.yeniEkAciklama().trim() || undefined
    };

    const obs = isSahaYedek 
      ? this.projeService.sahaYedekMalzemeEkle(sahaYedekPayload)
      : this.sandikService.manuelUrunEkle(payload);

    obs.subscribe({
      next: (res: any) => {
        this.urunEklemeSaving.set(false);
        if (res.isSuccess) {
          this.toast.success('Ürün başarıyla eklendi.');
          this.closeUrunEkleModal();
          this.loadSandik();
        } else {
          this.toast.error(res.error ?? 'Ürün eklenemedi.');
        }
      },
      error: () => {
        this.urunEklemeSaving.set(false);
        this.toast.error('Ürün eklenirken hata oluştu.');
      }
    });
  }

  // ===== Ürün Taşıma =====

  tasimaSeciminiDegistir(item: SandikIcerikDto): void {
    if (!this.canWriteSandik() || this.isSandikTasimayaKilitli() || this.getSandikMiktari(item) <= 0) return;
    const ids = new Set(this.seciliTasimaIcerikleri());
    if (ids.has(item.id)) ids.delete(item.id);
    else if (ids.size < 250) ids.add(item.id);
    else {
      this.toast.error(this.ts.translate('BULK_CRATE_MOVE.LIMIT'));
      return;
    }
    this.seciliTasimaIcerikleri.set(ids);
  }

  tasimaSeciminiTemizle(): void {
    this.seciliTasimaIcerikleri.set(new Set());
  }

  tumTasimaSeciminiDegistir(): void {
    if (!this.canWriteSandik() || this.isSandikTasimayaKilitli()) return;
    if (this.tumTasimaIcerikleriSecili()) {
      this.seciliTasimaIcerikleri.set(new Set());
      return;
    }
    if (this.tasinabilirIcerikler().length > 250) {
      this.toast.error(this.ts.translate('BULK_CRATE_MOVE.LIMIT'));
      return;
    }
    this.seciliTasimaIcerikleri.set(new Set(this.tasinabilirIcerikler().map(item => item.id)));
  }

  openTopluTasiModal(): void {
    if (!this.ensureCanWriteSandik() || this.isSandikTasimayaKilitli() || !this.topluTasimaUrunleri().length) return;
    this.closePanel();
    this.loadProjeSandiklari();
    this.showTopluTasiModal.set(true);
  }

  topluTasimaTamamlandi(): void {
    this.showTopluTasiModal.set(false);
    this.seciliTasimaIcerikleri.set(new Set());
    this.toast.success(this.ts.translate('BULK_CRATE_MOVE.SUCCESS'));
    this.loadSandik();
    this.loadProjeSandiklari();
  }

  openTasiModal(item: SandikIcerikDto) {
    if (!this.ensureCanWriteSandik()) return;

    if (this.isSandikTasimayaKilitli()) {
      this.toast.error('Bu sandık sevk edildiği için üzerinde işlem yapılamaz.');
      return;
    }

    const maksimumMiktar = this.getSandikMiktari(item);
    if (maksimumMiktar <= 0) {
      this.toast.error('Bu ürün için taşınabilecek planlı miktar bulunmuyor.');
      return;
    }

    this.tasiUrun.set(item);
    this.tasinanAdet.set(maksimumMiktar);
    this.hedefSandikId.set(0);
    this.tasiIslemAnahtari.set(crypto.randomUUID());
    this.showTasiModal.set(true);
    this.closePanel();
  }

  closeTasiModal() {
    this.showTasiModal.set(false);
    this.tasiUrun.set(null);
    this.tasiIslemAnahtari.set('');
  }

  urunTasi() {
    if (!this.ensureCanWriteSandik()) return;

    if (this.isSandikTasimayaKilitli()) {
      this.toast.error('Bu sandık sevk edildiği için üzerinde işlem yapılamaz.');
      return;
    }

    const urun = this.tasiUrun();
    if (!urun) return;
    if (this.hedefSandikId() <= 0) {
      this.toast.error('Hedef sandık seçiniz.');
      return;
    }
    const tasinanAdet = Number(this.tasinanAdet());
    const maksimumMiktar = this.getSandikMiktari(urun);
    if (!Number.isFinite(tasinanAdet) || tasinanAdet <= 0 || tasinanAdet > maksimumMiktar) {
      this.toast.error(`Taşınacak miktar 0'dan büyük ve en fazla ${this.formatMiktar(maksimumMiktar)} olmalıdır.`);
      return;
    }
    if (Math.abs(tasinanAdet * 10_000 - Math.round(tasinanAdet * 10_000)) > 1e-8) {
      this.toast.error('Taşınacak miktar en fazla 4 ondalık basamak içerebilir.');
      return;
    }
    const islemAnahtari = this.tasiIslemAnahtari() || crypto.randomUUID();
    this.tasiIslemAnahtari.set(islemAnahtari);
    this.tasiSaving.set(true);
    this.sandikService.urunTasi({
      kaynakSandikIcerikId: urun.id,
      hedefSandikId: this.hedefSandikId(),
      tasinanAdet,
      projeId: this.projeId(),
      islemAnahtari,
    }).subscribe({
      next: (res) => {
        this.tasiSaving.set(false);
        if (res.isSuccess) {
          this.toast.success('Ürün başarıyla taşındı.');
          this.closeTasiModal();
          this.loadSandik();
        } else {
          this.toast.error(res.error ?? 'Ürün taşınamadı.');
        }
      },
      error: () => {
        this.tasiSaving.set(false);
        this.toast.error('Taşıma sırasında hata oluştu.');
      }
    });
  }

  // ===== Konulma Güncelleme =====

  konulanGuncelle() {
    if (!this.ensureCanWriteSandik()) return;

    if (this.isSandikKilitli()) {
      this.toast.error('Bu sandık sevk edildiği için üzerinde işlem yapılamaz.');
      return;
    }

    const urun = this.selectedUrun();
    if (!urun) return;
    const yeniAdet = Number(this.guncelKonulanAdet());
    const maksimumMiktar = this.getSandikMiktari(urun);
    if (!Number.isFinite(yeniAdet) || yeniAdet < 0 || yeniAdet > maksimumMiktar) {
      this.toast.error(`Konulan adet 0 ile ${this.formatMiktar(maksimumMiktar)} arasında olmalıdır.`);
      return;
    }
    this.guncelleSaving.set(true);
    const user = this.auth.currentUser();
    this.sandikService.urunGuncelle({
      cekiSatiriId: urun.cekiSatiriId || null,
      sandikIcerikId: urun.id,
      sandikId: this.sandikId(),
      konulanAdet: yeniAdet,
      kullaniciId: user?.id ?? 0,
      projeId: this.projeId(),
    }).subscribe({
      next: (res) => {
        this.guncelleSaving.set(false);
        if (res.isSuccess) {
          this.toast.success('Konulan adet güncellendi.');
          this.closePanel();
          this.loadSandik();
        } else {
          this.toast.error(res.error ?? 'Güncelleme başarısız.');
        }
      },
      error: () => {
        this.guncelleSaving.set(false);
        this.toast.error('Güncelleme sırasında hata oluştu.');
      }
    });
  }

  // ===== Manuel Ürün Silme =====

  async manuelUrunSil(item: SandikIcerikDto) {
    if (!this.ensureCanWriteSandik()) return;

    if (item.manuelSilinebilirMi !== true) {
      this.toast.error('Bu ürün sevk, saha aktarımı veya kaynak bağlantısı nedeniyle doğrudan silinemez. Aktarım kökenli ürünlerde resmi saha aktarımı geri alma işlemini kullanın.');
      return;
    }

    if (this.isSandikKilitli()) {
      this.toast.error('Bu sandık sevk edildiği için üzerinde işlem yapılamaz.');
      return;
    }

    const onay = await this.confirmService.ask({
      title: 'Manuel Ürün Sil',
      message: `<strong>${duzMetin(item.aciklama)}</strong> ürününü silmek istediğinize emin misiniz?<br><br><small class="text-muted">Bu işlem geri alınamaz.</small>`,
      confirmText: 'Evet, Sil',
      cancelText: 'Vazgeç',
      type: 'danger'
    });

    if (onay) {
      // Saha/Yedek modunda her zaman sandikIcerikId ile sil
      const useSandikIcerikId = this.isSahaYedek;
      const hasCeki = !useSandikIcerikId && item.cekiSatiriId && item.cekiSatiriId > 0;
      this.sandikService.manuelUrunSil(
        this.projeId(),
        hasCeki ? item.cekiSatiriId : undefined,
        (!hasCeki || useSandikIcerikId) ? item.id : undefined
      ).subscribe({
        next: (res) => {
          if (res.isSuccess) {
            this.toast.success('Ürün başarıyla silindi.');
            this.loadSandik();
          } else {
            this.toast.error(res.error ?? 'Ürün silinemedi.');
          }
        },
        error: () => this.toast.error('Silme sırasında hata oluştu.')
      });
    }
  }
}
