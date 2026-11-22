import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, afterNextRender, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BreadcrumbComponent } from '../../../shared/components/breadcrumb/breadcrumb.component';
import { KILAVUZ_BOLUMLERI, KILAVUZ_BOLUMU } from '../ortak/ekipman-kilavuzu-bolumleri';

/** İçindekiler kartının çapası ("İçindekiler" düğmesi buraya döner). */
const ICINDEKILER = 'icindekiler';
/** Metinden gönderme yapılan şemaların çapaları ("Şema 4'e bakın"). */
const SEMA = { konteyner: 'sema-3', lowbed: 'sema-4' } as const;
/** Kaydırılabilecek çapalar; adresten gelen parça bu kümede değilse yok sayılır. */
const CAPALAR: ReadonlySet<string> = new Set([
  ICINDEKILER,
  ...Object.values(SEMA),
  ...KILAVUZ_BOLUMLERI.map((b) => b.id),
]);

/**
 * Ekipman Kitaplığı Kılavuzu: düzenleme formundaki alanların ne anlama geldiğini şemalarla anlatan, yalnız okunan
 * sayfa (sunucuya istek atmaz). Bölümler çapayla açılır (`#yuzeyler`); formdaki yardım bağlantıları ilgili bölüme
 * yeni sekmede gelir. "Yazdır" tarayıcının yazdırma penceresini açar; yazdırma stilleri sayfayı kitapçığa çevirir.
 */
@Component({
  selector: 'app-ekipman-kilavuzu',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, BreadcrumbComponent],
  templateUrl: './ekipman-kilavuzu.component.html',
  styleUrls: ['../ortak/yukleme.scss', './ekipman-kilavuzu.component.scss'],
})
export class EkipmanKilavuzuComponent {
  private readonly belge = inject(DOCUMENT);
  private readonly rota = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly breadcrumb = [
    { label: 'Ana Kontrol Paneli', link: '/dashboard' },
    { label: 'Ekipman Kitaplığı', link: '/ekipman-kitapligi' },
    { label: 'Kılavuz' },
  ];
  readonly B = KILAVUZ_BOLUMU;
  readonly bolumler = KILAVUZ_BOLUMLERI;
  readonly ICINDEKILER = ICINDEKILER;
  readonly SEMA = SEMA;

  constructor() {
    // Bölümler çizildikten sonra adresteki çapaya gidilir; içindekiler bağlantısı ve geri/ileri de aynı akıştan gelir.
    afterNextRender(() => {
      this.rota.fragment.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((capa) => {
        if (capa) this.bolumeGit(capa);
      });
    });
  }

  /** Bölümü görünür alana getirir ve odağı oraya taşır (klavye ve ekran okuyucu bölümden devam eder). */
  bolumeGit(capa: string): void {
    if (!CAPALAR.has(capa)) return;
    const hedef = this.belge.getElementById(capa);
    if (!hedef) return;
    hedef.scrollIntoView({ block: 'start' });
    hedef.focus({ preventScroll: true });
  }

  yazdir(): void {
    this.belge.defaultView?.print();
  }
}
