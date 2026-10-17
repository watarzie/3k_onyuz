import { TestBed } from '@angular/core/testing';
import { FinansPoOnayDetayiComponent } from './finans-po-onay-detayi.component';
import { FinansPoOnayDetay } from '../../models/finans.model';
import { FinansIsKategorisi } from '../../../core/constants/enums';

function finansPoOnayDetayi(ek: Partial<FinansPoOnayDetay> = {}): FinansPoOnayDetay {
  const kalem = {
    isKaydiId: 1,
    isAdi: 'Normal Ambalaj - 2',
    sandikNo: '2',
    sandikAdi: null,
    sandikTipi: 'Ahşap Kapalı',
    boy: 120,
    en: 80,
    yukseklik: 95,
    adet: 1,
    birim: 'm³',
    toplamM3: 0.293514,
    ahsapM3: 0.293514,
    kontraM3: 0,
    fiyatlandirmaBirimi: 2 as const,
    birimFiyat: 500,
    ahsapBirimFiyat: null,
    kdvOrani: 20,
    netTutar: 146.76,
    siparisNetTutar: 0,
    paraBirimi: 'EUR',
    uretimTarihi: '2026-10-17T00:00:00',
    finansTarihi: '2026-10-17T00:00:00',
  };
  return {
    talepId: 4,
    onizleme: {
      projeId: 395,
      projeNo: 'PA727-03',
      musteri: 'GE Vernova',
      kategori: FinansIsKategorisi.AnaAmbalaj,
      kategoriAdi: 'Ana Ambalaj',
      paraBirimi: 'EUR',
      kalemSayisi: 2,
      netTutar: 373.54,
      kdvTutari: 74.71,
      toplamTutar: 448.25,
      toplamM3: 0.747073,
      ahsapM3: 0.747073,
      kontraM3: 0,
      ilkFinansTarihi: '2026-10-17T00:00:00',
      sonFinansTarihi: '2026-10-17T00:00:00',
      kalemler: [kalem, { ...kalem, isKaydiId: 2, isAdi: 'Normal Ambalaj - 4', sandikNo: '4', toplamM3: 0.453559, netTutar: 226.78 }],
    },
    kalemDurumlari: [
      { isKaydiId: 1, guncelNetTutar: 146.76, guncelParaBirimi: 'EUR', degisti: false, degisiklik: null },
      { isKaydiId: 2, guncelNetTutar: 250, guncelParaBirimi: 'EUR', degisti: true, degisiklik: 'Net tutar 226,78 → 250,00 EUR.' },
    ],
    degisenKalemSayisi: 1,
    uygulamaTarihi: null,
    ...ek,
  };
}

describe('FinansPoOnayDetayiComponent', () => {
  function kur(detay: FinansPoOnayDetay) {
    TestBed.configureTestingModule({ imports: [FinansPoOnayDetayiComponent] });
    const fixture = TestBed.createComponent(FinansPoOnayDetayiComponent);
    fixture.componentRef.setInput('detay', detay);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('onaycıya proje, kategori, kalemler, ölçü, m³ ve tutarları gösterir; değişen kalemi uyarır', () => {
    const el = kur(finansPoOnayDetayi());
    expect(el.querySelector('.po-approval-detail__subtitle')!.textContent).toContain('PA727-03');
    expect(el.querySelector('.po-approval-detail__subtitle')!.textContent).toContain('Ana Ambalaj');
    const satirlar = el.querySelectorAll('tbody tr');
    expect(satirlar.length).toBe(2);
    expect(satirlar[0].textContent).toContain('120 × 80 × 95');
    expect(satirlar[0].textContent).toContain('146.76 EUR');
    expect(satirlar[0].querySelector('.ok-badge')).not.toBeNull();
    expect(satirlar[1].classList).toContain('is-changed');
    expect(satirlar[1].querySelector('.change-badge')!.textContent).toContain('226,78 → 250,00');
    expect(el.querySelector('.po-approval-detail__warning')!.textContent).toContain('1 kalem değişti');
    expect(el.querySelector('.po-approval-detail__summary')!.textContent).toContain('373.54 EUR');
  });

  it('uygulanmış talepte değişiklik uyarısı yerine uygulama tarihini gösterir', () => {
    const el = kur(finansPoOnayDetayi({ uygulamaTarihi: '2026-10-17T10:30:00' }));
    expect(el.querySelector('.po-approval-detail__warning')).toBeNull();
    expect(el.querySelector('.po-approval-detail__status')!.textContent).toContain('Uygulandı');
  });
});
