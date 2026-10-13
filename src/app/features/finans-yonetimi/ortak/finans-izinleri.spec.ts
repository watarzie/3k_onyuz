import { FINANS_YETKI } from '../../../core/constants/yetki-kodlari';
import {
  FINANS_GIDER_TANIM_SEKMELERI,
  FINANS_SEKME_KODLARI,
  FINANS_SEKME_SIRASI,
  FinansSekme,
  finansBelgeOkunabilir,
  finansHerhangiSekmeAcik,
  finansHerhangiSekmeYazilabilir,
  finansIlkSekme,
  finansIsDuzenlenebilir,
  finansKayitOkunabilir,
  finansPoGirilebilir,
  finansSekmeAcik,
  finansSekmeYazilabilir,
  finansSiparisFaturaYazilabilir,
  finansVadeUyarisiGorunur,
  finansVarlikYazilabilir,
} from './finans-izinleri';

describe('Finans izinleri sunucu kurallarının aynası (yalnız sekme izni)', () => {
  /** Rol ağacının istemci görünümü: R kodları okunur, W kodları hem okunur hem yazılır. */
  function izinler(okuma: string[], yazma: string[] = []) {
    return {
      hasAccess: (kod: string) => okuma.includes(kod) || yazma.includes(kod),
      canWrite: (kod: string) => yazma.includes(kod),
    };
  }
  const modul = FINANS_YETKI.Modul;
  const okur = (...sekmeler: FinansSekme[]) => izinler([modul, ...sekmeler.map((s) => FINANS_SEKME_KODLARI[s])]);
  const yazar = (...sekmeler: FinansSekme[]) => izinler([modul], sekmeler.map((s) => FINANS_SEKME_KODLARI[s]));

  describe('sekme düğümleri', () => {
    it('her sekme yalnız modül ve kendi sekme düğümünün R iznini ister; ek ekran veya alan izni yoktur', () => {
      for (const sekme of FINANS_SEKME_SIRASI) {
        expect(finansSekmeAcik(okur(sekme), sekme)).withContext(sekme).toBeTrue();
        expect(finansSekmeAcik(izinler([FINANS_SEKME_KODLARI[sekme]]), sekme)).withContext(sekme + ' modülsüz').toBeFalse();
        expect(finansSekmeAcik(izinler([modul]), sekme)).withContext(sekme + ' düğümsüz').toBeFalse();
      }
    });

    it('sekmedeki işlemler sekme düğümünün W iznini ister; R sekmeyi gösterir ama işlem açmaz', () => {
      for (const sekme of FINANS_SEKME_SIRASI) {
        expect(finansSekmeYazilabilir(yazar(sekme), sekme)).withContext(sekme).toBeTrue();
        expect(finansSekmeYazilabilir(okur(sekme), sekme)).withContext(sekme + ' yalnız R').toBeFalse();
        expect(finansSekmeYazilabilir(izinler([], [FINANS_SEKME_KODLARI[sekme]]), sekme)).withContext(sekme + ' modülsüz').toBeFalse();
      }
    });

    it('bir sekmenin izni başka sekmeyi açmaz', () => {
      expect(finansSekmeAcik(okur('akis'), 'belgeler')).toBeFalse();
      expect(finansSekmeYazilabilir(yazar('akis'), 'giderler')).toBeFalse();
    });

    it('herhangi biri yardımcıları kümedeki sekmelerden birini yeterli sayar', () => {
      expect(finansHerhangiSekmeAcik(okur('raporlar'), FINANS_GIDER_TANIM_SEKMELERI)).toBeTrue();
      expect(finansHerhangiSekmeAcik(okur('akis'), FINANS_GIDER_TANIM_SEKMELERI)).toBeFalse();
      expect(finansHerhangiSekmeYazilabilir(yazar('kategoriler'), FINANS_GIDER_TANIM_SEKMELERI)).toBeTrue();
      expect(finansHerhangiSekmeYazilabilir(okur(...FINANS_GIDER_TANIM_SEKMELERI), FINANS_GIDER_TANIM_SEKMELERI)).toBeFalse();
    });

    it('açılış sekmesi ekran sırasıyla erişilebilen ilk sekmedir; hiçbiri yoksa null', () => {
      expect(finansIlkSekme(okur('raporlar', 'giderler'))).toBe('giderler');
      expect(finansIlkSekme(okur('raporlar', 'giderler', 'panel'))).toBe('panel');
      expect(finansIlkSekme(izinler([modul, FINANS_YETKI.VadeUyarisi]))).toBeNull();
    });
  });

  describe('ortak işlemler (FinansSekmeleri kümeleri)', () => {
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

    it('PO açma PO/Fatura, İş Takibi veya Münferit İşler W ister; PO/fatura düzeltme yalnız PO/Fatura W', () => {
      for (const sekme of ['belgeler', 'akis', 'munferit'] as const)
        expect(finansPoGirilebilir(yazar(sekme))).withContext(sekme).toBeTrue();
      expect(finansPoGirilebilir(okur('belgeler', 'akis', 'munferit'))).toBeFalse();
      expect(finansSiparisFaturaYazilabilir(yazar('belgeler'))).toBeTrue();
      expect(finansSiparisFaturaYazilabilir(yazar('akis', 'munferit'))).toBeFalse();
      expect(finansSiparisFaturaYazilabilir(okur('belgeler'))).toBeFalse();
    });

    it('belge yükleme ve kalıcı silme hedef kaydın sekmesinin W iznini ister', () => {
      expect(finansVarlikYazilabilir(yazar('belgeler'), 'Siparis')).toBeTrue();
      expect(finansVarlikYazilabilir(yazar('belgeler'), 'Fatura')).toBeTrue();
      expect(finansVarlikYazilabilir(yazar('akis'), 'Fatura')).toBeFalse();
      expect(finansVarlikYazilabilir(yazar('giderler'), 'Gider')).toBeTrue();
      expect(finansVarlikYazilabilir(yazar('belgeler'), 'Gider')).toBeFalse();
      expect(finansVarlikYazilabilir(yazar('munferit'), 'IsKaydi')).toBeTrue();
      expect(finansVarlikYazilabilir(yazar('akis'), 'IsKaydi')).toBeTrue();
      // Bilinmeyen tür sunucuda İş Takibi sayılır.
      expect(finansVarlikYazilabilir(yazar('akis'), undefined)).toBeTrue();
      expect(finansVarlikYazilabilir(yazar('munferit'), null)).toBeFalse();
    });

    it('vade uyarısı ayrı izindir: modül ve vade uyarısı R; PO/Fatura sekmesi ne yeter ne gerekir', () => {
      expect(finansVadeUyarisiGorunur(izinler([modul, FINANS_YETKI.VadeUyarisi]))).toBeTrue();
      expect(finansVadeUyarisiGorunur(izinler([FINANS_YETKI.VadeUyarisi]))).toBeFalse();
      expect(finansVadeUyarisiGorunur(okur('belgeler'))).toBeFalse();
    });
  });
});
