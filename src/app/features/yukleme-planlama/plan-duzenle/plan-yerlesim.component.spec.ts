import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import {
  PlanAraci,
  PlanYukKonumu,
  YerlesimGirisYonu,
  YerlesimKontrolSonucu,
  YuklemeCalismaBicimi,
  YuklemeLokasyonTercihi,
  YuklemePlaniDetayi,
  YuklemeProjeKarisimi,
} from '../../../shared/models/yukleme-planlama.model';
import { PlanYerlesimComponent } from './plan-yerlesim.component';

function konum(anahtar: string, projeNo: string, yMm = 100, enMm = 1000): PlanYukKonumu {
  return {
    yukAnahtari: anahtar, kod: anahtar, projeNo, brutKg: 500, xMm: 30, yMm, zMm: 0, boyMm: 1000, enMm, yukseklikMm: 1000,
    donduruldu: false, yuzeyKodu: 'ANA', istifNo: 1, kat: 1, yuklemeSirasi: 1, yuklemeYontemi: YerlesimGirisYonu.Arkadan,
  };
}

function arac(no: number, kod: string, konumlar: PlanYukKonumu[], sonuc = YerlesimKontrolSonucu.TeyitEdilmedi, aileDisi = false): PlanAraci {
  return {
    aracNo: no, konfigurasyonId: no, revizyonNo: 1, ekipmanKodu: kod, ekipmanAdi: kod, aileAdi: 'Konteyner', tipAdi: 'Tip', aileDisi,
    zorunluOzelEkipman: aileDisi,
    aileDisiGerekce: aileDisi ? 'Zorunlu özel ekipman' : null, projeNolari: ['P1'], lokasyonlar: ['3K'], konumlar, toplamKg: 1000,
    kapasiteKg: 2000, tabanDolulukYuzde: 10, agirlikMerkeziXMm: 500, yukluYukseklikMm: 2591, yukluGenislikMm: 2438, yukluUzunlukMm: 12192,
    solTasmaMm: 0, sagTasmaMm: 0, onTasmaMm: 0, arkaTasmaMm: 0, kontroller: [], sonuc, yukSorunlari: [],
    teknikVeriJson: '{"disOlcu":{"uzunlukMm":12192,"genislikMm":2438,"yukseklikMm":2591}}',
  };
}

function plan(araclar: PlanAraci[], farkliLokasyon = 1): YuklemePlaniDetayi {
  return {
    id: 1, planNo: 'YP-2026-000001', ad: 'P', calismaBicimi: YuklemeCalismaBicimi.IhtiyacaGoreArac, tasimaAilesiId: 1, tasimaAilesiAdi: 'Konteyner',
    projeKarisimi: YuklemeProjeKarisimi.Karisik, lokasyonTercihi: YuklemeLokasyonTercihi.HenuzSecilmedi, yuklemeTarihi: null, aciklama: null,
    revizyonNo: 2, revizyonTarihi: '2026-11-05T10:00:00', kaydeden: null, revizyonAciklamasi: null,
    ayarlar: { yerlesimBosluguMm: 30, yukseklikPayiMm: null, genislikPayiMm: null, uzunlukPayiMm: null, agirlikPayiKg: null, yuklemeHareketiPayiMm: null, mevcutAraclar: [] },
    projeler: [
      { projeId: 1, projeNo: 'P1', musteri: null, projeTipiId: 1, sevkEdilmisSandikSayisi: 0 },
      { projeId: 2, projeNo: 'P2', musteri: null, projeTipiId: 1, sevkEdilmisSandikSayisi: 0 },
    ],
    yukler: [], sayaclar: { toplam: 0, secilen: 0, hesaplanabilir: 0, veriEksik: 0, haricTutulan: 0, sevkEdilmisSandik: 0, yerlesen: 0, yerlesemeyen: 0 },
    kaynakFarklari: [], farkliLokasyonSayisi: farkliLokasyon,
    yerlesim: { hesapTarihi: '2026-11-05T10:00:00', sonuc: YerlesimKontrolSonucu.TeyitEdilmedi, elleDuzenlendi: false, lokasyonaGoreAyri: false, projeBazindaAyri: false,
      araclar, yerlesemeyenler: [], ekIhtiyaclar: [], uyarilar: [] },
  };
}

describe('PlanYerlesimComponent', () => {
  function kur(p: YuklemePlaniDetayi) {
    TestBed.configureTestingModule({ imports: [PlanYerlesimComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
    const fixture = TestBed.createComponent(PlanYerlesimComponent);
    fixture.componentRef.setInput('plan', p);
    return fixture.componentInstance;
  }

  it('araç tiplerini adetle özetler; zorunlu özel ekipman ayrı satırdır', () => {
    const c = kur(plan([arac(1, 'K40', []), arac(2, 'K40', []), arac(3, 'LB-3', [], YerlesimKontrolSonucu.TeyitEdilmedi, true)]));
    expect(c.tipOzeti().map((t) => [t.kod, t.adet, t.aileDisi])).toEqual([['K40', 2, false], ['LB-3', 1, true]]);
  });

  it('yükleri proje rengiyle çizer; uygunsuz araçta yalnız taşan yük kırmızıdır', () => {
    const c = kur(plan([arac(1, 'LB-3', [konum('s:1', 'P1'), konum('s:2', 'P2', -500, 3500)], YerlesimKontrolSonucu.Uygunsuz)]));
    const [a, b] = c.yukler3d();
    expect(a.renk).not.toEqual(b.renk);
    expect([a.sorunlu, b.sorunlu]).toEqual([false, true]);
  });

  it('elle yerleşimde uygunsuz yük sonucu olan yük kırmızıdır ve kodla listelenir', () => {
    const a = arac(1, 'K40', [konum('s:1', 'P1'), konum('s:2', 'P1', 1200)]);
    a.yukSorunlari = [
      { yukAnahtari: 's:2', sonuc: YerlesimKontrolSonucu.Uygunsuz, mesaj: 'Çakışma: s:1' },
      { yukAnahtari: 's:1', sonuc: YerlesimKontrolSonucu.TeyitEdilmedi, mesaj: 'Kasa sınırı teyit edilmedi' },
    ];
    const c = kur(plan([a]));
    expect(c.yukler3d().map((y) => y.sorunlu)).toEqual([false, true]);
    expect(c.yukSorunlari().map((s) => s.kod)).toEqual(['s:2', 's:1']);
  });

  it('ilk hesap lokasyon ayrımı yapmaz; farklı lokasyonda tercih sorulur ve seçilen tercihle hesaplanır', () => {
    const c = kur(plan([arac(1, 'K40', [konum('s:1', 'P1')])], 2));
    const istekler: YuklemeLokasyonTercihi[] = [];
    c.hesapla.subscribe((t) => istekler.push(t));
    expect(c.lokasyonSorusu()).toBeTrue();
    c.tercih.set(YuklemeLokasyonTercihi.LokasyonaGoreAyri);
    c.tercihleHesapla();
    expect(istekler).toEqual([YuklemeLokasyonTercihi.LokasyonaGoreAyri]);
  });
});
