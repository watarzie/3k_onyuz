# AGENTS.md — 3k_onyuz Frontend

Bu dosya depo kökünde `AGENTS.md` olarak bulunmalıdır. Kalıcı geliştirme kurallarını tanımlar; özellik backlog'u değildir. Mimariyi ve iş kurallarını koruyarak istenen değişikliği tamamla. Kullanıcının güncel talimatını esas al; ilgili alt dizin yönergelerini de oku. Açıklamaları güncel kaynakla doğrula. Kullanıcıyla Türkçe iletişim kur.

## Göreve başlama ve kapsam

- Önce `git status --short` çıktısını incele. Mevcut değişiklikleri koru; ilgisiz dosyaları geri alma veya yeniden biçimlendirme.
- İlgili ekranı, kullandığı servisi, DTO’yu, route ve yetki bağlamını birlikte oku. Benzer çalışan akışı örnek al; dosya adına bakarak kullanılmayan servisi seçme.
- En küçük tutarlı değişikliği yap. Ayrı talep olmadan genel mimari dönüşümü, bağımlılık yükseltmesi veya bütün ekranları kapsayan refactor başlatma.
- Sözleşme değişiyorsa erişilebilen `3K_Proje` backend controller, command/query ve DTO tanımlarıyla karşılaştır. Backend erişilemiyorsa yanıt biçimi veya iş kuralı uydurma; doğrulanamayan varsayımı açıkça belirt.

## Dizinler ve mimari

| Konum | Sorumluluk |
| --- | --- |
| `src/main.ts`, `src/app/app.config.ts` | Standalone bootstrap ve ortak provider/interceptor kayıtları |
| `src/app/app.routes.ts` | Lazy component rotaları, guard ve menü bağlamı |
| `src/app/core/auth`, `core/managers` | Kimlik doğrulama ve oturum yönetimi |
| `src/app/core/services`, `core/constants` | Aktif API servisleri, endpoint ve enum tanımları |
| `src/app/features` | Proje, Grid, 3K, sandık, saha/yedek ve diğer iş ekranları |
| `src/app/shared` | DTO’lar, tekrar kullanılan bileşenler, directive, pipe ve validator’lar |
| `src/app/layout` | Ana/giriş yerleşimi, başlık ve menü |
| `src/assets/i18n`, `src/environments`, `public` | Çeviriler, ortam yapılandırması ve statik varlıklar |

- Standalone component ve `inject()` yaklaşımını sürdür. Yeni sayfaları mevcut `loadComponent` düzenine ekle; gerekçesiz NgModule veya farklı durum yönetimi altyapısı ekleme.
- Ekran durumunu `signal`, türetilmiş değerleri `computed` ile yönet. HTTP, arama ve olay akışlarında RxJS kullan; uzun yaşayan abonelikleri component yaşam döngüsünde temizle. Arama/filtre isteklerinde eski yanıtın yeni seçimi ezmesini önle.
- Proje/Grid/3K/sandık ekranlarının aktif servisleri `core/services` altındadır. `features` altındaki aynı adlı eski servisleri import etmeden kullanımını kontrol et. `LookupStore`, `CacheManager`, `BasePageComponent` dosyalarının bulunması bunların mevcut ekranlarda kullanıldığını göstermez.
- Büyük component’lere sorumluluk yığma. Tekrarlanan editör veya görünüm hesaplamasını uygun yardımcıya/bileşene ayır; kapsam dışı davranış değiştirme.

## HTTP ve veri sözleşmeleri

- Endpoint’leri `core/constants/api-endpoints.ts`, ortam adresini `src/environments` üzerinden kullan. Component içinde yeni sabit sunucu adresi veya paralel HTTP katmanı oluşturma.
- İş servislerinde mevcut `BaseApiService` düzenini izle. Normal başarılı yanıt DTO’su istemcide `ApiResult<T>` içine alınır; HTTP hataları çoğunlukla `isSuccess: false` değeri olarak yayınlanır. Yalnızca `subscribe.error` kontrolüne güvenme.
- HTTP 202, işlemin uygulandığını değil onaya alındığını gösterebilir. Mevcut gövde içindeki `statusCode`, `value` ve çeki revizyonu sonuç tiplerini kontrol et; her başarılı HTTP yanıtında “tamamlandı” mesajı verme. Ortak wrapper değişirse tüm tüketicileri değerlendir.
- DTO alan adları, nullable değerler, enum sayıları ve sayfalama biçimini backend ile eşleştir. Yeni kodda `any` yerine belirli tipler kullan; farklı liste yanıtlarını aynı biçimde varsayma.
- PDF/Excel/ZIP indirmelerini `PdfService` ve Blob yardımcılarıyla sürdür. Endpoint, filtre, yetki, uzantı ve içerik türünü koru. Blob içindeki API hatasını ayrıştır; object URL’lerini serbest bırak. Sunucu raporunu gerekçesiz tarayıcı hesaplamasıyla değiştirme.

## Yetki, oturum ve olaylar

- `PermissionService`, `authGuard`, `menuGuard`, route `menuKod` ve yazma kontrollerini birlikte koru. R/W ayrımını hem ekran hem işlem düğmelerinde uygula.
- `X-Menu-Kod` işlem bağlamıdır; istemciden gönderilmesi yetki kanıtı değildir. Backend doğrulamasını kaldırma veya farklı menü kodu göndererek reddedilen işlemi çalıştırma.
- Parola/2FA challenge akışı ile tam JWT oturumunu ayır. Challenge doğrulanmadan tam oturum kurma; giriş/2FA isteklerine eski bearer bağlamı taşıma. Token, OTP, recovery kodu veya gizli anahtarları loglama.
- Oturum saklama, “beni hatırla”, zaman aşımı ve refresh değişikliklerini backend ile birlikte değerlendir. Refresh hatası, eşzamanlı istek ve logout durumlarını ele al; endpoint adından süresi dolmuş token’ın yenilenebileceğini varsayma.
- Grid/3K/stok BroadcastChannel bildirimleri sekmeler arasındadır. Bildirim/onay SSE bağlantısının açılış, yeniden bağlanma ve kapanış yönetimini koru; gereksiz ikinci bağlantı kurma. Manifest bulunmasını service worker veya çevrimdışı destek kanıtı sayma.

## İş kuralları ve görünüm

- `cekiSatiriId` ile `sandikIcerikId` farklı kimliklerdir. Bölünmüş sandık satırlarını yanlış birleştirme; toplam talep, sandık miktarı, gelen/sevk edilen ve kalan miktarları birbirinin yerine kullanma.
- Sevk kilidi, aktif sevk partisi, yeniden sevk sınırı, geri gönderim, stok/projeden karşılama ve onay kurallarını koru. Backend’in uygunluk ve miktar alanlarını esas al; görüntülenen etiketten yeni iş kuralı türetme. UI doğrulaması backend kontrolünün yerine geçmez.
- Ortak ekran değişikliğini normal, saha ve yedek route bağlamlarında değerlendir. Sunucuda sayfalanan listeleri yerel filtreyle eksiksiz sonuç gösteriyormuş gibi sunma.
- Mevcut Bootstrap/SCSS, toast, confirm, breadcrumb, pager ve salt okunur bileşenlerini yeniden kullan. Tablo kaydırma, satır seçimi, işlem sonrası odak ve mobil görünümü koru.
- Dosyaları UTF-8 ve mevcut satır sonlarıyla koru; Türkçe karakterleri bozma. Yeni ortak kullanıcı metinlerini mevcut anahtar düzeniyle TR/EN sözlüklerine ekle. Çeviri için API enum değerlerini değiştirme. TypeScript strict ayarlarını gevşetme; `.editorconfig` içindeki iki boşluk girintisini ve Prettier tek tırnak/100 sütun tercihini izle.

## Doğrulama ve teslim

- Kilit dosyasıyla kurulum için önce `npm ci` kullan. Bağımlılık değişikliğinde `package.json` ve `package-lock.json` tutarlı olmalı. Peer uyuşmazlığını incele; refleks olarak `--force` veya `--legacy-peer-deps` kullanma.
- Mevcut komutlar: `npm start`, `npm run build` (varsayılan production), `npm run watch` (development), `npm test`. Tanımlanmamış lint komutu veya araç zorunluluğu uydurma.
- Davranış değişikliğinde ilgili miktar/sevk, finans, servis veya pager testlerini çalıştır/genişlet. Chrome mevcutsa tek seferlik çalıştırma: `npm test -- --watch=false --browsers=ChromeHeadless`; kapsamı gerektiğinde `--include` ile daralt.
- Basit metin/stil değişikliğinde gereksiz test üretme. Çalıştırılmayan kontrolü başarılı diye bildirme. Teslimde değişen davranışı, doğrulamayı ve varsa engeli kısa belirt.
- Mimari veya komutlar değişirse bu dosyanın ilgili bölümünü güncelle; geçici görev listesi veya oturum dökümü ekleme.
