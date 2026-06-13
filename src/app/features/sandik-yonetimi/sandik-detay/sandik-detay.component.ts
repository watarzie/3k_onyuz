import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslationService } from '../../../core/services/translation.service';
import { SandikService } from '../../../core/services/sandik.service';
import { ProjeService } from '../../../core/services/proje.service';
import { ToastService } from '../../../core/services/toast.service';
import { AuthService } from '../../../core/auth/auth.service';
import { PermissionService } from '../../../core/services/permission.service';
import { LookupService } from '../../../core/services/lookup.service';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { BreadcrumbComponent } from '../../../shared/components/breadcrumb/breadcrumb.component';
import { EksikUrunForSandikDto, SandikDetayDto, SandikIcerikDto, SandikDto } from '../../../shared/models/index';
import { Birim } from '../../../core/constants/enums';

import { ConfirmService } from '../../../core/services/confirm.service';

@Component({
  selector: 'app-sandik-detay',
  standalone: true,
  imports: [TranslatePipe, RouterLink, NgClass, FormsModule, StatusBadgeComponent, BreadcrumbComponent],
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
  ozellikEn = signal<number | null>(null);
  ozellikBoy = signal<number | null>(null);
  ozellikYukseklik = signal<number | null>(null);
  ozellikNetKg = signal<number | null>(null);
  ozellikGrossKg = signal<number | null>(null);
  ozellikLokasyonId = signal<number>(0);
  lokasyonlar = signal<{id: number, deger: string}[]>([]);

  // Ürün taşıma modal
  showTasiModal = signal(false);
  tasiUrun = signal<SandikIcerikDto | null>(null);
  hedefSandikId = signal(0);
  tasinanAdet = signal(1);
  tasiSaving = signal(false);
  projeSandiklari = signal<SandikDto[]>([]);

  // Konulma güncelleme
  guncelKonulanAdet = signal(0);
  guncelleSaving = signal(false);

  breadcrumb: { label: string; link?: string }[] = [];

  isSahaYedek = signal(false);
  isSahaYonetimi = signal(false);
  isYedekYonetimi = signal(false);
  canWriteSandik = computed(() => {
    const menuKod = this.route.snapshot.data['menuKod'] || 'sandik-yonetimi';
    return this.permissionService.canWrite(menuKod);
  });

  ngOnInit() {
    const pId = Number(this.route.snapshot.paramMap.get('projeId'));
    const sId = Number(this.route.snapshot.paramMap.get('sandikId'));
    const menuKod = this.route.snapshot.data['menuKod'] || 'sandik-yonetimi';
    this.isSahaYedek.set(menuKod === 'saha-yonetimi' || menuKod === 'saha-sandiklar' || menuKod === 'yedek-yonetimi');
    this.isSahaYonetimi.set(menuKod === 'saha-yonetimi' || menuKod === 'saha-sandiklar');
    this.isYedekYonetimi.set(menuKod === 'yedek-yonetimi');
    
    this.projeId.set(pId);
    this.sandikId.set(sId);
    this.loadSandik();
    this.loadProjeSandiklari();
    this.loadLokasyonlar();
  }

  loadLokasyonlar() {
    this.lookupService.getLookups(['LookupDepoLokasyon']).subscribe(data => {
      if (data['LookupDepoLokasyon']) this.lokasyonlar.set(data['LookupDepoLokasyon']);
    });
  }

  async sandikHazirla() {
    const s = this.sandik();
    if (!s) return;

    const onay = await this.confirmService.ask({
      title: 'Sandığı Kapat',
      message: `<strong>${s.sandikNo}</strong> numaralı sandığı kapatmak istediğinize emin misiniz?<br><br>Bu işlem geri alınabilir.`,
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
    this.loading.set(true);
    this.sandikService.getSandikIcerik(this.sandikId()).subscribe((res) => {
      this.loading.set(false);
      if (res.isSuccess && res.value) {
        this.sandik.set(res.value);
        
        let parentLabel = this.ts.translate('MENU.SANDIK_YONETIMI');
        let parentLink = `/sandik-yonetimi/${this.projeId()}`;
        
        const menuKod = this.route.snapshot.data['menuKod'];
        if (menuKod === 'saha-yonetimi' || menuKod === 'saha-sandiklar') {
          parentLabel = 'Saha Yönetimi';
          parentLink = `/saha-yonetimi/${this.projeId()}`;
        } else if (menuKod === 'yedek-yonetimi') {
          parentLabel = 'Yedek Yönetimi';
          parentLink = `/yedek-yonetimi/${this.projeId()}`;
        } else if (menuKod === '3k-modulu') {
          parentLabel = '3K Modülü';
          parentLink = `/uck/${this.projeId()}`;
        }
        else if (menuKod === 'saha-3k-modulu') {
          parentLabel = 'Saha 3K Modülü';
          parentLink = `/saha-yonetimi/uck/${this.projeId()}`;
        }

        this.breadcrumb = [
          { label: this.ts.translate('MENU.DASHBOARD'), link: '/dashboard' },
          { label: parentLabel, link: parentLink },
          { label: `${res.value.sandikNo}` },
        ];
      }
    });
  }

  loadProjeSandiklari() {
    this.sandikService.getSandiklar(this.projeId()).subscribe((res) => {
      if (res.isSuccess && res.value) {
        // Mevcut sandığı hariç tut
        this.projeSandiklari.set(res.value.filter(s => s.id !== this.sandikId()));
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

    // Yedek modunda projeden seçim eski akış olarak korunur.
    if (this.isYedekYonetimi()) {
      this.projeService.getProjeListesi(1, 1000, 1).subscribe(res => {
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
    const set = new Set(this.secilenKaynakUrunler());
    if (set.has(cekiSatiriId)) set.delete(cekiSatiriId);
    else set.add(cekiSatiriId);
    this.secilenKaynakUrunler.set(set);
  }

  getTamamlamaAdet(cekiSatiriId: number): number {
    return this.tamamlamaAdetleri()[cekiSatiriId] ?? 0;
  }

  setTamamlamaAdet(cekiSatiriId: number, value: number, max: number) {
    const numericValue = Number(value);
    const safeValue = Number.isFinite(numericValue)
      ? Math.min(Math.max(numericValue, 0), max)
      : 0;

    this.tamamlamaAdetleri.set({
      ...this.tamamlamaAdetleri(),
      [cekiSatiriId]: safeValue
    });
  }

  projedenUrunEkle() {
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
      this.toast.error('SeÃ§ilen Ã¼rÃ¼nlerde tamamlama adedi 0 ile kalan adet arasÄ±nda olmalÄ±dÄ±r.');
      return;
    }

    let tamamlanan = 0;
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
      this.projeService.sahaYedekMalzemeEkle(payload).subscribe({
        next: (res: any) => {
          tamamlanan++;
          if (!res.isSuccess) hata++;
          if (tamamlanan === urunler.length) {
            this.urunEklemeSaving.set(false);
            if (hata === 0) {
              this.toast.success(`${urunler.length} ürün başarıyla eklendi.`);
              this.closeUrunEkleModal();
              this.loadSandik();
            } else {
              this.toast.error(`${hata} ürün eklenemedi.`);
              this.loadSandik();
            }
          }
        },
        error: () => {
          tamamlanan++;
          hata++;
          if (tamamlanan === urunler.length) {
            this.urunEklemeSaving.set(false);
            this.toast.error(`${hata} ürün eklenemedi.`);
          }
        }
      });
    }
  }

  // ===== Özellik Güncelleme =====
  openOzellikGuncelleModal() {
    const s = this.sandik();
    if (!s) return;
    this.ozellikSandikIsmi.set(s.ad ?? '');
    this.ozellikEn.set(s.en ?? null);
    this.ozellikBoy.set(s.boy ?? null);
    this.ozellikYukseklik.set(s.yukseklik ?? null);
    this.ozellikNetKg.set(s.netKg ?? null);
    this.ozellikGrossKg.set(s.grossKg ?? null);
    this.ozellikLokasyonId.set(s.depoLokasyonId ?? 0);
    this.showOzellikModal.set(true);
  }

  closeOzellikModal() {
    this.showOzellikModal.set(false);
  }

  kaydetOzellikler() {
    this.ozellikSaving.set(true);
    this.sandikService.ozellikGuncelle({
      sandikId: this.sandikId(),
      sandikIsmi: this.ozellikSandikIsmi().trim() || undefined,
      en: this.ozellikEn() ?? undefined,
      boy: this.ozellikBoy() ?? undefined,
      yukseklik: this.ozellikYukseklik() ?? undefined,
      netKg: this.ozellikNetKg() ?? undefined,
      grossKg: this.ozellikGrossKg() ?? undefined,
      depoLokasyonId: this.ozellikLokasyonId() > 0 ? this.ozellikLokasyonId() : undefined
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
    if (!this.yeniAciklama().trim()) {
      this.toast.error('Açıklama girilmelidir.');
      return;
    }
    if (this.yeniAdet() <= 0) {
      this.toast.error('Adet 0\'dan büyük olmalıdır.');
      return;
    }
    this.urunEklemeSaving.set(true);

    const isSahaYedek = this.isSahaYedek();
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

  openTasiModal(item: SandikIcerikDto) {
    this.tasiUrun.set(item);
    this.tasinanAdet.set(item.konulanAdet);
    this.hedefSandikId.set(0);
    this.showTasiModal.set(true);
    this.closePanel();
  }

  closeTasiModal() {
    this.showTasiModal.set(false);
    this.tasiUrun.set(null);
  }

  urunTasi() {
    const urun = this.tasiUrun();
    if (!urun) return;
    if (this.hedefSandikId() <= 0) {
      this.toast.error('Hedef sandık seçiniz.');
      return;
    }
    if (this.tasinanAdet() <= 0 || this.tasinanAdet() > urun.konulanAdet) {
      this.toast.error(`Taşınacak adet 1 ile ${urun.konulanAdet} arasında olmalıdır.`);
      return;
    }
    this.tasiSaving.set(true);
    this.sandikService.urunTasi({
      kaynakSandikIcerikId: urun.id,
      hedefSandikId: this.hedefSandikId(),
      tasinanAdet: this.tasinanAdet(),
      projeId: this.projeId(),
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
    const urun = this.selectedUrun();
    if (!urun) return;
    const yeniAdet = this.guncelKonulanAdet();
    if (yeniAdet < 0 || yeniAdet > urun.istenenAdet) {
      this.toast.error(`Konulan adet 0 ile ${urun.istenenAdet} arasında olmalıdır.`);
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
    const onay = await this.confirmService.ask({
      title: 'Manuel Ürün Sil',
      message: `<strong>${item.aciklama}</strong> ürününü silmek istediğinize emin misiniz?<br><br><small class="text-muted">Bu işlem geri alınamaz.</small>`,
      confirmText: 'Evet, Sil',
      cancelText: 'Vazgeç',
      type: 'danger'
    });

    if (onay) {
      // Saha/Yedek modunda her zaman sandikIcerikId ile sil
      const useSandikIcerikId = this.isSahaYedek();
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
