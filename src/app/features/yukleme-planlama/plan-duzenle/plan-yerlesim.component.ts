import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ToastService } from '../../../core/services/toast.service';
import { YuklemePlanlamaService } from '../../../core/services/yukleme-planlama.service';
import { dosyaAdiBasliktan, dosyayiKaydet } from '../../../core/services/dosya-kaydet';
import { DatePipe, DecimalPipe } from '@angular/common';
import {
  EkipmanTeknikVerisi,
  PlanAraci,
  PlanYukKonumu,
  YerlesimKontrolSonucu,
  YuklemeLokasyonTercihi,
  YuklemePlaniDetayi,
} from '../../../shared/models/index';
import { Ekipman3dComponent, Yuk3d } from '../ekipman-kitapligi/ekipman-3d.component';
import { PlanElleYerlesimComponent } from './plan-elle-yerlesim.component';
import { KONTROL_SONUCU, KONTROL_TURU, LOKASYON_TERCIHI, girisYonuMetni, mm } from '../ortak/yukleme-etiketleri';

/** Projeleri ayıran renkler; kimlik yalnız renge bağlı değildir (kod ve proje no ayrıca yazılır). */
const PROJE_RENKLERI = ['#0e7490', '#7c3aed', '#ea580c', '#16a34a', '#2563eb', '#be185d', '#a16207', '#0f766e', '#4f46e5', '#65a30d'];

/**
 * Otomatik yerleşim sonucu (isterler 16–19, 22, 25): araç ve tip özeti, uyarılar, yerleşemeyenler, ek ekipman ihtiyacı,
 * seçili aracın kontrolleri, yük listesi ve 3B görünümü. Lokasyonu farklı yükler varsa ilk hesaptan sonra lokasyon
 * tercihi sorulur. Hesap yalnız kaydedilmiş revizyonla yapılır.
 */
@Component({
  selector: 'app-plan-yerlesim',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DecimalPipe, Ekipman3dComponent, PlanElleYerlesimComponent],
  templateUrl: './plan-yerlesim.component.html',
  styleUrls: ['../ortak/yukleme.scss', './plan-yerlesim.component.scss'],
})
export class PlanYerlesimComponent {
  private readonly api = inject(YuklemePlanlamaService);
  private readonly toast = inject(ToastService);
  readonly plan = input.required<YuklemePlaniDetayi>();
  readonly yazabilir = input(false);
  /** Kaydedilmemiş değişiklik varsa hesap yapılamaz (sunucu son kaydı hesaplar). */
  readonly kaydedilmemis = input(false);
  readonly hesaplaniyor = input(false);
  readonly hesapla = output<YuklemeLokasyonTercihi>();
  /** Elle düzenleme kaydedildi: yeni revizyon (isterler 20–21). */
  readonly elleKaydedildi = output<YuklemePlaniDetayi>();
  /** Elle düzenleme açık mı; açıkken otomatik sonuç yerine düzenleyici gösterilir. */
  readonly duzenleme = signal(false);

  readonly KONTROL_SONUCU = KONTROL_SONUCU;
  readonly KONTROL_TURU = KONTROL_TURU;
  readonly LOKASYON_TERCIHI = LOKASYON_TERCIHI;
  readonly Tercih = YuklemeLokasyonTercihi;
  readonly Sonuc = YerlesimKontrolSonucu;
  readonly girisYonu = girisYonuMetni;
  readonly mm = mm;

  readonly yerlesim = computed(() => this.plan().yerlesim);
  readonly seciliAracNo = signal<number | null>(null);
  readonly seciliYuk = signal<string | null>(null);
  readonly tercih = signal<YuklemeLokasyonTercihi>(YuklemeLokasyonTercihi.Karisik);
  readonly indiriliyor = signal<'talep' | 'yukleme' | null>(null);

  readonly araclar = computed(() => this.yerlesim()?.araclar ?? []);
  readonly seciliArac = computed<PlanAraci | null>(() => this.araclar().find((a) => a.aracNo === this.seciliAracNo()) ?? this.araclar()[0] ?? null);
  readonly teknikVeri = computed<EkipmanTeknikVerisi | null>(() => {
    const a = this.seciliArac();
    if (!a) return null;
    try {
      return JSON.parse(a.teknikVeriJson) as EkipmanTeknikVerisi;
    } catch {
      return null;
    }
  });

  /** Araç tipi özeti (araç talebi): ekipman başına adet; zorunlu özel ekipman ayrı satır. */
  readonly tipOzeti = computed(() => {
    const gruplar = new Map<string, { kod: string; ad: string; adet: number; aileDisi: boolean }>();
    for (const a of this.araclar()) {
      const anahtar = `${a.ekipmanKodu}|${a.zorunluOzelEkipman}`;
      const g = gruplar.get(anahtar) ?? { kod: a.ekipmanKodu, ad: a.ekipmanAdi, adet: 0, aileDisi: a.zorunluOzelEkipman };
      g.adet++;
      gruplar.set(anahtar, g);
    }
    return [...gruplar.values()];
  });

  readonly projeRenkleri = computed(() => {
    const renkler = new Map<string, string>();
    this.plan().projeler.forEach((p, i) => renkler.set(p.projeNo, PROJE_RENKLERI[i % PROJE_RENKLERI.length]));
    return renkler;
  });

  readonly yukler3d = computed<Yuk3d[]>(() => {
    const a = this.seciliArac();
    const v = this.teknikVeri();
    if (!a) return [];
    const uygunsuz = a.sonuc === YerlesimKontrolSonucu.Uygunsuz;
    const sorunlu = new Set(a.yukSorunlari.filter((s) => s.sonuc === YerlesimKontrolSonucu.Uygunsuz).map((s) => s.yukAnahtari));
    return a.konumlar.map((k) => ({
      anahtar: k.yukAnahtari,
      kod: k.kod,
      xMm: k.xMm,
      yMm: k.yMm,
      zMm: k.zMm,
      boyMm: k.boyMm,
      enMm: k.enMm,
      yukseklikMm: k.yukseklikMm,
      renk: this.projeRenkleri().get(k.projeNo ?? '') ?? '#64748b',
      // Uygunsuz araçta kasa dışına taşan yük ve elle yerleşimde uygunsuz sonucu olan yük kırmızıdır; araç düzeyindeki
      // uygunsuzluk araç kartında ve kontrollerde yazılır.
      sorunlu: (uygunsuz && this.tasiyor(k, v)) || sorunlu.has(k.yukAnahtari),
    }));
  });

  readonly seciliKonum = computed<PlanYukKonumu | null>(() =>
    this.seciliArac()?.konumlar.find((k) => k.yukAnahtari === this.seciliYuk()) ?? null);

  readonly siraliKonumlar = computed(() =>
    [...(this.seciliArac()?.konumlar ?? [])].sort((a, b) => a.yuklemeSirasi - b.yuklemeSirasi || a.kat - b.kat));

  readonly lokasyonSorusu = computed(() => !!this.yerlesim() && this.plan().farkliLokasyonSayisi > 1);

  /** Seçili aracın yük sorunları kod ile (elle yerleşim). */
  readonly yukSorunlari = computed(() => {
    const a = this.seciliArac();
    return (a?.yukSorunlari ?? []).map((s) => ({ ...s, kod: a!.konumlar.find((k) => k.yukAnahtari === s.yukAnahtari)?.kod ?? s.yukAnahtari }));
  });

  constructor() {
    effect(() => {
      const t = this.plan().lokasyonTercihi;
      this.tercih.set(t === YuklemeLokasyonTercihi.HenuzSecilmedi ? YuklemeLokasyonTercihi.Karisik : t);
    });
  }

  elleKaydet(p: YuklemePlaniDetayi): void {
    this.duzenleme.set(false);
    this.seciliAracNo.set(null);
    this.seciliYuk.set(null);
    this.elleKaydedildi.emit(p);
  }

  aracSec(a: PlanAraci): void {
    this.seciliAracNo.set(a.aracNo);
    this.seciliYuk.set(null);
  }

  /** İlk hesap lokasyon ayrımı yapılmadan; sonraki hesaplar seçilen tercihle. */
  hesapIstegi(): void {
    this.hesapla.emit(this.yerlesim() && this.lokasyonSorusu() ? this.tercih() : this.plan().lokasyonTercihi);
  }

  tercihleHesapla(): void {
    this.hesapla.emit(this.tercih());
  }

  /** PDF raporları son kaydedilen revizyonun yerleşimiyle üretilir (isterler 28–29). */
  raporIndir(tur: 'talep' | 'yukleme'): void {
    const p = this.plan();
    if (this.indiriliyor()) return;
    const istek: Observable<HttpResponse<Blob>> = tur === 'talep' ? this.api.aracTalepRaporu(p.id) : this.api.yuklemePlaniRaporu(p.id);
    const varsayilan = `${p.planNo}_R${p.revizyonNo}_${tur === 'talep' ? 'AracTalebi' : 'YuklemePlani'}.pdf`;
    this.indiriliyor.set(tur);
    istek.subscribe({
      next: (yanit) => {
        this.indiriliyor.set(null);
        dosyayiKaydet(yanit.body!, dosyaAdiBasliktan(yanit.headers.get('Content-Disposition'), varsayilan));
      },
      error: async (hata) => {
        this.indiriliyor.set(null);
        this.toast.error(await this.api.downloadErrorMessage(hata, 'Rapor indirilemedi.'));
      },
    });
  }

  kapasiteYuzde(a: PlanAraci): number | null {
    return a.kapasiteKg ? Math.round((a.toplamKg * 100) / a.kapasiteKg) : null;
  }

  private tasiyor(k: PlanYukKonumu, v: EkipmanTeknikVerisi | null): boolean {
    const g = v?.disOlcu?.genislikMm;
    const u = v?.disOlcu?.uzunlukMm;
    return (g != null && (k.yMm < 0 || k.yMm + k.enMm > g)) || (u != null && (k.xMm < 0 || k.xMm + k.boyMm > u));
  }
}
