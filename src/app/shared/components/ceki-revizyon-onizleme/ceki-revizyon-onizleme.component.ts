import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, input, signal, untracked } from '@angular/core';
import {
  CekiRevizyonGeriAlmaEtkisi,
  CekiRevizyonSandikEtkisi,
  CekiRevizyonOnizlemeSatiri,
  CekiRevizyonOnizlemeSonuc,
} from '../../models/ceki.model';

type RevizyonFiltresi = 'all' | 'A' | 'U' | 'D' | 'blocked' | 'warning' | 'unchanged';

@Component({
  selector: 'app-ceki-revizyon-onizleme',
  standalone: true,
  imports: [NgClass],
  templateUrl: './ceki-revizyon-onizleme.component.html',
  styleUrl: './ceki-revizyon-onizleme.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CekiRevizyonOnizlemeComponent {
  private readonly sayiFormatlayici = new Intl.NumberFormat('tr-TR', {
    maximumFractionDigits: 2,
  });
  private readonly tarihSaatFormatlayici = new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  readonly preview = input.required<CekiRevizyonOnizlemeSonuc>();
  readonly baslik = input('Revizyon Ön İzleme');
  readonly filtre = signal<RevizyonFiltresi>('all');

  private readonly onizlemeDegisikligi = effect(() => {
    const preview = this.preview();
    untracked(() => this.filtre.set(preview.engelliSatirSayisi > 0 ? 'blocked' : 'all'));
  });

  readonly uyariliSatirSayisi = computed(() =>
    this.preview().satirlar.filter(satir => this.uyariliMi(satir)).length
  );

  readonly degisiklikOlmayanSatirSayisi = computed(() =>
    this.preview().satirlar.filter(satir => this.degisiklikYokMu(satir)).length
  );

  readonly sandikEtkileri = computed(() => this.preview().sandikEtkileri ?? []);

  readonly filtrelenmisSatirlar = computed(() => {
    const preview = this.preview();
    const filtre = this.filtre();

    if (filtre === 'all') return preview.satirlar;
    if (filtre === 'blocked') return preview.satirlar.filter(satir => !satir.uygulanabilirMi);
    if (filtre === 'warning') return preview.satirlar.filter(satir => this.uyariliMi(satir));
    if (filtre === 'unchanged') return preview.satirlar.filter(satir => this.degisiklikYokMu(satir));
    return preview.satirlar.filter(satir => satir.checkKodu === filtre);
  });

  filtrele(filtre: RevizyonFiltresi): void {
    this.filtre.set(filtre);
  }

  satirEngelleri(satir: CekiRevizyonOnizlemeSatiri): string[] {
    if (satir.uygulanabilirMi) return [];

    const acikEngeller = this.normalizeMesajlar(satir.engeller);
    if (acikEngeller.length > 0) return acikEngeller;

    const yapilandirilmisEngeller = this.normalizeMesajlar(
      satir.sorunlar?.map(sorun => sorun.mesaj)
    );
    if (yapilandirilmisEngeller.length > 0) return yapilandirilmisEngeller;

    const eskiUyarilar = this.normalizeMesajlar(satir.uyarilar);
    if (eskiUyarilar.length > 0) return eskiUyarilar;

    return this.normalizeMesajlar([satir.mesaj]);
  }

  satirUyarilari(satir: CekiRevizyonOnizlemeSatiri): string[] {
    return satir.uygulanabilirMi ? this.normalizeMesajlar(satir.uyarilar) : [];
  }

  uyariliMi(satir: CekiRevizyonOnizlemeSatiri): boolean {
    return satir.uygulanabilirMi && (
      satir.riskSeviyesi?.toLocaleLowerCase('tr-TR') === 'uyarı' ||
      this.satirUyarilari(satir).length > 0
    );
  }

  degisiklikYokMu(satir: CekiRevizyonOnizlemeSatiri): boolean {
    return satir.uygulanabilirMi && satir.degisiklikler.some(degisiklik =>
      degisiklik.toLocaleLowerCase('tr-TR').includes('değişiklik yok')
    );
  }

  islemSinifi(checkKodu: string): string {
    if (checkKodu === 'A') return 'is-add';
    if (checkKodu === 'U') return 'is-update';
    if (checkKodu === 'D') return 'is-delete';
    return '';
  }

  islemEtiketi(checkKodu: string): string {
    if (checkKodu === 'A') return 'Eklenecek';
    if (checkKodu === 'U') return 'Güncellenecek';
    if (checkKodu === 'D') return 'Silinecek';
    return checkKodu;
  }

  degisikligiFormatla(degisiklik: string): string {
    if (!degisiklik) return '';

    const ayiriciIndex = degisiklik.indexOf(':');
    if (ayiriciIndex < 0) return degisiklik;

    const alanAdi = degisiklik.slice(0, ayiriciIndex).trim();
    const hamDeger = degisiklik.slice(ayiriciIndex + 1).trim();
    const ok = hamDeger.includes('→') ? '→' : hamDeger.includes('->') ? '->' : '';

    if (!ok) return `${alanAdi}: ${this.degeriFormatla(alanAdi, hamDeger)}`;

    const [eskiDeger, yeniDeger] = hamDeger.split(ok).map(deger => deger.trim());
    return `${alanAdi}: ${this.degeriFormatla(alanAdi, eskiDeger)} → ${this.degeriFormatla(alanAdi, yeniDeger)}`;
  }

  sandikAlaniGoster(
    etki: CekiRevizyonSandikEtkisi,
    eskiDeger: string | number | null | undefined,
    yeniDeger: string | number | null | undefined
  ): boolean {
    if (etki.yeniSandikMi) return this.degerVarMi(yeniDeger);
    return this.normalizeDeger(eskiDeger) !== this.normalizeDeger(yeniDeger);
  }

  sandikDegeriniFormatla(
    deger: string | number | null | undefined,
    birim = ''
  ): string {
    if (!this.degerVarMi(deger)) return '-';

    const formatliDeger = typeof deger === 'number'
      ? this.sayiFormatlayici.format(deger)
      : (deger ?? '').trim();

    return birim ? `${formatliDeger} ${birim}` : formatliDeger;
  }

  guvenliSayi(deger: number | null | undefined): number {
    return deger ?? 0;
  }

  geriAlmaIslemMetni(checkKodu: string): string {
    if (checkKodu === 'U') {
      return 'Onaylandığında bu operasyon kayıtları sıfırlanacak.';
    }

    if (checkKodu === 'D') {
      return 'Onaylandığında bu kayıtlar çeki satırıyla birlikte kaldırılacak.';
    }

    return 'Onaylandığında ilişkili operasyon kayıtları geri alınacak.';
  }

  gridEtkisiVarMi(etki: CekiRevizyonGeriAlmaEtkisi): boolean {
    return this.miktarVarMi(
      etki.gridGelenAdet,
      etki.trafoSevkAdet,
      etki.gridSevkMiktari,
      etki.yenidenSevkGerekliAdet
    ) || etki.gridDurumuId > 0 || etki.gridSevkDurumuId > 0 ||
      etki.gridPersonelId != null || this.degerVarMi(etki.gridSevkTarihi) ||
      this.degerVarMi(etki.gridAciklama);
  }

  ucKEtkisiVarMi(etki: CekiRevizyonGeriAlmaEtkisi): boolean {
    return this.miktarVarMi(
      etki.gelenMiktar,
      etki.karsilananMiktar,
      etki.stokKarsilanan,
      etki.projeKarsilanan,
      etki.projeGonderilen,
      etki.tedarikciKarsilanan,
      etki.hataliMiktar,
      etki.geriGonderilenMiktar
    ) || etki.ucKDurumuId > 0 || etki.ucKKarsilamaTipiId > 0 ||
      etki.geriGonderilmeSebebiId != null || etki.kaynakProjeId != null ||
      etki.kaliteDurumId != null || etki.surecDurumId != null ||
      etki.paketleyenId != null || etki.kontrolEdenId != null ||
      this.degerVarMi(etki.teslimTarihi) || this.degerVarMi(etki.kaynakHedefProjeNo) ||
      this.degerVarMi(etki.ucKAciklama);
  }

  sandikIcerikEtkisiVarMi(etki: CekiRevizyonGeriAlmaEtkisi): boolean {
    return etki.sandikIcerikSayisi > 0 || this.miktarVarMi(
      etki.tahsisMiktari,
      etki.konulanAdet,
      etki.eksikAdet,
      etki.sandikStokKarsilanan,
      etki.sandikProjeKarsilanan,
      etki.sandikTedarikciKarsilanan
    );
  }

  stokHareketEtkisiVarMi(etki: CekiRevizyonGeriAlmaEtkisi): boolean {
    return etki.stokHareketSayisi > 0 || (etki.stokHareketleri?.length ?? 0) > 0 ||
      this.miktarVarMi(
        etki.stoktanKarsilananMiktar,
        etki.fazlaTeslimStogaAktarilanMiktar,
        etki.digerStokHareketMiktari
      );
  }

  gelenTransferEtkisiVarMi(etki: CekiRevizyonGeriAlmaEtkisi): boolean {
    return etki.gelenAktifProjeTransferSayisi > 0 ||
      (etki.gelenAktifProjeTransferleri?.length ?? 0) > 0 ||
      this.miktarVarMi(etki.gelenAktifProjeTransferMiktari);
  }

  gelenTransferKaynakSayisi(etki: CekiRevizyonGeriAlmaEtkisi): number {
    return new Set(
      (etki.gelenAktifProjeTransferleri ?? []).map(transfer => transfer.kaynakProjeId)
    ).size;
  }

  tarihiFormatla(tarih: string | null | undefined): string {
    if (!tarih?.trim()) return '-';

    const tarihDegeri = new Date(tarih);
    return Number.isNaN(tarihDegeri.getTime())
      ? tarih
      : this.tarihSaatFormatlayici.format(tarihDegeri);
  }

  private normalizeMesajlar(mesajlar: string[] | null | undefined): string[] {
    if (!Array.isArray(mesajlar)) return [];

    return [...new Set(
      mesajlar
        .map(mesaj => mesaj?.trim())
        .filter((mesaj): mesaj is string => Boolean(mesaj))
    )];
  }

  private miktarVarMi(...miktarlar: Array<number | null | undefined>): boolean {
    return miktarlar.some(miktar => Number(miktar ?? 0) !== 0);
  }

  private degerVarMi(deger: string | number | null | undefined): boolean {
    return typeof deger === 'number' || Boolean(deger?.trim());
  }

  private normalizeDeger(deger: string | number | null | undefined): string {
    if (typeof deger === 'number') return deger.toString();
    return deger?.trim() ?? '';
  }

  private degeriFormatla(alanAdi: string, deger: string): string {
    const normalizeDeger = (deger ?? '').trim();
    if (!normalizeDeger || normalizeDeger === '-') return '-';

    const sayisalAlanlar = ['miktar', 'sıra no', 'birim'];
    const sayisalAlanMi = sayisalAlanlar.includes(alanAdi.toLocaleLowerCase('tr-TR'));
    const sayisalDeger = normalizeDeger.replace(',', '.');

    if (!sayisalAlanMi || !/^-?\d+(\.\d+)?$/.test(sayisalDeger)) return normalizeDeger;

    const [tamKisim, ondalikKisim] = sayisalDeger.split('.');
    const temizOndalik = (ondalikKisim ?? '').replace(/0+$/, '');
    return temizOndalik ? `${tamKisim}.${temizOndalik}` : tamKisim;
  }
}
