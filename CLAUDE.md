# CLAUDE.md — 3k_onyuz (Frontend)

3K platformunun Angular 20 web istemcisi. Arka uç ayrı depodadır: `C:\Users\Watarzie\source\repos\3K_Proje` (.NET 10).
Kalıcı mühendislik kurallarının tamamı `3k_onyuz-AGENTS.md` dosyasındadır; bu dosya hızlı yön bulma ve çalışma kurallarıdır.

Kullanıcıyla Türkçe konuşulur. Koddaki Türkçe alan adları (`proje`, `ceki`, `sandik`, `tahsis`, `sevk`, `onay`, `finans`, `ambalaj`…) korunur.

## Çalışma kuralları (önce bunlar)

- **Kullanıcı açıkça onay vermeden asla commit atma**; `git add` ile stage etme, push yapma. Sor: "Commit edebilir miyim?"
- **UI refactor'larında kullanıcı iş akışları asla değişmez**: aynı adımlar, aynı düğmeler, aynı izin koşulları, aynı onay pencereleri. Görsel/yapısal değişiklik davranışı değiştirmez.
- Sadece değişen alanın spec'lerini koş; her seferinde bütün test paketini çalıştırma (bkz. Test).
- İşe `git status --short` ile başla; var olan değişiklikleri koru, ilgisiz dosyaları biçimlendirme.
- Arka uç iş kurallarının, izinlerin ve miktarların tek doğru kaynağıdır. İstemci sunucunun karar vermediği bir kuralı uydurmaz; ekranda gizlemek yalnız kullanıcı deneyimidir.
- Sözleşme (endpoint, DTO, enum, izin kodu, çeviri) değişirse `3K_Proje` tarafını da aynı işte güncelle veya karşılaştır.

## Teknoloji

- Angular 20.3 standalone bileşenler (NgModule yok), signals, `@if/@for/@switch`, `input()/output()`, `inject()`.
- Bootstrap 5.3 (Sass, `angular.json` styles) + Trezo admin teması stilleri, `remixicon` simgeleri, `ng-apexcharts`/`apexcharts` grafikleri, `pdfmake` (dinamik yüklenir: `core/services/pdfmake-yukleyici.ts`).
- TypeScript strict + `strictTemplates`; gevşetme. Prettier: tek tırnak, 100 sütun; `.editorconfig`: 2 boşluk, UTF-8.
- API adresi `src/environments/environment.ts` (`apiBaseUrl`, yerelde `http://localhost:50447/api`); import alias'ı `@env/environment`.

## Klasör yapısı

```
src/app/
  app.config.ts, app.routes.ts      bootstrap/provider'lar; lazy loadComponent rotaları, guard'lar, data.menuKod
  core/
    auth/          auth.service, auth.guard, auth.interceptor
    guards/        menu.guard
    interceptors/  error.interceptor
    managers/      session.manager
    constants/     api-endpoints.ts (API), yetki-kodlari.ts (YETKI, AMBALAJ_YETKI, FINANS_YETKI), enums.ts, proje-tipi.ts
    services/      API servisleri (BaseApiService'ten türer) + PermissionService, ConfirmService, ToastService, TranslationService, PdfService, dosya-kaydet
  shared/
    components/    stat-card, server-pager, islemler-menusu, confirm-modal, toast, breadcrumb, readonly-banner, status-badge…
    directives/    can-access ([appCanAccess]), can-write ([appCanWrite])
    models/        DTO arayüzleri (finans.model.ts, finans-v2.model.ts, ambalaj.model.ts, common.model.ts → ApiResult<T>, onayaAlindi)
    pipes/         translate (| translate)
    validators/    CustomValidators
  layout/          main-layout, auth-layout, header, sidebar
  features/<modul>/<bilesen>/
src/assets/i18n/   tr.json, en.json
```

- HTTP çağrıları ve tarayıcı depolama erişimi yalnız `core` içindedir. API servisleri yalnız `core/services` altında; `features` altında paralel servis açma.
- `core` ve `shared`, `features`/`layout`'tan import etmez. Bir feature başka bir feature'ın kodunu veya stilini import etmez; ortak ihtiyaç `shared` (UI, model, saf yardımcı) veya `core`'a (servis, sabit) taşınır.
- `LookupStore`, `CacheManager`, `BasePageComponent` (`core/pages/base`) mevcut ekranların kalıbı değildir; örnek alma.

### Feature klasör kuralı

- **Her bileşen kendi klasöründe, modülünün altında yaşar**: `features/<modul>/<bilesen>/<bilesen>.component.{ts,html,scss,spec.ts}`.
  Örnek: `features/finans-yonetimi/finans-dagitim/`, `features/finans-yonetimi/finans-panel/`, `features/ambalaj-yonetimi/uretim-yasam-dongusu/`.
- **Modül içinde paylaşılan dosyalar `features/<modul>/ortak/`** altına gider. Örnek: `features/finans-yonetimi/ortak/` → `finans-v2.scss`, `finans-islem-dialoglari.scss`, `finans-izinleri.ts`, `finans-etiketleri.ts`, `finans-pricing.ts` (+ spec'leri). Bileşenler bunları göreli yolla kullanır: `styleUrls: ['../ortak/finans-v2.scss']`.
- **Tek bileşenli modüller dosyalarını doğrudan modül klasöründe tutar**: `onay-yonetimi/` (onay-listesi.component.*), `stok-yonetimi/`, `depo-durumu/`, `dashboard/`, `hareket-gecmisi/`, `landing/`.
- Rota hedefi sınıf adı dosya adından farklı olabilir; rotayı `app.routes.ts`'ten doğrula (ör. finans rotası `finans-aylik/finans-aylik.component` içindeki `FinansYonetimiComponent`'i yükler).
- Yeni rota mevcut `loadComponent` kalıbını, `canActivate: [menuGuard]` ve `data: { menuKod: ... }` kullanır; proje tipine bağlı rotada `data.projeTipi` verilir (`PROJE_TIPI_BAGLAMLARI`, `rotaProjeTipi()` — `core/constants/proje-tipi.ts`).

## Bileşen kuralları

- Standalone, `inject()` ile bağımlılık; ekran durumu `signal`, türetilmiş değer `computed`; `effect` yalnız yan etki için (sinyali sinyale kopyalamak için değil).
- Girdi/çıktı: `input()`, `input.required()`, `output()`. Yeni bileşenlerde `ChangeDetectionStrategy.OnPush`.
- `@for` kararlı kimlikle izlenir (`track x.id`, `sandikIcerikId`, `cekiSatiriId`), barkodla değil.
- Şablon bildirimsel kalır: ağır metot çağrısı ve iş koşulu yerine signal/computed/hazır satır modeli. Görünüm hesapları saf, test edilmiş yardımcı fonksiyonlardadır.
- RxJS: arama/filtre için `switchMap`, uzun ömürlü abonelikler `takeUntilDestroyed()`, iç içe `subscribe` yok.
- `innerHTML` / `bypassSecurityTrust*` ekleme.

### Çeviri (i18n)

- `TranslationService.translate('ANAHTAR.ALT')` veya şablonda `| translate`. Sözlükler `src/assets/i18n/tr.json` ve `en.json` (build zamanında import edilir).
- Modül anahtar önekleri: `FINANS_V2.*`, `URETIM_V2.*` (ambalaj), `MENU.*` (izin/menü etiketleri), `COMMON.*`, `ACTIONS.*`, `MESSAGES.*`…
- Finans bileşenlerinde yaygın kalıp:

```ts
private readonly translation = inject(TranslationService);
t(key: string): string {
  return this.translation.translate(`FINANS_V2.${key}`);
}
```
- **Yeni metin eklerken TR ve EN dosyalarının ikisini birlikte güncelle**; API enum değerlerini çeviri için değiştirme.

### İzinler

- Kodlar yalnız `core/constants/yetki-kodlari.ts` sabitlerinden: `YETKI`, `AMBALAJ_YETKI`, `FINANS_YETKI`. Literal yazma.
- Bileşende `readonly permissions = inject(PermissionService);` ve şablona açılan sabit `readonly izin = FINANS_YETKI;` (ad kuralı: `permissions`, `izin`).
- `PermissionService.hasAccess(kod)` görüntüleme (R), `canWrite(kod)` işlem (W); işlem düğmelerinde `canWrite` veya `*appCanWrite="izin.X"`, görünürlükte `*appCanAccess`.
- Düğme koşulu, çağrılan endpoint'in sunucuda istediği izinle birebir aynıdır. Çoklu izin isteyen finans kuralları `features/finans-yonetimi/ortak/finans-izinleri.ts` içindedir (ör. `finansRaporuIndirilebilir`, `finansBelgesiIndirilebilir`, `finansPoGirilebilir`); sunucunun `FinansAlanErisimFiltresi` kuralının aynasıdır.
- Sunucu, izni olmayan finans alanlarını `null` döndürür; şablon `null`'u sıfır gibi göstermez.

### Ortak servis ve bileşenler

- **HTTP**: servisler `BaseApiService`'ten türer; sonuç `ApiResult<T>` (`isSuccess`, `value`, hata). Hatalar çoğunlukla `isSuccess: false` değeri olarak gelir, yalnız `subscribe.error`'a güvenme. Endpoint'ler `core/constants/api-endpoints.ts` → `API.*`.
- **202 = onaya alındı, uygulanmadı**: `onayaAlindi(sonuc)` (`shared/models`) true ise başarı mesajı, liste yenileme veya indirme gibi sonraki adımı çalıştırma.
- **ConfirmService**: `await this.confirm.ask({ title, message, type })` → `boolean`; gerekçe gerekiyorsa `askWithReason({ ..., reason: { label, hint } })` → `string | null`. Mesaj HTML olarak işlenir: kullanıcı/sunucu metni `duzMetin()` ile eklenir. Tarayıcı `confirm()` kullanma.
- **ToastService**: `success`, `error`, `warning`, `info`.
- **IslemlerMenusuComponent** (`<app-islemler-menusu>`): satır işlemleri tek "İşlemler" açılır menüsünde; içerik `<button>` olarak projekte edilir ve her düğme kendi izin kontrolünü (`*appCanWrite`, `@if`) taşır. Girdiler: `etiket`, `ikon`, `birincil`, `disabled`. Görünür işlem yoksa tetikleyici gizlenir.
- **StatCardComponent** (`<app-stat-card>`): `value`, `label`, `icon` (remixicon sınıfı), `color`, `loading`, `hint`.
- **ServerPagerComponent** (`<app-server-pager>`): sunucu sayfalaması; `pageNumber`, `pageSize`, `totalCount`, `totalPages`, `hasPreviousPage`, `hasNextPage`, `pageSizeOptions` → `pageChange`, `pageSizeChange`. Sunucu sayfalı listeyi yerel filtreyle "tam sonuç" gibi gösterme.
- Dosya indirme: `PdfService` ve `dosyayiKaydet()` (`core/services/dosya-kaydet.ts`); Blob içindeki API hatasını çöz, object URL'leri serbest bırak.
- Para birimleri sunucudaki tanım tablosundan gelir (`FinansParaBirimiService`); listeyi kodda sabitleme.

### Yeni ekran / bileşen kontrol listesi

1. Klasör: `features/<modul>/<bilesen>/` (modül ortak dosyaları `ortak/`).
2. Rota: `app.routes.ts` içinde `loadComponent` + `menuGuard` + `data.menuKod` (gerekiyorsa `data.projeTipi`).
3. Servis metodu `core/services/<alan>.service.ts`, endpoint `API.*`, DTO `shared/models/<alan>.model.ts` (arka uç DTO'suyla birebir alan adları, nullable'lar ve enum sayıları).
4. İzin: `permissions` + `izin`; işlem düğmeleri `canWrite`, satır işlemleri `<app-islemler-menusu>`.
5. Metinler TR + EN sözlükte; onay `ConfirmService`, bildirim `ToastService`, 202 için `onayaAlindi`.
6. Spec yanına; yalnız o klasörün spec'lerini `--include` ile koş.

## Stil ve tasarım

- Global tema token'ları `src/styles.scss` `:root` içindedir; renkleri buradan kullan, hex sabitleme:
  `--primaryColor` (#605DFF), `--secondaryColor`, `--successColor`, `--dangerColor`, `--warningColor`, `--infoColor`, `--purpleColor`, `--orangeColor`, `--blackColor` (başlık metni), `--bodyColor` (gövde metni), `--borderColor`, `--whiteColor`, `--fontFamily` (Inter).
- Kart kalıbı: `<div class="trezo-card border-0 bg-white ...">` (`.trezo-card`: beyaz zemin, 10px radius, gölgesiz). Simgeler remixicon: `<i class="ri-..."></i>`.
- Tasarım dili: beyaz kartlar, yumuşak kenarlıklar (`var(--borderColor)`), 10–12px köşe yarıçapı, sade tipografi; gürültülü gradyan, ağır gölge ve parlak dolgu yok. Bootstrap override'ları: `.btn`/`.form-control` 8px radius, odakta primary halkası.
- Tasarım referansı Trezo şablon kaynağıdır (salt okunur, kopyalanacak mantık değil, görsel referans):
  `C:\Users\Watarzie\Desktop\themeforest-6g5oegmp-trezo-multiframework-admin-dashboard-template\trezo-admin-full-version\angular-bootstrap`
  → ör. `src/app/dashboard/finance/`, `src/app/dashboard/analytics/`, `src/app/tables/`, `src/app/ui-elements/`.
- Bileşen stilleri bileşen klasöründe veya modülün `ortak/` SCSS'inde; başka feature'ın stilini import etme. Tablo kaydırma, satır seçimi ve mobil yerleşim korunur.

### Hazır tasarım kalıpları (yeni ekranda bunları örnek al)

- **Liste sayfası**: `page-title-area` (h2 + `app-breadcrumb`, sağda beyaz/primary düğmeler) → beyaz kart (başlık + ikon + açıklama solda, gri zeminli arama kutusu sağda) → `#f8fafc` başlıklı tablo, hover `#fafbff` → altta `app-server-pager`. Örnekler: `stok-yonetimi/`, `onay-yonetimi/`.
- **Gösterge paneli**: Trezo finans panosu düzeni; üstte KPI kartları (etiket, büyük sayı, sağda yuvarlak renkli ikon, altta durum rozetleri), solda geniş sütunda grafik/tablolar, sağda dar sütunda durum kartları. Örnek: `finans-yonetimi/finans-panel/`.
- **Araç çubuğu**: bütün düğmeler aynı beyaz, ince kenarlı dilde; anlam rengi (PDF kırmızı, Excel yeşil, 3K yeşil, Grid turuncu) yalnız simgede. Seçime bağlı toplu işlemler seçili sayı rozetiyle tek grupta. Örnek: `projeler/proje-listesi/` (`toolbar-btn`, `toolbar-group`).
- **Durum gösterimi**: renkli nokta + yumuşak zeminli hap (`Aktif` yeşil, `Bekliyor` turuncu, `Tükendi` kırmızı); boş durumlar halkalı ikon + başlık + tek cümle.
- İşlemler menüsü öğeleri düz menü satırıdır; menü içindeki bir düğmeye gradyan/dolgu verme.
- **Tuzak**: `<td>`'ye `display: flex` verme; hücre tablo hücresi olmaktan çıkar, satır yüksekliğini ve hover zeminini kaybeder (ambalaj listesindeki kayma buydu). Düğmeleri hücre içinde bir `<div>` ile diz.

## Test ve build

- Karma + Jasmine (`@angular/build:karma`). Spec'ler bileşenin yanında (`*.spec.ts`); servisler `jasmine.createSpyObj` ile sahte, `TestBed.configureTestingModule({ imports: [Bilesen], providers: [...] })`, girdi `fixture.componentRef.setInput(...)`.
- **Sadece değişen alanın spec'lerini koş**; tam paketi yalnız kullanıcı isterse. Raporda hangi spec'lerin koştuğunu söyle.

```powershell
npm ci                                   # ilk kurulum (lock dosyasıyla)
npx ng test --watch=false --browsers=ChromeHeadless --include='src/app/features/finans-yonetimi/**/*.spec.ts'
npx ng test --watch=false --browsers=ChromeHeadless --include='src/app/features/ambalaj-yonetimi/**/*.spec.ts'
npx ng test --watch=false --browsers=ChromeHeadless --include='src/app/core/services/permission.service.spec.ts'
npm run build                            # production build
npm start                                # ng serve (http://localhost:4200)
```

- `npm run build` sırasında görülen global Bootstrap Sass `@import` deprecation uyarıları önceden vardır ve beklenir; hata değildir.
- Satır sonları: `core.autocrlf=true`; çalışma kopyası CRLF'dir. Yeni/yeniden yazılan dosyaları CRLF yaz, tek dosyada LF/CRLF karıştırma.
- Lint komutu tanımlı değil; uydurma. Bağımlılık değişirse `package.json` ve `package-lock.json` tutarlı kalır; `--force`/`--legacy-peer-deps` refleksle kullanılmaz.
- Davranış değişince ilgili miktar/sevk, finans, servis veya pager testlerini çalıştır ve genişlet. Basit metin/stil değişikliği için gereksiz test yazma. Koşmadığın kontrolü geçti diye raporlama.

## İş kuralları hatırlatması

- `cekiSatiriId` ve `sandikIcerikId` farklı kimliklerdir; toplam ihtiyaç, sandık miktarı, alınan/gönderilen ve kalan miktar birbirinin yerine kullanılmaz.
- Ortak ekranlar normal / saha / yedek rota bağlamlarının üçünde de değerlendirilir; proje tipi menü kodundan tahmin edilmez.
- Oturum/2FA akışı tam JWT oturumundan ayrıdır; token, OTP, kurtarma kodu loglanmaz.

## Teslim

Sonunda kısaca: değişen davranış (akış değişmediyse bunu belirt), ilgili dosyalar, koşulan spec'ler ve build, arka uç bağımlılığı veya engel.
