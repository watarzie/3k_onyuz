import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { OnayListesiComponent } from './onay-listesi.component';
import { OnayKuraliDto, OnayService } from '../../core/services/onay.service';
import { BildirimService } from '../../core/services/bildirim.service';
import { ToastService } from '../../core/services/toast.service';
import { PermissionService } from '../../core/services/permission.service';
import { RolService } from '../../core/services/rol.service';

describe('OnayListesiComponent — dinamik onay kuralları penceresi', () => {
  const kurallar: OnayKuraliDto[] = [
    { lookupUcKDurumId: null, islemKodu: 'PROJE_KILIDI_AC', islemAdi: 'Proje Kilidi Açma', onayGerektirirMi: true, onayGerektirirMiDegistirilebilir: false, yetkiliRolIdleri: [1] },
    { lookupUcKDurumId: null, islemKodu: 'CEKI_REVIZYONU_UYGULA', islemAdi: 'Çeki Revizyonu Uygulama', onayGerektirirMi: true, onayGerektirirMiDegistirilebilir: true, yetkiliRolIdleri: [1, 2] },
    { lookupUcKDurumId: null, islemKodu: 'SANDIK_LOKASYON_GUNCELLE', islemAdi: 'Manuel Sandık Lokasyonu Atama', onayGerektirirMi: false, onayGerektirirMiDegistirilebilir: true, yetkiliRolIdleri: [1, 99] },
  ];
  let onay: jasmine.SpyObj<OnayService>;

  function kur() {
    onay = jasmine.createSpyObj<OnayService>('OnayService', ['getBekleyenler', 'getKurallar', 'updateKural', 'getGecmisDetayi', 'onayla', 'reddet']);
    onay.getBekleyenler.and.returnValue(of({ isSuccess: true, value: [] }) as never);
    onay.getKurallar.and.returnValue(of({ isSuccess: true, value: kurallar.map((k) => ({ ...k })) }) as never);
    onay.updateKural.and.returnValue(of({ isSuccess: true }) as never);
    TestBed.configureTestingModule({
      imports: [OnayListesiComponent],
      providers: [
        provideRouter([]),
        { provide: OnayService, useValue: onay },
        { provide: BildirimService, useValue: { onayGuncellendi$: new Subject<void>() } },
        { provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['success', 'error', 'warning']) },
        { provide: PermissionService, useValue: { canWrite: () => true, hasAccess: () => true } },
        { provide: RolService, useValue: { getRoller: () => of([{ id: 1, ad: 'Admin' }, { id: 2, ad: 'Kalite' }, { id: 3, ad: 'Surec' }]) } },
      ],
    });
    const fixture = TestBed.createComponent(OnayListesiComponent);
    fixture.detectChanges();
    fixture.componentInstance.openSettingsModal();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, c: fixture.componentInstance, el };
  }

  it('özet sayıları, durum etiketlerini ve seçili rol sayısını gösterir', () => {
    const { el } = kur();
    const sayilar = Array.from(el.querySelectorAll('.rules-stat strong')).map((x) => x.textContent!.trim());
    expect(sayilar).toEqual(['3', '2', '1', '1']);
    const kartlar = el.querySelectorAll('.rule-card');
    expect(kartlar.length).toBe(3);
    expect(kartlar[0].querySelector('.rule-badge')!.textContent).toContain('Her zaman onayda');
    expect((kartlar[0].querySelector('.rule-switch input') as HTMLInputElement).disabled).toBeTrue();
    expect(kartlar[2].querySelector('.rule-badge')!.textContent).toContain('Onaysız çalışır');
    // Listede olmayan rol (99) sayılmaz.
    expect(kartlar[2].querySelector('.rule-card__roles-head em')!.textContent!.trim()).toBe('1 / 3 seçili');
    expect(kartlar[1].querySelectorAll('.role-chip.active').length).toBe(2);
  });

  it('arama ve durum filtresi yalnız görünümü süzer; açılışta sıfırlanır', () => {
    const { fixture, c, el } = kur();
    c.kuralFiltresi.set('kapali'); fixture.detectChanges();
    expect(Array.from(el.querySelectorAll('.rule-card h6')).map((x) => x.textContent)).toEqual(['Manuel Sandık Lokasyonu Atama']);
    c.kuralFiltresi.set('tumu'); c.kuralAramasi.set('çeki'); fixture.detectChanges();
    expect(Array.from(el.querySelectorAll('.rule-card h6')).map((x) => x.textContent)).toEqual(['Çeki Revizyonu Uygulama']);
    c.kuralAramasi.set('yok-boyle-bir-sey'); fixture.detectChanges();
    expect(el.querySelector('.rules-empty')).not.toBeNull();
    expect(c.kurallar().length).toBe(3);

    c.closeSettingsModal(); c.openSettingsModal(); fixture.detectChanges();
    expect(c.kuralAramasi()).toBe('');
    expect(el.querySelectorAll('.rule-card').length).toBe(3);
  });

  it('çok kural varken kartlar sıkışmaz; liste kayar, kart içeriği kesilmez', () => {
    const { fixture, c, el } = kur();
    c.kurallar.set(Array.from({ length: 15 }, (_, i) => ({ ...kurallar[i % 3], islemKodu: `KURAL_${i}` })));
    c.roller.set(Array.from({ length: 15 }, (_, i) => ({ id: i + 1, ad: `Uzun Rol Adı ${i + 1}` })) as never);
    fixture.detectChanges();
    const kartlar = Array.from(el.querySelectorAll<HTMLElement>('.rule-card'));
    expect(kartlar.length).toBe(15);
    for (const kart of kartlar) {
      const roller = kart.querySelector<HTMLElement>('.rule-card__roles')!;
      // Rol alanı kartın içinde tamamen görünür olmalı (kart içeriğini kesmemeli).
      expect(roller.getBoundingClientRect().bottom).toBeLessThanOrEqual(kart.getBoundingClientRect().bottom + 0.5);
      expect(kart.getBoundingClientRect().height).toBeGreaterThan(100);
    }
    const govde = el.querySelector<HTMLElement>('.rules-body')!;
    expect(govde.scrollHeight).toBeGreaterThan(govde.clientHeight);
  });

  it('anahtar ve rol çipi önceki gibi kaydeder', () => {
    const { fixture, el } = kur();
    (el.querySelectorAll('.rule-card')[2].querySelector('.rule-switch input') as HTMLInputElement).click();
    fixture.detectChanges();
    expect(onay.updateKural).toHaveBeenCalledWith(jasmine.objectContaining({ islemKodu: 'SANDIK_LOKASYON_GUNCELLE', onayGerektirirMi: true }));

    const kalite = Array.from(el.querySelectorAll('.rule-card')[2].querySelectorAll<HTMLButtonElement>('.role-chip'))
      .find((x) => x.textContent!.includes('Kalite'))!;
    kalite.click(); fixture.detectChanges();
    expect(onay.updateKural).toHaveBeenCalledWith(jasmine.objectContaining({ islemKodu: 'SANDIK_LOKASYON_GUNCELLE', yetkiliRolIdleri: [1, 2, 99] }));
  });

  it('PO öncesi iş onayı talebini onaylarken kalemleri, tutarı ve değişen kalemi gösterir', () => {
    const { fixture, c, el } = kur();
    const kalem = {
      isKaydiId: 1, isAdi: 'Normal Ambalaj - 2', sandikNo: '2', sandikAdi: null, sandikTipi: null, boy: null, en: null,
      yukseklik: null, adet: 1, birim: 'm³', toplamM3: 0.293514, ahsapM3: 0.293514, kontraM3: 0, fiyatlandirmaBirimi: 2,
      birimFiyat: 500, ahsapBirimFiyat: null, kdvOrani: 20, netTutar: 146.76, siparisNetTutar: 0, paraBirimi: 'EUR',
      uretimTarihi: '2026-10-17T00:00:00', finansTarihi: '2026-10-17T00:00:00',
    };
    onay.getGecmisDetayi.and.returnValue(of({
      isSuccess: true,
      value: {
        id: 9, islemKodu: 'FINANS_PO_IS_ONAYI', islemAdi: 'Finans: PO Öncesi İş Onayı',
        islemAciklamasi: 'PA727-03 · Ana Ambalaj · 1 kalem · 146,76 EUR: PO öncesi iş onayı bekliyor.',
        talepEdenKullaniciId: 2, talepEdenKisi: 'Finans Personeli', durumId: 1, durum: 'Bekliyor',
        talepTarihi: '2026-10-17T10:00:00', calistirmaDurumuId: 1, calistirmaDurumu: 'Bekliyor', aksiyonAktifMi: true,
        projeNo: 'PA727-03',
        finansPoOnayDetayi: {
          talepId: 4,
          onizleme: {
            projeId: 395, projeNo: 'PA727-03', musteri: 'GE Vernova', kategori: 1, kategoriAdi: 'Ana Ambalaj',
            paraBirimi: 'EUR', kalemSayisi: 1, netTutar: 146.76, kdvTutari: 29.35, toplamTutar: 176.11, toplamM3: 0.293514,
            ahsapM3: 0.293514, kontraM3: 0, ilkFinansTarihi: '2026-10-17T00:00:00', sonFinansTarihi: '2026-10-17T00:00:00',
            kalemler: [kalem],
          },
          kalemDurumlari: [{ isKaydiId: 1, guncelNetTutar: 160, guncelParaBirimi: 'EUR', degisti: true, degisiklik: 'Net tutar 146,76 → 160,00 EUR.' }],
          degisenKalemSayisi: 1,
          uygulamaTarihi: null,
        },
      },
    }) as never);
    c.openOnayModal({ id: 9, islemKodu: 'FINANS_PO_IS_ONAYI', islemAciklamasi: 'PA727-03 · Ana Ambalaj', talepEdenKisi: 'Finans Personeli', olusturulmaTarihi: '2026-10-17T10:00:00', durum: 1 });
    fixture.detectChanges();
    expect(onay.getGecmisDetayi).toHaveBeenCalledWith(9);
    const detay = el.querySelector('app-finans-po-onay-detayi')!;
    expect(detay).not.toBeNull();
    expect(detay.textContent).toContain('Normal Ambalaj - 2');
    expect(detay.textContent).toContain('146.76 EUR');
    expect(detay.querySelector('.change-badge')!.textContent).toContain('146,76 → 160,00');
    expect(el.querySelector('.reject-modal-shell.has-revision-detail')).not.toBeNull();
  });
});
