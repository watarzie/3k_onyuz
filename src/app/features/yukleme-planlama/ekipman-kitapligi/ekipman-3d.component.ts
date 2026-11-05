import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  effect,
  input,
  signal,
  viewChild,
} from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { AciklikTarafi, EkipmanTeknikVerisi } from '../../../shared/models/yukleme-planlama.model';

type Gorunum = 'perspektif' | 'ust' | 'yan' | 'arka';

const RENK = {
  yuzey: 0x64748b,
  hacim: 0x0e7490,
  dis: 0x94a3b8,
  engel: 0xdc2626,
  sokulebilir: 0xf59e0b,
  aciklik: 0x16a34a,
  dingil: 0x1f2937,
  tahrikli: 0x7c3aed,
  kingPin: 0xeab308,
  baglama: 0x2563eb,
};

/**
 * Ekipman konfigürasyonunun 3B önizlemesi (three.js). Teknik verinin koordinatları: X ön uçtan arkaya, Y sol
 * kenardan sağa, Z yerden yukarı (mm). Sahnede X → x, Z → y (yukarı), Y → z; birim metre. Yükleme yüzeyleri, kullanılabilir
 * hacim, açıklıklar (yeşil), engeller (kırmızı; sökülebilir turuncu), dingiller, king pin ve bağlama noktaları çizilir.
 * Bilinmeyen veri tahminle çizilmez. Sahne yalnız değişince yeniden çizilir (sürekli döngü yok).
 */
@Component({
  selector: 'app-ekipman-3d',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="e3d">
      <div class="e3d__arac" role="group" aria-label="Görünüm">
        @for (g of gorunumler; track g.kod) {
          <button type="button" class="e3d__dugme" [class.active]="gorunum() === g.kod" (click)="gorunumSec(g.kod)">{{ g.ad }}</button>
        }
      </div>
      <div #kap class="e3d__tuval" [attr.aria-label]="'Ekipmanın 3B önizlemesi'"></div>
      @if (hata()) {
        <div class="e3d__hata">{{ hata() }}</div>
      }
      <div class="e3d__lejant" aria-hidden="true">
        <span><i style="background:#64748b"></i>Yükleme yüzeyi</span>
        <span><i style="background:#0e7490"></i>Kullanılabilir hacim</span>
        <span><i style="background:#16a34a"></i>Açıklık</span>
        <span><i style="background:#dc2626"></i>Engel</span>
        <span><i style="background:#f59e0b"></i>Sökülebilir engel</span>
        <span><i style="background:#1f2937"></i>Dingil</span>
        <span><i style="background:#eab308"></i>King pin</span>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .e3d { position: relative; }
    .e3d__tuval { width: 100%; height: 380px; border-radius: 12px; overflow: hidden; background: linear-gradient(#f8fafc, #e2e8f0); }
    .e3d__arac { position: absolute; top: 10px; left: 10px; z-index: 2; display: flex; gap: 4px; padding: 4px; border-radius: 10px; background: rgba(255,255,255,.9); box-shadow: 0 1px 4px rgba(15,23,42,.12); }
    .e3d__dugme { padding: 4px 10px; border: 0; border-radius: 7px; background: transparent; color: #475569; font-size: 12px; font-weight: 600; }
    .e3d__dugme.active { background: #0e7490; color: #fff; }
    .e3d__hata { position: absolute; inset: 0; display: grid; place-items: center; padding: 16px; color: #64748b; font-size: 13px; text-align: center; }
    .e3d__lejant { display: flex; flex-wrap: wrap; gap: 6px 14px; margin-top: 8px; color: #475569; font-size: 11.5px; }
    .e3d__lejant i { display: inline-block; width: 10px; height: 10px; margin-right: 5px; border-radius: 3px; vertical-align: -1px; }
  `],
})
export class Ekipman3dComponent implements AfterViewInit, OnDestroy {
  /** Teknik veri (çözümlenmiş JSON). */
  readonly veri = input<EkipmanTeknikVerisi | null>(null);

  readonly kap = viewChild.required<ElementRef<HTMLDivElement>>('kap');
  readonly gorunum = signal<Gorunum>('perspektif');
  readonly hata = signal<string | null>(null);
  readonly gorunumler: { kod: Gorunum; ad: string }[] = [
    { kod: 'perspektif', ad: '3B' },
    { kod: 'ust', ad: 'Üstten' },
    { kod: 'yan', ad: 'Yandan' },
    { kod: 'arka', ad: 'Arkadan' },
  ];

  private renderer: THREE.WebGLRenderer | null = null;
  private sahne = new THREE.Scene();
  private kamera = new THREE.PerspectiveCamera(45, 1, 0.05, 500);
  private kontrol: OrbitControls | null = null;
  private model = new THREE.Group();
  private gozlemci: ResizeObserver | null = null;
  private merkez = new THREE.Vector3();
  private boyut = 10;
  private hazir = false;

  constructor() {
    effect(() => {
      const v = this.veri();
      if (this.hazir) this.ciz(v);
    });
  }

  ngAfterViewInit(): void {
    const kap = this.kap().nativeElement;
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      this.hata.set('Tarayıcı 3B görüntülemeyi (WebGL) desteklemiyor; teknik veri tablolarını kullanın.');
      return;
    }
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    kap.appendChild(this.renderer.domElement);

    this.sahne.add(new THREE.HemisphereLight(0xffffff, 0x94a3b8, 1.6));
    const gunes = new THREE.DirectionalLight(0xffffff, 1.4);
    gunes.position.set(8, 14, 10);
    this.sahne.add(gunes);
    this.sahne.add(this.model);

    this.kontrol = new OrbitControls(this.kamera, this.renderer.domElement);
    this.kontrol.enableDamping = false;
    this.kontrol.addEventListener('change', () => this.render());

    this.gozlemci = new ResizeObserver(() => this.boyutla());
    this.gozlemci.observe(kap);
    this.boyutla();
    this.hazir = true;
    this.ciz(this.veri());
  }

  ngOnDestroy(): void {
    this.gozlemci?.disconnect();
    this.kontrol?.dispose();
    this.temizle();
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
  }

  gorunumSec(g: Gorunum): void {
    this.gorunum.set(g);
    this.kameraKonumla();
  }

  private boyutla(): void {
    if (!this.renderer) return;
    const kap = this.kap().nativeElement;
    const g = Math.max(kap.clientWidth, 1);
    const y = Math.max(kap.clientHeight, 1);
    this.renderer.setSize(g, y, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.kamera.aspect = g / y;
    this.kamera.updateProjectionMatrix();
    this.render();
  }

  private render(): void {
    this.renderer?.render(this.sahne, this.kamera);
  }

  private temizle(): void {
    this.model.traverse((n) => {
      const m = n as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
      const sprite = n as THREE.Sprite;
      if (sprite.isSprite) (sprite.material.map as THREE.Texture | null)?.dispose();
    });
    this.model.clear();
  }

  private ciz(v: EkipmanTeknikVerisi | null): void {
    this.temizle();
    if (!v) {
      this.render();
      return;
    }
    const yuzeyler = v.yuzeyler ?? [];
    const genislik = v.disOlcu?.genislikMm ?? Math.max(0, ...yuzeyler.map((y) => y.genislikMm));
    const uzunluk = v.disOlcu?.uzunlukMm ?? Math.max(0, ...yuzeyler.map((y) => y.baslangicXMm + y.uzunlukMm));
    const ortaY = genislik / 2;

    // Zemin ızgarası.
    const zemin = new THREE.GridHelper(Math.max(uzunluk, genislik) / 1000 + 6, 20, 0xcbd5e1, 0xe2e8f0);
    zemin.position.set(uzunluk / 2000, 0, ortaY / 1000);
    this.model.add(zemin);

    if (v.disOlcu) {
      this.model.add(this.cizgiKutu(0, 0, 0, v.disOlcu.uzunlukMm, v.disOlcu.genislikMm, v.disOlcu.yukseklikMm, RENK.dis));
    }

    for (const y of yuzeyler) {
      const yBas = ortaY - y.genislikMm / 2;
      const kalinlik = Math.min(80, Math.max(20, y.yerdenYukseklikMm));
      this.model.add(this.kutu(y.baslangicXMm, yBas, y.yerdenYukseklikMm - kalinlik, y.uzunlukMm, y.genislikMm, kalinlik, RENK.yuzey, 1));
      if (y.kullanilabilirYukseklikMm) {
        this.model.add(this.kutu(y.baslangicXMm, yBas, y.yerdenYukseklikMm, y.uzunlukMm, y.genislikMm, y.kullanilabilirYukseklikMm, RENK.hacim, 0.08));
        this.model.add(this.cizgiKutu(y.baslangicXMm, yBas, y.yerdenYukseklikMm, y.uzunlukMm, y.genislikMm, y.kullanilabilirYukseklikMm, RENK.hacim));
      }
    }

    const tabanZ = yuzeyler.length ? Math.min(...yuzeyler.map((y) => y.yerdenYukseklikMm)) : 0;
    for (const a of v.acikliklar ?? []) this.aciklikCiz(a.taraf, a, uzunluk, genislik, tabanZ, yuzeyler);

    for (const e of v.engeller ?? []) {
      this.model.add(this.kutu(e.xMm, e.yMm, e.zMm, e.uzunlukMm, e.genislikMm, e.yukseklikMm, e.sokulebilir ? RENK.sokulebilir : RENK.engel, e.sokulebilir ? 0.55 : 0.9));
    }

    for (const d of v.dingiller ?? []) {
      const yaricap = 450;
      const teker = new THREE.Mesh(
        new THREE.CylinderGeometry(yaricap / 1000, yaricap / 1000, Math.max(genislik, 2000) / 1000, 24),
        new THREE.MeshStandardMaterial({ color: d.tur === 'tahrikli' ? RENK.tahrikli : RENK.dingil, roughness: 0.8 }),
      );
      teker.rotation.x = Math.PI / 2;
      teker.position.set(d.xMm / 1000, yaricap / 1000, ortaY / 1000);
      this.model.add(teker);
    }

    if (v.kingPin) {
      const pim = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.4, 16), new THREE.MeshStandardMaterial({ color: RENK.kingPin }));
      pim.position.set(v.kingPin.xMm / 1000, Math.max(tabanZ - 200, 0) / 1000, ortaY / 1000);
      this.model.add(pim);
    }

    for (const b of v.baglamaNoktalari ?? []) {
      const nokta = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 12), new THREE.MeshStandardMaterial({ color: RENK.baglama }));
      nokta.position.set(b.xMm / 1000, b.zMm / 1000, b.yMm / 1000);
      this.model.add(nokta);
    }

    // Ön / arka işaretleri: X ekseni ön uçtan başlar.
    const yaziY = (v.disOlcu?.yukseklikMm ?? tabanZ + 1500) / 1000 + 0.4;
    this.model.add(this.yazi('ÖN', -0.6, yaziY, ortaY / 1000));
    this.model.add(this.yazi('ARKA', uzunluk / 1000 + 0.8, yaziY, ortaY / 1000));

    const yukseklik = v.disOlcu?.yukseklikMm ?? tabanZ + 3000;
    this.merkez.set(uzunluk / 2000, yukseklik / 2000, ortaY / 1000);
    this.boyut = Math.max(uzunluk, genislik, yukseklik, 3000) / 1000;
    this.kameraKonumla();
  }

  private aciklikCiz(
    taraf: AciklikTarafi,
    a: { baslangicXMm?: number | null; uzunlukMm?: number | null; genislikMm?: number | null; yukseklikMm?: number | null },
    uzunluk: number,
    genislik: number,
    tabanZ: number,
    yuzeyler: NonNullable<EkipmanTeknikVerisi['yuzeyler']>,
  ): void {
    const malzeme = new THREE.MeshBasicMaterial({ color: RENK.aciklik, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false });
    const yukseklik = (a.yukseklikMm ?? yuzeyler[0]?.kullanilabilirYukseklikMm ?? 0) / 1000;
    if (yukseklik <= 0 && taraf !== 'ust') return;
    let duzlem: THREE.Mesh;
    if (taraf === 'arka' || taraf === 'on') {
      const g = (a.genislikMm ?? genislik) / 1000;
      duzlem = new THREE.Mesh(new THREE.PlaneGeometry(g, yukseklik), malzeme);
      duzlem.rotation.y = Math.PI / 2;
      duzlem.position.set(taraf === 'arka' ? uzunluk / 1000 : 0, tabanZ / 1000 + yukseklik / 2, genislik / 2000);
    } else if (taraf === 'sol' || taraf === 'sag') {
      const bas = (a.baslangicXMm ?? 0) / 1000;
      const u = (a.uzunlukMm ?? uzunluk - (a.baslangicXMm ?? 0)) / 1000;
      duzlem = new THREE.Mesh(new THREE.PlaneGeometry(u, yukseklik), malzeme);
      duzlem.position.set(bas + u / 2, tabanZ / 1000 + yukseklik / 2, taraf === 'sol' ? 0 : genislik / 1000);
    } else {
      const bas = (a.baslangicXMm ?? 0) / 1000;
      const u = (a.uzunlukMm ?? uzunluk - (a.baslangicXMm ?? 0)) / 1000;
      const g = (a.genislikMm ?? genislik) / 1000;
      const ustZ = (tabanZ + (yuzeyler[0]?.kullanilabilirYukseklikMm ?? 0)) / 1000;
      duzlem = new THREE.Mesh(new THREE.PlaneGeometry(u, g), malzeme);
      duzlem.rotation.x = -Math.PI / 2;
      duzlem.position.set(bas + u / 2, ustZ, genislik / 2000);
    }
    this.model.add(duzlem);
  }

  /** Teknik veri koordinatlarındaki kutuyu (köşe + ölçü, mm) sahneye çevirir. */
  private kutu(x: number, y: number, z: number, u: number, g: number, h: number, renk: number, opaklik: number): THREE.Mesh {
    const malzeme = new THREE.MeshStandardMaterial({ color: renk, transparent: opaklik < 1, opacity: opaklik, roughness: 0.7, depthWrite: opaklik >= 0.5 });
    const kutu = new THREE.Mesh(new THREE.BoxGeometry(u / 1000, h / 1000, g / 1000), malzeme);
    kutu.position.set((x + u / 2) / 1000, (z + h / 2) / 1000, (y + g / 2) / 1000);
    return kutu;
  }

  private cizgiKutu(x: number, y: number, z: number, u: number, g: number, h: number, renk: number): THREE.LineSegments {
    const kenar = new THREE.EdgesGeometry(new THREE.BoxGeometry(u / 1000, h / 1000, g / 1000));
    const cizgi = new THREE.LineSegments(kenar, new THREE.LineBasicMaterial({ color: renk }));
    cizgi.position.set((x + u / 2) / 1000, (z + h / 2) / 1000, (y + g / 2) / 1000);
    return cizgi;
  }

  private yazi(metin: string, x: number, y: number, z: number): THREE.Sprite {
    const tuval = document.createElement('canvas');
    tuval.width = 256;
    tuval.height = 96;
    const c = tuval.getContext('2d');
    if (c) {
      c.fillStyle = 'rgba(15, 23, 42, .78)';
      c.beginPath();
      c.roundRect(8, 16, 240, 64, 16);
      c.fill();
      c.fillStyle = '#fff';
      c.font = 'bold 40px system-ui, sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(metin, 128, 50);
    }
    const doku = new THREE.CanvasTexture(tuval);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: doku, depthTest: false }));
    sprite.scale.set(1.4, 0.52, 1);
    sprite.position.set(x, y, z);
    return sprite;
  }

  private kameraKonumla(): void {
    if (!this.kontrol) return;
    const m = this.merkez;
    const d = this.boyut * 1.25;
    switch (this.gorunum()) {
      case 'ust':
        this.kamera.position.set(m.x, m.y + d * 1.4, m.z + 0.001);
        break;
      case 'yan':
        this.kamera.position.set(m.x, m.y, m.z - d * 1.3);
        break;
      case 'arka':
        this.kamera.position.set(m.x + d * 1.2, m.y + 0.6, m.z);
        break;
      default:
        this.kamera.position.set(m.x + d * 0.75, m.y + d * 0.6, m.z - d * 0.9);
    }
    this.kontrol.target.copy(m);
    this.kontrol.update();
    this.render();
  }
}
