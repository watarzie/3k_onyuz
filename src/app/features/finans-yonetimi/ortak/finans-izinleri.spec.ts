import { FINANS_YETKI } from '../../../core/constants/yetki-kodlari';
import {
  FINANS_ALT_SEKME_KODLARI,
  FINANS_ALT_SEKME_USTU,
  FINANS_ALT_SEKMELER,
  FINANS_GIDER_TANIM_SEKMELERI,
  FINANS_SEKME_KODLARI,
  FINANS_SEKME_SIRASI,
  FinansAltSekme,
  FinansSekme,
  finansAltSekmeAcik,
  finansAltSekmeYazilabilir,
  finansBelgeOkunabilir,
  finansFaturaGirilebilir,
  finansFaturaYazilabilir,
  finansHerhangiSekmeAcik,
  finansHerhangiSekmeYazilabilir,
  finansIlkAltSekme,
  finansIlkSekme,
  finansIsDuzenlenebilir,
  finansKayitOkunabilir,
  finansPoDuzeltilebilir,
  finansPoGirilebilir,
  finansSekmeAcik,
  finansSekmeYazilabilir,
  finansVadeUyarisiGorunur,
  finansVarlikYazilabilir,
} from './finans-izinleri';

describe('Finans izinleri sunucu kurallarının aynası (sekme ve alt sekme izni)', () => {
  /** Rol ağacının istemci görünümü: R kodları okunur, W kodları hem okunur hem yazılır. */
  function izinler(okuma: string[], yazma: string[] = []) {
    return {
      hasAccess: (kod: string) => okuma.includes(kod) || yazma.includes(kod),
      canWrite: (kod: string) => yazma.includes(kod),
    };
  }
  const modul = FINANS_YETKI.Modul;
  const kod = (sekme: FinansSekme) => FINANS_SEKME_KODLARI[sekme];
  const altKod = (alt: FinansAltSekme) => FINANS_ALT_SEKME_KODLARI[alt];
  /** Sekme düğümlerinin R izni (alt sekme izni yok). */
  const okur = (...sekmeler: FinansSekme[]) => izinler([modul, ...sekmeler.map(kod)]);
  /** Sekme düğümlerinin W izni. */
  const yazar = (...sekmeler: FinansSekme[]) => izinler([modul], sekmeler.map(kod));
  /** Alt sekmelerin ve üst sekmelerinin R izni. */
  const altOkur = (...altlar: FinansAltSekme[]) =>
    izinler([modul, ...altlar.map((a) => kod(FINANS_ALT_SEKME_USTU[a])), ...altlar.map(altKod)]);
  /** Alt sekmelerin ve üst sekmelerinin W izni. */
  const altYazar = (...altlar: FinansAltSekme[]) =>
    izinler([modul], [...altlar.map((a) => kod(FINANS_ALT_SEKME_USTU[a])), ...altlar.map(altKod)]);
  const altSekmesiz = FINANS_SEKME_SIRASI.filter((s) => !FINANS_ALT_SEKMELER[s]);

  describe('sekme düğümleri', () => {
    it('alt sekmesiz sekme yalnız modül ve kendi sekme düğümünün R iznini ister', () => {
      for (const sekme of altSekmesiz) {
        expect(finansSekmeAcik(okur(sekme), sekme)).withContext(sekme).toBeTrue();
        expect(finansSekmeAcik(izinler([kod(sekme)]), sekme)).withContext(sekme + ' modülsüz').toBeFalse();
        expect(finansSekmeAcik(izinler([modul]), sekme)).withContext(sekme + ' düğümsüz').toBeFalse();
      }
    });

    it('alt sekmeli sekme ancak en az bir alt sekmesi okunabiliyorsa görünür', () => {
      for (const [sekme, altlar] of Object.entries(FINANS_ALT_SEKMELER) as [FinansSekme, FinansAltSekme[]][]) {
        expect(finansSekmeAcik(okur(sekme), sekme)).withContext(sekme + ' yalnız sekme').toBeFalse();
        for (const alt of altlar) expect(finansSekmeAcik(altOkur(alt), sekme)).withContext(alt).toBeTrue();
      }
    });

    it('sekmedeki işlemler sekme düğümünün W iznini ister; R sekmeyi gösterir ama işlem açmaz', () => {
      for (const sekme of altSekmesiz) {
        expect(finansSekmeYazilabilir(yazar(sekme), sekme)).withContext(sekme).toBeTrue();
        expect(finansSekmeYazilabilir(okur(sekme), sekme)).withContext(sekme + ' yalnız R').toBeFalse();
      }
      expect(finansSekmeYazilabilir(yazar('akis'), 'giderler')).toBeFalse();
    });

    it('açılış sekmesi ekran sırasıyla görünen ilk sekmedir; alt sekmesi okunamayan sekme atlanır', () => {
      expect(finansIlkSekme(okur('raporlar', 'giderler'))).toBe('giderler');
      expect(finansIlkSekme(okur('raporlar', 'giderler', 'panel'))).toBe('panel');
      expect(finansIlkSekme(okur('akis', 'raporlar'))).toBe('raporlar');
      expect(finansIlkSekme(altOkur('bekleyen'))).toBe('akis');
      expect(finansIlkSekme(izinler([modul, FINANS_YETKI.VadeUyarisi]))).toBeNull();
    });
  });

  describe('alt sekmeler', () => {
    it('alt sekme modül, üst sekme ve alt sekme düğümünün R iznini ister (sekme tavandır)', () => {
      for (const alt of Object.keys(FINANS_ALT_SEKME_KODLARI) as FinansAltSekme[]) {
        expect(finansAltSekmeAcik(altOkur(alt), alt)).withContext(alt).toBeTrue();
        expect(finansAltSekmeAcik(izinler([modul, altKod(alt)]), alt)).withContext(alt + ' üst sekmesiz').toBeFalse();
        expect(finansAltSekmeAcik(okur(FINANS_ALT_SEKME_USTU[alt]), alt)).withContext(alt + ' yalnız sekme').toBeFalse();
      }
    });

    it('alt sekme W izni üst sekmenin W iznini de ister; R alt sekme işlem açmaz', () => {
      for (const alt of Object.keys(FINANS_ALT_SEKME_KODLARI) as FinansAltSekme[]) {
        const ust = kod(FINANS_ALT_SEKME_USTU[alt]);
        expect(finansAltSekmeYazilabilir(altYazar(alt), alt)).withContext(alt).toBeTrue();
        expect(finansAltSekmeYazilabilir(izinler([modul, ust], [altKod(alt)]), alt)).withContext(alt + ' üst yalnız R').toBeFalse();
        expect(finansAltSekmeYazilabilir(altOkur(alt), alt)).withContext(alt + ' yalnız R').toBeFalse();
      }
    });

    it('alt sekmeler birbirini açmaz; açılış alt sekmesi ekran sırasıyla okunabilen ilkidir', () => {
      expect(finansAltSekmeAcik(altOkur('arama'), 'aylik')).toBeFalse();
      expect(finansIlkAltSekme(altOkur('bekleyen', 'arama'), 'akis')).toBe('arama');
      expect(finansIlkAltSekme(altOkur('parametreler'), 'ayarlar')).toBe('parametreler');
      expect(finansIlkAltSekme(altOkur('fatura', 'po'), 'belgeler')).toBe('po');
      expect(finansIlkAltSekme(okur('belgeler'), 'belgeler')).toBeNull();
      expect(finansIlkAltSekme(okur('giderler'), 'giderler')).toBeNull();
    });
  });

  describe('ortak işlemler (FinansSekmeleri kümeleri)', () => {
    it('küme düğümleri sunucu gibi değerlendirilir: sekme düğümü alt sekme izni olmadan da yeter', () => {
      expect(finansHerhangiSekmeAcik(okur('raporlar'), FINANS_GIDER_TANIM_SEKMELERI)).toBeTrue();
      expect(finansHerhangiSekmeAcik(okur('akis'), FINANS_GIDER_TANIM_SEKMELERI)).toBeFalse();
      expect(finansHerhangiSekmeAcik(okur('akis'), ['akis'])).toBeTrue();
      expect(finansHerhangiSekmeAcik(okur('akis'), ['bekleyen'])).toBeFalse();
      expect(finansHerhangiSekmeYazilabilir(yazar('kategoriler'), FINANS_GIDER_TANIM_SEKMELERI)).toBeTrue();
      expect(finansHerhangiSekmeYazilabilir(okur(...altSekmesiz), FINANS_GIDER_TANIM_SEKMELERI)).toBeFalse();
    });

    it('kayıt detayı, hareketler ve genel arama kayıt sekmelerinden biriyle okunur; Giderler ve Tanımlar yetmez', () => {
      for (const sekme of ['akis', 'panel', 'belgeler', 'munferit', 'raporlar'] as const)
        expect(finansKayitOkunabilir(okur(sekme))).withContext(sekme).toBeTrue();
      for (const sekme of ['giderler', 'ayarlar', 'kategoriler'] as const)
        expect(finansKayitOkunabilir(okur(sekme))).withContext(sekme).toBeFalse();
    });

    it('belgeler ve değişiklik geçmişi kayıt sekmeleri veya Giderler ile okunur', () => {
      expect(finansBelgeOkunabilir(okur('giderler'))).toBeTrue();
      expect(finansBelgeOkunabilir(okur('belgeler'))).toBeTrue();
      expect(finansBelgeOkunabilir(okur('kategoriler'))).toBeFalse();
    });

    it('iş kaydı düzenleme İş Takibi veya Münferit İşler W ister', () => {
      expect(finansIsDuzenlenebilir(yazar('akis'))).toBeTrue();
      expect(finansIsDuzenlenebilir(yazar('munferit'))).toBeTrue();
      expect(finansIsDuzenlenebilir(yazar('belgeler'))).toBeFalse();
      expect(finansIsDuzenlenebilir(okur('akis', 'munferit'))).toBeFalse();
    });

    it("PO açma PO'lar alt sekmesi, İş Takibi veya Münferit İşler W ister; PO/Fatura sekmesinin W'si tek başına yetmez", () => {
      expect(finansPoGirilebilir(altYazar('po'))).toBeTrue();
      expect(finansPoGirilebilir(yazar('akis'))).toBeTrue();
      expect(finansPoGirilebilir(yazar('munferit'))).toBeTrue();
      expect(finansPoGirilebilir(yazar('belgeler'))).toBeFalse();
      expect(finansPoGirilebilir(altYazar('fatura'))).toBeFalse();
      expect(finansPoGirilebilir(altOkur('po'))).toBeFalse();
    });

    it("PO düzeltme/iptali PO'lar, fatura düzeltme/iptal/ödeme Faturalar alt sekmesinin W iznine bağlıdır", () => {
      expect(finansPoDuzeltilebilir(altYazar('po'))).toBeTrue();
      expect(finansPoDuzeltilebilir(altYazar('fatura'))).toBeFalse();
      expect(finansPoDuzeltilebilir(yazar('akis', 'munferit'))).toBeFalse();
      expect(finansFaturaYazilabilir(altYazar('fatura'))).toBeTrue();
      expect(finansFaturaYazilabilir(altYazar('po'))).toBeFalse();
      expect(finansFaturaYazilabilir(altOkur('fatura'))).toBeFalse();
    });

    it("yeni fatura girişi yalnız Faturalar W ister (PO seçimi Faturalar'a açık)", () => {
      expect(finansFaturaGirilebilir(altYazar('fatura'))).toBeTrue();
      expect(finansFaturaGirilebilir(altOkur('fatura'))).toBeFalse();
      expect(finansFaturaGirilebilir(altYazar('po'))).toBeFalse();
      const yazmaVeOkuma = izinler([modul, altKod('po')], [kod('belgeler'), altKod('fatura')]);
      expect(finansFaturaGirilebilir(yazmaVeOkuma)).toBeTrue();
      expect(finansFaturaGirilebilir(altYazar('fatura', 'po'))).toBeTrue();
    });

    it('belge yükleme ve kalıcı silme hedef kaydın sekme / alt sekmesinin W iznini ister', () => {
      expect(finansVarlikYazilabilir(altYazar('po'), 'Siparis')).toBeTrue();
      expect(finansVarlikYazilabilir(altYazar('fatura'), 'Siparis')).toBeFalse();
      expect(finansVarlikYazilabilir(altYazar('fatura'), 'Fatura')).toBeTrue();
      expect(finansVarlikYazilabilir(yazar('belgeler'), 'Fatura')).toBeFalse();
      expect(finansVarlikYazilabilir(yazar('giderler'), 'Gider')).toBeTrue();
      expect(finansVarlikYazilabilir(altYazar('po'), 'Gider')).toBeFalse();
      expect(finansVarlikYazilabilir(yazar('munferit'), 'IsKaydi')).toBeTrue();
      expect(finansVarlikYazilabilir(yazar('akis'), 'IsKaydi')).toBeTrue();
      // Bilinmeyen tür sunucuda İş Takibi sayılır.
      expect(finansVarlikYazilabilir(yazar('akis'), undefined)).toBeTrue();
      expect(finansVarlikYazilabilir(yazar('munferit'), null)).toBeFalse();
    });

    it('vade uyarısı ayrı izindir: modül ve vade uyarısı R; Faturalar alt sekmesi ne yeter ne gerekir', () => {
      expect(finansVadeUyarisiGorunur(izinler([modul, FINANS_YETKI.VadeUyarisi]))).toBeTrue();
      expect(finansVadeUyarisiGorunur(izinler([FINANS_YETKI.VadeUyarisi]))).toBeFalse();
      expect(finansVadeUyarisiGorunur(altOkur('fatura'))).toBeFalse();
    });
  });
});
