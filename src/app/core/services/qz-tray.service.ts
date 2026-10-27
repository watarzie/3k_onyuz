import { Injectable } from '@angular/core';
import type * as Qz from 'qz-tray';

/** QZ Tray bu bilgisayarda çalışmıyor (kurulu değil ya da kapalı). */
export class QzTrayCalismiyorHatasi extends Error {
  constructor() {
    super('QZ Tray bu bilgisayarda çalışmıyor. QZ Tray\'i başlatın (saatin yanındaki simge) ya da Yazdır\'ı kullanın.');
  }
}

/**
 * QZ Tray köprüsü: kullanıcının bilgisayarındaki QZ Tray programı üzerinden yazıcıya ham komut (Godex EZPL) gönderir;
 * yazdırma penceresi açılmaz. Kütüphane yalnız ilk kullanımda yüklenir. İstekler imzasız olduğu için QZ Tray her
 * bağlantıda "izin ver" sorar; imza (sertifika) ayrı bir adımdır.
 */
@Injectable({ providedIn: 'root' })
export class QzTrayService {
  private kutuphane: Promise<typeof Qz> | null = null;
  private baglanti: Promise<void> | null = null;

  /** QZ Tray'in gördüğü yazıcılar (Windows'a kurulu yazıcı adları). */
  async yazicilar(): Promise<string[]> {
    const qz = await this.baglan();
    const sonuc = await qz.printers.find();
    return Array.isArray(sonuc) ? sonuc : [sonuc];
  }

  /** Komutu yazıcıya olduğu gibi gönderir (sürücü çizmez; Godex kendi fontu ve barkoduyla basar). */
  async hamGonder(yazici: string, komut: string): Promise<void> {
    const qz = await this.baglan();
    const ayar = qz.configs.create(yazici);
    await qz.print(ayar, [{ type: 'raw', format: 'command', flavor: 'plain', data: komut }]);
  }

  private async baglan(): Promise<typeof Qz> {
    const qz = await this.yukle();
    if (qz.websocket.isActive()) return qz;
    // Aynı anda gelen iki istek tek bağlantı kurar.
    this.baglanti ??= qz.websocket.connect({ retries: 1, delay: 1 }).finally(() => (this.baglanti = null));
    try {
      await this.baglanti;
    } catch {
      throw new QzTrayCalismiyorHatasi();
    }
    return qz;
  }

  private yukle(): Promise<typeof Qz> {
    this.kutuphane ??= import('qz-tray').then(m => ((m as unknown as { default?: typeof Qz }).default ?? m) as typeof Qz);
    return this.kutuphane;
  }
}
